import { timingSafeEqual } from "node:crypto";
import { NextFunction, Request, Response } from "express";
import { ApiError } from "./errorHandler";

export function requirePlatformProvisioningSecret(req: Request, _res: Response, next: NextFunction): void {
  const configured = process.env.PLATFORM_PROVISIONING_SECRET;
  if (!configured || configured.length < 32) {
    next(new ApiError(503, "Platform provisioning is not configured"));
    return;
  }

  const supplied = req.header("x-platform-provisioning-key") ?? "";
  const configuredBuffer = Buffer.from(configured);
  const suppliedBuffer = Buffer.from(supplied);
  if (configuredBuffer.length !== suppliedBuffer.length || !timingSafeEqual(configuredBuffer, suppliedBuffer)) {
    next(new ApiError(401, "Invalid platform provisioning credentials"));
    return;
  }

  next();
}
