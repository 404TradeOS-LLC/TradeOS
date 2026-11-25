import { randomUUID } from "node:crypto";
import type { AthenaToolRegistry } from "../athena-tool-registry/registry";
import { AthenaPlannerError } from "./errors";
import { AthenaPlan, AthenaPlanCandidateTool, AthenaPlanRouterInput, AthenaPlanStatus, AthenaPlanStep } from "./types";

// A5 Planner (docs/athena/04-system-architecture/README.md "Planner":
// "Produce a step plan using registered tools" / must not "Invent tools or
// bypass policy"). Deterministic, no model call - the planner decides plan
// shape from the router's classification, never from raw message text.
// Authorization and risk-based approval are athena-permissions (A4) and the
// kernel's policy_check stage's job, not this module's - a plan referencing
// tool_call steps is deliberately left "draft" (not "ready") until that
// evaluation runs, per the architecture diagram's Planner -> Security and
// Approval Policy ordering.
export interface AthenaPlanBuildInput {
  routerResult: AthenaPlanRouterInput;
  // Candidates are the tools the caller offers for this intent - the
  // planner plans every supplied candidate (and throws on an unregistered
  // one). The kernel is the only caller: it offers explicitly supplied
  // candidateTools as-is, and offers discovered tools only after filtering
  // them by intent (2026-11-25 regression - offering every discovered tool
  // for every question planned all 20 production tools with empty input and
  // failed the first step's schema validation). Non-empty in production
  // since A12 registered real business tools.
  candidateTools: AthenaPlanCandidateTool[];
  toolRegistry: Pick<AthenaToolRegistry, "resolve">;
  planId?: string;
}

// The router's own mutate_business_record intent value (athena-router/types.ts),
// referenced by its literal string rather than an imported type - C004
// types AthenaPlan.intent as a plain string, and coupling the planner to the
// router's exact intent union would make every future router intent a
// planner change too, when only this one value actually needs special
// handling here.
const MUTATE_BUSINESS_RECORD_INTENT = "mutate_business_record";

function buildClarifyingQuestionStep(): AthenaPlanStep {
  return { kind: "clarifying_question", stepId: randomUUID(), question: "Athena can't make this change yet - no registered tool is available for it." };
}

function buildToolCallSteps(candidates: readonly AthenaPlanCandidateTool[], toolRegistry: Pick<AthenaToolRegistry, "resolve">): AthenaPlanStep[] {
  return candidates.map((candidate) => {
    const resolution = toolRegistry.resolve(candidate.toolId, candidate.toolVersion);
    if (resolution.outcome !== "found") {
      throw new AthenaPlannerError(`Cannot reference an unregistered tool in a plan: ${candidate.toolId}@${candidate.toolVersion} (${resolution.outcome})`);
    }
    return { kind: "tool_call", stepId: randomUUID(), toolId: candidate.toolId, toolVersion: candidate.toolVersion, summary: candidate.summary, input: candidate.input ?? {} };
  });
}

export function buildAthenaPlan(input: AthenaPlanBuildInput): AthenaPlan {
  const planId = input.planId ?? randomUUID();
  const { intent, riskHint } = input.routerResult;

  if (intent === MUTATE_BUSINESS_RECORD_INTENT) {
    return {
      version: "1.0.0",
      planId,
      status: "needs_clarification",
      intent,
      risk: "high",
      steps: [buildClarifyingQuestionStep()],
      requiredApprovals: [],
      assumptions: ["No registered tool exists for this capability."],
    };
  }

  const steps = buildToolCallSteps(input.candidateTools, input.toolRegistry);
  // No steps means nothing further to evaluate - trivially ready. Any real
  // tool_call step stays "draft" until the kernel's policy_check stage
  // evaluates it (athena-permissions), never "ready" from the planner alone.
  const status: AthenaPlanStatus = steps.length === 0 ? "ready" : "draft";

  return {
    version: "1.0.0",
    planId,
    status,
    intent,
    risk: riskHint,
    steps,
    requiredApprovals: [],
    assumptions: [],
  };
}
