export interface EstimateApplyAcknowledgement {
  applied: Array<{ draftLineItemId: string; lineItemId: string; quantity: number }>;
  skipped: Array<{ draftLineItemId: string; status: string; reason: string; lineItemId?: string }>;
}

export interface EstimateApplyRequestLine {
  draftLineItemId: string;
  quantity: number;
  status: "pending" | "accepted" | "rejected";
  description?: string;
  targetId?: string;
  targetKind?: "assembly" | "costItem";
}

export interface SavedEstimateLineIdentity {
  id: string;
  costItemId: string | null;
  assemblyId: string | null;
  description: string;
  quantity: number;
  unitOfMeasure: string;
  unitCost: number;
  lineCost: number;
  sourceKey?: string | null;
}

export interface VerifiedEstimateApplyLine {
  draftLineItemId: string;
  lineItemId: string;
  description: string;
  quantity: number;
  unitOfMeasure: string;
  targetKind: "assembly" | "costItem";
  targetId: string;
  sourceKey: string | null;
}

export class EstimateApplyVerificationError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "EstimateApplyVerificationError";
    this.cause = cause;
  }
}

export function verifyEstimateApplyAcknowledgement(
  acknowledgement: EstimateApplyAcknowledgement,
  serializedRequestBody: string,
  savedLines: SavedEstimateLineIdentity[]
): VerifiedEstimateApplyLine[] {
  const request = parseRequest(serializedRequestBody);
  const requestedByDraftId = new Map(request.lineItems.map((line) => [line.draftLineItemId, line]));
  const savedById = new Map(savedLines.map((line) => [line.id, line]));
  const acknowledged = [
    ...acknowledgement.applied.map((line) => ({ draftLineItemId: line.draftLineItemId, lineItemId: line.lineItemId })),
    ...acknowledgement.skipped.flatMap((line) => line.lineItemId ? [{ draftLineItemId: line.draftLineItemId, lineItemId: line.lineItemId }] : []),
  ];
  const seenSavedIds = new Set<string>();

  return acknowledged.map(({ draftLineItemId, lineItemId }) => {
    if (seenSavedIds.has(lineItemId)) {
      throw new EstimateApplyVerificationError(`Saved line ${lineItemId} was acknowledged more than once.`);
    }
    seenSavedIds.add(lineItemId);

    const requested = requestedByDraftId.get(draftLineItemId);
    if (!requested || requested.status !== "accepted" || !requested.targetId || !requested.targetKind) {
      throw new EstimateApplyVerificationError(`Apply acknowledgement referenced an unknown accepted review line: ${draftLineItemId}.`);
    }
    const saved = savedById.get(lineItemId);
    if (!saved) {
      throw new EstimateApplyVerificationError(`Acknowledged line ${lineItemId} was not returned by the authorized Estimate read.`);
    }

    const savedTargetId = requested.targetKind === "assembly" ? saved.assemblyId : saved.costItemId;
    if (
      savedTargetId !== requested.targetId ||
      saved.quantity !== requested.quantity ||
      normalizeText(saved.description) !== normalizeText(requested.description ?? "")
    ) {
      throw new EstimateApplyVerificationError(`Acknowledged line ${lineItemId} did not match the reviewed target, quantity, and description.`);
    }

    return {
      draftLineItemId,
      lineItemId,
      description: saved.description,
      quantity: saved.quantity,
      unitOfMeasure: saved.unitOfMeasure,
      targetKind: requested.targetKind,
      targetId: requested.targetId,
      sourceKey: saved.sourceKey ?? null,
    };
  });
}

function parseRequest(serializedRequestBody: string): { lineItems: EstimateApplyRequestLine[] } {
  try {
    const parsed = JSON.parse(serializedRequestBody) as { lineItems?: unknown };
    if (!Array.isArray(parsed.lineItems)) throw new Error("Apply request is missing lineItems.");
    return { lineItems: parsed.lineItems as EstimateApplyRequestLine[] };
  } catch (error) {
    throw new EstimateApplyVerificationError("Unable to read the retained Apply request for saved-line verification.", error);
  }
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
