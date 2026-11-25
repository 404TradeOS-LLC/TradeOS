/**
 * First-estimate onboarding (DES-3, Figma page 22 — Onboarding, `54:3`).
 *
 * Pure, client-safe helpers and copy for the signup → 2 steps → draft
 * estimate flow. The flow's promise, from the Figma top bar, is "First
 * useful estimate before full setup."
 *
 * Scope of this slice (vertical slice 1):
 * - Step 1 "Your work": trade types the company does.
 * - Step 2 "Build a real estimate": a recent job in the contractor's own
 *   words, handed to Athena for a structured draft.
 *
 * Step 1 has no Figma frame (it exists only as a rail item on the step-2
 * frame), so it is implemented as the minimal rail flow the DES-3 brief
 * describes. Step 2 follows frames `58:2` / `59:4`.
 *
 * Persistence boundary (DES-3 slice 2): the wizard persists to the org's
 * onboarding-state record (`organization_onboarding_states`, forced RLS)
 * via `GET/PATCH /api/v1/onboarding/state` — step, work types, scope
 * text, labor baseline, and region — so an org resumes where it left off
 * and a skip is org-scoped. Completion is recorded by the draft estimate
 * the wizard creates and by the state row's `completed` status.
 * Labor/region defaults returned with slice 2 (they were removed from the
 * wizard in slice 1's Codex review because no persistence path existed);
 * the estimate engine does not read the persisted baseline yet — wiring
 * it is a follow-up slice.
 */

export const ONBOARDING_ROUTE = "/onboarding";

/** Set by the skip action; the dashboard bypass reads it server-side. */
export const ONBOARDING_SKIPPED_COOKIE = "tradeos-onboarding-skipped";
export const ONBOARDING_SKIP_COOKIE_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

/**
 * Labor baseline for the wizard (DES-3 slice 2). The wizard asks for the
 * org's labor baseline in whole dollars per hour and persists it (cents)
 * on the org's onboarding-state record, pre-filled on resume. $48/hr is
 * the slice-1 plan default; the estimate engine does not read it yet —
 * wiring the engine to the persisted baseline is a follow-up slice.
 */
export const DEFAULT_LABOR_RATE_CENTS = 4800;
export const MIN_LABOR_RATE_DOLLARS = 1;
export const MAX_LABOR_RATE_DOLLARS = 500;
export const MAX_ONBOARDING_REGION_LENGTH = 120;

/** Parse a wizard labor-rate field (whole dollars) to cents, or null when blank. */
export function parseLaborRateDollars(input: unknown): { cents: number | null; error: string | null } {
  if (input === undefined || input === null || input === "") return { cents: null, error: null };
  const dollars = typeof input === "number" ? input : Number(String(input).trim());
  if (!Number.isInteger(dollars) || dollars < MIN_LABOR_RATE_DOLLARS || dollars > MAX_LABOR_RATE_DOLLARS) {
    return { cents: null, error: `Enter a labor rate between $${MIN_LABOR_RATE_DOLLARS} and $${MAX_LABOR_RATE_DOLLARS} per hour.` };
  }
  return { cents: dollars * 100, error: null };
}

/** Whole-dollar display for a persisted cents value (e.g. 4800 → "48"). */
export function formatLaborRateDollars(cents: number | null): string {
  return cents === null ? String(DEFAULT_LABOR_RATE_CENTS / 100) : String(Math.round(cents / 100));
}

export const MIN_SCOPE_TEXT_LENGTH = 10;
export const MAX_SCOPE_TEXT_LENGTH = 10_000;

/**
 * Trade picker options for step 1. Figma rail example is
 * "Remodeling · Painting · Flooring"; the rest are the common contractor
 * trades a new org is most likely to pick from. There is no canonical
 * trade list in the repo yet — when one lands, this list should defer to it.
 */
export const ONBOARDING_WORK_TYPES = [
  "Remodeling",
  "Painting",
  "Flooring",
  "Roofing",
  "Plumbing",
  "Electrical",
  "Carpentry",
  "Concrete",
  "Drywall",
  "HVAC",
  "Landscaping",
  "General Contracting",
] as const;

export type OnboardingWorkType = (typeof ONBOARDING_WORK_TYPES)[number];

/**
 * Example jobs for the step-3 scope composer. The Interior painting text
 * is verbatim from the Figma frame (`58:2`); the other two are short
 * examples in the same voice ("You don't need measurements, products, or
 * line items yet."). Each chip fills the composer — the contractor edits
 * it into their real job before submitting.
 */
export const ONBOARDING_EXAMPLE_SCOPES: ReadonlyArray<{ label: string; scope: string }> = [
  {
    label: "Kitchen remodel",
    scope:
      "Remodel a small kitchen. Customer wants new cabinets and countertops, fresh paint on the walls, and the work done before the holidays.",
  },
  {
    label: "Deck repair",
    scope:
      "Repair a worn wood deck. Several boards are soft, the railing is loose, and the customer wants it safe to use this summer.",
  },
  {
    label: "Interior painting",
    scope:
      "Paint a 2.5-car garage floor. The old coating is worn in traffic areas. Customer wants a beige/tan finish and wants it done before next weekend.",
  },
];

