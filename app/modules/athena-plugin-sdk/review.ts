import { createHash } from "node:crypto";
import type { AthenaPluginManifest, AthenaPluginReviewRecord } from "./types";

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

export function createApprovedPluginReview(input: {
  manifest: AthenaPluginManifest;
  reviewedBy: string;
  reviewedAt?: string;
}): AthenaPluginReviewRecord {
  const { manifest } = input;
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

export function reviewMatchesManifest(review: AthenaPluginReviewRecord, manifest: AthenaPluginManifest): boolean {
  return review.status === "approved"
    && review.pluginId === manifest.id
    && review.pluginVersion === manifest.version
    && review.publisher === manifest.publisher
    && review.manifestHash === hashAthenaPluginManifest(manifest);
}
