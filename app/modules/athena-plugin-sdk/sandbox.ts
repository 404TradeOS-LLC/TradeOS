import type { AthenaPluginGrant, AthenaPluginManifest, AthenaPluginReviewRecord } from "./types";
import { evaluatePluginCapability } from "./lifecycle";

export interface AthenaPluginSandboxRequest {
  manifest: AthenaPluginManifest;
  review?: AthenaPluginReviewRecord;
  grant?: AthenaPluginGrant;
  permission?: string;
  networkHost?: string;
  event?: { direction: "consume" | "publish"; type: string };
}

export function assertPluginSandboxAllows(request: AthenaPluginSandboxRequest): void {
  const decision = evaluatePluginCapability(request);
  if (!decision.allowed) {
    throw new Error(`ATHENA_PLUGIN_SANDBOX_DENIED:${decision.reasonCode}`);
  }
}

export function assertPluginNetworkAllowed(request: Omit<AthenaPluginSandboxRequest, "networkHost"> & { networkHost: string }): void {
  assertPluginSandboxAllows(request);
}

export function assertPluginPermissionAllowed(request: Omit<AthenaPluginSandboxRequest, "permission"> & { permission: string }): void {
  assertPluginSandboxAllows(request);
}

export function assertPluginEventAllowed(request: Omit<AthenaPluginSandboxRequest, "event"> & { event: { direction: "consume" | "publish"; type: string } }): void {
  assertPluginSandboxAllows(request);
}
