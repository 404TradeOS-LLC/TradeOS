// A9 Athena Tool SDK - single public entrypoint (docs/athena/roadmap/
// A9-tool-sdk-implementation-plan.md "Public API surface"). First-party tool
// authors should import only from this module, never from internal SDK
// files directly - internal file boundaries (defineTool.ts, results.ts,
// ...) may change without notice as long as this surface stays stable.
//
// This is deliberately a small, closed set of primitives: a definition
// builder, result/warning/follow-up/event-reference constructors, and the
// reusable contract-test kit. There is no service-locator, no generic event
// publisher, and no second tool-definition or tool-result model - every
// exported constructor here produces the exact existing A2/A1 contract
// (AthenaToolDefinition, AthenaToolResult, AthenaWarning, AthenaFollowUp,
// AthenaEventReference) documented in docs/athena/contracts/README.md.
export { defineTool } from "./defineTool";
export { eventRef } from "./events";
export { followUp } from "./followUps";
export { successResult, failureResult } from "./results";
export { warning } from "./warnings";
export {
  describeAthenaToolContract,
  assertToolDefinitionShape,
  assertToolRegistersAndResolves,
  assertToolExecutesValidInput,
  assertToolRiskIsEnforced,
  assertToolRejectsInvalidInput,
  assertToolDeniedWithoutRequiredPermissions,
  assertToolDeniedWithoutRequiredFeatureFlags,
} from "./contractTestKit";
export type { AthenaToolContractOptions, AthenaToolContractApprovalOptions } from "./contractTestKit";
export type { AthenaFollowUpInput } from "./followUps";
export type { AthenaSuccessResultInput, AthenaFailureResultInput } from "./results";
export type { AthenaWarningInput } from "./warnings";
export type {
  AthenaAIContext,
  AthenaErrorCategory,
  AthenaEventReference,
  AthenaFollowUp,
  AthenaTelemetryReference,
  AthenaToolCompensationPolicy,
  AthenaToolConfirmationPolicy,
  AthenaToolDefineOptions,
  AthenaToolDefinition,
  AthenaToolDeprecation,
  AthenaToolError,
  AthenaToolExecutionContext,
  AthenaToolIdempotency,
  AthenaToolInputSchema,
  AthenaToolResult,
  AthenaToolRisk,
  AthenaWarning,
} from "./types";
