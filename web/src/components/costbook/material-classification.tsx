type MaterialClassificationProps = {
  unspsc?: string | null;
  omniclass23?: string | null;
  compact?: boolean;
};

/**
 * Displays persisted material classification codes without inferring that a
 * supplier product, unit, price, or publication has been verified.
 */
export function MaterialClassification({
  unspsc,
  omniclass23,
  compact = false,
}: MaterialClassificationProps) {
  const unspscCode = unspsc?.trim() || null;
  const omniclassCode = omniclass23?.trim() || null;
  const hasCodes = Boolean(unspscCode || omniclassCode);

  return (
    <div
      className="grid gap-1.5 text-xs"
      data-material-classification={hasCodes ? "recorded" : "unmapped"}
    >
      <p className="font-medium text-foreground">
        {hasCodes ? "Classification codes recorded" : "Classification unmapped"}
      </p>
      {hasCodes ? (
        <dl className="grid gap-1 text-muted-foreground">
          <div className="flex flex-wrap gap-x-2">
            <dt>UNSPSC</dt>
            <dd className="font-mono break-all text-foreground">{unspscCode ?? "Not recorded"}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt>OmniClass 23</dt>
            <dd className="font-mono break-all text-foreground">{omniclassCode ?? "Not recorded"}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-muted-foreground">No classification codes recorded.</p>
      )}
      {!compact ? (
        <p className="text-muted-foreground">
          A code does not verify supplier identity, unit compatibility, or pricing.
        </p>
      ) : null}
    </div>
  );
}
