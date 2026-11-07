import { defineConfig, devices } from '@playwright/test';

// Interactive agent browser access is intentionally independent from release
// certification. This config does not enforce a host or origin allowlist.
// The agent browser is Firefox: the MCP server runs it against a dedicated
// persistent profile (see tests/playwright/seed.spec.ts) so it trusts the
// local egress CA with full TLS validation and no relay. Chromium remains
// the default for the normal playwright.config.ts and GitHub Actions
// evidence gates, which are unchanged.
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
  },
  projects: [{ name: 'firefox', use: { ...devices['Desktop Firefox'] } }],
});
