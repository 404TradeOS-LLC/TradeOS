import { NextFunction, Request, Response, Router } from "express";
import { adminUiController } from "../controllers/adminUi.controller";
import { asyncHandler } from "../middleware/asyncHandler";
import { adminPricingUiController } from "../controllers/adminPricingUi.controller";

export const adminUiRouter = Router();

const adminCredentialScrubber = `<script>
window.addEventListener("pagehide", function () {
  document.querySelectorAll('[name="bearerToken"]').forEach(function (field) {
    if (field instanceof HTMLInputElement) {
      field.value = "";
      field.removeAttribute("value");
    } else if (field instanceof HTMLTextAreaElement) {
      field.value = "";
      field.textContent = "";
    }
  });
});
</script>`;

export function preventAdminResponseCaching(_req: Request, res: Response, next: NextFunction) {
  res.set("Cache-Control", "no-store");
  const send = res.send.bind(res);
  res.send = ((body?: unknown) => {
    const contentType = res.getHeader("Content-Type");
    const hardenedBody =
      typeof body === "string" && typeof contentType === "string" && contentType.toLowerCase().includes("text/html")
        ? body.replace("</body>", `${adminCredentialScrubber}\n</body>`)
        : body;
    return send(hardenedBody as never);
  }) as typeof res.send;
  next();
}

adminUiRouter.use(preventAdminResponseCaching);
adminUiRouter.get("/", asyncHandler(adminPricingUiController.show));
adminUiRouter.get("/pricing-history", asyncHandler(adminPricingUiController.show));
adminUiRouter.post("/pricing-history", asyncHandler(adminPricingUiController.submit));
adminUiRouter.get("/assets/admin.css", asyncHandler(adminPricingUiController.stylesheet));
adminUiRouter.get("/member-history", asyncHandler(adminUiController.showMembershipHistoryForm));
adminUiRouter.post("/member-history", asyncHandler(adminUiController.submitMembershipHistoryForm));
