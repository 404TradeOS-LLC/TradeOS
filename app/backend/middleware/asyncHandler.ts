import { NextFunction, Request, Response } from "express";

type Handler = (req: Request, res: Response) => Promise<unknown>;

// Wraps an async controller method so thrown/rejected errors reach the
// centralized errorHandler instead of crashing the process or hanging the request.
export function asyncHandler(handler: Handler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res).catch(next);
  };
}
