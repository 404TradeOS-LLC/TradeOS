/**
 * Strict operator gate for an ABC Supply SKU -> tenant Material activation.
 * This is NOT supplier-price approval: the initial cost must be supplied and
 * approved independently by the operator; future ABC quotes remain pending.
 */
export const ABC_MATERIAL_CONFIRMATION = "ACTIVATE_ONE_ABC_MATERIAL";

export interface AbcMaterialActivationArgs {
  orgId: string;
  userId: string;
  productKey: string;
  approvedUnitCost: string | null;
  confirmedSku: string | null;
  confirmedUnit: string | null;
  apply: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MONEY = /^(?:0|[1-9][0-9]{0,7})(?:\.[0-9]{1,4})?$/;

export function parseAbcMaterialActivationArgs(argv: readonly string[]): AbcMaterialActivationArgs {
  const fields = new Map<string, string>();
  let apply = false;
  const accepted = new Set([
    "--org-id", "--user-id", "--product-key", "--approved-unit-cost",
    "--confirm-sku", "--confirm-unit", "--confirmation",
  ]);
  for (const arg of argv) {
    if (arg === "--apply") {
      if (apply) throw new Error("--apply may appear only once");
      apply = true;
      continue;
    }
    const equals = arg.indexOf("=");
    const name = equals >= 0 ? arg.slice(0, equals) : arg;
    const value = equals >= 0 ? arg.slice(equals + 1).trim() : "";
    if (!accepted.has(name) || !value || fields.has(name)) {
      throw new Error("Unknown, empty, or repeated ABC activation argument: " + name);
    }
    fields.set(name, value);
  }

  const orgId = fields.get("--org-id") ?? "";
  const userId = fields.get("--user-id") ?? "";
  const productKey = fields.get("--product-key") ?? "";
  if (!UUID.test(orgId) || !UUID.test(userId) || !productKey || productKey.length > 200) {
    throw new Error("An organization UUID, actor UUID, and exact supplier product key are required");
  }
  const approvedUnitCost = fields.get("--approved-unit-cost") ?? null;
  if (approvedUnitCost !== null && (!MONEY.test(approvedUnitCost) || Number(approvedUnitCost) <= 0)) {
    throw new Error("--approved-unit-cost must be a positive, explicitly approved cost with at most four decimals");
  }
  if (apply && (
    !approvedUnitCost ||
    !fields.get("--confirm-sku") ||
    !fields.get("--confirm-unit") ||
    fields.get("--confirmation") !== ABC_MATERIAL_CONFIRMATION
  )) {
    throw new Error("Writing requires approved cost, exact SKU/unit acknowledgement, and explicit confirmation");
  }
  return {
    orgId,
    userId,
    productKey,
    approvedUnitCost,
    confirmedSku: fields.get("--confirm-sku") ?? null,
    confirmedUnit: fields.get("--confirm-unit") ?? null,
    apply,
  };
}

export interface AbcMaterialCandidate {
  name: string;
  sku: string | null;
  purchaseUnit: string | null;
  canonicalMaterialKey: string | null;
  isActive: boolean;
  materialId: string | null;
  matchingSupplierProductCount: number;
  matchingMaterialCount: number;
  observationCount: number;
}

export function validateAbcMaterialCandidate(
  candidate: AbcMaterialCandidate,
  args: Pick<AbcMaterialActivationArgs, "confirmedSku" | "confirmedUnit" | "apply">,
): { sku: string; unit: string } {
  const sku = candidate.sku?.trim();
  const unit = candidate.purchaseUnit?.trim();
  if (!candidate.isActive || !sku || !unit || !candidate.canonicalMaterialKey?.trim()) {
    throw new Error("ABC supplier product needs active status, exact SKU, source unit, and governed canonical mapping");
  }
  if (candidate.materialId || candidate.matchingMaterialCount > 0) {
    throw new Error("ABC SKU is already linked to a Material; refusing an automatic duplicate");
  }
  if (candidate.matchingSupplierProductCount !== 1) {
    throw new Error("ABC SKU is missing or ambiguous across supplier products; manual resolution required");
  }
  if (candidate.observationCount < 1) {
    throw new Error("ABC supplier product has no source observation to review");
  }
  if (args.apply && (args.confirmedSku !== sku || args.confirmedUnit !== unit)) {
    throw new Error("Operator-confirmed SKU and unit must match source evidence exactly; no implicit conversion");
  }
  return { sku, unit };
}
