// Pure formatting/derivation helpers for the Athena Overview page. Kept
// dependency-free (see athena-state.ts's top-of-file comment for why: no
// relative imports, so this stays importable by node --test without needing
// explicit .ts extensions threaded through a whole module graph) so it can
// be unit tested directly.

export interface AthenaOverviewLike {
  requestCount: number;
}

export function hasAthenaActivity(overview: AthenaOverviewLike): boolean {
  return overview.requestCount > 0;
}

export function formatAthenaPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

export function formatAthenaMs(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(2)} s`;
}

export function formatAthenaUsd(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value !== 0 && Math.abs(value) < 1 ? 4 : 2,
  }).format(value);
}

export function formatAthenaCount(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US").format(value);
}

export const athenaWindowPresets = ["24h", "7d", "30d"] as const;
export type AthenaWindowPreset = (typeof athenaWindowPresets)[number];

export function resolveAthenaWindowPreset(value: string | string[] | undefined): AthenaWindowPreset {
  return value === "7d" || value === "30d" ? value : "24h";
}

const PRESET_HOURS: Record<AthenaWindowPreset, number> = { "24h": 24, "7d": 24 * 7, "30d": 24 * 30 };

export function buildAthenaWindow(preset: AthenaWindowPreset, now: Date = new Date()): { from: string; to: string } {
  const to = now.toISOString();
  const from = new Date(now.getTime() - PRESET_HOURS[preset] * 60 * 60 * 1000).toISOString();
  return { from, to };
}
