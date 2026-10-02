export type TeamTimeAction =
  | "bootstrap"
  | "configure_profile"
  | "clock_in"
  | "break_start"
  | "break_end"
  | "clock_out"
  | "correct"
  | "approve"
  | "reopen";

export async function teamTimeRequest<T = Record<string, unknown>>(
  action: TeamTimeAction,
  body: Record<string, unknown> = {},
  fetchImpl: typeof fetch = fetch
): Promise<T> {
  const response = await fetchImpl("/api/team-time", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...body }),
    credentials: "same-origin",
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "Team & Time is unavailable. Try again.");
  return payload;
}
