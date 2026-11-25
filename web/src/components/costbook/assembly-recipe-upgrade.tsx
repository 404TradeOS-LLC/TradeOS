"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CostItemSearchPicker } from "@/components/costbook/assembly-catalog";
import type { StarterCatalogComponent } from "@/components/costbook/assembly-catalog-model";
import type { CostItemCatalogRecord } from "@/components/costbook/cost-item-catalog-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { clientFetch } from "@/lib/clientApi";
import type { CostbookAssembly } from "@/lib/costbook-api";

type ComponentStructure = Pick<StarterCatalogComponent, "quantityPerUnit" | "compatibleUnits" | "allowedCostItemKinds">;
type RecipeChange = {
  key: string;
  label: string;
  change: "added" | "removed" | "changed" | "unchanged";
  mapping: "removed" | "needed" | "breaks" | "preserved";
  reasons: string[];
  component: StarterCatalogComponent | null;
  before: ComponentStructure | null;
  after: ComponentStructure | null;
  installedQuantity: number | null;
  costItem: { id: string; name: string; code: string } | null;
};
type Review = {
  fromVersion: number;
  toVersion: number | null;
  updateAvailable: boolean;
  reviewToken: string;
  blockers: string[];
  changes: RecipeChange[];
  measurement: { fromUnit: string; toUnit: string; fromBasis: string; toBasis: string } | null;
  history: { id: string; fromVersion: number; toVersion: number; actorId: string; upgradedAt: string }[];
};

const mappingLabels: Record<RecipeChange["mapping"], string> = {
  removed: "Mapping removed",
  needed: "Mapping needed",
  breaks: "Mapping needs replacement",
  preserved: "Mapping preserved",
};

export function AssemblyRecipeUpgrade({ assembly, canUpgrade }: { assembly: CostbookAssembly; canUpgrade: boolean }) {
  const router = useRouter();
  const [review, setReview] = useState<Review | null>(null);
  const [mappings, setMappings] = useState<Record<string, CostItemCatalogRecord | null>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const endpoint = `/costbook/assemblies/${assembly.id}/recipe-upgrade`;
  const required = review?.changes.filter(({ mapping }) => mapping === "needed" || mapping === "breaks") ?? [];
  const preserved = review?.changes.flatMap((change) => change.mapping === "preserved" && change.costItem ? [change.costItem.id] : []) ?? [];

  async function loadReview() {
    setBusy(true);
    setError("");
    setStatus("");
    setReview(null);
    setMappings({});
    try {
      setReview(await clientFetch<Review>(endpoint));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the recipe review.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmUpgrade() {
    if (!review || busy || !canUpgrade || review.blockers.length || required.some(({ key }) => !mappings[key])) return;
    setBusy(true);
    setError("");
    try {
      await clientFetch<CostbookAssembly>(endpoint, {
        method: "POST",
        body: JSON.stringify({
          reviewToken: review.reviewToken,
          componentMappings: required.map(({ key }) => ({ componentKey: key, costItemId: mappings[key]?.id })),
        }),
      });
      setReview(null);
      setMappings({});
      setStatus(`Upgraded to recipe version ${review.toVersion}.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upgrade the template.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Catalog recipe</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm">Installed version {assembly.installedRecipeVersion} · Catalog version {assembly.currentRecipeVersion ?? "unavailable"}</p>
          {assembly.updateAvailable ? <Badge variant="secondary">Update available</Badge> : null}
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={loadReview}>
            {assembly.updateAvailable ? "Review catalog update" : "View upgrade history"}
          </Button>
        </div>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <p role="status" className="text-sm">{status || (busy ? "Working…" : "")}</p>
        {review?.updateAvailable ? (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Version {review.fromVersion} → {review.toVersion}</h3>
            {review.measurement && (review.measurement.fromBasis !== review.measurement.toBasis || review.measurement.fromUnit !== review.measurement.toUnit) ? (
              <p className="text-sm">Measurement changes from {review.measurement.fromBasis} ({review.measurement.fromUnit}) to {review.measurement.toBasis} ({review.measurement.toUnit}).</p>
            ) : null}
            {review.blockers.map((blocker) => <p role="alert" className="text-sm text-destructive" key={blocker}>{blocker}</p>)}
            <ul className="divide-y rounded-md border border-border">
              {review.changes.map((change) => (
                <li className="space-y-2 p-3 text-sm" key={change.key}>
                  <p className="font-medium capitalize">{change.change} <span className="normal-case">· {change.label}</span></p>
                  {change.change !== "unchanged" ? (
                    <p>Quantity per unit {change.installedQuantity ?? "—"} → {change.after?.quantityPerUnit ?? "—"}</p>
                  ) : null}
                  {change.change !== "unchanged" ? (
                    <p className="text-muted-foreground">
                      Mapping requirements {formatRequirements(change.before)} → {formatRequirements(change.after)}
                    </p>
                  ) : null}
                  <p>{mappingLabels[change.mapping]}{change.costItem ? ` · ${change.costItem.code} · ${change.costItem.name}` : ""}</p>
                  {change.reasons.map((reason) => <p className="text-muted-foreground" key={reason}>{reason}</p>)}
                  {canUpgrade && !review.blockers.length && change.component && (change.mapping === "breaks" || change.mapping === "needed") ? (
                    <CostItemSearchPicker
                      initialOptions={[]}
                      valueId={mappings[change.key]?.id ?? ""}
                      valueItem={mappings[change.key] ?? undefined}
                      component={change.component}
                      unavailableIds={new Set([...preserved, ...Object.entries(mappings).flatMap(([key, item]) => key !== change.key && item ? [item.id] : [])])}
                      onSelect={(item) => setMappings((current) => ({ ...current, [change.key]: item }))}
                      disabled={busy}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
            {canUpgrade && !review.blockers.length ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">This updates the reusable template. Future unit cost can reflect the reviewed composition. Saved estimate prices and Cost Item prices stay as recorded.</p>
                <Button type="button" onClick={confirmUpgrade} disabled={busy || required.some(({ key }) => !mappings[key])}>
                  Confirm upgrade to version {review.toVersion}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
        {review ? (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Upgrade history</h3>
            {review.history.length ? (
              <ul className="space-y-1 text-sm">
                {review.history.map((entry) => (
                  <li key={entry.id}>
                    Version {entry.fromVersion} → {entry.toVersion} · <time dateTime={entry.upgradedAt}>{new Date(entry.upgradedAt).toLocaleString()}</time>
                    <span className="block break-all text-muted-foreground">User {entry.actorId}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">No upgrades recorded.</p>}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function formatRequirements(component: ComponentStructure | null) {
  return component ? `${component.compatibleUnits.join(", ")} / ${component.allowedCostItemKinds.join(", ")}` : "—";
}
