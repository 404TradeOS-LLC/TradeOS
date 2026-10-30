import { expect, test } from '@playwright/test';

// Manual, non-production interaction regression for the estimate mapping
// resolve screen. Catalog, preview and install responses are intercepted;
// no mapping, install or estimate write reaches the backend. The page
// itself loads a real draft route, so a signed-in session is required.
const path = process.env.TRADEOS_ESTIMATE_STAGE_PATH;
const state = process.env.TRADEOS_ESTIMATE_STAGE_STATE;

const template = {
  id: 'tpl-fixture', code: 'FIX-WALL', name: 'Fixture wall',
  description: 'Fixture wall assembly for resolve evidence',
  unitOfMeasure: 'SF', trade: 'Carpentry', csiDivision: '06', csiTitle: 'Wood',
  nahbGroup: 'Framing', measurementBasis: 'Per SF', wasteGuidance: 'Allow waste.',
  version: 1,
  review: { status: 'research', source: 'Fixture', reviewedOn: '', regionalBasis: 'Fixture' },
  components: [
    { key: 'stud', label: 'Framing stud', quantityPerUnit: 1, help: 'Fixture', compatibleUnits: ['EA'], allowedCostItemKinds: ['material'] },
    { key: 'plate', label: 'Top plate', quantityPerUnit: 1, help: 'Fixture', compatibleUnits: ['LF'], allowedCostItemKinds: ['material'] },
  ],
};
const rows = [
  { id: 'stud-item', code: 'STUD', name: 'Stud item', unitOfMeasure: 'EA', isActive: true, materialId: 'material', laborRateId: null, equipmentId: null, subcontractorId: null, productionRate: null },
  { id: 'plate-item', code: 'PLATE', name: 'Plate item', unitOfMeasure: 'LF', isActive: true, materialId: 'material', laborRateId: null, equipmentId: null, subcontractorId: null, productionRate: null },
];
const unitCosts: Record<string, number> = { 'stud-item': 10, 'plate-item': 15 };

