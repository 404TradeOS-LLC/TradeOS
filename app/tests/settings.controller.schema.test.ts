// Regression test for the GET -> PATCH settings round-trip for an org that
// never set an accent color. GET resolves an unset accent to "" (see
// resolveCanonicalBranding in modules/settings/service.ts), and the settings
// page merges GET values over its defaults, so a PATCH body derived from a
// GET response legitimately carries accentColor: "". The controller's update
// schema must accept that round-tripped value; rejecting it made it
// impossible for any accent-unset org to save ANY settings (the failure
// surfaced as a bare "Validation failed" toast, hiding the field).
import { organizationSettingsSchema } from "../backend/controllers/settings.controller";

// Full PATCH body shape, mirroring a GET-derived draft: every field the
// controller schema requires, with the accent-unset state under test.
function buildDraft(overrides: Record<string, unknown> = {}) {
  return {
    companyName: "Acme Contracting",
    timezone: "America/Indiana/Indianapolis",
    currency: "USD",
    units: "imperial",
    language: "en",
    dateFormat: "MM/DD/YYYY",
    theme: "light",
    accentColor: "",
    address: "1 Main St",
    phone: "3175550100",
    website: "https://acme.example.com",
    taxId: "12-3456789",
    licenseNumber: "LIC-1",
    insuranceProvider: "Acme Insurance",
    insurancePolicy: "POLICY-1",
    logoUrl: "",
    darkLogoUrl: "",
    iconUrl: "",
    watermarkUrl: "",
    brandPrimary: "#111111",
    brandSecondary: "#222222",
    typography: "Inter",
    pdfAppearance: "standard",
    emailSignature: "Thanks,\nAcme Team",
    proposalStyle: "standard",
    invoiceStyle: "standard",
    contractStyle: "standard",
    costRegion: "midwest",
    laborRate: "",
    markupPercent: "",
    overheadPercent: "",
    profitPercent: "",
    wasteFactor: "",
    materialDefault: "",
    supplierPreference: "",
    aiProvider: "",
    defaultModel: "",
    temperature: "",
    aiMonthlyBudget: "",
    promptTemplate: "",
    aiPermissions: "",
    voiceTranscription: false,
    ocrEnabled: false,
    autoEstimate: false,
    embeddingsModel: "",
    cachePolicy: "",
    estimateApprovalFlow: "",
    crmPipelineMode: "",
    proposalTemplate: "",
    contractTemplate: "",
    invoiceTemplate: "",
    changeOrderTemplate: "",
    purchaseOrderTemplate: "",
    emailNotifications: false,
    smsNotifications: false,
    pushNotifications: false,
    reminderTiming: "",
    dailyDigest: false,
    projectAlerts: false,
    paymentReminders: false,
    passwordPolicy: "",
    mfaRequired: false,
    sessionTimeout: "",
    loginAlerts: false,
    apiTokenPolicy: "",
    ...overrides,
  };
}

describe("settings controller update schema round-trip", () => {
  test("accepts a GET-derived draft with an unset (empty) accent color", () => {
    expect(() => organizationSettingsSchema.parse(buildDraft())).not.toThrow();
    expect(organizationSettingsSchema.parse(buildDraft()).accentColor).toBe("");
  });

  test("accepts a draft with an explicit accent color", () => {
    const parsed = organizationSettingsSchema.parse(
      buildDraft({ accentColor: "#d97706" })
    );
    expect(parsed.accentColor).toBe("#d97706");
  });

  test("still rejects an overlong accent color", () => {
    expect(() =>
      organizationSettingsSchema.parse(buildDraft({ accentColor: "x".repeat(33) }))
    ).toThrow();
  });
});
