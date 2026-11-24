import { prisma } from "../../db/client";
import { priceFreshness, type PriceEvidenceTier, type PriceFreshnessState } from "../costbook/priceResolver";
import type { EstimateLineItemDTO, LinePriceReadiness } from "./types";

/**
 * Price-readiness signals for the estimate Price stage (DES-10-F3).
 *
 * The signal is derived at detail-read time from evidence the backend
 * already holds; it never reprices a saved line and never mutates the
 * estimate. The saved `unitCost` snapshot stays authoritative — this only
 * reports whether that price can be traced to a dated supplier record.
 *
 * Rules, in order:
 * - `missing` — the line records no price: saved `unitCost` is zero (or not
 *   a finite positive number) and its source has no priced component. A
 *   zero is not missing on its own: zero can be an intentionally recorded
 *   Costbook cost, so a priced component behind the zero means the price
 *   was recorded deliberately.
 * - `unverified` — a material price backs the line but no `lastPriceUpdate`
 *   was ever recorded for it, so recency cannot be verified.
 * - `warn` / `refresh` / `reject` — the worst freshness tier across the
 *   line's backing materials, via the shared `priceFreshness()` tiers.
 * - `current` — every backing material price is inside the current tier.
 * - `null` — no supplier material price backs the line (custom line, or a
 *   labor/equipment-only source), so no supplier-price signal applies.
 *
 * The evidence tier is `RECENT_RETAIL_VALIDATION`: a stored Costbook
 * material price is the org's recorded supplier/retail price, which is the
 * tier the price resolver itself assigns to retail-validated evidence.
 * That gives current ≤ 30 days, warn ≤ 60, refresh ≤ 90, reject > 90.
 */
const MATERIAL_PRICE_EVIDENCE_TIER: PriceEvidenceTier = "RECENT_RETAIL_VALIDATION";

const FRESHNESS_ORDER: readonly PriceFreshnessState[] = ["current", "warn", "refresh", "reject"];

/** Evidence the derivation needs for one line; the loader assembles it. */
export interface LinePriceEvidence {
  unitCost: number;
  /**
   * True when the line's source has at least one priced component (a
   * material record, an active labor rate with a production rate, or
   * equipment with a production rate). A $0 line with a priced component
   * is an intentionally recorded $0, not a missing price.
   */
  hasPricedComponent: boolean;
  /**
   * Last supplier-price update per material backing the line. Empty when
   * no material price backs the line; a null entry means the material has
   * a price but no recorded update date.
   */
  materialPriceDates: ReadonlyArray<Date | null>;
}

export function deriveLinePriceReadiness(
  evidence: LinePriceEvidence,
  now: Date = new Date(),
): LinePriceReadiness {
  const hasPrice = Number.isFinite(evidence.unitCost) && evidence.unitCost > 0;
  if (!hasPrice && !evidence.hasPricedComponent) return "missing";
  if (evidence.materialPriceDates.length === 0) return null;
  const dates = evidence.materialPriceDates.filter((date): date is Date => date !== null);
  if (dates.length !== evidence.materialPriceDates.length) return "unverified";
  let worst: PriceFreshnessState = "current";
  for (const date of dates) {
    const freshness = priceFreshness(MATERIAL_PRICE_EVIDENCE_TIER, date, now);
    if (FRESHNESS_ORDER.indexOf(freshness) > FRESHNESS_ORDER.indexOf(worst)) worst = freshness;
  }
  return worst;
}

interface SourcePriceEvidence {
  hasPricedComponent: boolean;
  materialPriceDates: Array<Date | null>;
}

/**
 * Attach a `priceReadiness` signal to each detail-read line item. Lines
 * whose source cannot be found (for example a cost item deleted after the
 * line was written) are treated as sourceless, the same as a custom line.
 * Assembly evidence is the aggregate of the leaf cost items; a circular
 * assembly reference contributes nothing new (the ancestor frame already
 * collects that assembly's leaves).
 */
