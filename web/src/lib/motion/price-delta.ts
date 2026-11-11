/**
 * Recalculate price-delta model (spec §05).
 *
 * Financial truth is never calculated in animation. This model works only
 * in integer minor units (cents for USD-style currencies), commits exactly
 * one synchronized previous -> current change, and never rolls digits: a
 * component swaps the displayed value in one render commit and may
 * emphasize the delta beside it, but the numbers themselves never animate.
 *
 * Display rules carried here:
 * - the previous value stays labelled "Previous" until the delta is
 *   dismissed or superseded (callers keep the returned object, not a timer);
 * - the delta appears beside the new value, never in place of it;
 * - unknown stays unknown: this model throws on non-integer input rather
 *   than rendering a fabricated or zero price.
 */

export type PriceDeltaDirection = "increase" | "decrease" | "unchanged";

export type PriceDelta = {
  previousMinor: number;
  currentMinor: number;
  deltaMinor: number;
  direction: PriceDeltaDirection;
  previousFormatted: string;
  currentFormatted: string;
  deltaFormatted: string;
};

function formatMinor(minor: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

export function computePriceDelta(input: {
  previousMinor: number;
  currentMinor: number;
  currency: string;
}): PriceDelta {  const { previousMinor, currentMinor, currency } = input;
  if (!Number.isFinite(previousMinor) || !Number.isFinite(currentMinor)) {
    throw new Error("Price deltas require finite minor-unit values.");
  }
  if (!Number.isInteger(previousMinor) || !Number.isInteger(currentMinor)) {
    throw new Error("Price deltas require integer minor units; refusing to render a rounded price.");
  }
  const deltaMinor = currentMinor - previousMinor;
  const direction: PriceDeltaDirection =
    deltaMinor > 0 ? "increase" : deltaMinor < 0 ? "decrease" : "unchanged";
  const sign = deltaMinor > 0 ? "+" : "";
  return {
    previousMinor,
    currentMinor,
    deltaMinor,
    direction,
    previousFormatted: formatMinor(previousMinor, currency),
    currentFormatted: formatMinor(currentMinor, currency),
    deltaFormatted:
      direction === "unchanged"
        ? formatMinor(0, currency)
        : `${sign}${formatMinor(deltaMinor, currency)}`,
  };
}

/**
 * Convert a server total in major units (dollars) to integer minor units.
 *
 * Math.round absorbs binary floating-point representation error
 * (1234.56 stored as 1234.55999… still converts to 123456); it never
 * rounds a price to a coarser precision. Non-finite input returns null
 * so callers skip rendering instead of showing a fabricated price.
 */
export function toMinorUnits(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

export type RecalculationSnapshot = {
  previousTotalMinor: number;
  reason: string;
  /**
   * True when two or more pricing mutations succeeded against this same
   * baseline before the refetch landed, so the pending delta is no longer
   * tied to one edit. An ambiguous baseline is preserved as a marker (not
   * cleared to null) until the refetch reconciles it: clearing it would
   * let a later success re-snapshot the same baseline and misattribute
   * the combined change to that one edit.
   */
  ambiguous?: boolean;
};

/**
 * Next "Last recalculation" snapshot for one pricing mutation success.
 *
 * The snapshot baseline is the last server-confirmed total, so two edits
 * that succeed before the refetch lands would both snapshot the same
 * baseline and the second would re-attribute their combined change to
 * itself (or hide offsetting changes). When a snapshot is already pending
 * against this same total, the pending delta is no longer tied to one
 * edit, so mark the baseline ambiguous instead of clearing it: no
 * per-edit delta is shown until a clean single-edit snapshot exists, and
 * the marker survives until the refetch reconciles it — clearing it to
 * null would let a later success re-snapshot the same baseline and
 * misattribute the combined change to that one edit. Once the refetch
 * lands, the current total moves and a later success snapshots normally
 * again.
 */
export function nextRecalculationSnapshot(input: {
  currentTotalMinor: number | null;
  reason: string;
  pending: RecalculationSnapshot | null;
}): RecalculationSnapshot | null {
  if (input.currentTotalMinor === null) return null;
  if (input.pending && input.pending.previousTotalMinor === input.currentTotalMinor) {
    if (input.pending.ambiguous) return input.pending;
    return { previousTotalMinor: input.currentTotalMinor, reason: input.reason, ambiguous: true };
  }
  return { previousTotalMinor: input.currentTotalMinor, reason: input.reason };
}
