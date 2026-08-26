import {
  AthenaRegisteredToolDefinition,
  AthenaToolCategory,
  AthenaToolDefinition,
  AthenaToolDiscoveryActor,
  AthenaToolOutputSchema,
  AthenaToolResolution,
  athenaToolCategories,
  athenaToolOutputSchemas,
} from "./types";
import { hasAllRequiredFeatureFlags, hasAllRequiredPermissions } from "./policy";

interface RegistryEntry {
  definition: AthenaRegisteredToolDefinition;
  removed: boolean;
}

export interface AthenaToolRegistry {
  register(definition: AthenaToolDefinition): void;
  remove(id: string, version: string): void;
  resolve(id: string, version: string): AthenaToolResolution;
  discover(actor: AthenaToolDiscoveryActor): AthenaRegisteredToolDefinition[];
}

const TOOL_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const VALID_RISKS = new Set(["low", "medium", "high"]);
const VALID_CONFIRMATION_POLICIES = new Set(["never", "contextual", "always"]);
const VALID_IDEMPOTENCY = new Set(["required", "optional", "not_supported"]);
const VALID_COMPENSATION_POLICIES = new Set(["none", "compensating_action", "service_transaction", "draft_only"]);
const VALID_CATEGORIES = new Set<string>(athenaToolCategories);
const VALID_OUTPUT_SCHEMAS = new Set<string>(athenaToolOutputSchemas);

/** Detects the minimal runtime interface required from an A2 input schema. */
function isZodLikeSchema(schema: unknown): schema is { safeParse: (input: unknown) => { success: boolean } } {
  return !!schema && typeof (schema as { safeParse?: unknown }).safeParse === "function";
}

/** Validates the raw registration contract before any legacy metadata defaults are applied. */
export function assertValidToolDefinition(definition: AthenaToolDefinition): void {
  if (typeof definition.id !== "string" || !TOOL_ID_PATTERN.test(definition.id)) {
    throw new Error(`AthenaToolDefinition.id must be a lowercase reverse-domain-style id (e.g. "tradeos.athena.fixture.echo"): ${String(definition.id)}`);
  }
  if (typeof definition.version !== "string" || !SEMVER_PATTERN.test(definition.version)) {
    throw new Error(`AthenaToolDefinition.version must be a semver-compatible MAJOR.MINOR.PATCH string: ${String(definition.version)}`);
  }
  if (!definition.owner || typeof definition.owner !== "string") {
    throw new Error("AthenaToolDefinition.owner must be a non-empty string");
  }
  if (!definition.description || typeof definition.description !== "string") {
    throw new Error("AthenaToolDefinition.description must be a non-empty string");
  }
  if (definition.name !== undefined && (typeof definition.name !== "string" || definition.name.trim().length === 0)) {
    throw new Error("AthenaToolDefinition.name must be a non-empty string when present");
  }
  if (definition.category !== undefined && !VALID_CATEGORIES.has(definition.category)) {
    throw new Error(`AthenaToolDefinition.category is not valid: ${String(definition.category)}`);
  }
  if (!Array.isArray(definition.permissions)) {
    throw new Error("AthenaToolDefinition.permissions must be an array");
  }
  if (!VALID_RISKS.has(definition.risk)) {
    throw new Error(`AthenaToolDefinition.risk is not valid: ${String(definition.risk)}`);
  }
  if (!VALID_CONFIRMATION_POLICIES.has(definition.confirmationPolicy)) {
    throw new Error(`AthenaToolDefinition.confirmationPolicy is not valid: ${String(definition.confirmationPolicy)}`);
  }
  if (typeof definition.timeoutMs !== "number" || definition.timeoutMs <= 0) {
    throw new Error("AthenaToolDefinition.timeoutMs must be a positive number");
  }
  if (!VALID_IDEMPOTENCY.has(definition.idempotency)) {
    throw new Error(`AthenaToolDefinition.idempotency must be declared: ${String(definition.idempotency)}`);
  }
  if (!VALID_COMPENSATION_POLICIES.has(definition.compensationPolicy)) {
    throw new Error(`AthenaToolDefinition.compensationPolicy is not valid: ${String(definition.compensationPolicy)}`);
  }
  if (!isZodLikeSchema(definition.inputSchema)) {
    throw new Error("AthenaToolDefinition.inputSchema must be a Zod-like schema exposing safeParse() in A2");
  }
  if (definition.outputSchema !== undefined && !VALID_OUTPUT_SCHEMAS.has(definition.outputSchema)) {
    throw new Error(`AthenaToolDefinition.outputSchema is not valid: ${String(definition.outputSchema)}`);
  }
  if (definition.requiredFeatureFlags !== undefined && !Array.isArray(definition.requiredFeatureFlags)) {
    throw new Error("AthenaToolDefinition.requiredFeatureFlags must be an array when present");
  }
  if (typeof definition.execute !== "function") {
    throw new Error("AthenaToolDefinition.execute must be a function");
  }
}

