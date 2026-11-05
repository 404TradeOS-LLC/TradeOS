/**
 * Normalize values to the four decimal places persisted by EstimateLineItem.
 * @param {unknown} value Numeric value returned by the reviewed request or API.
 * @returns {number | null} Four-decimal numeric value, or null for invalid input.
 */
export function normalizePersistedEvidenceQuantity(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(4)) : null;
}

/**
 * Match an authenticated saved line to both the Apply acknowledgement and reviewed payload.
 * @param {{ acknowledgement: object, reviewed: object, saved: object }} input Line records to reconcile.
 * @returns {boolean} Whether identity, target, normalized description, and persisted quantity agree.
 */
export function matchesReviewedSavedLine({ acknowledgement, reviewed, saved }) {
  if (!acknowledgement || !reviewed || !saved) return false;

  const expectedQuantity = normalizePersistedEvidenceQuantity(reviewed.quantity);
  const acknowledgedQuantity = normalizePersistedEvidenceQuantity(acknowledgement.quantity);
  const savedQuantity = normalizePersistedEvidenceQuantity(saved.quantity);
  const expectedDescription =
    String(reviewed.description ?? "").trim() || String(acknowledgement.description ?? "").trim();
  const savedDescription = String(saved.description ?? "").trim();
  const acknowledgedDescription = String(acknowledgement.description ?? "").trim();

  const targetMatches = reviewed.targetKind === "assembly"
    ? saved.assemblyId === reviewed.targetId
    : reviewed.targetKind === "costItem"
      ? saved.costItemId === reviewed.targetId
      : false;

  return reviewed.status === "accepted" &&
    Boolean(acknowledgement.lineItemId) &&
    acknowledgement.lineItemId === saved.id &&
    targetMatches &&
    expectedQuantity !== null &&
    acknowledgedQuantity === expectedQuantity &&
    savedQuantity === expectedQuantity &&
    Boolean(expectedDescription) &&
    acknowledgedDescription === expectedDescription &&
    savedDescription === expectedDescription;
}

/**
 * Check that an authenticated saved-line row visibly renders its acknowledged description and quantity.
 * @param {string} renderedText Visible row text from Playwright.
 * @param {object} acknowledgement Apply response line acknowledgement.
 * @returns {boolean} Whether the row text contains both acknowledged values.
 */
export function renderedVerifiedRowMatches(renderedText, acknowledgement) {
  const quantity = normalizePersistedEvidenceQuantity(acknowledgement?.quantity);
  const description = String(acknowledgement?.description ?? "").trim();
  return quantity !== null &&
    Boolean(description) &&
    String(renderedText).includes(description) &&
    String(renderedText).includes(String(quantity));
}

/**
 * Perform a hard builder reload before reading the authorized Estimate detail.
 * @param {object} input Playwright page, Estimate id, and authorized detail reader.
 * @returns {Promise<object>} Estimate detail returned after the page reload completes.
 */
export async function reloadEstimateAndRead({ page, estimateId, readEstimateDetail }) {
  await page.reload({ waitUntil: "networkidle", timeout: 60_000 });
  return readEstimateDetail(estimateId);
}
