import { createHash } from "node:crypto";
import type { AthenaPluginManifest, AthenaPluginReviewRecord } from "./types";
import { validateAthenaPluginManifest } from "./manifest";

function isSubset(values: string[], allowed: string[]): boolean {
  const allowedSet = new Set(allowed);
  return values.every((value) => allowedSet.has(value));
}

/** Returns the stable SHA-256 identity used to bind review decisions to one exact manifest. */
export function hashAthenaPluginManifest(manifest: AthenaPluginManifest): string {
  const canonical = JSON.stringify({
    ...manifest,
    tools: [...manifest.tools].sort(),
    contextProviders: [...manifest.contextProviders].sort(),
    eventsConsumed: [...manifest.eventsConsumed].sort(),
    eventsPublished: [...manifest.eventsPublished].sort(),
    permissions: [...manifest.permissions].sort(),
    network: manifest.network ? { allowedHosts: [...manifest.network.allowedHosts].sort() } : undefined,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

/** Creates an approved review only after the supplied third-party manifest passes C012 validation. */
export function createApprovedPluginReview(input: {
  manifest: AthenaPluginManifest;
  reviewedBy: string;
  reviewedAt?: string;
  supportedAthenaContractVersion?: string;
}): AthenaPluginReviewRecord {
  const validation = validateAthenaPluginManifest(input.manifest, input.supportedAthenaContractVersion ?? "1.0.0");
  if (!validation.ok) {
    throw new Error(`ATHENA_PLUGIN_INVALID_MANIFEST:${validation.issues.map((issue) => issue.code).join(",")}`);
  }

  const manifest = validation.manifest;
  return {
    pluginId: manifest.id,
    pluginVersion: manifest.version,
    publisher: manifest.publisher,
    manifestHash: hashAthenaPluginManifest(manifest),
    status: "approved",
    approvedPermissions: [...manifest.permissions],
    approvedHosts: [...(manifest.network?.allowedHosts ?? [])],
    approvedEventsConsumed: [...manifest.eventsConsumed],
    approvedEventsPublished: [...manifest.eventsPublished],
    reviewedBy: input.reviewedBy,
    reviewedAt: input.reviewedAt ?? new Date().toISOString(),
  };
}

/** Verifies review identity/hash and proves every granted capability was declared by a valid manifest. */
export function reviewMatchesManifest(review: AthenaPluginReviewRecord, manifest: AthenaPluginManifest): boolean {
  if (!validateAthenaPluginManifest(manifest).ok) return false;
  return review.status === "approved"
    && review.pluginId === manifest.id
    && review.pluginVersion === manifest.version
    && review.publisher === manifest.publisher
    && review.manifestHash === hashAthenaPluginManifest(manifest)
    && isSubset(review.approvedPermissions, manifest.permissions)
    && isSubset(review.approvedHosts, manifest.network?.allowedHosts ?? [])
    && isSubset(review.approvedEventsConsumed, manifest.eventsConsumed)
    && isSubset(review.approvedEventsPublished, manifest.eventsPublished);
}
