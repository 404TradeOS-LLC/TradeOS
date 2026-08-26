type LogLevel = "info" | "warn" | "error";

interface LogMeta {
  [key: string]: unknown;
}

function writeLog(level: LogLevel, message: string, meta: LogMeta = {}): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
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
