import type { AthenaPluginGrant, AthenaPluginManifest, AthenaPluginReviewRecord } from "./types";
import { installApprovedPlugin, transitionPluginGrant } from "./lifecycle";

export interface AthenaPluginRepository {
  getReview(pluginId: string, pluginVersion: string): Promise<AthenaPluginReviewRecord | null>;
  saveReview(review: AthenaPluginReviewRecord): Promise<void>;
  getGrant(orgId: string, pluginId: string): Promise<AthenaPluginGrant | null>;
  saveGrant(grant: AthenaPluginGrant): Promise<void>;
}

export class AthenaPluginService {
  constructor(private readonly repository: AthenaPluginRepository) {}

  async recordReview(review: AthenaPluginReviewRecord): Promise<void> {
    await this.repository.saveReview(review);
  }

  async install(input: { orgId: string; manifest: AthenaPluginManifest; installedBy: string }): Promise<AthenaPluginGrant> {
    const review = await this.repository.getReview(input.manifest.id, input.manifest.version);
    if (!review) throw new Error("ATHENA_PLUGIN_REVIEW_REQUIRED");
    const grant = installApprovedPlugin({ ...input, review });
    await this.repository.saveGrant(grant);
    return grant;
  }

  async disable(orgId: string, pluginId: string): Promise<AthenaPluginGrant> {
    return this.transition(orgId, pluginId, "disabled");
  }

  async enable(orgId: string, pluginId: string): Promise<AthenaPluginGrant> {
    return this.transition(orgId, pluginId, "installed");
  }

  async revoke(orgId: string, pluginId: string): Promise<AthenaPluginGrant> {
    return this.transition(orgId, pluginId, "revoked");
  }

  async uninstall(orgId: string, pluginId: string): Promise<AthenaPluginGrant> {
    return this.transition(orgId, pluginId, "uninstalled");
  }

  private async transition(orgId: string, pluginId: string, status: "installed" | "disabled" | "revoked" | "uninstalled"): Promise<AthenaPluginGrant> {
    const grant = await this.repository.getGrant(orgId, pluginId);
    if (!grant) throw new Error("ATHENA_PLUGIN_NOT_INSTALLED");
    const next = transitionPluginGrant(grant, status);
    await this.repository.saveGrant(next);
    return next;
  }
}
