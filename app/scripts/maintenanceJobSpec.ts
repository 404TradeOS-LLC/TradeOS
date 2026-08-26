// Shared by the three Athena observability maintenance scripts
// (run-athena-observability-alerts.ts, run-athena-observability-export.ts,
// run-athena-observability-retention.ts): parsing of
// ATHENA_OBSERVABILITY_MAINTENANCE_JOBS (format: "orgId:userId,orgId:userId")
// was previously duplicated identically in all three - extracted here so
// there is exactly one implementation to keep correct.

export interface MaintenanceJobSpec {
  orgId: string;
  userId: string;
}

export function parseMaintenanceJobSpecs(raw: string | undefined): MaintenanceJobSpec[] {
  if (!raw || raw.trim().length === 0) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const parts = entry.split(":").map((part) => part.trim());
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        throw new Error(`ATHENA_OBSERVABILITY_MAINTENANCE_JOBS entry "${entry}" must be in "orgId:userId" format`);
      }
      const [orgId, userId] = parts;
      return { orgId, userId };
    });
}

// Parses an integer-valued env var, falling back to `fallback` when unset,
// blank, or non-numeric. A value that parses but is zero or negative is
// rejected outright (thrown) rather than silently falling back: for a
// window-duration env var like ATHENA_OBSERVABILITY_EXPORT_WINDOW_MINUTES, a
// non-positive value would silently export nothing (or an inverted range)
// while the script still exits 0, which is worse than a loud startup
// failure.
export function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const truncated = Math.trunc(parsed);
  if (truncated <= 0) {
    throw new Error(`${name} must be a positive integer, received "${raw}"`);
  }
  return truncated;
}
