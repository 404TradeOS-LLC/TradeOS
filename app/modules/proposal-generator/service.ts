import PDFDocument from "pdfkit";
import { drawValidatedPdfLogo, isDecodablePngImage, validatePdfLogoBytes } from "../documents/pdf-logo";
import { prisma } from "../../db/client";
import { ApiError } from "../../backend/middleware/errorHandler";
import { getDocumentBrand } from "../documents/branding";
import { loadOrganizationPdfLogo } from "../documents/pdf-logo-storage";
import { isValidSignatureDataUrl } from "../proposals/signatureValidation";
import type { DocumentFrameBrand } from "../documents/frame";
import { formatDocumentCurrency, formatDocumentDate, formatDocumentNumber } from "../documents/format";
import { GenerateProjectProposalInput, GenerateProposalInput, ProposalAcceptance, ProposalDocument } from "./types";

const DEFAULT_TERMS =
  "This proposal is valid for 30 days from the date issued. A deposit may be required to secure labor and materials. Any changes to the scope of work described in this proposal will be documented and priced separately before additional work proceeds.";

const BRAND = {
  ink: "#0f172a",
  muted: "#475569",
  line: "#cbd5e1",
  accent: "#c2410c",
  soft: "#fff7ed",
  panel: "#f8fafc",
};

export class ProposalGeneratorService {
  async generateProposal(input: GenerateProposalInput): Promise<ProposalDocument> {
    const estimate = await prisma.estimate.findFirst({
      where: { id: input.estimateId, orgId: input.orgId },
      include: {
        lineItems: { orderBy: { sortOrder: "asc" } },
        project: { include: { customer: true, organization: true } },
      },
    });
    if (!estimate) throw new ApiError(404, `Estimate ${input.estimateId} not found`);

    const brand = await getDocumentBrand(input.orgId, input.companyName ?? estimate.project.organization?.name ?? "Your Company Name");
    const logoImage = await loadOrganizationPdfLogo(input.orgId);
    const buffer = await renderEstimateProposalPdf(estimate, {
      brand,
      logoImage,
      showLineItemDetail: input.showLineItemDetail ?? false,
      termsAndConditions: input.termsAndConditions ?? DEFAULT_TERMS,
      scopeOfWork: input.scopeOfWork,
      assumptions: input.assumptions,
      exclusions: input.exclusions,
      timeline: input.timeline,
      priceLow: input.priceLow,
      priceHigh: input.priceHigh,
      finalPrice: input.finalPrice,
      paymentScheduleJson: input.paymentScheduleJson,
      acceptance: input.acceptance,
    });

    return {
      buffer,
      filename: `proposal-${estimate.project.name.replace(/\s+/g, "-").toLowerCase()}-v${estimate.version}.pdf`,
      contentType: "application/pdf",
    };
  }

  async generateProjectProposal(input: GenerateProjectProposalInput): Promise<ProposalDocument> {
    const proposal = await prisma.proposal.findFirst({
      where: { id: input.proposalId, project: input.orgId ? { orgId: input.orgId } : undefined },
      include: {
        project: {
          include: {
            organization: true,
            customer: true,
          },
        },
      },
    });
    if (!proposal) throw new ApiError(404, `Proposal ${input.proposalId} not found`);

    const brand = await getDocumentBrand(input.orgId, proposal.companyName ?? proposal.project.organization?.name ?? "Your Company Name");
    const logoImage = await loadOrganizationPdfLogo(input.orgId);
    const buffer = await renderProjectProposalPdf(proposal, brand, logoImage);
    return {
      buffer,
      filename: `proposal-${proposal.project.name.replace(/\s+/g, "-").toLowerCase()}-draft.pdf`,
      contentType: "application/pdf",
    };
  }
}

