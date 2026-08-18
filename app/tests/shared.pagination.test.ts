import { clampQueueLimit, decodeUpdatedAtCursor, encodeUpdatedAtCursor, buildUpdatedAtRange, DEFAULT_QUEUE_PAGE_LIMIT, MAX_QUEUE_PAGE_LIMIT } from "../modules/shared/pagination";
import { ApiError } from "../backend/middleware/errorHandler";

describe("shared work-queue pagination", () => {
  describe("clampQueueLimit", () => {
    it("defaults to 25 when no limit is supplied", () => {
      expect(clampQueueLimit(undefined)).toBe(DEFAULT_QUEUE_PAGE_LIMIT);
    });

    it("clamps to the documented maximum of 50", () => {
      expect(clampQueueLimit(500)).toBe(MAX_QUEUE_PAGE_LIMIT);
    });

    it("clamps a zero/negative value up to 1", () => {
      expect(clampQueueLimit(0)).toBe(1);
      expect(clampQueueLimit(-5)).toBe(1);
    });

    it("truncates a fractional value", () => {
      expect(clampQueueLimit(10.9)).toBe(10);
    });
  });

  describe("encodeUpdatedAtCursor / decodeUpdatedAtCursor", () => {
    it("round-trips a cursor", () => {
      const updatedAt = new Date("2026-08-01T12:00:00.000Z");
      const encoded = encodeUpdatedAtCursor({ updatedAt, id: "row-1" });
      const decoded = decodeUpdatedAtCursor(encoded);
      expect(decoded.id).toBe("row-1");
      expect(decoded.updatedAt.toISOString()).toBe(updatedAt.toISOString());
    });

    it("rejects a malformed base64 payload with a 400 ApiError", () => {
      expect(() => decodeUpdatedAtCursor("not-a-valid-cursor")).toThrow(ApiError);
      try {
        decodeUpdatedAtCursor("not-a-valid-cursor");
      } catch (error) {
        expect((error as ApiError).statusCode).toBe(400);
      }
    });

    it("rejects a well-formed base64 payload missing required fields", () => {
      const tampered = Buffer.from(JSON.stringify({ u: "2026-08-01T00:00:00.000Z" }), "utf8").toString("base64url");
      expect(() => decodeUpdatedAtCursor(tampered)).toThrow(ApiError);
    });

    it("rejects a cursor whose updatedAt is not a valid date", () => {
      const tampered = Buffer.from(JSON.stringify({ u: "not-a-date", i: "row-1" }), "utf8").toString("base64url");
      expect(() => decodeUpdatedAtCursor(tampered)).toThrow(ApiError);
    });
  });

  describe("buildUpdatedAtRange", () => {
    it("returns undefined when neither bound is supplied", () => {
      expect(buildUpdatedAtRange({})).toBeUndefined();
    });

    it("builds a combined gte/lte range", () => {
      const range = buildUpdatedAtRange({ updatedAfter: "2026-08-01T00:00:00.000Z", updatedBefore: "2026-08-10T00:00:00.000Z" });
      expect(range?.gte?.toISOString()).toBe("2026-08-01T00:00:00.000Z");
      expect(range?.lte?.toISOString()).toBe("2026-08-10T00:00:00.000Z");
    });
  });
});
