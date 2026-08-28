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

  if (!estimateId) return { error: "Select an estimate to bill against." };
  if (type === "progress" && !percentComplete) return { error: "Enter a percent complete for a progress invoice." };

  let invoice: Invoice;
  try {
    invoice = await apiFetch<Invoice>("/api/v1/invoices", {
      method: "POST",
      token: token ?? undefined,
      body: JSON.stringify({
        projectId,
        estimateId,
        proposalId: proposalId || undefined,
        type,
        percentComplete: type === "progress" ? Number(percentComplete) : undefined,
        dueDate: dueDate || undefined,
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
