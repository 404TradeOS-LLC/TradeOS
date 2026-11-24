import { findNumberUnitMatches, QuantityUnitAlternative } from "../modules/shared/quantityText";

// The original regexes, kept here as the differential oracle: the scanner
// must agree with them on every input in the corpus below. These literals
// are the pre-fix patterns (CodeQL js/polynomial-redos #33-#37, #39); they
// are test fixtures, not production code.
const CUE_PATTERN =
  /(\d+(?:\.\d+)?)\s*(sq\s*ft|square\s*feet|sf|lf|linear\s*ft|linear\s*feet|ft|inch|inches|ea|each|yard|yards|cy|job)\b/i;
const AREA_PATTERN = /(\d+(?:\.\d+)?)\s*(?:sq\s*ft|square\s*feet|sf)\b/g;
const LENGTH_PATTERN = /(\d+(?:\.\d+)?)\s*(?:linear\s*ft|linear\s*feet|lf)\b/g;
const VOLUME_PATTERN = /(\d+(?:\.\d+)?)\s*(?:cubic\s*yards?|cy)\b/g;
const SQUARES_PATTERN = /(\d+(?:\.\d+)?)\s*(?:squares?|\bsq\b(?!\s*ft))/g;
const HOURS_PATTERN = /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hr)\b/g;
const COUNT_PATTERN = /(\d+(?:\.\d+)?)\s*(?:each|ea|units?|items?)\b/g;
const THICKNESS_PATTERN = /(\d+(?:\.\d+)?)\s*(?:inch|in|")\s*(?:thick|slab)?/;
const DERIVE_SQFT_PATTERN = /(\d+(?:\.\d+)?)\s*(?:sq\s*ft|square\s*feet|sf)\b/;
const DERIVE_LINEAR_PATTERN = /(\d+(?:\.\d+)?)\s*(?:lf|linear\s*ft|linear\s*feet)\b/;
const DERIVE_COUNT_PATTERN = /(\d+(?:\.\d+)?)\s*(?:each|ea|units?|items?)\b/;

const CUE_UNITS: QuantityUnitAlternative[] = [
  { words: ["sq", "ft"] },
  { words: ["square", "feet"] },
  { words: ["sf"] },
  { words: ["lf"] },
  { words: ["linear", "ft"] },
  { words: ["linear", "feet"] },
  { words: ["ft"] },
  { words: ["inch"] },
  { words: ["inches"] },
  { words: ["ea"] },
  { words: ["each"] },
  { words: ["yard"] },
  { words: ["yards"] },
  { words: ["cy"] },
  { words: ["job"] },
];

const AREA_UNITS: QuantityUnitAlternative[] = [
  { words: ["sq", "ft"] },
  { words: ["square", "feet"] },
  { words: ["sf"] },
];

const LENGTH_UNITS: QuantityUnitAlternative[] = [
  { words: ["linear", "ft"] },
  { words: ["linear", "feet"] },
  { words: ["lf"] },
];

const VOLUME_UNITS: QuantityUnitAlternative[] = [
  { words: ["cubic", "yards"] },
  { words: ["cubic", "yard"] },
  { words: ["cy"] },
];

const SQUARES_UNITS: QuantityUnitAlternative[] = [
  { words: ["squares"], trailingBoundary: false },
  { words: ["square"], trailingBoundary: false },
  { words: ["sq"], leadingBoundary: true, notFollowedBy: ["ft"] },
];

const HOURS_UNITS: QuantityUnitAlternative[] = [
  { words: ["hours"] },
  { words: ["hour"] },
  { words: ["hrs"] },
  { words: ["hr"] },
];

const COUNT_UNITS: QuantityUnitAlternative[] = [
  { words: ["each"] },
  { words: ["ea"] },
  { words: ["units"] },
  { words: ["unit"] },
  { words: ["items"] },
  { words: ["item"] },
];

const THICKNESS_UNITS: QuantityUnitAlternative[] = [
  { words: ["inch"], trailingBoundary: false, optionalSuffix: ["thick", "slab"] },
  { words: ["in"], trailingBoundary: false, optionalSuffix: ["thick", "slab"] },
  { words: ['"'], trailingBoundary: false, optionalSuffix: ["thick", "slab"] },
];

const DERIVE_SQFT_UNITS: QuantityUnitAlternative[] = [
  { words: ["sq", "ft"] },
  { words: ["square", "feet"] },
  { words: ["sf"] },
];

const DERIVE_LINEAR_UNITS: QuantityUnitAlternative[] = [
  { words: ["lf"] },
  { words: ["linear", "ft"] },
  { words: ["linear", "feet"] },
];

const DERIVE_COUNT_UNITS: QuantityUnitAlternative[] = [
  { words: ["each"] },
  { words: ["ea"] },
  { words: ["units"] },
  { words: ["unit"] },
  { words: ["items"] },
  { words: ["item"] },
];

function regexAll(pattern: RegExp, text: string): Array<{ value: string; source: string }> {
  return [...text.matchAll(new RegExp(pattern.source, pattern.flags))].map((match) => ({
    value: match[1],
    source: match[0],
  }));
}

function scannerAll(
  text: string,
  units: QuantityUnitAlternative[],
  caseInsensitive = false,
): Array<{ value: string; source: string }> {
  return findNumberUnitMatches(text, units, { caseInsensitive }).map((match) => ({
    value: match.valueText,
    source: match.sourceText,
  }));
}

const CORPUS = [
  "Replace 250 sq ft of concrete driveway, 4 inch slab",
  "Tear out and replace 250 sq ft of cracked concrete driveway, 4 inch slab, broom finish, include sawcut edges, haul-off, and final cleanup.",
  "Replace 100 sq ft of roof shingles",
  "100 sqft roof",
  "100sqft",
  "100 sq ft",
  "100 SQ FT",
  "100 Sq Ft",
  "12.5 linear feet of trim",
  "10 squares of shingles",
  "10 sq of shingles",
  "10 sq ft of shingles",
  "10 sqft",
  "10sq",
  "10sq ft",
  "4 in thick",
  "4 inch slab",
  '4" slab',
  "4 inches",
  "4 in",
  "4 in slab",
  "4 inch thick",
  "8 hours labor",
  "8 hrs",
  "8 hr",
  "3 each",
  "5 units",
  "2 items",
  "6 ea",
  "1 unit",
  "1 item",
  "10 cubic yards",
  "10 cy",
  "10 cubic yard",
  "10 ftx",
  "10 jobx",
  "10 job",
  "250.5 sq ft",
  "12.34.56 sq ft",
  "1.2.3 sq ft",
  "abc123 sq ft",
  "10 sq ftx",
  "10 sfx",
  "10sf.",
  "2.5",
  "0 sq ft",
  "10\t sq\n ft",
  "10  sq  ft",
  "10 .5 in",
  "10. in",
  "no quantities here",
  "250 sq ft and 40 linear ft and 3 each",
  "pour 12 cy concrete, 6 inch slab, 2 hour cure",
  "replace 9 lf of trim and 7 yards of fabric",
  "10 hourx",
  "10 unitsx",
  "10 eachx",
  "10 square feet",
  "10 squarefeet",
  "10 linear ft",
  "10 linearft",
  "10 lf",
];

describe("quantityText scanner vs original regexes", () => {
  it.each(CORPUS)("cue: %s", (text) => {
    expect(findNumberUnitMatches(text, CUE_UNITS, { caseInsensitive: true }).length > 0).toBe(
      CUE_PATTERN.test(text),
    );
  });

  it.each(CORPUS)("area/length/volume/squares/hours/count: %s", (text) => {
    const lower = text.toLowerCase();
    expect(scannerAll(lower, AREA_UNITS)).toEqual(regexAll(AREA_PATTERN, lower));
    expect(scannerAll(lower, LENGTH_UNITS)).toEqual(regexAll(LENGTH_PATTERN, lower));
    expect(scannerAll(lower, VOLUME_UNITS)).toEqual(regexAll(VOLUME_PATTERN, lower));
    expect(scannerAll(lower, SQUARES_UNITS)).toEqual(regexAll(SQUARES_PATTERN, lower));
    expect(scannerAll(lower, HOURS_UNITS)).toEqual(regexAll(HOURS_PATTERN, lower));
    expect(scannerAll(lower, COUNT_UNITS)).toEqual(regexAll(COUNT_PATTERN, lower));
  });

  it.each(CORPUS)("thickness: %s", (text) => {
    const lower = text.toLowerCase();
    const expected = lower.match(THICKNESS_PATTERN);
    const actual = findNumberUnitMatches(lower, THICKNESS_UNITS)[0];
    expect(actual ? { value: actual.valueText, source: actual.sourceText } : null).toEqual(
      expected ? { value: expected[1], source: expected[0] } : null,
    );
  });

  it.each(CORPUS)("deriveQuantity (case-sensitive): %s", (text) => {
    const first = (pattern: RegExp): string | null => text.match(pattern)?.[1] ?? null;
    expect(findNumberUnitMatches(text, DERIVE_SQFT_UNITS)[0]?.valueText ?? null).toBe(first(DERIVE_SQFT_PATTERN));
    expect(findNumberUnitMatches(text, DERIVE_LINEAR_UNITS)[0]?.valueText ?? null).toBe(first(DERIVE_LINEAR_PATTERN));
    expect(findNumberUnitMatches(text, DERIVE_COUNT_UNITS)[0]?.valueText ?? null).toBe(first(DERIVE_COUNT_PATTERN));
  });

  it("agrees with the regexes on seeded pseudo-random scope fragments", () => {
    // Deterministic PRNG so the fuzz corpus is reproducible.
    let seed = 20261124;
    const next = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const tokens = ["sq", "ft", "sf", "in", "inch", "ea", "job", "cy", "x", " ", ".", "0", "1", "2", "5", "s", "q", "f", "t", "e", "a", "r", "h", "u", "n", "l", "b", '"'];
    for (let i = 0; i < 300; i += 1) {
      const length = 3 + Math.floor(next() * 12);
      let text = "";
      for (let j = 0; j < length; j += 1) text += tokens[Math.floor(next() * tokens.length)];
      const lower = text.toLowerCase();
      expect(scannerAll(lower, AREA_UNITS)).toEqual(regexAll(AREA_PATTERN, lower));
      expect(scannerAll(lower, SQUARES_UNITS)).toEqual(regexAll(SQUARES_PATTERN, lower));
      expect(scannerAll(lower, COUNT_UNITS)).toEqual(regexAll(COUNT_PATTERN, lower));
      expect(findNumberUnitMatches(text, CUE_UNITS, { caseInsensitive: true }).length > 0).toBe(CUE_PATTERN.test(text));
    }
  });

  it("scans a 10,000-digit scope in linear time", () => {
    const scope = `replace driveway ${"0".repeat(10000)} and haul off`;
    const startedAt = Date.now();
    const all = [
      ...findNumberUnitMatches(scope, CUE_UNITS, { caseInsensitive: true }),
      ...findNumberUnitMatches(scope.toLowerCase(), AREA_UNITS),
      ...findNumberUnitMatches(scope.toLowerCase(), LENGTH_UNITS),
      ...findNumberUnitMatches(scope.toLowerCase(), VOLUME_UNITS),
      ...findNumberUnitMatches(scope.toLowerCase(), SQUARES_UNITS),
      ...findNumberUnitMatches(scope.toLowerCase(), HOURS_UNITS),
      ...findNumberUnitMatches(scope.toLowerCase(), COUNT_UNITS),
      ...findNumberUnitMatches(scope.toLowerCase(), THICKNESS_UNITS),
    ];
    expect(all).toEqual([]);
    // The old regexes took ~430ms per pattern on this input (~2s combined).
    expect(Date.now() - startedAt).toBeLessThan(500);
  });
});
