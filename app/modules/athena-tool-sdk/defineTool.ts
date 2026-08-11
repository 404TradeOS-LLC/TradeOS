import type { z } from "zod";
import type { AthenaToolDefinition } from "../athena-tool-registry/types";
import type { AthenaToolDefineOptions, AthenaToolInputSchema } from "./types";

// defineTool() is a pure, synchronous object-shape conversion: every field on
// AthenaToolDefineOptions maps to the exact same-named field on
// AthenaToolDefinition (C002). It does not validate, normalize, freeze,
// wrap, memoize, or lazily construct anything - the returned value is a
// plain object indistinguishable from one written by hand against A2
// directly, which is the whole compatibility guarantee A9 exists to
// preserve (docs/athena/roadmap/A9-tool-sdk-implementation-plan.md
// "Public API surface"): app/modules/athena-tool-registry/registry.ts's
// register() and app/modules/athena-tool-registry/dispatcher.ts's
// dispatchAthenaTool() require zero special-casing to accept it, proven by
// app/tests/athena-tool-sdk.defineTool.test.ts's direct-A2-compatibility
// regression case.
//
// Deliberately does not re-run app/modules/athena-tool-registry/registry.ts's
// assertValidToolDefinition() here. Field-level compile-time safety already
// comes from AthenaToolDefineOptions' own literal-union types (an invalid
// `risk`/`confirmationPolicy`/`idempotency`/`compensationPolicy` value is a
// TypeScript error at the call site, not a runtime throw here); the
// authoritative *runtime* check remains the single one A2's registry already
// performs at register() time - see this plan's "Non-goals" section on why a
// second copy of that validator is not introduced.
export function defineTool<TSchema extends AthenaToolInputSchema, TData = unknown>(options: AthenaToolDefineOptions<TSchema, TData>): AthenaToolDefinition<z.infer<TSchema>, TData> {
  const definition: AthenaToolDefinition<z.infer<TSchema>, TData> = {
    id: options.id,
    version: options.version,
    owner: options.owner,
    description: options.description,
    permissions: options.permissions,
    risk: options.risk,
    confirmationPolicy: options.confirmationPolicy,
    timeoutMs: options.timeoutMs,
    idempotency: options.idempotency,
    compensationPolicy: options.compensationPolicy,
    inputSchema: options.inputSchema,
    execute: options.execute,
  };
  if (options.requiredFeatureFlags !== undefined) definition.requiredFeatureFlags = options.requiredFeatureFlags;
  if (options.deprecated !== undefined) definition.deprecated = options.deprecated;
  return definition;
}
