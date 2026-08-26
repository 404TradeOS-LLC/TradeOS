type LogLevel = "info" | "warn" | "error";

interface LogMeta {
  [key: string]: unknown;
}

const SENSITIVE_KEY = /(?:authorization|cookie|password|secret|token|api[_-]?key|database[_-]?url|request[_-]?body|response[_-]?body|raw[_-]?body|body)/i;
const BEARER_VALUE = /\bBearer\s+[^\s,]+/gi;
const SENSITIVE_QUERY_VALUE = /([?&](?:access_token|api[_-]?key|code|password|refresh_token|secret|token)=)[^&#\s]*/gi;

function sanitizeString(value: string): string {
  return value
    .replace(BEARER_VALUE, "Bearer [REDACTED]")
    .replace(SENSITIVE_QUERY_VALUE, "$1[REDACTED]");
}

function sanitizeValue(value: unknown, seen: WeakSet<object>, depth: number): unknown {
  if (typeof value === "string") return sanitizeString(value);
  if (value === null || typeof value !== "object") return value;
  if (depth > 6 || seen.has(value)) return "[REDACTED]";

  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, seen, depth + 1));

  const sanitized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    sanitized[key] = SENSITIVE_KEY.test(key) ? "[REDACTED]" : sanitizeValue(child, seen, depth + 1);
  }
  return sanitized;
}

export function sanitizeLogMeta(meta: LogMeta = {}): LogMeta {
  return sanitizeValue(meta, new WeakSet<object>(), 0) as LogMeta;
}

function writeLog(level: LogLevel, message: string, meta: LogMeta = {}): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...sanitizeLogMeta(meta),
  };
  const line = JSON.stringify(entry);

  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}

export function logInfo(message: string, meta?: LogMeta): void {
  writeLog("info", message, meta);
}

export function logWarn(message: string, meta?: LogMeta): void {
  writeLog("warn", message, meta);
}

export function logError(message: string, meta?: LogMeta): void {
  writeLog("error", message, meta);
}
