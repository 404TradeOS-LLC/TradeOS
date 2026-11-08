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
// quantity to four decimals (normalizePersistedQuantity, half-up via
// Prisma.Decimal), so the saved value is the rounded request, not the raw
// request. Compare the saved quantity against the rounded request: a fixed
// tolerance on the raw request both rejects correctly saved lines (requested
// 100.00005 persisted as 100.0001 differs by 0.00005000000000165983 in
// JavaScript) and accepts edited ones (requested 1.00005 persisted as
// 1.0001, but a saved 1 is within 0.00005 of the raw request).
// Round to four decimals the way the backend does: Prisma.Decimal
// (Decimal.js) rounds the decimal value half-up. Number.prototype.toFixed
// rounds the binary double instead, which disagrees at midpoints whose
// double sits just below the decimal (2.00005 -> 2.0000, 123.45675 ->
// 123.4567) while the backend persists 2.0001 / 123.4568. String()
// recovers the shortest decimal the JSON carried, so round on that
// digit string: truncate when the fifth fractional digit is below 5,
// otherwise increment the kept prefix as a decimal integer.
function roundToPersistedPrecision(quantity: number): number {
  if (!Number.isFinite(quantity)) return quantity;
  const text = String(quantity);
  if (/[eE]/.test(text)) return Number(quantity.toFixed(4));
  const negative = text.startsWith("-");
  const unsigned = negative ? text.slice(1) : text;
  const [whole, fraction = ""] = unsigned.split(".");
  if (fraction.length <= 4) return quantity;
  const digits = `${whole}${fraction}`;
  const roundAt = whole.length + 4;
  if (Number(digits[roundAt]) < 5) {
    return Number(`${negative ? "-" : ""}${whole}.${fraction.slice(0, 4)}`);
  }
  const kept = digits.slice(0, roundAt).split("");
  let i = kept.length - 1;
  let carry = 1;
  while (i >= 0 && carry) {
    const digit = Number(kept[i]) + carry;
    kept[i] = String(digit % 10);
    carry = digit >= 10 ? 1 : 0;
    i -= 1;
  }
  if (carry) kept.unshift("1");
  const rounded = kept.join("");
  const wholePart = rounded.slice(0, Math.max(rounded.length - 4, 1)) || "0";
  const fracPart = rounded.slice(-4).padStart(4, "0");
  return Number(`${negative ? "-" : ""}${wholePart}.${fracPart}`);
}

// A few ulps of floating-point noise on the rounded comparison; a genuine
// conflicting edit still differs by at least 0.0001 at the fourth decimal.
function roundedQuantityTolerance(savedQuantity: number, roundedRequestedQuantity: number): number {
  const magnitude = Math.max(Math.abs(savedQuantity), Math.abs(roundedRequestedQuantity), 1);
  return Number.EPSILON * magnitude * 8;
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
    const roundedRequestedQuantity = roundToPersistedPrecision(requested.quantity);
    if (Math.abs(saved.quantity - roundedRequestedQuantity) > roundedQuantityTolerance(saved.quantity, roundedRequestedQuantity)) {
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
