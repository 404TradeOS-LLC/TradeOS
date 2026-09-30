import { athenaCancellationError, athenaTimeoutError } from "./errors";
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

export function resolveAthenaProvider(env: NodeJS.ProcessEnv = process.env): AthenaProviderAdapter {
  const flags = getAthenaFlags(env);
  return flags.providerMode === "fake" ? new FakeAthenaProvider() : new DisabledAthenaProvider();
}
