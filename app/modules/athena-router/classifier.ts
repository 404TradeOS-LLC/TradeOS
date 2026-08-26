import { AthenaRouterResult, AthenaRoutingStrategy } from "./types";

// Deterministic, non-LLM intent classification (docs/athena/04-system-architecture/
// README.md "Intent Router"). No model call - mirrors athena-kernel/policy.ts's
// classifyAthenaCapability precedent (word-boundary keyword matching).
//
// Order matters: dispatch-overview and knowledge-lookup phrases are checked
// BEFORE the generic mutation-verb match, not after. "dispatch" and
// "schedule" are themselves mutation keywords below - a mutation-first
// ordering would misclassify "show me the dispatch board" or "give me a
// schedule overview" as mutate_business_record, since those verbs appear as
// bare words inside otherwise read-only noun phrases. The more specific
// multi-word intent phrases are matched first so they win over the generic
// single-verb classification.
const DISPATCH_OVERVIEW_PHRASES: RegExp[] = [/\bdispatch board\b/i, /\bjob board\b/i, /\bschedule overview\b/i, /\bwho'?s working\b/i, /\btoday'?s jobs\b/i];

const KNOWLEDGE_LOOKUP_PHRASES: RegExp[] = [/\bcost of\b/i, /\bprice of\b/i, /\blabor rate\b/i, /\bmaterial cost\b/i, /\bhow much does\b/i];

const MUTATION_KEYWORDS = ["send", "delete", "remove", "cancel", "approve", "reject", "charge", "pay", "schedule", "dispatch", "assign", "create", "update", "sign", "book"];
const MUTATION_KEYWORD_PATTERN = new RegExp(`\\b(?:${MUTATION_KEYWORDS.join("|")})\\b`, "i");

/** Returns true when any deterministic intent pattern matches the message. */
function matchesAny(message: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(message));
}

/** Classifies a user message into Athena's deterministic routing intents and risk hints. */
export function classifyAthenaIntent(message: string): AthenaRouterResult {
  if (matchesAny(message, DISPATCH_OVERVIEW_PHRASES)) {
    return { intent: "dispatch_overview", riskHint: "low", requestedContextIntents: ["dispatch_overview"], reasonCode: "athena_router_dispatch_overview_matched" };
  }
  if (matchesAny(message, KNOWLEDGE_LOOKUP_PHRASES)) {
    return { intent: "knowledge_lookup", riskHint: "low", requestedContextIntents: ["knowledge_lookup"], reasonCode: "athena_router_knowledge_lookup_matched" };
  }
  if (MUTATION_KEYWORD_PATTERN.test(message)) {
    return { intent: "mutate_business_record", riskHint: "high", requestedContextIntents: [], reasonCode: "athena_router_mutation_keyword_matched" };
  }
  return { intent: "draft_response", riskHint: "low", requestedContextIntents: [], reasonCode: "athena_router_default_draft_response" };
}

/** Creates the default keyword strategy, returning no match for the generic draft-response case. */
export function createKeywordAthenaRoutingStrategy(): AthenaRoutingStrategy {
  return {
    id: "keyword_classifier",
    route(message) {
      const result = classifyAthenaIntent(message);
      if (result.reasonCode === "athena_router_default_draft_response") {
        return null;
      }
      return result;
    },
  };
}
