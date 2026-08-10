// A5 Router contracts (docs/athena/roadmap/A5-router-planner-implementation-plan.md,
// docs/athena/04-system-architecture/README.md "Intent Router": "Classify
// intent, domain, risk, and candidate tools" / must not "Authorize or
// execute actions"). Four real values only - no speculative business-domain
// intents (customers/costbook/billing) with nothing backing them yet, and no
// "needs clarification" intent, since AthenaKernelService already gates
// short/ambiguous messages before the router ever runs (see
// athena-kernel/service.ts's `message.length < 3` check, which happens
// before the "routing" transition).
export const ATHENA_ROUTER_INTENTS = ["draft_response", "dispatch_overview", "knowledge_lookup", "mutate_business_record"] as const;
export type AthenaRouterIntent = (typeof ATHENA_ROUTER_INTENTS)[number];

export interface AthenaRouterResult {
  intent: AthenaRouterIntent;
  // Advisory only - the Router "must not authorize or execute actions".
  // Real risk/approval decisions are athena-permissions (A4) and
  // athena-planner's job, never this module's.
  riskHint: "low" | "medium" | "high";
  // Which lazy_intent context providers this request may activate - fed
  // verbatim into athena-context-engine's AthenaContextAssemblyRequest.requestedIntents
  // (that field's own comment: "Empty until A5's planner supplies real
  // intents"). Empty for intents with no backing provider.
  requestedContextIntents: string[];
  reasonCode: string;
}
