export class ClientApiError extends Error {
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ClientApiError";
    this.status = status;
  }
}

function getErrorMessage(body: unknown): string {
  if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") {
    return body.error;
  }

  return "Request failed";
}

function normalizeProxyPath(path: string): string {
  return path.replace(/^\/api\/v1(?=\/|$)/, "");
}

// Browser-side fetch helper for Client Components (e.g. TanStack Query
// hooks). Always goes through the same-origin /api/proxy/* route handler —
// never calls the backend directly, since that's the only way to attach the
// bearer token without exposing it to client-side JS.
export async function clientFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/proxy${normalizeProxyPath(path)}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });

  const text = await response.text();
  let body: unknown = undefined;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      if (!response.ok) {
        throw new ClientApiError("Request failed", response.status);
      }

      throw new ClientApiError("Invalid JSON response", response.status);
    }
  }

  if (!response.ok) {
    throw new ClientApiError(getErrorMessage(body), response.status);
  }

  return body as T;
}
