import { athenaCancellationError, athenaTimeoutError } from "./errors";
import { getAthenaFlags } from "./flags";

export interface AthenaProviderResult {
  text: string;
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedUsd?: number;
}

export interface AthenaProviderCallInput {
  message: string;
  signal: AbortSignal;
  deadline: Date;
}

// One provider-adapter seam for model calls (docs/athena/roadmap/
// A1-ai-kernel-implementation-plan.md "one provider-adapter seam ... with
// fake/local provider support in tests"). Real production providers are not
// wired in A1; ATHENA_PROVIDER_MODE stays "disabled" unless explicitly
// configured for local/test use.
export interface AthenaProviderAdapter {
  generateDraft(input: AthenaProviderCallInput): Promise<AthenaProviderResult>;
}

// Deterministic, non-network provider used in tests and local development.
// It never returns token/cost usage (that would be fabricated), matching
// "Missing provider usage data should be recorded as unknown, not estimated
// from prompt text" (A1 plan, Cost attribution).
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
    };
  }
}

// A provider that always fails closed. Selected whenever ATHENA_PROVIDER_MODE
// is not explicitly "fake" - this is what keeps A1 from ever attempting a
// real, unconfigured production model call.
export class DisabledAthenaProvider implements AthenaProviderAdapter {
  async generateDraft(): Promise<AthenaProviderResult> {
    throw athenaTimeoutError("Athena's model provider is not configured.", "athena_provider_disabled");
  }
}

export function resolveAthenaProvider(env: NodeJS.ProcessEnv = process.env): AthenaProviderAdapter {
  const flags = getAthenaFlags(env);
  return flags.providerMode === "fake" ? new FakeAthenaProvider() : new DisabledAthenaProvider();
}
