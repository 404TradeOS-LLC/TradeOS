export interface InvoicePresentationInput {
  status: string;
  paidAmount: number;
  balanceDue: number;
  dueDate: string | null;
}

export function getInvoiceDisplayStatus(invoice: InvoicePresentationInput, now = Date.now()) {
  if (invoice.status === "paid") return "paid";
  if (invoice.status === "voided" || invoice.status === "void") return "voided";
  if (invoice.balanceDue <= 0 && invoice.paidAmount > 0) return "paid";
  if (invoice.dueDate && new Date(invoice.dueDate).getTime() < now) return "overdue";
  if (invoice.paidAmount > 0) return "partially_paid";
  return invoice.status;
}

export function getInvoiceRunningBalance(invoice: Pick<InvoicePresentationInput, "balanceDue">) {
  return invoice.balanceDue;
}
