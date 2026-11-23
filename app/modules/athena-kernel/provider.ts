import { ATHENA_CONTEXT_BUDGET } from "../athena-context-engine/budget";
import { AthenaKernelError, athenaCancellationError, athenaProviderError, athenaServiceError, athenaTimeoutError } from "./errors";
import { getAthenaFlags } from "./flags";
import type { AthenaAIContext } from "./types";

export interface AthenaProviderResult {
  text: string;
  provider: string;
  model: string;
  providerVersion?: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedUsd?: number;
}

export interface AthenaProviderCallInput {
  message: string;
  context?: AthenaAIContext;
  signal: AbortSignal;
  deadline: Date;
}

// One provider-adapter seam for model calls. The optional context is the
// already-authorized/minimized C001 snapshot assembled by the kernel; provider
// implementations may consume it, but it never grants permissions or bypasses
// application-service ownership.
export interface AthenaProviderAdapter {
  generateDraft(input: AthenaProviderCallInput): Promise<AthenaProviderResult>;
}

export class FakeAthenaProvider implements AthenaProviderAdapter {
  async generateDraft(input: AthenaProviderCallInput): Promise<AthenaProviderResult> {
    if (input.signal.aborted) {
      throw athenaCancellationError("This request was cancelled before Athena could respond.");
    }
    if (Date.now() > input.deadline.getTime()) {
      throw athenaTimeoutError("Athena did not respond in time.");
    }
    return {
      text: "This is a draft-only Athena response. No business records were changed.",
      provider: "fake",
      model: "athena-fake-v1",
      providerVersion: "1.0.0",
    };
  }
}

export class DisabledAthenaProvider implements AthenaProviderAdapter {
  async generateDraft(): Promise<AthenaProviderResult> {
    throw athenaTimeoutError("Athena's model provider is not configured.", "athena_provider_disabled");
  }
}

// Google Gemini adapter (Google AI Studio API). Draft-only: one stateless
// generateContent call per kernel request, no conversation history, no tools.
// The API key travels in the x-goog-api-key header only — never as a ?key=
// query parameter — and never appears in a thrown error, log, or telemetry
// field. Cost rates are telemetry estimates, never the bill.
export const GEMINI_DEFAULT_MODEL = "gemini-3.5-flash-lite";
export const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com";

// Google Gemini API pricing, paid tier, standard requests, USD per 1M tokens.
// Source: Google's Gemini API pricing page, checked 2026-11-23. Rates change;
// estimatedUsd is a telemetry estimate, never the bill.
export const GEMINI_USD_PER_MILLION_INPUT_TOKENS = 0.3;
export const GEMINI_USD_PER_MILLION_OUTPUT_TOKENS = 2.5;

const GEMINI_TEMPERATURE = 0.3;
const GEMINI_MAX_OUTPUT_TOKENS = 1024;
const ESTIMATED_CHARS_PER_TOKEN = 4;

const GEMINI_SYSTEM_PROMPT =
  "You are Athena, a draft-only operations partner for a contractor using TradeOS. " +
  "Answer only from the user's message and the supplied context. " +
  "Never invent amounts, measurements, dates, or statuses. " +
  "Never claim a business record was changed — drafts change nothing. " +
  "Never expose organization or user ids, tokens, or internal permission names. " +
  "When the question needs data that is not in the context, say what is missing instead of guessing. " +
  "Keep answers short and jobsite-plain.";

const GEMINI_BLOCKED_FINISH_REASONS = new Set(["SAFETY", "RECITATION", "PROHIBITED_CONTENT", "SPII"]);

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
  };
  modelVersion?: string;
}

function geminiEmptyResponseError(): AthenaKernelError {
  return athenaServiceError("Athena could not complete this request.", "athena_provider_empty_response");
}

