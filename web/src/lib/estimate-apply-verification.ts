export interface EstimateApplyAcknowledgement {
  applied: Array<{ draftLineItemId: string; lineItemId: string; quantity: number; description: string }>;
  skipped: Array<{ draftLineItemId: string; status: string; reason: string; lineItemId?: string; quantity?: number; description?: string }>;
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

// Persisted quantities are Decimal(12, 4): the server rounds the requested
// quantity to four decimals (normalizePersistedQuantity), so the saved value
// may differ from the request by up to half a unit in the last place, plus
// floating-point noise. Any larger gap is a conflicting edit, not rounding.
const QUANTITY_TOLERANCE = 0.00005 + Number.EPSILON;

export function verifyEstimateApplyAcknowledgement(
  acknowledgement: EstimateApplyAcknowledgement,
  serializedRequestBody: string,
  savedLines: SavedEstimateLineIdentity[]
): VerifiedEstimateApplyLine[] {
  const request = parseRequest(serializedRequestBody);
  const requestedByDraftId = new Map(request.lineItems.map((line) => [line.draftLineItemId, line]));
  const savedById = new Map(savedLines.map((line) => [line.id, line]));
  const acknowledged = [
    ...acknowledgement.applied.map((line) => ({
      draftLineItemId: line.draftLineItemId,
      lineItemId: line.lineItemId,
      quantity: line.quantity,
      description: line.description,
    })),
    ...acknowledgement.skipped.flatMap((line) =>
      line.lineItemId && line.quantity !== undefined && line.description !== undefined
        ? [{ draftLineItemId: line.draftLineItemId, lineItemId: line.lineItemId, quantity: line.quantity, description: line.description }]
        : []
    ),
  ];
  const seenSavedIds = new Set<string>();

  return acknowledged.map(({ draftLineItemId, lineItemId, quantity, description }) => {
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
      saved.quantity !== quantity ||
      normalizeText(saved.description) !== normalizeText(description)
    ) {
      throw new EstimateApplyVerificationError(`Acknowledged line ${lineItemId} did not match the reviewed target, quantity, and description.`);
    }

    // An idempotent retry can acknowledge the CURRENT saved row: the
    // server's sourceKey lookup finds a line edited in another tab after
    // the apply (edits preserve sourceKey) and echoes its current values,
    // so saved-vs-acknowledgement alone cannot prove the row still matches
    // the accepted review. Compare against the retained request too.
    if (Math.abs(saved.quantity - requested.quantity) > QUANTITY_TOLERANCE) {
      throw new EstimateApplyVerificationError(`Acknowledged line ${lineItemId} no longer matches the reviewed quantity.`);
    }
    const requestedDescription = requested.description?.trim();
    if (requestedDescription && normalizeText(saved.description) !== normalizeText(requestedDescription)) {
      throw new EstimateApplyVerificationError(`Acknowledged line ${lineItemId} no longer matches the reviewed description.`);
    }
    // When the request had no description the server fell back to the
    // target name, which this verifier cannot know; the acknowledgement
    // comparison above remains the only description check in that case.

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
