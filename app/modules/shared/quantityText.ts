/**
 * Linear-time number+unit scanning for contractor scope text.
 *
 * This replaces quantity regexes of the shape
 * `/(\d+(?:\.\d+)?)\s*(unit…)\b/` (CodeQL js/polynomial-redos). Those
 * regexes are polynomial on digit runs: when no unit follows, the engine
 * backtracks the greedy `\d+` one digit at a time at every start position —
 * a 10,000-digit scope (the controller caps scope text at 10,000 chars)
 * costs ~430ms per pattern, and the estimator runs six of them plus the
 * thickness pattern per request.
 *
 * This scanner preserves the regexes' leftmost-match semantics but runs in
 * O(n): at each digit it parses the longest number once (digits, optional
 * "." + digits), skips whitespace once, then tries the unit alternatives in
 * the original alternation order. Nothing backtracks.
 *
 * One subtlety: after a failed unit check the scanner does not advance one
 * character at a time through a long digit run (that would be O(n^2) again
 * — re-parsing the run at every position). Every sub-start inside the
 * number just parsed ends at the same place and fails the same unit check,
 * so the whole span can be skipped — except when another dotted segment
 * follows ("12.34.56 sq ft" matches "34.56 sq ft" in the original regexes),
 * in which case the scan resumes at the first digit of the fraction, the
 * leftmost sub-start that can extend past the number.
 */

export interface QuantityUnitAlternative {
  /**
   * Words of the unit, in order — e.g. ["sq", "ft"] for "sq ft".
   * Matched with optional whitespace between words (the original `\s*`).
   */
  words: string[];
  /**
   * Require a word boundary after the unit (the original trailing `\b`).
   * Default true.
   */
  trailingBoundary?: boolean;
  /**
   * Require a word boundary before the unit (a leading `\b` on that
   * alternative in the original pattern). Default false.
   */
  leadingBoundary?: boolean;
  /**
   * After the unit, the following text — after optional whitespace — must
   * not start with one of these words (the original `(?!\s*…)` lookahead).
   */
  notFollowedBy?: string[];
  /**
   * Optional suffix words tried after the unit (the original optional
   * trailing group, e.g. "thick"/"slab"). First match wins and is included
   * in `sourceText`; no boundary is required after the suffix.
   */
  optionalSuffix?: string[];
}

export interface NumberUnitMatch {
  /** The number text as written, e.g. "12.5". */
  valueText: string;
  /** The full matched span, e.g. "12.5 sq ft" or "4 in thick". */
  sourceText: string;
  /** Index just past the match. */
  endIndex: number;
}

export interface FindNumberUnitMatchesOptions {
  /** Compare unit words case-insensitively (the original `/i` flag). */
  caseInsensitive?: boolean;
}

function isDigit(char: string | undefined): boolean {
  return char !== undefined && char >= "0" && char <= "9";
}

function isWordChar(char: string | undefined): boolean {
  return (
    char !== undefined &&
    ((char >= "a" && char <= "z") || (char >= "A" && char <= "Z") || (char >= "0" && char <= "9") || char === "_")
  );
}

function isWhitespace(char: string | undefined): boolean {
  // Mirrors \s for the whitespace that can appear in scope text.
  return char !== undefined && /\s/.test(char);
}

function wordMatchesAt(
  text: string,
  pos: number,
  word: string,
  caseInsensitive: boolean,
): boolean {
  const slice = text.slice(pos, pos + word.length);
  return caseInsensitive ? slice.toLowerCase() === word : slice === word;
}

/** Parses the longest number starting at `start`: digits, optional "." + digits. */
function parseNumberAt(
  text: string,
  start: number,
): { valueText: string; endIndex: number; fractionStart: number | null } | null {
  let end = start;
  while (isDigit(text[end])) end += 1;
  if (end === start) return null;
  let fractionStart: number | null = null;
  if (text[end] === "." && isDigit(text[end + 1])) {
    fractionStart = end + 1;
    end += 1;
    while (isDigit(text[end])) end += 1;
  }
  return { valueText: text.slice(start, end), endIndex: end, fractionStart };
}

function matchUnitAt(
  text: string,
  start: number,
  alternative: QuantityUnitAlternative,
  caseInsensitive: boolean,
): number | null {
  if (alternative.leadingBoundary && isWordChar(text[start - 1])) return null;
  let pos = start;
  for (let wordIndex = 0; wordIndex < alternative.words.length; wordIndex += 1) {
    if (wordIndex > 0) {
      while (isWhitespace(text[pos])) pos += 1;
    }
    const word = alternative.words[wordIndex];
    if (!wordMatchesAt(text, pos, word, caseInsensitive)) return null;
    pos += word.length;
  }
  if (alternative.trailingBoundary !== false && isWordChar(text[pos])) return null;
  if (alternative.notFollowedBy) {
    let lookaheadPos = pos;
    while (isWhitespace(text[lookaheadPos])) lookaheadPos += 1;
    for (const forbidden of alternative.notFollowedBy) {
      if (wordMatchesAt(text, lookaheadPos, forbidden, caseInsensitive)) return null;
    }
  }
  if (alternative.optionalSuffix) {
    let suffixPos = pos;
    while (isWhitespace(text[suffixPos])) suffixPos += 1;
    // The original regex's `\s*` before the optional suffix is consumed
    // whether or not a suffix follows: "4 in depth" matched "4 in ".
    pos = suffixPos;
    for (const suffix of alternative.optionalSuffix) {
      if (wordMatchesAt(text, suffixPos, suffix, caseInsensitive)) {
        pos = suffixPos + suffix.length;
        break;
      }
    }
  }
  return pos;
}

/**
 * Finds every `<number> <unit>` occurrence in `text`, in scan order,
 * matching the leftmost-match semantics of the regexes this replaces.
 * Each match consumes its span (like a global regex), so matches never
 * overlap; a number with no following unit is skipped one character at a
 * time, exactly as the regex engine advances its start position.
 */
export function findNumberUnitMatches(
  text: string,
  alternatives: QuantityUnitAlternative[],
  options: FindNumberUnitMatchesOptions = {},
): NumberUnitMatch[] {
  const caseInsensitive = options.caseInsensitive ?? false;
  const matches: NumberUnitMatch[] = [];
  let index = 0;
  while (index < text.length) {
    if (!isDigit(text[index])) {
      index += 1;
      continue;
    }
    const number = parseNumberAt(text, index);
    if (!number) {
      index += 1;
      continue;
    }
    let pos = number.endIndex;
    while (isWhitespace(text[pos])) pos += 1;
    let matchedEnd: number | null = null;
    for (const alternative of alternatives) {
      const unitEnd = matchUnitAt(text, pos, alternative, caseInsensitive);
      if (unitEnd !== null) {
        matchedEnd = unitEnd;
        break;
      }
    }
    if (matchedEnd !== null) {
      matches.push({ valueText: number.valueText, sourceText: text.slice(index, matchedEnd), endIndex: matchedEnd });
      index = matchedEnd;
    } else if (
      number.fractionStart !== null &&
      text[number.endIndex] === "." &&
      isDigit(text[number.endIndex + 1])
    ) {
      // Another dotted segment follows: the first sub-start that can extend
      // past this number is the first digit of the fraction.
      index = number.fractionStart;
    } else {
      // Every sub-start inside this number ends at the same place and fails
      // the same unit check, so the whole span is skipped.
      index = number.endIndex;
    }
  }
  return matches;
}
