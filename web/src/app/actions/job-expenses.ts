"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch, ApiClientError } from "@/lib/api";
import { dollarsToCents } from "@/lib/job-expenses";
import { getSessionToken } from "@/lib/session";

export type JobExpenseActionState = { error?: string } | undefined;

const CATEGORIES = new Set(["labor", "material", "equipment", "disposal", "subcontractor", "other"]);

function isRealCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export async function addJobExpenseAction(_previous: JobExpenseActionState, formData: FormData): Promise<JobExpenseActionState> {
  const token = await getSessionToken();
  const jobId = String(formData.get("jobId") ?? "").trim();
  const amountCents = dollarsToCents(String(formData.get("amount") ?? ""));
  const category = String(formData.get("category") ?? "").trim();
  const paymentResponsibility = String(formData.get("paymentResponsibility") ?? "contractor").trim();
  const vendor = String(formData.get("vendor") ?? "").trim();
  const receiptNote = String(formData.get("receiptNote") ?? "").trim();
  const incurredOn = String(formData.get("incurredOn") ?? "").trim();

  if (!token) return { error: "Authentication is required." };
  if (!jobId) return { error: "A job is required before recording a cost." };
  if (amountCents === null) return { error: "Enter an amount greater than $0 with at most two decimal places." };
  if (!CATEGORIES.has(category)) return { error: "Choose a valid cost category." };
  if (!["contractor", "customer"].includes(paymentResponsibility)) return { error: "Choose who paid for this expense." };
  if (vendor.length > 200) return { error: "Keep the vendor to 200 characters or fewer." };
  if (receiptNote.length > 2000) return { error: "Keep the receipt note to 2,000 characters or fewer." };
  if (!isRealCalendarDate(incurredOn)) return { error: "Choose the date the cost was incurred." };

  try {
    await apiFetch(`/api/v1/jobs/${jobId}/expenses`, {
      method: "POST",
      token,
      body: JSON.stringify({ amountCents, category, paymentResponsibility, vendor, receiptNote, incurredOn }),
    });
  } catch (error) {
    return { error: error instanceof ApiClientError ? error.message : "Unable to save this expense." };
  }

  revalidatePath("/field");
  redirect(`/field?job=${encodeURIComponent(jobId)}&updated=1`);
}
