"use server";

import { revalidatePath } from "next/cache";
import { promoteCostbookCandidate, reviewCostbookCandidate } from "@/lib/costbook-api";
import { getSessionToken } from "@/lib/session";

/**
 * Review-queue decisions for researched Costbook pricing candidates.
 *
 * These actions carry no reviewer identity: the API records the authenticated
 * caller's own user id as the reviewer, so a synthetic reviewer ("AI",
 * "system") can never be submitted from here. Authorization is enforced by the
 * backend (costbook.manage); the UI hides the controls as a convenience, not
 * as the security boundary.
 */

const RESEARCH_REVIEW_PATH = "/costbook/research-review";

function requiredString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} is required`);
  }
  return value.trim();
}

function optionalString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function reviewCostbookCandidateAction(formData: FormData): Promise<void> {
  const token = await getSessionToken();
  if (!token) {
    throw new Error("You need to be signed in to review Costbook research candidates.");
  }

  const decision = requiredString(formData, "decision");
  if (decision !== "approved" && decision !== "rejected") {
    throw new Error("A review decision must be either approved or rejected.");
  }

  await reviewCostbookCandidate(token, requiredString(formData, "candidateId"), {
    decision,
    reviewNotes: optionalString(formData, "reviewNotes"),
  });

  revalidatePath(RESEARCH_REVIEW_PATH);
}

export async function promoteCostbookCandidateAction(formData: FormData): Promise<void> {
  const token = await getSessionToken();
  if (!token) {
    throw new Error("You need to be signed in to promote Costbook research candidates.");
  }

  await promoteCostbookCandidate(token, requiredString(formData, "candidateId"));

  // Promotion creates a real Cost Item, so the catalog and price-history
  // surfaces are stale too.
  revalidatePath(RESEARCH_REVIEW_PATH);
  revalidatePath("/costbook/cost-items");
  revalidatePath("/costbook/price-history");
}
