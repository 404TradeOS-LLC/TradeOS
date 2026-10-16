import { expect, test } from '@playwright/test';

// Manual, non-production recovery check. Uses a saved draft with at least one
// item. Finalization is intercepted: this test must never finalize real data.
const path = process.env.TRADEOS_ESTIMATE_RECOVERY_PATH;
const state = process.env.TRADEOS_ESTIMATE_RECOVERY_STATE;

test.describe('Estimate finalization recovery', () => {
  test.skip(!path, 'Set a sanitized draft route to run the recovery matrix.');
  if (path && (!path.startsWith('/') || path.startsWith('//'))) {
    throw new Error('TRADEOS_ESTIMATE_RECOVERY_PATH must be a relative application path');
  }
  if (state) test.use({ storageState: state, trace: 'off', video: 'off' });

  for (const width of [390, 768, 1024, 1440]) {
    test(`failed finalize is visible, focused and retryable at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      let attempts = 0;
      await page.route('**/api/proxy/estimates/*/finalize', async (route) => {
        attempts++;
        // Delay exposes the pending state, including on a repeated identical error.
        await new Promise((resolve) => setTimeout(resolve, 150));
        await route.fulfill({ status: 503, json: { error: 'Recovery test: service unavailable.' } });
      });

      await page.goto(path!);
      if (width < 1024) await page.getByRole('tab', { name: /Review/ }).click();
      await page.getByRole('button', { name: 'Finalize estimate', exact: true }).click();

      for (let attempt = 1; attempt <= 2; attempt++) {
        const alert = page.getByRole('alert').filter({ hasText: 'Finalization failed.' });
        await expect(alert).toContainText('Recovery test: service unavailable.');
        await expect(alert).toContainText('Your saved draft remains available.');
        await expect(alert).toBeFocused();
        const box = await alert.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.y).toBeGreaterThanOrEqual(0);
        expect(box!.y + box!.height).toBeLessThanOrEqual(844);
        const retry = page.getByRole('button', { name: 'Retry finalization', exact: true });
        await expect(retry).toBeEnabled();
        if (width < 1024) {
          const actionBox = await retry.boundingBox();
          expect(box!.y + box!.height).toBeLessThan(actionBox!.y);
        }
        expect(attempts).toBe(attempt);
        // Tab from the recovery notice reaches the working retry action.
        await page.keyboard.press('Tab');
        await expect(retry).toBeFocused();
        if (attempt === 1) {
          await page.keyboard.press('Enter');
          await expect(page.getByRole('button', { name: 'Finalizing…', exact: true })).toBeDisabled();
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await expect(page.getByRole('link', { name: 'Review proposal draft', exact: true })).toHaveCount(0);
    });
  }
});
