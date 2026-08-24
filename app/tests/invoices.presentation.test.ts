import { calculateInvoiceFinancials } from "../modules/invoices/presentation";

describe("invoice presentation financials", () => {
  it("sums recorded Decimal payment values without binary floating-point drift", () => {
    expect(calculateInvoiceFinancials("1.00", "sent", [{ amount: "0.10" }, { amount: "0.20" }])).toEqual({
      paidAmount: 0.3,
      balanceDue: 0.7,
    });
  });

  it("keeps persisted paid authoritative when no payment row exists", () => {
    expect(calculateInvoiceFinancials("500.00", "paid", [])).toEqual({ paidAmount: 0, balanceDue: 0 });
  });

  it("does not label a zero-dollar draft as paid or expose a negative balance", () => {
    expect(calculateInvoiceFinancials("0.00", "draft", [])).toEqual({ paidAmount: 0, balanceDue: 0 });
  });

  it("clamps an overpayment to a zero presentation balance without changing recorded totals", () => {
    expect(calculateInvoiceFinancials("100.00", "void", [{ amount: "125.00" }])).toEqual({
      paidAmount: 125,
      balanceDue: 0,
    });
  });
});
