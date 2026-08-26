import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bell,
  Bot,
  Briefcase,
  Building2,
  CreditCard,
  FileStack,
  Globe,
  HardDrive,
  KeyRound,
  Palette,
  Receipt,
  Scale,
  SearchCheck,
  Settings2,
  Shield,
  SwatchBook,
  Users,
  Workflow,
  Wrench,
} from "lucide-react";
import { defaultTradeOsSettingsDraft, type TradeOsSettingsDraft } from "@/lib/settings";

export type SettingsFieldKind = "text" | "textarea" | "select" | "toggle" | "color";

export interface SettingsFieldOption {
  label: string;
  value: string;
}

export interface SettingsFieldDefinition {
  key: keyof TradeOsSettingsDraft;
  kind: SettingsFieldKind;
  label: string;
  description: string;
  placeholder?: string;
  options?: SettingsFieldOption[];
  keywords?: string[];
}

export interface SettingsAssetDefinition {
  key: keyof TradeOsSettingsDraft;
  label: string;
  description: string;
  accept: string;
  keywords?: string[];
}

export interface SettingsStatusItem {
  label: string;
  value: string;
  tone?: "default" | "good" | "warn";
  description?: string;
}

export interface SettingsRecordRow {
  title: string;
  subtitle: string;
  meta: string;
  status?: string;
}

export type SettingsCardDefinition =
  | {
      kind: "fields";
      id: string;
      title: string;
      description: string;
      columns?: 1 | 2;
      fields: SettingsFieldDefinition[];
      sampleData?: boolean;
    }
  | {
      kind: "assets";
      id: string;
      title: string;
      description: string;
      assets: SettingsAssetDefinition[];
      sampleData?: boolean;
    }
  | {
      kind: "status";
      id: string;
      title: string;
      description: string;
      items: SettingsStatusItem[];
      sampleData?: boolean;
    }
  | {
      kind: "records";
      id: string;
      title: string;
      description: string;
      rows: SettingsRecordRow[];
      sampleData?: boolean;
    }
  | {
      kind: "preview";
      id: string;
      title: string;
      description: string;
      preview: "branding" | "documents" | "email";
      sampleData?: boolean;
    };

export interface SettingsSectionDefinition {
  id: string;
  title: string;
  description: string;
  summary: string;
  icon: LucideIcon;
  keywords: string[];
  stats: SettingsStatusItem[];
  cards: SettingsCardDefinition[];
}

export const initialSettingsDraft: TradeOsSettingsDraft = defaultTradeOsSettingsDraft;

const commonCurrencyOptions = [
  { label: "US Dollar (USD)", value: "USD" },
  { label: "Canadian Dollar (CAD)", value: "CAD" },
  { label: "Euro (EUR)", value: "EUR" },
];

const field = (definition: SettingsFieldDefinition) => definition;

