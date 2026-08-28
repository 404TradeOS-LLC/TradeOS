import "server-only";
import { cookies } from "next/headers";

export const CUSTOMER_PORTAL_SESSION_COOKIE = "tradeos_customer_portal_session";
const BACKEND_API_URL = process.env.BACKEND_API_URL ?? "http://localhost:4000";

export async function getCustomerPortalSessionToken(): Promise<string | null> {
  return (await cookies()).get(CUSTOMER_PORTAL_SESSION_COOKIE)?.value ?? null;
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
  const text = await response.text();
  const body = text ? JSON.parse(text) : undefined;
  if (!response.ok) throw new Error(body?.error ?? "Customer portal request failed");
  return body as T;
}
