import { expect, test } from '@playwright/test';

// Read-only layout/label checks against a sanitized draft with a saved item.
// Every non-GET proxy request is refused, including accidental Save actions.
const path = process.env.TRADEOS_ESTIMATE_STAGE_PATH;
const state = process.env.TRADEOS_ESTIMATE_STAGE_STATE;

test.describe('Estimate saved item presentation', () => {
  test.skip(!path, 'Set a sanitized draft route containing a saved item.');
  if (path && (!path.startsWith('/') || path.startsWith('//'))) throw new Error('Use a relative draft route');
  if (state) test.use({ storageState: state, trace: 'off', video: 'off' });
  for (const width of [390, 768, 1024, 1440]) {
    test(`saved costs align and edit labels remain usable at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      const writes: string[] = [];
      await page.route('**/api/proxy/**', (route) => {
        if (route.request().method() === 'GET') return route.fallback();
        writes.push(route.request().url());
        return route.fulfill({ status: 403, json: { error: 'Read-only layout test refuses writes' } });
      });
      const detail = page.waitForResponse((response) => response.request().method() === 'GET' && /\/api\/proxy\/estimates\/[^/]+$/.test(new URL(response.url()).pathname) && response.status() === 200);
      await page.goto(path!);
      const saved = await (await detail).json();
      expect(saved.lineItems.length).toBeGreaterThan(0);
      const item = saved.lineItems[0];
      const money = (value: unknown) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(Number(value));
      await page.getByRole('navigation', { name: 'Estimate stages' }).getByRole('button', { name: /Step 2 of 4: Items/ }).click();
      const heading = page.getByText('Item / pricing basis', { exact: true });
      if (width >= 1024) await expect(heading).toBeVisible();
      else await expect(heading).toBeHidden();
      const row = page.getByRole('listitem', { name: item.description, exact: true }).first();
      const quantity = row.getByRole('group', { name: 'Quantity', exact: true });
      const unitCost = row.getByRole('group', { name: 'Unit cost', exact: true });
      const lineCost = row.getByRole('group', { name: 'Line cost', exact: true });
      await expect(lineCost).toHaveText(money(item.lineCost));
      if (width >= 1024) {
        await expect(quantity).toHaveText(`${item.quantity} ${item.unitOfMeasure}`);
        await expect(unitCost).toHaveText(money(item.unitCost));
        const headers = heading.locator('..');
        for (const [label, cell] of [['Quantity', quantity], ['Unit cost', unitCost], ['Line cost', lineCost]] as const) {
          const headerBox = await headers.getByText(label, { exact: true }).boundingBox();
          const cellBox = await cell.boundingBox();
          expect(headerBox).not.toBeNull();
          expect(cellBox).not.toBeNull();
          expect(Math.abs(headerBox!.x - cellBox!.x)).toBeLessThan(2);
        }
      } else {
        await expect(quantity).toBeHidden();
        await expect(unitCost).toBeHidden();
        await expect(row.getByText(`${item.quantity} ${item.unitOfMeasure} × ${money(item.unitCost)}`, { exact: true })).toBeVisible();
        expect((await row.getByRole('button', { name: 'Edit', exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      await row.getByRole('button', { name: 'Edit', exact: true }).click();
      for (const label of ['Description', 'Section', 'Quantity', 'Unit cost', 'Unit', 'Cost type']) await expect(row.getByText(label, { exact: true })).toBeVisible();
      await row.getByRole('button', { name: 'Save', exact: true }).focus();
      await page.keyboard.press('Tab');
      await expect(row.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(lineCost).toHaveText(money(item.lineCost));
      expect(writes).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      if (process.env.TRADEOS_AGENT_EVIDENCE === 'true') {
        await page.evaluate(() => window.scrollTo(0, 0));
        await test.info().attach(`${width}-saved-items`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
      }
    });
  }
});
