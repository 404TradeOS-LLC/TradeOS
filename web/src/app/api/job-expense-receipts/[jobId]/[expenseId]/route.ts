import { ApiClientError, apiFetch, type JobExpense } from "@/lib/api";
import {
  EXPENSE_RECEIPT_BUCKET, isExpenseReceiptPath, MAX_EXPENSE_RECEIPT_BYTES,
} from "@/lib/job-expense-receipts";
import { getSessionToken } from "@/lib/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string; expenseId: string }> },
) {
  const { jobId, expenseId } = await params;
  if (!UUID.test(jobId) || !UUID.test(expenseId)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const token = await getSessionToken();
  if (!token) return Response.json({ error: "Not authenticated" }, { status: 401 });

  let expense: JobExpense;
  try {
    // The API must verify expenseId, jobId AND the authenticated org before
    // service-role Storage can be accessed. Never trust a URL path alone.
    expense = await apiFetch<JobExpense>(`/api/v1/jobs/${jobId}/expenses/${expenseId}`, { token });
  } catch (error) {
    if (error instanceof ApiClientError && [401, 403, 404].includes(error.status)) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    throw error;
  }
  if (expense.id !== expenseId || expense.jobId !== jobId || !expense.receiptStoragePath ||
      !expense.receiptContentType || !expense.receiptFileName || !expense.receiptSizeBytes ||
      !isExpenseReceiptPath(
        expense.orgId, jobId, expenseId, expense.receiptContentType, expense.receiptStoragePath,
      )) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await createSupabaseAdminClient()
    .storage.from(EXPENSE_RECEIPT_BUCKET).download(expense.receiptStoragePath);
  if (error || !data || data.size < 1 || data.size > MAX_EXPENSE_RECEIPT_BYTES ||
      data.size !== expense.receiptSizeBytes) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return new Response(data.stream(), {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(expense.receiptFileName).replaceAll("'", "%27")}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, no-store",
    },
  });
}
