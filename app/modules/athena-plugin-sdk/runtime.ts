import type { AthenaPluginGrant, AthenaPluginManifest, AthenaPluginReviewRecord } from "./types";
import { assertPluginEventAllowed, assertPluginPermissionAllowed, assertPluginSandboxAllows } from "./sandbox";

export interface AthenaPluginRuntimeContext {
  activeOrgId: string;
  manifest: AthenaPluginManifest;
  review: AthenaPluginReviewRecord;
  grant: AthenaPluginGrant;
}

/** Verifies an installed plugin remains approved and enabled for the active tenant. */
export function assertPluginMayLoad(ctx: AthenaPluginRuntimeContext): void {
  assertPluginSandboxAllows(ctx);
}

/** Verifies a tool is declared and all of its permissions remain granted for the active tenant. */
export function assertPluginToolMayExecute(
  ctx: AthenaPluginRuntimeContext,
  toolId: string,
  permissions: string[],
): void {
  assertPluginMayLoad(ctx);
  if (!ctx.manifest.tools.includes(toolId)) {
    throw new Error("ATHENA_PLUGIN_SANDBOX_DENIED:tool_not_declared");
  }
  for (const permission of permissions) {
    assertPluginPermissionAllowed({ ...ctx, permission });
  }
}

/** Verifies a context provider is declared for the active tenant's installed manifest. */
export function assertPluginContextProviderMayRun(
  ctx: AthenaPluginRuntimeContext,
  providerId: string,
): void {
  assertPluginMayLoad(ctx);
  if (!ctx.manifest.contextProviders.includes(providerId)) {
    throw new Error("ATHENA_PLUGIN_SANDBOX_DENIED:context_provider_not_declared");
  }
}

/** Verifies a consumed event is both A8-registered and explicitly granted. */
export function assertPluginEventSubscriptionMayRun(
  ctx: AthenaPluginRuntimeContext,
  eventType: string,
  registeredEventTypes: ReadonlySet<string>,
): void {
  if (!registeredEventTypes.has(eventType)) {
    throw new Error("ATHENA_PLUGIN_SANDBOX_DENIED:event_not_registered");
  }
  assertPluginEventAllowed({ ...ctx, event: { direction: "consume", type: eventType } });
}

/** Verifies a published event is both A8-registered and explicitly granted. */
export function assertPluginEventPublicationMayRun(
  ctx: AthenaPluginRuntimeContext,
  eventType: string,
  registeredEventTypes: ReadonlySet<string>,
): void {
  if (!registeredEventTypes.has(eventType)) {
    throw new Error("ATHENA_PLUGIN_SANDBOX_DENIED:event_not_registered");
  }
  assertPluginEventAllowed({ ...ctx, event: { direction: "publish", type: eventType } });
}
