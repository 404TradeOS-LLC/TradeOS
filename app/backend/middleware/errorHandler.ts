import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { logError } from "../logging";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
}

interface MappedPrismaError {
  statusCode: number;
  message: string;
  details?: unknown;
}

// Maps the handful of Prisma error codes that represent an invalid client
// request (not a server bug) to clean 4xx responses. Every module previously
// let these bubble to the generic 500 below — e.g. deleting a supplier or
// material with price-update/audit history (P2003, RESTRICT foreign keys)
// or violating a unique constraint (P2002). Codes not handled here
// (transaction conflicts, etc.) still fall through to the generic 500,
// since guessing at the right status for codes this app hasn't actually
// hit yet is worse than just logging them.
function mapPrismaKnownRequestError(err: Prisma.PrismaClientKnownRequestError): MappedPrismaError | undefined {
  switch (err.code) {
    case "P2002":
      return {
        statusCode: 409,
        message: "A record with this value already exists",
        details: err.meta,
      };
    case "P2003":
      return {
        statusCode: 409,
        message: "This operation is blocked by a related record (foreign key constraint)",
        details: err.meta,
      };
    case "P2025":
      return {
        statusCode: 404,
        message: "Record not found",
        details: err.meta,
      };
    default:
      return undefined;
  }
}

// Centralized error handler. Keeps controllers free of repetitive try/catch
// boilerplate — controllers can throw ApiError or let Zod/Prisma errors bubble up.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const requestId = typeof res.locals.requestId === "string" ? res.locals.requestId : undefined;

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      error: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
      ...(requestId ? { requestId } : {}),
    });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Validation failed", details: err.issues, ...(requestId ? { requestId } : {}) });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = mapPrismaKnownRequestError(err);
    if (mapped) {
      res.status(mapped.statusCode).json({
        error: mapped.message,
        ...(mapped.details ? { details: mapped.details } : {}),
        ...(requestId ? { requestId } : {}),
      });
      return;
    }
  }

  logError("request.failed", {
    requestId,
    method: req.method,
    path: req.originalUrl,
    error: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : String(err),
  });

  res.status(500).json({ error: "Internal server error", ...(requestId ? { requestId } : {}) });
}
