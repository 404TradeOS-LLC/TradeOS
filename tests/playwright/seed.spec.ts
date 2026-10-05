import { test, expect } from '@playwright/test';

test.describe('TradeOS entry', () => {
  test('seed: logged-out login shell', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  });
});
