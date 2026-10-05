import { expect, test } from '@playwright/test';

const storageState = process.env.TRADEOS_AGENT_STORAGE_STATE;

if (storageState) {
  test.use({ storageState });
}

test.describe('TradeOS authenticated workspace', () => {
  test.skip(!storageState, 'Authenticated evidence requires TRADEOS_AGENT_STORAGE_STATE.');

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
});