interface EstimateWithRelations {
  version: number;
  totalPrice: unknown;
  createdAt: Date;
  project: {
    name: string;
    siteAddress: string | null;
    customer: { name: string; email: string | null } | null;
    organization: { name: string; phone: string | null; email: string | null; address: string | null } | null;
  };
  lineItems: { description: string; quantity: unknown; unitOfMeasure: string; lineCost: unknown }[];
}

interface ProposalWithRelations {
  companyName: string | null;
  scopeOfWork: string | null;
  assumptions: string | null;
  exclusions: string | null;
  timeline: string | null;
  priceLow: unknown;
  priceHigh: unknown;
  finalPrice: unknown;
  paymentScheduleJson: unknown;
  termsAndConditions: string | null;
  createdAt: Date;
  signerName: string | null;
  signerEmail: string | null;
  signatureDataUrl: string | null;
  signedAt: Date | null;
  project: {
    name: string;
    siteAddress: string | null;
    customer: { name: string; email: string | null } | null;
    organization: { name: string; phone: string | null; email: string | null; address: string | null } | null;
  };
}

export function renderEstimateProposalPdf(
  estimate: EstimateWithRelations,
  opts: { brand: DocumentFrameBrand; showLineItemDetail: boolean; termsAndConditions: string; scopeOfWork?: string; assumptions?: string; exclusions?: string; timeline?: string; priceLow?: number | null; priceHigh?: number | null; finalPrice?: number | null; paymentScheduleJson?: unknown; logoImage?: Buffer | null; acceptance?: ProposalAcceptance }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 46, size: "LETTER" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const projectSummary = opts.showLineItemDetail
      ? estimate.lineItems.map((li) => `${li.description} — ${formatDocumentNumber(li.quantity)} ${li.unitOfMeasure}`).join("\n")
      : estimate.lineItems.map((li) => `• ${li.description}`).join("\n");

    drawHeader(doc, opts.brand, "Client Proposal", opts.logoImage);
    writeContactRail(doc, opts.brand);
    drawProjectMetaGrid(doc, {
      customerName: estimate.project.customer?.name ?? "Customer",
      customerEmail: estimate.project.customer?.email ?? null,
      projectName: estimate.project.name,
      projectAddress: estimate.project.siteAddress,
      dateLabel: `Issued ${formatDocumentDate(estimate.createdAt)}`,
      statusLabel: `Estimate v${estimate.version}`,
    });
    const priceRange = opts.finalPrice == null && (opts.priceLow != null || opts.priceHigh != null) ? formatPriceRange(opts.priceLow, opts.priceHigh) : null;
    const primaryPrice = opts.finalPrice != null ? formatCurrency(opts.finalPrice) : priceRange ?? "Pricing in progress";
    drawMoneyPanel(doc, {
      title: "Investment",
      primary: primaryPrice,
      secondary: opts.finalPrice != null ? "Proposal price" : priceRange ? "Proposal price range" : "Lump-sum project price",
    });
    writeTextSection(doc, "Scope of Work", opts.scopeOfWork ?? projectSummary);
    writeTextSection(doc, "Assumptions", opts.assumptions ?? "This proposal assumes currently documented site conditions and available access.");
    writeTextSection(doc, "Exclusions", opts.exclusions ?? "Exclusions will be finalized before issue.");
    writeTextSection(doc, "Estimated Timeline", opts.timeline ?? "Scheduling to be confirmed after scope approval.");
    writePaymentScheduleSection(doc, opts.paymentScheduleJson);
    writeTextSection(doc, "Pricing Notes", "This estimate is presented as a client-facing proposal and may be refined if field conditions or selections change.");
    writeTextSection(doc, "Terms & Conditions", opts.termsAndConditions);
    writeAcceptanceBlock(doc, opts.acceptance);
    drawTrustFooter(doc, opts.brand);
    doc.end();
  });
}

function formatPriceRange(low: number | null | undefined, high: number | null | undefined): string {
  const lowValue = low ?? high;
  const highValue = high ?? low;
  if (lowValue == null && highValue == null) return formatCurrency(0);
  if (lowValue == null || highValue == null || lowValue === highValue) return formatCurrency(lowValue ?? highValue ?? 0);
  return `${formatCurrency(Math.min(lowValue, highValue))}–${formatCurrency(Math.max(lowValue, highValue))}`;
}

