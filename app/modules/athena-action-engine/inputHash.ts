import { createHash } from "node:crypto";

// Deterministic canonicalization for approval-binding hashes (docs/athena/
// roadmap/A6-action-engine-implementation-plan.md "Canonical input
// hashing"). Recursively sorts plain-object keys so two structurally
// equivalent objects with different property insertion order still hash
// identically - plain JSON.stringify() does not guarantee this (key order
// follows insertion order). Array element order is left untouched: order is
// semantically significant for arrays, only object key order is arbitrary.
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sortedKeys = Object.keys(record).sort();
    const canonical: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      canonical[key] = canonicalize(record[key]);
    }
    return canonical;
  }
  return value;
}

// Hashes the already-validated tool input (the Zod-parsed output, never raw
// unvalidated caller input) so an approval can bind to the exact payload it
// was granted for (docs/athena/09-security/README.md "High-Risk Action
// Policy": "Approval records bind to the exact action payload ... and a
// hash of the approved input"). SHA-256 via Node's built-in crypto module -
// no new dependency.
export function computeCanonicalInputHash(validatedInput: unknown): string {
  const canonicalJson = JSON.stringify(canonicalize(validatedInput));
  return createHash("sha256").update(canonicalJson).digest("hex");
}
