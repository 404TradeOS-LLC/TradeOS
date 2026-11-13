/** Respect the explicitly enabled managed-environment proxy for browser and API requests. */
export function betaBrowserLaunchOptions(env = process.env) {
  const options = { headless: true };
  if (env.NODE_USE_ENV_PROXY !== '1') return options;
  const raw = env.HTTPS_PROXY || env.https_proxy;
  if (!raw) return options;
  let proxy;
  try { proxy = new URL(raw); } catch { throw new Error('Evidence network proxy configuration is invalid.'); }
  if (!['http:', 'https:'].includes(proxy.protocol)) throw new Error('Evidence network proxy protocol is unsupported.');
  options.proxy = { server: proxy.origin };
  if (proxy.username) options.proxy.username = decodeURIComponent(proxy.username);
  if (proxy.password) options.proxy.password = decodeURIComponent(proxy.password);
  if (env.NO_PROXY || env.no_proxy) options.proxy.bypass = env.NO_PROXY || env.no_proxy;
  return options;
}

/** Playwright errors can append request cookies in a multiline call log. Never retain it. */
export function safeEvidenceError(error) {
  let message = (error instanceof Error ? error.message : String(error)).split(/\r?\n/, 1)[0];
  message = message.replace(/https?:\/\/[^\s)]+/g, (raw) => {
    try { const url = new URL(raw); return `${url.protocol}//${url.host}${url.pathname}`; }
    catch { return '[redacted URL]'; }
  });
  message = message.replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[redacted token]');
  message = message.replace(/\b(cookie|set-cookie|authorization|password|access[_-]?token|refresh[_-]?token)\s*[:=].*/gi, '$1=[redacted]');
  return message;
}
