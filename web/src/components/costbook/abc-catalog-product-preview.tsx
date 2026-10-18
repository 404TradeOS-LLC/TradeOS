import Link from "next/link";
import { ChevronDown, PackageSearch, ShieldCheck } from "lucide-react";
import type { AbcCatalogProduct } from "@/lib/costbook-api";
import { abcFieldLabel, abcUnitLabels, abcVariationLabels } from "@/lib/abc-catalog-preview";

/**
 * Discloses the verified listing already loaded for this render, without
 * navigating or making a second provider/backend/database request.
 * The item-level ABC endpoint can return 403 for TPA catalog entries.
 */
export function AbcCatalogProductPreview({ product }: { product: AbcCatalogProduct }) {
  const units = abcUnitLabels(product.uoms);
  const variations = abcVariationLabels(product.variations);
  const color = abcFieldLabel(product.color);
  const finish = abcFieldLabel(product.finish);
  const warnings = product.prop65Warnings.slice(0, 12).flatMap((value) => {
    if (value && typeof value === "object" && !Array.isArray(value) &&
      (value as Record<string, unknown>).display === false) return [];
    const label = abcFieldLabel(value);
    return label ? [label] : [];
  });

  return (
    <details className="group rounded-xl border border-border/70 bg-card transition-colors open:border-primary/45">
      <summary
        className="cursor-pointer list-none rounded-xl p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
        aria-label={"Show ABC catalog details for " + (product.name || product.itemNumber)}
      >
        <div className="flex items-start justify-between gap-3">
          <PackageSearch className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">Unpriced</span>
        </div>
        <h2 className="mt-3 text-base font-semibold leading-6 text-foreground">
          {product.name || "ABC item — description not supplied"}
        </h2>
        <p className="mt-1 break-all font-mono text-xs text-muted-foreground">ABC #{product.itemNumber}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          {product.manufacturer || "Manufacturer not supplied"}
          {" · "}{product.familyName || product.familyId || "Family not supplied"}
        </p>
        <span className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-md border border-primary/40 px-3 py-2 text-sm font-semibold text-foreground">
          <span className="group-open:hidden">Show product details</span>
          <span className="hidden group-open:inline">Hide product details</span>
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
        </span>
      </summary>

      <div className="border-t border-border/70 px-4 pb-4 pt-4">
        <div className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p>Verified ABC Supply sandbox catalog listing. This opens instantly without another API request.
            Additional item-level specifications can be restricted by ABC and are not implied by this listing.</p>
        </div>
        <dl className="mt-4 grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-muted-foreground">ABC item number</dt><dd className="break-all font-mono">{product.itemNumber}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Manufacturer</dt><dd>{product.manufacturer || "Not supplied"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Product family</dt><dd>{product.familyName || "Not supplied"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Family ID</dt><dd className="break-all font-mono">{product.familyId || "Not supplied"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Color</dt><dd>{color || "Not supplied"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Finish</dt><dd>{finish || "Not supplied"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Unit options</dt><dd>{units.length ? units.join(", ") : "Not supplied"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Product type</dt><dd>{product.isDimensional ? "Dimensional — confirm exact length" : "No dimensional flag reported"}</dd></div>
        </dl>
        {variations.length ? (
          <section className="mt-4">
            <h3 className="text-sm font-semibold">Supplier-listed variations</h3>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {variations.map((label, index) => <li key={index} className="rounded-md bg-muted/35 px-2.5 py-2">{label}</li>)}
            </ul>
          </section>
        ) : <p className="mt-4 text-xs text-muted-foreground">ABC did not include variations in this catalog page.</p>}
        {warnings.length ? (
          <section className="mt-4">
            <h3 className="text-sm font-semibold">Provider safety warnings</h3>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {warnings.map((warning, index) => <li key={index}>{warning}</li>)}
            </ul>
          </section>
        ) : null}
        <div className="mt-4 space-y-2 border-t border-border/70 pt-3 text-xs text-muted-foreground">
          <p>Customer-specific price: <strong className="text-foreground">Not authorized or requested</strong>.
            Branch eligibility is not physical inventory, and no Material or Estimate line has been created.</p>
          <p>To authorize ABC account and branch pricing, visit{" "}
            <Link href="/settings" className="font-semibold text-primary underline underline-offset-4">Settings → Costbook</Link>.
            TradeOS&apos;s existing price probe is still limited to approved pilot SKUs.</p>
        </div>
      </div>
    </details>
  );
}
