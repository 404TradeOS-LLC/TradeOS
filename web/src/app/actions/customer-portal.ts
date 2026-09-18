"use server";

import { issueCustomerPortalAccessToken, ApiClientError } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

export type CustomerPortalLinkActionState = {
  error?: string;
  link?: string;
  expiresAt?: string;
};

export async function issueCustomerPortalLinkAction(customerId: string): Promise<CustomerPortalLinkActionState> {
  const token = await getSessionToken();
  if (!token) return { error: "Your contractor session has expired. Sign in again." };
  if (!customerId) return { error: "A customer is required." };

  try {
    const issued = await issueCustomerPortalAccessToken(token, customerId);
    const link = `/customer-portal/access?token=${encodeURIComponent(issued.token)}`;
    return { link, expiresAt: issued.expiresAt };
  } catch (error) {
    return {
      error: error instanceof ApiClientError ? error.message : "The customer portal link could not be created.",
    };
  }
}
