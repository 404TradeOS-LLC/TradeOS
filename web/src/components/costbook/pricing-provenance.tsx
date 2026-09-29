import { Badge } from "@/components/ui/badge";
import type { CostDataProvenanceStatus } from "@/lib/costbook-api";
import {
  formatDate,
  freshnessLabel,
  provenanceExplanation,
  provenanceLabel,
} from "@/components/costbook/research-review-model";

type CatalogPricingProvenanceProps = {
  mode: "catalog";
  supplierName: string | null;
  lastPriceUpdate: string | null;
  compact?: boolean;
};

type ResearchPricingProvenanceProps = {
  mode: "research";
  provenanceStatus: CostDataProvenanceStatus;
  sourceName: string;
  sourceReference: string | null;
  sourceDate: string;
  retrievedAt: string;
  regionalBasis: string;
  confidence: string;
  compact?: boolean;
};

export type PricingProvenanceProps =
  | CatalogPricingProvenanceProps
  | ResearchPricingProvenanceProps;

/**
 * Shared presentation boundary for pricing source evidence.
 *
 * Catalog Materials only have supplier + lastPriceUpdate, so this component
 * never upgrades those facts into a confidence/freshness verdict. Research
 * candidates carry a stronger evidence contract and may display their stored
 * provenance status, region, confidence, and source trail.
 */
export function PricingProvenance(props: PricingProvenanceProps) {
  if (props.mode === "catalog") {
    return (
      <div className="grid gap-1.5" data-pricing-provenance="catalog">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Stored Costbook price</Badge>
          <span className="text-sm text-foreground">
            {props.supplierName ?? "No supplier recorded"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {props.lastPriceUpdate
            ? `Price update recorded ${formatDate(props.lastPriceUpdate)}`
            : "No price-update date recorded"}
        </p>
        {!props.compact ? (
          <p className="text-xs text-muted-foreground">
            Supplier and update date are catalog facts, not a confidence score or a claim that the price is current local market pricing.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid gap-2" data-pricing-provenance="research">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{provenanceLabel(props.provenanceStatus)}</Badge>
        <span className="text-sm font-medium text-foreground">{props.sourceName}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {provenanceExplanation(props.provenanceStatus)}
      </p>
      <dl className={props.compact ? "grid gap-2 sm:grid-cols-2" : "grid gap-2 sm:grid-cols-2 lg:grid-cols-3"}>
        <EvidencePair
          label="Observed"
          value={`${formatDate(props.sourceDate)} · ${freshnessLabel(props.sourceDate)}`}
        />
        <EvidencePair label="Retrieved" value={formatDate(props.retrievedAt)} />
        <EvidencePair label="Market basis" value={props.regionalBasis} />
        <EvidencePair label="Confidence" value={props.confidence} />
        <EvidencePair label="Source reference" value={props.sourceReference ?? "n/a"} />
      </dl>
    </div>
  );
}

function EvidencePair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-foreground">{value}</dd>
    </div>
  );
}
