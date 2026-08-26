import { Request, Response } from "express";
import { z } from "zod";
import { BrandStudioService } from "../../modules/brand-studio/service";
import { requireOrgAdmin, requireOrgId } from "../requestContext";

const service = new BrandStudioService();
const stringField = z.string().trim();

const linkSchema = z.object({
  label: stringField.min(1).max(120),
  url: stringField.min(1).max(500),
});

const profileSchema = z.object({
  companyDisplayName: stringField.max(160).optional(),
  tagline: stringField.max(160).optional(),
  primaryColor: stringField.max(16).optional(),
  secondaryColor: stringField.max(16).optional(),
  accentColor: stringField.max(16).optional(),
  logoUrl: stringField.max(500).optional(),
  logoDarkUrl: stringField.max(500).optional(),
  logoLightUrl: stringField.max(500).optional(),
  iconUrl: stringField.max(500).optional(),
  watermarkUrl: stringField.max(500).optional(),
  coverImageUrl: stringField.max(500).optional(),
  typographyStyle: stringField.max(64).optional(),
  defaultDocumentTheme: stringField.max(120).optional(),
  proposalStyle: stringField.max(120).optional(),
  invoiceStyle: stringField.max(120).optional(),
  contractStyle: stringField.max(120).optional(),
  emailSignature: stringField.max(2000).optional(),
  websiteUrl: stringField.max(500).optional(),
  phone: stringField.max(64).optional(),
  email: stringField.max(240).optional(),
  addressLine1: stringField.max(200).optional(),
  addressLine2: stringField.max(200).optional(),
  city: stringField.max(120).optional(),
  state: stringField.max(120).optional(),
  postalCode: stringField.max(32).optional(),
  licenseNumber: stringField.max(160).optional(),
  insuranceSummary: stringField.max(500).optional(),
  bondingSummary: stringField.max(500).optional(),
  yearsInBusiness: z.number().int().min(0).nullable().optional(),
  serviceAreas: z.array(stringField.max(160)).default([]),
  certifications: z.array(stringField.max(160)).default([]),
  socialLinks: z.array(linkSchema).default([]),
  reviewLinks: z.array(linkSchema).default([]),
  financingLinks: z.array(linkSchema).default([]),
});

const assetSchema = z.object({
  type: stringField.min(1).max(80),
  label: stringField.max(160).optional(),
  url: stringField.min(1).max(500),
  mimeType: stringField.max(120).optional(),
  sizeBytes: z.number().int().min(0).nullable().optional(),
  width: z.number().int().min(0).nullable().optional(),
  height: z.number().int().min(0).nullable().optional(),
});

const documentSettingsSchema = z.object({
  showPoweredByTradeOS: z.boolean().optional(),
  showLicenseNumber: z.boolean().optional(),
  showInsuranceSummary: z.boolean().optional(),
  showGoogleRating: z.boolean().optional(),
  showSocialLinks: z.boolean().optional(),
  defaultCoverMode: stringField.max(80).optional(),
  defaultHeaderStyle: stringField.max(80).optional(),
  defaultFooterStyle: stringField.max(80).optional(),
});

export const brandStudioController = {
  async getProfile(req: Request, res: Response) {
    res.json(await service.getProfile(requireOrgId(req)));
  },
  async updateProfile(req: Request, res: Response) {
    requireOrgAdmin(req);
    res.json(await service.updateProfile(requireOrgId(req), profileSchema.parse(req.body)));
  },
  async listAssets(req: Request, res: Response) {
    res.json(await service.listAssets(requireOrgId(req)));
  },
  async createAsset(req: Request, res: Response) {
    requireOrgAdmin(req);
    res.status(201).json(await service.createAsset(requireOrgId(req), assetSchema.parse(req.body)));
  },
  async deleteAsset(req: Request, res: Response) {
    requireOrgAdmin(req);
    await service.deleteAsset(requireOrgId(req), req.params.assetId);
    res.status(204).send();
  },
  async getDocumentSettings(req: Request, res: Response) {
    res.json(await service.getDocumentSettings(requireOrgId(req)));
  },
  async updateDocumentSettings(req: Request, res: Response) {
    requireOrgAdmin(req);
    res.json(await service.updateDocumentSettings(requireOrgId(req), documentSettingsSchema.parse(req.body)));
  },
  async getPreview(req: Request, res: Response) {
    res.json(await service.getPreview(requireOrgId(req)));
  },
};
