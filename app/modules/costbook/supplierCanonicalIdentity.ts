export interface TradeOsCanonicalMaterialIdentity {
  canonicalMaterialKey: string;
  family: "LUMBER";
  species: "SPF";
  productType: "STUD";
  nominalSize: string;
  lengthInches: number;
  comparisonUnit: "EACH";
}

export interface SupplierIdentityTextAttributes {
  nominalSize: string | null;
  lengthInches: number | null;
  speciesConflict: boolean;
}

const CANONICAL_SPF_STUD_PATTERN =
  /^LUMBER\.SPF\.STUD\.(\d+X\d+)\.(\d+(?:_\d+_\d+)?IN)$/;

const GOVERNED_SPF_STUD_CANONICAL_KEYS = new Set([
  "LUMBER.SPF.STUD.2X4.92_5_8IN",
  "LUMBER.SPF.STUD.2X4.104_5_8IN",
  "LUMBER.SPF.STUD.2X4.116_5_8IN",
]);

/**
 * Resolves supplier/workbook key vocabulary into a TradeOS-owned canonical
 * identity. Unknown source keys intentionally return null: callers must not
 * assume that equal supplier strings establish cross-supplier identity.
 */
export function resolveTradeOsCanonicalMaterialKey(
  sourceCanonicalKey: string | null | undefined
): string | null {
  if (!sourceCanonicalKey?.trim()) return null;

  const key = sourceCanonicalKey.trim().toUpperCase().replace(/\s+/g, "");
  const alreadyCanonical = parseTradeOsSpfStudCanonicalKey(key);
  if (alreadyCanonical) {
    return GOVERNED_SPF_STUD_CANONICAL_KEYS.has(alreadyCanonical.canonicalMaterialKey)
      ? alreadyCanonical.canonicalMaterialKey
      : null;
  }

  const parsed = parseSupplierSpfStudKey(key);
  if (!parsed || !isSupportedCanonicalStudLength(parsed.lengthInches)) return null;

  const canonical = buildSpfStudCanonicalKey(parsed.nominalSize, parsed.lengthInches);
  return GOVERNED_SPF_STUD_CANONICAL_KEYS.has(canonical) ? canonical : null;
}

export function canonicalMaterialKeysEquivalent(
  left: string | null | undefined,
  right: string | null | undefined
): boolean {
  const leftCanonical = resolveTradeOsCanonicalMaterialKey(left);
  const rightCanonical = resolveTradeOsCanonicalMaterialKey(right);
  return Boolean(leftCanonical && rightCanonical && leftCanonical === rightCanonical);
}

export function parseTradeOsCanonicalMaterialIdentity(
  canonicalMaterialKey: string | null | undefined
): TradeOsCanonicalMaterialIdentity | null {
  if (!canonicalMaterialKey?.trim()) return null;
  return parseTradeOsSpfStudCanonicalKey(
    canonicalMaterialKey.trim().toUpperCase().replace(/\s+/g, "")
  );
}

/**
 * Returns only the reviewed supplier/workbook key shapes that are equivalent
 * to one TradeOS canonical SPF stud identity. This supports legacy rows that
 * were ingested before source aliases were normalized on write.
 */
export function supplierCanonicalAliasesForTradeOsIdentity(
  canonicalMaterialKey: string
): string[] {
  const identity = parseTradeOsCanonicalMaterialIdentity(canonicalMaterialKey);
  if (!identity) return [];

  const canonicalLength = formatLengthSegment(identity.lengthInches);
  const sourceLength = canonicalLength.replace(/IN$/, "");
  const parts = sourceLength.match(/^(\d+)(?:_(\d+)_(\d+))?$/);
  if (!parts) return [identity.canonicalMaterialKey];

  const whole = parts[1];
  const numerator = parts[2];
  const denominator = parts[3];
  const supplierLength = numerator && denominator
    ? `${whole}_${numerator}_${denominator}`
    : whole;
  const supplierLengthWithIn = numerator && denominator
    ? `${whole}-${numerator}_${denominator}IN`
    : `${whole}IN`;
  const compactLength = numerator && denominator
    ? `${whole}_${numerator}${denominator}`
    : whole;

  return [...new Set([
    identity.canonicalMaterialKey,
    `LUMBER-SPF-${identity.nominalSize}-${supplierLength}-STUD`,
    `LUMBER-SPF-${identity.nominalSize}-${supplierLengthWithIn}-STUD`,
    `STUD-SPF-${identity.nominalSize}-${supplierLength}`,
    `LUMBER-SPF-STUD-${identity.nominalSize}-${compactLength}`,
  ])];
}

