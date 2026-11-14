import test from 'node:test';
import assert from 'node:assert/strict';
import { betaBrowserLaunchOptions, safeEvidenceError, isPreviewFeedbackRequest, partitionPreviewConsoleErrors } from './browser-runtime.mjs';

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
test('only the exact optional preview-feedback GET is classified outside application failures', () => {
  assert.equal(isPreviewFeedbackRequest('https://vercel.live/_next-live/feedback/feedback.js'), true);
  for (const url of ['https://vercel.live.evil.invalid/_next-live/feedback/feedback.js', 'https://vercel.live/api/payments', 'https://app.404tradeos.com/_next-live/feedback/feedback.js']) {
    assert.equal(isPreviewFeedbackRequest(url), false);
  }
  assert.equal(isPreviewFeedbackRequest('https://vercel.live/_next-live/feedback/feedback.js', 'POST'), false);
});

const previewUrl = 'https://vercel.live/_next-live/feedback/feedback.js?session=synthetic';
const loadText = 'Failed to load resource: net::ERR_CONNECTION_CLOSED';
const previewFailure = { method: 'GET', url: previewUrl, errorText: 'net::ERR_CONNECTION_CLOSED' };
test('preview console exclusion requires the exact observed URL and matching browser transport diagnostic', () => {
  const entries = [
    { url: previewUrl, text: loadText },
    { url: 'https://app.404tradeos.com/api/projects', text: loadText },
    { url: previewUrl, text: 'Application render failed' },
    { url: previewUrl, text: 'Failed to load resource: net::ERR_TIMED_OUT' },
    { url: previewUrl.replace('synthetic', 'different'), text: loadText },
  ];
  const result = partitionPreviewConsoleErrors(entries, [previewFailure]);
  assert.deepEqual(result.consoleErrors, entries.slice(1).map(entry => entry.text));
  assert.deepEqual(result.excludedPreviewConsoleErrors, [{ text: loadText, url: previewUrl.split('?')[0], reason: 'optional Vercel preview feedback' }]);
});
test('a preview-looking console error without an observed GET failure remains blocking', () => {
  const entries = [{ url: previewUrl, text: loadText }];
  for (const failures of [[], [{ ...previewFailure, method: 'POST' }], [{ ...previewFailure, errorText: undefined }]]) {
    assert.deepEqual(partitionPreviewConsoleErrors(entries, failures), { consoleErrors: [loadText], excludedPreviewConsoleErrors: [] });
  }
});
test('late request failure correlation reclassifies the retained console event without dropping unrelated errors', () => {
  const entries = [{ url: previewUrl, text: loadText }, { url: '', text: 'Uncaught TypeError' }];
  assert.equal(partitionPreviewConsoleErrors(entries, []).consoleErrors.length, 2);
  const result = partitionPreviewConsoleErrors(entries, [previewFailure]);
  assert.deepEqual(result.consoleErrors, ['Uncaught TypeError']);
  assert.equal(result.excludedPreviewConsoleErrors.length, 1);
});
