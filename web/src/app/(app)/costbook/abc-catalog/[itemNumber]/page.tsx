import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, PackageSearch, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { getSessionToken } from "@/lib/session";
import { getAbcSupplyCatalogItem, type AbcCatalogDetail } from "@/lib/costbook-api";

export const metadata: Metadata = {
  title: "ABC Supply Product Details | TradeOS",
  description: "Unpriced provider-sourced product information from ABC Supply sandbox.",
};

function uomRows(input: unknown[]): Array<{ code: string; name: string; description: string }> {
  return input.slice(0, 25).flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const row = value as Record<string, unknown>;
    if (typeof row.code !== "string") return [];
    return [{
      code: row.code,
      name: typeof row.name === "string" ? row.name : "Unit",
      description: typeof row.description === "string" ? row.description : "",
    }];
  });
}

function variationRows(input: unknown[]): Array<{ size: string; length: string }> {
  return input.slice(0, 30).flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const row = value as Record<string, unknown>;
    const length = row.length && typeof row.length === "object" && !Array.isArray(row.length)
      ? row.length as Record<string, unknown> : {};
    return [{
      size: typeof row.size === "string" ? row.size : "Provider variation",
      length: typeof length.value === "string" ? [length.value, typeof length.uomCode === "string" ? length.uomCode : ""].filter(Boolean).join(" ") : "",
    }];
  });
}

export default async function AbcProductDetailsPage({
  params,
}: {
  params: Promise<{ itemNumber: string }>;
}) {
  const { itemNumber } = await params;
  const token = await getSessionToken();
  let item: AbcCatalogDetail | null = null;
  let error: string | null = null;
  if (!token) {
    error = "Sign in to TradeOS to view ABC Supply item details.";
  } else if (!/^[A-Za-z0-9._:-]{1,80}$/.test(itemNumber)) {
    error = "That ABC product identifier is not valid.";
  } else {
    try {
      item = await getAbcSupplyCatalogItem(token, itemNumber);
    } catch {
      error = "Item details are unavailable. ABC sandbox Product API access must be configured and enabled.";
    }
  }

  const units = item ? uomRows(item.uoms) : [];
  const variations = item ? variationRows(item.variations) : [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="ABC product details"
        description="ABC Supply sandbox • Live provider read • Not saved to TradeOS Costbook"
        backHref="/costbook/abc-catalog"
        backLabel="ABC catalog"
      />
      <section className="flex gap-3 rounded-xl border border-border/70 bg-card p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-sm font-semibold">Provider item — not an approved Material or price</p>
          <p className="text-sm leading-6 text-muted-foreground">
            Availability requires a confirmed branch and item variation. Customer pricing requires
            separately authorized ABC access, verified units, and TradeOS review before an estimate.
          </p>
        </div>
      </section>
      {error ? <EmptyState title="ABC item unavailable" description={error} /> : item ? (
        <>
          <article className="space-y-4 rounded-xl border border-border/70 bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <PackageSearch className="size-6 text-primary" aria-hidden="true" />
              <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
                {item.status === "inactive" ? "Inactive • Unpriced" : "Unpriced • Provider only"}
              </span>
            </div>
            <h1 className="text-xl font-semibold leading-7">{item.name || "ABC product"}</h1>
            <p className="break-all font-mono text-sm text-muted-foreground">ABC #{item.itemNumber}</p>
            {item.marketingDescription ? <p className="text-sm leading-6 text-muted-foreground">{item.marketingDescription}</p> : null}
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-muted-foreground">Manufacturer</dt><dd className="font-medium">{item.manufacturer || "Not provided"}</dd></div>
              <div><dt className="text-muted-foreground">ABC product family</dt><dd className="font-medium">{item.familyName || item.familyId || "Not provided"}</dd></div>
              <div><dt className="text-muted-foreground">ABC status</dt><dd className="font-medium">{item.status}</dd></div>
              <div><dt className="text-muted-foreground">Dimensions</dt><dd className="font-medium">{item.isDimensional ? "Verify required length variation" : "Not flagged as dimensional"}</dd></div>
            </dl>
          </article>
          {item.hierarchy.length > 0 ? (
            <section className="rounded-xl border border-border/70 bg-card p-5">
              <h2 className="font-semibold">ABC product classification</h2>
              <ol className="mt-3 grid gap-2 text-sm">
                {item.hierarchy.map((level, index) => (
                  <li key={level.level + level.code} className="flex gap-3">
                    <span className="w-6 shrink-0 text-muted-foreground">{index + 1}.</span>
                    <span>{level.label} <span className="text-muted-foreground">({level.code})</span></span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-xl border border-border/70 bg-card p-5">
              <h2 className="font-semibold">ABC supplied units</h2>
              {units.length ? <ul className="mt-3 space-y-2 text-sm">{units.map((unit) => (
                <li key={unit.code}><span className="font-medium">{unit.name} ({unit.code})</span>
                  <span className="ml-2 text-muted-foreground">{unit.description}</span></li>
              ))}</ul> : <p className="mt-3 text-sm text-muted-foreground">No unit list supplied.</p>}
              <p className="mt-3 text-xs text-muted-foreground">Stocking and costing units are not automatically interchangeable.</p>
            </section>
            <section className="rounded-xl border border-border/70 bg-card p-5">
              <h2 className="font-semibold">Dimensional variations</h2>
              {variations.length ? <ul className="mt-3 space-y-2 text-sm">{variations.map((v, i) => (
                <li key={i} className="flex flex-wrap justify-between gap-2"><span>{v.size}</span>
                  <span className="text-muted-foreground">{v.length}</span></li>
              ))}</ul> : <p className="mt-3 text-sm text-muted-foreground">No length variations reported.</p>}
              <p className="mt-3 text-xs text-muted-foreground">These values do not confirm branch stock.</p>
            </section>
          </div>
          {item.prop65Warnings.length > 0 ? (
            <p className="rounded-lg border border-border/70 p-4 text-sm text-muted-foreground">
              ABC reports Proposition 65 warning information for this product. Confirm applicable safety warnings directly with the supplier before purchase or installation.
            </p>
          ) : null}
          <Link href="/costbook/abc-catalog" className={buttonVariants({ variant: "outline" })}>
            <ArrowLeft className="size-4" aria-hidden="true" /> Back to catalog
          </Link>
        </>
      ) : null}
    </div>
  );
}
