import type { AthenaPluginGrant, AthenaPluginManifest, AthenaPluginReviewRecord } from "./types";
import { assertPluginEventAllowed, assertPluginPermissionAllowed, assertPluginSandboxAllows } from "./sandbox";

export interface AthenaPluginRuntimeContext {
  manifest: AthenaPluginManifest;
  review: AthenaPluginReviewRecord;
  grant: AthenaPluginGrant;
}

export function assertPluginMayLoad(ctx: AthenaPluginRuntimeContext): void {
  assertPluginSandboxAllows(ctx);
}

export function assertPluginToolMayExecute(ctx: AthenaPluginRuntimeContext, permissions: string[]): void {
  assertPluginMayLoad(ctx);
  for (const permission of permissions) {
    assertPluginPermissionAllowed({ ...ctx, permission });
  }
}

export function assertPluginContextProviderMayRun(ctx: AthenaPluginRuntimeContext): void {
  assertPluginMayLoad(ctx);
}

export function assertPluginEventSubscriptionMayRun(ctx: AthenaPluginRuntimeContext, eventType: string): void {
  assertPluginEventAllowed({ ...ctx, event: { direction: "consume", type: eventType } });
}

export function assertPluginEventPublicationMayRun(ctx: AthenaPluginRuntimeContext, eventType: string): void {
  assertPluginEventAllowed({ ...ctx, event: { direction: "publish", type: eventType } });
}
