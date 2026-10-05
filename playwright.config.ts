import { defineConfig, devices } from '@playwright/test';
import { resolveAgentTarget } from './tests/playwright/target.mjs';

const evidenceMode = process.env.TRADEOS_AGENT_EVIDENCE === 'true';

export default defineConfig({
  testDir: './tests/playwright',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: evidenceMode
    ? [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : 'list',
  outputDir: 'test-results',
  use: {
    baseURL: resolveAgentTarget(process.env),
    trace: evidenceMode ? 'retain-on-failure' : 'off',
    screenshot: evidenceMode ? 'on' : 'off',
    video: evidenceMode ? 'retain-on-failure' : 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
