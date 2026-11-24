import { extractBearerToken } from "../backend/auth/bearer";

// Differential oracle: the original regex the parser replaces
// (CodeQL js/polynomial-redos #19, #4). The parser must agree with it on
// every input below.
const BEARER_PATTERN = /^Bearer\s+(.+)$/i;

const CASES: Array<{ header: string | undefined; expected: string | undefined }> = [
  { header: undefined, expected: undefined },
  { header: "", expected: undefined },
  { header: "Bearer", expected: undefined },
  { header: "Bearer ", expected: undefined },
  { header: "Bearer  ", expected: undefined },
  { header: "Bearer abc", expected: "abc" },
  { header: "bearer abc", expected: "abc" },
  { header: "BEARER abc", expected: "abc" },
  { header: "Bearer   abc", expected: "abc" },
  { header: "Bearer\tabc", expected: "abc" },
  { header: "Bearer abc def", expected: "abc def" },
  { header: "Bearer abc ", expected: "abc " },
  { header: "Bearer abc.def-123_~", expected: "abc.def-123_~" },
  { header: "Basic abc", expected: undefined },
  { header: "Bearers abc", expected: undefined },
  { header: "Bearer abc\n", expected: undefined },
  { header: "Bearer abc\r\n", expected: undefined },
  { header: "Bearer abc\r", expected: undefined },
  { header: "Bearer  \nBearer\r", expected: undefined },
  { header: "Bearer abc\ndef", expected: undefined },
  { header: "Bearer abc\rdef", expected: undefined },
  { header: "Bearer \nabc", expected: "abc" },
];

describe("extractBearerToken", () => {
  it.each(CASES)("parses %p", ({ header, expected }) => {
    expect(extractBearerToken(header)).toBe(expected);
  });

  it("agrees with the original regex on seeded pseudo-random headers", () => {
    let seed = 20261124;
    const next = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const pieces = ["Bearer", "bearer", "BEARER", " ", "  ", "\t", "a", "b", "1", ".", "-", "_", "\n", "\r", "Basic", "x"];
    for (let i = 0; i < 300; i += 1) {
      const length = 1 + Math.floor(next() * 8);
      let header = "";
      for (let j = 0; j < length; j += 1) header += pieces[Math.floor(next() * pieces.length)];
      expect(extractBearerToken(header)).toBe(header.match(BEARER_PATTERN)?.[1] ?? undefined);
    }
  });

  it("parses a long adversarial header in linear time", () => {
    // The old regex took ~490ms on this input (CodeQL #19/#4).
    const header = `Bearer ${" ".repeat(10000)}${"a".repeat(10000)}\n${"b".repeat(10000)}`;
    const startedAt = Date.now();
    expect(extractBearerToken(header)).toBeUndefined();
    expect(Date.now() - startedAt).toBeLessThan(500);
  });
});
