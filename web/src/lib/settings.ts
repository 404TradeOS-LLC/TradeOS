export interface TradeOsSettingsDraft {
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

export interface OrganizationSettingsResponse {
  orgId: string;
  /** Backend-authenticated AppUser ID; absent on older backend deployments. */
  currentUserId?: string;
  settings: Partial<TradeOsSettingsDraft>;
  updatedAt: string | null;
  currentRole: string;
  canManageWorkspace: boolean;
  teamMembers: SettingsTeamMember[];
  roleProfiles: SettingsRoleProfile[];
}

export interface SettingsTeamMember {
  membershipId: string;
  userId: string;
  fullName: string | null;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SettingsRoleProfile {
  role: string;
  title: string;
  description: string;
  memberCount: number;
  status: "system";
}

export const defaultTradeOsSettingsDraft: TradeOsSettingsDraft = {
  // Product-level display/formatting fallbacks. These are safe defaults, not
  // claims that an organization persisted a value.
  companyName: "",
  timezone: "America/Indiana/Indianapolis",
  currency: "USD",
  units: "Imperial",
  language: "en-US",
  dateFormat: "MMM d, yyyy",
  theme: "System",
  accentColor: "#d97706",
  address: "",
  phone: "",
  website: "",
  taxId: "",
  licenseNumber: "",
  insuranceProvider: "",
  insurancePolicy: "",
  logoUrl: "",
  darkLogoUrl: "",
  iconUrl: "",
  watermarkUrl: "",
  brandPrimary: "#111827",
  brandSecondary: "#d97706",
  typography: "Geist Sans",
  pdfAppearance: "High contrast",
  emailSignature: "",
  proposalStyle: "Modern",
  invoiceStyle: "Compact",
  contractStyle: "Formal",

  // Organization-specific economics, AI policy, workflow policy, templates,
  // communications, and security policy intentionally default to empty/off.
  // The Settings UI must not turn absent persisted values into invented facts.
  costRegion: "",
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
};

export function mergeTradeOsSettingsDraft(input?: Partial<TradeOsSettingsDraft> | null): TradeOsSettingsDraft {
  return {
    ...defaultTradeOsSettingsDraft,
    ...(input ?? {}),
  };
}
