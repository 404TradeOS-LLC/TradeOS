/**
 * First-estimate onboarding (DES-3, Figma page 22 — Onboarding, `54:3`).
 *
 * Pure, client-safe helpers and copy for the signup → 3 steps → draft
 * estimate flow. The flow's promise, from the Figma top bar, is "First
 * useful estimate before full setup."
 *
 * Scope of this slice (vertical slice 1):
 * - Step 1 "Your work": trade types the company does.
 * - Step 2 "Your labor": a labor baseline rate plus an optional region.
 * - Step 3 "Build a real estimate": a recent job in the contractor's own
 *   words, handed to Athena for a structured draft.
 *
 * Steps 1–2 have no Figma frames (they exist only as rail items on the
 * step-3 frame), so they are implemented as the minimal rail flow the
 * DES-3 brief describes. Step 3 follows frames `58:2` / `59:4`.
 *
 * Persistence boundary (deliberate, see the PR body): the wizard itself is
 * session-scoped. Completion is recorded by the draft estimate it creates.
 * The labor baseline and region are session context for this first draft —
 * there is no organization-defaults persistence path for them yet, so they
 * are not sent to the server. Persisted onboarding state (skip/resume,
 * labor/region defaults) is a follow-up slice needing a migration + RLS.
 */

export const ONBOARDING_ROUTE = "/onboarding";

/** Set by the skip action; the dashboard bypass reads it server-side. */
export const ONBOARDING_SKIPPED_COOKIE = "tradeos-onboarding-skipped";
export const ONBOARDING_SKIP_COOKIE_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

/** Figma rail example: "$48 / hour baseline". */
export const DEFAULT_LABOR_RATE = 48;
export const MIN_LABOR_RATE = 1;
export const MAX_LABOR_RATE = 1000;

export const MIN_SCOPE_TEXT_LENGTH = 10;
export const MAX_SCOPE_TEXT_LENGTH = 10_000;
export const MAX_REGION_LENGTH = 120;

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

export function isValidLaborRate(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= MIN_LABOR_RATE &&
    value <= MAX_LABOR_RATE
  );
}

export function formatLaborRate(rate: number): string {
  return `$${rate} / hr`;
}

export interface ValidatedOnboardingInput {
  workTypes: string[];
  scopeText: string;
}

/**
 * Validate the fields the onboarding server action persists. Labor rate and
 * region are deliberately not part of this payload: they are session
 * context for the first draft (see the module doc) and have no
 * organization-defaults persistence path yet.
 */
export function validateOnboardingInput(input: {
  workTypes: unknown;
  scopeText: unknown;
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

  return { value: { workTypes, scopeText }, error: null };
}

/**
 * A brand-new organization is one with no projects and no draft/ready
 * estimates. The dashboard sends exactly those orgs to onboarding (unless
 * they skipped it); every other org lands on Today as before. A failed
 * count read must fail open to the dashboard, so callers treat a null
 * count as "not first run" rather than guessing.
 */
export function shouldRedirectToOnboarding(input: {
  projectCount: number | null;
  estimateCount: number | null;
  skipped: boolean;
}): boolean {
  if (input.skipped) return false;
  if (input.projectCount === null || input.estimateCount === null) return false;
  return input.projectCount === 0 && input.estimateCount === 0;
}
