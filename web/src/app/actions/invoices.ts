"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { apiFetch, ApiClientError, Invoice } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import { FormActionState } from "./customers";

type ManualInvoiceLine = {
  description: string;
  quantity: number;
  unitOfMeasure: string;
  unitPrice: number;
  lineTotal?: number;
};

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// Mirrors the estimate path in app/modules/invoices/service.ts
// (resolveLineItems): a progress invoice scales quantities by
// percentComplete/100 and scales the total with them. Manual lines get the
// same treatment so a progress invoice never persists full-priced lines
// marked partially complete. Line totals are rounded to cents with the
// rounding residual carried on the largest line, so the lines sum exactly
// to the invoice total. Full invoices and invalid percentages pass through
// untouched (the backend remains the backstop for percent validation).
function scaleManualLinesForProgress(lines: ManualInvoiceLine[], type: string, percentComplete: string): ManualInvoiceLine[] {
  if (type !== "progress") return lines;
  const scale = Number(percentComplete) / 100;
  if (!Number.isFinite(scale) || scale <= 0 || scale > 1) return lines;
  const scaled = lines.map((line) => {
    const quantity = line.quantity * scale;
    return { ...line, quantity, lineTotal: roundCurrency(quantity * line.unitPrice) };
  });
  const amount = roundCurrency(scaled.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
  const roundedTotal = roundCurrency(scaled.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0));
  const residual = roundCurrency(amount - roundedTotal);
  if (residual !== 0) {
    let largestIndex = 0;
    scaled.forEach((line, index) => {
      if ((line.lineTotal ?? 0) > (scaled[largestIndex].lineTotal ?? 0)) largestIndex = index;
    });
    scaled[largestIndex] = {
      ...scaled[largestIndex],
      lineTotal: roundCurrency((scaled[largestIndex].lineTotal ?? 0) + residual),
    };
  }
  return scaled;
}

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
  let lineItems: ManualInvoiceLine[] | undefined;
  if (!estimateId) {
    const lineCount = Number(String(formData.get("lineCount") ?? "0"));
    if (!Number.isFinite(lineCount) || lineCount > 100) return { error: "Add at least one line item for a manual invoice." };
    const parsed: ManualInvoiceLine[] = [];
    for (let index = 0; index < lineCount; index += 1) {
      const description = String(formData.get(`lineDescription${index}`) ?? "").trim();
      const quantityRaw = String(formData.get(`lineQuantity${index}`) ?? "").trim();
      const unitPriceRaw = String(formData.get(`lineUnitPrice${index}`) ?? "").trim();
      if (!description && !quantityRaw && !unitPriceRaw) continue;
      const quantity = Number(quantityRaw);
      const unitPrice = Number(unitPriceRaw);
      // A blank unit price must not convert via Number("") to 0 and slip
      // through as a silent zero-priced line. An explicit "0" stays allowed:
      // unitPriceRaw "0" is truthy, so only a genuinely blank price is
      // rejected here.
      if (!description || !unitPriceRaw || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
        return { error: "Enter a description, a quantity greater than zero, and a unit price of zero or more for each line item." };
      }
      parsed.push({ description, quantity, unitOfMeasure: "each", unitPrice });
    }
    if (parsed.length === 0) return { error: "Add at least one line item for a manual invoice." };
    lineItems = scaleManualLinesForProgress(parsed, type, percentComplete);
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
