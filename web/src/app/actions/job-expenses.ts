"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch, ApiClientError, type JobExpense } from "@/lib/api";
import { dollarsToCents } from "@/lib/job-expenses";
import {
  buildExpenseReceiptPath, EXPENSE_RECEIPT_BUCKET,
  MAX_EXPENSE_RECEIPT_BYTES, validateExpenseReceiptBytes,
} from "@/lib/job-expense-receipts";
import { getSessionToken } from "@/lib/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type JobExpenseActionState = { error?: string } | undefined;

const CATEGORIES = new Set(["labor", "material", "equipment", "disposal", "subcontractor", "other"]);
const PAYERS = new Set(["contractor", "customer"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRealCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function validateExpenseForm(formData: FormData) {
  const jobId = String(formData.get("jobId") ?? "").trim();
  const expenseId = String(formData.get("expenseId") ?? "").trim();
  const amountCents = dollarsToCents(String(formData.get("amount") ?? ""));
  const category = String(formData.get("category") ?? "").trim();
  const paymentResponsibility = String(formData.get("paymentResponsibility") ?? "contractor").trim();
  const vendor = String(formData.get("vendor") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const receiptNote = String(formData.get("receiptNote") ?? "").trim();
  const incurredOn = String(formData.get("incurredOn") ?? "").trim();
  if (!UUID.test(jobId)) return { error: "Choose a valid job." } as const;
  if (expenseId && !UUID.test(expenseId)) return { error: "Invalid expense." } as const;
  if (amountCents === null || amountCents > 2147483647) return { error: "Enter an amount between $0.01 and $21,474,836.47." } as const;
  if (!CATEGORIES.has(category)) return { error: "Choose a valid expense category." } as const;
  if (!PAYERS.has(paymentResponsibility)) return { error: "Choose who paid." } as const;
  if (vendor.length > 200 || description.length > 2000 || receiptNote.length > 2000) {
    return { error: "The description, receipt note, or vendor exceeds the field limit." } as const;
  }
  if (!isRealCalendarDate(incurredOn)) return { error: "Choose a valid incurred date." } as const;
  return {
    jobId, expenseId, amountCents, category,
    paymentResponsibility, vendor, description, receiptNote, incurredOn,
  };
}

function updatedJob(jobId: string): never {
  revalidatePath("/field");
  redirect(`/field?job=${encodeURIComponent(jobId)}&updated=1`);
}

export async function addJobExpenseAction(_previous: JobExpenseActionState, formData: FormData): Promise<JobExpenseActionState> {
  const token = await getSessionToken();
  if (!token) return { error: "Authentication is required." };
  const values = validateExpenseForm(formData);
  if ("error" in values) return { error: values.error };
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "").trim();
  if (!UUID.test(idempotencyKey)) return { error: "Please reload the form before saving." };

  const providedFile = formData.get("receipt");
  const receipt = providedFile instanceof File && providedFile.size > 0 ? providedFile : null;
  let bytes: Uint8Array | null = null;
  let receiptMetadata: ReturnType<typeof validateExpenseReceiptBytes> | null = null;
  if (receipt) {
    if (receipt.size > MAX_EXPENSE_RECEIPT_BYTES) return { error: "Receipts must be 4 MB or smaller." };
    try {
      bytes = new Uint8Array(await receipt.arrayBuffer());
      receiptMetadata = validateExpenseReceiptBytes(receipt.name, receipt.type, bytes);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Invalid receipt." };
    }
  }

  let expense: JobExpense;
  try {
    expense = await apiFetch<JobExpense>(`/api/v1/jobs/${values.jobId}/expenses`, {
      method: "POST", token,
      body: JSON.stringify({
        amountCents: values.amountCents, currency: "USD", idempotencyKey,
        category: values.category, paymentResponsibility: values.paymentResponsibility,
        description: values.description, vendor: values.vendor,
        receiptNote: values.receiptNote, incurredOn: values.incurredOn,
      }),
    });
  } catch (error) {
    return { error: error instanceof ApiClientError ? error.message : "Unable to save this expense." };
  }

  if (receipt && bytes && receiptMetadata && !expense.receiptStoragePath) {
    // The expense is already authenticated and scoped by the API above before
    // this privileged Storage client is created. No browser gets the key.
    let path: string;
    try {
      path = buildExpenseReceiptPath(
        expense.orgId, values.jobId, expense.id,
        receiptMetadata.contentType, crypto.randomUUID(),
      );
      const { error } = await createSupabaseAdminClient().storage.from(EXPENSE_RECEIPT_BUCKET).upload(path, bytes, {
        contentType: receiptMetadata.contentType, upsert: false,
      });
      if (error) throw new Error(error.message);
    } catch {
      return { error: "Expense saved, but receipt upload failed. Retry this form to attach the receipt without duplicating the expense." };
    }
    try {
      await apiFetch(`/api/v1/jobs/${values.jobId}/expenses/${expense.id}/receipt`, {
        method: "POST", token,
        body: JSON.stringify({
          receiptStoragePath: path, receiptFileName: receiptMetadata.fileName,
          receiptContentType: receiptMetadata.contentType, receiptSizeBytes: receiptMetadata.sizeBytes,
        }),
      });
    } catch {
      // The API may have committed the metadata despite a network error. Do not
      // delete the uploaded object; that would break a committed receipt link.
      return { error: "Expense saved; receipt confirmation is uncertain. Retry this form to check and finish attaching the receipt." };
    }
  }
  updatedJob(values.jobId);
}

export async function updateJobExpenseAction(_previous: JobExpenseActionState, formData: FormData): Promise<JobExpenseActionState> {
  const token = await getSessionToken();
  if (!token) return { error: "Authentication is required." };
  const values = validateExpenseForm(formData);
  if ("error" in values) return { error: values.error };
  if (!values.expenseId) return { error: "Choose an expense to edit." };
  try {
    await apiFetch(`/api/v1/jobs/${values.jobId}/expenses/${values.expenseId}`, {
      method: "PATCH", token,
      body: JSON.stringify({
        amountCents: values.amountCents, category: values.category,
        paymentResponsibility: values.paymentResponsibility, description: values.description,
        vendor: values.vendor, receiptNote: values.receiptNote, incurredOn: values.incurredOn,
      }),
    });
  } catch (error) {
    return { error: error instanceof ApiClientError ? error.message : "Unable to update expense." };
  }
  updatedJob(values.jobId);
}

export async function voidJobExpenseAction(_previous: JobExpenseActionState, formData: FormData): Promise<JobExpenseActionState> {
  const token = await getSessionToken();
  if (!token) return { error: "Authentication is required." };
  const jobId = String(formData.get("jobId") ?? "");
  const expenseId = String(formData.get("expenseId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!UUID.test(jobId) || !UUID.test(expenseId)) return { error: "Invalid job or expense." };
  if (reason.length > 500) return { error: "Reason must be at most 500 characters." };
  try {
    await apiFetch(`/api/v1/jobs/${jobId}/expenses/${expenseId}`, {
      method: "DELETE", token, body: JSON.stringify({ reason }),
    });
  } catch (error) {
    return { error: error instanceof ApiClientError ? error.message : "Unable to void expense." };
  }
  updatedJob(jobId);
}
