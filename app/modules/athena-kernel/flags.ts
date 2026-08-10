// A1 ships dark by default (docs/athena/roadmap/A1-ai-kernel-implementation-plan.md
// "Feature Flags"). Every flag is re-read from process.env on each call
// (no module-level caching) so tests can toggle behavior per request
// without reloading modules.
export type AthenaProviderMode = "fake" | "disabled";

export interface AthenaFeatureFlags {
  kernelEnabled: boolean;
  providerMode: AthenaProviderMode;
  draftResponsesEnabled: boolean;
  telemetryEnabled: boolean;
  costTrackingEnabled: boolean;
}

function parseBooleanFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.trim().toLowerCase() === "true";
}

export function getAthenaFlags(env: NodeJS.ProcessEnv = process.env): AthenaFeatureFlags {
  return {
    kernelEnabled: parseBooleanFlag(env.ATHENA_KERNEL_ENABLED, false),
    providerMode: env.ATHENA_PROVIDER_MODE === "fake" ? "fake" : "disabled",
    draftResponsesEnabled: parseBooleanFlag(env.ATHENA_DRAFT_RESPONSES_ENABLED, false),
    telemetryEnabled: parseBooleanFlag(env.ATHENA_TELEMETRY_ENABLED, true),
    costTrackingEnabled: parseBooleanFlag(env.ATHENA_COST_TRACKING_ENABLED, true),
  };
}

export function isAthenaKernelEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return getAthenaFlags(env).kernelEnabled;
}
