import { type DocumentFrameBrand, renderDocumentFrameHtml } from "./frame";
import { formatDocumentCurrency, formatDocumentDate, formatDocumentNumber, formatDocumentStatus } from "./format";

export interface EstimateFrameInput {
  brand: DocumentFrameBrand;
  estimate: {
    version: number;
    createdAt: Date;
    projectName: string;
    projectAddress: string;
    customerName: string;
    customerEmail: string;
    subtotalCost: number;
    totalPrice: number;
    lineItems: Array<{
      description: string;
      quantity: number;
      unitOfMeasure: string;
      unitCost: number;
      lineCost: number;
    }>;
  };
}

export interface ChangeOrderFrameInput {
  brand: DocumentFrameBrand;
  changeOrder: {
    coNumber: number;
    createdAt: Date;
    status: string;
    description: string;
    amount: number;
    scheduleImpactDays: number | null;
    projectName: string;
    projectAddress: string;
    customerName: string;
    customerEmail: string;
    lineItems: Array<{
      description: string;
      quantity: number;
      unitCost: number;
      lineCost: number;
    }>;
  };
}

export interface CloseoutFrameInput {
  brand: DocumentFrameBrand;
  closeout: {
    projectName: string;
    projectAddress: string;
    customerName: string;
    customerEmail: string;
    completionDate: Date;
    contractsSignedCount: number;
    finalInvoicesPaidCount: number;
    punchListItems: string[];
    handoffDocuments: string[];
    closeoutSummary: string;
  };
}

export interface WarrantyFrameInput {
  brand: DocumentFrameBrand;
  warranty: {
    projectName: string;
    projectAddress: string;
    customerName: string;
    customerEmail: string;
    effectiveDate: Date;
    workmanshipCoverage: string;
    manufacturerCoverage: string;
    exclusions: string[];
    supportProcess: string;
    requiredDocuments: string[];
  };
}

export interface MaintenanceGuideFrameInput {
  brand: DocumentFrameBrand;
  guide: {
    projectName: string;
    projectAddress: string;
    customerName: string;
    customerEmail: string;
    generatedAt: Date;
    systemLabel: string;
    seasonalChecklist: string[];
    annualChecklist: string[];
    warningSigns: string[];
    recommendedPartners: string[];
  };
}

export function renderEstimateFrameHtml(input: EstimateFrameInput) {
  return renderDocumentFrameHtml(input.brand, {
    eyebrow: "Estimate",
    title: `Estimate v${input.estimate.version}`,
    subtitle: "Client-facing pricing summary built for print review, branded handoff, and smooth proposal conversion.",
    badges: ["Estimate", "Pricing", input.brand.typography.style],
    customerMeta: [
      { label: "Customer", value: input.estimate.customerName },
      { label: "Email", value: input.estimate.customerEmail || "Not provided" },
    ],
    projectMeta: [
      { label: "Project", value: input.estimate.projectName },
      { label: "Address", value: input.estimate.projectAddress || "Address to be confirmed" },
      { label: "Issued", value: formatDocumentDate(input.estimate.createdAt) },
    ],
    heroMetric: {
      label: "Estimated investment",
      value: formatDocumentCurrency(input.estimate.totalPrice),
      meta: `Subtotal ${formatDocumentCurrency(input.estimate.subtotalCost)} before markup and final presentation adjustments.`,
    },
    table: {
      columns: [
        { key: "description", label: "Description" },
        { key: "quantity", label: "Qty", align: "right" },
        { key: "unitCost", label: "Unit Cost", align: "right" },
        { key: "lineCost", label: "Line Total", align: "right" },
      ],
      rows: input.estimate.lineItems.map((lineItem) => ({
        description: `${lineItem.description} (${lineItem.unitOfMeasure})`,
        quantity: formatDocumentNumber(lineItem.quantity),
        unitCost: formatDocumentCurrency(lineItem.unitCost),
        lineCost: formatDocumentCurrency(lineItem.lineCost),
      })),
    },
    sections: [
      {
        title: "Presentation Notes",
        body: "This estimate frame is ready for branded print output, homeowner review, and conversion into a formal proposal without rebuilding the visual system.",
      },
    ],
  });
}

export function renderChangeOrderFrameHtml(input: ChangeOrderFrameInput) {
  return renderDocumentFrameHtml(input.brand, {
    eyebrow: "Change Order",
    title: `Change Order #${input.changeOrder.coNumber}`,
    subtitle: "A client-reviewable change authorization frame for added scope, pricing impact, and schedule movement.",
    badges: ["Change Order", formatDocumentStatus(input.changeOrder.status), input.brand.typography.style],
    customerMeta: [
      { label: "Customer", value: input.changeOrder.customerName },
      { label: "Email", value: input.changeOrder.customerEmail || "Not provided" },
    ],
    projectMeta: [
      { label: "Project", value: input.changeOrder.projectName },
      { label: "Address", value: input.changeOrder.projectAddress || "Address to be confirmed" },
      { label: "Created", value: formatDocumentDate(input.changeOrder.createdAt) },
    ],
    heroMetric: {
      label: "Change amount",
      value: formatDocumentCurrency(input.changeOrder.amount),
      meta: input.changeOrder.scheduleImpactDays ? `${input.changeOrder.scheduleImpactDays} day schedule impact` : "No schedule impact recorded",
    },
    table: {
      columns: [
        { key: "description", label: "Description" },
        { key: "quantity", label: "Qty", align: "right" },
        { key: "unitCost", label: "Unit Cost", align: "right" },
        { key: "lineCost", label: "Line Total", align: "right" },
      ],
      rows: input.changeOrder.lineItems.map((lineItem) => ({
        description: lineItem.description,
        quantity: formatDocumentNumber(lineItem.quantity),
        unitCost: formatDocumentCurrency(lineItem.unitCost),
        lineCost: formatDocumentCurrency(lineItem.lineCost),
      })),
    },
    sections: [
      {
        title: "Scope Change Summary",
        body: input.changeOrder.description,
      },
      {
        title: "Approval Guidance",
        body: "Approval authorizes the added scope, pricing, and any documented schedule extension before crews proceed with this change.",
      },
    ],
  });
}

