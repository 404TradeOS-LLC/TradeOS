import { z, ZodTypeAny } from "zod";

/**
 * Parses a comma-separated query string into an array validated against
 * `itemSchema`, e.g. `?status=draft,ready` -> ["draft", "ready"]. Mirrors the
 * existing `entityTypeSchema` comma-split pattern in
 * `intelligence.controller.ts`, shared here since the organization
 * work-queue endpoints repeat it across three resources.
 */
export function commaSeparatedEnum<T extends ZodTypeAny>(itemSchema: T) {
  return z
    .string()
    .optional()
    .transform((value) => (value ? value.split(",").map((item) => item.trim()).filter(Boolean) : undefined))
    .pipe(z.array(itemSchema).optional());
}

/**
 * Strict tri-state boolean query param: only the exact strings "true"/"false"
 * coerce; anything else fails validation instead of silently truthy-coercing
 * (z.coerce.boolean() would treat "false" as true).
 */
export const strictOptionalBoolean = z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .optional();
