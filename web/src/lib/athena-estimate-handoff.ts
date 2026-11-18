/**
 * One-tab, short-lived handoff from Athena's contractor-typed notes to the
 * existing Project → Estimate form. This is not conversation memory, an AI
 * summary, an authorization token, or a persisted estimate.
 */
export const ATHENA_ESTIMATE_DRAFT_KEY = "tradeos:athena-estimate-draft:v1";
const MAX_SCOPE_LENGTH = 4000;
const MAX_AGE_MS = 5 * 60_000;

export function makeAthenaEstimateDraft(notes: readonly string[], now: number): string | null {
  if (!Number.isSafeInteger(now) || now < 0) return null;
  const scope = notes.map((note) => note.trim()).filter(Boolean).join("\n\n");
  if (!scope || scope.length > MAX_SCOPE_LENGTH) return null;
  return JSON.stringify({ version: 1, createdAt: now, scope });
}

export function readAthenaEstimateDraft(raw: string | null, now: number): string | null {
  if (!raw || !Number.isSafeInteger(now) || now < 0) return null;
  try {
    const record: unknown = JSON.parse(raw);
    if (!record || typeof record !== "object") return null;
    const value = record as Record<string, unknown>;
    if (value.version !== 1 || !Number.isSafeInteger(value.createdAt) ||
        typeof value.createdAt !== "number" || value.createdAt < 0 ||
        value.createdAt > now || now - value.createdAt > MAX_AGE_MS) return null;
    if (typeof value.scope !== "string" || !value.scope.trim() ||
        value.scope.length > MAX_SCOPE_LENGTH) return null;
    return value.scope;
  } catch {
    return null;
  }
}
