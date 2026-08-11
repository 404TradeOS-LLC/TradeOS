import type { AthenaToolTrustTier } from "./types";

// Tool trust classification (task brief "Subagent 5 - Tool and Action
// Security": "Tool trust metadata: internal, verified, experimental,
// restricted"). Derived from data A2's AthenaToolDefinition
// (athena-tool-registry/types.ts) already carries - `owner` and the
// registered `deprecated` marker - rather than a new required field on that
// closed C002 contract (see types.ts's AthenaToolTrustTier comment). Every
// first-party tool registered by an "athena" or "tradeos" owner is
// "internal" by default; nothing in this milestone (A11) registers a
// third-party/plugin tool at all (that catalog is A13's job), so
// "restricted" and "experimental" are reachable only through the explicit
// owner-prefix override below, kept ready for A13 rather than exercised in
// production today.
export interface AthenaToolTrustInput {
  owner: string;
  deprecated?: { sunsetAt?: string };
}

// Every real owner string in this codebase today (registered tools and
// fixture tools alike - e.g. "athena-tool-registry-fixtures",
// "athena-tool-sdk-fixtures") is "athena"/"tradeos" followed directly by a
// hyphenated module name, not a dot/colon-namespaced value - matched by
// plain startsWith, not a delimiter-specific prefix check.
const FIRST_PARTY_OWNER_PREFIXES = ["athena", "tradeos"];

export function classifyToolTrust(tool: AthenaToolTrustInput): AthenaToolTrustTier {
  const ownerLower = tool.owner.trim().toLowerCase();
  if (ownerLower.startsWith("experimental:")) return "experimental";
  if (ownerLower.startsWith("plugin:") || ownerLower.startsWith("third_party:") || ownerLower.startsWith("third-party:")) return "restricted";
  const isFirstParty = FIRST_PARTY_OWNER_PREFIXES.some((prefix) => ownerLower.startsWith(prefix));
  if (!isFirstParty) return "restricted";
  // A deprecated-with-sunset first-party tool is downgraded to
  // "experimental" trust, not denied outright - A2's own deprecation
  // handling (registry.ts) already governs whether it can still be
  // discovered/resolved at all; this only means a caller reading trust
  // metadata should not treat it as a fully-hardened path going forward.
  if (tool.deprecated?.sunsetAt) return "experimental";
  return "internal";
}

export interface AthenaToolTrustGateResult {
  trustLevel: AthenaToolTrustTier;
  requiresExplicitFeatureFlag: boolean;
}

// "experimental" and "restricted" tools require an explicit, named
// feature-flag opt-in beyond whatever A2/A4 permission and risk gates
// already require - additive to, never a replacement for, A2's
// evaluateAthenaToolPolicy (athena-tool-registry/policy.ts) or A4's
// evaluateAthenaPermission (athena-permissions/policy.ts). A caller wires
// this by checking requiresExplicitFeatureFlag before dispatch and
// confirming the tool's own id appears in an org's explicit enablement
// list - that enablement list is a deployment/config concern, not
// something this pure function can see, so it only reports the
// requirement, never resolves it.
export function evaluateToolTrustGate(tool: AthenaToolTrustInput): AthenaToolTrustGateResult {
  const trustLevel = classifyToolTrust(tool);
  return { trustLevel, requiresExplicitFeatureFlag: trustLevel === "experimental" || trustLevel === "restricted" };
}
