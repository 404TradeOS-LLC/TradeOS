import { z } from "zod";
import { commaSeparatedEnum, strictOptionalBoolean } from "../backend/queryParams";
import { errorHandler } from "../backend/middleware/errorHandler";
import type { Request, Response } from "express";

describe("patched validation runtime compatibility", () => {
  it("rejects oversized constrained collections before validating their elements", () => {
    let visited = 0;
    const schema = z.array(z.preprocess(value => { visited++; return value; }, z.string())).max(10);
    const result = schema.safeParse(Array(10_000).fill(123));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues).toEqual([expect.objectContaining({ code: "too_big" })]);
    expect(visited).toBe(0);
  });

  it("preserves legacy UUID-shaped entity identifiers and rejects malformed identifiers", () => {
    for (const id of ["10000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000000", "123e4567-e89b-42d3-a456-426614174000"]) expect(z.guid().safeParse(id).success).toBe(true);
    for (const id of ["project-1", "../projects", "123e4567e89b42d3a456426614174000"]) expect(z.guid().safeParse(id).success).toBe(false);
  });

  it("retains query enum literals, missing defaults and exact boolean semantics", () => {
    const schema = commaSeparatedEnum(z.enum(["blocked", "completed"]));
    expect(schema.parse(" blocked,completed ")).toEqual(["blocked", "completed"]);
    expect(schema.parse(undefined)).toBeUndefined();
    expect(schema.safeParse("approved").success).toBe(false);
    expect(strictOptionalBoolean.parse("false")).toBe(false);
    expect(strictOptionalBoolean.parse(undefined)).toBeUndefined();
    expect(strictOptionalBoolean.safeParse("0").success).toBe(false);
  });

  it("preserves structured HTTP validation failures and request correlation", () => {
    const result = z.object({ status: z.enum(["todo", "completed"]) }).safeParse({ status: "approved" });
    expect(result.success).toBe(false);
    if (result.success) return;
    const json = jest.fn(); const status = jest.fn().mockReturnValue({ json });
    errorHandler(result.error, {} as Request, { locals: { requestId: "validation-test" }, status } as unknown as Response, jest.fn());
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: "Validation failed", details: result.error.issues, requestId: "validation-test" });
  });
});
