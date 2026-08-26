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
  companyName: "TradeOS Roofing & Exteriors",
  timezone: "America/Indiana/Indianapolis",
  currency: "USD",
  units: "Imperial",
  language: "en-US",
  dateFormat: "MMM d, yyyy",
  theme: "System",
  accentColor: "#d97706",
  address: "742 Market Street, Indianapolis, IN 46204",
  phone: "(317) 555-0148",
  website: "https://tradeos.example.com",
  taxId: "82-6519042",
  licenseNumber: "IN-GC-44718",
  insuranceProvider: "Builders Mutual",
  insurancePolicy: "BM-44-18-9921",
  logoUrl: "",
  darkLogoUrl: "",
  iconUrl: "",
  watermarkUrl: "",
  brandPrimary: "#111827",
  brandSecondary: "#d97706",
  typography: "Geist Sans",
  pdfAppearance: "High contrast",
  emailSignature: "TradeOS Roofing & Exteriors | Licensed & Insured | (317) 555-0148",
  proposalStyle: "Modern",
  invoiceStyle: "Compact",
  contractStyle: "Formal",
  costRegion: "Indianapolis Metro",
  laborRate: "85",
  markupPercent: "18",
  overheadPercent: "12",
  profitPercent: "14",
  wasteFactor: "8",
  materialDefault: "Architectural asphalt shingles",
  supplierPreference: "Beacon + ABC Supply",
  aiProvider: "OpenAI",
  defaultModel: "gpt-5.1",
  temperature: "0.2",
  aiMonthlyBudget: "1800",
  promptTemplate: "TradeOS Standard Estimating v3",
  aiPermissions: "Ops leads only",
  voiceTranscription: true,
  ocrEnabled: true,
  autoEstimate: true,
  embeddingsModel: "text-embedding-3-large",
  cachePolicy: "Smart 24h cache",
  estimateApprovalFlow: "Estimator -> PM -> Owner",
  crmPipelineMode: "Project-first",
  proposalTemplate: "Storm restoration",
  contractTemplate: "Residential premium",
  invoiceTemplate: "Progress billing",
  changeOrderTemplate: "Standard change order",
  purchaseOrderTemplate: "Supplier PO",
  emailNotifications: true,
  smsNotifications: true,
  pushNotifications: false,
  reminderTiming: "24 hours before",
  dailyDigest: true,
  projectAlerts: true,
  paymentReminders: true,
  passwordPolicy: "12 characters + mixed case",
  mfaRequired: true,
  sessionTimeout: "12 hours",
  loginAlerts: true,
  apiTokenPolicy: "90-day expiry",
};

export function mergeTradeOsSettingsDraft(input?: Partial<TradeOsSettingsDraft> | null): TradeOsSettingsDraft {
  return {
    ...defaultTradeOsSettingsDraft,
    ...(input ?? {}),
  };
}