test.describe('Estimate mapping resolve', () => {
  test.skip(!path, 'Set a sanitized draft route to run the mapping matrix.');
  if (path && (!path.startsWith('/') || path.startsWith('//'))) {
    throw new Error('TRADEOS_ESTIMATE_STAGE_PATH must be a relative application path');
  }
  if (state) test.use({ storageState: state, trace: 'off', video: 'off' });

  const openResolveScreen = async (page: import('@playwright/test').Page) => {
    await page.route('**/api/proxy/projects/*', async (route) => {
      if (route.request().method() !== 'PATCH') return route.continue();
      await route.fulfill({ status: 200, json: {} });
    });
    await page.route('**/api/proxy/assemblies/starter-catalog', async (route) => {
      await route.fulfill({ status: 200, json: { items: [template] } });
    });
    await page.route('**/api/proxy/assemblies/search*', async (route) => {
      await route.fulfill({ status: 200, json: [] });
    });
    await page.route('**/api/proxy/costbook/cost-items/search*', async (route) => {
      await route.fulfill({ status: 200, json: rows });
    });
    await page.goto(path!);
    const nav = page.getByRole('navigation', { name: 'Estimate stages' });
    await expect(nav).toBeVisible();
    const items = nav.getByRole('button', { name: /Step 2 of 4: Items/ });
    if ((await items.getAttribute('aria-current')) !== 'step') await items.click();
    await page.getByRole('button', { name: 'Add assembly', exact: true }).click();
    await page.getByRole('combobox', { name: 'Search assemblies' }).fill('fixture');
    await page.getByRole('option', { name: /Fixture wall/ }).click();
    const screen = page.locator('section[aria-label="Resolve required assembly mapping"]');
    await expect(screen).toBeVisible();
    return screen;
  };

  const mapBoth = async (page: import('@playwright/test').Page) => {
    const studInput = page.getByRole('combobox', { name: 'Map Framing stud' });
    await studInput.click();
    await page.getByRole('option', { name: /STUD · Stud item/ }).click();
    await expect(studInput).toHaveValue('STUD · Stud item');
    const plateInput = page.getByRole('combobox', { name: 'Map Top plate' });
    await plateInput.click();
    await page.getByRole('option', { name: /PLATE · Plate item/ }).click();
    await expect(plateInput).toHaveValue('PLATE · Plate item');
    return { studInput, plateInput };
  };

  for (const width of [390, 768, 1024, 1440]) {
    test(`resolve matrix: initial, applying, price ready, installed at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      let installCalls = 0;
      let releasePreview: (() => void) | undefined;
      let releaseInstall: (() => void) | undefined;
      const previewGate = new Promise<void>((resolve) => { releasePreview = resolve; });
      const installGate = new Promise<void>((resolve) => { releaseInstall = resolve; });
      await page.route('**/api/proxy/costbook/cost-items/*/unit-cost', async (route) => {
        const id = route.request().url().split('/costbook/cost-items/')[1].split('/')[0];
        await previewGate;
        await route.fulfill({ status: 200, json: { totalUnitCost: unitCosts[id] ?? 0 } });
      });
      await page.route('**/api/proxy/assemblies/starter-catalog/install', async (route) => {
        if (route.request().method() !== 'POST') return route.continue();
        installCalls++;
        await installGate;
        await route.fulfill({ status: 200, json: { id: 'asm-1', name: 'Fixture wall', code: 'FIX', unitOfMeasure: 'SF' } });
      });
      await page.route('**/api/proxy/assemblies/asm-1/unit-cost', async (route) => {
        await route.fulfill({ status: 200, json: { unitCost: 25, componentCount: 2 } });
      });
      await page.route('**/api/proxy/assemblies/asm-1/items*', async (route) => {
        await route.fulfill({ status: 200, json: { items: [
          { id: 'i1', componentName: 'Framing stud', componentCode: 'STUD', componentUnitOfMeasure: 'EA', quantityPerUnit: 1, componentType: 'cost_item' },
          { id: 'i2', componentName: 'Top plate', componentCode: 'PLATE', componentUnitOfMeasure: 'LF', quantityPerUnit: 1, componentType: 'cost_item' },
        ], total: 2 } });
      });
      const screen = await openResolveScreen(page);
      const capture = async (stage: string) => {
        if (process.env.TRADEOS_AGENT_EVIDENCE === 'true') {
          await test.info().attach(`${width}-mapping-${stage}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
        }
      };
      const expectNoHorizontalOverflow = async () => {
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      };
      const checklist = page.locator('section[aria-label="Before you continue"]');
      await expect(page.getByRole('heading', { name: 'Resolve required assembly mapping', exact: true })).toBeVisible();
      await expect(checklist).toContainText('Map 2 more components.');
      await expect(page.getByRole('button', { name: 'Resolve Cost item mappings', exact: true })).toBeDisabled();
      await expectNoHorizontalOverflow();
      await capture('initial');
      await mapBoth(page);
      await expect(checklist).toContainText('All 2 slots mapped.');
      await expect(page.getByText('Resolving mapped Costbook costs…')).toBeVisible();
      releasePreview!();
      await expect(page.getByText('$25.00').first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Resolve Cost item mappings', exact: true })).toBeEnabled();
      await expectNoHorizontalOverflow();
      await capture('ready');
      await page.getByRole('button', { name: 'Resolve Cost item mappings', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Resolving…', exact: true })).toBeDisabled();
      releaseInstall!();
      await expect(page.getByRole('heading', { name: 'Resolve required assembly mapping', exact: true })).toBeHidden();
      await expect(page.getByText('2 resolved components')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Add to estimate', exact: true })).toBeEnabled();
      expect(installCalls).toBe(1);
      await expectNoHorizontalOverflow();
      await capture('resolved');
    });

    test(`keep draft unchanged closes without installing at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      let installCalls = 0;
      await page.route('**/api/proxy/assemblies/starter-catalog/install', async (route) => {
        if (route.request().method() !== 'POST') return route.continue();
        installCalls++;
        await route.fulfill({ status: 200, json: { id: 'asm-1', name: 'Fixture wall', code: 'FIX', unitOfMeasure: 'SF' } });
      });
      const screen = await openResolveScreen(page);
      await mapBoth(page);
      await page.getByRole('button', { name: 'Keep draft unchanged', exact: true }).click();
      await expect(screen).toBeHidden();
      await expect(page.getByRole('combobox', { name: 'Search assemblies' })).toBeVisible();
      expect(installCalls).toBe(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });

    test(`install failure preserves mappings at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.route('**/api/proxy/costbook/cost-items/*/unit-cost', async (route) => {
        const id = route.request().url().split('/costbook/cost-items/')[1].split('/')[0];
        await route.fulfill({ status: 200, json: { totalUnitCost: unitCosts[id] ?? 0 } });
      });
      await page.route('**/api/proxy/assemblies/starter-catalog/install', async (route) => {
        if (route.request().method() !== 'POST') return route.continue();
        await route.fulfill({ status: 500, json: { error: 'Isolated install failure' } });
      });
      const screen = await openResolveScreen(page);
      const { studInput, plateInput } = await mapBoth(page);
      const resolve = page.getByRole('button', { name: 'Resolve Cost item mappings', exact: true });
      await expect(resolve).toBeEnabled();
      await resolve.click();
      await expect(screen.getByRole('alert')).toBeVisible();
      await expect(studInput).toHaveValue('STUD · Stud item');
      await expect(plateInput).toHaveValue('PLATE · Plate item');
      await expect(resolve).toBeEnabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });

    test(`preview failure offers retry at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      const attempts = new Map<string, number>();
      await page.route('**/api/proxy/costbook/cost-items/*/unit-cost', async (route) => {
        const url = route.request().url();
        const id = url.split('/costbook/cost-items/')[1].split('/')[0];
        const count = (attempts.get(url) ?? 0) + 1;
        attempts.set(url, count);
        if (count === 1) await route.fulfill({ status: 500, json: { error: 'Isolated preview failure' } });
        else await route.fulfill({ status: 200, json: { totalUnitCost: unitCosts[id] ?? 0 } });
      });
      const screen = await openResolveScreen(page);
      await mapBoth(page);
      await expect(screen.getByText('Cost preview unavailable.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Resolve Cost item mappings', exact: true })).toBeDisabled();
      await page.getByRole('button', { name: 'Retry Costbook cost preview' }).click();
      await expect(page.getByText('$25.00').first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Resolve Cost item mappings', exact: true })).toBeEnabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  }
});
