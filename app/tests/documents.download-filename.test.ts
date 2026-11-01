import { validateHeaderValue } from "node:http";
import { sanitizeDownloadFilename } from "../modules/documents/format";

describe("sanitizeDownloadFilename", () => {
  it("replaces an em-dash with a hyphen", () => {
    expect(sanitizeDownloadFilename("invoice-condo-two-—-renovation-1.pdf")).toBe(
      "invoice-condo-two---renovation-1.pdf"
    );
  });

  it("replaces curly quotes and emoji with hyphens", () => {
    expect(sanitizeDownloadFilename("proposal-“big”-job-🏠.pdf")).toBe("proposal--big--job---.pdf");
  });

  it("leaves printable ASCII untouched", () => {
    expect(sanitizeDownloadFilename("invoice-test-project-1.pdf")).toBe("invoice-test-project-1.pdf");
    expect(sanitizeDownloadFilename("contract-smith-&-co.pdf")).toBe("contract-smith-&-co.pdf");
  });

  it("produces a header value Node accepts for the production project name", () => {
    const raw = `invoice-${"Condo Two — Renovation & Punch List".replace(/\s+/g, "-").toLowerCase()}-1.pdf`;
    expect(() => validateHeaderValue("Content-Disposition", `attachment; filename="${raw}"`)).toThrow();
    const sanitized = sanitizeDownloadFilename(raw);
    expect(sanitized).toBe("invoice-condo-two---renovation-&-punch-list-1.pdf");
    expect(() =>
      validateHeaderValue("Content-Disposition", `attachment; filename="${sanitized}"`)
    ).not.toThrow();
  });

  it("produces a header value Node accepts for the staging project name", () => {
    const raw = `invoice-${"TEST Project — Delete Me".replace(/\s+/g, "-").toLowerCase()}-1.pdf`;
    const sanitized = sanitizeDownloadFilename(raw);
    expect(sanitized).toBe("invoice-test-project---delete-me-1.pdf");
    expect(() =>
      validateHeaderValue("Content-Disposition", `attachment; filename="${sanitized}"`)
    ).not.toThrow();
  });
});
