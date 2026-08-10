import { AthenaPlannerError } from "../modules/athena-planner/errors";
import { buildAthenaPlan } from "../modules/athena-planner/planner";
import { assertValidAthenaPlan } from "../modules/athena-planner/resultValidation";
import { createAthenaToolRegistry } from "../modules/athena-tool-registry/registry";
import { createEchoFixtureTool } from "../modules/athena-tool-registry/fixtures/echoFixtureTool";

describe("buildAthenaPlan", () => {
  it("produces a needs_clarification plan with a clarifying-question step for mutate_business_record, never a tool_call", () => {
    const registry = createAthenaToolRegistry();
    const plan = buildAthenaPlan({ routerResult: { intent: "mutate_business_record", riskHint: "high" }, candidateTools: [], toolRegistry: registry, planId: "plan-1" });

    expect(() => assertValidAthenaPlan(plan)).not.toThrow();
    expect(plan.status).toBe("needs_clarification");
    expect(plan.risk).toBe("high");
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].kind).toBe("clarifying_question");
    expect(plan.assumptions).toEqual(["No registered tool exists for this capability."]);
  });

  it("produces a ready plan with zero steps when no candidate tools exist (the only real A5 case today)", () => {
    const registry = createAthenaToolRegistry();
    const plan = buildAthenaPlan({ routerResult: { intent: "draft_response", riskHint: "low" }, candidateTools: [], toolRegistry: registry, planId: "plan-2" });

    expect(() => assertValidAthenaPlan(plan)).not.toThrow();
    expect(plan.status).toBe("ready");
    expect(plan.risk).toBe("low");
    expect(plan.steps).toEqual([]);
  });

  it("carries the router's intent and riskHint through unchanged for a non-mutation intent", () => {
    const registry = createAthenaToolRegistry();
    const plan = buildAthenaPlan({ routerResult: { intent: "dispatch_overview", riskHint: "low" }, candidateTools: [], toolRegistry: registry });

    expect(plan.intent).toBe("dispatch_overview");
    expect(plan.risk).toBe("low");
  });

  it("resolves every candidate tool against the registry and produces draft (not ready) tool_call steps", () => {
    const registry = createAthenaToolRegistry();
    registry.register(createEchoFixtureTool());

    const plan = buildAthenaPlan({
      routerResult: { intent: "draft_response", riskHint: "low" },
      candidateTools: [{ toolId: "tradeos.athena.fixture.echo", toolVersion: "1.0.0", summary: "Echo the message back.", input: { message: "hi" } }],
      toolRegistry: registry,
    });

    expect(() => assertValidAthenaPlan(plan)).not.toThrow();
    expect(plan.status).toBe("draft");
    expect(plan.steps).toEqual([{ kind: "tool_call", stepId: expect.any(String), toolId: "tradeos.athena.fixture.echo", toolVersion: "1.0.0", summary: "Echo the message back.", input: { message: "hi" } }]);
  });

  it("throws AthenaPlannerError instead of silently building a plan that references an unregistered tool", () => {
    const registry = createAthenaToolRegistry();

    expect(() =>
      buildAthenaPlan({
        routerResult: { intent: "draft_response", riskHint: "low" },
        candidateTools: [{ toolId: "tradeos.athena.fixture.does-not-exist", toolVersion: "1.0.0", summary: "Nonexistent tool." }],
        toolRegistry: registry,
      })
    ).toThrow(AthenaPlannerError);
  });

  it("throws AthenaPlannerError for a removed tool, never silently downgrading to a clarifying question", () => {
    const registry = createAthenaToolRegistry();
    registry.register(createEchoFixtureTool());
    registry.remove("tradeos.athena.fixture.echo", "1.0.0");

    expect(() =>
      buildAthenaPlan({
        routerResult: { intent: "draft_response", riskHint: "low" },
        candidateTools: [{ toolId: "tradeos.athena.fixture.echo", toolVersion: "1.0.0", summary: "Echo the message back." }],
        toolRegistry: registry,
      })
    ).toThrow(AthenaPlannerError);
  });

  it("defaults a candidate tool's step input to an empty object when none is supplied", () => {
    const registry = createAthenaToolRegistry();
    registry.register(createEchoFixtureTool());

    const plan = buildAthenaPlan({
      routerResult: { intent: "draft_response", riskHint: "low" },
      candidateTools: [{ toolId: "tradeos.athena.fixture.echo", toolVersion: "1.0.0", summary: "Echo the message back." }],
      toolRegistry: registry,
    });

    expect(plan.steps[0]).toMatchObject({ input: {} });
  });

  it("generates a planId when none is supplied", () => {
    const registry = createAthenaToolRegistry();
    const plan = buildAthenaPlan({ routerResult: { intent: "draft_response", riskHint: "low" }, candidateTools: [], toolRegistry: registry });

    expect(typeof plan.planId).toBe("string");
    expect(plan.planId.length).toBeGreaterThan(0);
  });
});
