import { athenaMemoryScopes, athenaMemorySourceKinds, athenaMemoryStatuses, athenaMemoryRetentionTiers, athenaMemoryVisibilities } from "./types";

// Runtime validator for C006 AthenaMemoryRecord (docs/athena/contracts/
// README.md), following the same "reject undocumented top-level key"
// convention as every sibling module's resultValidation.ts. Backs
// athena:contracts via athena-memory.contracts.test.ts.

const REQUIRED_KEYS = [
  "id",
  "version",
  "orgId",
  "scope",
  "subjectId",
  "kind",
  "value",
  "source",
  "confidence",
  "retention",
  "status",
  "visibility",
  "createdByActor",
  "updatedByActor",
  "createdAt",
  "updatedAt",
  "metadata",
] as const;

const OPTIONAL_KEYS = ["supersedes", "lastAccessedAt"] as const;

const KNOWN_KEYS = new Set<string>([...REQUIRED_KEYS, ...OPTIONAL_KEYS]);

const VALID_SCOPES = new Set<string>(athenaMemoryScopes);
const VALID_STATUSES = new Set<string>(athenaMemoryStatuses);
const VALID_SOURCE_KINDS = new Set<string>(athenaMemorySourceKinds);
const VALID_RETENTION_TIERS = new Set<string>(athenaMemoryRetentionTiers);
const VALID_VISIBILITIES = new Set<string>(athenaMemoryVisibilities);

function assertNonEmptyString(value: unknown, field: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`AthenaMemoryRecord.${field} must be a non-empty string`);
  }
}

function assertActorRef(value: unknown, field: string): void {
  if (typeof value !== "object" || value === null) {
    throw new Error(`AthenaMemoryRecord.${field} must be an object`);
  }
  const actor = value as Record<string, unknown>;
  if (actor.type !== "user" && actor.type !== "system") {
    throw new Error(`AthenaMemoryRecord.${field}.type must be "user" or "system"`);
  }
  assertNonEmptyString(actor.id, `${field}.id`);
}

export function assertValidAthenaMemoryRecord(value: unknown): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new Error("AthenaMemoryRecord must be an object");
  }
  const candidate = value as Record<string, unknown>;

  for (const key of REQUIRED_KEYS) {
    if (!(key in candidate)) {
      throw new Error(`AthenaMemoryRecord is missing required key: ${key}`);
    }
  }
  for (const key of Object.keys(candidate)) {
    if (!KNOWN_KEYS.has(key)) {
      throw new Error(`AthenaMemoryRecord carries an undocumented top-level key: ${key}`);
    }
  }

  assertNonEmptyString(candidate.id, "id");
  if (candidate.version !== "1.0.0") {
    throw new Error(`AthenaMemoryRecord.version must be "1.0.0": ${String(candidate.version)}`);
  }
  assertNonEmptyString(candidate.orgId, "orgId");
  if (typeof candidate.scope !== "string" || !VALID_SCOPES.has(candidate.scope)) {
    throw new Error(`AthenaMemoryRecord.scope is not a recognized C006 scope: ${String(candidate.scope)}`);
  }
  assertNonEmptyString(candidate.subjectId, "subjectId");
  assertNonEmptyString(candidate.kind, "kind");
  if (!("value" in candidate)) {
    throw new Error("AthenaMemoryRecord is missing required key: value");
  }

  if (typeof candidate.source !== "object" || candidate.source === null) {
    throw new Error("AthenaMemoryRecord.source must be an object");
  }
  const source = candidate.source as Record<string, unknown>;
  if (typeof source.kind !== "string" || !VALID_SOURCE_KINDS.has(source.kind)) {
    throw new Error(`AthenaMemoryRecord.source.kind is not a recognized source kind: ${String(source.kind)}`);
  }
  if (typeof source.trusted !== "boolean") {
    throw new Error("AthenaMemoryRecord.source.trusted must be a boolean");
  }

  if (typeof candidate.confidence !== "number" || candidate.confidence < 0 || candidate.confidence > 1) {
    throw new Error("AthenaMemoryRecord.confidence must be a number between 0 and 1");
  }

  if (typeof candidate.retention !== "object" || candidate.retention === null) {
    throw new Error("AthenaMemoryRecord.retention must be an object");
  }
  const retention = candidate.retention as Record<string, unknown>;
  if (typeof retention.tier !== "string" || !VALID_RETENTION_TIERS.has(retention.tier)) {
    throw new Error(`AthenaMemoryRecord.retention.tier is not a recognized retention tier: ${String(retention.tier)}`);
  }
  if (retention.expiresAt !== undefined && typeof retention.expiresAt !== "string") {
    throw new Error("AthenaMemoryRecord.retention.expiresAt must be a string when present");
  }

  if (typeof candidate.status !== "string" || !VALID_STATUSES.has(candidate.status)) {
    throw new Error(`AthenaMemoryRecord.status is not a recognized status: ${String(candidate.status)}`);
  }
  if (candidate.supersedes !== undefined) {
    assertNonEmptyString(candidate.supersedes, "supersedes");
  }
  if (typeof candidate.visibility !== "string" || !VALID_VISIBILITIES.has(candidate.visibility)) {
    throw new Error(`AthenaMemoryRecord.visibility is not a recognized visibility: ${String(candidate.visibility)}`);
  }

  assertActorRef(candidate.createdByActor, "createdByActor");
  assertActorRef(candidate.updatedByActor, "updatedByActor");
  assertNonEmptyString(candidate.createdAt, "createdAt");
  assertNonEmptyString(candidate.updatedAt, "updatedAt");
  if (candidate.lastAccessedAt !== undefined) {
    assertNonEmptyString(candidate.lastAccessedAt, "lastAccessedAt");
  }
  if (typeof candidate.metadata !== "object" || candidate.metadata === null || Array.isArray(candidate.metadata)) {
    throw new Error("AthenaMemoryRecord.metadata must be an object");
  }
}
