import { expect, test } from '@playwright/test';

// Opt-in sanitized draft with a saved item. Every write is intercepted; this
// verifies editor validation/recovery without changing a persisted price.
const path = process.env.TRADEOS_ESTIMATE_STAGE_PATH;
const state = process.env.TRADEOS_ESTIMATE_STAGE_STATE;

test.describe('Estimate item cost editing', () => {
  test.skip(!path, 'Set a sanitized draft route containing a saved item.');
  if (path && (!path.startsWith('/') || path.startsWith('//'))) throw new Error('Use a relative draft route');
  if (state) test.use({ storageState: state, trace: 'off', video: 'off' });

  for (const width of [390, 768, 1024, 1440]) {
    test(`blank cost never writes and rejected edits retain input at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      const writes: Array<Record<string, unknown>> = [];
      const unexpected: string[] = [];
      let release: (() => void) | undefined;
      await page.route('**/api/proxy/**', async (route) => {
        const request = route.request();
        if (request.method() === 'GET') return route.fallback();
        if (request.method() === 'PATCH' && /\/estimates\/[^/]+\/line-items\/[^/]+$/.test(new URL(request.url()).pathname)) {
          writes.push(request.postDataJSON());
          await new Promise<void>((resolve) => { release = resolve; });
          return route.fulfill({ status: 503, json: { error: 'Isolated edit failure' } });
        }
        unexpected.push(request.url());
        return route.fulfill({ status: 403, json: { error: 'Isolated test refuses writes' } });
      });
      await page.goto(path!);
      await page.getByRole('navigation', { name: 'Estimate stages' }).getByRole('button', { name: /Step 2 of 4: Items/ }).click();
      await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
      const cost = page.getByRole('spinbutton', { name: 'Unit cost', exact: true });
      const save = page.getByRole('button', { name: 'Save', exact: true });
      const original = await cost.inputValue();
      expect(original).not.toBe('');
      expect(Number.isFinite(Number(original))).toBe(true);
      await cost.fill('');
      await expect(save).toBeDisabled();
      expect(writes).toHaveLength(0);
      for (const [index, value] of ['0', original].entries()) {
        await cost.fill(value);
        await expect(save).toBeEnabled();
        await save.click();
        await expect.poll(() => writes.length).toBe(index + 1);
        await expect(page.getByRole('button', { name: 'Saving…', exact: true })).toBeDisabled();
        release!();
        await expect(page.getByRole('alert').filter({ hasText: 'Isolated edit failure' })).toBeVisible();
        await expect(cost).toHaveValue(value);
        await expect(save).toBeEnabled();
        await cost.fill('');
        await expect(save).toBeDisabled();
        expect(writes).toHaveLength(index + 1);
      }
      expect(writes.map((write) => write.unitCost)).toEqual([0, Number(original)]);
      expect(unexpected).toEqual([]);
      await cost.fill(original);
      if (process.env.TRADEOS_AGENT_EVIDENCE === 'true') await test.info().attach(`${width}-cost-edit`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(cost).toBeHidden();
      await expect(page.getByRole('button', { name: 'Edit', exact: true }).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  }
});
