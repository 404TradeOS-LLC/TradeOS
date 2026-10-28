import { defineConfig } from '@playwright/test';

// Separate from the authenticated root evidence suite: npm ci at root and web
// before running `npx playwright test --config playwright.components.config.ts`.
export default defineConfig({
  testDir: './tests/components',
  testMatch: '**/*.spec.ts',
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
  outputDir: 'test-results',
  use: { browserName: 'chromium', trace: 'off', video: 'off' },
});
