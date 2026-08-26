import type { AuthContext } from "../../backend/auth/context";
import { AdminDashboardService } from "../admin-dashboard/service";
import { Prisma, type BrandProfile } from "@prisma/client";
import { prisma } from "../../db/client";
import { runInDatabaseTransaction } from "../../db/requestSession";
import { ApiError } from "../../backend/middleware/errorHandler";
import {
  OrganizationSettingsDTO,
  OrganizationSettingsSnapshot,
  RecordSettingsAssetUploadInput,
  RecordSettingsAssetUploadResult,
  SettingsAssetKey,
  SettingsAssetUploadDTO,
  SettingsRoleProfileDTO,
  SettingsTeamMemberDTO,
  UpdateOrganizationSettingsInput,
} from "./types";
import { canonicalRoles, isLegacyRole, normalizeRole } from "../../domain";

export class OrganizationSettingsService {
  private readonly adminDashboard = new AdminDashboardService();

  async getSettings(orgId: string, auth: AuthContext): Promise<OrganizationSettingsDTO> {
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        logoUrl: true,
      },
    });
    if (!organization) throw new ApiError(404, `Organization ${orgId} not found`);

    const row = await prisma.organizationSettings.findUnique({
      where: { orgId },
      select: { settingsJson: true, updatedAt: true },
    });

    const parsed: Partial<OrganizationSettingsSnapshot> = isSettingsSnapshot(row?.settingsJson) ? row.settingsJson : {};
    const profile = await prisma.brandProfile.findUnique({ where: { organizationId: orgId } });
    const adoption = buildLazyBrandProfileAdoption(parsed, organization, profile);
    const adoptedProfile = adoption
      ? await runInDatabaseTransaction(prisma, async (transaction) =>
          transaction.brandProfile.upsert({
            where: { organizationId: orgId },
            update: adoption,
            create: { organizationId: orgId, ...adoption },
          })
        )
      : profile;
    const canManageWorkspace = auth.role === "owner" || auth.role === "admin";
    const teamMembers = canManageWorkspace ? await this.getTeamMembers(orgId) : [];
    const roleProfiles = canManageWorkspace ? buildRoleProfiles(teamMembers) : [];

    return {
      orgId,
      updatedAt: row?.updatedAt ?? null,
      currentRole: normalizeRole(auth.role),
      canManageWorkspace,
      teamMembers,
      roleProfiles,
      settings: {
        ...parsed,
        ...resolveCanonicalBranding(parsed, organization, adoptedProfile),
      },
    };
  }

  async updateSettings(orgId: string, input: UpdateOrganizationSettingsInput, auth: AuthContext): Promise<OrganizationSettingsDTO> {
    const organization = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } });
    if (!organization) throw new ApiError(404, `Organization ${orgId} not found`);

    const row = await runInDatabaseTransaction(prisma, async (transaction) => {
      const existingSettings = await transaction.organizationSettings.findUnique({
        where: { orgId },
        select: { settingsJson: true },
      });
      const settingsJson = mergeSettingsJson(existingSettings?.settingsJson, input);

      await transaction.organization.update({
        where: { id: orgId },
        data: {
          name: input.companyName,
          phone: emptyToNull(input.phone),
          address: emptyToNull(input.address),
          logoUrl: emptyToNull(input.logoUrl),
          defaultLaborRate: toNullableDecimal(input.laborRate),
          defaultMarkupPercent: toNullableDecimal(input.markupPercent),
        },
      });

      await transaction.brandProfile.upsert({
        where: { organizationId: orgId },
        update: mapSettingsToBrandProfile(input),
        create: { organizationId: orgId, ...mapSettingsToBrandProfile(input) },
      });

      return transaction.organizationSettings.upsert({
        where: { orgId },
        update: { settingsJson },
        create: { orgId, settingsJson },
        select: { updatedAt: true, settingsJson: true },
      });
    });

    const teamMembers = await this.getTeamMembers(orgId);

    return {
      orgId,
      updatedAt: row.updatedAt,
      currentRole: normalizeRole(auth.role),
      canManageWorkspace: auth.role === "owner" || auth.role === "admin",
      teamMembers,
      roleProfiles: buildRoleProfiles(teamMembers),
      settings: isSettingsSnapshot(row.settingsJson) ? row.settingsJson : input,
    };
  }

  // Read-only lookup used by the web app's server-side asset proxy route to
  // resolve the current storage location for a brand asset before generating
  // bytes/a signed URL via the service_role Supabase client. Any org member
  // may read (matches this module's existing select-policy posture).
  async getAssetUpload(orgId: string, assetKey: SettingsAssetKey): Promise<SettingsAssetUploadDTO | null> {
    const row = await prisma.settingsAssetUpload.findUnique({
      where: { orgId_assetKey: { orgId, assetKey } },
    });
    if (!row) return null;
    return toAssetUploadDTO(row);
  }

  // Persists new storage metadata for one asset slot and returns whatever the
  // previous record was (if any) so the caller -- which alone has access to
  // Supabase Storage -- can delete the old object only after this new record
  // has been durably persisted. Never deletes storage bytes itself; this
  // service only ever touches the application's own Postgres schema.
  async recordAssetUpload(
    orgId: string,
    input: RecordSettingsAssetUploadInput,
    auth: AuthContext
  ): Promise<RecordSettingsAssetUploadResult> {
    assertSettingsAssetStorageLocation(orgId, input);

    const organization = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } });
    if (!organization) throw new ApiError(404, `Organization ${orgId} not found`);

    const previousRow = await prisma.settingsAssetUpload.findUnique({
      where: { orgId_assetKey: { orgId, assetKey: input.assetKey } },
    });

    const row = await prisma.settingsAssetUpload.upsert({
      where: { orgId_assetKey: { orgId, assetKey: input.assetKey } },
      update: {
        storageBucket: input.storageBucket,
        storagePath: input.storagePath,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        uploadedBy: auth.userId,
      },
      create: {
        orgId,
        assetKey: input.assetKey,
        storageBucket: input.storageBucket,
        storagePath: input.storagePath,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        uploadedBy: auth.userId,
      },
    });

    return {
      current: toAssetUploadDTO(row),
      previous: previousRow ? toAssetUploadDTO(previousRow) : null,
    };
  }

  // Deletes the metadata row for an explicit "Remove" action and returns the
  // deleted record (if any) so the caller can delete the underlying storage
  // object. A no-op (returns null) if nothing was set, so this is safe to
  // call unconditionally.
  async clearAssetUpload(orgId: string, assetKey: SettingsAssetKey): Promise<SettingsAssetUploadDTO | null> {
    const row = await prisma.settingsAssetUpload.findUnique({
      where: { orgId_assetKey: { orgId, assetKey } },
    });
    if (!row) return null;
    await prisma.settingsAssetUpload.delete({ where: { id: row.id } });
    return toAssetUploadDTO(row);
  }

  private async getTeamMembers(orgId: string): Promise<SettingsTeamMemberDTO[]> {
    const members = await this.adminDashboard.listOrganizationMembers(orgId);
    return members.map((member) => ({
      membershipId: member.membershipId,
      userId: member.userId,
      fullName: member.fullName,
      email: member.email,
      role: member.role,
      status: member.status,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
    }));
  }
}

