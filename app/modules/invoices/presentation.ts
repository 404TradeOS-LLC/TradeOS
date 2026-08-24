import { Prisma } from "@prisma/client";
import { normalizeInvoiceStatus } from "../../domain/contracts";
import { InvoicePaymentDTO } from "./types";

export interface InvoicePaymentRecord {
  id: string;
  amount: unknown;
  paymentDate: Date;
  method: string;
  createdAt: Date;
}

export interface InvoiceFinancials {
  paidAmount: number;
  balanceDue: number;
}

/**
 * Derives customer-facing invoice financials from the persisted invoice
 * amount and already-recorded payment rows.
 */
export function calculateInvoiceFinancials(amount: unknown, status: string, payments: readonly Pick<InvoicePaymentRecord, "amount">[]): InvoiceFinancials {
  const paidTotal = payments.reduce((sum, payment) => sum.add(new Prisma.Decimal(String(payment.amount))), new Prisma.Decimal(0));
  const paidAmount = Number(paidTotal.toFixed(2));
  const normalizedStatus = normalizeInvoiceStatus(status);
  const balanceDue = new Prisma.Decimal(String(amount)).sub(paidTotal);

  return {
    paidAmount,
    // Persisted paid is authoritative even when the internal mark-paid path
    // has no corresponding Payment row. A non-zero recorded payment can also
    // fully cover a zero-dollar invoice; otherwise zero-dollar draft/sent
    // invoices retain their persisted state. Presentation never exposes a
    // negative balance, while the underlying payment/accounting rows remain
    // unchanged.
    balanceDue: normalizedStatus === "paid" ? 0 : Math.max(0, Number(balanceDue.toFixed(2))),
  };
}

export function toInvoicePaymentDTO(row: InvoicePaymentRecord): InvoicePaymentDTO {
  return {
    id: row.id,
    amount: Number(row.amount),
    paymentDate: row.paymentDate,
    method: row.method,
    createdAt: row.createdAt,
  };
}
