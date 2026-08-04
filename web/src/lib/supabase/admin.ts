import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only Supabase client authenticated with the service_role secret key.
// This bypasses Storage (and any other) RLS entirely, which is the point:
// authorization for Storage mutations in this app is enforced by the caller
// (uploadSettingsAssetAction verifies session + org membership + the
// team.manage/company.manage/settings.manage role gate before ever calling
// into this client) and by the application's own settings_asset_uploads
// metadata table (its own forced RLS, keyed off the request-scoped Prisma
// session -- unrelated to Storage RLS), not by Storage-level policies.
//
// This module must NEVER be imported by a Client Component or any code that
// ships to the browser -- the "server-only" import above throws a build
// error if that ever happens by accident, the same guard web/src/lib/storage.ts
// already relies on.
//
// SUPABASE_SERVICE_ROLE_KEY has no NEXT_PUBLIC_ prefix and is therefore never
// inlined into the client bundle -- unlike NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
// which is intentionally public. Never rename this to a NEXT_PUBLIC_-prefixed
// variable, and never pass this client (or its key) to a Client Component prop.
let cachedClient: SupabaseClient | null = null;

export function createSupabaseAdminClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured.");
  }
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  cachedClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cachedClient;
}
