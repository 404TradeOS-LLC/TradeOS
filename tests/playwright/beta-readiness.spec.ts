import { existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// This is auxiliary, READ-ONLY role/viewport acceptance. The canonical
// .github/workflows/beta-evidence.yml remains the only full evidence runner.
// Default CI must NOT imply these authenticated tests passed: tests skip unless
// explicitly enabled; when enabled, missing/invalid prerequisites fail fast.
const enabled = process.env.TRADEOS_BETA_CONTROL_ACCEPTANCE === 'true';
const ownerState = process.env.TRADEOS_BETA_OWNER_STORAGE_STATE;
const technicianState = process.env.TRADEOS_BETA_TECHNICIAN_STORAGE_STATE;

if (enabled) {
  const required = [
    ['TRADEOS_BETA_OWNER_STORAGE_STATE', ownerState],
    ['TRADEOS_BETA_TECHNICIAN_STORAGE_STATE', technicianState],
    ['TRADEOS_AGENT_BASE_URL', process.env.TRADEOS_AGENT_BASE_URL],
  ] as const;
  for (const [name, value] of required) {
    if (!value) throw new Error(`Beta control acceptance cannot run without ${name}`);
  }
  if (!ownerState || !technicianState || !existsSync(ownerState) || !existsSync(technicianState)) {
    throw new Error('Beta control acceptance requires existing, separate synthetic owner and technician storage-state files');
  }
  if (!['preview', 'staging'].includes(process.env.TRADEOS_AGENT_ENVIRONMENT ?? '') ||
      process.env.TRADEOS_AGENT_SANITIZED_TENANT !== 'true') {
    throw new Error('Beta control acceptance requires a declared sanitized preview/staging target; production is forbidden');
  }
}

const viewports = [
  { width: 1440, height: 900 },
  { width: 1024, height: 900 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
] as const;

test.describe('Beta readiness role and four-width acceptance (non-production only)', () => {
  test.skip(!enabled, 'NOT CERTIFIED: requires approved synthetic owner/technician sessions and a trusted preview/staging target.');
  // Never capture private login storage, network traces, screenshots, or
  // videos through this auxiliary suite. Canonical evidence captures are
  // governed separately by beta-evidence.yml and its artifact scrubber.
  test.use({ trace: 'off', screenshot: 'off', video: 'off' });

  test.describe('authenticated owner', () => {
    test.use({ storageState: ownerState ?? { cookies: [], origins: [] } });

    for (const viewport of viewports) {
      test(`owner can inspect a HOLD-only dashboard at ${viewport.width}px`, async ({ page }) => {
        await page.setViewportSize(viewport);
        const response = await page.goto('/beta-readiness', { waitUntil: 'domcontentloaded' });
        expect(response?.status()).toBe(200);
        await expect(page).toHaveURL(/beta-readiness(?:[/?#]|$)/);
        await expect(page.getByRole('heading', { name: /Beta readiness control/i })).toBeVisible();
        await expect(page.getByText('HOLD — NO PROMOTION', { exact: true })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Beta gate matrix' })).toBeVisible();
        await expect(page.getByRole('button', { name: /Refresh live/i })).toBeVisible();

        // Green CI must never turn a protected gate into PASS. Inspect the
        // gate evidence panel without dispatching the canonical workflow.
        await page.getByRole('button', { name: /Migration inventory and SHA-256 checksums/i }).click();
        await expect(page.getByText('No accepted evidence artifact').first()).toBeVisible();
        await expect(page.getByRole('link', { name: /Open workflow controls/i })).toBeVisible();

        const overflow = await page.evaluate(() =>
          document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        expect(overflow, 'Horizontal overflow would obscure release evidence').toBeLessThanOrEqual(1);
        await page.getByRole('button', { name: 'Open more menu' }).click();
        await expect(page.getByRole('link', { name: 'Beta readiness' })).toBeVisible();
      });
    }
  });

  test.describe('authenticated technician denied', () => {
    test.use({ storageState: technicianState ?? { cookies: [], origins: [] } });

    for (const viewport of viewports) {
      test(`technician receives not-found rather than release data at ${viewport.width}px`, async ({ page }) => {
        await page.setViewportSize(viewport);
        // Confirm this is an authenticated employee, not a logged-out session:
        // otherwise a login redirect could falsely look like role isolation.
        const landing = await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
        expect(landing?.status()).toBe(200);
        await expect(page).toHaveURL(/dashboard(?:[/?#]|$)/);
        await page.getByRole('button', { name: 'Open more menu' }).click();
        await expect(page.getByRole('link', { name: 'Beta readiness' })).toHaveCount(0);
        await page.getByRole('button', { name: 'Close more menu' }).click();

        const response = await page.goto('/beta-readiness', { waitUntil: 'domcontentloaded' });
        expect(response?.status(), 'An authenticated technician must receive a server-side 404').toBe(404);
        await expect(page.getByRole('heading', { name: /Beta readiness control/i })).toHaveCount(0);
        await expect(page.getByRole('heading', { name: 'Beta gate matrix' })).toHaveCount(0);
        await expect(page.getByRole('button', { name: /Refresh live/i })).toHaveCount(0);
      });
    }
  });
});
