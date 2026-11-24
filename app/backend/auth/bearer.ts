/**
 * Extracts the bearer token from an `Authorization` header value without
 * regex backtracking.
 *
 * The previous implementation used `/^Bearer\s+(.+)$/i`, which CodeQL flags
 * as js/polynomial-redos (#19, #4): on a header starting with "bearer "
 * followed by a long whitespace run and an interior line terminator, the
 * overlapping `\s+` / `.+` quantifiers explore O(n^2) partitions (measured:
 * ~490ms for a 10k-space / 10k-text header). This parser is linear and
 * preserves the regex's semantics exactly:
 *
 * - case-insensitive "Bearer" scheme;
 * - one or more whitespace separators;
 * - a non-empty token of any characters except line terminators.
 *
 * Note the `$`: without the multiline flag it matches only at the absolute
 * end of the input, so a trailing line terminator is NOT accepted — the
 * token must contain no line terminator at all, including at the end.
 */
export function extractBearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  // "Bearer" (6) + at least one whitespace + at least one token character.
  if (header.length < 8) return undefined;
  if (header.slice(0, 6).toLowerCase() !== "bearer") return undefined;
  let index = 6;
  if (!isWhitespace(header[index])) return undefined;
  while (index < header.length && isWhitespace(header[index])) index += 1;
  if (index >= header.length) return undefined;
  const token = header.slice(index);
  // `.+` cannot span a line terminator, and `$` matches only at the absolute
  // end of the input, so any line terminator anywhere in the token means the
  // original regex could not match at all.
  if (containsLineTerminator(token)) return undefined;
  return token.length > 0 ? token : undefined;
}

function isWhitespace(char: string | undefined): boolean {
  return char !== undefined && /\s/.test(char);
}

function isLineTerminator(char: string | undefined): boolean {
  return char === "\n" || char === "\r" || char === "\u2028" || char === "\u2029";
}

function containsLineTerminator(value: string): boolean {
  for (const char of value) {
    if (isLineTerminator(char)) return true;
  }
  return false;
}
