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

/** Vercel's optional preview toolbar is not an application request. Retain it separately. */
export function isPreviewFeedbackRequest(raw, method = 'GET') {
  try {
    const url = new URL(raw);
    return method === 'GET' && url.origin === 'https://vercel.live' &&
      url.pathname === '/_next-live/feedback/feedback.js';
  } catch { return false; }
}

/** Exclude only a browser load diagnostic correlated to an observed optional request failure. */
export function partitionPreviewConsoleErrors(entries, failedPreviewRequests) {
  const consoleErrors = [];
  const excludedPreviewConsoleErrors = [];
  for (const entry of entries) {
    const failure = failedPreviewRequests.find(request =>
      isPreviewFeedbackRequest(request.url, request.method) &&
      request.url === entry.url && /^net::ERR_[A-Z_]+$/.test(request.errorText ?? '') &&
      entry.text === `Failed to load resource: ${request.errorText}`);
    if (failure) {
      const url = new URL(entry.url);
      excludedPreviewConsoleErrors.push({ text: entry.text, url: `${url.origin}${url.pathname}`, reason: 'optional Vercel preview feedback' });
    } else consoleErrors.push(entry.text);
  }
  return { consoleErrors, excludedPreviewConsoleErrors };
}
