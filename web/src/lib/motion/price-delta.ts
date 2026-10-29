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
}): PriceDelta {
  const { previousMinor, currentMinor, currency } = input;
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
