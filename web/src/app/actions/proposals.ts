"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { apiFetch, ApiClientError, Proposal } from "@/lib/api";
import { customerPortalApiFetch } from "@/lib/customer-portal-session";
import { getSessionToken } from "@/lib/session";
import { FormActionState } from "./customers";

function readPaymentSchedule(formData: FormData) {
  const schedule = [0, 1, 2]
    .map((index) => {
      const label = String(formData.get(`paymentLabel${index}`) ?? "").trim();
      const amountPercentRaw = String(formData.get(`paymentPercent${index}`) ?? "").trim();
      const notes = String(formData.get(`paymentNotes${index}`) ?? "").trim();
      const amountPercent = amountPercentRaw ? Number(amountPercentRaw) : NaN;

      if (!label && !amountPercentRaw && !notes) return null;
      if (!label || Number.isNaN(amountPercent)) return { invalid: true as const };

      return {
        label,
        amountPercent,
        ...(notes ? { notes } : {}),
      };
    })
    .filter((entry) => entry !== null);

  if (schedule.some((entry) => "invalid" in entry)) {
    return { error: "Each payment row needs a label and percent." };
  }

  return {
    value: schedule.length ? schedule : undefined,
  };
}

type CreateProposalActionState = FormActionState | { error: string; statusCheck: true };

