import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAgentTarget } from './target.mjs';

test('local defaults and loopback origins are accepted', () => {
  assert.equal(resolveAgentTarget(), 'http://127.0.0.1:3000');
  for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    assert.equal(resolveAgentTarget({ TRADEOS_AGENT_BASE_URL: `http://${host}:3001` }), `http://${host}:3001`);
  }
});
test('sanitized declared Preview is accepted', () => {
  assert.equal(resolveAgentTarget({ TRADEOS_AGENT_BASE_URL: 'https://tradeos-costbook-web-test123.vercel.app', TRADEOS_AGENT_ENVIRONMENT: 'preview', TRADEOS_AGENT_SANITIZED_TENANT: 'true' }), 'https://tradeos-costbook-web-test123.vercel.app');
});
for (const url of ['https://tradeos-costbook-web.vercel.app', 'https://tradeos-costbook-web-git-main-team.vercel.app', 'https://example.com', 'https://tradeos-costbook-web-test.vercel.app.evil.example', 'http://tradeos-costbook-web-test.vercel.app', 'https://tradeos-costbook-web-test.vercel.app:8443', 'http://localhost:3000/login', 'http://user:password@localhost:3000', 'http://localhost:3000?token=secret', 'http://localhost:3000#secret', 'file:///tmp/test']) {
  test(`refuses unsafe origin ${new URL(url).origin}`, () => {
    assert.throws(() => resolveAgentTarget({ TRADEOS_AGENT_BASE_URL: url, TRADEOS_AGENT_ENVIRONMENT: 'preview', TRADEOS_AGENT_SANITIZED_TENANT: 'true' }));
  });
}
test('hosted runs fail closed on missing or production identity', () => {
  for (const identity of [{}, { TRADEOS_AGENT_ENVIRONMENT: 'production', TRADEOS_AGENT_SANITIZED_TENANT: 'true' }, { TRADEOS_AGENT_ENVIRONMENT: 'staging' }]) {
    assert.throws(() => resolveAgentTarget({ TRADEOS_AGENT_BASE_URL: 'https://tradeos-costbook-web-test.vercel.app', ...identity }));
  }
});