// Renders the minimal A1 context into a compact block: role, selected-scope
// ids, and interaction metadata only. Request/telemetry ids, organization and
// user ids, and the permission list are never sent. The block is truncated to
// the context budget; scope ids are never silently dropped — if truncation
// would remove one, the call fails instead.
function renderGeminiContextBlock(context: AthenaAIContext | undefined): string {
  if (!context) return "";
  const lines: string[] = [`Role: ${context.user.role}`];
  const scopeIds: string[] = [];
  const scope = context.selectedScope ?? {};
  const scopeEntries: Array<[string, string | undefined]> = [
    ["customer", scope.customerId],
    ["project", scope.projectId],
    ["job", scope.jobId],
    ["estimate", scope.estimateId],
    ["invoice", scope.invoiceId],
  ];
  for (const [label, value] of scopeEntries) {
    if (value) {
      lines.push(`Scope ${label}: ${value}`);
      scopeIds.push(value);
    }
  }
  if (scope.page) lines.push(`Scope page: ${scope.page}`);
  const interaction = context.request.interaction;
  if (interaction) {
    lines.push(`Channel: ${interaction.channel}`);
    if (interaction.platform) lines.push(`Platform: ${interaction.platform}`);
    if (interaction.viewportClass) lines.push(`Viewport: ${interaction.viewportClass}`);
    if (interaction.connectivity) lines.push(`Connectivity: ${interaction.connectivity}`);
  }
  let text = lines.join("\n");
  const maxChars = ATHENA_CONTEXT_BUDGET.maxEstimatedTokens * ESTIMATED_CHARS_PER_TOKEN;
  if (text.length > maxChars) {
    text = text.slice(0, maxChars);
    const dropped = scopeIds.filter((id) => !text.includes(id));
    if (dropped.length > 0) {
      throw athenaServiceError("Athena could not complete this request.", "athena_provider_context_too_large");
    }
  }
  return text;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export class GoogleGeminiAthenaProvider implements AthenaProviderAdapter {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.apiKey = env.GEMINI_API_KEY ?? "";
    const configuredModel = env.ATHENA_GEMINI_MODEL?.trim();
    this.model = configuredModel ? configuredModel : GEMINI_DEFAULT_MODEL;
  }

  async generateDraft(input: AthenaProviderCallInput): Promise<AthenaProviderResult> {
    if (input.signal.aborted) {
      throw athenaCancellationError("This request was cancelled before Athena could respond.");
    }
    if (!this.apiKey) {
      throw new AthenaKernelError({
        code: "athena_provider_auth_failed",
        category: "provider",
        retryable: false,
        safeSummary: "Athena's model provider is not configured correctly.",
      });
    }
    const contextBlock = renderGeminiContextBlock(input.context);
    const userText = contextBlock ? `${contextBlock}\n\n${input.message}` : input.message;
    const url = `${GEMINI_API_BASE_URL}/v1beta/models/${encodeURIComponent(this.model)}:generateContent`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: GEMINI_SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: userText }] }],
          generationConfig: {
            temperature: GEMINI_TEMPERATURE,
            maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
            thinkingConfig: { thinkingLevel: "LOW" },
          },
        }),
        signal: input.signal,
      });
    } catch (error) {
      // An aborted fetch propagates so the kernel maps it to its own
      // provider-timeout/cancellation path; every other transport failure is
      // a retryable provider error. The key never appears in the error.
      if (isAbortError(error) || input.signal.aborted) throw error;
      throw athenaProviderError("Athena's model provider is temporarily unavailable.", "athena_provider_unavailable");
    }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new AthenaKernelError({
          code: "athena_provider_auth_failed",
          category: "provider",
          retryable: false,
          safeSummary: "Athena's model provider is not configured correctly.",
        });
      }
      if (response.status === 400) {
        throw athenaServiceError("Athena could not complete this request.", "athena_provider_bad_request");
      }
      throw athenaProviderError("Athena's model provider is temporarily unavailable.", "athena_provider_unavailable");
    }
    let payload: GeminiGenerateContentResponse;
    try {
      payload = (await response.json()) as GeminiGenerateContentResponse;
    } catch {
      throw geminiEmptyResponseError();
    }
    const candidate = payload.candidates?.[0];
    if (payload.promptFeedback?.blockReason) throw geminiEmptyResponseError();
    if (candidate?.finishReason && GEMINI_BLOCKED_FINISH_REASONS.has(candidate.finishReason)) throw geminiEmptyResponseError();
    const text = (candidate?.content?.parts ?? [])
      .map((part) => (typeof part.text === "string" ? part.text : ""))
      .join("");
    if (!text) throw geminiEmptyResponseError();
    // STOP is a complete reply; MAX_TOKENS is a success with truncated text.
    // Any other finish reason is a fail-closed empty response.
    if (candidate?.finishReason !== "STOP" && candidate?.finishReason !== "MAX_TOKENS") throw geminiEmptyResponseError();
    const usage = payload.usageMetadata;
    const inputTokens = typeof usage?.promptTokenCount === "number" ? usage.promptTokenCount : undefined;
    const outputTokens =
      typeof usage?.candidatesTokenCount === "number" || typeof usage?.thoughtsTokenCount === "number"
        ? (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0)
        : undefined;
    const estimatedUsd =
      inputTokens !== undefined && outputTokens !== undefined
        ? (inputTokens * GEMINI_USD_PER_MILLION_INPUT_TOKENS) / 1_000_000 +
          (outputTokens * GEMINI_USD_PER_MILLION_OUTPUT_TOKENS) / 1_000_000
        : undefined;
    return {
      text,
      provider: "google",
      model: this.model,
      providerVersion: typeof payload.modelVersion === "string" ? payload.modelVersion : undefined,
      inputTokens,
      outputTokens,
      estimatedUsd,
    };
  }
}

export function resolveAthenaProvider(env: NodeJS.ProcessEnv = process.env): AthenaProviderAdapter {
  const flags = getAthenaFlags(env);
  if (flags.providerMode === "fake") return new FakeAthenaProvider();
  if (flags.providerMode === "google" && env.GEMINI_API_KEY?.trim()) return new GoogleGeminiAthenaProvider(env);
  return new DisabledAthenaProvider();
}