const SETTINGS_ASSET_STORAGE_BUCKET = "project-files";
const SETTINGS_ASSET_OBJECT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertSettingsAssetStorageLocation(orgId: string, input: RecordSettingsAssetUploadInput): void {
  const expectedPrefix = `organizations/${orgId}/brand-assets/${input.assetKey}-`;
  const objectId = input.storagePath.startsWith(expectedPrefix) ? input.storagePath.slice(expectedPrefix.length) : "";
  if (
    input.storageBucket !== SETTINGS_ASSET_STORAGE_BUCKET ||
    !SETTINGS_ASSET_OBJECT_ID_PATTERN.test(objectId)
  ) {
    throw new ApiError(400, "Invalid settings asset storage location");
  }
}

function toAssetUploadDTO(row: {
  assetKey: string;
  storageBucket: string;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
  updatedAt: Date;
}): SettingsAssetUploadDTO {
  return {
    assetKey: row.assetKey as SettingsAssetKey,
    storageBucket: row.storageBucket,
    storagePath: row.storagePath,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    updatedAt: row.updatedAt,
  };
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function toNullableDecimal(value: string): Prisma.Decimal | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    throw new ApiError(400, `Expected a numeric value but received "${value}"`);
  }
  return new Prisma.Decimal(parsed);
}

type OrganizationBrandingShell = {
  name: string;
  phone: string | null;
  address: string | null;
  logoUrl: string | null;
};

type CanonicalBrandingField =
  | "companyDisplayName"
  | "logoUrl"
  | "logoDarkUrl"
  | "iconUrl"
  | "watermarkUrl"
  | "primaryColor"
  | "secondaryColor"
  | "accentColor"
  | "typographyStyle"
  | "defaultDocumentTheme"
  | "proposalStyle"
  | "invoiceStyle"
  | "contractStyle"
  | "emailSignature"
  | "websiteUrl"
  | "phone"
  | "licenseNumber"
  | "insuranceSummary"
  | "addressLine1";

