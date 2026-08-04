import { getOrganizationSettings, getSettingsAssetUpload, type SettingsAssetKey } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAllowedSettingsAssetKey } from "@/lib/settingsAssetUpload";

// Server-only proxy for private-bucket brand assets. This is the ONLY path
// through which a browser ever sees asset bytes -- the "project-files"
// bucket is private and the raw Supabase URL/service_role key never reach
// the client. Binary-safe sibling to /api/documents/[...path]/route.ts, but
// this one talks to Supabase Storage (via the service_role admin client)
// rather than proxying to the Express backend.
//
// Returns a stable URL (no query string needed for correctness -- see the
// no-store Cache-Control below) regardless of how many times the underlying
// asset has been replaced, so <img src="..."> in the Settings Console never
// needs to change when an asset is re-uploaded.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string; assetKey: string }> }
) {
  const { orgId, assetKey } = await params;

  const token = await getSessionToken();
  if (!token) return Response.json({ error: "Not authenticated" }, { status: 401 });

  if (!isAllowedSettingsAssetKey(assetKey)) {
    return Response.json({ error: "Unsupported asset field" }, { status: 400 });
  }
  const typedAssetKey = assetKey as SettingsAssetKey;

  // Real cross-org protection: the requested orgId must match the
  // authenticated session's own organization, verified server-side against
  // the trusted backend -- not against the path segment alone. Any org
  // member may view branding assets (matches this module's existing
  // select-policy posture), so no further role check is needed here.
  const { orgId: sessionOrgId } = await getOrganizationSettings(token);
  if (sessionOrgId !== orgId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const record = await getSettingsAssetUpload(token, typedAssetKey);
  if (!record) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(record.storageBucket).download(record.storagePath);
  if (error || !data) {
    console.error("brand-assets proxy: failed to download object", record.storagePath, error);
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const buffer = await data.arrayBuffer();
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": record.contentType,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      // The URL itself never changes across re-uploads (see
      // uploadSettingsAssetAction), so caching must be disabled here rather
      // than relying on a cache-busting query param the caller might not
      // always attach.
      "Cache-Control": "private, no-store",
    },
  });
}
