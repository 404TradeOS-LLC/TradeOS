import { expect, test } from '@playwright/test';

// Opt-in sanitized draft. Catalog responses are explicit synthetic fixtures;
// every non-GET proxy request is intercepted, so this suite never writes records.
const path = process.env.TRADEOS_ESTIMATE_STAGE_PATH;
const state = process.env.TRADEOS_ESTIMATE_STAGE_STATE;

test.describe('Estimate item entry', () => {
  test.skip(!path, 'Set a sanitized draft route containing a saved item.');
  if (path && (!path.startsWith('/') || path.startsWith('//'))) throw new Error('Use a relative draft route');
  if (state) test.use({ storageState: state, trace: 'off', video: 'off' });

  for (const width of [390, 768, 1024, 1440]) {
    test(`saved lines stay accessible and entry preserves drafts at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      const submitted: unknown[] = [];
      const unexpectedWrites: string[] = [];
      let release: (() => void) | undefined;
      let releaseCatalog: (() => void) | undefined;
      let assemblyReads = 0;
      let starterReads = 0;
      await page.route('**/api/proxy/**', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (request.method() !== 'GET') {
          if (request.method() === 'POST' && /\/estimates\/[^/]+\/line-items$/.test(url.pathname)) {
            submitted.push(request.postDataJSON());
            await new Promise<void>((resolve) => { release = resolve; });
            return route.fulfill({ status: 503, json: { error: 'Isolated item-write failure' } });
          }
          unexpectedWrites.push(url.pathname);
          return route.fulfill({ status: 403, json: { error: 'Isolated test refuses writes' } });
        }
        if (url.pathname.endsWith('/cost-database/cost-items/search')) {
          if (url.searchParams.get('q') === 'QA') await new Promise<void>((resolve) => { releaseCatalog = resolve; });
          return route.fulfill({ json: [{ id: 'qa-cost', name: 'QA cost item', code: 'QA-C', unitOfMeasure: 'EA' }] });
        }
        if (url.pathname.endsWith('/assemblies/search')) { assemblyReads++; return route.fulfill({ json: [{ id: 'qa-assembly', name: 'QA assembly', code: 'QA-A', unitOfMeasure: 'EA' }] }); }
        if (url.pathname.endsWith('/assemblies/starter-catalog')) { starterReads++; return route.fulfill({ json: { items: [] } }); }
        if (url.pathname.endsWith('/costbook/cost-items/qa-cost/unit-cost')) return route.fulfill({ json: { totalUnitCost: 19.25 } });
        return route.fallback();
      });
      await page.goto(path!);
      const nav = page.getByRole('navigation', { name: 'Estimate stages' });
      await nav.getByRole('button', { name: /Step 2 of 4: Items/ }).click();
      const assembly = page.getByRole('button', { name: 'Add assembly', exact: true });
      const catalog = page.getByRole('button', { name: 'Costbook', exact: true });
      const custom = page.getByRole('button', { name: 'Custom item', exact: true });
      for (const button of [assembly, catalog, custom]) await expect(button).toHaveAttribute('aria-expanded', 'false');
      await expect(page.getByRole('combobox')).toBeHidden();
      await expect(page.getByLabel('Custom line item', { exact: true })).toBeHidden();
      await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
      await expect(page.getByRole('textbox', { name: 'Description', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();

      await custom.focus();
      await page.keyboard.press('Enter');
      const description = page.getByLabel('Custom line item', { exact: true });
      await expect(description).toBeFocused();
      await description.fill('QA custom line');
      await page.getByLabel('Qty', { exact: true }).fill('0');
      const add = page.getByRole('button', { name: 'Add custom', exact: true });
      await expect(add).toBeDisabled();
      await page.getByLabel('Qty', { exact: true }).fill('2');
      await page.getByLabel('Unit cost', { exact: true }).fill('19.25');
      await custom.click();
      await expect(description).toBeHidden();

      await catalog.click();
      const search = page.getByRole('combobox', { name: 'Search Costbook items' });
      await expect(search).toBeFocused();
      await search.fill('QA');
      await expect(page.getByRole('status').filter({ hasText: 'Searching Costbook' })).toBeVisible();
      await expect(page.getByText('No matches yet.', { exact: false })).toBeHidden();
      await expect.poll(() => Boolean(releaseCatalog)).toBe(true);
      expect(assemblyReads).toBe(0);
      expect(starterReads).toBe(0);
      releaseCatalog!();
      await expect(page.getByRole('option', { name: /QA cost item/ })).toBeVisible();
      await expect(page.getByRole('option', { name: /QA assembly/ })).toBeHidden();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('button', { name: 'Add to estimate', exact: true })).toBeEnabled();
      expect(submitted).toHaveLength(0);
      await catalog.click();
      await expect(search).toBeHidden();
      await catalog.click();
      await expect(search).toHaveValue('QA cost item');
      await assembly.click();
      const assemblySearch = page.getByRole('combobox', { name: 'Search assemblies' });
      await expect(assemblySearch).toBeFocused();
      await assemblySearch.fill('QA');
      await expect(page.getByRole('option', { name: /QA assembly/ })).toBeVisible();
      expect(assemblyReads).toBeGreaterThan(0);
      expect(starterReads).toBeGreaterThan(0);
      await expect(page.getByRole('option', { name: /QA cost item/ })).toBeHidden();
      expect(submitted).toHaveLength(0);

      await custom.click();
      await expect(description).toHaveValue('QA custom line');
      await expect(page.getByLabel('Qty', { exact: true })).toHaveValue('2');
      await expect(page.getByLabel('Unit cost', { exact: true })).toHaveValue('19.25');
      for (const attempt of [1, 2]) {
        await add.click();
        await expect.poll(() => submitted.length).toBe(attempt);
        await expect(page.getByRole('button', { name: 'Adding…', exact: true })).toBeDisabled();
        release!();
        await expect(page.getByRole('alert').filter({ hasText: 'Isolated item-write failure' })).toBeVisible();
        await expect(add).toBeEnabled();
        await expect(description).toHaveValue('QA custom line');
      }
      expect(submitted).toEqual(Array(2).fill({ description: 'QA custom line', unitOfMeasure: 'EA', quantity: 2, unitCost: 19.25, section: 'Reconstruction / Finish', costType: 'labor', taxable: false }));
      expect(unexpectedWrites).toEqual([]);
      await custom.click();
      await expect(description).toBeHidden();
      if (process.env.TRADEOS_AGENT_EVIDENCE === 'true') await test.info().attach(`${width}-items`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  }
});