export const settingsSections: SettingsSectionDefinition[] = [
  {
    id: "general",
    title: "General",
    description: "Core company defaults that shape the entire workspace.",
    summary: "Location, language, display, and theme preferences.",
    icon: Settings2,
    keywords: ["timezone", "currency", "theme", "language", "accent"],
    stats: [
      { label: "Workspace", value: "Production ready", tone: "good" },
      { label: "Theme", value: initialSettingsDraft.theme },
      { label: "Locale", value: `${initialSettingsDraft.language} / ${initialSettingsDraft.currency}` },
    ],
    cards: [
      {
        kind: "fields",
        id: "general-workspace",
        title: "Workspace Defaults",
        description: "These values drive formatting, scheduling, and document defaults across TradeOS.",
        columns: 2,
        fields: [
          field({
            key: "companyName",
            kind: "text",
            label: "Company name",
            description: "Shown in navigation, documents, and customer-facing experiences.",
            keywords: ["business name", "org name"],
          }),
          field({
            key: "timezone",
            kind: "select",
            label: "Timezone",
            description: "Used for reminders, site visit timing, and audit events.",
            options: [
              { label: "Eastern - Indianapolis", value: "America/Indiana/Indianapolis" },
              { label: "Central - Chicago", value: "America/Chicago" },
              { label: "Mountain - Denver", value: "America/Denver" },
              { label: "Pacific - Los Angeles", value: "America/Los_Angeles" },
            ],
          }),
          field({
            key: "currency",
            kind: "select",
            label: "Currency",
            description: "Default pricing currency for estimates, invoices, and reports.",
            options: commonCurrencyOptions,
          }),
          field({
            key: "units",
            kind: "select",
            label: "Units",
            description: "Controls measurement defaults inside intake and estimating.",
            options: [
              { label: "Imperial", value: "Imperial" },
              { label: "Metric", value: "Metric" },
            ],
          }),
          field({
            key: "language",
            kind: "select",
            label: "Language",
            description: "Default authoring language for internal UI and generated content.",
            options: [
              { label: "English (US)", value: "en-US" },
              { label: "English (Canada)", value: "en-CA" },
              { label: "Spanish (US)", value: "es-US" },
            ],
          }),
          field({
            key: "dateFormat",
            kind: "select",
            label: "Date format",
            description: "How dates render in the UI and customer-facing documents.",
            options: [
              { label: "Jul 3, 2026", value: "MMM d, yyyy" },
              { label: "07/03/2026", value: "MM/dd/yyyy" },
              { label: "2026-07-03", value: "yyyy-MM-dd" },
            ],
          }),
          field({
            key: "theme",
            kind: "select",
            label: "Theme",
            description: "Controls default light, dark, or system appearance.",
            options: [
              { label: "System", value: "System" },
              { label: "Light", value: "Light" },
              { label: "Dark", value: "Dark" },
            ],
          }),
          field({
            key: "accentColor",
            kind: "color",
            label: "Accent color",
            description: "Used for CTA emphasis and selected navigation states.",
            keywords: ["highlight", "brand accent"],
          }),
        ],
      },
    ],
  },
  {
    id: "company",
    title: "Company",
    description: "Identity and business details used throughout TradeOS.",
    summary: "Contact info, licensing, insurance, and business profile.",
    icon: Building2,
    keywords: ["logo", "address", "phone", "website", "tax", "license", "insurance"],
    stats: [
      { label: "Licensing", value: "2 active credentials", tone: "good" },
      { label: "Insurance", value: "Verified through 2027", tone: "good" },
      { label: "Website", value: "Connected" },
    ],
    cards: [
      {
        kind: "assets",
        id: "company-assets",
        title: "Identity Assets",
        description: "Keep logos and icons ready for the app shell, documents, and portals.",
        assets: [
          { key: "logoUrl", label: "Logo", description: "Primary light-surface logo.", accept: "image/png,image/jpeg,image/webp,image/gif,image/x-icon", keywords: ["logo"] },
          { key: "darkLogoUrl", label: "Dark logo", description: "Optimized for dark backgrounds.", accept: "image/png,image/jpeg,image/webp,image/gif,image/x-icon", keywords: ["dark logo"] },
          { key: "iconUrl", label: "Favicon / Icon", description: "Shown in tabs, shortcuts, and compact UI.", accept: "image/png,image/jpeg,image/webp,image/gif,image/x-icon", keywords: ["favicon", "icon"] },
        ],
      },
      {
        kind: "fields",
        id: "company-profile",
        title: "Business Profile",
        description: "This information powers documents, signatures, and trust signals.",
        columns: 2,
        fields: [
          field({
            key: "address",
            kind: "textarea",
            label: "Address",
            description: "Primary business mailing address.",
          }),
          field({
            key: "phone",
            kind: "text",
            label: "Phone",
            description: "Primary customer-facing phone number.",
          }),
          field({
            key: "website",
            kind: "text",
            label: "Website",
            description: "Canonical website used in email signatures and docs.",
          }),
          field({
            key: "taxId",
            kind: "text",
            label: "Tax ID",
            description: "Business tax identifier for billing and exports.",
          }),
          field({
            key: "licenseNumber",
            kind: "text",
            label: "License numbers",
            description: "State or municipality contractor credentials.",
          }),
          field({
            key: "insuranceProvider",
            kind: "text",
            label: "Insurance provider",
            description: "Primary carrier name for trust and compliance docs.",
          }),
          field({
            key: "insurancePolicy",
            kind: "text",
            label: "Insurance policy",
            description: "Primary policy number used in contracts and COIs.",
          }),
        ],
      },
    ],
  },
  {
    id: "team",
    title: "Team",
    description: "Who has access to the workspace and how active the team is.",
    summary: "People, seat usage, and onboarding state.",
    icon: Users,
    keywords: ["users", "seats", "invite", "teammates"],
    stats: [
      { label: "Seats", value: "14 / 20" },
      { label: "Pending invites", value: "3", tone: "warn" },
      { label: "Last sync", value: "8 minutes ago", tone: "good" },
    ],
    cards: [
      {
        kind: "records",
        id: "team-directory",
        title: "Active Team",
        description: "Current users, roles, and recent activity.",
        rows: [
          { title: "Maya Chen", subtitle: "Owner", meta: "Last active 4 min ago", status: "Verified" },
          { title: "Chris Romero", subtitle: "Estimator", meta: "Last active 19 min ago", status: "MFA enabled" },
          { title: "Alyssa Dean", subtitle: "Project Manager", meta: "Last active 1 hr ago", status: "Mobile app" },
          { title: "Rafael Ortiz", subtitle: "Office Admin", meta: "Invited yesterday", status: "Pending invite" },
        ],
      },
    ],
  },
  {
    id: "roles-permissions",
    title: "Roles & Permissions",
    description: "Permission boundaries for estimators, project managers, and admins.",
    summary: "Role policy snapshots and access posture.",
    icon: Scale,
    keywords: ["permissions", "roles", "authorization", "admin"],
    stats: [
      { label: "Custom roles", value: "4" },
      { label: "Restricted actions", value: "12" },
      { label: "Policy drift", value: "None detected", tone: "good" },
    ],
    cards: [
      {
        kind: "records",
        id: "roles-summary",
        title: "Permission Profiles",
        description: "High-level roles to refine once backend permission endpoints are connected.",
        rows: [
          { title: "Owner", subtitle: "Full workspace control", meta: "2 members", status: "All scopes" },
          { title: "Operations Lead", subtitle: "Projects, documents, AI controls", meta: "3 members", status: "Elevated" },
          { title: "Estimator", subtitle: "Estimating, proposals, intake", meta: "5 members", status: "Scoped" },
          { title: "Field Manager", subtitle: "Tasks, photos, site visit execution", meta: "4 members", status: "Scoped" },
        ],
      },
    ],
  },
  {
    id: "branding",
    title: "Branding",
    description: "Control how TradeOS looks across PDFs, emails, and portals.",
    summary: "Assets, colors, typography, and branded previews.",
    icon: Palette,
    keywords: ["branding", "logo", "colors", "typography", "proposal style", "invoice style"],
    stats: [
      { label: "Preview mode", value: "Live", tone: "good" },
      { label: "Primary color", value: initialSettingsDraft.brandPrimary },
      { label: "Accent", value: initialSettingsDraft.brandSecondary },
    ],
    cards: [
      {
        kind: "assets",
        id: "branding-assets",
        title: "Brand Asset Library",
        description: "Upload every surface TradeOS needs to feel like your company.",
        assets: [
          { key: "logoUrl", label: "Logo", description: "Default brand mark.", accept: "image/png,image/jpeg,image/webp,image/gif,image/x-icon", keywords: ["logo"] },
          { key: "darkLogoUrl", label: "Dark logo", description: "For dark PDFs and portals.", accept: "image/png,image/jpeg,image/webp,image/gif,image/x-icon", keywords: ["dark logo"] },
          { key: "iconUrl", label: "Icon", description: "Compact app and favicon mark.", accept: "image/png,image/jpeg,image/webp,image/gif,image/x-icon", keywords: ["favicon", "icon"] },
          { key: "watermarkUrl", label: "Watermark", description: "Optional faint document backdrop.", accept: "image/png,image/jpeg,image/webp,image/gif,image/x-icon", keywords: ["watermark"] },
        ],
      },
      {
        kind: "fields",
        id: "branding-system",
        title: "Brand System",
        description: "Document and communication styling used by estimates, proposals, invoices, and contracts.",
        columns: 2,
        fields: [
          field({
            key: "brandPrimary",
            kind: "color",
            label: "Brand primary",
            description: "Core dark tone for headings and dividers.",
          }),
          field({
            key: "brandSecondary",
            kind: "color",
            label: "Brand accent",
            description: "Highlight color for CTAs and totals.",
          }),
          field({
            key: "typography",
            kind: "select",
            label: "Typography",
            description: "Primary type family for PDFs and customer emails.",
            options: [
              { label: "Geist Sans", value: "Geist Sans" },
              { label: "IBM Plex Sans", value: "IBM Plex Sans" },
              { label: "Avenir Next", value: "Avenir Next" },
            ],
          }),
          field({
            key: "pdfAppearance",
            kind: "select",
            label: "PDF appearance",
            description: "Controls density, contrast, and visual framing.",
            options: [
              { label: "High contrast", value: "High contrast" },
              { label: "Minimal", value: "Minimal" },
              { label: "Presentation", value: "Presentation" },
            ],
          }),
          field({
            key: "emailSignature",
            kind: "textarea",
            label: "Email signature",
            description: "Appended to notifications and outbound messages.",
            keywords: ["signature", "email footer"],
          }),
          field({
            key: "proposalStyle",
            kind: "select",
            label: "Proposal styling",
            description: "Sets hierarchy, spacing, and hero treatment for proposals.",
            options: [
              { label: "Modern", value: "Modern" },
              { label: "Classic", value: "Classic" },
              { label: "Editorial", value: "Editorial" },
            ],
            keywords: ["proposal", "styling"],
          }),
          field({
            key: "invoiceStyle",
            kind: "select",
            label: "Invoice styling",
            description: "Controls density and emphasis in billing documents.",
            options: [
              { label: "Compact", value: "Compact" },
              { label: "Balanced", value: "Balanced" },
              { label: "Detailed", value: "Detailed" },
            ],
            keywords: ["invoice"],
          }),
          field({
            key: "contractStyle",
            kind: "select",
            label: "Contract styling",
            description: "Determines legal document presentation.",
            options: [
              { label: "Formal", value: "Formal" },
              { label: "Balanced", value: "Balanced" },
              { label: "Minimal", value: "Minimal" },
            ],
            keywords: ["contract"],
          }),
        ],
      },
      {
        kind: "preview",
        id: "branding-preview",
        title: "Live Preview",
        description: "See the current brand system applied to customer-facing surfaces.",
        preview: "branding",
      },
    ],
  },
  {
    id: "costbook",
    title: "CostBook",
    description: "Regional pricing and estimating defaults that shape margins.",
    summary: "Labor, markup, overhead, waste, and supplier defaults.",
    icon: SwatchBook,
    keywords: ["labor rate", "markup", "overhead", "profit", "regional pricing", "supplier"],
    stats: [
      { label: "Region", value: initialSettingsDraft.costRegion },
      { label: "Labor rate", value: `$${initialSettingsDraft.laborRate}/hr` },
      { label: "Margin profile", value: `${initialSettingsDraft.markupPercent}% markup` },
    ],
    cards: [
      {
        kind: "fields",
        id: "costbook-pricing",
        title: "Pricing Engine Defaults",
        description: "These values establish baseline economics for every estimate.",
        columns: 2,
        fields: [
          field({
            key: "costRegion",
            kind: "text",
            label: "Regional pricing",
            description: "Default market area that anchors labor and material assumptions.",
          }),
          field({
            key: "laborRate",
            kind: "text",
            label: "Labor rate",
            description: "Blended labor burden per hour.",
            keywords: ["labor", "hourly rate"],
          }),
          field({
            key: "markupPercent",
            kind: "text",
            label: "Markup",
            description: "Standard markup applied to estimate totals.",
          }),
          field({
            key: "overheadPercent",
            kind: "text",
            label: "Overhead",
            description: "Overhead recovery percentage built into pricing.",
          }),
          field({
            key: "profitPercent",
            kind: "text",
            label: "Profit",
            description: "Target profit percentage for default pricing.",
          }),
          field({
            key: "wasteFactor",
            kind: "text",
            label: "Waste factors",
            description: "Default waste applied to materials and assemblies.",
          }),
          field({
            key: "materialDefault",
            kind: "text",
            label: "Material defaults",
            description: "Default material family used for common estimate seeds.",
          }),
          field({
            key: "supplierPreference",
            kind: "text",
            label: "Supplier preferences",
            description: "Preferred supplier stack for recommendations and sourcing.",
          }),
        ],
      },
    ],
  },
  {
    id: "ai",
    title: "AI",
    description: "Provider, model, and automation defaults for estimating workflows.",
    summary: "Model selection, permissions, cost guardrails, and automation.",
    icon: Bot,
    keywords: ["model", "provider", "temperature", "ocr", "transcription", "auto-estimate"],
    stats: [
      { label: "Provider", value: initialSettingsDraft.aiProvider, tone: "good" },
      { label: "Monthly budget", value: `$${initialSettingsDraft.aiMonthlyBudget}` },
      { label: "Automation", value: initialSettingsDraft.autoEstimate ? "Enabled" : "Manual" },
    ],
    cards: [
      {
        kind: "fields",
        id: "ai-platform",
        title: "AI Platform Controls",
        description: "Tune how AI behaves inside intake, estimating, and document drafting.",
        columns: 2,
        fields: [
          field({
            key: "aiProvider",
            kind: "select",
            label: "AI provider",
            description: "Primary provider for TradeOS AI features.",
            options: [
              { label: "OpenAI", value: "OpenAI" },
              { label: "Azure OpenAI", value: "Azure OpenAI" },
              { label: "Anthropic", value: "Anthropic" },
            ],
          }),
          field({
            key: "defaultModel",
            kind: "select",
            label: "Default model",
            description: "Primary model used for chat, drafting, and estimation assistance.",
            options: [
              { label: "gpt-5.1", value: "gpt-5.1" },
              { label: "gpt-4.1", value: "gpt-4.1" },
              { label: "claude-sonnet", value: "claude-sonnet" },
            ],
          }),
          field({
            key: "temperature",
            kind: "text",
            label: "Temperature",
            description: "Controls creativity versus consistency for generated output.",
          }),
          field({
            key: "aiMonthlyBudget",
            kind: "text",
            label: "Cost controls",
            description: "Monthly AI budget cap before alerts begin.",
            keywords: ["spend cap", "ai cost"],
          }),
          field({
            key: "promptTemplate",
            kind: "text",
            label: "Prompt templates",
            description: "Default prompt library currently active for estimating.",
          }),
          field({
            key: "aiPermissions",
            kind: "select",
            label: "AI permissions",
            description: "Who can change models, prompts, and automation rules.",
            options: [
              { label: "Owners only", value: "Owners only" },
              { label: "Ops leads only", value: "Ops leads only" },
              { label: "Owners + estimators", value: "Owners + estimators" },
            ],
          }),
          field({
            key: "voiceTranscription",
            kind: "toggle",
            label: "Voice transcription",
            description: "Allow audio transcription during intake capture.",
          }),
          field({
            key: "ocrEnabled",
            kind: "toggle",
            label: "OCR",
            description: "Extract text from uploaded inspection and insurance documents.",
          }),
          field({
            key: "autoEstimate",
            kind: "toggle",
            label: "Auto-estimate settings",
            description: "Generate first-pass estimates automatically from approved intake context.",
          }),
        ],
      },
    ],
  },
  {
    id: "knowledge-engine",
    title: "Knowledge Engine",
    description: "Operational visibility into the runtime that powers smarter recommendations.",
    summary: "Index health, embeddings, cache policy, and diagnostics.",
    icon: SearchCheck,
    keywords: ["index", "embeddings", "cache", "runtime", "knowledge"],
    stats: [
      { label: "Runtime", value: "Healthy", tone: "good" },
      { label: "Index health", value: "98.7%", tone: "good" },
      { label: "Cache hit rate", value: "81%" },
    ],
    cards: [
      {
        kind: "status",
        id: "knowledge-diagnostics",
        sampleData: true,
        title: "Runtime Diagnostics",
        description: "Status surfaces to wire to future backend endpoints.",
        items: [
          { label: "Runtime status", value: "Healthy", tone: "good", description: "Serving estimate assistance and knowledge lookups normally." },
          { label: "Index health", value: "98.7%", tone: "good", description: "2 supplier items pending refresh." },
          { label: "Sync", value: "Last sync 17 min ago", description: "Supplier and assembly deltas are current." },
          { label: "CostBook version", value: "2026.07 Midwest", description: "Current region pack applied." },
          { label: "Supplier data", value: "12,418 SKUs", description: "Two feeds rate-limited overnight." },
          { label: "Assemblies", value: "384 curated assemblies", description: "7 awaiting approval." },
          { label: "Embeddings", value: initialSettingsDraft.embeddingsModel, description: "Vector index refreshed daily." },
          { label: "Cache", value: initialSettingsDraft.cachePolicy, description: "Automatic eviction after low-confidence updates." },
        ],
      },
      {
        kind: "fields",
        id: "knowledge-config",
        title: "Knowledge Configuration",
        description: "Defaults for search quality, retrieval behavior, and cache strategy.",
        columns: 2,
        fields: [
          field({
            key: "embeddingsModel",
            kind: "select",
            label: "Embeddings",
            description: "Primary vector model for knowledge retrieval.",
            options: [
              { label: "text-embedding-3-large", value: "text-embedding-3-large" },
              { label: "text-embedding-3-small", value: "text-embedding-3-small" },
            ],
          }),
          field({
            key: "cachePolicy",
            kind: "select",
            label: "Cache",
            description: "Balances freshness and response speed.",
            options: [
              { label: "Smart 24h cache", value: "Smart 24h cache" },
              { label: "Aggressive 72h cache", value: "Aggressive 72h cache" },
              { label: "Fresh on every sync", value: "Fresh on every sync" },
            ],
          }),
        ],
      },
    ],
  },
  {
    id: "estimating",
    title: "Estimating",
    description: "Workflows and approval rules that govern estimate output.",
    summary: "Approval chain, estimate automation, and default assumptions.",
    icon: Receipt,
    keywords: ["estimate", "approval", "pricing", "automation"],
    stats: [
      { label: "Approval flow", value: initialSettingsDraft.estimateApprovalFlow },
      { label: "Auto-estimate", value: initialSettingsDraft.autoEstimate ? "On" : "Off", tone: "good" },
      { label: "Default template", value: initialSettingsDraft.proposalTemplate },
    ],
    cards: [
      {
        kind: "fields",
        id: "estimating-workflow",
        title: "Estimate Workflow",
        description: "Keep estimating consistent across teams and job types.",
        columns: 2,
        fields: [
          field({
            key: "estimateApprovalFlow",
            kind: "text",
            label: "Approval flow",
            description: "Ordered review chain before estimates become proposal-ready.",
          }),
          field({
            key: "proposalTemplate",
            kind: "text",
            label: "Default estimate package",
            description: "Template family used for the most common jobs.",
          }),
          field({
            key: "autoEstimate",
            kind: "toggle",
            label: "AI first-pass estimates",
            description: "Seed line items from intake + knowledge runtime context.",
          }),
        ],
      },
    ],
  },
  {
    id: "crm",
    title: "CRM",
    description: "Project-first operating defaults for lead and customer flows.",
    summary: "Pipeline posture and customer handoff defaults.",
    icon: Briefcase,
    keywords: ["crm", "pipeline", "lead", "customer"],
    stats: [
      { label: "Operating model", value: initialSettingsDraft.crmPipelineMode, tone: "good" },
      { label: "Lead routing", value: "Manual review" },
      { label: "Customer sync", value: "Instant" },
    ],
    cards: [
      {
        kind: "fields",
        id: "crm-workflow",
        title: "CRM Workflow",
        description: "Keep the workspace aligned with TradeOS's project-centered operating model.",
        fields: [
          field({
            key: "crmPipelineMode",
            kind: "select",
            label: "Pipeline mode",
            description: "Controls whether your operating model centers on projects or traditional deals.",
            options: [
              { label: "Project-first", value: "Project-first" },
              { label: "Lead-first", value: "Lead-first" },
            ],
          }),
        ],
      },
    ],
  },
  {
    id: "documents",
    title: "Documents",
    description: "Customer-facing document defaults and preview controls.",
    summary: "Package selection, styling, and branded output defaults.",
    icon: FileStack,
    keywords: ["documents", "pdf", "invoice", "proposal", "contract", "change order", "purchase order"],
    stats: [
      { label: "Templates", value: "6 active" },
      { label: "Preview", value: "Branded", tone: "good" },
      { label: "Output", value: initialSettingsDraft.pdfAppearance },
    ],
    cards: [
      {
        kind: "fields",
        id: "document-templates",
        title: "Document Defaults",
        description: "Choose the primary template per document type.",
        columns: 2,
        fields: [
          field({
            key: "proposalTemplate",
            kind: "text",
            label: "Estimates / Proposals",
            description: "Default package for estimates and proposal exports.",
            keywords: ["estimate template", "proposal"],
          }),
          field({
            key: "contractTemplate",
            kind: "text",
            label: "Contracts",
            description: "Default contract template family.",
            keywords: ["contract"],
          }),
          field({
            key: "invoiceTemplate",
            kind: "text",
            label: "Invoices",
            description: "Default invoice presentation and structure.",
            keywords: ["invoice"],
          }),
          field({
            key: "changeOrderTemplate",
            kind: "text",
            label: "Change Orders",
            description: "Template used when scope or pricing changes mid-project.",
          }),
          field({
            key: "purchaseOrderTemplate",
            kind: "text",
            label: "Purchase Orders",
            description: "Default supplier purchase order format.",
          }),
        ],
      },
      {
        kind: "preview",
        id: "documents-preview",
        title: "Branded Document Preview",
        description: "Preview how your selected styles and templates come together.",
        preview: "documents",
      },
    ],
  },
  {
    id: "templates",
    title: "Templates",
    description: "Reusable content blocks and copy systems for consistent output.",
    summary: "Template families for the full customer document stack.",
    icon: Workflow,
    keywords: ["templates", "snippets", "proposal copy"],
    stats: [
      { label: "Library status", value: "Stable", tone: "good" },
      { label: "Shared blocks", value: "28" },
      { label: "Needs review", value: "2", tone: "warn" },
    ],
    cards: [
      {
        kind: "records",
        id: "template-library",
        sampleData: true,
        title: "Template Families",
        description: "Suggested structure until backend template versioning is connected.",
        rows: [
          { title: "Storm restoration", subtitle: "Proposal + invoice package", meta: "Updated 2 days ago", status: "Default" },
          { title: "Retail re-roof", subtitle: "Contract + proposal package", meta: "Updated last week", status: "Published" },
          { title: "Insurance supplement", subtitle: "Change order + supporting docs", meta: "Updated yesterday", status: "Reviewing" },
        ],
      },
    ],
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "How teams and customers hear about the work that matters.",
    summary: "Email, SMS, reminders, digests, and project alert preferences.",
    icon: Bell,
    keywords: ["email", "sms", "push", "reminders", "digest", "smtp"],
    stats: [
      { label: "Email", value: initialSettingsDraft.emailNotifications ? "Enabled" : "Disabled", tone: "good" },
      { label: "SMS", value: initialSettingsDraft.smsNotifications ? "Enabled" : "Disabled" },
      { label: "Digest", value: initialSettingsDraft.dailyDigest ? "Daily" : "Off" },
    ],
    cards: [
      {
        kind: "fields",
        id: "notification-channels",
        title: "Notification Channels",
        description: "Choose which channels stay active and how often reminders fire.",
        columns: 2,
        fields: [
          field({
            key: "emailNotifications",
            kind: "toggle",
            label: "Email",
            description: "Send project updates and workflow reminders by email.",
            keywords: ["smtp", "email delivery"],
          }),
          field({
            key: "smsNotifications",
            kind: "toggle",
            label: "SMS",
            description: "Send reminders and urgent alerts by text.",
          }),
          field({
            key: "pushNotifications",
            kind: "toggle",
            label: "Push",
            description: "Browser or future mobile push notifications.",
          }),
          field({
            key: "reminderTiming",
            kind: "select",
            label: "Reminder timing",
            description: "Default lead time for due-date reminders.",
            options: [
              { label: "1 hour before", value: "1 hour before" },
              { label: "24 hours before", value: "24 hours before" },
              { label: "48 hours before", value: "48 hours before" },
            ],
          }),
          field({
            key: "dailyDigest",
            kind: "toggle",
            label: "Daily digest",
            description: "Send a summary of due work and open approvals each morning.",
          }),
          field({
            key: "projectAlerts",
            kind: "toggle",
            label: "Project alerts",
            description: "Notify the team when project status, tasks, or documents change.",
          }),
          field({
            key: "paymentReminders",
            kind: "toggle",
            label: "Payment reminders",
            description: "Remind customers about outstanding invoices automatically.",
          }),
        ],
      },
    ],
  },
  {
    id: "integrations",
    title: "Integrations",
    description: "Future-ready connection points for communication, accounting, and infrastructure.",
    summary: "Connection status across office, comms, accounting, and platform services.",
    icon: Globe,
    keywords: ["google", "microsoft", "quickbooks", "stripe", "square", "twilio", "resend", "supabase", "cloudflare", "vercel"],
    stats: [
      { label: "Connected", value: "4 / 10" },
      { label: "Needs attention", value: "2", tone: "warn" },
      { label: "Last health check", value: "6 min ago", tone: "good" },
    ],
    cards: [
      {
        kind: "records",
        id: "integration-status",
        sampleData: true,
        title: "Connection Status",
        description: "Scaffolded surfaces for future OAuth and token-based integrations.",
        rows: [
          { title: "Google Workspace", subtitle: "Calendar + Drive sync", meta: "Last checked 6 min ago", status: "Connected" },
          { title: "Microsoft 365", subtitle: "Mail + Calendar", meta: "Not yet configured", status: "Available" },
          { title: "QuickBooks", subtitle: "Accounting export", meta: "Credentials expiring soon", status: "Needs review" },
          { title: "Stripe", subtitle: "Payments + billing", meta: "Sandbox connected", status: "Connected" },
          { title: "Square", subtitle: "Field collection", meta: "Not configured", status: "Available" },
          { title: "Twilio", subtitle: "SMS delivery", meta: "Last message 1 hour ago", status: "Connected" },
          { title: "Resend", subtitle: "Transactional email", meta: "DNS pending", status: "Needs review" },
          { title: "Supabase", subtitle: "Storage + auth", meta: "Healthy", status: "Connected" },
          { title: "Cloudflare", subtitle: "DNS + edge services", meta: "Ready to connect", status: "Available" },
          { title: "Vercel", subtitle: "Deployments + environments", meta: "Preview only", status: "Connected" },
        ],
      },
    ],
  },
  {
    id: "api-keys",
    title: "API Keys",
    description: "Token surfaces for service integrations and developer workflows.",
    summary: "Scoped keys, expiry posture, and rotation guidance.",
    icon: KeyRound,
    keywords: ["api keys", "tokens", "credentials", "secret"],
    stats: [
      { label: "Active tokens", value: "7" },
      { label: "Expiring soon", value: "2", tone: "warn" },
      { label: "Rotation policy", value: initialSettingsDraft.apiTokenPolicy },
    ],
    cards: [
      {
        kind: "fields",
        id: "api-policy",
        title: "Token Policy",
        description: "Workspace-wide defaults for API key issuance and rotation.",
        fields: [
          field({
            key: "apiTokenPolicy",
            kind: "select",
            label: "API token management",
            description: "Default expiry and rotation posture for issued keys.",
            options: [
              { label: "30-day expiry", value: "30-day expiry" },
              { label: "90-day expiry", value: "90-day expiry" },
              { label: "Manual rotation", value: "Manual rotation" },
            ],
          }),
        ],
      },
      {
        kind: "records",
        id: "api-key-inventory",
        sampleData: true,
        title: "Issued Credentials",
        description: "Placeholder inventory to wire to key-management endpoints later.",
        rows: [
          { title: "Estimate Engine Worker", subtitle: "Server-to-server", meta: "Created Jun 20, 2026", status: "Rotates in 14d" },
          { title: "Mobile Capture Beta", subtitle: "Internal app token", meta: "Created Jun 12, 2026", status: "Active" },
          { title: "QuickBooks Sync", subtitle: "Integration token", meta: "Created May 30, 2026", status: "Expiring soon" },
        ],
      },
    ],
  },
  {
    id: "security",
    title: "Security",
    description: "Policies and visibility for keeping the workspace safe.",
    summary: "Password, MFA, sessions, logins, and device posture.",
    icon: Shield,
    keywords: ["security", "password", "mfa", "sessions", "login history", "devices"],
    stats: [
      { label: "MFA", value: initialSettingsDraft.mfaRequired ? "Required" : "Optional", tone: "good" },
      { label: "Sessions", value: "23 active" },
      { label: "Risk posture", value: "Low", tone: "good" },
    ],
    cards: [
      {
        kind: "fields",
        id: "security-policies",
        title: "Security Policies",
        description: "Core policies for authentication and workspace access.",
        columns: 2,
        fields: [
          field({
            key: "passwordPolicy",
            kind: "select",
            label: "Password policy",
            description: "Default password complexity requirement.",
            options: [
              { label: "10 characters", value: "10 characters" },
              { label: "12 characters + mixed case", value: "12 characters + mixed case" },
              { label: "14 characters + symbols", value: "14 characters + symbols" },
            ],
          }),
          field({
            key: "mfaRequired",
            kind: "toggle",
            label: "MFA",
            description: "Require multi-factor auth for every team member.",
          }),
          field({
            key: "sessionTimeout",
            kind: "select",
            label: "Session management",
            description: "Maximum idle session age before re-authentication is required.",
            options: [
              { label: "8 hours", value: "8 hours" },
              { label: "12 hours", value: "12 hours" },
              { label: "24 hours", value: "24 hours" },
            ],
          }),
          field({
            key: "loginAlerts",
            kind: "toggle",
            label: "Login history alerts",
            description: "Email admins when new devices or suspicious logins appear.",
          }),
        ],
      },
      {
        kind: "records",
        id: "security-devices",
        sampleData: true,
        title: "Device Management",
        description: "Recent devices and sessions to eventually back with live auth data.",
        rows: [
          { title: "Maya's MacBook Pro", subtitle: "Chrome on macOS", meta: "Indianapolis, IN", status: "Current session" },
          { title: "Chris's iPad", subtitle: "Safari on iPadOS", meta: "Carmel, IN", status: "Verified" },
          { title: "Unknown Windows device", subtitle: "Edge on Windows 11", meta: "Louisville, KY", status: "Review" },
        ],
      },
    ],
  },
  {
    id: "billing",
    title: "Billing",
    description: "Commercial overview for seats, usage, storage, and invoices.",
    summary: "Plan posture and future SaaS billing visibility.",
    icon: CreditCard,
    keywords: ["billing", "plan", "usage", "ai consumption", "storage", "invoice"],
    stats: [
      { label: "Current plan", value: "RC1 Pro" },
      { label: "Seats", value: "14 / 20" },
      { label: "Upcoming invoice", value: "$1,248 on Jul 15" },
    ],
    cards: [
      {
        kind: "status",
        id: "billing-usage",
        sampleData: true,
        title: "Usage Snapshot",
        description: "Placeholder billing data until live subscription endpoints are available.",
        items: [
          { label: "Current plan", value: "RC1 Pro", description: "Priority support, AI estimating, advanced documents." },
          { label: "Seats", value: "14 of 20", description: "6 seats available before overage pricing." },
          { label: "AI consumption", value: "$612 / $1,800", description: "34% of monthly AI budget consumed." },
          { label: "Storage", value: "128 GB / 250 GB", description: "Photos and documents dominate usage." },
          { label: "Upcoming invoices", value: "$1,248 on Jul 15", description: "Includes sandbox Stripe billing trial." },
        ],
      },
    ],
  },
  {
    id: "backups",
    title: "Backups",
    description: "Recovery posture and data export readiness.",
    summary: "Snapshot cadence, retention, and export health.",
    icon: HardDrive,
    keywords: ["backup", "restore", "retention", "export"],
    stats: [
      { label: "Last backup", value: "23 min ago", tone: "good" },
      { label: "Retention", value: "30 days" },
      { label: "Restore test", value: "Passed Jul 1", tone: "good" },
    ],
    cards: [
      {
        kind: "records",
        id: "backup-history",
        sampleData: true,
        title: "Backup Timeline",
        description: "Recovery scaffolding ready for infrastructure-backed status data.",
        rows: [
          { title: "Nightly workspace snapshot", subtitle: "Full database + documents manifest", meta: "Completed 23 min ago", status: "Healthy" },
          { title: "Weekly restore validation", subtitle: "Sandbox recovery verification", meta: "Completed Jul 1", status: "Passed" },
          { title: "CostBook export package", subtitle: "Regional pricing snapshot", meta: "Completed yesterday", status: "Ready" },
        ],
      },
    ],
  },
  {
    id: "audit-log",
    title: "Audit Log",
    description: "A searchable timeline of what changed and who changed it.",
    summary: "Visibility into configuration changes and access events.",
    icon: Activity,
    keywords: ["audit", "history", "logs", "who changed"],
    stats: [
      { label: "Events today", value: "38" },
      { label: "Critical actions", value: "3", tone: "warn" },
      { label: "Retention", value: "1 year" },
    ],
    cards: [
      {
        kind: "records",
        id: "audit-events",
        sampleData: true,
        title: "Recent Activity",
        description: "Recent administrative events ready to connect to backend audit endpoints.",
        rows: [
          { title: "AI budget updated", subtitle: "Changed from $1,500 to $1,800", meta: "Maya Chen • 22 min ago", status: "Settings" },
          { title: "QuickBooks token rotated", subtitle: "Integration credentials refreshed", meta: "Chris Romero • 3 hrs ago", status: "Security" },
          { title: "New estimator invited", subtitle: "Rafael Ortiz added to Team", meta: "Alyssa Dean • yesterday", status: "Team" },
        ],
      },
    ],
  },
  {
    id: "developer",
    title: "Developer",
    description: "Operational metadata for debugging, environment awareness, and release posture.",
    summary: "Versioning, environment, flags, and health context.",
    icon: Wrench,
    keywords: ["version", "environment", "git commit", "build", "database", "feature flags", "health"],
    stats: [
      { label: "Release channel", value: "RC1" },
      { label: "Health", value: "Nominal", tone: "good" },
      { label: "Flags", value: "6 loaded" },
    ],
    cards: [
      {
        kind: "status",
        id: "developer-metadata",
        title: "Runtime Metadata",
        description: "Server-provided build details plus placeholders for deeper platform telemetry.",
        items: [
          { label: "Version", value: "0.1.0", description: "Frontend package version." },
          { label: "Environment", value: "Development", description: "Current Next.js runtime environment." },
          { label: "Git commit", value: "local-dev", description: "Wire to deployment environment variables." },
          { label: "Build number", value: "2026.07.03-rc1", description: "Placeholder build identifier." },
          { label: "Database version", value: "Awaiting API", description: "Expose via backend diagnostics endpoint." },
          { label: "Feature flags", value: "project-workspace, ai-estimate-assist, estimate-compare", description: "Representative flag inventory." },
          { label: "Health status", value: "Nominal", tone: "good", description: "App shell, proxy, and document surfaces responding." },
        ],
      },
    ],
  },
];
