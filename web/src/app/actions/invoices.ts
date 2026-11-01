"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { apiFetch, ApiClientError, Invoice } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import { FormActionState } from "./customers";
import {
  parseManualLineItems,
  scaleManualLinesForProgress,
  type ManualInvoiceLine,
} from "./manual-invoice-lines";

export async function createInvoiceAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const token = await getSessionToken();
  const projectId = String(formData.get("projectId") ?? "");
  const estimateId = String(formData.get("estimateId") ?? "");
  const proposalId = String(formData.get("proposalId") ?? "").trim();
  const type = String(formData.get("type") ?? "full");
  const percentComplete = String(formData.get("percentComplete") ?? "").trim();
  const dueDate = String(formData.get("dueDate") ?? "").trim();

  if (type === "progress" && !percentComplete) return { error: "Enter a percent complete for a progress invoice." };

  // With no estimate selected, the invoice is built from manually entered
  // line items. The backend already accepts direct lineItems without an
  // estimateId (it throws only when both are absent), so the estimate path
  // below is unchanged and this branch only adds the manual path. The
  // parsing itself lives in manual-invoice-lines.ts, where it is executed
  // directly by tests instead of only shape-pinned here.
  let lineItems: ManualInvoiceLine[] | undefined;
  if (!estimateId) {
    const parsed = parseManualLineItems(formData);
    if ("error" in parsed) return { error: parsed.error };
    lineItems = scaleManualLinesForProgress(parsed.lines, type, percentComplete);
  }

  let invoice: Invoice;
  try {
    invoice = await apiFetch<Invoice>("/api/v1/invoices", {
      method: "POST",
      token: token ?? undefined,
      body: JSON.stringify({
        projectId,
        estimateId: estimateId || undefined,
        proposalId: estimateId && proposalId ? proposalId : undefined,
        type,
        percentComplete: type === "progress" ? Number(percentComplete) : undefined,
        dueDate: dueDate || undefined,
        lineItems,
      }),
    });
  } catch (err) {
    return { error: err instanceof ApiClientError ? err.message : "Something went wrong." };
  }

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}/invoices/${invoice.id}`);
}

export async function updateInvoiceAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const token = await getSessionToken();
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const dueDate = String(formData.get("dueDate") ?? "").trim();
  const editMode = String(formData.get("editMode") ?? "");

  // Line editing is offered only for manual full drafts (see the edit
  // form); progress and estimate-linked drafts submit due-date-only edits,
  // and the backend 409s any line replacement on those invoices regardless
  // of what a crafted submission claims. Full invoices need no progress
  // scaling, so the parsed lines post as-is.
  let lineItems: ManualInvoiceLine[] | undefined;
  if (editMode === "lines") {
    const parsed = parseManualLineItems(formData);
    if ("error" in parsed) return { error: parsed.error };
    lineItems = parsed.lines;
  }

  try {
    await apiFetch(`/api/v1/invoices/${invoiceId}`, {
      method: "PATCH",
      token: token ?? undefined,
      body: JSON.stringify({
        lineItems,
        dueDate: dueDate || null,
      }),
    });
  } catch (err) {
    return { error: err instanceof ApiClientError ? err.message : "Something went wrong." };
  }

  revalidatePath(`/projects/${projectId}/invoices/${invoiceId}`);
  redirect(`/projects/${projectId}/invoices/${invoiceId}`);
}

export async function sendInvoiceAction(formData: FormData): Promise<void> {
  const token = await getSessionToken();
  const id = String(formData.get("invoiceId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");

  await apiFetch(`/api/v1/invoices/${id}/send`, { method: "POST", token: token ?? undefined });

  revalidatePath(`/projects/${projectId}/invoices/${id}`);
  redirect(`/projects/${projectId}/invoices/${id}`);
}

export async function markInvoicePaidAction(formData: FormData): Promise<void> {
  const token = await getSessionToken();
  const id = String(formData.get("invoiceId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");

  await apiFetch(`/api/v1/invoices/${id}/mark-paid`, { method: "POST", token: token ?? undefined });

  revalidatePath(`/projects/${projectId}/invoices/${id}`);
  redirect(`/projects/${projectId}/invoices/${id}`);
}

export async function recordInvoicePaymentAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const token = await getSessionToken();
  const id = String(formData.get("invoiceId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const paymentDate = String(formData.get("paymentDate") ?? "").trim();
  const method = String(formData.get("method") ?? "").trim();
  const reference = String(formData.get("reference") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const amount = Number(amountRaw);

  if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter a payment amount greater than zero." };
  if (!paymentDate) return { error: "Choose the payment date." };
  if (!method) return { error: "Choose a payment method." };

  try {
    await apiFetch(`/api/v1/invoices/${id}/payments`, {
      method: "POST",
      token: token ?? undefined,
      body: JSON.stringify({
        amount,
        paymentDate: `${paymentDate}T00:00:00.000Z`,
        method,
        reference: reference || undefined,
        notes: notes || undefined,
      }),
    });
  } catch (err) {
    return { error: err instanceof ApiClientError ? err.message : "Something went wrong." };
  }

  revalidatePath(`/projects/${projectId}/invoices/${id}`);
  redirect(`/projects/${projectId}/invoices/${id}`);
}

export async function voidInvoiceAction(formData: FormData): Promise<void> {
  const token = await getSessionToken();
  const id = String(formData.get("invoiceId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");

  await apiFetch(`/api/v1/invoices/${id}/void`, { method: "POST", token: token ?? undefined });

  revalidatePath(`/projects/${projectId}/invoices/${id}`);
  redirect(`/projects/${projectId}/invoices/${id}`);
}
