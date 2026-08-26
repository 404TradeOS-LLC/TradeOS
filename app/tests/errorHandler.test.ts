import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ApiError, errorHandler } from "../backend/middleware/errorHandler";

function mockResponse() {
  const res = { status: jest.fn(), json: jest.fn() } as unknown as Response;
  (res.status as jest.Mock).mockReturnValue(res);
  return res;
}

function prismaError(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError("Prisma error", { code, clientVersion: "5.22.0", meta });
}

describe("errorHandler", () => {
  it("maps ApiError to its own status code", () => {
    const res = mockResponse();
    res.locals = { requestId: "req-1" };
    errorHandler(new ApiError(403, "Admin access required"), {} as Request, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Admin access required", requestId: "req-1" });
  });

  it("maps ZodError to 400 with issue details", () => {
    const res = mockResponse();
    res.locals = { requestId: "req-2" };
    const zodError = z.object({ name: z.string() }).safeParse({}).error as z.ZodError;
    errorHandler(zodError, {} as Request, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Validation failed", details: zodError.issues, requestId: "req-2" });
  });

  it("maps a unique constraint violation (P2002) to 409", () => {
    const res = mockResponse();
    res.locals = { requestId: "req-3" };
    errorHandler(prismaError("P2002", { target: ["org_id", "code"] }), {} as Request, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: "A record with this value already exists",
      details: { target: ["org_id", "code"] },
      requestId: "req-3",
    });
  });

  it("maps a foreign key constraint violation (P2003) to 409", () => {
    const res = mockResponse();
    res.locals = { requestId: "req-4" };
    errorHandler(prismaError("P2003", { field_name: "supplier_price_updates_supplier_id_fkey" }), {} as Request, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: "This operation is blocked by a related record (foreign key constraint)",
      details: { field_name: "supplier_price_updates_supplier_id_fkey" },
      requestId: "req-4",
    });
  });

  it("maps a record-not-found error (P2025) to 404", () => {
    const res = mockResponse();
    res.locals = { requestId: "req-5" };
    errorHandler(prismaError("P2025"), {} as Request, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Record not found", requestId: "req-5" });
  });

  it("falls back to a generic 500 for unmapped Prisma error codes", () => {
    const res = mockResponse();
    res.locals = { requestId: "req-6" };
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    errorHandler(prismaError("P2034"), { method: "GET", originalUrl: "/api/v1/test" } as Request, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error", requestId: "req-6" });
    consoleSpy.mockRestore();
  });

  it("falls back to a generic 500 for unrecognized errors", () => {
    const res = mockResponse();
    res.locals = { requestId: "req-7" };
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    errorHandler(new Error("something unexpected"), { method: "POST", originalUrl: "/api/v1/test" } as Request, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error", requestId: "req-7" });
    consoleSpy.mockRestore();
  });
});
