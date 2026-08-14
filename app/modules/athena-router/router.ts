import { createKeywordAthenaRoutingStrategy } from "./classifier";
import { AthenaRouterDecision, AthenaRouterLogEntry, AthenaRouterOutcome, AthenaRouterResult, AthenaRoutingStrategy } from "./types";

const DEFAULT_ROUTING_STRATEGIES: readonly AthenaRoutingStrategy[] = [createKeywordAthenaRoutingStrategy()];

/** Builds the deterministic low-risk draft fallback used when no routing strategy matches. */
function fallbackDecision(reasonCode: string): AthenaRouterDecision {
  return {
    intent: "draft_response",
    riskHint: "low",
    requestedContextIntents: [],
    reasonCode,
    strategyId: "fallback",
    fallbackApplied: true,
  };
}

/** Runs routing strategies in order, recording outcomes and falling back safely on no-match or strategy errors. */
export function routeAthenaRequest(message: string, strategies: readonly AthenaRoutingStrategy[] = DEFAULT_ROUTING_STRATEGIES): AthenaRouterOutcome {
  const logs: AthenaRouterLogEntry[] = [];

  for (const strategy of strategies) {
    try {
      const result = strategy.route(message);
      if (!result) {
        logs.push({ strategyId: strategy.id, matched: false, reasonCode: "athena_router_strategy_no_match" });
        continue;
      }
      logs.push({ strategyId: strategy.id, matched: true, reasonCode: result.reasonCode });
      return {
        decision: {
          ...result,
          strategyId: strategy.id,
          fallbackApplied: false,
        },
        logs,
      };
    } catch (error) {
      logs.push({
        strategyId: strategy.id,
        matched: false,
        reasonCode: "athena_router_strategy_error",
        errorMessage: error instanceof Error ? error.message : "Unknown routing error",
      });
    }
  }

  return {
    decision: fallbackDecision("athena_router_fallback_default_draft_response"),
    logs,
  };
}

/** Converts an enriched router decision back to the planner-facing router result contract. */
export function toAthenaRouterResult(decision: AthenaRouterDecision): AthenaRouterResult {
  return {
    intent: decision.intent,
    riskHint: decision.riskHint,
    requestedContextIntents: decision.requestedContextIntents,
    reasonCode: decision.reasonCode,
  };
}
