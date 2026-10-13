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
  // Undefined means the API did not return a field; null means it explicitly
  // returned no code. Never label a partial/older API response "unmapped".
  const hasOmittedFields = unspsc === undefined || omniclass23 === undefined;
  const classificationStatus = hasCodes
    ? "recorded"
    : hasOmittedFields
      ? "unavailable"
      : "unmapped";

  return (
    <div
      className="grid gap-1.5 text-xs"
      data-material-classification={classificationStatus}
    >
      <p className="font-medium text-foreground">
        {classificationStatus === "recorded"
          ? "Classification codes recorded"
          : classificationStatus === "unavailable"
            ? "Classification unavailable"
            : "Classification unmapped"}
      </p>
      {hasCodes ? (
        <dl className="grid gap-1 text-muted-foreground">
          <div className="flex flex-wrap gap-x-2">
            <dt>UNSPSC</dt>
            <dd className="font-mono break-all text-foreground">{unspscCode ?? (unspsc === undefined ? "Unavailable" : "Not recorded")}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt>OmniClass 23</dt>
            <dd className="font-mono break-all text-foreground">{omniclassCode ?? (omniclass23 === undefined ? "Unavailable" : "Not recorded")}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-muted-foreground">
          {classificationStatus === "unavailable"
            ? "Classification fields were not provided by the API."
            : "No classification codes recorded."}
        </p>
      )}
      {!compact ? (
        <p className="text-muted-foreground">
          A code does not verify supplier identity, unit compatibility, or pricing.
        </p>
      ) : null}
    </div>
  );
}
