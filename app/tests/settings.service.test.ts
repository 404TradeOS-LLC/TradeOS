import { Prisma } from "@prisma/client";
import type { OrganizationSettingsSnapshot } from "../modules/settings/types";

type MockPrisma = {
  organization: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  organizationSettings: {
    findUnique: jest.Mock;
    upsert: jest.Mock;
  };
  brandProfile: {
    findUnique: jest.Mock;
    upsert: jest.Mock;
  };
  organizationMembership: {
    findMany: jest.Mock;
  };
  settingsAssetUpload: {
    findUnique: jest.Mock;
    upsert: jest.Mock;
    delete: jest.Mock;
  };
  $transaction: jest.Mock;
};

const mockPrisma: MockPrisma = {
  organization: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  organizationSettings: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  brandProfile: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  organizationMembership: {
    findMany: jest.fn(),
  },
  settingsAssetUpload: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(async (callback: (tx: MockPrisma) => unknown) => callback(mockPrisma)),
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));

import { OrganizationSettingsService } from "../modules/settings/service";
import { ApiError } from "../backend/middleware/errorHandler";
import type { AuthContext } from "../backend/auth/context";

// Builds a fully-populated UpdateOrganizationSettingsInput (every field on
// OrganizationSettingsSnapshot is required by the zod schema in
// settings.controller.ts), with a small set of realistic overrides per test.
function buildInput(overrides: Partial<OrganizationSettingsSnapshot> = {}): OrganizationSettingsSnapshot {
  return {
    companyName: "Acme Contracting",
    timezone: "America/Indiana/Indianapolis",
    currency: "USD",
    units: "imperial",
    language: "en",
    dateFormat: "MM/DD/YYYY",
    theme: "light",
    accentColor: "#1d4ed8",
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

const ownerAuth: AuthContext = { userId: "user-1", orgId: "org-1", role: "owner" };
const technicianAuth: AuthContext = { userId: "user-2", orgId: "org-1", role: "technician" };

describe("OrganizationSettingsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.organizationMembership.findMany.mockResolvedValue([]);
  });

  describe("updateSettings", () => {
    it("persists a real logoUrl (and phone/address) to the organization row and mirrors it back in the returned snapshot", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ id: "org-1" });
      const input = buildInput({
        logoUrl: "https://cdn.example.com/org-1/branding/logoUrl?v=123",
        phone: "3175550199",
        address: "42 Wallaby Way",
      });
      mockPrisma.organizationSettings.upsert.mockResolvedValue({
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        settingsJson: input,
      });

      const result = await new OrganizationSettingsService().updateSettings("org-1", input, ownerAuth);

      expect(mockPrisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "org-1" },
          data: expect.objectContaining({
            logoUrl: "https://cdn.example.com/org-1/branding/logoUrl?v=123",
            phone: "3175550199",
            address: "42 Wallaby Way",
          }),
        })
      );
      expect(result.settings.logoUrl).toBe("https://cdn.example.com/org-1/branding/logoUrl?v=123");
    });

    it("nulls phone/address/logoUrl on the organization row when cleared to an empty string (the Remove-button path)", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ id: "org-1" });
      const input = buildInput({
        logoUrl: "",
        phone: "",
        address: "",
        darkLogoUrl: "",
        iconUrl: "",
        watermarkUrl: "",
      });
      mockPrisma.organizationSettings.upsert.mockResolvedValue({
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        settingsJson: input,
      });

      await new OrganizationSettingsService().updateSettings("org-1", input, ownerAuth);

      const updateCall = mockPrisma.organization.update.mock.calls[0][0];
      expect(updateCall.where).toEqual({ id: "org-1" });
      expect(updateCall.data.logoUrl).toBeNull();
      expect(updateCall.data.phone).toBeNull();
      expect(updateCall.data.address).toBeNull();

      // darkLogoUrl/iconUrl/watermarkUrl are not columns on the organization
      // table at all -- only logoUrl is emptyToNull()'d at the row level.
      // They're persisted purely inside the settingsJson blob (see below),
      // so clearing them relies on an empty string reading as falsy on the
      // frontend, not on any null-coercion happening here.
      expect(updateCall.data).not.toHaveProperty("darkLogoUrl");
      expect(updateCall.data).not.toHaveProperty("iconUrl");
      expect(updateCall.data).not.toHaveProperty("watermarkUrl");

      const upsertCall = mockPrisma.organizationSettings.upsert.mock.calls[0][0];
      expect(upsertCall.create.settingsJson).toMatchObject({
        darkLogoUrl: "",
        iconUrl: "",
        watermarkUrl: "",
      });
    });

    it("converts a numeric laborRate/markupPercent into a Decimal, and nulls them when blank", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ id: "org-1" });
      const input = buildInput({ laborRate: "45.5", markupPercent: "" });
      mockPrisma.organizationSettings.upsert.mockResolvedValue({
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        settingsJson: input,
      });

      await new OrganizationSettingsService().updateSettings("org-1", input, ownerAuth);

      const updateCall = mockPrisma.organization.update.mock.calls[0][0];
      expect(updateCall.data.defaultLaborRate).toBeInstanceOf(Prisma.Decimal);
      expect(updateCall.data.defaultLaborRate.toString()).toBe("45.5");
      expect(updateCall.data.defaultMarkupPercent).toBeNull();
    });

    it("rejects a non-numeric laborRate with a 400 ApiError instead of writing bad data", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ id: "org-1" });
      const input = buildInput({ laborRate: "not-a-number" });

      const promise = new OrganizationSettingsService().updateSettings("org-1", input, ownerAuth);

      await expect(promise).rejects.toThrow(ApiError);
      await expect(promise).rejects.toThrow('Expected a numeric value but received "not-a-number"');
      expect(mockPrisma.organization.update).not.toHaveBeenCalled();
    });

    it("throws a 404 ApiError when the organization does not exist", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);
      const input = buildInput();

      await expect(new OrganizationSettingsService().updateSettings("missing-org", input, ownerAuth)).rejects.toThrow(
        "Organization missing-org not found"
      );
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("writes mapped branding fields to the canonical BrandProfile while preserving unknown settings JSON", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ id: "org-1" });
      mockPrisma.organizationSettings.findUnique.mockResolvedValue({ settingsJson: { futureOperationalFlag: true } });
      mockPrisma.organizationSettings.upsert.mockResolvedValue({
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        settingsJson: { futureOperationalFlag: true, ...buildInput() },
      });

      await new OrganizationSettingsService().updateSettings("org-1", buildInput(), ownerAuth);

      expect(mockPrisma.brandProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: "org-1" },
          update: expect.objectContaining({
            companyDisplayName: "Acme Contracting",
            primaryColor: "#111111",
            defaultDocumentTheme: "standard",
            insuranceSummary: "Acme Insurance — POLICY-1",
            addressLine1: "1 Main St",
          }),
        })
      );
      expect(mockPrisma.organizationSettings.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { settingsJson: expect.objectContaining({ futureOperationalFlag: true }) },
          create: { orgId: "org-1", settingsJson: expect.objectContaining({ futureOperationalFlag: true }) },
        })
      );
    });

    // NOTE: there is no role/permission check inside updateSettings itself --
    // that gate lives one layer up, in requireOrgAdmin() (backend/requestContext.ts),
    // which settings.controller.ts calls before invoking this service at all.
    // A caller reaching this method with a non-admin AuthContext is not a
    // scenario the service is responsible for rejecting, so that's covered by
    // the hasAnyPermission tests instead, not asserted here.
  });

  describe("getSettings", () => {
    it("only loads team members and role profiles for owner/admin callers", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: "org-1",
        name: "Acme Contracting",
        phone: "3175550100",
        address: "1 Main St",
        logoUrl: "",
      });
      mockPrisma.organizationSettings.findUnique.mockResolvedValue({ settingsJson: {}, updatedAt: null });
      mockPrisma.organizationMembership.findMany.mockResolvedValue([
        {
          id: "membership-1",
          userId: "user-1",
          role: "owner",
          status: "active",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          user: { authSubject: "auth-1", email: "owner@example.com", fullName: "Owner Example" },
        },
      ]);

      const result = await new OrganizationSettingsService().getSettings("org-1", ownerAuth);

      expect(result.canManageWorkspace).toBe(true);
      expect(result.teamMembers).toHaveLength(1);
      expect(mockPrisma.organizationMembership.findMany).toHaveBeenCalledTimes(1);
    });

    it("keeps the workspace-management panel empty for a non-admin caller", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: "org-1",
        name: "Acme Contracting",
        phone: "3175550100",
        address: "1 Main St",
        logoUrl: "",
      });
      mockPrisma.organizationSettings.findUnique.mockResolvedValue({ settingsJson: {}, updatedAt: null });

      const result = await new OrganizationSettingsService().getSettings("org-1", technicianAuth);

      expect(result.canManageWorkspace).toBe(false);
      expect(result.teamMembers).toEqual([]);
      expect(result.roleProfiles).toEqual([]);
      expect(mockPrisma.organizationMembership.findMany).not.toHaveBeenCalled();
    });

    it("reads logoUrl from settingsJson, not the (possibly stale) organization row, once any save has occurred", async () => {
      // updateSettings() always writes a full OrganizationSettingsSnapshot to
      // settingsJson (every field is required by the zod schema one layer up),
      // so after a first save settingsJson always has its own logoUrl key --
      // including "" from the Settings Console's Remove button. getSettings'
      // `{ ...fallbackDefaults, ...parsed }` spread order means that key always
      // wins over organization.logoUrl. This pins that read-after-write
      // consistency explicitly: a stale/different organization.logoUrl value
      // must never leak through once settingsJson has an opinion, for logoUrl
      // exactly as it already does for darkLogoUrl/iconUrl/watermarkUrl (which
      // have no organization-row fallback at all).
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: "org-1",
        name: "Acme Contracting",
        phone: "3175550100",
        address: "1 Main St",
        logoUrl: "https://stale.example.com/old-logo.png",
      });
      mockPrisma.organizationSettings.findUnique.mockResolvedValue({
        settingsJson: { logoUrl: "", darkLogoUrl: "", iconUrl: "", watermarkUrl: "" },
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      });

      const result = await new OrganizationSettingsService().getSettings("org-1", ownerAuth);

      expect(result.settings.logoUrl).toBe("");
      expect(result.settings.darkLogoUrl).toBe("");
      expect(result.settings.iconUrl).toBe("");
      expect(result.settings.watermarkUrl).toBe("");
    });

    it("prefers populated canonical BrandProfile values over stale legacy settings and shell values", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: "org-1",
        name: "Shell Name",
        phone: "shell-phone",
        address: "Shell Address",
        logoUrl: "https://stale.example.com/logo.png",
      });
      mockPrisma.organizationSettings.findUnique.mockResolvedValue({
        settingsJson: { companyName: "Legacy Name", logoUrl: "https://legacy.example.com/logo.png", brandPrimary: "#000000" },
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      });
      mockPrisma.brandProfile.findUnique.mockResolvedValue({
        companyDisplayName: "Canonical Name",
        logoUrl: "https://canonical.example.com/logo.png",
        logoDarkUrl: "",
        iconUrl: "",
        watermarkUrl: "",
        primaryColor: "#ABCDEF",
        secondaryColor: "",
        accentColor: "",
        typographyStyle: "Professional",
        defaultDocumentTheme: "signature-frame",
        proposalStyle: "premium",
        invoiceStyle: "compact",
        contractStyle: "formal",
        emailSignature: "",
        websiteUrl: "",
        phone: "canonical-phone",
        licenseNumber: "",
        insuranceSummary: "",
        addressLine1: "Canonical Address",
      });

      const result = await new OrganizationSettingsService().getSettings("org-1", ownerAuth);

      expect(result.settings.companyName).toBe("Canonical Name");
      expect(result.settings.logoUrl).toBe("https://canonical.example.com/logo.png");
      expect(result.settings.brandPrimary).toBe("#ABCDEF");
      expect(result.settings.phone).toBe("canonical-phone");
      expect(result.settings.address).toBe("Canonical Address");
    });

    it("lazily adopts legacy branding without dropping unrelated settings fields", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: "org-1",
        name: "Shell Name",
        phone: "",
        address: "",
        logoUrl: "",
      });
      mockPrisma.organizationSettings.findUnique.mockResolvedValue({
        settingsJson: { companyName: "Legacy Name", logoUrl: "https://legacy.example.com/logo.png", futureFlag: "keep" },
        updatedAt: null,
      });
      mockPrisma.brandProfile.findUnique.mockResolvedValue(null);
      mockPrisma.brandProfile.upsert.mockResolvedValue({
        companyDisplayName: "Legacy Name",
        logoUrl: "https://legacy.example.com/logo.png",
        phone: null,
        addressLine1: null,
        insuranceSummary: null,
      });

      const result = await new OrganizationSettingsService().getSettings("org-1", ownerAuth);

      expect(mockPrisma.brandProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            organizationId: "org-1",
            companyDisplayName: "Legacy Name",
            logoUrl: "https://legacy.example.com/logo.png",
          }),
        })
      );
      expect(result.settings.companyName).toBe("Legacy Name");
      expect(result.settings.logoUrl).toBe("https://legacy.example.com/logo.png");
      expect((result.settings as Record<string, unknown>).futureFlag).toBe("keep");
    });

    it("does not repopulate a canonical clear from a stale organization fallback", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: "org-1",
        name: "Acme Contracting",
        phone: "",
        address: "",
        logoUrl: "https://stale.example.com/logo.png",
      });
      mockPrisma.organizationSettings.findUnique.mockResolvedValue({ settingsJson: { logoUrl: "" }, updatedAt: null });
      mockPrisma.brandProfile.findUnique.mockResolvedValue(null);
      mockPrisma.brandProfile.upsert.mockResolvedValue(null);

      const result = await new OrganizationSettingsService().getSettings("org-1", ownerAuth);

      expect(result.settings.logoUrl).toBe("");
      const upsert = mockPrisma.brandProfile.upsert.mock.calls[0]?.[0];
      expect(upsert?.create).not.toHaveProperty("logoUrl");
    });
  });

  describe("recordAssetUpload / getAssetUpload / clearAssetUpload", () => {
    const uploaderAuth: AuthContext = { userId: "user-1", orgId: "org-1", role: "admin" };

    it("recordAssetUpload persists new storage metadata and returns null previous when nothing was set before", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ id: "org-1" });
      mockPrisma.settingsAssetUpload.findUnique.mockResolvedValue(null);
      const newRow = {
        assetKey: "logoUrl",
        storageBucket: "project-files",
        storagePath: "organizations/org-1/brand-assets/logoUrl-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        contentType: "image/png",
        sizeBytes: 1024,
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      };
      mockPrisma.settingsAssetUpload.upsert.mockResolvedValue(newRow);

      const service = new OrganizationSettingsService();
      const result = await service.recordAssetUpload(
        "org-1",
        {
          assetKey: "logoUrl",
          storageBucket: "project-files",
          storagePath: "organizations/org-1/brand-assets/logoUrl-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          contentType: "image/png",
          sizeBytes: 1024,
        },
        uploaderAuth
      );

      expect(result.previous).toBeNull();
      expect(result.current.storagePath).toBe(
        "organizations/org-1/brand-assets/logoUrl-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
      );
      expect(mockPrisma.settingsAssetUpload.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orgId_assetKey: { orgId: "org-1", assetKey: "logoUrl" } },
          create: expect.objectContaining({ orgId: "org-1", uploadedBy: "user-1" }),
        })
      );
    });

    it("recordAssetUpload returns the previous record so the caller can delete the superseded storage object", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ id: "org-1" });
      const previousRow = {
        assetKey: "logoUrl",
        storageBucket: "project-files",
        storagePath: "organizations/org-1/brand-assets/logoUrl-old",
        contentType: "image/png",
        sizeBytes: 512,
        updatedAt: new Date("2025-12-01T00:00:00.000Z"),
      };
      mockPrisma.settingsAssetUpload.findUnique.mockResolvedValue(previousRow);
      mockPrisma.settingsAssetUpload.upsert.mockResolvedValue({
        ...previousRow,
        storagePath: "organizations/org-1/brand-assets/logoUrl-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      });

      const service = new OrganizationSettingsService();
      const result = await service.recordAssetUpload(
        "org-1",
        {
          assetKey: "logoUrl",
          storageBucket: "project-files",
          storagePath: "organizations/org-1/brand-assets/logoUrl-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          contentType: "image/png",
          sizeBytes: 2048,
        },
        uploaderAuth
      );

      expect(result.previous?.storagePath).toBe("organizations/org-1/brand-assets/logoUrl-old");
      expect(result.current.storagePath).toBe(
        "organizations/org-1/brand-assets/logoUrl-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
      );
    });

    it("recordAssetUpload throws a 404 ApiError when the organization does not exist", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      const service = new OrganizationSettingsService();
      await expect(
        service.recordAssetUpload(
          "missing-org",
          {
            assetKey: "logoUrl",
            storageBucket: "project-files",
            storagePath: "organizations/missing-org/brand-assets/logoUrl-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            contentType: "image/png",
            sizeBytes: 1,
          },
          uploaderAuth
        )
      ).rejects.toThrow("Organization missing-org not found");
      expect(mockPrisma.settingsAssetUpload.upsert).not.toHaveBeenCalled();
    });

    it("rejects storage metadata outside the authenticated organization and asset namespace", async () => {
      const service = new OrganizationSettingsService();

      await expect(
        service.recordAssetUpload(
          "org-1",
          {
            assetKey: "logoUrl",
            storageBucket: "project-files",
            storagePath: "organizations/other-org/brand-assets/logoUrl-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            contentType: "image/png",
            sizeBytes: 1,
          },
          uploaderAuth
        )
      ).rejects.toThrow("Invalid settings asset storage location");
      expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.settingsAssetUpload.upsert).not.toHaveBeenCalled();
    });

    it("getAssetUpload returns null when nothing has been uploaded for that slot", async () => {
      mockPrisma.settingsAssetUpload.findUnique.mockResolvedValue(null);

      const result = await new OrganizationSettingsService().getAssetUpload("org-1", "iconUrl");
      expect(result).toBeNull();
    });

    it("getAssetUpload returns the current record when one exists", async () => {
      mockPrisma.settingsAssetUpload.findUnique.mockResolvedValue({
        assetKey: "iconUrl",
        storageBucket: "project-files",
        storagePath: "organizations/org-1/brand-assets/iconUrl-abc",
        contentType: "image/png",
        sizeBytes: 256,
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      });

      const result = await new OrganizationSettingsService().getAssetUpload("org-1", "iconUrl");
      expect(result?.storagePath).toBe("organizations/org-1/brand-assets/iconUrl-abc");
    });

    it("clearAssetUpload deletes the metadata row and returns what was deleted", async () => {
      const existingRow = {
        id: "row-1",
        assetKey: "watermarkUrl",
        storageBucket: "project-files",
        storagePath: "organizations/org-1/brand-assets/watermarkUrl-abc",
        contentType: "image/png",
        sizeBytes: 128,
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      };
      mockPrisma.settingsAssetUpload.findUnique.mockResolvedValue(existingRow);

      const result = await new OrganizationSettingsService().clearAssetUpload("org-1", "watermarkUrl");

      expect(mockPrisma.settingsAssetUpload.delete).toHaveBeenCalledWith({ where: { id: "row-1" } });
      expect(result?.storagePath).toBe("organizations/org-1/brand-assets/watermarkUrl-abc");
    });

    it("clearAssetUpload is a no-op that returns null when nothing was set", async () => {
      mockPrisma.settingsAssetUpload.findUnique.mockResolvedValue(null);

      const result = await new OrganizationSettingsService().clearAssetUpload("org-1", "watermarkUrl");

      expect(mockPrisma.settingsAssetUpload.delete).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });
});