/** The four "What TradeOS does next" steps, verbatim from the Figma frame. */
export const ONBOARDING_NEXT_STEPS: ReadonlyArray<{ title: string; detail: string }> = [
  { title: "Understand", detail: "Extract work + conditions" },
  { title: "Check data", detail: "Costbook + labor + assemblies" },
  { title: "Clarify", detail: "Ask only what changes price" },
  { title: "Build", detail: "Items → Price → Review" },
];

/** Setup the design deliberately defers past the first estimate. */
export const ONBOARDING_DEFERRED_SETUP: ReadonlyArray<{ title: string; detail: string }> = [
  { title: "Company", detail: "Business info + logo" },
  { title: "Pricing depth", detail: "Suppliers + Costbook tuning" },
  { title: "Payments", detail: "Collection preferences" },
  { title: "Team", detail: "Members + roles" },
];

/**
 * The onboarding flow never asks for a project name — the estimate is built
 * from the scope text. Derive a readable project name from the first
 * sentence (or first eight words) of the scope so the created Project is
 * recognizable in Projects/Estimates. The contractor can rename it later.
 */
export function deriveProjectNameFromScope(scope: string): string {
  const text = scope.replace(/\s+/g, " ").trim();
  if (!text) return "First estimate";
  const firstSentence = text.split(/[.!?]\s/)[0] ?? text;
  const words = firstSentence.split(" ").slice(0, 8).join(" ").trim();
  const name = words.length > 80 ? `${words.slice(0, 77).trimEnd()}…` : words;
  return name || "First estimate";
}

export interface ValidatedOnboardingInput {
  workTypes: string[];
  scopeText: string;
  /** Whole-dollar labor baseline, persisted in cents; defaults to $48/hr. */
  laborRateCents: number;
  /** Optional free-text region, persisted as entered (trimmed); null when blank. */
  region: string | null;
}

/**
 * Validate the fields the onboarding server action persists.
 *
 * laborRate is the wizard's whole-dollar labor baseline (blank = the $48/hr
 * default); region is optional free text. Both are persisted on the org's
 * onboarding-state record (DES-3 slice 2) and pre-filled on resume.
 */
export function validateOnboardingInput(input: {
  workTypes: unknown;
  scopeText: unknown;
  laborRate?: unknown;
  region?: unknown;
}): { value: ValidatedOnboardingInput | null; error: string | null } {
  const rawWorkTypes = Array.isArray(input.workTypes) ? input.workTypes : [];
  const workTypes = rawWorkTypes.filter(
    (entry): entry is string =>
      typeof entry === "string" && (ONBOARDING_WORK_TYPES as ReadonlyArray<string>).includes(entry),
  );
  if (workTypes.length === 0) {
    return { value: null, error: "Choose at least one type of work to continue." };
  }

  const scopeText = typeof input.scopeText === "string" ? input.scopeText.trim() : "";
  if (scopeText.length < MIN_SCOPE_TEXT_LENGTH) {
    return {
      value: null,
      error: "Describe the job in a sentence or two so Athena has something real to draft from.",
    };
  }
  if (scopeText.length > MAX_SCOPE_TEXT_LENGTH) {
    return { value: null, error: "That job description is too long. Keep it to a few sentences." };
  }

  const { cents, error: laborError } = parseLaborRateDollars(input.laborRate);
  if (laborError) return { value: null, error: laborError };

  const region = typeof input.region === "string" ? input.region.trim() : "";
  if (region.length > MAX_ONBOARDING_REGION_LENGTH) {
    return { value: null, error: "Keep the region to a short place name." };
  }

  return { value: { workTypes, scopeText, laborRateCents: cents ?? DEFAULT_LABOR_RATE_CENTS, region: region || null }, error: null };
}

/**
 * Persisted onboarding state for one organization (DES-3 slice 2), as
 * returned by GET /api/v1/onboarding/state. Null when the org has never
 * opened the wizard.
 */
export interface OnboardingState {
  orgId: string;
  status: "in_progress" | "skipped" | "completed";
  currentStep: number;
  workTypes: string[];
  scopeText: string | null;
  laborRateCents: number | null;
  region: string | null;
  skippedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

/**
 * A brand-new organization is one with no projects and no draft/ready
 * estimates. The dashboard sends exactly those orgs to onboarding (unless
 * they skipped it); every other org lands on Today as before. A failed
 * count read must fail open to the dashboard, so callers treat a null
 * count as "not first run" rather than guessing.
 *
 * `skipped` is the legacy browser-cookie skip (slice 1); `persistedSkipped`
 * is the org-scoped skip from the onboarding-state record (slice 2).
 * Either one suppresses the redirect.
 */
export function shouldRedirectToOnboarding(input: {
  projectCount: number | null;
  estimateCount: number | null;
  skipped: boolean;
  persistedSkipped?: boolean;
}): boolean {
  if (input.skipped || input.persistedSkipped) return false;
  if (input.projectCount === null || input.estimateCount === null) return false;
  return input.projectCount === 0 && input.estimateCount === 0;
}