function mapSettingsToBrandProfile(input: UpdateOrganizationSettingsInput): Record<CanonicalBrandingField, string | null> {
  return {
    companyDisplayName: emptyToNull(input.companyName),
    logoUrl: emptyToNull(input.logoUrl),
    logoDarkUrl: emptyToNull(input.darkLogoUrl),
    iconUrl: emptyToNull(input.iconUrl),
    watermarkUrl: emptyToNull(input.watermarkUrl),
    primaryColor: emptyToNull(input.brandPrimary),
    secondaryColor: emptyToNull(input.brandSecondary),
    accentColor: emptyToNull(input.accentColor),
    typographyStyle: emptyToNull(input.typography),
    defaultDocumentTheme: emptyToNull(input.pdfAppearance),
    proposalStyle: emptyToNull(input.proposalStyle),
    invoiceStyle: emptyToNull(input.invoiceStyle),
    contractStyle: emptyToNull(input.contractStyle),
    emailSignature: emptyToNull(input.emailSignature),
    websiteUrl: emptyToNull(input.website),
    phone: emptyToNull(input.phone),
    licenseNumber: emptyToNull(input.licenseNumber),
    insuranceSummary: combineInsuranceSummary(input.insuranceProvider, input.insurancePolicy),
    addressLine1: emptyToNull(input.address),
  };
}

function resolveCanonicalBranding(
  legacy: Partial<OrganizationSettingsSnapshot>,
  organization: OrganizationBrandingShell,
  profile: BrandProfile | null | undefined
): Partial<OrganizationSettingsSnapshot> {
  const insurance = resolveInsurance(legacy, profile);
  return {
    companyName: canonicalString(profile, "companyDisplayName", legacyString(legacy, "companyName", organization.name)),
    logoUrl: canonicalString(profile, "logoUrl", legacyString(legacy, "logoUrl", organization.logoUrl ?? "")),
    darkLogoUrl: canonicalString(profile, "logoDarkUrl", legacyString(legacy, "darkLogoUrl", "")),
    iconUrl: canonicalString(profile, "iconUrl", legacyString(legacy, "iconUrl", "")),
    watermarkUrl: canonicalString(profile, "watermarkUrl", legacyString(legacy, "watermarkUrl", "")),
    brandPrimary: canonicalString(profile, "primaryColor", legacyString(legacy, "brandPrimary", "")),
    brandSecondary: canonicalString(profile, "secondaryColor", legacyString(legacy, "brandSecondary", "")),
    accentColor: canonicalString(profile, "accentColor", legacyString(legacy, "accentColor", "")),
    typography: canonicalString(profile, "typographyStyle", legacyString(legacy, "typography", "")),
    pdfAppearance: canonicalString(profile, "defaultDocumentTheme", legacyString(legacy, "pdfAppearance", "")),
    proposalStyle: canonicalString(profile, "proposalStyle", legacyString(legacy, "proposalStyle", "")),
    invoiceStyle: canonicalString(profile, "invoiceStyle", legacyString(legacy, "invoiceStyle", "")),
    contractStyle: canonicalString(profile, "contractStyle", legacyString(legacy, "contractStyle", "")),
    emailSignature: canonicalString(profile, "emailSignature", legacyString(legacy, "emailSignature", "")),
    website: canonicalString(profile, "websiteUrl", legacyString(legacy, "website", "")),
    phone: canonicalString(profile, "phone", legacyString(legacy, "phone", organization.phone ?? "")),
    licenseNumber: canonicalString(profile, "licenseNumber", legacyString(legacy, "licenseNumber", "")),
    insuranceProvider: insurance.provider,
    insurancePolicy: insurance.policy,
    address: canonicalString(profile, "addressLine1", legacyString(legacy, "address", organization.address ?? "")),
  };
}

