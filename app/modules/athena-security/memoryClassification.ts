import type { AthenaMemoryClassification } from "./types";

// Memory classification (task brief "Subagent 4 - Memory Security":
// "Memory classification: user preference, business fact, temporary
// context, system knowledge, untrusted information"). Derived from a write
// candidate's existing scope/kind/source (athena-memory/types.ts's
// AthenaMemoryWriteCandidate) rather than a new required field on the
// closed C006 AthenaMemoryRecord contract - see types.ts's
// AthenaMemoryClassification comment. A caller that wants this persisted
// stores it under the record's own open `metadata` field; this module never
// writes to storage itself (that stays athena-memory's job).
export interface AthenaMemoryClassificationInput {
  scope: "user" | "organization" | "project" | "job" | "conversation";
  kind: string;
  sourceKind: "user_message" | "approved_action" | "application_record" | "event" | "document" | "admin_policy";
  sourceTrusted: boolean;
}

export function classifyAthenaMemory(candidate: AthenaMemoryClassificationInput): AthenaMemoryClassification {
  // Untrusted-source content is classified as such regardless of what scope
  // or kind it claims - this mirrors writePolicy.ts's own posture that
  // `source.trusted` is load-bearing and checked before anything else.
  // Whether the *write* is ultimately accepted is still entirely
  // writePolicy.ts's decision; this function only labels the classification
  // a caller sees, including for content writePolicy already rejected (so
  // an audit trail can say what kind of untrusted thing was rejected).
  if (!candidate.sourceTrusted) return "untrusted_information";

  if (candidate.sourceKind === "admin_policy") return "system_knowledge";

  if (candidate.scope === "conversation") return "temporary_context";

  if (candidate.scope === "user" && candidate.kind.startsWith("preference.")) return "user_preference";

  if (candidate.sourceKind === "application_record" || candidate.sourceKind === "event") return "business_fact";

  // A user-scoped, non-preference-kind memory from a conversational source
  // (e.g. a recalled fact about the user that isn't a UI preference) is
  // still fundamentally about the user's own stated context, not a
  // durable business record - classified as a preference-adjacent
  // temporary context rather than mislabeled as an organization-wide
  // business fact.
  if (candidate.scope === "user") return "user_preference";

  return "business_fact";
}
