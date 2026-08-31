export class ApiClientError extends Error {
  public readonly status: number;
  public readonly details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.details = details;
  }
}

function getErrorMessage(body: unknown): string | undefined {
  if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") {
    return body.error;
  }

  return undefined;
}

function getErrorDetails(body: unknown): unknown {
  if (typeof body === "object" && body !== null && "details" in body) {
    return body.details;
  }

  return undefined;
}

export async function parseStaffApiResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let body: unknown = undefined;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      if (!response.ok) throw new ApiClientError("Request failed", response.status);
      throw new ApiClientError("Invalid JSON response", response.status);
    }
  }

  if (!response.ok) {
    throw new ApiClientError(getErrorMessage(body) ?? "Request failed", response.status, getErrorDetails(body));
  }

  return body as T;
}
