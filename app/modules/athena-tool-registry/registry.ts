import { AthenaToolDefinition, AthenaToolDiscoveryActor, AthenaToolResolution } from "./types";
import { hasAllRequiredFeatureFlags, hasAllRequiredPermissions } from "./policy";

interface RegistryEntry {
  definition: AthenaToolDefinition<unknown, unknown>;
  removed: boolean;
}

// Code-defined, in-memory tool catalog (docs/athena/roadmap/
// A2-tool-registry-implementation-plan.md "Required Backend Seams" /
// "Migration Requirements": "A2's registry is a static, code-loaded
// catalog... not a database table"). createAthenaToolRegistry() builds a
// fresh, isolated catalog per call rather than a module-level singleton, so
// tests can register/remove/discover without leaking state across test
// files - the registry is still entirely code-defined and non-persisted
// either way; nothing here is written to or read from a database.
export interface AthenaToolRegistry {
  register(definition: AthenaToolDefinition<unknown, unknown>): void;
  // Does not delete the entry - marks it so resolve() can distinguish "never
  // existed" (tool_not_found) from "existed and was retired" (tool_removed),
  // per docs/athena/06-tool-registry/README.md's versioning rules. A2 has no
  // production removal workflow; this exists so the tool_removed path is
  // exercised deterministically by tests.
  remove(id: string, version: string): void;
  resolve(id: string, version: string): AthenaToolResolution;
  discover(actor: AthenaToolDiscoveryActor): AthenaToolDefinition<unknown, unknown>[];
}

// Stable lowercase reverse-domain-style ID (docs/athena/roadmap/
// A2-tool-registry-implementation-plan.md "Tool Identity, Naming, And
// Versioning Rules": "tradeos.<module>.<capability>", e.g.
// "tradeos.athena.fixture.echo"). Each dot-separated segment is
// lowercase-kebab; at least one dot is required, and leading/trailing/
// doubled dots are rejected because every segment must be non-empty.
const TOOL_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/;

// Semver-compatible MAJOR.MINOR.PATCH, with optional pre-release/build
// metadata. Rejects "latest", "v1", "1", "1.0", and whitespace - a
// non-semver version can't participate in major-version pinning (docs/athena/
// roadmap/A2-tool-registry-implementation-plan.md "Tool Identity, Naming,
// And Versioning Rules").
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const VALID_RISKS = new Set(["low", "medium", "high"]);
const VALID_CONFIRMATION_POLICIES = new Set(["never", "contextual", "always"]);
const VALID_IDEMPOTENCY = new Set(["required", "optional", "not_supported"]);
const VALID_COMPENSATION_POLICIES = new Set(["none", "compensating_action", "service_transaction", "draft_only"]);

function isZodLikeSchema(schema: unknown): schema is { safeParse: (input: unknown) => { success: boolean } } {
  return !!schema && typeof (schema as { safeParse?: unknown }).safeParse === "function";
}

// Validates every field the A2 exit criteria require to be present before a
// tool can be registered at all - timeoutMs, idempotency, compensationPolicy,
// and a Zod-like inputSchema all fail fast here rather than being discovered
// at first dispatch. Mirrors athena-kernel/telemetry.ts's
// assertValidTelemetryRecord posture of failing loudly at the boundary
// rather than trusting callers.
function assertValidToolDefinition(definition: AthenaToolDefinition<unknown, unknown>): void {
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
  if (definition.requiredFeatureFlags !== undefined && !Array.isArray(definition.requiredFeatureFlags)) {
    throw new Error("AthenaToolDefinition.requiredFeatureFlags must be an array when present");
  }
  if (typeof definition.execute !== "function") {
    throw new Error("AthenaToolDefinition.execute must be a function");
  }
}

function key(id: string, version: string): string {
  return `${id}@${version}`;
}

export function createAthenaToolRegistry(): AthenaToolRegistry {
  const entries = new Map<string, RegistryEntry>();
  const knownIds = new Set<string>();

  return {
    register(definition) {
      assertValidToolDefinition(definition);
      const entryKey = key(definition.id, definition.version);
      if (entries.has(entryKey)) {
        throw new Error(`Athena tool already registered: ${entryKey}`);
      }
      entries.set(entryKey, { definition, removed: false });
      knownIds.add(definition.id);
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
