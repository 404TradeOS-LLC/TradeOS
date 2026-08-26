// ── Sprint 002: AI Intake Brain ────────────────────────────────────────────

export type Trade =
  | "Deck"
  | "Roofing"
  | "Bathroom Remodel"
  | "Kitchen Remodel"
  | "Whole Home Remodel"
  | "Fence"
  | "Concrete"
  | "Tree Service"
  | "Excavation"
  | "Landscaping"
  | "Flooring"
  | "Painting"
  | "Drywall"
  | "Electrical"
  | "HVAC"
  | "Plumbing"
  | "Siding"
  | "Windows"
  | "Doors"
  | "Garage"
  | "Pole Barn"
  | "Addition"
  | "Demolition";

export type ImportanceLevel = "Critical" | "Recommended" | "Optional";

export interface MissingInformationItem {
  field: string;
  reason: string;
  importance: ImportanceLevel;
}

export type ConfidenceLevel = "Very Low" | "Low" | "Moderate" | "High" | "Very High";

export interface IntakeConfidence {
  score: number;
  level: ConfidenceLevel;
  missingCritical: number;
  missingRecommended: number;
  reasoning: string;
}

export interface IntakeProposalDraft {
  scopeOfWork: string;
  assumptions: string[];
  exclusions: string[];
  timeline: string;
  paymentSchedule: Array<{ label: string; amountPercent: number; notes?: string }>;
}

export interface IntakeResult {
  trade: Trade | null;
  projectType: string;
  category: string;
  missingInformation: MissingInformationItem[];
  followUpQuestions: string[];
  confidenceScore: IntakeConfidence;
  proposalDraft: IntakeProposalDraft;
}

// ── Legacy site-visit analysis types (preserved) ──────────────────────────────

export interface SiteVisitAnalysisInput {
  projectName: string;
  simpleScope?: string | null;
  jobType?: string | null;
  projectAddress?: string | null;
  notes?: string | null;
  transcript?: string | null;
  measurements?: Record<string, unknown> | null;
}

export interface SiteVisitAnalysisResult {
  normalizedJobType: string | null;
  aiQuestions: string[];
  missingInfo: string[];
  confidenceScore: number;
}

export interface ProposalDraftInput extends SiteVisitAnalysisInput {
  companyName: string;
  customerName?: string | null;
}

export interface ProposalDraftResult {
  normalizedJobType: string | null;
  scopeOfWork: string;
  assumptions: string;
  exclusions: string;
  timeline: string;
  priceLow: number | null;
  priceHigh: number | null;
  paymentSchedule: Array<{ label: string; amountPercent: number; notes?: string }>;
}
