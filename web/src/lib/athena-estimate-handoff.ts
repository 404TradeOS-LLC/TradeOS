/**
 * Ephemeral and review-only transfer of contractor-authored notes into the
 * existing Project → Estimate form. This is not AI conversation memory, an
 * estimate, an authorization token, or a substitute for service-layer checks.
 */
export const ATHENA_ESTIMATE_DRAFT_KEY = "tradeos:athena-estimate-draft:v1";
const MAX_SCOPE_LENGTH = 4000;
const MAX_AGE_MS = 5 * 60_000;

/** A display-only binding derived independently on both authenticated routes. */
export function buildAthenaEstimateIdentity(
  subject: string | null | undefined,
  organization: string | null | undefined
): string | null {
  if (!subject?.trim() || !organization?.trim()) return null;
  return JSON.stringify([subject.trim(), organization.trim()]);
}

export function makeAthenaEstimateDraft(
  notes: readonly string[],
  now: number,
  identity: string
): string | null {
  if (!Number.isSafeInteger(now) || now < 0 || !identity.trim()) return null;
  const scope = notes.map((note) => note.trim()).filter(Boolean).join("\n\n");
  // Refuse rather than silently dropping or shortening contractor details.
  if (!scope || scope.length > MAX_SCOPE_LENGTH) return null;
  return JSON.stringify({ version: 1, createdAt: now, identity, scope });
}

export function readAthenaEstimateDraft(
  raw: string | null,
  now: number,
  identity: string
): string | null {
  if (!raw || !identity.trim() || !Number.isSafeInteger(now) || now < 0) return null;
  try {
    const record: unknown = JSON.parse(raw);
    if (!record || typeof record !== "object") return null;
    const value = record as Record<string, unknown>;
    if (value.version !== 1 || value.identity !== identity ||
        typeof value.createdAt !== "number" ||
        !Number.isSafeInteger(value.createdAt) || value.createdAt < 0 ||
        value.createdAt > now || now - value.createdAt > MAX_AGE_MS) return null;
    if (typeof value.scope !== "string" || !value.scope.trim() ||
        value.scope.length > MAX_SCOPE_LENGTH) return null;
    return value.scope;
  } catch {
    return null;
  }
}
