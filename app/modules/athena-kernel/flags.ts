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
  routerPlannerEnabled: boolean;
  actionEngineEnabled: boolean;
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
    // A5 dark-by-default flag (docs/athena/roadmap/A5-router-planner-implementation-plan.md).
    // Independent of kernelEnabled: the live HTTP path is already gated by
    // kernelEnabled, so this only controls whether that already-gated path
    // uses A5's router/planner/live-context orchestration or A1's original
    // routing/planning stand-ins.
    routerPlannerEnabled: parseBooleanFlag(env.ATHENA_ROUTER_PLANNER_ENABLED, false),
    // A6 dark-by-default flag (docs/athena/roadmap/A6-action-engine-implementation-plan.md).
    // Independent of routerPlannerEnabled and kernelEnabled: the tool_call
    // step loop below is only reachable at all when routerPlannerEnabled is
    // true, so this only controls whether that already-gated loop actually
    // invokes the Action Engine (executeAthenaAction()) for an eligible step
    // or preserves A5's exact dormant behavior (classify/authorize, never
    // execute). Enabling this flag never enables routerPlannerEnabled or
    // kernelEnabled on its own.
    actionEngineEnabled: parseBooleanFlag(env.ATHENA_ACTION_ENGINE_ENABLED, false),
  };
}

export function isAthenaKernelEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return getAthenaFlags(env).kernelEnabled;
}
