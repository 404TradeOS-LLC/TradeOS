"use server";

import { revalidatePath } from "next/cache";
import { reviewAthenaApproval, submitAthenaApproval } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

function requiredString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} is required`);
  }
  return value.trim();
}

export async function submitAthenaApprovalAction(formData: FormData): Promise<void> {
  const token = await getSessionToken();
  if (!token) {
    throw new Error("You need to be signed in to submit Athena approvals.");
  }

  await submitAthenaApproval(token, {
    actionId: requiredString(formData, "actionId"),
    toolId: requiredString(formData, "toolId"),
    toolVersion: requiredString(formData, "toolVersion"),
    riskLevel: requiredString(formData, "riskLevel") as "medium" | "high",
    expiration: new Date(requiredString(formData, "expiration")).toISOString(),
    idempotencyKey: requiredString(formData, "idempotencyKey"),
    inputHash: requiredString(formData, "inputHash"),
    planId: requiredString(formData, "planId"),
    stepId: requiredString(formData, "stepId"),
  });

  revalidatePath("/athena/approvals");
}

export async function reviewAthenaApprovalAction(formData: FormData): Promise<void> {
  const token = await getSessionToken();
  if (!token) {
    throw new Error("You need to be signed in to review Athena approvals.");
  }

  await reviewAthenaApproval(token, requiredString(formData, "approvalId"), requiredString(formData, "decision") as "grant" | "deny");
  revalidatePath("/athena/approvals");
}
