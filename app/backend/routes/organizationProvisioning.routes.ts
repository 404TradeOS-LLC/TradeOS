import { Router } from "express";
import { organizationProvisioningController } from "../controllers/organizationProvisioning.controller";
import { asyncHandler } from "../middleware/asyncHandler";
import { requirePlatformProvisioningSecret } from "../middleware/platformProvisioningAuth";
import { requirePlatformProvisioningAllowedIp } from "../middleware/platformProvisioningIpAllowlist";
import { platformProvisioningRateLimit } from "../middleware/platformProvisioningRateLimit";

export const organizationProvisioningRouter = Router();

organizationProvisioningRouter.post(
  "/organizations",
  platformProvisioningRateLimit,
  requirePlatformProvisioningAllowedIp,
  requirePlatformProvisioningSecret,
  asyncHandler(organizationProvisioningController.provision)
);
