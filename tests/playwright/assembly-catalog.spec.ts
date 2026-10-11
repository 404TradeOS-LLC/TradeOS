import { expect, test, type Page } from '@playwright/test';

// Manual-only evidence for sanitized, Vercel-attested Preview/Staging.
// Both identities must be logged in through the real form into the same tenant.
const enabled = process.env.TRADEOS_ASSEMBLY_EVIDENCE === 'true';
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const;
const roles = [
  { name: 'owner', state: process.env.TRADEOS_ASSEMBLY_OWNER_STATE, canInstall: true },
  { name: 'read-only', state: process.env.TRADEOS_ASSEMBLY_READER_STATE, canInstall: false },
] as const;

async function checkViewport(page: Page, width: number) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    pathname: location.pathname,
  }));
  expect(metrics.pathname).toBe('/costbook/assemblies');
  expect(metrics.clientWidth).toBe(width);
  expect(metrics.scrollWidth, 'Unexpected horizontal overflow on Assembly Catalog').toBeLessThanOrEqual(width + 2);
}

for (const role of roles) {
  test.describe(`Assembly Catalog / ${role.name}`, () => {
    // A normal local/CI test discovery cannot accidentally capture credentials.
    test.skip(!enabled, 'Run only with the manually attested Assembly Catalog evidence workflow.');
    if (enabled && !role.state) {
      throw new Error(`Missing authenticated ${role.name} storage state. Never substitute another role or skip this matrix cell.`);
    }
    if (role.state) test.use({ storageState: role.state, trace: 'off', video: 'off' });

    for (const viewport of viewports) {
      test(`renders filters and role permissions at ${viewport.width}px`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        const forbiddenWrites: string[] = [];
        page.on('request', (request) => {
          if (
            /^(POST|PATCH|PUT|DELETE)$/.test(request.method()) &&
            /\/api\/(?:proxy\/)?(?:v1\/)?costbook\/assemblies(?:\/|\?|$)/.test(new URL(request.url()).pathname)
          ) forbiddenWrites.push(`${request.method()} ${new URL(request.url()).pathname}`);
        });

        const response = await page.goto('/costbook/assemblies', { waitUntil: 'domcontentloaded' });
        expect(response?.status()).toBe(200);
        await expect(page).toHaveURL(/\/costbook\/assemblies(?:[/?#]|$)/);
        await expect(page.getByRole('heading', { name: 'Assemblies', level: 1 })).toBeVisible();

        const catalog = page.locator('section').filter({
          has: page.getByRole('heading', { name: 'Residential Assembly Catalog', exact: true }),
        }).first();
        await expect(catalog.getByRole('heading', { name: 'Residential Assembly Catalog' })).toBeVisible();
        for (const label of [
          'Filter by NAHB group',
          'Filter by CSI division',
          'Filter by trade',
          'Filter by assembly unit',
          'Filter by installation status',
        ]) {
          await expect(catalog.getByLabel(label, { exact: true })).toBeVisible();
        }
        await expect(catalog.getByRole('status')).toContainText(/\d+ of \d+ recipes/);
        const installedFilter = catalog.getByLabel('Filter by installation status');
        await installedFilter.selectOption('available');
        await expect(catalog.getByRole('status')).toContainText(/\d+ of \d+ recipes/);
        const availableCount = Number((await catalog.getByRole('status').innerText()).match(/^(\d+) of/)?.[1] ?? 0);
        expect(availableCount, 'Smoke tenant must have at least one uninstalled reviewed starter').toBeGreaterThan(0);

        const firstAvailable = catalog.getByRole('button', { name: /^Review assembly / }).first();
        await expect(firstAvailable).toBeVisible();
        await firstAvailable.click();
        await expect(catalog.getByText('Map the recipe', { exact: true })).toBeVisible();
        const install = catalog.getByRole('button', { name: 'Install assembly', exact: true });
        if (role.canInstall) {
          await expect(install).toBeEnabled();
        } else {
          await expect(install).toBeDisabled();
          // The read-only identity must not gain any Costbook creation affordance.
          await expect(page.getByText('New Assembly', { exact: true })).toHaveCount(0);
        }

        // One facet change removes the selected recipe and its mapping controls.
        const csi = catalog.getByLabel('Filter by CSI division');
        const csiValue = await csi.locator('option:not([value="all"])').first().getAttribute('value');
        expect(csiValue, 'Catalog must expose at least one reviewed CSI division').toBeTruthy();
        await csi.selectOption(csiValue!);
        await expect(catalog.getByText('Choose a starter assembly', { exact: true })).toBeVisible();
        await expect(catalog.getByText('Map the recipe', { exact: true })).toHaveCount(0);

        // Explicit empty and reset behavior, including after multiple facets.
        await catalog.getByLabel('Search starter assemblies').fill('__tradeos_no_matching_recipe_518__');
        await expect(catalog.getByText('No starter assemblies match those filters.')).toBeVisible();
        await catalog.getByRole('button', { name: 'Clear filters' }).first().click();
        await expect(catalog.getByLabel('Filter by CSI division')).toHaveValue('all');
        await expect(catalog.getByLabel('Filter by installation status')).toHaveValue('all');
        await expect(catalog.getByLabel('Search starter assemblies')).toHaveValue('');
        await expect(catalog.getByRole('button', { name: /^Review assembly / }).first()).toBeVisible();
        await checkViewport(page, viewport.width);
        expect(forbiddenWrites, 'Read-only browse evidence must not mutate tenant assemblies').toEqual([]);

        const file = testInfo.outputPath(`assembly-${role.name}-${viewport.name}.png`);
        await page.screenshot({ path: file, fullPage: true, animations: 'disabled' });
        await testInfo.attach(`assembly-${role.name}-${viewport.name}`, {
          path: file, contentType: 'image/png',
        });
      });
    }
  });
}
