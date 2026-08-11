import type { z } from "zod";
import type { AthenaAIContext, AthenaErrorCategory, AthenaFollowUp, AthenaTelemetryReference, AthenaToolError, AthenaWarning } from "../athena-kernel/types";
import type {
  AthenaEventReference,
  AthenaToolCompensationPolicy,
  AthenaToolConfirmationPolicy,
  AthenaToolDefinition,
  AthenaToolDeprecation,
  AthenaToolExecutionContext,
  AthenaToolIdempotency,
  AthenaToolResult,
  AthenaToolRisk,
} from "../athena-tool-registry/types";

// A9 Tool SDK contracts (docs/athena/roadmap/A9-tool-sdk-implementation-plan.md).
// Every type below is either re-exported unchanged from A2/A1 (so a tool
// author never has to reach past this module's single public entrypoint,
// index.ts) or a thin *authoring-input* shape that defineTool()/successResult()/
// failureResult() convert into those exact existing contracts. There is no
// parallel tool-definition or tool-result model here - see defineTool.ts's
// module comment for the concrete guarantee.
export type {
  AthenaAIContext,
  AthenaErrorCategory,
  AthenaEventReference,
  AthenaFollowUp,
  AthenaTelemetryReference,
  AthenaToolCompensationPolicy,
  AthenaToolConfirmationPolicy,
  AthenaToolDefinition,
  AthenaToolDeprecation,
  AthenaToolError,
  AthenaToolExecutionContext,
  AthenaToolIdempotency,
  AthenaToolResult,
  AthenaToolRisk,
  AthenaWarning,
};

// Any real Zod schema. Constrained to z.ZodTypeAny (not `unknown`, unlike
// AthenaToolDefinition.inputSchema itself) purely so TSchema's inferred
// input/output types are available to defineTool()'s generic below - A2's
// own runtime boundary (registry.ts's isZodLikeSchema / dispatcher.ts's
// isZodLikeSchema) still only requires safeParse() at runtime, so this is a
// compile-time narrowing, not a new runtime requirement.
export type AthenaToolInputSchema = z.ZodTypeAny;

// Authoring-time input to defineTool(). Structurally identical to
// AthenaToolDefinition<TInput, TData> (C002, docs/athena/contracts/README.md)
// except inputSchema is the real typed Zod schema (not `unknown`) and
// execute()'s `input` parameter is inferred from it instead of being
// hand-declared - see defineTool.ts.
export interface AthenaToolDefineOptions<TSchema extends AthenaToolInputSchema, TData = unknown> {
  id: string;
  version: string;
  owner: string;
  description: string;
  permissions: string[];
  risk: AthenaToolRisk;
  confirmationPolicy: AthenaToolConfirmationPolicy;
  timeoutMs: number;
  idempotency: AthenaToolIdempotency;
  compensationPolicy: AthenaToolCompensationPolicy;
  inputSchema: TSchema;
  requiredFeatureFlags?: string[];
  deprecated?: AthenaToolDeprecation;
  execute(input: z.infer<TSchema>, aiContext: AthenaAIContext, execution: AthenaToolExecutionContext): Promise<AthenaToolResult<TData>>;
}
