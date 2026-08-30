const SAFE_PROXY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function shouldRejectProxyMutation(method: string, requestUrl: string, originHeader: string | null): boolean {
  if (SAFE_PROXY_METHODS.has(method.toUpperCase())) return false;
  if (!originHeader) return true;

  try {
    return new URL(originHeader).origin !== new URL(requestUrl).origin;
  } catch {
    return true;
  }
}
