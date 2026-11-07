import { test as base, expect, devices } from '@playwright/test';

// MCP interactive-page seed. When TRADEOS_MCP_FIREFOX_USER_DATA_DIR points
// at a persistent Firefox profile (the TradeOS MCP agent profile, which
// holds the local egress CA), the interactive page runs in that profile, so
// the agent browser trusts the VM's egress proxy with full TLS validation
// and no relay. The profile path comes from the environment only — never a
// hardcoded path — and without the variable this file behaves exactly like
// the plain seed (standard fixtures), so CI and other machines are
// unaffected.
const userDataDir = process.env.TRADEOS_MCP_FIREFOX_USER_DATA_DIR;

const test = userDataDir
  ? base.extend({
      context: async ({ playwright }, use) => {
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
