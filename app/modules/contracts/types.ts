export interface CreateContractInput {
  orgId?: string;
  actorUserId?: string;
  actorRole?: string;
  proposalId: string;
  termsText?: string;
}

export interface SignContractInput {
  orgId: string;
  actorUserId?: string;
  actorRole?: string;
  signerName: string;
  signerEmail?: string;
  signatureDataUrl?: string;
  signatureIp?: string;
}

export interface ContractEventDTO {
  id: string;
  eventType: string;
  actorUserId: string | null;
  recipientEmail: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: string;
  createdAt: string;
}

export interface ContractDTO {
  id: string;
  projectId: string;
  proposalId: string;
  status: string;
  termsText: string;
  signerName: string | null;
  signerEmail: string | null;
  signatureDataUrl: string | null;
  signatureIp: string | null;
  signedAt: Date | null;
  createdAt: Date;
  events: ContractEventDTO[];
}

export interface ContractDocument {
  buffer: Buffer;
  filename: string;
  contentType: string;
}
