import { hasPermission } from "../../../app/domain/contracts.ts";

/** Presentation gate only; authenticated backend permissions and RLS remain authoritative. */
export function canStartFirstEstimate(role: string | null | undefined): boolean {
  return typeof role === "string" && hasPermission(role, "crm.write");
}