function buildLazyBrandProfileAdoption(
  legacy: Partial<OrganizationSettingsSnapshot>,
  organization: OrganizationBrandingShell,
  profile: BrandProfile | null | undefined
): Partial<Record<CanonicalBrandingField, string | null>> | null {
  const adoption: Partial<Record<CanonicalBrandingField, string | null>> = {};
  const candidates: Array<[CanonicalBrandingField, keyof OrganizationSettingsSnapshot, string]> = [
    ["companyDisplayName", "companyName", organization.name],
    ["logoUrl", "logoUrl", organization.logoUrl ?? ""],
    ["logoDarkUrl", "darkLogoUrl", ""],
    ["iconUrl", "iconUrl", ""],
    ["watermarkUrl", "watermarkUrl", ""],
    ["primaryColor", "brandPrimary", ""],
    ["secondaryColor", "brandSecondary", ""],
    ["accentColor", "accentColor", ""],
    ["typographyStyle", "typography", ""],
    ["defaultDocumentTheme", "pdfAppearance", ""],
    ["proposalStyle", "proposalStyle", ""],
    ["invoiceStyle", "invoiceStyle", ""],
    ["contractStyle", "contractStyle", ""],
    ["emailSignature", "emailSignature", ""],
    ["websiteUrl", "website", ""],
    ["phone", "phone", organization.phone ?? ""],
    ["licenseNumber", "licenseNumber", ""],
    ["addressLine1", "address", organization.address ?? ""],
  ];

  for (const [profileField, settingsField, organizationFallback] of candidates) {
    if (profile && profile[profileField] !== null && profile[profileField] !== undefined) continue;
    const source = hasOwn(legacy, settingsField) ? legacyString(legacy, settingsField, "") : organizationFallback;
    if (source) adoption[profileField] = source;
  }

  if (!profile || profile.insuranceSummary === null || profile.insuranceSummary === undefined) {
    const provider = legacyString(legacy, "insuranceProvider", "");
    const policy = legacyString(legacy, "insurancePolicy", "");
    const summary = combineInsuranceSummary(provider, policy);
    if (summary) adoption.insuranceSummary = summary;
  }

  return Object.keys(adoption).length ? adoption : null;
}

function canonicalString(profile: BrandProfile | null | undefined, field: CanonicalBrandingField, fallback: string): string {
  const value = profile?.[field];
  return value === null || value === undefined ? fallback : value;
}

function legacyString(legacy: Partial<OrganizationSettingsSnapshot>, field: keyof OrganizationSettingsSnapshot, fallback: string): string {
  const value = legacy[field];
  return typeof value === "string" ? value : fallback;
}

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function mergeSettingsJson(existing: unknown, input: UpdateOrganizationSettingsInput): Prisma.InputJsonValue {
  const previous = isRecord(existing) ? existing : {};
  return { ...previous, ...input } as Prisma.InputJsonValue;
}

const INSURANCE_SEPARATOR = " — ";

function combineInsuranceSummary(provider: string, policy: string): string | null {
  const normalizedProvider = provider.trim();
  const normalizedPolicy = policy.trim();
  if (!normalizedProvider && !normalizedPolicy) return null;
  if (!normalizedProvider) return normalizedPolicy;
  if (!normalizedPolicy) return normalizedProvider;
  return `${normalizedProvider}${INSURANCE_SEPARATOR}${normalizedPolicy}`;
}

function resolveInsurance(
  legacy: Partial<OrganizationSettingsSnapshot>,
  profile: BrandProfile | null | undefined
): { provider: string; policy: string } {
  if (profile?.insuranceSummary !== null && profile?.insuranceSummary !== undefined) {
    const [provider, ...policyParts] = profile.insuranceSummary.split(INSURANCE_SEPARATOR);
    return { provider, policy: policyParts.join(INSURANCE_SEPARATOR) };
  }
  return {
    provider: legacyString(legacy, "insuranceProvider", ""),
    policy: legacyString(legacy, "insurancePolicy", ""),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSettingsSnapshot(value: unknown): value is Partial<OrganizationSettingsSnapshot> {
  return isRecord(value);
}

function buildRoleProfiles(teamMembers: SettingsTeamMemberDTO[]): SettingsRoleProfileDTO[] {
  const roleMeta: Record<string, Pick<SettingsRoleProfileDTO, "title" | "description" | "status">> = {
    owner: {
      title: "Owner",
      description: "Full workspace control including billing, AI controls, and membership administration.",
      status: "system",
    },
    admin: {
      title: "Admin",
      description: "Operations and team administration without ownership transfer rights.",
      status: "system",
    },
    dispatcher: {
      title: "Dispatcher",
      description: "Customer operations, intake coordination, scheduling prep, and billing support.",
      status: "system",
    },
    technician: {
      title: "Technician",
      description: "Field delivery, job notes, and read access to assigned customer and project context.",
      status: "system",
    },
  };

  const profiles = canonicalRoles.map((role) => ({
    role,
    title: roleMeta[role].title,
    description: roleMeta[role].description,
    memberCount: teamMembers.filter((member) => normalizeRole(member.role) === role && member.status === "active").length,
    status: roleMeta[role].status,
  }));

  const legacyRoles = Array.from(
    new Set(teamMembers.map((member) => member.role).filter((role) => isLegacyRole(role)))
  );

  return [
    ...profiles,
    ...legacyRoles.map((role) => ({
      role,
      title: `${role[0].toUpperCase()}${role.slice(1)} (Legacy)`,
      description: `Deprecated compatibility role. Canonical beta role: ${normalizeRole(role)}.`,
      memberCount: teamMembers.filter((member) => member.role === role && member.status === "active").length,
      status: "system" as const,
    })),
  ];
}
