import { classifyToolTrust, evaluateToolTrustGate } from "../modules/athena-security/toolTrust";

describe("athena-security classifyToolTrust()", () => {
  it.each(["athena-tool-registry-fixtures", "athena-tool-sdk-fixtures", "athena-context-engine-fixtures", "tradeos-billing"])(
    "classifies a first-party owner %s as internal",
    (owner) => {
      expect(classifyToolTrust({ owner })).toBe("internal");
    }
  );

  it("classifies a non-first-party owner as restricted", () => {
    expect(classifyToolTrust({ owner: "some-random-vendor" })).toBe("restricted");
  });

  it("classifies an explicit plugin: owner prefix as restricted", () => {
    expect(classifyToolTrust({ owner: "plugin:acme-widgets" })).toBe("restricted");
  });

  it("classifies an explicit experimental: owner prefix as experimental", () => {
    expect(classifyToolTrust({ owner: "experimental:athena-labs" })).toBe("experimental");
  });

  it("downgrades a deprecated-with-sunset first-party tool to experimental", () => {
    expect(classifyToolTrust({ owner: "athena-router", deprecated: { sunsetAt: "2027-01-01T00:00:00.000Z" } })).toBe("experimental");
  });
});

describe("athena-security evaluateToolTrustGate()", () => {
  it("does not require an explicit feature flag for an internal tool", () => {
    expect(evaluateToolTrustGate({ owner: "athena-tool-registry-fixtures" })).toEqual({ trustLevel: "internal", requiresExplicitFeatureFlag: false });
  });

  it("requires an explicit feature flag for a restricted tool", () => {
    expect(evaluateToolTrustGate({ owner: "plugin:acme-widgets" })).toEqual({ trustLevel: "restricted", requiresExplicitFeatureFlag: true });
  });

  it("requires an explicit feature flag for an experimental tool", () => {
    expect(evaluateToolTrustGate({ owner: "experimental:athena-labs" })).toEqual({ trustLevel: "experimental", requiresExplicitFeatureFlag: true });
  });
});
