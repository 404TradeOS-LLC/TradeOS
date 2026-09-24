import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isTeamTimeEnabled } from "@/lib/team-time-config";

const ACTIONS = new Set([
  "bootstrap", "configure_profile", "clock_in", "break_start", "break_end", "clock_out", "correct", "approve", "reopen",
]);

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

export async function POST(request: NextRequest) {
  if (!isTeamTimeEnabled()) return json({ error: "Team & Time is not enabled here." }, 404);

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) return json({ error: "This request is not allowed." }, 403);
    } catch {
      return json({ error: "This request is not allowed." }, 403);
    }
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ error: "Refresh your TradeOS sign-in to use Team & Time." }, 401);
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (sessionError || !accessToken) return json({ error: "Refresh your TradeOS sign-in to use Team & Time." }, 401);

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (rawBody.length > 20_000) return json({ error: "This time request is too large." }, 413);
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: "Send a valid time request." }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body) || !ACTIONS.has(String((body as { action?: unknown }).action))) {
    return json({ error: "This time action is not available." }, 400);
  }

  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!projectUrl || !publishableKey) return json({ error: "Team & Time is not configured for this environment." }, 503);

  try {
    const endpoint = new URL("/functions/v1/team-time", projectUrl);
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: publishableKey, Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const responseBody = await upstream.text();
    return new Response(responseBody, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return json({ error: "Team & Time is unavailable. Try again." }, 503);
  }
}