export function renderProjectProposalPdf(proposal: ProposalWithRelations, brand: DocumentFrameBrand, logoImage?: Buffer | null): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 46, size: "LETTER" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawHeader(doc, brand, "Client Proposal Draft", logoImage);
    writeContactRail(doc, brand);
    drawProjectMetaGrid(doc, {
      customerName: proposal.project.customer?.name ?? "Customer",
      customerEmail: proposal.project.customer?.email ?? null,
      projectName: proposal.project.name,
      projectAddress: proposal.project.siteAddress,
      dateLabel: `Drafted ${formatDocumentDate(proposal.createdAt)}`,
      statusLabel: "Working proposal",
    });
    drawMoneyPanel(doc, {
      title: "Investment Snapshot",
      primary: choosePrimaryPrice(proposal),
      secondary: chooseSecondaryPrice(proposal),
    });

    writeTextSection(doc, "Project Summary", proposal.scopeOfWork ?? "Scope of work to be finalized after field verification.");
    writeTextSection(doc, "Assumptions", proposal.assumptions ?? "This draft assumes currently documented site conditions and available access.");
    writeTextSection(doc, "Exclusions", proposal.exclusions ?? "Exclusions will be finalized before issue.");
    writeTextSection(doc, "Estimated Timeline", proposal.timeline ?? "Scheduling to be confirmed after scope approval.");
    writePaymentScheduleSection(doc, proposal.paymentScheduleJson);
    writeTextSection(doc, "Terms & Conditions", proposal.termsAndConditions ?? DEFAULT_TERMS);
    writeAcceptanceBlock(doc, {
      signerName: proposal.signerName ?? null,
      signerEmail: proposal.signerEmail ?? null,
      signatureDataUrl: proposal.signatureDataUrl ?? null,
      signedAt: proposal.signedAt ?? null,
    });
    drawTrustFooter(doc, brand);
    doc.end();
  });
}

function drawHeader(doc: any, brand: DocumentFrameBrand, title: string, logoImage?: Buffer | null) {
  const { left, right } = bounds(doc);
  const headerTop = 34;
  const nameY = 54;
  const taglineY = 58;
  const nameOptions = { width: 300 };
  const titleOptions = { characterSpacing: 1.4, width: 250 };
  const taglineOptions = { width: 160, align: "right" as const };
  const label = title.toUpperCase();
  const titleY = nameY + doc.font("Helvetica-Bold").fontSize(22).heightOfString(brand.companyName, nameOptions) + 4;
  const titleBottom = titleY + doc.font("Helvetica").fontSize(11).heightOfString(label, titleOptions);
  const taglineBottom = brand.tagline
    ? taglineY + doc.fontSize(10).heightOfString(brand.tagline, taglineOptions)
    : taglineY;
  const headerBottom = Math.max(122, titleBottom + 18, taglineBottom + 18);

  doc.save();
  doc.roundedRect(left, headerTop, right - left, headerBottom - headerTop, 20).fill(brand.colors.primary);
  doc.restore();
  doc.fillColor("white").fontSize(22).font("Helvetica-Bold").text(brand.companyName, left + 18, nameY, nameOptions);
  doc.fontSize(11).font("Helvetica").fillColor(brand.colors.secondary).text(label, left + 18, titleY, titleOptions);
  const hasLogo = drawValidatedPdfLogo(doc, logoImage, { x: right - 83, y: 49, width: 52, height: 52 });
  if (!hasLogo && brand.tagline) doc.fillColor("white").fontSize(10).text(brand.tagline, right - 180, taglineY, taglineOptions);
  doc.fillColor(BRAND.ink).font("Helvetica");
  doc.x = left;
  doc.y = headerBottom + 24;
}

