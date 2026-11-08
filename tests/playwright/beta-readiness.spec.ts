import { existsSync, realpathSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// This is auxiliary, READ-ONLY role/viewport acceptance. The canonical
// .github/workflows/beta-evidence.yml remains the only full evidence runner.
// Default CI must NOT imply these authenticated tests passed: tests skip unless
// explicitly enabled; when enabled, missing/invalid prerequisites fail fast.
const enabled = process.env.TRADEOS_BETA_CONTROL_ACCEPTANCE === 'true';
const ownerState = process.env.TRADEOS_BETA_OWNER_STORAGE_STATE;
const technicianState = process.env.TRADEOS_BETA_TECHNICIAN_STORAGE_STATE;
const customerOwnerState = process.env.TRADEOS_BETA_CUSTOMER_OWNER_STORAGE_STATE;
const operatorOrgId = process.env.TRADEOS_BETA_OPERATOR_ORG_ID;
const customerOrgId = process.env.TRADEOS_BETA_CUSTOMER_ORG_ID;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// The proxy uses the authenticated Settings identity consumed by BetaReadinessPage.
// Reaching /dashboard alone would not prove a different customer organization.
async function requireSyntheticIdentity(page: Page, allowedRoles: string[], expectedOrgId?: string) {
  const response = await page.request.get('/api/proxy/settings', { failOnStatusCode: false });
  expect(response.status(), 'fixture must have authenticated Settings access').toBe(200);
  const identity: unknown = await response.json();
  const record = identity !== null && typeof identity === 'object'
    ? identity as { orgId?: unknown; currentRole?: unknown }
    : {};
  expect(typeof record.currentRole === 'string' && allowedRoles.includes(record.currentRole),
    'fixture must have the declared authenticated role').toBe(true);
  if (expectedOrgId) {
    expect(typeof record.orgId === 'string' && record.orgId.toLowerCase() === expectedOrgId.toLowerCase(),
      'fixture must belong to the declared synthetic organization').toBe(true);
  }
}

if (enabled) {
  const required = [
    ['TRADEOS_BETA_OWNER_STORAGE_STATE', ownerState],
    ['TRADEOS_BETA_TECHNICIAN_STORAGE_STATE', technicianState],
    ['TRADEOS_BETA_CUSTOMER_OWNER_STORAGE_STATE', customerOwnerState],
    ['TRADEOS_BETA_OPERATOR_ORG_ID', operatorOrgId],
    ['TRADEOS_BETA_CUSTOMER_ORG_ID', customerOrgId],
    ['TRADEOS_AGENT_BASE_URL', process.env.TRADEOS_AGENT_BASE_URL],
  ] as const;
  for (const [name, value] of required) {
    if (!value) throw new Error(`Beta control acceptance cannot run without ${name}`);
  }
  if (!ownerState || !technicianState || !customerOwnerState ||
      !existsSync(ownerState) || !existsSync(technicianState) || !existsSync(customerOwnerState)) {
    throw new Error('Beta control acceptance requires three synthetic role/organization storage-state files');
  }
  if (new Set([ownerState, technicianState, customerOwnerState].map(path => realpathSync(path))).size !== 3) {
    throw new Error('Beta control acceptance requires distinct authenticated synthetic sessions');
  }
  if (!operatorOrgId || !customerOrgId || !UUID.test(operatorOrgId) || !UUID.test(customerOrgId) ||
      operatorOrgId.toLowerCase() === customerOrgId.toLowerCase()) {
    throw new Error('Beta control acceptance requires distinct declared synthetic organization UUIDs');
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

// Never capture private login storage, network traces, screenshots, or
// videos through this auxiliary suite. Canonical evidence captures are
// governed separately by beta-evidence.yml and its artifact scrubber.
// Top-level only: trace/screenshot/video force a new worker and Playwright
// rejects test.use for them inside a describe group (file fails to load).
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test.describe('Beta readiness role and four-width acceptance (non-production only)', () => {
  test.skip(!enabled, 'NOT CERTIFIED: requires distinct operator owner, customer owner and technician sessions on approved staging.');

  test.describe('authenticated owner', () => {
    test.use({ storageState: ownerState ?? { cookies: [], origins: [] } });

    for (const viewport of viewports) {
      test(`owner can inspect a HOLD-only dashboard at ${viewport.width}px`, async ({ page }) => {
        await page.setViewportSize(viewport);
        const landing = await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
        expect(landing?.status()).toBe(200);
        await requireSyntheticIdentity(page, ['owner', 'admin'], operatorOrgId);
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
        await requireSyntheticIdentity(page, ['technician']);
        await page.getByRole('button', { name: 'Open more menu' }).click();
        await expect(page.getByRole('link', { name: 'Beta readiness' })).toHaveCount(0);

        // Navigate directly with the menu open: the close locator is
        // ambiguous (the backdrop and the dock toggle both carry the name
        // 'Close more menu'), and the 404 comes from the server either way.
        const response = await page.goto('/beta-readiness', { waitUntil: 'domcontentloaded' });
        expect(response?.status(), 'An authenticated technician must receive a server-side 404').toBe(404);
        await expect(page.getByRole('heading', { name: /Beta readiness control/i })).toHaveCount(0);
        await expect(page.getByRole('heading', { name: 'Beta gate matrix' })).toHaveCount(0);
        await expect(page.getByRole('button', { name: /Refresh live/i })).toHaveCount(0);
      });
    }
  });

  test.describe('authenticated other-customer organization owner denied', () => {
    test.use({ storageState: customerOwnerState ?? { cookies: [], origins: [] } });

    for (const viewport of viewports) {
      test('customer owner denied at ' + viewport.width + 'px', async ({ page }) => {
        await page.setViewportSize(viewport);
        const landing = await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
        expect(landing?.status(), 'customer fixture must be authenticated').toBe(200);
        await expect(page).toHaveURL(/dashboard(?:[/?#]|$)/);
        await requireSyntheticIdentity(page, ['owner', 'admin'], customerOrgId);
        // A customer owner/admin is never the operator organization, so the
        // navigation link must stay hidden even though the role alone is
        // owner/admin; the route itself also denies with a server 404.
        await page.getByRole('button', { name: 'Open more menu' }).click();
        await expect(page.getByRole('link', { name: 'Beta readiness' })).toHaveCount(0);
        const response = await page.goto('/beta-readiness', { waitUntil: 'domcontentloaded' });
        expect(response?.status(), 'other-customer owner must receive server-side denial').toBe(404);
        await expect(page.getByRole('heading', { name: /Beta readiness control/i })).toHaveCount(0);
        await expect(page.getByRole('heading', { name: 'Beta gate matrix' })).toHaveCount(0);
        await expect(page.getByText('HOLD — NO PROMOTION', { exact: true })).toHaveCount(0);
        await expect(page.getByRole('button', { name: /Refresh live/i })).toHaveCount(0);
      });
    }
  });
});
