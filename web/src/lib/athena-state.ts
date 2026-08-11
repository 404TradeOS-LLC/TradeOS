// Pure decision logic for the four non-happy-path states every Athena page
// can render (loading is a static skeleton with no branching, so it has no
// logic to test here - see web/src/app/(app)/athena/loading.tsx etc.).
// Deliberately split out of web/src/lib/athena-access.ts (which is
// `server-only` and pulls in the Supabase session client) so this module can
// be unit tested with a plain `import` under `node --test` - importing
// `server-only` anywhere in a module's chain makes that module throw outside
// a Next server bundle (verified: `require("server-only")` throws
// unconditionally under plain Node), which is why no other server-coupled
// module in this codebase is imported directly from a `.test.ts` file either
// (see web/src/app/actions/auth.test.ts's source-pinning comment for the
// same constraint on Server Actions).
//
// This module also has zero relative imports of its own on purpose: Node's
// native TS runner (`node --test`, no bundler) resolves relative imports at
// real runtime and requires explicit extensions, which conflicts with this
// project's tsconfig (`moduleResolution: "bundler"`, no
// `allowImportingTsExtensions`) for any file `next build`/`tsc` also type
// checks. Duck-typing the ApiClientError shape below instead of importing
// the class avoids that conflict entirely rather than working around it.

function isApiClientErrorLike(error: unknown): error is { status: number; message: string } {
  return error instanceof Error && "status" in error && typeof (error as { status: unknown }).status === "number";
}

const OPERATOR_ROLES = new Set(["owner", "admin"]);

export function isAthenaOperatorRole(role: string | null | undefined): boolean {
  return role != null && OPERATOR_ROLES.has(role);
}

export type AthenaDisplayState =
  | { kind: "signed_out" }
  | { kind: "denied"; currentRole?: string }
  | { kind: "not_enabled" }
  | { kind: "error"; message?: string };

export type AthenaAccessState = Extract<AthenaDisplayState, { kind: "signed_out" | "denied" | "error" }>;
export type AthenaLoadOutcome = Extract<AthenaDisplayState, { kind: "not_enabled" | "denied" | "error" }>;

/**
 * Maps a failed observability fetch (thrown after the pre-fetch role gate in
 * athena-access.ts already passed) to a display state:
 *  - 404 means ATHENA_OBSERVABILITY_ENABLED is off - the backend's
 *    requireObservabilityAccess() throws before it even checks role, so
 *    every route 404s org-wide. Treated as a calm "not enabled yet" state,
 *    never a scary error.
 *  - 403 means the session's role no longer qualifies when checked again
 *    server-side (e.g. it changed between the settings lookup and this
 *    call) - treated the same as the pre-fetch role gate.
 *  - anything else is a genuine fetch failure.
 */
export function describeAthenaLoadError(error: unknown): AthenaLoadOutcome {
  if (isApiClientErrorLike(error)) {
    if (error.status === 404) return { kind: "not_enabled" };
    if (error.status === 403) return { kind: "denied" };
    return { kind: "error", message: error.message || "Request to the Athena observability service failed." };
  }
  return { kind: "error", message: "Unable to reach the Athena observability service." };
}
