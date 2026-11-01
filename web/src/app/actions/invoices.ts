"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { apiFetch, ApiClientError, Invoice } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import { FormActionState } from "./customers";

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
  // below is unchanged and this branch only adds the manual path.
  let lineItems: Array<{ description: string; quantity: number; unitOfMeasure: string; unitPrice: number }> | undefined;
  if (!estimateId) {
    const lineCount = Number(String(formData.get("lineCount") ?? "0"));
    if (!Number.isFinite(lineCount) || lineCount > 100) return { error: "Add at least one line item for a manual invoice." };
    const parsed: Array<{ description: string; quantity: number; unitOfMeasure: string; unitPrice: number }> = [];
    for (let index = 0; index < lineCount; index += 1) {
      const description = String(formData.get(`lineDescription${index}`) ?? "").trim();
      const quantityRaw = String(formData.get(`lineQuantity${index}`) ?? "").trim();
      const unitPriceRaw = String(formData.get(`lineUnitPrice${index}`) ?? "").trim();
      if (!description && !quantityRaw && !unitPriceRaw) continue;
      const quantity = Number(quantityRaw);
      const unitPrice = Number(unitPriceRaw);
      if (!description || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
        return { error: "Enter a description, a quantity greater than zero, and a unit price of zero or more for each line item." };
      }
      parsed.push({ description, quantity, unitOfMeasure: "each", unitPrice });
    }
    if (parsed.length === 0) return { error: "Add at least one line item for a manual invoice." };
    lineItems = parsed;
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
