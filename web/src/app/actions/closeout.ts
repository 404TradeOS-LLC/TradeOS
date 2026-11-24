"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { apiFetch, ApiClientError } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import { FormActionState } from "./customers";

function closeoutRedirect(projectId: string): never {
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}?tab=closeout`);
}

function actionError(err: unknown): { error: string } {
  return { error: err instanceof ApiClientError ? err.message : "Something went wrong." };
}

export async function createCloseoutAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const token = await getSessionToken();
  const projectId = String(formData.get("projectId") ?? "");

  try {
    await apiFetch(`/api/v1/closeout/projects/${encodeURIComponent(projectId)}/closeout`, {
      method: "POST",
      token: token ?? undefined,
    });
  } catch (err) {
    // A 409 surfaces the backend's own reason (closeout already exists, or
    // no completed job on the project) — shown to the contractor verbatim.
    return actionError(err);
  }

  closeoutRedirect(projectId);
}

export async function markCloseoutReadyAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const token = await getSessionToken();
  const projectId = String(formData.get("projectId") ?? "");

  try {
    await apiFetch(`/api/v1/closeout/projects/${encodeURIComponent(projectId)}/closeout/ready`, {
      method: "POST",
      token: token ?? undefined,
    });
  } catch (err) {
    // A 409 surfaces the backend's own reason (checklist not ready, or the
    // closeout is not a draft) — shown to the contractor verbatim.
    return actionError(err);
  }

  closeoutRedirect(projectId);
}

export async function recordCloseoutHandoffAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const token = await getSessionToken();
  const projectId = String(formData.get("projectId") ?? "");

  try {
    await apiFetch(`/api/v1/closeout/projects/${encodeURIComponent(projectId)}/closeout/handoff`, {
      method: "POST",
      token: token ?? undefined,
    });
  } catch (err) {
    return actionError(err);
  }

  closeoutRedirect(projectId);
}

export async function createPunchItemAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const token = await getSessionToken();
  const projectId = String(formData.get("projectId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priority = String(formData.get("priority") ?? "").trim();
  const jobId = String(formData.get("jobId") ?? "").trim();
  const assignedUserId = String(formData.get("assignedUserId") ?? "").trim();
  const dueDate = String(formData.get("dueDate") ?? "").trim();

  if (!title) return { error: "Punch item title is required." };
  // The backend accepts three priorities only — anything else is rejected.
  if (!["low", "medium", "high"].includes(priority)) {
    return { error: "Choose a punch item priority." };
  }

  try {
    await apiFetch(`/api/v1/closeout/projects/${encodeURIComponent(projectId)}/punch-items`, {
      method: "POST",
      token: token ?? undefined,
      body: JSON.stringify({
        title,
        description: description || undefined,
        priority,
        jobId: jobId || undefined,
        assignedUserId: assignedUserId || undefined,
        // <input type="date"> yields a bare date; the backend's Zod schema
        // requires a full datetime — same conversion as invoice dates.
        dueDate: dueDate ? `${dueDate}T00:00:00.000Z` : undefined,
      }),
    });
  } catch (err) {
    return actionError(err);
  }

  closeoutRedirect(projectId);
}

async function transitionPunchItem(_prev: FormActionState, formData: FormData, transition: "resolve" | "verify" | "reopen"): Promise<FormActionState> {
  const token = await getSessionToken();
  const projectId = String(formData.get("projectId") ?? "");
  const punchItemId = String(formData.get("punchItemId") ?? "");

  try {
    await apiFetch(`/api/v1/closeout/punch-items/${encodeURIComponent(punchItemId)}/${transition}`, {
      method: "POST",
      token: token ?? undefined,
    });
  } catch (err) {
    return actionError(err);
  }

  closeoutRedirect(projectId);
}

export async function resolvePunchItemAction(prev: FormActionState, formData: FormData): Promise<FormActionState> {
  return transitionPunchItem(prev, formData, "resolve");
}

export async function verifyPunchItemAction(prev: FormActionState, formData: FormData): Promise<FormActionState> {
  return transitionPunchItem(prev, formData, "verify");
}

export async function reopenPunchItemAction(prev: FormActionState, formData: FormData): Promise<FormActionState> {
  return transitionPunchItem(prev, formData, "reopen");
}

export async function createWarrantyAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const token = await getSessionToken();
  const projectId = String(formData.get("projectId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const coverageText = String(formData.get("coverageText") ?? "").trim();
  const sourceType = String(formData.get("sourceType") ?? "").trim();
  const sourceId = String(formData.get("sourceId") ?? "").trim();
  const startsAt = String(formData.get("startsAt") ?? "").trim();
  const endsAt = String(formData.get("endsAt") ?? "").trim();

  if (!title) return { error: "Warranty title is required." };
  if (!coverageText) return { error: "Coverage text is required — quote it from the contract or invoice." };
  if (!["contract", "invoice", "other"].includes(sourceType)) {
    return { error: "Choose where this warranty comes from." };
  }

  try {
    await apiFetch(`/api/v1/closeout/projects/${encodeURIComponent(projectId)}/warranties`, {
      method: "POST",
      token: token ?? undefined,
      body: JSON.stringify({
        title,
        coverageText,
        sourceType,
        sourceId: sourceId || undefined,
        // Link the picked source record through the backend's own typed
        // fields (validated against this project) as well as sourceId.
        ...(sourceType === "contract" && sourceId ? { contractId: sourceId } : {}),
        ...(sourceType === "invoice" && sourceId ? { invoiceId: sourceId } : {}),
        // <input type="date"> yields bare dates; the backend's Zod schema
        // requires full datetimes — same conversion as invoice dates.
        startsAt: startsAt ? `${startsAt}T00:00:00.000Z` : undefined,
        endsAt: endsAt ? `${endsAt}T00:00:00.000Z` : undefined,
      }),
    });
  } catch (err) {
    return actionError(err);
  }

  closeoutRedirect(projectId);
}

export async function deleteWarrantyAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const token = await getSessionToken();
  const projectId = String(formData.get("projectId") ?? "");
  const warrantyId = String(formData.get("warrantyId") ?? "");

  try {
    await apiFetch(`/api/v1/closeout/warranties/${encodeURIComponent(warrantyId)}`, {
      method: "DELETE",
      token: token ?? undefined,
    });
  } catch (err) {
    return actionError(err);
  }

  closeoutRedirect(projectId);
}
