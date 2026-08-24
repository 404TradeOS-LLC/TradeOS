import PDFDocument from "pdfkit";
import { prisma } from "../../db/client";
import { ApiError } from "../../backend/middleware/errorHandler";
import { getDocumentBrand } from "../documents/branding";
import type { DocumentFrameBrand } from "../documents/frame";
import { GenerateProjectProposalInput, GenerateProposalInput, ProposalDocument } from "./types";

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
    const buffer = await renderEstimateProposalPdf(estimate, {
      brand,
      showLineItemDetail: input.showLineItemDetail ?? false,
      termsAndConditions: input.termsAndConditions ?? DEFAULT_TERMS,
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
    const buffer = await renderProjectProposalPdf(proposal, brand);
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
  project: {
    name: string;
    siteAddress: string | null;
    customer: { name: string; email: string | null } | null;
    organization: { name: string; phone: string | null; email: string | null; address: string | null } | null;
  };
}

function renderEstimateProposalPdf(
  estimate: EstimateWithRelations,
  opts: { brand: DocumentFrameBrand; showLineItemDetail: boolean; termsAndConditions: string }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 46, size: "LETTER" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const projectSummary = opts.showLineItemDetail
      ? estimate.lineItems.map((li) => `${li.description} — ${Number(li.quantity)} ${li.unitOfMeasure}`).join("\n")
      : estimate.lineItems.map((li) => `• ${li.description}`).join("\n");

    drawHeader(doc, opts.brand, "Client Proposal");
    writeContactRail(doc, opts.brand);
    drawProjectMetaGrid(doc, {
      customerName: estimate.project.customer?.name ?? "Customer",
      customerEmail: estimate.project.customer?.email ?? null,
      projectName: estimate.project.name,
      projectAddress: estimate.project.siteAddress,
      dateLabel: `Issued ${estimate.createdAt.toLocaleDateString()}`,
      statusLabel: `Estimate v${estimate.version}`,
    });
    drawMoneyPanel(doc, {
      title: "Investment",
      primary: formatCurrency(toNullableNumber(estimate.totalPrice)),
      secondary: "Lump-sum project price",
    });
    writeTextSection(doc, "Scope of Work", projectSummary);
    writeTextSection(doc, "Pricing Notes", "This estimate is presented as a client-facing proposal and may be refined if field conditions or selections change.");
    writeTextSection(doc, "Terms & Conditions", opts.termsAndConditions);
    writeAcceptanceBlock(doc);
    drawTrustFooter(doc, opts.brand);
    doc.end();
  });
}

function renderProjectProposalPdf(proposal: ProposalWithRelations, brand: DocumentFrameBrand): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 46, size: "LETTER" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawHeader(doc, brand, "Client Proposal Draft");
    writeContactRail(doc, brand);
    drawProjectMetaGrid(doc, {
      customerName: proposal.project.customer?.name ?? "Customer",
      customerEmail: proposal.project.customer?.email ?? null,
      projectName: proposal.project.name,
      projectAddress: proposal.project.siteAddress,
      dateLabel: `Drafted ${proposal.createdAt.toLocaleDateString()}`,
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
    writeAcceptanceBlock(doc);
    drawTrustFooter(doc, brand);
    doc.end();
  });
}

function drawHeader(doc: any, brand: DocumentFrameBrand, title: string) {
  const { left, right } = bounds(doc);
  doc.save();
  doc.roundedRect(left, 34, right - left, 88, 20).fill(brand.colors.primary);
  doc.restore();
  doc.fillColor("white").fontSize(22).font("Helvetica-Bold").text(brand.companyName, left + 18, 54, { width: 300 });
  doc.fontSize(11).font("Helvetica").fillColor(brand.colors.secondary).text(title.toUpperCase(), left + 18, 82, {
    characterSpacing: 1.4,
    width: 250,
  });
  if (brand.tagline) doc.fillColor("white").fontSize(10).text(brand.tagline, right - 180, 58, { width: 160, align: "right" });
  doc.fillColor(brand.colors.accent).fontSize(20).font("Helvetica-Bold").text("TRADEOS", right - 170, 84, { width: 150, align: "right" });
  doc.fillColor(BRAND.ink).font("Helvetica");
  doc.y = 146;
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
  const top = doc.y;
  const gap = 12;
  const boxWidth = (right - left - gap) / 2;
  const boxHeight = 84;

  drawInfoCard(doc, left, top, boxWidth, boxHeight, "Customer", [data.customerName, data.customerEmail].filter(Boolean) as string[]);
  drawInfoCard(doc, left + boxWidth + gap, top, boxWidth, boxHeight, "Project", [data.projectName, data.projectAddress ?? "No address saved"]);
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
    cursorY += 16;
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
  const normalized = content.trim();
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

function writeAcceptanceBlock(doc: any) {
  ensureSpace(doc, 130);
  const { left, right } = bounds(doc);
  const y = doc.y;
  doc.save();
  doc.roundedRect(left, y, right - left, 108, 18).fill("#fff");
  doc.roundedRect(left, y, right - left, 108, 18).stroke(BRAND.line);
  doc.restore();
  doc.font("Helvetica-Bold").fontSize(12).fillColor(BRAND.ink).text("Acceptance", left + 16, y + 14);
  doc.font("Helvetica").fontSize(10).fillColor(BRAND.muted).text(
    "Signing below indicates acceptance of the scope, assumptions, exclusions, pricing structure, and terms described in this proposal.",
    left + 16,
    y + 34,
    { width: right - left - 32, lineGap: 2 }
  );
  drawSignatureLine(doc, left + 16, y + 78, 220, "Accepted by");
  drawSignatureLine(doc, left + 256, y + 78, 120, "Date");
  doc.fillColor(BRAND.ink);
  doc.y = y + 124;
}

function drawTrustFooter(doc: any, brand: DocumentFrameBrand) {
  const trustSignals = [
    brand.showLicenseNumber !== false && brand.licenseNumber ? `License ${brand.licenseNumber}` : "",
    brand.showInsuranceSummary !== false && brand.insuranceSummary ? brand.insuranceSummary : "",
    brand.showInsuranceSummary !== false && brand.bondingSummary ? brand.bondingSummary : "",
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
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}
