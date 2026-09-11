import type { AthenaPluginGrant, AthenaPluginManifest, AthenaPluginReviewRecord } from "./types";
import { evaluatePluginCapability } from "./lifecycle";

export interface AthenaPluginSandboxRequest {
  activeOrgId: string;
  manifest: AthenaPluginManifest;
  review?: AthenaPluginReviewRecord;
  grant?: AthenaPluginGrant;
  permission?: string;
  networkHost?: string;
  event?: { direction: "consume" | "publish"; type: string };
}

/** Throws a stable fail-closed error when the requested plugin capability is not authorized. */
export function assertPluginSandboxAllows(request: AthenaPluginSandboxRequest): void {
  const decision = evaluatePluginCapability(request);
  if (!decision.allowed) {
    throw new Error(`ATHENA_PLUGIN_SANDBOX_DENIED:${decision.reasonCode}`);
  }
}

/** Checks an outbound hostname against the exact active organization grant. */
export function assertPluginNetworkAllowed(request: Omit<AthenaPluginSandboxRequest, "networkHost"> & { networkHost: string }): void {
  assertPluginSandboxAllows(request);
}

/** Checks a permission against the exact active organization grant. */
export function assertPluginPermissionAllowed(request: Omit<AthenaPluginSandboxRequest, "permission"> & { permission: string }): void {
  assertPluginSandboxAllows(request);
}

/** Checks an event direction/type against the exact active organization grant. */
export function assertPluginEventAllowed(request: Omit<AthenaPluginSandboxRequest, "event"> & { event: { direction: "consume" | "publish"; type: string } }): void {
  assertPluginSandboxAllows(request);
}
