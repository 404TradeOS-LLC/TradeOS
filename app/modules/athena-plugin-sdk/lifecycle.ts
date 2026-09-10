import type {
  AthenaPluginCapabilityDecision,
  AthenaPluginGrant,
  AthenaPluginManifest,
  AthenaPluginReviewRecord,
} from "./types";
import { hashAthenaPluginManifest, reviewMatchesManifest } from "./review";

export function installApprovedPlugin(input: {
  orgId: string;
  manifest: AthenaPluginManifest;
  review: AthenaPluginReviewRecord;
  installedBy: string;
  installedAt?: string;
}): AthenaPluginGrant {
  if (!reviewMatchesManifest(input.review, input.manifest)) {
    throw new Error("ATHENA_PLUGIN_REVIEW_REQUIRED");
  }
  const now = input.installedAt ?? new Date().toISOString();
  return {
    orgId: input.orgId,
    pluginId: input.manifest.id,
    pluginVersion: input.manifest.version,
    manifestHash: hashAthenaPluginManifest(input.manifest),
    permissions: [...input.review.approvedPermissions],
    allowedHosts: [...input.review.approvedHosts],
    eventsConsumed: [...input.review.approvedEventsConsumed],
    eventsPublished: [...input.review.approvedEventsPublished],
    status: "installed",
    installedBy: input.installedBy,
    installedAt: now,
    updatedAt: now,
  };
}

export function transitionPluginGrant(
  grant: AthenaPluginGrant,
  status: "installed" | "disabled" | "revoked" | "uninstalled",
  updatedAt = new Date().toISOString(),
): AthenaPluginGrant {
  if (grant.status === "revoked" || grant.status === "uninstalled") {
    throw new Error("ATHENA_PLUGIN_TERMINAL_STATE");
  }
  return { ...grant, status, updatedAt };
}

export function evaluatePluginCapability(input: {
  manifest: AthenaPluginManifest;
  review?: AthenaPluginReviewRecord;
  grant?: AthenaPluginGrant;
  permission?: string;
  networkHost?: string;
  event?: { direction: "consume" | "publish"; type: string };
}): AthenaPluginCapabilityDecision {
  const { manifest, review, grant } = input;
  if (!review || !reviewMatchesManifest(review, manifest)) return { allowed: false, reasonCode: "review_required" };
  if (!grant) return { allowed: false, reasonCode: "plugin_not_installed" };
  if (grant.status === "disabled") return { allowed: false, reasonCode: "plugin_disabled" };
  if (grant.status === "revoked" || grant.status === "uninstalled") return { allowed: false, reasonCode: "plugin_revoked" };
  if (grant.manifestHash !== hashAthenaPluginManifest(manifest)) return { allowed: false, reasonCode: "manifest_changed" };
  if (input.permission && !grant.permissions.includes(input.permission)) return { allowed: false, reasonCode: "permission_not_granted" };
  if (input.networkHost && !grant.allowedHosts.includes(input.networkHost)) return { allowed: false, reasonCode: "network_host_not_granted" };
  if (input.event) {
    const allowedEvents = input.event.direction === "consume" ? grant.eventsConsumed : grant.eventsPublished;
    if (!allowedEvents.includes(input.event.type)) return { allowed: false, reasonCode: "event_not_granted" };
  }
  return { allowed: true, reasonCode: "approved" };
}
