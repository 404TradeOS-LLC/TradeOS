import { expect, test, type Page } from '@playwright/test';

const authenticatedSmoke = process.env.TRADEOS_AGENT_AUTHENTICATED === 'true';
const storageState = authenticatedSmoke ? process.env.TRADEOS_AGENT_STORAGE_STATE : undefined;

if (storageState) {
  test.use({ storageState, trace: 'off' });
}

async function hrefs(page: Page, selector: string) {
  return page.locator(selector).evaluateAll((links) =>
    links
      .map((link) => link.getAttribute('href'))
      .filter((href): href is string => Boolean(href)),
  );
}

test.describe('TradeOS authenticated workspace', () => {
  test.skip(!authenticatedSmoke || !storageState, 'Authenticated evidence requires an enabled authenticated smoke and storage state.');

  test('Today command board renders for the governed smoke tenant', async ({ page }) => {
    const response = await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    expect(response?.status() ?? 0).toBeLessThan(400);
    await expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/);
    await expect(page.getByRole('heading', { level: 1, name: 'Today', exact: true })).toBeVisible();

    for (const section of ['Now', 'Needs you', 'Coming up', 'Money']) {
      await expect(page.getByRole('heading', { level: 2, name: section, exact: true })).toBeVisible();
    }

    await expect(page.getByRole('link', { name: 'Review work', exact: true })).toBeVisible();
  });

  test('Customers workspace and first available customer detail render read-only', async ({ page }) => {
    const response = await page.goto('/customers', { waitUntil: 'domcontentloaded' });

    expect(response?.status() ?? 0).toBeLessThan(400);
    await expect(page).toHaveURL(/\/customers(?:[/?#]|$)/);
    await expect(page.getByRole('heading', { level: 1, name: 'Customers', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Search customers', exact: true })).toBeVisible();

    const customerHref = (await hrefs(page, 'a[href^="/customers/"]')).find(
      (href) => href !== '/customers/new' && /^\/customers\/[^/?#]+$/.test(href),
    );

    if (!customerHref) {
      await expect(page.getByText('No customers yet.', { exact: true })).toBeVisible();
      return;
    }

    const detailResponse = await page.goto(customerHref, { waitUntil: 'domcontentloaded' });
    expect(detailResponse?.status() ?? 0).toBeLessThan(400);
    await expect(page).toHaveURL(/\/customers\/[^/?#]+(?:[/?#]|$)/);
    await expect(page.getByRole('navigation', { name: 'Customer workspace sections' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Current work', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Customer details', exact: true })).toBeVisible();
  });

  test('Projects workspace and first available project detail render read-only', async ({ page }) => {
    const response = await page.goto('/projects', { waitUntil: 'domcontentloaded' });

    expect(response?.status() ?? 0).toBeLessThan(400);
    await expect(page).toHaveURL(/\/projects(?:[/?#]|$)/);
    await expect(page.getByRole('heading', { level: 1, name: 'Projects', exact: true })).toBeVisible();

    const projectHref = (await hrefs(page, 'a[href^="/projects/"]')).find(
      (href) => href !== '/projects/new' && /^\/projects\/[^/?#]+$/.test(href),
    );

    if (!projectHref) {
      await expect(page.getByText('No projects yet', { exact: true })).toBeVisible();
      return;
    }

    const detailResponse = await page.goto(projectHref, { waitUntil: 'domcontentloaded' });
    expect(detailResponse?.status() ?? 0).toBeLessThan(400);
    await expect(page).toHaveURL(/\/projects\/[^/?#]+(?:[/?#]|$)/);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

    const projectWorkspace = page.getByRole('link', { name: 'Back to projects', exact: true });
    const leadWorkspace = page.getByRole('navigation', { name: 'Lead workspace' });
    await expect(projectWorkspace.or(leadWorkspace)).toBeVisible();
  });

  test('Estimates workspace renders without falling back to an error state', async ({ page }) => {
    const response = await page.goto('/estimates', { waitUntil: 'domcontentloaded' });

    expect(response?.status() ?? 0).toBeLessThan(400);
    await expect(page).toHaveURL(/\/estimates(?:[/?#]|$)/);
    await expect(page.getByRole('heading', { level: 1, name: 'Estimates', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Estimate from scope', exact: true })).toBeVisible();
    await expect(
      page.getByText('Estimates are temporarily unavailable. Try again in a moment.', { exact: true }),
    ).toHaveCount(0);

    const queue = page.getByRole('heading', { name: 'Open estimate queue', exact: true });
    const empty = page.getByText('No estimates need attention', { exact: true });
    await expect(queue.or(empty)).toBeVisible();
  });

  test('First available estimate opens the focused estimate workspace read-only', async ({ page }) => {
    const response = await page.goto('/estimates', { waitUntil: 'domcontentloaded' });

    expect(response?.status() ?? 0).toBeLessThan(400);
    await expect(
      page.getByText('Estimates are temporarily unavailable. Try again in a moment.', { exact: true }),
    ).toHaveCount(0);

    const estimateHref = (await hrefs(page, 'a[href^="/projects/"][href*="/estimates/"]')).find((href) =>
      /^\/projects\/[^/?#]+\/estimates\/[^/?#]+$/.test(href),
    );

    if (!estimateHref) {
      await expect(page.getByText('No estimates need attention', { exact: true })).toBeVisible();
      return;
    }

    const detailResponse = await page.goto(estimateHref, { waitUntil: 'domcontentloaded' });
    expect(detailResponse?.status() ?? 0).toBeLessThan(400);
    await expect(page).toHaveURL(/\/projects\/[^/?#]+\/estimates\/[^/?#]+(?:[/?#]|$)/);
    await expect(page.getByRole('heading', { level: 1, name: /^Estimate v\d+$/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Athena review', exact: true })).toBeVisible();
    await expect(page.getByText(/Unable to load this estimate\./)).toHaveCount(0);
  });
});
