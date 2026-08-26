import { z } from "zod";
import type { AthenaMemoryService } from "../../athena-memory/service";
import { AthenaMemoryError } from "../../athena-memory/errors";
import { defineTool } from "../defineTool";
import { followUp } from "../followUps";
import { failureResult, successResult } from "../results";
import type { AthenaToolDefinition } from "../types";
import { warning } from "../warnings";

// A9 reference/fixture tool (docs/athena/roadmap/
// A9-tool-sdk-implementation-plan.md "Reference/fixture tool"). Authored the
// way a future first-party tool author would use the SDK, not a copy-pasted
// direct A2 definition wrapped unchanged. Deliberately Athena infrastructure,
// not a business-domain tool: it reads a user-scoped preference through the
// already-merged A7 AthenaMemoryService, never Costbook/CRM/estimating/
// dispatch/billing. Its service dependency is explicit (constructor
// injection), never a global locator - the caller (a future registration
// module, or this SDK's own tests) is responsible for constructing a real
// AthenaMemoryService (e.g. createAthenaMemoryService() from
// athena-memory/service.ts) and passing it in; this file itself never
// imports that factory or Prisma, only the service's public interface type.
//
// No AthenaEventReference is ever constructed here - recalling a preference
// is a read with no canonical business event to reference (see
// docs/athena/10-events/README.md's event catalog), and fabricating one
// would violate A8's service-owned-event invariant this plan documents.

export const recallPreferenceInputSchema = z.object({
  key: z.string().min(1).max(100),
});
export type RecallPreferenceInput = z.infer<typeof recallPreferenceInputSchema>;

export interface RecallPreferenceData {
  key: string;
  value: unknown;
  confidence: number;
}

export interface RecallPreferenceToolDeps {
  memoryService: Pick<AthenaMemoryService, "recall">;
}

export function createRecallPreferenceTool(deps: RecallPreferenceToolDeps): AthenaToolDefinition<RecallPreferenceInput, RecallPreferenceData> {
  return defineTool({
    id: "tradeos.athena.tools.recall-preference",
    version: "1.0.0",
    owner: "athena-tool-sdk-fixtures",
    description: "Recalls a user-scoped Athena preference by key, if one has previously been remembered.",
    // No permission is required: A7's own memory service (athena-memory/
    // service.ts's isSubjectReadableByActor) authorizes a "user" scope read
    // by ownership alone (subjectId === actor.userId), the same posture
    // every other user-scope memory read already uses - there is no
    // "memory_read" capability in A4 to declare here (see
    // athena-permissions/types.ts's module comment on why).
    permissions: [],
    risk: "low",
    confirmationPolicy: "never",
    timeoutMs: 2_000,
    idempotency: "not_supported",
    compensationPolicy: "none",
    inputSchema: recallPreferenceInputSchema,
    async execute(input, _aiContext, execution) {
      const telemetry = { traceId: execution.traceId, executionId: execution.executionId };
      try {
        const record = await deps.memoryService.recall({
          orgId: execution.orgId,
          actor: { userId: execution.actor.id, orgId: execution.orgId, role: execution.role },
          scope: "user",
          subjectId: execution.actor.id,
          kind: `preference.${input.key}`,
        });

        if (!record) {
          return successResult<RecallPreferenceData>({
            summary: `No preference named "${input.key}" is recorded yet.`,
            data: null,
            telemetry,
            warnings: [warning({ code: "athena_preference_not_found", message: `No preference named "${input.key}" is recorded for this user.` })],
            followUps: [followUp({ kind: "question", label: `What should "${input.key}" be set to?` })],
          });
        }

        return successResult<RecallPreferenceData>({
          summary: `Recalled the "${input.key}" preference.`,
          data: { key: input.key, value: record.value, confidence: record.confidence },
          telemetry,
        });
      } catch (error) {
        // Only an *expected* AthenaMemoryError (org mismatch, storage
        // unavailable, etc.) becomes a tool-result failure - its
        // publicError is already the exact existing AthenaToolError shape,
        // reused verbatim rather than translated into a new one. Any other
        // thrown error is a programming/unexpected error and must not be
        // swallowed into a falsely well-formed envelope here - it
        // propagates so A6/A2's own unexpected-error normalization handles
        // it (see results.ts's module comment).
        if (error instanceof AthenaMemoryError) {
          return failureResult<RecallPreferenceData>({
            summary: error.publicError.safeSummary,
            telemetry,
            error: error.publicError,
          });
        }
        throw error;
      }
    },
  });
}
