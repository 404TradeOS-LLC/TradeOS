function getErrorMessage(body: unknown, fallbackError: string): string {
  if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") {
    return body.error;
  }

  return fallbackError;
}

export async function parseJsonResponse<T>(response: Response, fallbackError: string): Promise<T> {
  const text = await response.text();
  let body: unknown = undefined;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      if (!response.ok) throw new Error(fallbackError);
      throw new Error("Invalid JSON response");
    }
  }

  if (!response.ok) throw new Error(getErrorMessage(body, fallbackError));
  return body as T;
}
