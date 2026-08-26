import { detectSecrets } from "../athena-security/secretProtection";
import type { AthenaMemoryRecord, AthenaMemoryWriteCandidate, AthenaMemoryWriteDecision } from "./types";

// Deterministic, non-LLM memory write policy (docs task brief Step 6;
// 08-memory/README.md "Memory Poisoning Defenses" and "Conflict
// Resolution"). No sophisticated AI extractor - a fixed set of small,
// independently testable, named rules evaluated in order. Every rule here
// is content-agnostic and business-agnostic: it never inspects what a
// memory is *about*, only whether it is safe/appropriate to persist.

// A11 hardening: this module's own field-name/string-pattern secret
// detectors (originally defined inline here) were the first version of
// what is now athena-security/secretProtection.ts's centralized
// detectSecrets() - the same detector telemetry (athena-kernel/
// telemetry.ts), events (athena-events/publisher.ts), and tool results
// (athena-tool-sdk/results.ts) now all call into, so the pattern list only
// needs to be maintained in one place. This function keeps its original
// name/signature (a detector-name string or null) since athena-memory's own
// write policy below only ever needs "is there prohibited content, and
// what should the audit trail call it" - not the full multi-detector-name
// array detectSecrets() returns for other callers.
export function detectProhibitedMemoryContent(value: unknown): string | null {
  const result = detectSecrets(value);
  return result.detected ? result.detectorNames[0] : null;
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
