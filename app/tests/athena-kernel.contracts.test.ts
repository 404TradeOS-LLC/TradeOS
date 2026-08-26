import { assertValidTelemetryRecord, buildTelemetryRecord } from "../modules/athena-kernel/telemetry";
import { buildMinimalAthenaContext } from "../modules/athena-kernel/context";
import { evaluateAthenaPolicy } from "../modules/athena-kernel/policy";
import { AthenaTelemetryRecord } from "../modules/athena-kernel/types";

// Backs `npm run athena:contracts` (docs/athena/roadmap/A1-ai-kernel-implementation-plan.md
// "Named Validation Gates"). HIGH-P4 in the A1 parallel readiness review
// requires this gate to include a runtime shape check for every emitted
// AthenaTelemetryRecord, not just presence of a telemetry call - that is
// exactly what assertValidTelemetryRecord below exercises.
describe("athena:contracts", () => {
  const baseInput = {
    orgId: "org-1",
    requestId: "req-1",
    traceId: "trace-1",
    executionId: "exec-1",
    spanType: "kernel" as const,
    status: "ok" as const,
    durationMs: 12,
  };

  it("builds a C011-shaped record that passes shape validation", () => {
    const record = buildTelemetryRecord(baseInput);
    expect(() => assertValidTelemetryRecord(record)).not.toThrow();
    expect(record.version).toBe("1.0.0");
    expect(record.redaction).toBe("metadata_only");
  });

  it("rejects records missing required C011 fields", () => {
    const missingOrg = { ...buildTelemetryRecord(baseInput), orgId: "" };
    expect(() => assertValidTelemetryRecord(missingOrg)).toThrow(/orgId/);

    const badVersion = { ...buildTelemetryRecord(baseInput), version: "2.0.0" } as unknown as AthenaTelemetryRecord;
    expect(() => assertValidTelemetryRecord(badVersion)).toThrow(/version/);

    const badSpan = { ...buildTelemetryRecord(baseInput), spanType: "not-a-span" } as unknown as AthenaTelemetryRecord;
    expect(() => assertValidTelemetryRecord(badSpan)).toThrow(/spanType/);

    const badStatus = { ...buildTelemetryRecord(baseInput), status: "not-a-status" } as unknown as AthenaTelemetryRecord;
    expect(() => assertValidTelemetryRecord(badStatus)).toThrow(/status/);

    const badRedaction = { ...buildTelemetryRecord(baseInput), redaction: "raw" } as unknown as AthenaTelemetryRecord;
    expect(() => assertValidTelemetryRecord(badRedaction)).toThrow(/redaction/);

    const negativeDuration = { ...buildTelemetryRecord(baseInput), durationMs: -1 };
    expect(() => assertValidTelemetryRecord(negativeDuration)).toThrow(/durationMs/);
  });

  it("strips raw-prompt-shaped metadata keys before a record can be built", () => {
    const record = buildTelemetryRecord({ ...baseInput, metadata: { message: "sensitive user text", safeField: "ok" } });
    expect(record.metadata).not.toHaveProperty("message");
    expect(record.metadata.safeField).toBe("ok");
  });

  it("rejects a record whose metadata still carries a chain-of-thought/prompt marker", () => {
    const contaminated = buildTelemetryRecord(baseInput);
    (contaminated.metadata as Record<string, unknown>).note = "raw prompt leaked here";
    expect(() => assertValidTelemetryRecord(contaminated)).toThrow(/redacted content/);
  });

  it("C001 minimal AI context always includes request/organization/user/permissions/selectedScope/budget/telemetry", () => {
    const context = buildMinimalAthenaContext({
      requestId: "req-1",
      traceId: "trace-1",
      executionId: "exec-1",
      actor: { userId: "user-1", orgId: "org-1", role: "technician", permissions: ["crm.read"] },
      request: { message: "hello", requestSource: "http" },
    });

    expect(context.version).toBe("1.0.0");
    expect(context.request.executionId).toBe("exec-1");
    expect(context.organization.orgId).toBe("org-1");
    expect(context.user.userId).toBe("user-1");
    expect(context.permissions.role).toBe("technician");
    expect(context.selectedScope).toEqual({});
    expect(context.budget.maxProviderCount).toBe(0);
    expect(context.telemetry.traceId).toBe("trace-1");
    // No A3+ business provider sections may ever appear on the A1 context type.
    expect(context).not.toHaveProperty("customers");
    expect(context).not.toHaveProperty("costbook");
    expect(context).not.toHaveProperty("knowledgeEngine");
  });

  it("C007 permission decision is deterministic, role-normalized, and org/user-scoped", () => {
    const decision = evaluateAthenaPolicy({ rawRole: "viewer", orgId: "org-1", userId: "user-1", capability: "draft_response" });
    expect(decision.version).toBe("1.0.0");
    expect(decision.role).toBe("technician"); // normalizeRole maps legacy "viewer" -> "technician"
    expect(decision.decision).toBe("allow");
    expect(decision.orgId).toBe("org-1");
    expect(decision.userId).toBe("user-1");

    const denied = evaluateAthenaPolicy({ rawRole: "owner", orgId: "org-1", userId: "user-1", capability: "mutate_business_record" });
    expect(denied.decision).toBe("deny");
  });
});
