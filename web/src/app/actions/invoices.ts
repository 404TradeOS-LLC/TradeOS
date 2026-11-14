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
import { parseInvoiceDueDate } from "./invoice-due-date";

export type CreateInvoiceResult = { invoiceId: string } | { error: string; unconfirmed?: boolean };

export async function createInvoiceAction(formData: FormData): Promise<CreateInvoiceResult> {
  const token = await getSessionToken();
  const projectId = String(formData.get("projectId") ?? "");
  const key = String(formData.get("createRequestKey") ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) {
    return { error: "Refresh this form before creating an invoice." };
  }
  const estimateId = String(formData.get("estimateId") ?? "");
  const proposalId = String(formData.get("proposalId") ?? "").trim();
  const type = String(formData.get("type") ?? "full");
  const percentComplete = String(formData.get("percentComplete") ?? "").trim();
  const parsedDueDate = parseInvoiceDueDate(String(formData.get("dueDate") ?? ""));
  if ("error" in parsedDueDate) return { error: parsedDueDate.error };
  const dueDate = parsedDueDate.date ?? "";

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
    invoice = await apiFetch<Invoice>("/api/v1/invoices/drafts", {
      method: "POST",
      token: token ?? undefined,
      headers: { "Idempotency-Key": key },
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
    if (err instanceof ApiClientError && [400, 401, 403, 404, 422].includes(err.status)) return { error: err.message };
    if (err instanceof ApiClientError && err.status === 409) return { error: err.message, unconfirmed: true };
    return { error: "Could not confirm whether the draft was saved.", unconfirmed: true };
  }

  if (!invoice?.id || invoice.projectId !== projectId) {
    return { error: "Could not confirm whether the draft was saved.", unconfirmed: true };
  }
  revalidatePath(`/projects/${projectId}`);
  return { invoiceId: invoice.id };
}

export async function updateInvoiceAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const token = await getSessionToken();
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const parsedDueDate = parseInvoiceDueDate(String(formData.get("dueDate") ?? ""));
  if ("error" in parsedDueDate) return { error: parsedDueDate.error };
  const dueDate = parsedDueDate.date ?? "";
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
