import {
  createApprovedPluginReview,
  evaluatePluginCapability,
  hashAthenaPluginManifest,
  installApprovedPlugin,
  transitionPluginGrant,
  validateAthenaPluginManifest,
} from "../modules/athena-plugin-sdk";

const manifest = {
  id: "com.example.weather-risk",
  name: "Weather Risk Advisor",
  version: "1.0.0",
  publisher: "Example Inc",
  athenaContractVersion: "1.0.0",
  tools: ["com.example.weather-risk.assessJob"],
  contextProviders: ["com.example.weather-risk.forecast"],
  eventsConsumed: ["JobScheduled"],
  eventsPublished: [],
  permissions: ["dispatch.manage"],
  dataUse: { storesCustomerData: false, retentionDays: 0 },
  network: { allowedHosts: ["api.example.com"] },
};

describe("A13 plugin SDK governance", () => {
  test("validates a C012-compatible manifest", () => {
    expect(validateAthenaPluginManifest(manifest)).toEqual({ ok: true, manifest });
  });

  test.each(["01.0.0", "1.0.0-alpha..1", "1.0.0-01", "1.0.0+"])("rejects malformed Semantic Version %s", (version) => {
    const result = validateAthenaPluginManifest({ ...manifest, version });
    expect(result.ok).toBe(false);
  });

  test("accepts valid prerelease and build metadata", () => {
    expect(validateAthenaPluginManifest({ ...manifest, version: "1.2.3-alpha.1+build.7" }).ok).toBe(true);
  });

  test("rejects incompatible Athena contract major", () => {
    const result = validateAthenaPluginManifest({ ...manifest, athenaContractVersion: "2.0.0" });
    expect(result.ok).toBe(false);
  });

  test("invalid manifests cannot be approved", () => {
    expect(() => createApprovedPluginReview({
      manifest: { ...manifest, network: { allowedHosts: ["localhost"] } },
      reviewedBy: "reviewer",
    })).toThrow("ATHENA_PLUGIN_INVALID_MANIFEST");
  });

  test("binds approval to exact manifest", () => {
    const review = createApprovedPluginReview({ manifest, reviewedBy: "reviewer" });
    expect(review.manifestHash).toBe(hashAthenaPluginManifest(manifest));
    expect(evaluatePluginCapability({ activeOrgId: "org-1", manifest: { ...manifest, permissions: ["dispatch.manage", "billing.read"] }, review })).toEqual({
      allowed: false,
      reasonCode: "review_required",
    });
  });

  test("requires review before install", () => {
    const review = createApprovedPluginReview({ manifest, reviewedBy: "reviewer" });
    expect(() => installApprovedPlugin({
      orgId: "org-1",
      manifest: { ...manifest, version: "1.0.1" },
      review,
      installedBy: "owner-1",
    })).toThrow("ATHENA_PLUGIN_REVIEW_REQUIRED");
  });

  test("rejects a review that grants capabilities absent from the manifest", () => {
    const review = createApprovedPluginReview({ manifest, reviewedBy: "reviewer" });
    const escalated = { ...review, approvedPermissions: [...review.approvedPermissions, "billing.write"] };
    expect(() => installApprovedPlugin({ orgId: "org-1", manifest, review: escalated, installedBy: "owner-1" }))
      .toThrow("ATHENA_PLUGIN_REVIEW_REQUIRED");
  });

  test("installed plugin receives only reviewed capabilities", () => {
    const review = createApprovedPluginReview({ manifest, reviewedBy: "reviewer" });
    const grant = installApprovedPlugin({ orgId: "org-1", manifest, review, installedBy: "owner-1" });
    expect(evaluatePluginCapability({ activeOrgId: "org-1", manifest, review, grant, permission: "dispatch.manage" }).allowed).toBe(true);
    expect(evaluatePluginCapability({ activeOrgId: "org-1", manifest, review, grant, permission: "billing.write" })).toEqual({
      allowed: false,
      reasonCode: "permission_not_granted",
    });
    expect(evaluatePluginCapability({ activeOrgId: "org-1", manifest, review, grant, networkHost: "evil.example.com" })).toEqual({
      allowed: false,
      reasonCode: "network_host_not_granted",
    });
  });

  test("capabilities are tenant-bound", () => {
    const review = createApprovedPluginReview({ manifest, reviewedBy: "reviewer" });
    const grant = installApprovedPlugin({ orgId: "org-1", manifest, review, installedBy: "owner-1" });
    expect(evaluatePluginCapability({ activeOrgId: "org-2", manifest, review, grant })).toEqual({
      allowed: false,
      reasonCode: "organization_mismatch",
    });
  });

  test("revocation is immediate and terminal", () => {
    const review = createApprovedPluginReview({ manifest, reviewedBy: "reviewer" });
    const installed = installApprovedPlugin({ orgId: "org-1", manifest, review, installedBy: "owner-1" });
    const revoked = transitionPluginGrant(installed, "revoked");
    expect(evaluatePluginCapability({ activeOrgId: "org-1", manifest, review, grant: revoked })).toEqual({ allowed: false, reasonCode: "plugin_revoked" });
    expect(() => transitionPluginGrant(revoked, "installed")).toThrow("ATHENA_PLUGIN_TERMINAL_STATE");
  });
});
