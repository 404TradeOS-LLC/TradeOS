import { test as base, expect, devices } from '@playwright/test';

// MCP interactive-page seed. When TRADEOS_MCP_FIREFOX_USER_DATA_DIR points
// at a persistent Firefox profile (the TradeOS MCP agent profile, which
// holds the local egress CA), the interactive page runs in that profile, so
// the agent browser trusts the VM's egress proxy with full TLS validation
// and no relay. The profile path comes from the environment only — never a
// hardcoded path — and without the variable this file behaves exactly like
// the plain seed (standard fixtures), so CI and other machines are
// unaffected. The persistent profile is used ONLY for the MCP Firefox
// project: a Chromium run with the variable set must still test Chromium,
// so any non-Firefox project gets a standard context from its own browser.
const userDataDir = process.env.TRADEOS_MCP_FIREFOX_USER_DATA_DIR;

const test = userDataDir
  ? base.extend({
      context: async ({ playwright, browser, browserName }, use) => {
        if (browserName !== 'firefox') {
          // Standard context for non-Firefox projects (e.g. the CI Chromium
          // project): never launch the MCP profile here, even with the
          // variable set. The seed only needs the target origin.
          const context = await browser.newContext({
            baseURL: process.env.TRADEOS_AGENT_BASE_URL || 'http://127.0.0.1:3000',
          });
          await use(context);
          await context.close();
          return;
        }
        // Mirror the MCP server's headed computation: headed only with a
        // display and outside CI; the agent VM has neither.
        const headless =
          Boolean(process.env.CI) ||
          (process.platform === 'linux' && !process.env.DISPLAY);
        const context = await playwright.firefox.launchPersistentContext(userDataDir, {
          headless,
          baseURL: process.env.TRADEOS_AGENT_BASE_URL || 'http://127.0.0.1:3000',
          viewport: devices['Desktop Firefox'].viewport,
          userAgent: devices['Desktop Firefox'].userAgent,
        });
        await use(context);
        await context.close();
      },
    })
  : base;

test.describe('TradeOS entry', () => {
  test('seed: logged-out login shell', async ({ page, context }) => {
    // A persistent profile restores the previous session's tabs on launch;
    // close them so the interactive page is the only tab and the MCP tools
    // drive it (otherwise they land on a restored about:blank tab).
    for (const other of context.pages()) {
      if (other !== page) await other.close();
    }
    await page.goto('/login');
    await expect(page.getByLabel('Email address', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  });
});
