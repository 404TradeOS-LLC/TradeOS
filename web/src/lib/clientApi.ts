export class ClientApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ClientApiError";
  }
}

// Browser-side fetch helper for Client Components (e.g. TanStack Query
// hooks). Always goes through the same-origin /api/proxy/* route handler —
// never calls the backend directly, since that's the only way to attach the
// bearer token without exposing it to client-side JS.
export async function clientFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/proxy${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    throw new ClientApiError(body?.error ?? "Request failed", response.status);
  }

  return body as T;
}