export async function attachLinePriceReadiness(
  lines: EstimateLineItemDTO[],
  orgId?: string,
): Promise<EstimateLineItemDTO[]> {
  if (lines.length === 0) return lines;
  const now = new Date();

  // Phase 1 — assembly structure: an assembly line's evidence lives in its
  // leaf cost items, which no line references directly, so walk each
  // assembly once and collect every leaf cost-item id up front. The walk
  // caches in-flight promises (not results): two lines sharing an assembly
  // await the same collection, and the visited-set guard keeps a
  // collection from ever awaiting its own promise.
  interface AssemblyItemRow {
    costItemId: string | null;
    childAssemblyId: string | null;
  }
  const assemblyRowsCache = new Map<string, Promise<AssemblyItemRow[]>>();
  const loadAssemblyRows = (assemblyId: string, visited: ReadonlySet<string>): Promise<AssemblyItemRow[]> => {
    if (visited.has(assemblyId)) {
      // Circular reference: the ancestor frame already collects this
      // assembly's rows; contribute nothing new.
      return Promise.resolve([]);
    }
    const cached = assemblyRowsCache.get(assemblyId);
    if (cached) return cached;
    const pending = (async (): Promise<AssemblyItemRow[]> => {
      const next = new Set(visited);
      next.add(assemblyId);
      const items = await prisma.assemblyItem.findMany({
        where: { assemblyId, assembly: { orgId } },
        select: { costItemId: true, childAssemblyId: true },
      });
      await Promise.all(
        items
          .filter((item) => item.childAssemblyId !== null)
          .map((item) => loadAssemblyRows(item.childAssemblyId as string, next)),
      );
      return items;
    })();
    assemblyRowsCache.set(assemblyId, pending);
    return pending;
  };
  const assemblyIds = [
    ...new Set(lines.map((line) => line.assemblyId).filter((id): id is string => id !== null)),
  ];
  await Promise.all(assemblyIds.map((assemblyId) => loadAssemblyRows(assemblyId, new Set())));
  const assemblyRows = new Map<string, AssemblyItemRow[]>();
  for (const [assemblyId, rowsPromise] of assemblyRowsCache) {
    assemblyRows.set(assemblyId, await rowsPromise);
  }
  const leafCostItemIds = new Set<string>();
  for (const rows of assemblyRows.values()) {
    for (const row of rows) {
      if (row.costItemId) leafCostItemIds.add(row.costItemId);
    }
  }

  // Phase 2 — one batched cost-item load for direct lines and assembly leaves.
  const costItemIds = [
    ...new Set([
      ...lines.map((line) => line.costItemId).filter((id): id is string => id !== null),
      ...leafCostItemIds,
    ]),
  ];
  const costItems =
    costItemIds.length > 0
      ? await prisma.costItem.findMany({
          where: { id: { in: costItemIds }, orgId },
          select: {
            id: true,
            productionRate: true,
            laborRate: { select: { active: true } },
            material: { select: { lastPriceUpdate: true } },
            equipment: { select: { id: true } },
          },
        })
      : [];
  const costItemEvidence = new Map(costItems.map((item) => [item.id, toCostItemEvidence(item)]));

  // Phase 3 — pure evidence aggregation over the loaded rows.
  const collectAssembly = (assemblyId: string, visited: ReadonlySet<string>): SourcePriceEvidence => {
    if (visited.has(assemblyId)) {
      return { hasPricedComponent: false, materialPriceDates: [] };
    }
    const evidence: SourcePriceEvidence = { hasPricedComponent: false, materialPriceDates: [] };
    const next = new Set(visited);
    next.add(assemblyId);
    for (const item of assemblyRows.get(assemblyId) ?? []) {
      if (item.costItemId) {
        const leaf = costItemEvidence.get(item.costItemId);
        if (leaf) {
          evidence.hasPricedComponent ||= leaf.hasPricedComponent;
          evidence.materialPriceDates.push(...leaf.materialPriceDates);
        }
      } else if (item.childAssemblyId) {
        const child = collectAssembly(item.childAssemblyId, next);
        evidence.hasPricedComponent ||= child.hasPricedComponent;
        evidence.materialPriceDates.push(...child.materialPriceDates);
      }
    }
    return evidence;
  };

  return lines.map((line) => {
    let evidence: LinePriceEvidence;
    if (line.costItemId) {
      const source = costItemEvidence.get(line.costItemId);
      evidence = source
        ? {
            unitCost: line.unitCost,
            hasPricedComponent: source.hasPricedComponent,
            materialPriceDates: source.materialPriceDates,
          }
        : { unitCost: line.unitCost, hasPricedComponent: false, materialPriceDates: [] };
    } else if (line.assemblyId) {
      const source = collectAssembly(line.assemblyId, new Set());
      evidence = {
        unitCost: line.unitCost,
        hasPricedComponent: source.hasPricedComponent,
        materialPriceDates: source.materialPriceDates,
      };
    } else {
      evidence = { unitCost: line.unitCost, hasPricedComponent: false, materialPriceDates: [] };
    }
    return { ...line, priceReadiness: deriveLinePriceReadiness(evidence, now) };
  });
}

function toCostItemEvidence(item: {
  productionRate: unknown;
  laborRate: { active: boolean | null } | null;
  material: { lastPriceUpdate: Date | null } | null;
  equipment: { id: string } | null;
}): SourcePriceEvidence {
  // Mirrors CostDatabaseService.getUnitCost: a component only contributes
  // when it is present (and, for labor, active) with a production rate.
  // Presence — not value — is what counts: a $0 material or $0 labor rate
  // is still a recorded price.
  const hasProductionRate = item.productionRate != null;
  return {
    hasPricedComponent:
      item.material !== null ||
      (item.laborRate !== null && item.laborRate.active !== false && hasProductionRate) ||
      (item.equipment !== null && hasProductionRate),
    materialPriceDates: item.material ? [item.material.lastPriceUpdate] : [],
  };
}
