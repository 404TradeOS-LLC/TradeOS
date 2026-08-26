import type { z } from "zod";
import type { AthenaToolDefinition } from "../athena-tool-registry/types";
import type { AthenaToolDefineOptions, AthenaToolInputSchema } from "./types";

/**
 * Converts first-party SDK options into the ordinary A2 AthenaToolDefinition shape.
 * Runtime registration validation and legacy metadata normalization remain owned by the registry.
 */
export function defineTool<TSchema extends AthenaToolInputSchema, TData = unknown>(options: AthenaToolDefineOptions<TSchema, TData>): AthenaToolDefinition<z.infer<TSchema>, TData> {
  const definition: AthenaToolDefinition<z.infer<TSchema>, TData> = {
    id: options.id,
    version: options.version,
    owner: options.owner,
    name: options.name,
    category: options.category,
    description: options.description,
    permissions: options.permissions,
    risk: options.risk,
    confirmationPolicy: options.confirmationPolicy,
    timeoutMs: options.timeoutMs,
    idempotency: options.idempotency,
    compensationPolicy: options.compensationPolicy,
    inputSchema: options.inputSchema,
    outputSchema: options.outputSchema,
    execute: options.execute,
  };
  if (options.requiredFeatureFlags !== undefined) definition.requiredFeatureFlags = options.requiredFeatureFlags;
  if (options.deprecated !== undefined) definition.deprecated = options.deprecated;
  if (options.resourceScope !== undefined) definition.resourceScope = options.resourceScope;
  return definition;
}
