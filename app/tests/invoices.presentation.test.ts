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
});
