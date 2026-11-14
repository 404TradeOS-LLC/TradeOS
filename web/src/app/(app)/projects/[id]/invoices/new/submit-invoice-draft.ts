type Result = { invoiceId: string } | { error: string; unconfirmed?: boolean };
export interface InvoiceAttempt { data: FormData; unconfirmed: boolean }

/** Retain one mounted form's exact submission, including its request key. */
export async function submitInvoiceDraft(
  retained: { current: InvoiceAttempt | null },
  incoming: FormData,
  send: (data: FormData) => Promise<Result>,
): Promise<Result> {
  const attempt = retained.current ?? { data: incoming, unconfirmed: false };
  retained.current = attempt;
  let result: Result;
  try {
    result = await send(attempt.data);
  } catch {
    // The browser may lose the server-action response after the API commits.
    result = { error: "Could not confirm whether the draft was saved.", unconfirmed: true };
  }
  if ("invoiceId" in result) {
    retained.current = null;
    return result;
  }
  if (attempt.unconfirmed || result.unconfirmed) {
    attempt.unconfirmed = true;
    return { ...result, unconfirmed: true };
  }
  retained.current = null;
  return result;
}
