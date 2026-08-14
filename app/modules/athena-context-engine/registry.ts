import { hasAllRequiredFeatureFlags, hasAllRequiredPermissions } from "./policy";
import { ATHENA_CONTEXT_SECTIONS, AthenaContextDiscoveryActor, AthenaContextProviderDefinition } from "./types";

// Code-defined, in-memory context provider catalog (docs/athena/roadmap/
// A3-context-engine-implementation-plan.md "Required Backend Seams" /
// "Migration Requirements": "code-defined/in-memory, matching A2's registry
// precedent"). createAthenaContextRegistry() builds a fresh, isolated
// catalog per call, same test-isolation reasoning as
// athena-tool-registry/registry.ts's createAthenaToolRegistry().
export interface AthenaContextRegistry {
  register(definition: AthenaContextProviderDefinition): void;
  resolve(id: string, version: string): AthenaContextProviderDefinition | undefined;
  discover(actor: AthenaContextDiscoveryActor): AthenaContextProviderDefinition[];
  // Every registered provider, regardless of permission/feature-flag fit.
  // The assembler uses this (not discover()) to iterate, so a
  // permission-denied provider can be marked status: "denied" in the
  // assembled context - a permission-filtered discover() would silently
  // drop it instead, and 07-context-engine/README.md requires denial to be
  // disclosed ("Permission-denied providers disclose only that access is
  // unavailable"), not hidden.
  list(): AthenaContextProviderDefinition[];
}

const VALID_ACTIVATIONS = new Set(["eager_minimal", "lazy_intent", "explicit_only"]);
const VALID_SENSITIVITIES = new Set(["public", "internal", "confidential", "restricted"]);
const VALID_CRITICALITIES = new Set(["critical", "important", "optional"]);
const VALID_FAILURE_BEHAVIORS = new Set(["stop", "degrade", "omit"]);
const VALID_CACHE_KEY_POLICIES = new Set(["none", "tenant_actor_permission_input"]);
const KNOWN_SECTIONS = new Set<string>(ATHENA_CONTEXT_SECTIONS);

// Same reverse-domain/semver rules as athena-tool-registry/registry.ts,
// applied to providers instead of tools.
const PROVIDER_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