function writeContactRail(doc: any, brand: DocumentFrameBrand) {
  const address = [brand.addressLine1, brand.addressLine2, [brand.city, brand.state].filter(Boolean).join(", "), brand.postalCode]
    .filter(Boolean)
    .join(", ");
  const lines = [brand.phone, brand.email, brand.websiteUrl, address].filter(Boolean) as string[];
  if (lines.length === 0) return;
  doc.fontSize(9).fillColor(BRAND.muted).text(lines.join("   •   "), { align: "left" });
  doc.fillColor(BRAND.ink);
  doc.moveDown(1);
}

function drawProjectMetaGrid(
  doc: any,
  data: {
    customerName: string;
    customerEmail: string | null;
    projectName: string;
    projectAddress: string | null;
    dateLabel: string;
    statusLabel: string;
  }
) {
  const { left, right } = bounds(doc);
  const gap = 12;
  const boxWidth = (right - left - gap) / 2;
  const customerLines = [data.customerName, data.customerEmail].filter(Boolean).map((line) => normalizeLineBreaks(line!));
  const projectLines = [data.projectName, data.projectAddress ?? "No address saved"].map(normalizeLineBreaks);
  doc.font("Helvetica").fontSize(11);
  const cardHeight = (lines: string[]) => Math.max(84, 32 + lines.reduce(
    (height, line) => height + doc.heightOfString(line, { width: boxWidth - 28 }) + 6, 0
  ) + 8);
  const boxHeight = Math.max(cardHeight(customerLines), cardHeight(projectLines));
  ensureSpace(doc, boxHeight + 40);
  const top = doc.y;

  drawInfoCard(doc, left, top, boxWidth, boxHeight, "Customer", customerLines);
  drawInfoCard(doc, left + boxWidth + gap, top, boxWidth, boxHeight, "Project", projectLines);
  doc.y = top + boxHeight + 12;
  doc.fontSize(9).fillColor(BRAND.muted).text(`${data.dateLabel}   •   ${data.statusLabel}`);
  doc.fillColor(BRAND.ink);
  doc.moveDown(1.2);
}

function drawInfoCard(doc: any, x: number, y: number, width: number, height: number, title: string, lines: string[]) {
  doc.save();
  doc.roundedRect(x, y, width, height, 14).fill(BRAND.panel);
  doc.roundedRect(x, y, width, height, 14).stroke(BRAND.line);
  doc.restore();
  doc.font("Helvetica-Bold").fontSize(9).fillColor(BRAND.accent).text(title.toUpperCase(), x + 14, y + 12, {
    characterSpacing: 1.3,
  });
  doc.font("Helvetica").fontSize(11).fillColor(BRAND.ink);
  let cursorY = y + 32;
  for (const line of lines) {
    doc.text(line, x + 14, cursorY, { width: width - 28 });
    cursorY = doc.y + 6;
  }
}

function drawMoneyPanel(doc: any, input: { title: string; primary: string; secondary: string }) {
  const { left, right } = bounds(doc);
  const y = doc.y;
  doc.save();
  doc.roundedRect(left, y, right - left, 74, 16).fill(BRAND.soft);
  doc.roundedRect(left, y, right - left, 74, 16).stroke("#fdba74");
  doc.restore();
  doc.font("Helvetica-Bold").fontSize(10).fillColor(BRAND.accent).text(input.title.toUpperCase(), left + 16, y + 12, {
    characterSpacing: 1.4,
  });
  doc.fontSize(24).fillColor(BRAND.ink).text(input.primary, left + 16, y + 30);
  doc.font("Helvetica").fontSize(10).fillColor(BRAND.muted).text(input.secondary, left + 16, y + 58);
  doc.fillColor(BRAND.ink);
  doc.y = y + 92;
}

