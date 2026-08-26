import { Request, Response } from "express";
import { z } from "zod";
import { requireAuthContext, requireOrgAdmin, requireOrgId } from "../requestContext";
import { OrganizationSettingsService } from "../../modules/settings/service";
import { ApiError } from "../middleware/errorHandler";
import { SETTINGS_ASSET_KEYS } from "../../modules/settings/types";

const service = new OrganizationSettingsService();

const assetKeyParamSchema = z.enum(SETTINGS_ASSET_KEYS);

const recordAssetUploadSchema = z.object({
  assetKey: z.enum(SETTINGS_ASSET_KEYS),
  storageBucket: z.literal("project-files"),
  storagePath: z.string().trim().min(1).max(500),
  contentType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif", "image/x-icon"]),
  sizeBytes: z.number().int().positive().max(6 * 1024 * 1024),
});

const stringField = z.string().trim();

const organizationSettingsSchema = z.object({
  companyName: stringField.min(1).max(160),
  timezone: stringField.min(1).max(120),
  currency: stringField.min(1).max(16),
  units: stringField.min(1).max(32),
  language: stringField.min(1).max(32),
  dateFormat: stringField.min(1).max(32),
  theme: stringField.min(1).max(32),
  accentColor: stringField.min(1).max(32),
  address: stringField.max(500),
  phone: stringField.max(64),
  website: stringField.max(240),
  taxId: stringField.max(64),
  licenseNumber: stringField.max(160),
  insuranceProvider: stringField.max(160),
  insurancePolicy: stringField.max(160),
  logoUrl: stringField.max(500),
  darkLogoUrl: stringField.max(500),
  iconUrl: stringField.max(500),
  watermarkUrl: stringField.max(500),
  brandPrimary: stringField.max(32),
  brandSecondary: stringField.max(32),
  typography: stringField.max(120),
  pdfAppearance: stringField.max(120),
  emailSignature: stringField.max(1000),
  proposalStyle: stringField.max(120),
  invoiceStyle: stringField.max(120),
  contractStyle: stringField.max(120),
  costRegion: stringField.max(120),
  laborRate: stringField.max(32),
  markupPercent: stringField.max(32),
  overheadPercent: stringField.max(32),
  profitPercent: stringField.max(32),
  wasteFactor: stringField.max(32),
  materialDefault: stringField.max(240),
  supplierPreference: stringField.max(240),
  aiProvider: stringField.max(120),
  defaultModel: stringField.max(120),
  temperature: stringField.max(32),
  aiMonthlyBudget: stringField.max(32),
  promptTemplate: stringField.max(240),
  aiPermissions: stringField.max(120),
  voiceTranscription: z.boolean(),
  ocrEnabled: z.boolean(),
  autoEstimate: z.boolean(),
  embeddingsModel: stringField.max(120),
  cachePolicy: stringField.max(120),
  estimateApprovalFlow: stringField.max(160),
  crmPipelineMode: stringField.max(120),
  proposalTemplate: stringField.max(120),
  contractTemplate: stringField.max(120),
  invoiceTemplate: stringField.max(120),
  changeOrderTemplate: stringField.max(120),
  purchaseOrderTemplate: stringField.max(120),
  emailNotifications: z.boolean(),
  smsNotifications: z.boolean(),
  pushNotifications: z.boolean(),
  reminderTiming: stringField.max(120),
  dailyDigest: z.boolean(),
  projectAlerts: z.boolean(),
  paymentReminders: z.boolean(),
  passwordPolicy: stringField.max(160),
  mfaRequired: z.boolean(),
  sessionTimeout: stringField.max(120),
  loginAlerts: z.boolean(),
  apiTokenPolicy: stringField.max(120),
});

export const settingsController = {
  async get(req: Request, res: Response) {
    res.json(await service.getSettings(requireOrgId(req), requireAuthContext(req)));
  },
  async update(req: Request, res: Response) {
    const auth = requireOrgAdmin(req);
    res.json(await service.updateSettings(requireOrgId(req), organizationSettingsSchema.parse(req.body), auth));
  },

  // Read-side lookup consumed only by the web app's server-side asset proxy
  // route (never called from a browser directly) to resolve where the
  // current bytes for a brand asset live before streaming them via the
  // service_role Supabase client. Any authenticated org member may read.
  async getAsset(req: Request, res: Response) {
    requireAuthContext(req);
    const assetKey = assetKeyParamSchema.parse(req.params.assetKey);
    const result = await service.getAssetUpload(requireOrgId(req), assetKey);
    if (!result) throw new ApiError(404, `No ${assetKey} has been uploaded for this organization`);
    res.json(result);
  },

  // Called by the web app's server action after it has already uploaded new
  // bytes to Supabase Storage via the service_role client. Persists the new
  // storage location and returns the previous one (if any) so the caller can
  // delete the now-superseded object -- this endpoint never touches Storage
  // itself, only this application's own database.
  async recordAsset(req: Request, res: Response) {
    const auth = requireOrgAdmin(req);
    const input = recordAssetUploadSchema.parse(req.body);
    res.json(await service.recordAssetUpload(requireOrgId(req), input, auth));
  },

  // Called by the web app's "Remove" action. Deletes the metadata row and
  // returns it (if one existed) so the caller can delete the underlying
  // storage object.
  async clearAsset(req: Request, res: Response) {
    requireOrgAdmin(req);
    const assetKey = assetKeyParamSchema.parse(req.params.assetKey);
    const result = await service.clearAssetUpload(requireOrgId(req), assetKey);
    res.json({ cleared: result });
  },
};
