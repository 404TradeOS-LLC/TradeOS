import type { AthenaMemoryRecord, AthenaMemoryWriteCandidate, AthenaMemoryWriteDecision } from "./types";

// Deterministic, non-LLM memory write policy (docs task brief Step 6;
// 08-memory/README.md "Memory Poisoning Defenses" and "Conflict
// Resolution"). No sophisticated AI extractor - a fixed set of small,
// independently testable, named rules evaluated in order. Every rule here
// is content-agnostic and business-agnostic: it never inspects what a
// memory is *about*, only whether it is safe/appropriate to persist.

interface AthenaMemoryContentDetector {
  name: string;
  matches(value: unknown): boolean;
}

// Field-name detector: catches secret-shaped data regardless of how it is
// phrased as a string, by walking every object key a candidate value or its
// metadata contains. Deliberately one pattern per detector, not one giant
// alternation covering every case in this module - see STRING_SECRET_PATTERNS
// below for the second, independent detector.
const SENSITIVE_FIELD_NAME_PATTERN =
  /(password|passwd|secret|token|api[_-]?key|access[_-]?key|refresh[_-]?token|client[_-]?secret|credential|authorization|auth[_-]?header|cookie|private[_-]?key|ssn|social[_-]?security|card(?:[_-]?number)?|\bcvv\b|\bcvc\b|bank[_-]?account|routing[_-]?number)/i;

const STRING_SECRET_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: "jwt", pattern: /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/ },
  { name: "bearer_header", pattern: /^Bearer\s+\S+$/i },
  { name: "aws_access_key_id", pattern: /^AKIA[0-9A-Z]{16}$/ },
  { name: "pem_private_key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "generic_prefixed_api_key", pattern: /^(sk|pk_live|pk_test|rk_live|ghp|gho|ghu|ghs|xox[baprs])[-_][A-Za-z0-9_]{10,}$/ },
];

const MAX_WALK_DEPTH = 6;

function objectKeysDeep(value: unknown, depth = 0, seen = new Set<unknown>()): string[] {
  if (depth > MAX_WALK_DEPTH || value === null || typeof value !== "object" || seen.has(value)) return [];
  seen.add(value);
  if (Array.isArray(value)) {
    return value.flatMap((item) => objectKeysDeep(item, depth + 1, seen));
  }
  const record = value as Record<string, unknown>;
  return Object.keys(record).flatMap((key) => [key, ...objectKeysDeep(record[key], depth + 1, seen)]);
}

function stringValuesDeep(value: unknown, depth = 0, seen = new Set<unknown>()): string[] {
  if (depth > MAX_WALK_DEPTH) return [];
  if (typeof value === "string") return [value];
  if (value === null || typeof value !== "object" || seen.has(value)) return [];
  seen.add(value);
  if (Array.isArray(value)) {
    return value.flatMap((item) => stringValuesDeep(item, depth + 1, seen));
  }
  const record = value as Record<string, unknown>;
  return Object.values(record).flatMap((item) => stringValuesDeep(item, depth + 1, seen));
}

// Extensible list (docs task Step 6: "extensible so additional sensitive
// categories can be added later"). Append additional detectors here rather
// than editing an existing one.
const PROHIBITED_CONTENT_DETECTORS: AthenaMemoryContentDetector[] = [
  {
    name: "sensitive_field_name",
    matches: (value) => objectKeysDeep(value).some((key) => SENSITIVE_FIELD_NAME_PATTERN.test(key)),
  },
  {
    name: "sensitive_string_pattern",
    matches: (value) => stringValuesDeep(value).some((str) => STRING_SECRET_PATTERNS.some(({ pattern }) => pattern.test(str.trim()))),
  },
];

// Exported for direct unit testing of individual detectors and for reuse if
// a future caller wants to pre-screen content before ever constructing a
// write candidate.
export function detectProhibitedMemoryContent(value: unknown): string | null {
  for (const detector of PROHIBITED_CONTENT_DETECTORS) {
    if (detector.matches(value)) return detector.name;
  }
  return null;
}

// Source trust ranking (08-memory/README.md "Conflict Resolution": "ranks
// admin policy and application records above conversation-derived
// preference"). A write from a lower-ranked source than the record it would
// overwrite is ignored rather than silently downgrading an authoritative
// value - the caller sees why via reasonCode; nothing is corrected/shown to
// the user by this infrastructure layer (that is a future capability's job).
const SOURCE_RANK: Record<string, number> = {
  admin_policy: 5,
  application_record: 4,
  approved_action: 3,
  event: 2,
  document: 1,
  user_message: 0,
};

export const ATHENA_MEMORY_DEFAULT_CONFIDENCE = 0.6;

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Pure decision function - no I/O, no clock reads beyond what the caller
// already resolved into `existing`. service.ts is responsible for loading
// `existing` (the current active record for this candidate's stable key, if
// any) and for validating confidence range / retention expiry as input
// errors before ever calling this function (see types.ts's
// AthenaMemoryWriteReasonCode comment for why those are not decision
// outcomes).
export function evaluateAthenaMemoryWritePolicy(candidate: AthenaMemoryWriteCandidate, resolvedConfidence: number, existing: AthenaMemoryRecord | null): AthenaMemoryWriteDecision {
  if (!candidate.source.trusted) {
    return { decision: "ignore", reasonCode: "athena_memory_write_rejected_untrusted_source", confidence: resolvedConfidence };
  }

  if (detectProhibitedMemoryContent(candidate.value) || detectProhibitedMemoryContent(candidate.metadata)) {
    return { decision: "ignore", reasonCode: "athena_memory_write_rejected_prohibited_content", confidence: resolvedConfidence };
  }

  if (!existing) {
    return { decision: "store", reasonCode: "athena_memory_created", confidence: resolvedConfidence };
  }

  if (deepEqual(existing.value, candidate.value)) {
    return { decision: "ignore", reasonCode: "athena_memory_duplicate_ignored", confidence: existing.confidence };
  }

  const existingRank = SOURCE_RANK[existing.source.kind] ?? 0;
  const candidateRank = SOURCE_RANK[candidate.source.kind] ?? 0;
  if (candidateRank < existingRank) {
    return { decision: "ignore", reasonCode: "athena_memory_write_ignored_lower_rank_source", confidence: existing.confidence };
  }

  return { decision: "update", reasonCode: "athena_memory_updated_existing", confidence: resolvedConfidence };
}
