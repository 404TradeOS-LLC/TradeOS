export type EstimateCatalogKind = "costItem" | "assembly" | "starterAssembly" | null;

/**
 * An estimate source must be explicitly selected and its current Costbook
 * unit-cost preview must resolve before offering the persisted Add action.
 * The backend still owns the authoritative cost captured at save time.
 */
export function canAddReviewedEstimateCatalogItem(input: {
  kind: EstimateCatalogKind;
  quantity: string;
  unitCost: number | undefined;
  previewPending: boolean;
  adding: boolean;
}): boolean {
  const quantity = Number(input.quantity);
  return (
    (input.kind === "costItem" || input.kind === "assembly") &&
    input.quantity.trim().length > 0 &&
    Number.isFinite(quantity) &&
    quantity > 0 &&
    input.unitCost !== undefined &&
    Number.isFinite(input.unitCost) &&
    input.unitCost >= 0 &&
    !input.previewPending &&
    !input.adding
  );
}
