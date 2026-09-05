export interface ParsedApiResponseBody {
  body: unknown;
  malformed: boolean;
}

export async function readApiResponseBody(response: Response): Promise<ParsedApiResponseBody> {
  const text = await response.text();
  if (!text) return { body: undefined, malformed: false };

  try {
    return { body: JSON.parse(text), malformed: false };
  } catch {
    return { body: undefined, malformed: true };
  }
}

export function getApiErrorPayload(body: unknown): { message: string; details?: unknown } {
  if (typeof body !== "object" || body === null) return { message: "Request failed" };

  const candidate = body as { error?: unknown; details?: unknown };
  return {
    message: typeof candidate.error === "string" ? candidate.error : "Request failed",
    details: candidate.details,
  };
}
