export type InitialRecoveryState =
  | { kind: "legacy-token"; token: string }
  | { kind: "explicit-error"; error: string }
  | { kind: "invalid-link" }
  | { kind: "verify-session" };

export type RecoverySessionState = { kind: "reset-form" } | { kind: "invalid-link" };

export function resolveInitialRecoveryState(
  token: string,
  error: string,
  hasRecoveryMarker: boolean,
): InitialRecoveryState {
  if (token) return { kind: "legacy-token", token };
  if (error) return { kind: "explicit-error", error };
  if (!hasRecoveryMarker) return { kind: "invalid-link" };
  return { kind: "verify-session" };
}

export function resolveRecoverySessionState(
  hasMatchingUser: boolean,
  hasSessionError: boolean,
): RecoverySessionState {
  if (hasSessionError || !hasMatchingUser) return { kind: "invalid-link" };
  return { kind: "reset-form" };
}