function writeTextSection(doc: any, title: string, content: string) {
  const normalized = normalizeLineBreaks(content).trim();
  if (!normalized) return;
  ensureSpace(doc, 120);
  doc.font("Helvetica-Bold").fontSize(12).fillColor(BRAND.ink).text(title);
  doc.moveDown(0.35);
  doc.save();
  doc.roundedRect(doc.page.margins.left, doc.y, doc.page.width - doc.page.margins.left - doc.page.margins.right, 2, 1).fill(BRAND.line);
  doc.restore();
  doc.moveDown(0.55);
  doc.font("Helvetica").fontSize(10.5).fillColor(BRAND.ink).text(normalized, {
    lineGap: 3,
    align: "left",
  });
  doc.moveDown(1.1);
}

function normalizeLineBreaks(text: string): string {
  // PDFKit splits on LF; raw CR and Unicode paragraph separators otherwise
  // enter the standard-font hex text operators as visible control glyphs.
  return text.replace(/\r\n|\r|\u2028|\u2029/g, "\n");
}

function writePaymentScheduleSection(doc: any, paymentScheduleJson: unknown) {
  const paymentSchedule = Array.isArray(paymentScheduleJson) ? paymentScheduleJson : [];
  const content =
    paymentSchedule.length === 0
      ? "Payment schedule to be finalized before proposal issue."
      : paymentSchedule
          .map((item) => {
            const entry = item as { label?: string; amountPercent?: number; notes?: string };
            return `${entry.label ?? "Payment"} — ${entry.amountPercent ?? 0}%${entry.notes ? `\n${entry.notes}` : ""}`;
          })
          .join("\n\n");
  writeTextSection(doc, "Payment Schedule", content);
}

// The recorded portal signature is embedded only after the same integrity
// validation that guards storage: the data URL must pass the signature
// magic-bytes check, and the decoded bytes must pass the PDF image byte
// validation (PNG/JPEG magic bytes + dimension bounds). A PNG additionally
// proves its pixel stream decodes here: PDFKit inflates IDAT asynchronously
// and throws inflate/filter errors inside the zlib callback — outside any
// try/catch around doc.image — so a header-valid PNG with corrupt pixel
// data would hang or crash the process instead of falling back. Bytes that
// fail any check — including stored GIF/WebP, which PDFKit cannot embed —
// fall back to name and date text. JPEGs need no pixel pre-validation:
// PDFKit embeds their DCT data directly and any marker error throws
// synchronously from doc.image, inside the try/catch below.
function decodeValidatedSignatureImage(dataUrl: string | null | undefined): Buffer | null {
  if (!isValidSignatureDataUrl(dataUrl)) return null;
  const payload = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const bytes = validatePdfLogoBytes(Buffer.from(payload, "base64"));
  if (!bytes) return null;
  if (bytes[0] === 0x89 && !isDecodablePngImage(bytes)) return null;
  return bytes;
}

