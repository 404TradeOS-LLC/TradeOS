export interface OrganizationSettingsSnapshot {
  companyName: string;
  timezone: string;
  currency: string;
  units: string;
  language: string;
  dateFormat: string;
  theme: string;
  accentColor: string;
  address: string;
  phone: string;
  website: string;
  taxId: string;
  licenseNumber: string;
  insuranceProvider: string;
  insurancePolicy: string;
  logoUrl: string;
  darkLogoUrl: string;
  iconUrl: string;
  watermarkUrl: string;
  brandPrimary: string;
  brandSecondary: string;
  typography: string;
  pdfAppearance: string;
  emailSignature: string;
  proposalStyle: string;
  invoiceStyle: string;
  contractStyle: string;
  costRegion: string;
  laborRate: string;
  markupPercent: string;
  overheadPercent: string;
  profitPercent: string;
  wasteFactor: string;
  materialDefault: string;
  supplierPreference: string;
  aiProvider: string;
  defaultModel: string;
  temperature: string;
  aiMonthlyBudget: string;
  promptTemplate: string;
  aiPermissions: string;
  voiceTranscription: boolean;
  ocrEnabled: boolean;
  autoEstimate: boolean;
  embeddingsModel: string;
  cachePolicy: string;
  estimateApprovalFlow: string;
  crmPipelineMode: string;
  proposalTemplate: string;
  contractTemplate: string;
  invoiceTemplate: string;
  changeOrderTemplate: string;
  purchaseOrderTemplate: string;
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
  reminderTiming: string;
  dailyDigest: boolean;
  projectAlerts: boolean;
  paymentReminders: boolean;
  passwordPolicy: string;
  mfaRequired: boolean;
  sessionTimeout: string;
  loginAlerts: boolean;
  apiTokenPolicy: string;
}

export interface OrganizationSettingsDTO {
  orgId: string;
  settings: Partial<OrganizationSettingsSnapshot>;
  updatedAt: Date | null;
  currentRole: string;
  canManageWorkspace: boolean;
  teamMembers: SettingsTeamMemberDTO[];
  roleProfiles: SettingsRoleProfileDTO[];
}

export interface UpdateOrganizationSettingsInput extends OrganizationSettingsSnapshot {}

export interface SettingsTeamMemberDTO {
  membershipId: string;
  userId: string;
  fullName: string | null;
  email: string;
  role: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SettingsRoleProfileDTO {
  role: string;
  title: string;
  description: string;
  memberCount: number;
  status: "system";
}

export const SETTINGS_ASSET_KEYS = ["logoUrl", "darkLogoUrl", "iconUrl", "watermarkUrl"] as const;
export type SettingsAssetKey = (typeof SETTINGS_ASSET_KEYS)[number];

export interface RecordSettingsAssetUploadInput {
  assetKey: SettingsAssetKey;
  storageBucket: string;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
}

export interface SettingsAssetUploadDTO {
  assetKey: SettingsAssetKey;
  storageBucket: string;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
  updatedAt: Date;
}

export interface RecordSettingsAssetUploadResult {
  current: SettingsAssetUploadDTO;
  previous: SettingsAssetUploadDTO | null;
}
