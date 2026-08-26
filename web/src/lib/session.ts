import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface SessionClaims {
  sub: string;
  email?: string;
}

export async function getSessionToken(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function getSession(): Promise<SessionClaims | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  return {
    sub: user.id,
    email: user.email,
  };
}

export async function clearSessionCookie(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
