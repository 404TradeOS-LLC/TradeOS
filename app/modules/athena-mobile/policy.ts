import { computeCanonicalInputHash } from "../athena-action-engine/inputHash";
import type { AthenaInteractionContext, AthenaVoiceConfirmationChallenge } from "../athena-kernel/types";
import type { AthenaToolDefinition } from "../athena-tool-registry/types";

export type AthenaChannelToolDecision =
  | { decision: "allow"; reasonCode: "athena_channel_allowed" }
  | { decision: "deny"; reasonCode: "athena_voice_disabled" | "athena_voice_risk_requires_visual_review" }
  | { decision: "confirm"; reasonCode: "athena_voice_confirmation_required"; challenge: AthenaVoiceConfirmationChallenge };

export function isAthenaVoiceEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ATHENA_VOICE_ENABLED === "true";
}

function safeToolPrompt(tool: Pick<AthenaToolDefinition, "id" | "description">): string {
  const description = tool.description.trim().replace(/\s+/g, " ").slice(0, 180);
  return `Confirm this Athena action: ${description || tool.id}.`;
}

/**
 * A14 channel gate. It only narrows already-resolved/A4-authorized paths and
 * never substitutes for A6 approval. Voice refuses medium/high risk entirely.
 * Low-risk contextual/always actions need an exact validated-input hash proof.
 */
export function evaluateAthenaChannelToolPolicy(input: {
  interaction?: AthenaInteractionContext;
  tool: AthenaToolDefinition;
  validatedInput: unknown;
  env?: NodeJS.ProcessEnv;
}): AthenaChannelToolDecision {
  const channel = input.interaction?.channel ?? "text";
  if (channel !== "voice") return { decision: "allow", reasonCode: "athena_channel_allowed" };
  if (!isAthenaVoiceEnabled(input.env)) return { decision: "deny", reasonCode: "athena_voice_disabled" };
  if (input.tool.risk !== "low") return { decision: "deny", reasonCode: "athena_voice_risk_requires_visual_review" };
  if (input.tool.confirmationPolicy === "never") return { decision: "allow", reasonCode: "athena_channel_allowed" };

  const inputHash = computeCanonicalInputHash(input.validatedInput);
  const proof = input.interaction?.voiceConfirmation;
  if (
    proof?.confirmed === true
    && proof.toolId === input.tool.id
    && proof.toolVersion === input.tool.version
    && proof.inputHash === inputHash
  ) {
    return { decision: "allow", reasonCode: "athena_channel_allowed" };
  }

  return {
    decision: "confirm",
    reasonCode: "athena_voice_confirmation_required",
    challenge: {
      toolId: input.tool.id,
      toolVersion: input.tool.version,
      inputHash,
      prompt: safeToolPrompt(input.tool),
    },
  };
}
