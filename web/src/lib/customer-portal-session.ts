import "server-only";
import { cookies } from "next/headers";

export const CUSTOMER_PORTAL_SESSION_COOKIE = "tradeos_customer_portal_session";
const BACKEND_API_URL = process.env.BACKEND_API_URL ?? "http://localhost:4000";

export async function getCustomerPortalSessionToken(): Promise<string | null> {
  return (await cookies()).get(CUSTOMER_PORTAL_SESSION_COOKIE)?.value ?? null;
}

function getCustomerPortalErrorMessage(body: unknown): string {
  if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") {
    return body.error;
  }

  return "Customer portal request failed";
}

export async function parseCustomerPortalResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let body: unknown = undefined;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      if (!response.ok) throw new Error("Customer portal request failed");
      throw new Error("Invalid JSON response");
    }
  }

  if (!response.ok) throw new Error(getCustomerPortalErrorMessage(body));
  return body as T;
}

export async function customerPortalApiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getCustomerPortalSessionToken();
  if (!token) throw new Error("Customer portal session is required");
  const { headers, ...rest } = options;
  const response = await fetch(`${BACKEND_API_URL}${path}`, {
    ...rest,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "x-tradeos-portal-session": token,
      ...headers,
    },
  });
  return parseCustomerPortalResponse<T>(response);
}
