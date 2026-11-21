import { defineConfig, devices } from '@playwright/test';
import { resolveMcpProxy } from './tests/playwright/proxy-env.mjs';

// Interactive agent browser access is intentionally independent from release
// certification. This config does not enforce a host or origin allowlist.
// The agent browser is Firefox: the MCP server runs it against a dedicated
// persistent profile (see tests/playwright/seed.spec.ts) so it trusts the
// local egress CA with full TLS validation and no relay. Chromium remains
// the default for the normal playwright.config.ts and GitHub Actions
// evidence gates, which are unchanged.
//
// The egress proxy (if any) comes from the process environment at runtime
// (HTTP_PROXY / HTTPS_PROXY / NO_PROXY, either case) — never a hardcoded
// address, and never logged. The value may carry proxy credentials, so
// treat it as secret material. When no proxy variable is set, no proxy
// option is passed and the browser falls back to its own defaults. Full
// TLS validation is always on: never add ignoreHTTPSErrors here. The
// profile CA itself is re-synced at every MCP launch by
// tests/playwright/mcp-server.mjs (see tests/playwright/sync-egress-ca.mjs),
// because the sandbox egress CA rotates within minutes.
const mcpProxy = resolveMcpProxy(process.env);

export default defineConfig({
  testDir: './tests/playwright',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
  outputDir: 'test-results',
  use: {
    baseURL: process.env.TRADEOS_AGENT_BASE_URL || 'http://127.0.0.1:3000',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    ...(mcpProxy ? { proxy: mcpProxy } : {}),
  },
  projects: [{ name: 'firefox', use: { ...devices['Desktop Firefox'] } }],
});