export function renderCloseoutFrameHtml(input: CloseoutFrameInput) {
  return renderDocumentFrameHtml(input.brand, {
    eyebrow: "Project Closeout",
    title: "Closeout Summary",
    subtitle: "A branded handoff packet summarizing completion readiness, supporting files, and the customer’s next-step expectations.",
    badges: ["Closeout", "Handoff", input.brand.typography.style],
    customerMeta: [
      { label: "Customer", value: input.closeout.customerName },
      { label: "Email", value: input.closeout.customerEmail || "Not provided" },
    ],
    projectMeta: [
      { label: "Project", value: input.closeout.projectName },
      { label: "Address", value: input.closeout.projectAddress || "Address to be confirmed" },
      { label: "Completed", value: formatDocumentDate(input.closeout.completionDate) },
    ],
    heroMetric: {
      label: "Closeout snapshot",
      value: `${input.closeout.contractsSignedCount} signed / ${input.closeout.finalInvoicesPaidCount} paid`,
      meta: "Contracts and final-billing progress at the time this packet was generated.",
    },
    sections: [
      {
        title: "Closeout Summary",
        body: input.closeout.closeoutSummary,
      },
      {
        title: "Punch List / Final Checks",
        bullets: input.closeout.punchListItems.length ? input.closeout.punchListItems : ["No punch list items recorded."],
      },
      {
        title: "Handoff Documents",
        bullets: input.closeout.handoffDocuments.length ? input.closeout.handoffDocuments : ["No handoff files attached yet."],
        note: "Keep manufacturer registrations, signed documents, and final field photos grouped with this packet for future support.",
      },
    ],
  });
}

export function renderWarrantyFrameHtml(input: WarrantyFrameInput) {
  return renderDocumentFrameHtml(input.brand, {
    eyebrow: "Warranty",
    title: "Warranty Coverage Guide",
    subtitle: "A clear, client-friendly reference for workmanship support, manufacturer terms, exclusions, and how to request service.",
    badges: ["Warranty", "Support", input.brand.typography.style],
    customerMeta: [
      { label: "Customer", value: input.warranty.customerName },
      { label: "Email", value: input.warranty.customerEmail || "Not provided" },
    ],
    projectMeta: [
      { label: "Project", value: input.warranty.projectName },
      { label: "Address", value: input.warranty.projectAddress || "Address to be confirmed" },
      { label: "Effective", value: formatDocumentDate(input.warranty.effectiveDate) },
    ],
    heroMetric: {
      label: "Coverage in force",
      value: formatDocumentDate(input.warranty.effectiveDate),
      meta: "Keep this guide with your closeout packet and final project records.",
    },
    sections: [
      { title: "Workmanship Coverage", body: input.warranty.workmanshipCoverage },
      { title: "Manufacturer Coverage", body: input.warranty.manufacturerCoverage },
      { title: "Exclusions", bullets: input.warranty.exclusions },
      { title: "How to Request Support", body: input.warranty.supportProcess },
      { title: "Required Records", bullets: input.warranty.requiredDocuments },
    ],
  });
}

export function renderMaintenanceGuideFrameHtml(input: MaintenanceGuideFrameInput) {
  return renderDocumentFrameHtml(input.brand, {
    eyebrow: "Maintenance Guide",
    title: input.guide.systemLabel,
    subtitle: "A print-ready homeowner maintenance reference tuned for seasonal checks, annual service, and early issue detection.",
    badges: ["Maintenance", "Homeowner Guide", input.brand.typography.style],
    customerMeta: [
      { label: "Customer", value: input.guide.customerName },
      { label: "Email", value: input.guide.customerEmail || "Not provided" },
    ],
    projectMeta: [
      { label: "Project", value: input.guide.projectName },
      { label: "Address", value: input.guide.projectAddress || "Address to be confirmed" },
      { label: "Prepared", value: formatDocumentDate(input.guide.generatedAt) },
    ],
    heroMetric: {
      label: "Service rhythm",
      value: `${input.guide.seasonalChecklist.length} seasonal / ${input.guide.annualChecklist.length} annual`,
      meta: "A simple cadence to preserve performance, appearance, and warranty confidence.",
    },
    sections: [
      { title: "Seasonal Checklist", bullets: input.guide.seasonalChecklist },
      { title: "Annual Checklist", bullets: input.guide.annualChecklist },
      { title: "Watch For These Warning Signs", bullets: input.guide.warningSigns },
      { title: "Recommended Service Partners", bullets: input.guide.recommendedPartners },
    ],
  });
}
