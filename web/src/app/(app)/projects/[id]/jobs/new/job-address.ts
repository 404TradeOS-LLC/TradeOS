export interface JobAddressPrefill {
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
}

const US_STATE_CODES = new Set(
  "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" "),
);

/**
 * Project.siteAddress is a free-form string; the Job form needs structured
 * service-address fields. Extract only unambiguous comma/newline-separated
 * US city, state and ZIP values, and preserve the original on any uncertainty.
 * Never invent address parts or silently drop an address segment.
 */
export function splitProjectSiteAddress(value: string | null | undefined): JobAddressPrefill {
  const original = value?.trim() ?? "";
  const empty = { addressLine1: original, city: "", state: "", postalCode: "" };
  if (!original) return empty;

  const normalized = original.replace(/\s*\r?\n\s*/g, ", ").replace(/\s+/g, " ").trim();
  const parsed =
    /^(.+),\s*([^,]+),\s*([a-z]{2})\s+(\d{5}(?:-\d{4})?)$/i.exec(normalized) ??
    /^(.+),\s*([^,]+?)\s+([a-z]{2})\s+(\d{5}(?:-\d{4})?)$/i.exec(normalized);

  if (!parsed) return empty;
  const [, street, city, rawState, postalCode] = parsed;
  const state = rawState.toUpperCase();
  if (!street.trim() || !city.trim() || !US_STATE_CODES.has(state)) return empty;

  return { addressLine1: street.trim(), city: city.trim(), state, postalCode };
}
