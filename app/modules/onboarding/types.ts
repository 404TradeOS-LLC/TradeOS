/**
 * DES-3 slice 2: persisted onboarding state.
 *
 * One OrganizationOnboardingState row per organization. Slice 1 kept the
 * wizard session-scoped (completion recorded only through the draft
 * estimate it created; skip as a browser cookie). This slice persists the
 * wizard itself so an org can skip once, resume where it left off, and
 * keep the labor/region defaults it entered.
 */

export type OnboardingStatus = "in_progress" | "skipped" | "completed";

export const ONBOARDING_STATUSES: readonly OnboardingStatus[] = [
  "in_progress",
  "skipped",
  "completed",
] as const;

/** Wizard steps: 1 = "Your work" (trades + labor/region), 2 = scope composer. */
export const ONBOARDING_MIN_STEP = 1;
export const ONBOARDING_MAX_STEP = 2;

/** Labor baseline bounds, in cents per hour ($1–$500/hr). */
export const MIN_LABOR_RATE_CENTS = 100;
export const MAX_LABOR_RATE_CENTS = 50000;

/** Wizard field bounds. */
export const MAX_ONBOARDING_WORK_TYPES = 12;
export const MAX_ONBOARDING_WORK_TYPE_LENGTH = 64;
export const MAX_ONBOARDING_SCOPE_LENGTH = 10_000;
export const MIN_ONBOARDING_SCOPE_LENGTH = 10;
export const MAX_ONBOARDING_REGION_LENGTH = 120;

export interface OnboardingStateDTO {
  orgId: string;
  status: OnboardingStatus;
  currentStep: number;
  workTypes: string[];
  scopeText: string | null;
  laborRateCents: number | null;
  region: string | null;
  skippedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export interface SaveOnboardingProgressInput {
  currentStep?: number;
  workTypes?: string[];
  scopeText?: string | null;
  laborRateCents?: number | null;
  region?: string | null;
}

export interface CompleteOnboardingInput {
  workTypes: string[];
  scopeText: string;
  laborRateCents?: number | null;
  region?: string | null;
}