/** Converts the last namespaced ID segment into a stable human-readable default name. */
function titleCaseFromSegment(segment: string): string {
  return segment
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Infers a closed Athena tool category for legacy definitions that omit discovery metadata. */
function inferToolCategory(definition: AthenaToolDefinition): AthenaToolCategory {
  if (definition.category) {
    return definition.category;
  }
  const segments = definition.id.split(".");
  const toolsIndex = segments.indexOf("tools");
  if (toolsIndex >= 0 && segments[toolsIndex + 1] && VALID_CATEGORIES.has(segments[toolsIndex + 1])) {
    return segments[toolsIndex + 1] as AthenaToolCategory;
  }
  if (segments.includes("fixture")) {
    return "fixture";
  }
  return "system";
}

/** Produces the fully populated registered-tool contract stored and returned by the registry. */
function normalizeToolDefinition(definition: AthenaToolDefinition): AthenaRegisteredToolDefinition {
  const segments = definition.id.split(".");
  const defaultName = titleCaseFromSegment(segments[segments.length - 1] ?? definition.id);
  const outputSchema: AthenaToolOutputSchema = definition.outputSchema ?? "AthenaToolResult";

  return {
    ...definition,
    name: definition.name?.trim() || defaultName,
    category: inferToolCategory(definition),
    outputSchema,
  };
}

/** Builds the internal identity key for one exact tool-version registration. */
function key(id: string, version: string): string {
  return `${id}@${version}`;
}

/** Creates an isolated in-memory Athena tool registry with deterministic registration, resolution, removal, and discovery behavior. */
export function createAthenaToolRegistry(): AthenaToolRegistry {
  const entries = new Map<string, RegistryEntry>();
  const knownIds = new Set<string>();

  return {
    register(definition) {
      assertValidToolDefinition(definition);
      const normalized = normalizeToolDefinition(definition);
      const entryKey = key(normalized.id, normalized.version);
      if (entries.has(entryKey)) {
        throw new Error(`Athena tool already registered: ${entryKey}`);
      }
      entries.set(entryKey, { definition: normalized, removed: false });
      knownIds.add(normalized.id);
    },

    remove(id, version) {
      const entry = entries.get(key(id, version));
      if (!entry) {
        throw new Error(`Cannot remove an Athena tool that was never registered: ${key(id, version)}`);
      }
      entry.removed = true;
    },

    resolve(id, version) {
      const entry = entries.get(key(id, version));
      if (entry) {
        return entry.removed ? { outcome: "tool_removed" } : { outcome: "found", definition: entry.definition };
      }
      if (!knownIds.has(id)) {
        return { outcome: "tool_not_found" };
      }
      const knownVersions = [...entries.values()].filter((candidate) => !candidate.removed && candidate.definition.id === id).map((candidate) => candidate.definition);
      return { outcome: "tool_version_not_found", knownVersions };
    },

    discover(actor) {
      return [...entries.values()]
        .filter((entry) => !entry.removed)
        .map((entry) => entry.definition)
        .filter((definition) => hasAllRequiredPermissions(actor.role, definition.permissions))
        .filter((definition) => hasAllRequiredFeatureFlags(definition.requiredFeatureFlags, actor.featureFlags));
    },
  };
}
