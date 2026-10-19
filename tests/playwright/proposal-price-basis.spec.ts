import { expect, test } from '@playwright/test';

// Read-only, manual matrix for a sanitized proposal-new route with at least two
// finalized estimates with different totals and a saved intake price range.
const path = process.env.TRADEOS_PROPOSAL_PRICE_PATH;
const state = process.env.TRADEOS_PROPOSAL_PRICE_STATE;

test.describe('Proposal draft pricing basis', () => {
  test.skip(!path, 'Set a sanitized proposal-new route to run this matrix.');
  if (path && (!path.startsWith('/') || path.startsWith('//'))) {
    throw new Error('TRADEOS_PROPOSAL_PRICE_PATH must be a relative application path');
  }
  if (state) test.use({ storageState: state, trace: 'off', video: 'off' });

  for (const width of [390, 768, 1024, 1440]) {
    test(`shows the selected saved price at ${width}px without creating a proposal`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      const writes: string[] = [];
      await page.route('**/*', async (route) => {
        if (/^(POST|PATCH|PUT|DELETE)$/.test(route.request().method())) {
          writes.push(route.request().method());
          await route.abort();
        } else await route.continue();
      });
      await page.goto(path!);
      const select = page.getByLabel('Estimate', { exact: true });
      const options = await select.locator('option').evaluateAll((nodes) => nodes
        .map((node) => ({ value: node.value, text: node.textContent ?? '' }))
        .filter((option) => option.value !== ''));
      expect(options.length, 'Fixture requires two finalized estimates').toBeGreaterThanOrEqual(2);
      const summary = page.getByRole('status').filter({ hasText: 'Proposal price' });
      for (const option of options.slice(0, 2)) {
        await select.selectOption(option.value);
        const amount = Number(option.text.match(/\$([\d.]+)$/)?.[1]);
        expect(Number.isFinite(amount)).toBe(true);
        const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
        await expect(summary).toContainText(formatted);
        await expect(page.locator('#proposal-price-basis')).toContainText("saved total");
        expect(await select.evaluate((node: HTMLSelectElement) => new FormData(node.form!).get('estimateId'))).toBe(option.value);
      }
      await select.selectOption('');
      await expect(page.getByRole('status').filter({ hasText: 'Intake range' })).toBeVisible();
      await expect(page.locator('#proposal-price-basis')).toContainText('does not set a fixed proposal price');
      expect(await select.evaluate((node: HTMLSelectElement) => new FormData(node.form!).get('estimateId'))).toBe('');
      await select.selectOption(options[0].value);
      await expect(summary).toBeVisible();
      expect(writes).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  }
});
