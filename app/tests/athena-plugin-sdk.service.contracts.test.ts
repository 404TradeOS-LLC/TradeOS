import { AthenaPluginService, createApprovedPluginReview, installApprovedPlugin } from "../modules/athena-plugin-sdk";
import type { AthenaPluginGrant, AthenaPluginRepository, AthenaPluginReviewRecord } from "../modules/athena-plugin-sdk";

const manifest = {
  id: "com.example.weather-risk",
  name: "Weather Risk Advisor",
  version: "1.0.0",
  publisher: "Example Inc",
  athenaContractVersion: "1.0.0",
  tools: ["com.example.weather-risk.assessJob"],
  contextProviders: [],
  eventsConsumed: [],
  eventsPublished: [],
  permissions: ["dispatch.manage"],
  dataUse: { storesCustomerData: false },
};

function repositoryFixture(): { repository: AthenaPluginRepository; readGrant: () => AthenaPluginGrant } {
  const review = createApprovedPluginReview({ manifest, reviewedBy: "reviewer" });
  let stored = installApprovedPlugin({
    orgId: "org-1",
    manifest,
    review,
    installedBy: "owner-1",
    installedAt: "2026-09-10T20:00:00.000Z",
  });

  const repository: AthenaPluginRepository = {
    async getReview(): Promise<AthenaPluginReviewRecord | null> { return review; },
    async saveReview(): Promise<void> {},
    async getGrant(orgId, pluginId): Promise<AthenaPluginGrant | null> {
      return orgId === stored.orgId && pluginId === stored.pluginId ? { ...stored } : null;
    },
    async saveGrant(grant): Promise<void> { stored = { ...grant }; },
    async compareAndSetGrant(input): Promise<boolean> {
      if (stored.orgId !== input.orgId || stored.pluginId !== input.pluginId || stored.updatedAt !== input.expectedUpdatedAt) return false;
      stored = { ...input.next };
      return true;
    },
  };

  return { repository, readGrant: () => stored };
}

describe("A13 plugin service lifecycle", () => {
  test("concurrent grant transitions cannot overwrite one another", async () => {
    const f = repositoryFixture();
    const service = new AthenaPluginService(f.repository);

    const results = await Promise.allSettled([
      service.disable("org-1", manifest.id),
      service.revoke("org-1", manifest.id),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    expect(rejected?.reason).toEqual(expect.objectContaining({ message: "ATHENA_PLUGIN_GRANT_CONFLICT" }));
    expect(["disabled", "revoked"]).toContain(f.readGrant().status);
  });
});
