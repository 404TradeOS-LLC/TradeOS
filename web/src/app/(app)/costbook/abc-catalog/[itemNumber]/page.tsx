import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Package, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { getSessionToken } from "@/lib/session";
import { getAbcSupplyCatalogItem } from "@/lib/costbook-api";

export const metadata: Metadata = {
  title: "ABC Supply Product | Costbook | TradeOS",
  description: "Provider-backed ABC product identity, units and variations without assumed prices.",
};

function field(value: unknown, key: string): unknown {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)[key]
    : null;
}

function textValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function units(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    const code = textValue(field(row, "code"));
    const name = textValue(field(row, "name"));
    const role = textValue(field(row, "description"));
    return code || name ? [{ code, name, role }] : [];
  });
}

function variations(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const length = field(row, "length");
    return {
      size: textValue(field(row, "size")),
      type: textValue(field(row, "type")),
      length: textValue(field(length, "value")),
      uom: textValue(field(length, "uom")),
      conversionFactor: typeof field(row, "conversionFactor") === "number"
        ? field(row, "conversionFactor") as number : null,
    };
  });
}

export default async function AbcProductDetailPage({
  params,
}: {
  params: Promise<{ itemNumber: string }>;
}) {
  const { itemNumber } = await params;
  const token = await getSessionToken();
  if (!token) {
    return <EmptyState title="Sign in required" description="Sign in to inspect ABC Supply product details." />;
  }

  let product: Awaited<ReturnType<typeof getAbcSupplyCatalogItem>> | null = null;
  try {
    product = await getAbcSupplyCatalogItem(token, itemNumber);
  } catch {
    // Never display raw upstream provider errors or reveal credentials.
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="ABC Supply product unavailable" description="The product could not be verified against the authorized sandbox catalog." backHref="/costbook/abc-catalog" backLabel="ABC Catalog" />
        <EmptyState title="No verified product details" description="The product may be inactive, no longer listed, or the sandbox integration is not enabled. No Costbook data has changed." />
      </div>
    );
  }

  const productUnits = units(product.uoms);
  const productVariations = variations(product.variations);
  const warnings = product.prop65Warnings.flatMap((row) => {
    const label = textValue(field(row, "label"));
    return label && field(row, "display") !== false ? [label] : [];
  });
  const color = textValue(field(product.color, "name"));
  const finish = textValue(field(product.finish, "name"));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={product.name || "ABC Supply product"}
        description={"ABC Supply item " + product.itemNumber + " · Sandbox Product API · Unpriced"}
        backHref="/costbook/abc-catalog"
        backLabel="ABC Catalog"
      />

      <div className="flex gap-3 rounded-xl border border-border/70 bg-card p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-semibold text-foreground">Product details are not a priced Costbook Material</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            This provider record is viewed on demand. No product data, authorized customer-specific price,
            or availability has been saved to TradeOS. Check an eligible Ship-To account, branch,
            exact units and lengths before requesting a quote, then review the resulting Material cost.
          </p>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-2" aria-label="ABC product attributes">
        <article className="rounded-xl border border-border/70 bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-semibold"><Package className="size-4 text-primary" /> Product identity</div>
          <dl className="mt-4 grid gap-3 text-sm">
            <div><dt className="text-muted-foreground">ABC item number</dt><dd className="break-all font-mono font-medium">{product.itemNumber}</dd></div>
            <div><dt className="text-muted-foreground">Manufacturer</dt><dd>{product.manufacturer || "Not provided"}</dd></div>
            <div><dt className="text-muted-foreground">Family</dt><dd>{product.familyName || "Not provided"}</dd></div>
            <div><dt className="text-muted-foreground">Family ID</dt><dd className="break-all font-mono">{product.familyId || "Not provided"}</dd></div>
            <div><dt className="text-muted-foreground">Color</dt><dd>{color || "Not provided"}</dd></div>
            <div><dt className="text-muted-foreground">Finish</dt><dd>{finish || "Not provided"}</dd></div>
          </dl>
          {product.marketingDescription ? <p className="mt-4 border-t border-border/70 pt-4 text-sm leading-6 text-muted-foreground">{product.marketingDescription}</p> : null}
        </article>

        <article className="rounded-xl border border-border/70 bg-card p-4">
          <h2 className="text-sm font-semibold">Hierarchy and units</h2>
          {product.hierarchyLabels.length ? (
            <ol className="mt-3 flex flex-wrap gap-2" aria-label="ABC product hierarchy">
              {product.hierarchyLabels.map((label, index) => (
                <li key={index} className="rounded-md border border-border/70 px-2.5 py-1.5 text-xs text-muted-foreground">{label}</li>
              ))}
            </ol>
          ) : <p className="mt-3 text-sm text-muted-foreground">Provider hierarchy not supplied.</p>}
          <h3 className="mt-5 text-sm font-semibold">Provider units of measure</h3>
          {productUnits.length ? (
            <ul className="mt-2 divide-y divide-border/60">
              {productUnits.map((unit, i) => (
                <li key={i} className="flex justify-between gap-3 py-2 text-sm">
                  <span>{unit.name || unit.code}</span>
                  <span className="font-mono text-muted-foreground">{unit.code || "—"}{unit.role ? " · " + unit.role : ""}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-muted-foreground">Units have not been provided or verified.</p>}
        </article>
      </section>

      <section className="rounded-xl border border-border/70 bg-card p-4">
        <h2 className="text-sm font-semibold">Dimensions and length variations</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {product.isDimensional ? "A verified length variation is required before pricing." : "No dimensional-length requirement was reported."}
          {" "}Branch-specific eligibility is not yet verified.
        </p>
        {productVariations.length ? (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {productVariations.map((variation, i) => (
              <li key={i} className="rounded-lg border border-border/70 p-3 text-sm">
                <p className="font-medium">{variation.size || variation.type || "Provider variation"}</p>
                <p className="mt-1 text-muted-foreground">
                  {variation.length ? "Length: " + variation.length + (variation.uom ? " " + variation.uom : "") : "Length not supplied"}
                </p>
                {variation.conversionFactor !== null ? <p className="mt-1 text-xs text-muted-foreground">Provider conversion factor: {variation.conversionFactor}</p> : null}
              </li>
            ))}
          </ul>
        ) : <p className="mt-3 text-sm text-muted-foreground">No variation details were supplied.</p>}
      </section>

      {warnings.length ? (
        <section className="rounded-xl border border-border/70 bg-card p-4" aria-label="Product safety warnings">
          <h2 className="text-sm font-semibold">Provider safety warnings</h2>
          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
            {warnings.map((warning, index) => <li key={index}>{warning}</li>)}
          </ul>
        </section>
      ) : null}

      {product.familyItems.length ? (
        <section className="rounded-xl border border-border/70 bg-card p-4">
          <h2 className="text-sm font-semibold">Related family products</h2>
          <p className="mt-1 text-xs text-muted-foreground">Related family records are not a guarantee of branch availability or pricing.</p>
          <ul className="mt-3 divide-y divide-border/70">
            {product.familyItems.map((relative) => (
              <li key={relative.itemNumber} className="py-3">
                <Link className="text-sm font-medium underline-offset-4 hover:underline" href={"/costbook/abc-catalog/" + encodeURIComponent(relative.itemNumber)}>
                  {relative.name || relative.itemNumber}
                </Link>
                <p className="text-xs text-muted-foreground">ABC #{relative.itemNumber}{relative.color ? " · " + relative.color : ""}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-border/70 bg-card p-4">
        <h2 className="font-semibold">Branch ordering eligibility</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Verify which ABC branches list this item and its ordering length options.
          This does not confirm inventory quantities, your authorized Ship-To location, or pricing.
        </p>
        <Link className="mt-3 inline-block text-sm font-semibold text-primary underline underline-offset-4"
          href={"/costbook/abc-catalog/" + encodeURIComponent(product.itemNumber) + "/availability"}>
          Check ABC listed branches
        </Link>
      </section>

      <Link href="/costbook/abc-catalog" className="inline-flex items-center gap-2 text-sm font-medium underline-offset-4 hover:underline">
        <ArrowLeft className="size-4" /> Back to ABC Catalog
      </Link>
    </div>
  );
}