export async function createProposalAction(_prev: CreateProposalActionState, formData: FormData): Promise<CreateProposalActionState> {
  const token = await getSessionToken();
  const projectId = String(formData.get("projectId") ?? "");
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "");
  const estimateId = String(formData.get("estimateId") ?? "");
  const companyName = String(formData.get("companyName") ?? "").trim();
  const showLineItemDetail = formData.get("showLineItemDetail") === "on";
  const scopeOfWork = String(formData.get("scopeOfWork") ?? "").trim();
  const assumptions = String(formData.get("assumptions") ?? "").trim();
  const exclusions = String(formData.get("exclusions") ?? "").trim();
  const timeline = String(formData.get("timeline") ?? "").trim();
  const termsAndConditions = String(formData.get("termsAndConditions") ?? "").trim();
  const paymentSchedule = readPaymentSchedule(formData);

  if ("error" in paymentSchedule) {
    return { error: paymentSchedule.error };
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
    return { error: "Refresh this form before creating the proposal." };
  }

  let proposal: Proposal;
  try {
    proposal = await apiFetch<Proposal>("/api/v1/proposals", {
      method: "POST",
      token: token ?? undefined,
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({
        estimateId: estimateId || undefined,
        projectId: projectId || undefined,
        companyName: companyName || undefined,
        showLineItemDetail,
        scopeOfWork: scopeOfWork || undefined,
        assumptions: assumptions || undefined,
        exclusions: exclusions || undefined,
        timeline: timeline || undefined,
        paymentScheduleJson: paymentSchedule.value,
        termsAndConditions: termsAndConditions || undefined,
      }),
    });
  } catch (err) {
    return {
      error: err instanceof ApiClientError ? err.message : "Something went wrong.",
      statusCheck: true,
    };
  }

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}/proposals/${proposal.id}`);
}

export async function updateProposalAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const token = await getSessionToken();
  const projectId = String(formData.get("projectId") ?? "");
  const proposalId = String(formData.get("proposalId") ?? "");
  const companyName = String(formData.get("companyName") ?? "").trim();
  const scopeOfWork = String(formData.get("scopeOfWork") ?? "").trim();
  const assumptions = String(formData.get("assumptions") ?? "").trim();
  const exclusions = String(formData.get("exclusions") ?? "").trim();
  const timeline = String(formData.get("timeline") ?? "").trim();
  const termsAndConditions = String(formData.get("termsAndConditions") ?? "").trim();
  const priceLowRaw = String(formData.get("priceLow") ?? "").trim();
  const priceHighRaw = String(formData.get("priceHigh") ?? "").trim();
  const finalPriceRaw = String(formData.get("finalPrice") ?? "").trim();
  const paymentSchedule = readPaymentSchedule(formData);

  if ("error" in paymentSchedule) {
    return { error: paymentSchedule.error };
  }

  try {
    await apiFetch(`/api/v1/proposals/${proposalId}`, {
      method: "PATCH",
      token: token ?? undefined,
      body: JSON.stringify({
        companyName: companyName || undefined,
        scopeOfWork: scopeOfWork || undefined,
        assumptions: assumptions || undefined,
        exclusions: exclusions || undefined,
        timeline: timeline || undefined,
        termsAndConditions: termsAndConditions || undefined,
        priceLow: priceLowRaw ? Number(priceLowRaw) : null,
        priceHigh: priceHighRaw ? Number(priceHighRaw) : null,
        finalPrice: finalPriceRaw ? Number(finalPriceRaw) : null,
        paymentScheduleJson: paymentSchedule.value,
      }),
    });
  } catch (err) {
    return { error: err instanceof ApiClientError ? err.message : "Something went wrong." };
  }

  revalidatePath(`/projects/${projectId}/proposals/${proposalId}`);
  redirect(`/projects/${projectId}/proposals/${proposalId}`);
}

// DES-10-F8: Copperline proposal sections 03 (selections) and 04
// (allowances). These actions stay on the proposal detail page (revalidate,
// no redirect) so staff can add several rows in a row. The backend enforces
// the same draft rules as the proposal itself: accepted proposals and
// proposals with a contract reject every write with 409.
function toIsoDueDate(raw: string): string | null | Error {
  if (!raw) return null;
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return new Error("Decision due date must be a valid date.");
  return parsed.toISOString();
}

function readSelectionForm(formData: FormData): { label: string; detail: string | null; status: string; dueDate: string | null } | { error: string } {
  const label = String(formData.get("label") ?? "").trim();
  const detail = String(formData.get("detail") ?? "").trim();
  const status = String(formData.get("status") ?? "action_required");
  const dueDateRaw = String(formData.get("dueDate") ?? "").trim();
  if (!label) return { error: "Selection label is required." };
  if (label.length > 120) return { error: "Selection label must be at most 120 characters." };
  if (detail.length > 500) return { error: "Selection detail must be at most 500 characters." };
  if (status !== "action_required" && status !== "confirmed") {
    return { error: "Selection status must be Action Required or Confirmed." };
  }
  const dueDate = toIsoDueDate(dueDateRaw);
  if (dueDate instanceof Error) return { error: dueDate.message };
  // Creates omit empty fields so the backend defaults apply; updates send
  // null so clearing a field actually clears it.
  return { label, detail: detail || null, status, dueDate };
}

async function mutateProposalSelection(
  method: "POST" | "PATCH" | "DELETE",
  formData: FormData,
  body?: Record<string, unknown>
): Promise<FormActionState> {
  const token = await getSessionToken();
  const projectId = String(formData.get("projectId") ?? "");
  const proposalId = String(formData.get("proposalId") ?? "");
  const selectionId = String(formData.get("selectionId") ?? "");
  if (!proposalId) return { error: "Proposal is missing." };
  if (method !== "POST" && !selectionId) return { error: "Selection is missing." };

  try {
    await apiFetch(
      method === "POST"
        ? `/api/v1/proposals/${proposalId}/selections`
        : `/api/v1/proposals/${proposalId}/selections/${selectionId}`,
      {
        method,
        token: token ?? undefined,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      }
    );
  } catch (err) {
    return { error: err instanceof ApiClientError ? err.message : "Something went wrong." };
  }

  revalidatePath(`/projects/${projectId}/proposals/${proposalId}`);
  return undefined;
}

export async function createProposalSelectionAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = readSelectionForm(formData);
  if ("error" in parsed) return { error: parsed.error };
  return mutateProposalSelection("POST", formData, {
    label: parsed.label,
    detail: parsed.detail ?? undefined,
    status: parsed.status,
    dueDate: parsed.dueDate ?? undefined,
  });
}

export async function updateProposalSelectionAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = readSelectionForm(formData);
  if ("error" in parsed) return { error: parsed.error };
  return mutateProposalSelection("PATCH", formData, {
    label: parsed.label,
    detail: parsed.detail,
    status: parsed.status,
    dueDate: parsed.dueDate,
  });
}

export async function deleteProposalSelectionAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  return mutateProposalSelection("DELETE", formData);
}

function readAllowanceForm(formData: FormData): { description: string; amount: number } | { error: string } {
  const description = String(formData.get("description") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const amount = amountRaw ? Number(amountRaw) : NaN;
  if (!description) return { error: "Allowance description is required." };
  if (description.length > 200) return { error: "Allowance description must be at most 200 characters." };
  if (!amountRaw || Number.isNaN(amount) || amount < 0) {
    return { error: "Allowance amount must be 0 or more." };
  }
  return { description, amount };
}

async function mutateProposalAllowance(
  method: "POST" | "PATCH" | "DELETE",
  formData: FormData,
  body?: Record<string, unknown>
): Promise<FormActionState> {
  const token = await getSessionToken();
  const projectId = String(formData.get("projectId") ?? "");
  const proposalId = String(formData.get("proposalId") ?? "");
  const allowanceId = String(formData.get("allowanceId") ?? "");
  if (!proposalId) return { error: "Proposal is missing." };
  if (method !== "POST" && !allowanceId) return { error: "Allowance is missing." };

  try {
    await apiFetch(
      method === "POST"
        ? `/api/v1/proposals/${proposalId}/allowances`
        : `/api/v1/proposals/${proposalId}/allowances/${allowanceId}`,
      {
        method,
        token: token ?? undefined,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      }
    );
  } catch (err) {
    return { error: err instanceof ApiClientError ? err.message : "Something went wrong." };
  }

  revalidatePath(`/projects/${projectId}/proposals/${proposalId}`);
  return undefined;
}

export async function createProposalAllowanceAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = readAllowanceForm(formData);
  if ("error" in parsed) return { error: parsed.error };
  return mutateProposalAllowance("POST", formData, { description: parsed.description, amount: parsed.amount });
}

export async function updateProposalAllowanceAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = readAllowanceForm(formData);
  if ("error" in parsed) return { error: parsed.error };
  return mutateProposalAllowance("PATCH", formData, { description: parsed.description, amount: parsed.amount });
}

export async function deleteProposalAllowanceAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  return mutateProposalAllowance("DELETE", formData);
}

export async function sendProposalAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {  const token = await getSessionToken();
  const id = String(formData.get("proposalId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");

  try {
    await apiFetch(`/api/v1/proposals/${id}/send`, { method: "POST", token: token ?? undefined });
  } catch (err) {
    return { error: err instanceof ApiClientError ? err.message : "Something went wrong." };
  }

  revalidatePath(`/projects/${projectId}/proposals/${id}`);
  redirect(`/projects/${projectId}/proposals/${id}`);
}

export async function resendProposalAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const token = await getSessionToken();
  const id = String(formData.get("proposalId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");

  try {
    await apiFetch(`/api/v1/proposals/${id}/resend`, { method: "POST", token: token ?? undefined });
  } catch (err) {
    return { error: err instanceof ApiClientError ? err.message : "Something went wrong." };
  }

  revalidatePath(`/projects/${projectId}/proposals/${id}`);
  redirect(`/projects/${projectId}/proposals/${id}`);
}

export async function markProposalViewedAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const token = await getSessionToken();
  const id = String(formData.get("proposalId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const portal = String(formData.get("portal") ?? "") === "true";

  try {
    await apiFetch(`/api/v1/proposals/${id}/mark-viewed`, { method: "POST", token: token ?? undefined });
  } catch (err) {
    return { error: err instanceof ApiClientError ? err.message : "Something went wrong." };
  }

  revalidatePath(`/projects/${projectId}/proposals/${id}`);
  if (portal) {
    redirect(`/portal/proposals/${id}`);
  }
  redirect(`/projects/${projectId}/proposals/${id}`);
}

export async function markProposalViewedSubmit(formData: FormData): Promise<void> {
  const token = await getSessionToken();
  const id = String(formData.get("proposalId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const portal = String(formData.get("portal") ?? "") === "true";

  await apiFetch(`/api/v1/proposals/${id}/mark-viewed`, { method: "POST", token: token ?? undefined });

  revalidatePath(`/projects/${projectId}/proposals/${id}`);
  if (portal) {
    redirect(`/portal/proposals/${id}`);
  }
  redirect(`/projects/${projectId}/proposals/${id}`);
}

export async function acceptProposalAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const token = await getSessionToken();
  const id = String(formData.get("proposalId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const portal = String(formData.get("portal") ?? "") === "true";

  try {
    await apiFetch(`/api/v1/proposals/${id}/accept`, { method: "POST", token: token ?? undefined });
  } catch (err) {
    return { error: err instanceof ApiClientError ? err.message : "Something went wrong." };
  }

  revalidatePath(`/projects/${projectId}/proposals/${id}`);
  if (portal) {
    redirect(`/portal/projects/${projectId}`);
  }
  redirect(`/projects/${projectId}/proposals/${id}`);
}

export async function acceptProposalSubmit(formData: FormData): Promise<void> {
  const token = await getSessionToken();
  const id = String(formData.get("proposalId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const portal = String(formData.get("portal") ?? "") === "true";

  await apiFetch(`/api/v1/proposals/${id}/accept`, { method: "POST", token: token ?? undefined });

  revalidatePath(`/projects/${projectId}/proposals/${id}`);
  if (portal) {
    redirect(`/portal/projects/${projectId}`);
  }
  redirect(`/projects/${projectId}/proposals/${id}`);
}

/**
 * Record a customer's in-person/phone/signed-copy approval without sending
 * email or pretending that the proposal was delivered through TradeOS.
 */
export async function acceptOfflineProposalAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const token = await getSessionToken();
  const proposalId = String(formData.get("proposalId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const channel = String(formData.get("channel") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const confirmed = formData.get("confirmed") === "true";
  if (!confirmed || !["in_person", "phone", "signed_document"].includes(channel) || note.length < 10 || note.length > 500) {
    return { error: "Confirm the customer's approval, select a method, and provide a 10-500 character note." };
  }

  try {
    await apiFetch(`/api/v1/proposals/${proposalId}/accept-offline`, {
      method: "POST",
      token: token ?? undefined,
      body: JSON.stringify({ channel, note, confirmed }),
    });
  } catch (error) {
    return { error: error instanceof ApiClientError ? error.message : "Unable to record offline acceptance." };
  }

  revalidatePath(`/projects/${projectId}/proposals/${proposalId}`);
  redirect(`/projects/${projectId}/proposals/${proposalId}`);
}

/**
 * DES-10-F7: governed public-portal acceptance. The customer answers from
 * a redeemed magic-link session — no staff JWT. The drawn signature is
 * required: a typed name alone is not attributable. The signer email is
 * the customer record's email on file (resolved server-side), never a
 * caller-supplied value. On success the page re-renders with the recorded
 * approval instead of the form, so a refresh cannot re-submit it.
 */

// DES-10-F7 (review repair): the API is authoritative, but the action
// pre-checks the same rule so an empty payload never leaves the server:
// the data URL must be a base64 raster image that decodes to bytes, not a
// bare `data:image/` prefix. Mirrors
// app/modules/proposals/signatureValidation.ts.
const SIGNATURE_DATA_URL_PATTERN = /^data:image\/(png|jpeg|jpg|gif|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

function isValidSignatureDataUrl(value: string): boolean {
  const match = SIGNATURE_DATA_URL_PATTERN.exec(value);
  if (!match) return false;
  try {
    return atob(match[2]).length > 0;
  } catch {
    return false;
  }
}

export async function acceptPortalProposalAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const id = String(formData.get("proposalId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const signerName = String(formData.get("signerName") ?? "").trim();
  const signatureDataUrl = String(formData.get("signatureDataUrl") ?? "").trim();
  const expectedUpdatedAt = String(formData.get("expectedUpdatedAt") ?? "").trim() || undefined;
  const reviewed = formData.get("reviewed") === "true";
  if (!reviewed || !signerName || !signatureDataUrl.startsWith("data:image/") || !isValidSignatureDataUrl(signatureDataUrl)) {
    return { error: "Review the scope, allowances, and terms, enter your full name, and draw your signature." };
  }

  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  try {
    await customerPortalApiFetch(`/api/v1/customer-portal/proposals/${id}/accept`, {
      method: "POST",
      body: JSON.stringify({
        signerName,
        signatureDataUrl,
        signatureIpReported: forwardedFor || requestHeaders.get("x-real-ip") || undefined,
        signatureUserAgentReported: requestHeaders.get("user-agent") || undefined,
        expectedUpdatedAt,
      }),
    });
  } catch (err) {
    return { error: err instanceof ApiClientError || err instanceof Error ? err.message : "Something went wrong." };
  }

  revalidatePath(`/customer-portal/proposals/${id}`);
  revalidatePath(`/customer-portal/projects/${projectId}`);
  redirect(`/customer-portal/proposals/${id}`);
}

/**
 * DES-10-F7: governed public-portal decline. Same token scoping and audit
 * trail as the portal accept, minus the signature; the optional reason is
 * recorded with the decline. The project is deliberately left untouched.
 */
export async function declinePortalProposalAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const id = String(formData.get("proposalId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const expectedUpdatedAt = String(formData.get("expectedUpdatedAt") ?? "").trim() || undefined;
  if (reason.length > 500) {
    return { error: "Decline reason must be 500 characters or fewer." };
  }

  try {
    await customerPortalApiFetch(`/api/v1/customer-portal/proposals/${id}/decline`, {
      method: "POST",
      body: JSON.stringify({ reason: reason || undefined, expectedUpdatedAt }),
    });
  } catch (err) {
    return { error: err instanceof ApiClientError || err instanceof Error ? err.message : "Something went wrong." };
  }

  revalidatePath(`/customer-portal/proposals/${id}`);
  revalidatePath(`/customer-portal/projects/${projectId}`);
  redirect(`/customer-portal/proposals/${id}`);
}

export async function rejectProposalAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const token = await getSessionToken();
  const id = String(formData.get("proposalId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const portal = String(formData.get("portal") ?? "") === "true";

  try {
    await apiFetch(`/api/v1/proposals/${id}/reject`, { method: "POST", token: token ?? undefined });
  } catch (err) {
    return { error: err instanceof ApiClientError ? err.message : "Something went wrong." };
  }

  revalidatePath(`/projects/${projectId}/proposals/${id}`);
  if (portal) {
    redirect(`/portal/projects/${projectId}`);
  }
  redirect(`/projects/${projectId}/proposals/${id}`);
}

export async function duplicateProposalAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const token = await getSessionToken();
  const id = String(formData.get("proposalId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");

  let proposal: Proposal;
  try {
    proposal = await apiFetch<Proposal>(`/api/v1/proposals/${id}/duplicate`, {
      method: "POST",
      token: token ?? undefined,
    });
  } catch (err) {
    return { error: err instanceof ApiClientError ? err.message : "Something went wrong." };
  }

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}/proposals/${proposal.id}`);
}
