import { detectPromptInjectionDeep } from "./promptInjection";
import type { AthenaContextTrustLevel, AthenaPromptInjectionScanResult } from "./types";

// Context trust classification (task brief "Subagent 3 - Context Security":
// "Context must distinguish 'information' from 'instructions'. Do not
// blindly follow retrieved content."). Derives a trust level from data A3's
// AthenaContextProviderDefinition/AthenaProviderSection (athena-context-engine/
// types.ts) already carries - section identity and A3's own `sensitivity`
// classification - rather than adding a new required field to that closed
// C001-derived contract. See types.ts's AthenaContextTrustLevel comment for
// why this stays a derived read model instead of a stored field.
//
// The mapping is intentionally conservative: every section A3 assembles
// today is retrieved application/business data (jobs, customers, dispatch,
// knowledge runtime, weather, calendar, inventory, notifications), never a
// system/developer instruction - so no section currently classifies as
// "system_instruction". That trust level exists in the taxonomy for the
// one thing that actually deserves it (Athena's own system/developer
// prompt, assembled outside A3's provider pipeline entirely in
// athena-kernel/service.ts) so a future caller has a name for "this is
// authority, not content" without ever being tempted to grant it to
// provider-sourced data.
//
// Trust here tracks provenance (first-party TradeOS services vs. anything
// else), not A3's own `sensitivity` scale (public/internal/confidential/
// restricted) - 09-security's field-filtering invariant already governs
// what reaches this point based on sensitivity, and re-deriving a second
// sensitivity scale here would only create two sources of truth for the
// same concern. A "restricted"-sensitivity section (e.g. customer PII) is
// still real, first-party TradeOS content, never an instruction - the same
// "organization_content" trust level as a "public"-sensitivity one.
const KNOWN_ATHENA_CONTEXT_SECTIONS = ["knowledgeEngine", "dispatch", "weather", "calendar", "customers", "costbook", "inventory", "notifications", "memory"] as const;
type KnownAthenaContextSection = (typeof KNOWN_ATHENA_CONTEXT_SECTIONS)[number];

function isKnownSection(section: string): section is KnownAthenaContextSection {
  return (KNOWN_ATHENA_CONTEXT_SECTIONS as readonly string[]).includes(section);
}

export function classifyContextTrust(section: string): AthenaContextTrustLevel {
  if (!isKnownSection(section)) {
    // An unrecognized section name reaching this function is either a bug
    // (a new A3 provider registered without updating this mapping) or
    // genuinely external data this module has never seen before - both
    // fail closed to the least-trusted classification rather than silently
    // defaulting to something more permissive.
    return "external_untrusted";
  }
  // Every current A3 provider is first-party, so every known section is
  // "organization_content" today; the "verified_internal"/
  // "external_untrusted" tiers exist for providers this module does not yet
  // know about (a future plugin- or customer-note-backed provider) rather
  // than being unreachable dead code.
  return "organization_content";
}

// Scans a context section's fetched data for embedded-instruction patterns
// (task brief "external content contains instructions", "tool output
// contains malicious commands"). Pure classification - see
// promptInjection.ts's module comment on why this never itself blocks
// assembly. Callers (athena-context-engine/assembler.ts) attach the result
// as a warning; they do not omit or alter the section's data because of it,
// since the section is still legitimate content to cite/summarize even when
// it happens to contain injection-shaped text (e.g. a customer note that
// literally says "ignore previous instructions" is itself the fact worth
// surfacing to a human reviewer, not something to silently drop).
export function scanContextSectionForInjection(data: unknown): AthenaPromptInjectionScanResult {
  return detectPromptInjectionDeep(data);
}