// Exported for reuse by athena:contracts, matching A2's precedent of
// exercising the exact production validator rather than a test-only
// duplicate.
export function assertValidProviderDefinition(definition: AthenaContextProviderDefinition): void {
  if (typeof definition.id !== "string" || !PROVIDER_ID_PATTERN.test(definition.id)) {
    throw new Error(`AthenaContextProviderDefinition.id must be a lowercase reverse-domain-style id: ${String(definition.id)}`);
  }
  if (typeof definition.version !== "string" || !SEMVER_PATTERN.test(definition.version)) {
    throw new Error(`AthenaContextProviderDefinition.version must be a semver-compatible MAJOR.MINOR.PATCH string: ${String(definition.version)}`);
  }
  if (!definition.owner || typeof definition.owner !== "string") {
    throw new Error("AthenaContextProviderDefinition.owner must be a non-empty string");
  }
  if (!definition.name || typeof definition.name !== "string") {
    throw new Error("AthenaContextProviderDefinition.name must be a non-empty string");
  }
  if (typeof definition.priority !== "number" || !Number.isFinite(definition.priority)) {
    throw new Error("AthenaContextProviderDefinition.priority must be a finite number");
  }
  if (!KNOWN_SECTIONS.has(definition.section)) {
    throw new Error(`AthenaContextProviderDefinition.section is not a recognized C001 section: ${String(definition.section)}`);
  }
  if (!definition.description || typeof definition.description !== "string") {
    throw new Error("AthenaContextProviderDefinition.description must be a non-empty string");
  }
  if (!Array.isArray(definition.permissions)) {
    throw new Error("AthenaContextProviderDefinition.permissions must be an array");
  }
  if (!VALID_ACTIVATIONS.has(definition.activation)) {
    throw new Error(`AthenaContextProviderDefinition.activation is not valid: ${String(definition.activation)}`);
  }
  if (!Array.isArray(definition.allowedIntents)) {
    throw new Error("AthenaContextProviderDefinition.allowedIntents must be an array");
  }
  if (typeof definition.freshnessTtlMs !== "number" || definition.freshnessTtlMs < 0) {
    throw new Error("AthenaContextProviderDefinition.freshnessTtlMs must be a non-negative number");
  }
  if (typeof definition.timeoutMs !== "number" || definition.timeoutMs <= 0) {
    throw new Error("AthenaContextProviderDefinition.timeoutMs must be a positive number");
  }
  if (typeof definition.maxItems !== "number" || definition.maxItems <= 0) {
    throw new Error("AthenaContextProviderDefinition.maxItems must be a positive number");
  }
  if (typeof definition.maxBytes !== "number" || definition.maxBytes <= 0) {
    throw new Error("AthenaContextProviderDefinition.maxBytes must be a positive number");
  }
  if (!VALID_SENSITIVITIES.has(definition.sensitivity)) {
    throw new Error(`AthenaContextProviderDefinition.sensitivity is not valid: ${String(definition.sensitivity)}`);
  }
  if (!VALID_CACHE_KEY_POLICIES.has(definition.cacheKeyPolicy)) {
    throw new Error(`AthenaContextProviderDefinition.cacheKeyPolicy is not valid: ${String(definition.cacheKeyPolicy)}`);
  }
  if (!VALID_CRITICALITIES.has(definition.criticality)) {
    throw new Error(`AthenaContextProviderDefinition.criticality is not valid: ${String(definition.criticality)}`);
  }
  if (!VALID_FAILURE_BEHAVIORS.has(definition.failureBehavior)) {
    throw new Error(`AthenaContextProviderDefinition.failureBehavior is not valid: ${String(definition.failureBehavior)}`);
  }
  if (definition.criticality === "critical" && definition.failureBehavior !== "stop") {
    throw new Error('AthenaContextProviderDefinition.criticality "critical" requires failureBehavior "stop"');
  }
  if (definition.requiredFeatureFlags !== undefined && !Array.isArray(definition.requiredFeatureFlags)) {
    throw new Error("AthenaContextProviderDefinition.requiredFeatureFlags must be an array when present");
  }
  if (typeof definition.provide !== "function") {
    throw new Error("AthenaContextProviderDefinition.provide must be a function");
  }
}

function key(id: string, version: string): string {
  return `${id}@${version}`;
}

export function createAthenaContextRegistry(): AthenaContextRegistry {
  const entries = new Map<string, AthenaContextProviderDefinition>();
  const sectionOwners = new Map<string, string>();

  return {
    register(definition) {
      assertValidProviderDefinition(definition);
      const entryKey = key(definition.id, definition.version);
      if (entries.has(entryKey)) {
        throw new Error(`Athena context provider already registered: ${entryKey}`);
      }
      // A3 keeps at most one active provider per section (plan: "A section
      // may have at most one active provider registered at a time in A3").
      // That includes multiple versions of the same provider id: without an
      // explicit activation model, two versions would both fetch and race to
      // overwrite the same section key during assembly.
      const existingOwner = sectionOwners.get(definition.section);
      if (existingOwner) {
        throw new Error(`Athena context section "${definition.section}" is already owned by ${existingOwner}, cannot also register ${definition.id}`);
      }
      entries.set(entryKey, definition);
      sectionOwners.set(definition.section, definition.id);
    },

    resolve(id, version) {
      return entries.get(key(id, version));
    },

    discover(actor) {
      return [...entries.values()].filter((definition) => hasAllRequiredPermissions(actor.role, definition.permissions) && hasAllRequiredFeatureFlags(definition.requiredFeatureFlags, actor.featureFlags));
    },

    list() {
      return [...entries.values()].sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));
    },
  };
}
