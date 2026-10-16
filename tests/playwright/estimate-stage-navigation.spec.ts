import { expect, test } from '@playwright/test';

// Manual, non-production interaction regression for a draft with saved items.
// Project PATCH responses are intercepted; no scope write reaches the backend.
const path = process.env.TRADEOS_ESTIMATE_STAGE_PATH;
const state = process.env.TRADEOS_ESTIMATE_STAGE_STATE;

test.describe('Estimate stage navigation', () => {
  test.skip(!path, 'Set a sanitized draft route to run the stage matrix.');
  if (path && (!path.startsWith('/') || path.startsWith('//'))) {
    throw new Error('TRADEOS_ESTIMATE_STAGE_PATH must be a relative application path');
  }
  if (state) test.use({ storageState: state, trace: 'off', video: 'off' });

  for (const width of [390, 768, 1024, 1440]) {
    test(`keyboard navigation waits for scope save and recovers from failure at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      let attempts = 0;
      let release: (() => void) | undefined;
      const submitted: unknown[] = [];
      await page.route('**/api/proxy/projects/*', async (route) => {
        if (route.request().method() !== 'PATCH') return route.continue();
        attempts++;
        const attempt = attempts;
        submitted.push(route.request().postDataJSON());
        await new Promise<void>((resolve) => { release = resolve; });
        await route.fulfill({ status: attempt === 1 ? 503 : 200, json: attempt === 1 ? { error: 'Isolated scope-save failure' } : {} });
      });
      await page.goto(path!);
      const nav = page.getByRole('navigation', { name: 'Estimate stages' });
      await expect(nav).toBeVisible();
      const capture = async (stage: string) => {
        if (process.env.TRADEOS_AGENT_EVIDENCE === 'true') {
          await test.info().attach(`${width}-${stage}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
        }
      };
      await capture('scope');
      const scope = nav.getByRole('button', { name: /Step 1 of 4: Scope/ });
      const items = nav.getByRole('button', { name: /Step 2 of 4: Items/ });
      const price = nav.getByRole('button', { name: /Step 3 of 4: Price/ });
      const review = nav.getByRole('button', { name: /Step 4 of 4: Review/ });
      await expect(nav.getByRole('button')).toHaveCount(4);
      await expect(scope).toHaveAttribute('aria-current', 'step');
      await expect(page.getByRole('button', { name: 'Finalize estimate', exact: true })).toBeHidden();
      const draft = 'Isolated stage test scope; preserve this text after failure.';
      await page.getByRole('textbox', { name: 'Estimate scope', exact: true }).fill(draft);

      for (const attempt of [1, 2]) {
        await scope.focus();
        await page.keyboard.press('Tab');
        await expect(items).toBeFocused();
        await page.keyboard.press(attempt === 1 ? 'Space' : 'Enter');
        await expect.poll(() => attempts).toBe(attempt);
        await expect(scope).toHaveAttribute('aria-current', 'step');
        for (const button of [items, price, review]) await expect(button).toBeDisabled();
        release!();
        if (attempt === 1) {
          await expect(page.getByRole('alert').filter({ hasText: 'Your scope is still in the editor' })).toBeVisible();
          await expect(page.getByRole('textbox', { name: 'Estimate scope', exact: true })).toHaveValue(draft);
          await expect(items).toBeEnabled();
          await expect(scope).toHaveAttribute('aria-current', 'step');
        }
      }
      await expect(items).toHaveAttribute('aria-current', 'step');
      await expect(page.getByRole('heading', { name: 'Estimate items', exact: true })).toBeVisible();
      await expect(page.getByRole('textbox', { name: 'Estimate scope', exact: true })).toBeHidden();
      await capture('items');
      await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
      await page.getByRole('textbox', { name: 'Description', exact: true }).fill('Unsaved isolated line edit');
      await items.focus();
      await page.keyboard.press('Tab');
      await expect(price).toBeFocused();
      await page.keyboard.press('Space');
      await expect(price).toHaveAttribute('aria-current', 'step');
      await expect(page.getByRole('heading', { name: 'Price the work' })).toBeVisible();
      await capture('price');
      await page.getByRole('spinbutton', { name: 'Percentage', exact: true }).fill('31');
      await price.focus();
      await page.keyboard.press('Tab');
      await expect(review).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(review).toHaveAttribute('aria-current', 'step');
      await expect(page.getByRole('button', { name: 'Finalize estimate', exact: true })).toBeVisible();
      await capture('review');
      await page.keyboard.press('Shift+Tab');
      await expect(price).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('spinbutton', { name: 'Percentage', exact: true })).toHaveValue('31');
      await page.setViewportSize({ width: width < 1024 ? 1440 : 390, height: 844 });
      await expect(price).toHaveAttribute('aria-current', 'step');
      await expect(page.getByRole('spinbutton', { name: 'Percentage', exact: true })).toHaveValue('31');
      await page.setViewportSize({ width, height: 844 });
      await scope.focus();
      await page.keyboard.press('Enter');
      await expect(scope).toHaveAttribute('aria-current', 'step');
      await expect(page.getByRole('textbox', { name: 'Estimate scope', exact: true })).toHaveValue(draft);
      await items.click();
      await expect(page.getByRole('textbox', { name: 'Description', exact: true })).toHaveValue('Unsaved isolated line edit');
      await scope.click();
      expect(submitted).toEqual([{ simpleScope: draft }, { simpleScope: draft }]);
      expect(attempts).toBe(2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  }

});
