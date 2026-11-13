import test from 'node:test';
import assert from 'node:assert/strict';
import { betaBrowserLaunchOptions, safeEvidenceError } from './browser-runtime.mjs';

test('browser proxy requires explicit environment opt-in and preserves headless behavior', () => {
  assert.deepEqual(betaBrowserLaunchOptions({ HTTPS_PROXY: 'http://proxy:8080' }), { headless: true });
  assert.deepEqual(betaBrowserLaunchOptions({ NODE_USE_ENV_PROXY: '1', HTTPS_PROXY: 'http://proxy:8080', NO_PROXY: 'localhost,127.0.0.1' }), {
    headless: true, proxy: { server: 'http://proxy:8080', bypass: 'localhost,127.0.0.1' },
  });
});
test('proxy credentials are separated from the server and invalid configuration fails without echoing it', () => {
  assert.deepEqual(betaBrowserLaunchOptions({ NODE_USE_ENV_PROXY:'1', HTTPS_PROXY:'http://user:pass@proxy:8080' }).proxy,
    { server:'http://proxy:8080', username:'user', password:'pass' });
  assert.throws(() => betaBrowserLaunchOptions({ NODE_USE_ENV_PROXY:'1', HTTPS_PROXY:'secret-invalid' }), e => !e.message.includes('secret-invalid'));
});
test('network diagnostics retain failure class but discard Playwright request-cookie call logs', () => {
  const result = safeEvidenceError(new Error('apiRequestContext.get: connect ECONNREFUSED\nCall log:\n - cookie: access_token=secret-session; refresh_token=secret-refresh'));
  assert.equal(result, 'apiRequestContext.get: connect ECONNREFUSED');
  assert.doesNotMatch(result, /secret-session|secret-refresh|cookie/);
});
test('diagnostics redact single-line credentials, authorization and signed URL queries', () => {
  for (const value of ['request failed Cookie: token=secret-session', 'Authorization: Bearer secret-session', 'https://user:secret-session@example.invalid/path?token=secret-session']) {
    assert.doesNotMatch(safeEvidenceError(new Error(value)), /secret-session/);
  }
});
