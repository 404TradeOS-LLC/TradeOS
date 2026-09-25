const ACTIONS = new Set([
  "bootstrap", "configure_profile", "clock_in", "break_start", "break_end", "clock_out", "correct", "approve", "reopen",
]);

type TeamTimeRouteDependencies = {
  isEnabled: () => boolean;
  getAccessToken: () => Promise<string | null>;
  env: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function createTeamTimePostHandler({ isEnabled, getAccessToken, env, fetchImpl = fetch, timeoutMs = 15_000 }: TeamTimeRouteDependencies) {
  return async function POST(request: Request): Promise<Response> {
    if (!isEnabled()) return json({ error: "Team & Time is not enabled here." }, 404);
    if (request.method !== "POST" || !isSameOriginRequest(request)) return json({ error: "This request is not allowed." }, 403);

    let body: unknown;
    try {
      const rawBody = await request.text();
      if (new TextEncoder().encode(rawBody).byteLength > 20_000) return json({ error: "This time request is too large." }, 413);
      body = JSON.parse(rawBody);
    } catch {
      return json({ error: "Send a valid time request." }, 400);
    }
    if (!body || typeof body !== "object" || Array.isArray(body) || !ACTIONS.has(String((body as { action?: unknown }).action))) {
      return json({ error: "This time action is not available." }, 400);
    }

    const projectUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!projectUrl || !publishableKey) return json({ error: "Team & Time is not configured for this environment." }, 503);

    const accessToken = await getAccessToken();
    if (!accessToken) return json({ error: "Refresh your TradeOS sign-in to use Team & Time." }, 401);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new DOMException("Team & Time request timed out", "TimeoutError")), timeoutMs);
    try {
      const endpoint = new URL("/functions/v1/team-time", projectUrl);
      const upstream = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: publishableKey, Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: controller.signal,
      });
      const responseBody = await upstream.text();
      return new Response(responseBody, {
        status: upstream.status,
        headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
      });
    } catch {
      if (controller.signal.aborted) return json({ error: "Team & Time did not respond. Refresh to confirm your latest action before retrying." }, 504);
      return json({ error: "Team & Time is unavailable. Try again." }, 503);
    } finally {
      clearTimeout(timeout);
    }
  };
}
