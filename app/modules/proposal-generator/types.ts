export interface ProposalAcceptance {
  signerName: string | null;
  signerEmail: string | null;
  signatureDataUrl: string | null;
  signedAt: Date | null;
}

export interface GenerateProposalInput {
  estimateId: string;
  orgId?: string;
  companyName?: string;
  showLineItemDetail?: boolean;
  termsAndConditions?: string;
  scopeOfWork?: string;
  assumptions?: string;
  exclusions?: string;
  timeline?: string;
  priceLow?: number | null;
  priceHigh?: number | null;
  finalPrice?: number | null;
  paymentScheduleJson?: unknown;
  acceptance?: ProposalAcceptance;
}

export interface GenerateProjectProposalInput {
  proposalId: string;
  orgId?: string;
}

export interface ProposalDocument {
  buffer: Buffer;
  filename: string;
  contentType: string;
}
