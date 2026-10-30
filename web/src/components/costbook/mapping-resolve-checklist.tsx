export interface MappingResolveChecklistProps {
  mappedCount: number;
  totalCount: number;
  incompatibleLabel: string | null;
  incompatibleReasons: string[];
  allMappedItemsActive: boolean;
  duplicateMapping: boolean;
}

/**
 * "Before you continue" gate for the estimate mapping resolve screen.
 *
 * Purely presentational: every item mirrors a check the install path already
 * enforces (mapped identity, unit/kind compatibility, organization/active
 * access, snapshot persistence on the separate Add). It introduces no new
 * backend rule; the Resolve action stays disabled until the same conditions
 * the install mutation requires are met.
 */
export function MappingResolveChecklist({
  mappedCount,
  totalCount,
  incompatibleLabel,
  incompatibleReasons,
  allMappedItemsActive,
  duplicateMapping,
}: MappingResolveChecklistProps) {
  const unmappedCount = Math.max(0, totalCount - mappedCount);
  const identityReady = totalCount > 0 && mappedCount === totalCount && !duplicateMapping;
  const compatibilityReady = incompatibleLabel === null;
  const accessReady = mappedCount > 0 && allMappedItemsActive;

  return (
    <section aria-label="Before you continue" className="space-y-2 rounded-lg border border-border/70 bg-background/75 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Before you continue</p>
      <ul className="space-y-1.5 text-sm">
        <li>
          <span aria-hidden="true">{identityReady ? "✓ " : "○ "}</span>
          <strong className="font-medium">Every recipe slot is mapped. </strong>
          <span className="text-muted-foreground">
            {duplicateMapping
              ? "Each recipe slot must use a different Costbook item."
              : identityReady
                ? `All ${totalCount} slot${totalCount === 1 ? "" : "s"} mapped.`
                : `Map ${unmappedCount} more component${unmappedCount === 1 ? "" : "s"}.`}
          </span>
        </li>
        <li>
          <span aria-hidden="true">{compatibilityReady ? "✓ " : "○ "}</span>
          <strong className="font-medium">Every mapped item is compatible. </strong>
          <span className="text-muted-foreground">
            {compatibilityReady
              ? "Each mapped item uses a compatible unit and cost type."
              : `${incompatibleLabel} needs a compatible unit and cost type${incompatibleReasons.length > 0 ? `: ${incompatibleReasons.join(" · ")}.` : "."}`}
          </span>
        </li>
        <li>
          <span aria-hidden="true">{accessReady ? "✓ " : "○ "}</span>
          <strong className="font-medium">Every mapped item is an active organization item. </strong>
          <span className="text-muted-foreground">
            {mappedCount === 0
              ? "Waiting for mapped items."
              : accessReady
                ? "Mapped items come from your organization's active Costbook."
                : "Mapped items must be active items from your organization."}
          </span>
        </li>
        <li>
          <strong className="font-medium">Adding keeps a price snapshot. </strong>
          <span className="text-muted-foreground">
            After installing, the separate Add writes an estimate line that keeps its own price, so later Costbook changes
            won&apos;t silently change it.
          </span>
        </li>
      </ul>
    </section>
  );
}
