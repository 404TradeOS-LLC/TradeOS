import type { AthenaPromptInjectionScanResult } from "./types";

// Deterministic, non-LLM prompt-injection heuristic (task brief "Subagent
// 3 - Context Security" / docs/athena/09-security/README.md "Prompt
// Injection And Untrusted Content"). Every other Athena policy module in
// this codebase (athena-kernel/policy.ts, athena-permissions/policy.ts,
// athena-tool-registry/policy.ts, athena-memory/writePolicy.ts) is a fixed,
// deterministic rule set specifically so it can be unit tested and audited
// without a model call - this follows the same posture rather than asking
// an LLM to judge its own prompt for injection attempts.
//
// This is a *classifier*, not a *blocker*: scanning untrusted context
// content and flagging matches lets a caller attach a warning, lower a
// trust level, or record an audit signal. It never itself deletes content,
// changes a tool-selection decision, or grants/denies anything - matching
// 09-security's own framing ("content, not authority"). The one place this
// module's output does gate execution is athena-security/riskEngine.ts's
// narrow "confirmed injection about to be treated as an instruction" deny
// path, which is an explicit, bounded exception documented there.
//
// Documented gap, not a silently swallowed false negative (same posture as
// athena-observability/alerts.ts's approval_bypass_attempt comment): this is
// a literal, case-insensitive English pattern match. It has no defense
// against obfuscation - unusual whitespace/punctuation insertion, unicode
// homoglyphs, base64/other encoding, translation into another language, or
// a phrasing this pattern list's author simply did not anticipate. A "not
// suspicious" result must never be read as proof no injection attempt is
// present, only that this specific, narrow signal did not detect one - the
// same caveat 09-security's own defenses (isolating trusted instructions
// from retrieved content, schema-validating tool input, requiring approval
// for risk-bearing actions) exist independently of this classifier and
// remain the primary defense regardless of what it catches.

interface AthenaPromptInjectionPattern {
  name: string;
  pattern: RegExp;
}

const INJECTION_PATTERNS: AthenaPromptInjectionPattern[] = [
  { name: "ignore_previous_instructions", pattern: /ignore\s+(all\s+|any\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?)/i },
  { name: "disregard_system_prompt", pattern: /disregard\s+(the\s+)?(system|developer)\s+(prompt|message|instructions?)/i },
  { name: "override_instructions", pattern: /(override|replace|forget)\s+(your|the|all)\s+(instructions?|rules?|guidelines?|programming)/i },
  { name: "role_override_you_are_now", pattern: /you\s+are\s+now\s+(a|an|the)\b/i },
  { name: "role_override_act_as", pattern: /act\s+as\s+(if\s+you\s+(are|were)|a|an)\b/i },
  { name: "fake_system_block", pattern: /\[?\s*(system|developer)\s*\]?\s*:\s*/i },
  { name: "new_instructions_marker", pattern: /new\s+instructions?\s*:/i },
  { name: "reveal_system_prompt", pattern: /(reveal|print|show|repeat)\s+(your\s+)?(system\s+prompt|instructions|hidden\s+prompt)/i },
  { name: "unrestricted_mode_request", pattern: /(enter|enable|activate)\s+(developer|debug|unrestricted|jailbreak)\s+mode/i },
  { name: "credential_exfiltration_request", pattern: /(reveal|print|show|output|leak)\s+(your\s+|the\s+)?(api\s*key|password|secret|credentials?|token)/i },
];

// Bounded input size: a heuristic regex scan over untrusted, potentially
// attacker-controlled text should never itself become a resource-exhaustion
// vector (catastrophic backtracking risk grows with input length, and every
// pattern above is a bounded, non-nested alternation chosen specifically to
// avoid that class of bug, but capping input length is cheap defense in
// depth regardless).
const MAX_SCAN_LENGTH = 20_000;

export function detectPromptInjection(text: string): AthenaPromptInjectionScanResult {
  const scoped = text.length > MAX_SCAN_LENGTH ? text.slice(0, MAX_SCAN_LENGTH) : text;
  const matchedPatternNames = INJECTION_PATTERNS.filter(({ pattern }) => pattern.test(scoped)).map(({ name }) => name);
  return { suspicious: matchedPatternNames.length > 0, matchedPatternNames };
}

const MAX_WALK_DEPTH = 6;

function stringValuesDeep(value: unknown, depth = 0, seen = new Set<unknown>()): string[] {
  if (depth > MAX_WALK_DEPTH) return [];
  if (typeof value === "string") return [value];
  if (value === null || typeof value !== "object" || seen.has(value)) return [];
  seen.add(value);
  if (Array.isArray(value)) {
    return value.flatMap((item) => stringValuesDeep(item, depth + 1, seen));
  }
  const record = value as Record<string, unknown>;
  return Object.values(record).flatMap((item) => stringValuesDeep(item, depth + 1, seen));
}

// Scans every string value nested inside arbitrary provider/tool-output
// data for injection patterns (e.g. an entire context-provider section or
// tool result payload), deduping matched pattern names across all strings
// found. Used by contextTrust.ts for untrusted context sections and
// available for tool-output scanning (task brief "tool output contains
// malicious commands").
export function detectPromptInjectionDeep(value: unknown): AthenaPromptInjectionScanResult {
  const matched = new Set<string>();
  for (const str of stringValuesDeep(value)) {
    for (const name of detectPromptInjection(str).matchedPatternNames) {
      matched.add(name);
    }
  }
  return { suspicious: matched.size > 0, matchedPatternNames: [...matched] };
}
