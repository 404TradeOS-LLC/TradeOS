import "server-only";
import { apiFetch } from "@/lib/api";

export interface PaymentLedgerEntry {
  id: string;
  invoiceId: string;
  amount: number;
  paymentDate: string;
  method: string;
  status: string;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  invoice: {
    id: string;
    invoiceNumber: number;
    amount: number;
    status: string;
    project: {
      id: string;
      name: string;
      customer: {
        id: string;
        name: string;
      } | null;
    };
  };
}

export interface CurrentWeekPaymentLedger {
  period: "current_week";
  timezone: {
    timezone: string;
    isFallback: boolean;
  };
  rangeUtc: {
    start: string;
    end: string;
  };
  totalAmount: number;
  paymentCount: number;
  payments: PaymentLedgerEntry[];
}

export function getCurrentWeekPaymentLedger(token: string) {
  return apiFetch<CurrentWeekPaymentLedger>("/api/v1/payments/current-week", { token });
}
