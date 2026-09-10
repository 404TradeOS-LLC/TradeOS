import { z } from "zod";
import type {
  AthenaPluginManifest,
  AthenaPluginManifestValidationIssue,
  AthenaPluginManifestValidationResult,
} from "./types";

const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const PLUGIN_ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)+$/;
const HOST_PATTERN = /^(?!-)(?:[a-z0-9-]+\.)+[a-z]{2,}$/i;

const manifestSchema = z.object({
  id: z.string().min(3),
  name: z.string().min(1),
  version: z.string().min(1),
  publisher: z.string().min(1),
  athenaContractVersion: z.string().min(1),
  tools: z.array(z.string().min(1)).default([]),
  contextProviders: z.array(z.string().min(1)).default([]),
  eventsConsumed: z.array(z.string().min(1)).default([]),
  eventsPublished: z.array(z.string().min(1)).default([]),
  permissions: z.array(z.string().min(1)),
  dataUse: z.record(z.unknown()),
  supportUrl: z.string().url().optional(),
  network: z.object({ allowedHosts: z.array(z.string().min(1)) }).optional(),
}).strict();

function semverMajor(version: string): number | null {
  if (!SEMVER_PATTERN.test(version)) return null;
  const major = Number(version.split(".", 1)[0]);
  return Number.isSafeInteger(major) ? major : null;
}

function pushDuplicateIssues(values: string[], path: string, issues: AthenaPluginManifestValidationIssue[]): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) issues.push({ code: "duplicate_capability", path, message: `Duplicate capability: ${value}` });
    seen.add(value);
  }
}

function pushNamespaceIssues(values: string[], pluginId: string, path: string, issues: AthenaPluginManifestValidationIssue[]): void {
  for (const value of values) {
    if (!value.startsWith(`${pluginId}.`)) {
      issues.push({ code: "invalid_manifest", path, message: `${path} capability must be namespaced under ${pluginId}: ${value}` });
    }
  }
}

export function validateAthenaPluginManifest(
  input: unknown,
  supportedAthenaContractVersion = "1.0.0",
): AthenaPluginManifestValidationResult {
  const parsed = manifestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({ code: "invalid_manifest" as const, path: issue.path.join("."), message: issue.message })),
    };
  }

  const manifest = parsed.data as AthenaPluginManifest;
  const issues: AthenaPluginManifestValidationIssue[] = [];

  if (!PLUGIN_ID_PATTERN.test(manifest.id)) {
    issues.push({ code: "invalid_plugin_id", path: "id", message: "Plugin id must be a reverse-domain-style lowercase identifier." });
  }
  if (!SEMVER_PATTERN.test(manifest.version)) {
    issues.push({ code: "invalid_version", path: "version", message: "Plugin version must be semantic versioning." });
  }

  const requestedMajor = semverMajor(manifest.athenaContractVersion);
  const supportedMajor = semverMajor(supportedAthenaContractVersion);
  if (requestedMajor === null) {
    issues.push({ code: "invalid_contract_version", path: "athenaContractVersion", message: "Athena contract version must be semantic versioning." });
  } else if (supportedMajor === null || requestedMajor !== supportedMajor) {
    issues.push({
      code: "incompatible_contract_major",
      path: "athenaContractVersion",
      message: `Plugin contract major ${requestedMajor} is not compatible with supported major ${supportedMajor ?? "unknown"}.`,
    });
  }

  if (!manifest.publisher.trim()) issues.push({ code: "invalid_publisher", path: "publisher", message: "Publisher is required." });

  pushDuplicateIssues(manifest.tools, "tools", issues);
  pushDuplicateIssues(manifest.contextProviders, "contextProviders", issues);
  pushDuplicateIssues(manifest.eventsConsumed, "eventsConsumed", issues);
  pushDuplicateIssues(manifest.eventsPublished, "eventsPublished", issues);
  pushDuplicateIssues(manifest.permissions, "permissions", issues);
  pushNamespaceIssues(manifest.tools, manifest.id, "tools", issues);
  pushNamespaceIssues(manifest.contextProviders, manifest.id, "contextProviders", issues);

  for (const host of manifest.network?.allowedHosts ?? []) {
    const normalized = host.trim().toLowerCase();
    if (!HOST_PATTERN.test(normalized) || normalized === "localhost" || normalized.endsWith(".localhost")) {
      issues.push({ code: "invalid_network_host", path: "network.allowedHosts", message: `Invalid or unsafe network host declaration: ${host}` });
    }
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true, manifest };
}

export { manifestSchema as athenaPluginManifestSchema };
