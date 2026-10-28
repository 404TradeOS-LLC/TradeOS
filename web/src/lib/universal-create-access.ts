import { hasPermission, isSupportedRole, normalizeRole } from "../../../app/domain/contracts.ts";
import type { UniversalCreateKind } from "./universal-create.ts";

/** Presentation only: authenticated backend authorization remains authoritative. */
export function canUseUniversalCreate(kind: UniversalCreateKind, role: unknown, athenaEnabled: boolean): boolean {
  // Asking Athena is advisory and keeps its existing capability gate.
  if (kind === "athena") return athenaEnabled;
  if (typeof role !== "string" || !isSupportedRole(role)) return false;
  switch (kind) {
    case "estimate":
    case "customer":
    case "task":
      return hasPermission(role, "crm.write");
    case "invoice":
    case "change-order":
      return hasPermission(role, "billing.write");
    case "job":
    case "schedule":
      // JobsService accepts these three normalized manager roles.
      return ["owner", "admin", "dispatcher"].includes(normalizeRole(role));
  }
}
