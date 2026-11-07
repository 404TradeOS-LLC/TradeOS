import { expect, test } from '@playwright/test';

// Real-browser regression coverage for the TradeOS sign-in workflow.
// Unauthenticated: exercises the login form and client-side validation only.
// No credentials are used; no login attempt reaches the backend.
// Run against staging with TRADEOS_AGENT_BASE_URL set to the staging alias.
test.describe('TradeOS sign-in workflow', () => {
  test('login form renders, validates empty submit, no overflow at 390 and 1440', async ({ page }) => {
    // Harness budget only: the operative regression bound is the 10s film
    // wait below. 60s lets that assertion report cleanly on slow targets
    // instead of the default 30s test timeout firing mid-assertion.
    test.setTimeout(60000);
    await page.goto('/login');
    // The signature intro film ("TradeOS introduction" dialog) covers the
    // page and intercepts pointer events until it dismisses. Its intended
    // timing is ENTRY_TIMING in web/src/components/entry/entry-state.ts:
    // 4000ms first visit, 2500ms returning. The 10s bound below gives the
    // film ample slack on slow renderers while failing loudly on the
    // ~23s overstay defect instead of hiding it behind a long wait.
    await expect(
      page.getByRole('dialog', { name: 'TradeOS introduction' }),
    ).toBeHidden({ timeout: 10000 });
    await expect(page).toHaveTitle(/Sign in \| TradeOS/);
    await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
    await expect(page.getByPlaceholder('you@company.com')).toBeVisible();
    await expect(page.getByPlaceholder('Enter your password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();

    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Enter a valid email address.')).toBeVisible();
    await expect(page.getByText('Enter your password.')).toBeVisible();

    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow).toBe(false);
    }
  });
});