/**
 * Dimension/specification conflicts are hard exclusions. This prevents a
 * canonical key or fuzzy text score from making (for example) a 104-5/8 in.
 * stud eligible for a 92-5/8 in. identity.
 */
export function canonicalIdentityConflictsWithProductText(
  canonicalMaterialKey: string,
  productText: string
): boolean {
  const identity = parseTradeOsCanonicalMaterialIdentity(canonicalMaterialKey);
  if (!identity) return false;

  const attributes = extractSupplierIdentityTextAttributes(productText);

  if (attributes.speciesConflict) return true;
  if (attributes.nominalSize && attributes.nominalSize !== identity.nominalSize) return true;
  if (
    attributes.lengthInches !== null &&
    Math.abs(attributes.lengthInches - identity.lengthInches) > 0.01
  ) {
    return true;
  }

  return false;
}

export function extractSupplierIdentityTextAttributes(
  productText: string
): SupplierIdentityTextAttributes {
  const text = productText
    .toLowerCase()
    .replace(/[×]/g, "x")
    .replace(/[′’]/g, "'")
    .replace(/[″“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();

  const nominalMatch = text.match(
    /\b(\d+)\s*(?:-?\s*in(?:ch(?:es)?)?\.?\s*)?x\s*(\d+)\s*(?:-?\s*in(?:ch(?:es)?)?\.?)?/
  );
  const nominalSize = nominalMatch
    ? `${Number(nominalMatch[1])}X${Number(nominalMatch[2])}`
    : null;

  const mixedInchMatch =
    lastRegexMatch(text, /\bx\s*(\d+)\s*[- ]\s*(\d+)\s*\/\s*(\d+)\s*(?:in(?:ch(?:es)?)?\.?|")/g) ??
    lastRegexMatch(text, /\b(\d+)\s*[- ]\s*(\d+)\s*\/\s*(\d+)\s*(?:in(?:ch(?:es)?)?\.?|")/g);
  let lengthInches: number | null = null;

  if (mixedInchMatch) {
    const denominator = Number(mixedInchMatch[3]);
    if (denominator > 0) {
      lengthInches =
        Number(mixedInchMatch[1]) + Number(mixedInchMatch[2]) / denominator;
    }
  } else {
    const feetMatch =
      lastRegexMatch(text, /\bx\s*(\d+(?:\.\d+)?)\s*(?:ft\.?|feet|foot|')(?=\s|$|[^a-z0-9])/g) ??
      lastRegexMatch(text, /\b(\d+(?:\.\d+)?)\s*(?:ft\.?|feet|foot|')(?=\s|$|[^a-z0-9])/g);
    if (feetMatch) {
      lengthInches = Number(feetMatch[1]) * 12;
    } else {
      const inchesMatch =
        lastRegexMatch(text, /\bx\s*(\d+(?:\.\d+)?)\s*(?:in(?:ch(?:es)?)?\.?|")(?=\s|$|[^a-z0-9])/g) ??
        lastRegexMatch(text, /\b(\d+(?:\.\d+)?)\s*(?:in(?:ch(?:es)?)?\.?|")(?=\s|$|[^a-z0-9])/g);
      if (inchesMatch) lengthInches = Number(inchesMatch[1]);
    }
  }

  const speciesConflict =
    /\b(syp|southern yellow pine|cedar|pressure[- ]treated|pt|treated lumber|treated\s+(?:pine\s+)?stud)\b/.test(text);

  return { nominalSize, lengthInches, speciesConflict };
}

function lastRegexMatch(text: string, pattern: RegExp): RegExpMatchArray | null {
  let last: RegExpMatchArray | null = null;
  for (const match of text.matchAll(pattern)) last = match;
  return last;
}

function isSupportedCanonicalStudLength(lengthInches: number): boolean {
  if (!Number.isFinite(lengthInches) || lengthInches <= 0) return false;
  const whole = Math.floor(lengthInches);
  const fraction = lengthInches - whole;
  if (Math.abs(fraction) < 0.0001) return true;
  const eighths = Math.round(fraction * 8);
  return eighths > 0 && eighths < 8 && Math.abs(fraction - eighths / 8) <= 0.0001;
}

function parseSupplierSpfStudKey(
  sourceKey: string
): { nominalSize: string; lengthInches: number } | null {
  const patterns = [
    /^LUMBER-SPF-(\d+X\d+)-(.+)-STUD$/,
    /^LUMBER-SPF-STUD-(\d+X\d+)-(.+)$/,
    /^STUD-SPF-(\d+X\d+)-(.+)$/,
  ] as const;

  for (const pattern of patterns) {
    const match = sourceKey.match(pattern);
    if (!match) continue;

    const lengthInches = parseLengthToken(match[2]);
    if (lengthInches === null) return null;

    return {
      nominalSize: normalizeNominalSize(match[1]),
      lengthInches,
    };
  }

  return null;
}

function parseTradeOsSpfStudCanonicalKey(
  key: string
): TradeOsCanonicalMaterialIdentity | null {
  const match = key.match(CANONICAL_SPF_STUD_PATTERN);
  if (!match) return null;

  const lengthInches = parseCanonicalLengthSegment(match[2]);
  if (lengthInches === null || !isSupportedCanonicalStudLength(lengthInches)) return null;

  return {
    canonicalMaterialKey: buildSpfStudCanonicalKey(match[1], lengthInches),
    family: "LUMBER",
    species: "SPF",
    productType: "STUD",
    nominalSize: normalizeNominalSize(match[1]),
    lengthInches,
    comparisonUnit: "EACH",
  };
}

function parseLengthToken(rawToken: string): number | null {
  const token = rawToken
    .trim()
    .toUpperCase()
    .replace(/IN(?:CH(?:ES)?)?\.?$/, "")
    .replace(/\s+/g, "");

  const feet = token.match(/^(\d+(?:\.\d+)?)FT$/);
  if (feet) return Number(feet[1]) * 12;

  const wholeInches = token.match(/^(\d+)$/);
  if (wholeInches) return Number(wholeInches[1]);

  const mixed = token.match(/^(\d+)[_-](\d+)[_\/-](\d+)$/);
  if (mixed) {
    const denominator = Number(mixed[3]);
    if (denominator <= 0) return null;
    return Number(mixed[1]) + Number(mixed[2]) / denominator;
  }

  // Home Depot-style compact fraction: 92_58 => 92 + 5/8.
  const compactEighth = token.match(/^(\d+)_([1-7])8$/);
  if (compactEighth) {
    return Number(compactEighth[1]) + Number(compactEighth[2]) / 8;
  }

  return null;
}

function parseCanonicalLengthSegment(segment: string): number | null {
  const match = segment.match(/^(\d+)(?:_(\d+)_(\d+))?IN$/);
  if (!match) return null;
  if (!match[2]) return Number(match[1]);

  const denominator = Number(match[3]);
  if (denominator <= 0) return null;
  return Number(match[1]) + Number(match[2]) / denominator;
}

function buildSpfStudCanonicalKey(nominalSize: string, lengthInches: number): string {
  return `LUMBER.SPF.STUD.${normalizeNominalSize(nominalSize)}.${formatLengthSegment(lengthInches)}`;
}

function normalizeNominalSize(value: string): string {
  const match = value.toUpperCase().match(/^(\d+)X(\d+)$/);
  if (!match) return value.toUpperCase();
  return `${Number(match[1])}X${Number(match[2])}`;
}

function formatLengthSegment(lengthInches: number): string {
  const whole = Math.floor(lengthInches);
  const fraction = lengthInches - whole;

  if (Math.abs(fraction) < 0.0001) return `${whole}IN`;

  const eighths = Math.round(fraction * 8);
  if (Math.abs(fraction - eighths / 8) > 0.0001 || eighths <= 0 || eighths >= 8) {
    throw new Error(`Unsupported canonical stud length ${lengthInches}`);
  }

  const divisor = greatestCommonDivisor(eighths, 8);
  return `${whole}_${eighths / divisor}_${8 / divisor}IN`;
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) [a, b] = [b, a % b];
  return a || 1;
}
