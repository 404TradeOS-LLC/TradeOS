import { parseBootstrapAdminConfig } from "../scripts/bootstrap-admin";

describe("admin bootstrap configuration", () => {
  it("is inert when disabled", () => {
    expect(parseBootstrapAdminConfig({ BOOTSTRAP_ADMIN_ENABLED: "false" })).toEqual({ enabled: false });
  });

  it("normalizes a valid enabled configuration", () => {
    const config = parseBootstrapAdminConfig({
      BOOTSTRAP_ADMIN_ENABLED: "true",
      DATABASE_ADMIN_URL: "postgresql://admin:secret@localhost:5432/tradeos",
      BOOTSTRAP_ADMIN_EMAIL: " Admin@404TradeOS.com ",
      BOOTSTRAP_ADMIN_PASSWORD: "this-is-a-long-secret",
      BOOTSTRAP_ADMIN_NAME: " TradeOS Admin ",
      BOOTSTRAP_ADMIN_ORG_NAME: " 404 TradeOS LLC ",
      BOOTSTRAP_ADMIN_ROLE: "owner",
    });

    expect(config).toMatchObject({
      enabled: true,
      email: "admin@404tradeos.com",
      fullName: "TradeOS Admin",
      organizationName: "404 TradeOS LLC",
      role: "owner",
    });
  });

  it("defaults the role to admin", () => {
    const config = parseBootstrapAdminConfig({
      BOOTSTRAP_ADMIN_ENABLED: "true",
      DATABASE_ADMIN_URL: "postgresql://admin:secret@localhost:5432/tradeos",
      BOOTSTRAP_ADMIN_EMAIL: "admin@example.com",
      BOOTSTRAP_ADMIN_PASSWORD: "this-is-a-long-secret",
      BOOTSTRAP_ADMIN_NAME: "Admin",
      BOOTSTRAP_ADMIN_ORG_NAME: "Acme",
    });

    expect(config.role).toBe("admin");
  });

  it("rejects missing required values", () => {
    expect(() => parseBootstrapAdminConfig({ BOOTSTRAP_ADMIN_ENABLED: "true" })).toThrow("DATABASE_ADMIN_URL is required");
  });

  it("rejects short passwords", () => {
    expect(() =>
      parseBootstrapAdminConfig({
        BOOTSTRAP_ADMIN_ENABLED: "true",
        DATABASE_ADMIN_URL: "postgresql://admin:secret@localhost:5432/tradeos",
        BOOTSTRAP_ADMIN_EMAIL: "admin@example.com",
        BOOTSTRAP_ADMIN_PASSWORD: "too-short",
        BOOTSTRAP_ADMIN_NAME: "Admin",
        BOOTSTRAP_ADMIN_ORG_NAME: "Acme",
      })
    ).toThrow("at least 14 characters");
  });

  it("rejects unsupported elevated roles", () => {
    expect(() =>
      parseBootstrapAdminConfig({
        BOOTSTRAP_ADMIN_ENABLED: "true",
        DATABASE_ADMIN_URL: "postgresql://admin:secret@localhost:5432/tradeos",
        BOOTSTRAP_ADMIN_EMAIL: "admin@example.com",
        BOOTSTRAP_ADMIN_PASSWORD: "this-is-a-long-secret",
        BOOTSTRAP_ADMIN_NAME: "Admin",
        BOOTSTRAP_ADMIN_ORG_NAME: "Acme",
        BOOTSTRAP_ADMIN_ROLE: "dispatcher",
      })
    ).toThrow("admin or owner");
  });
});
