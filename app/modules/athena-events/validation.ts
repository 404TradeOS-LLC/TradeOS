// Runtime validator for C008 AthenaBusinessEvent (docs/athena/contracts/
// README.md), following the same "reject undocumented top-level key"
// convention as every sibling module's resultValidation.ts (e.g.
// athena-memory/resultValidation.ts's assertValidAthenaMemoryRecord). Backs
// athena:contracts via athena-events.contracts.test.ts. Deliberately does
// not check registry membership (registry.ts's
// isAthenaEventTypeVersionRegistered) - that is a closed-catalog concern for
// whichever module calls this validator, not a structural-shape concern.

const REQUIRED_KEYS = ["id", "type", "version", "orgId", "entity", "actor", "occurredAt", "payload", "correlationId", "idempotencyKey"] as const;

const OPTIONAL_KEYS = ["causationId", "isReplay", "replayedAt"] as const;

const KNOWN_KEYS = new Set<string>([...REQUIRED_KEYS, ...OPTIONAL_KEYS]);

const VALID_ACTOR_TYPES = new Set(["user", "system", "athena"]);

function assertNonEmptyString(value: unknown, field: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`AthenaBusinessEvent.${field} must be a non-empty string`);
  }
}

function assertEntityRef(value: unknown): void {
  if (typeof value !== "object" || value === null) {
    throw new Error("AthenaBusinessEvent.entity must be an object");
  }
  const entity = value as Record<string, unknown>;
  assertNonEmptyString(entity.type, "entity.type");
  assertNonEmptyString(entity.id, "entity.id");
}

function assertActorRef(value: unknown): void {
  if (typeof value !== "object" || value === null) {
    throw new Error("AthenaBusinessEvent.actor must be an object");
  }
  const actor = value as Record<string, unknown>;
  if (typeof actor.type !== "string" || !VALID_ACTOR_TYPES.has(actor.type)) {
    throw new Error(`AthenaBusinessEvent.actor.type must be "user", "system", or "athena": ${String(actor.type)}`);
  }
  if (actor.id !== null && typeof actor.id !== "string") {
    throw new Error("AthenaBusinessEvent.actor.id must be a string or null");
  }
}

export function assertValidAthenaBusinessEvent(value: unknown): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new Error("AthenaBusinessEvent must be an object");
  }
  const candidate = value as Record<string, unknown>;

  for (const key of REQUIRED_KEYS) {
    if (!(key in candidate)) {
      throw new Error(`AthenaBusinessEvent is missing required key: ${key}`);
    }
  }
  for (const key of Object.keys(candidate)) {
    if (!KNOWN_KEYS.has(key)) {
      throw new Error(`AthenaBusinessEvent carries an undocumented top-level key: ${key}`);
    }
  }

  assertNonEmptyString(candidate.id, "id");
  assertNonEmptyString(candidate.type, "type");
  assertNonEmptyString(candidate.version, "version");
  assertNonEmptyString(candidate.orgId, "orgId");
  assertEntityRef(candidate.entity);
  assertActorRef(candidate.actor);
  assertNonEmptyString(candidate.occurredAt, "occurredAt");
  if (!("payload" in candidate)) {
    throw new Error("AthenaBusinessEvent is missing required key: payload");
  }
  assertNonEmptyString(candidate.correlationId, "correlationId");
  assertNonEmptyString(candidate.idempotencyKey, "idempotencyKey");

  if (candidate.causationId !== undefined) {
    assertNonEmptyString(candidate.causationId, "causationId");
  }
  if (candidate.isReplay !== undefined && typeof candidate.isReplay !== "boolean") {
    throw new Error("AthenaBusinessEvent.isReplay must be a boolean when present");
  }
  if (candidate.replayedAt !== undefined) {
    assertNonEmptyString(candidate.replayedAt, "replayedAt");
  }
}