function writeAcceptanceBlock(doc: any, acceptance?: ProposalAcceptance) {
  const signed =
    acceptance != null &&
    (acceptance.signerName != null || acceptance.signedAt != null || acceptance.signatureDataUrl != null);
  const signatureImage = signed ? decodeValidatedSignatureImage(acceptance.signatureDataUrl) : null;
  // The signer label is drawn at 9pt Helvetica in a 220pt column; a long
  // name wraps to several lines, so the signed block grows from the
  // measured label height instead of a fixed 156pt. Short names keep the
  // 156pt minimum and the previous geometry exactly.
  let blockHeight = 108;
  let nameLabel = "Accepted by";
  let dateLabel = "Date";
  if (signed) {
    nameLabel = acceptance.signerName ? `Accepted by ${acceptance.signerName}` : "Accepted by";
    dateLabel = acceptance.signedAt ? `Date ${formatDocumentDate(acceptance.signedAt)}` : "Date";
    doc.font("Helvetica").fontSize(9);
    const labelHeight = Math.max(
      doc.heightOfString(nameLabel, { width: 220 }),
      doc.heightOfString(dateLabel, { width: 120 }),
    );
    // Signature lines sit at y+104; labels start at y+110.
    blockHeight = Math.max(156, 110 + labelHeight + 16);
  }
  ensureSpace(doc, blockHeight + 24);
  const { left, right } = bounds(doc);
  const y = doc.y;
  doc.save();
  doc.roundedRect(left, y, right - left, blockHeight, 18).fill("#fff");
  doc.roundedRect(left, y, right - left, blockHeight, 18).stroke(BRAND.line);
  doc.restore();
  doc.font("Helvetica-Bold").fontSize(12).fillColor(BRAND.ink).text("Acceptance", left + 16, y + 14);
  doc.font("Helvetica").fontSize(10).fillColor(BRAND.muted).text(
    "Signing below indicates acceptance of the scope, assumptions, exclusions, pricing structure, and terms described in this proposal.",
    left + 16,
    y + 34,
    { width: right - left - 32, lineGap: 2 }
  );
  if (signed) {
    if (signatureImage) {
      try {
        doc.image(signatureImage, left + 16, y + 62, { fit: [200, 32] });
      } catch {
        // An image whose bytes validate but which still fails to embed must
        // never break the PDF; the name and date below still record the
        // acceptance.
      }
    }
    drawSignatureLine(doc, left + 16, y + 104, 220, nameLabel);
    drawSignatureLine(doc, left + 256, y + 104, 120, dateLabel);
    doc.fillColor(BRAND.ink);
    doc.y = y + blockHeight + 16;
    return;
  }
  drawSignatureLine(doc, left + 16, y + 78, 220, "Accepted by");
  drawSignatureLine(doc, left + 256, y + 78, 120, "Date");
  doc.fillColor(BRAND.ink);
  doc.y = y + 124;
}

function drawTrustFooter(doc: any, brand: DocumentFrameBrand) {
  const trustSignals = [
    brand.showLicenseNumber !== false && brand.licenseNumber ? `License ${brand.licenseNumber}` : "",
    brand.showInsuranceSummary !== false && brand.insuranceSummary ? brand.insuranceSummary : "",
    brand.bondingSummary,
    brand.showPoweredByTradeOS ? "Powered by TradeOS" : "",
  ].filter(Boolean);
  if (trustSignals.length === 0) return;
  ensureSpace(doc, 32);
  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(8).fillColor(BRAND.muted).text(trustSignals.join("   •   "), { align: "center" });
  doc.fillColor(BRAND.ink);
}

function drawSignatureLine(doc: any, x: number, y: number, width: number, label: string) {
  doc.moveTo(x, y).lineTo(x + width, y).stroke(BRAND.line);
  doc.font("Helvetica").fontSize(9).fillColor(BRAND.muted).text(label, x, y + 6, { width });
}

function choosePrimaryPrice(proposal: ProposalWithRelations) {
  if (toNullableNumber(proposal.finalPrice) !== null) {
    return formatCurrency(toNullableNumber(proposal.finalPrice));
  }
  if (toNullableNumber(proposal.priceLow) !== null || toNullableNumber(proposal.priceHigh) !== null) {
    return `${formatCurrency(toNullableNumber(proposal.priceLow))} - ${formatCurrency(toNullableNumber(proposal.priceHigh))}`;
  }
  return "Pricing in progress";
}

function chooseSecondaryPrice(proposal: ProposalWithRelations) {
  if (toNullableNumber(proposal.finalPrice) !== null) return "Final quoted price";
  if (toNullableNumber(proposal.priceLow) !== null || toNullableNumber(proposal.priceHigh) !== null) return "Early planning range";
  return "Draft pending pricing review";
}

function bounds(doc: any) {
  return {
    left: doc.page.margins.left,
    right: doc.page.width - doc.page.margins.right,
  };
}

function ensureSpace(doc: any, needed: number) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof value === "object" && value && "toString" in value) return Number(String(value));
  return null;
}

function formatCurrency(value: number | null) {
  if (value === null || Number.isNaN(value)) return "Not set";
  return formatDocumentCurrency(value);
}
