import type { AthenaSecretDetectionResult, AthenaSecretRedactionResult } from "./types";

// Centralized secret/credential detection (task brief "Subagent 6 - Secret
// Protection": "Implement centralized protection... Do not rely only on
// frontend hiding"). Before A11, this exact detector shape existed only
// once, inline, inside athena-memory/writePolicy.ts's
// detectProhibitedMemoryContent - and nowhere at all for telemetry (which
// only had a weak key-name substring denylist - see
// athena-kernel/telemetry.ts's SAFE_METADATA_KEYS_DENYLIST), tool results,
// or events, despite 09-security/README.md's "Secrets, PII, And Data
// Minimization" requiring the same guarantee everywhere. This module is the
// one place that guarantee is implemented; every other module (memory,
// telemetry, events, tool-sdk results) calls into it instead of keeping its
// own copy, so the detector list only ever needs to grow in one place.

const SENSITIVE_FIELD_NAME_PATTERN =
  /(password|passwd|secret|token|api[_-]?key|access[_-]?key|refresh[_-]?token|client[_-]?secret|credential|authorization|auth[_-]?header|cookie|private[_-]?key|ssn|social[_-]?security|card(?:[_-]?number)?|\bcvv\b|\bcvc\b|bank[_-]?account|routing[_-]?number|database[_-]?url|db[_-]?url|connection[_-]?string)/i;

const STRING_SECRET_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: "jwt", pattern: /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/ },
  { name: "bearer_header", pattern: /^Bearer\s+\S+$/i },
  { name: "aws_access_key_id", pattern: /^AKIA[0-9A-Z]{16}$/ },
  { name: "pem_private_key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "generic_prefixed_api_key", pattern: /^(sk|pk_live|pk_test|rk_live|ghp|gho|ghu|ghs|xox[baprs])[-_][A-Za-z0-9_]{10,}$/ },
  // Connection-string style credentials embedded in a URL, e.g.
  // postgres://user:pass@host/db - distinct from the field-name detector
  // above, which only catches this when the *key* itself looks like
  // "databaseUrl"; this catches the *value* wherever it appears (e.g.
  // nested inside a free-text summary field).
  { name: "credential_bearing_url", pattern: /^[a-z][a-z0-9+.-]*:\/\/[^\s/@]+:[^\s/@]+@/i },
];

const MAX_WALK_DEPTH = 6;

function objectKeysDeep(value: unknown, depth = 0, seen = new Set<unknown>()): string[] {
  if (depth > MAX_WALK_DEPTH || value === null || typeof value !== "object" || seen.has(value)) return [];
  seen.add(value);
  if (Array.isArray(value)) {
    return value.flatMap((item) => objectKeysDeep(item, depth + 1, seen));
  }
  const record = value as Record<string, unknown>;
  return Object.keys(record).flatMap((key) => [key, ...objectKeysDeep(record[key], depth + 1, seen)]);
}

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

// Detects but does not locate-and-redact - detectSecrets answers "is any
// secret-shaped data present anywhere in this value," for callers (e.g. the
// A11 risk engine, memory write policy) that only need a yes/no gate.
// redactSecrets below is the separate, path-aware operation for callers
// that need to keep the rest of a value while removing only the offending
// fields (telemetry metadata, tool results, events).
export function detectSecrets(value: unknown): AthenaSecretDetectionResult {
  const detectorNames: string[] = [];
  if (objectKeysDeep(value).some((key) => SENSITIVE_FIELD_NAME_PATTERN.test(key))) {
    detectorNames.push("sensitive_field_name");
  }
  const strings = stringValuesDeep(value);
  for (const { name, pattern } of STRING_SECRET_PATTERNS) {
    if (strings.some((str) => pattern.test(str.trim()))) {
      detectorNames.push(name);
    }
  }
  return { detected: detectorNames.length > 0, detectorNames };
}

const REDACTED_PLACEHOLDER = "[redacted]";

function isSecretShapedString(value: string): boolean {
  const trimmed = value.trim();
  return STRING_SECRET_PATTERNS.some(({ pattern }) => pattern.test(trimmed));
}

// Walks a cloned copy of `value` and replaces (a) any value whose own key
// matches the sensitive-field-name pattern, and (b) any string value that
// itself matches a secret string pattern regardless of its key, with a
// fixed placeholder. Returns the redacted clone plus the dot-separated
// paths that were redacted, mirroring athena-context-engine/redaction.ts's
// AthenaContextRedactionResult shape (a proven, already-reviewed contract
// in this codebase) so callers already familiar with that module recognize
// this one immediately.
export function redactSecrets<TData>(value: TData): AthenaSecretRedactionResult<TData> {
  if (value === null || typeof value !== "object") {
    if (typeof value === "string" && isSecretShapedString(value)) {
      return { data: REDACTED_PLACEHOLDER as unknown as TData, redactedFieldPaths: ["$"] };
    }
    return { data: value, redactedFieldPaths: [] };
  }

  const clone = structuredClone(value) as unknown;
  const redactedFieldPaths: string[] = [];

  const walk = (node: unknown, path: string): void => {
    if (node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }
    const record = node as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      const fieldPath = path ? `${path}.${key}` : key;
      const fieldValue = record[key];
      if (SENSITIVE_FIELD_NAME_PATTERN.test(key)) {
        record[key] = REDACTED_PLACEHOLDER;
        redactedFieldPaths.push(fieldPath);
        continue;
      }
      if (typeof fieldValue === "string" && isSecretShapedString(fieldValue)) {
        record[key] = REDACTED_PLACEHOLDER;
        redactedFieldPaths.push(fieldPath);
        continue;
      }
      walk(fieldValue, fieldPath);
    }
  };

  walk(clone, "");
  return { data: clone as TData, redactedFieldPaths };
}
