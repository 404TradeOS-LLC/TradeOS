export type RecoveryError = { message: string };
export type RecoveryUser = { id: string };

export type RecoveryAuthClient = {
  auth: {
    exchangeCodeForSession(code: string): Promise<{ error: RecoveryError | null }>;
    verifyOtp(input: { token_hash: string; type: "recovery" }): Promise<{ error: RecoveryError | null }>;
    getUser(): Promise<{ data: { user: RecoveryUser | null }; error: RecoveryError | null }>;
  };
};

export type RecoveryVerificationResult =
  | { ok: true; userId: string }
  | { ok: false; stage: "missing-parameters" | "exchange" | "identity"; message?: string };

export async function verifyRecoveryIdentity(
  supabase: RecoveryAuthClient,
  input: { code: string | null; tokenHash: string | null; type: string | null },
): Promise<RecoveryVerificationResult> {
  let error: RecoveryError | null = null;

  if (input.code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(input.code));
  } else if (input.tokenHash && input.type === "recovery") {
    ({ error } = await supabase.auth.verifyOtp({ token_hash: input.tokenHash, type: "recovery" }));
  } else {
    return { ok: false, stage: "missing-parameters" };
  }

  if (error) {
    return { ok: false, stage: "exchange", message: error.message };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, stage: "identity", message: userError?.message };
  }

  return { ok: true, userId: user.id };
}
