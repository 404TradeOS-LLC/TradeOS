import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { buildTodayFixture, syntheticTodayData } from './today-fixture';

let fixture: Awaited<ReturnType<typeof buildTodayFixture>>;

test.beforeAll(async () => { fixture = await buildTodayFixture(); });
test.afterAll(() => { fixture?.cleanup(); });

async function openSyntheticToday(page: Page, query = '') {
  // All requests terminate here. This suite cannot contact a deployment or
  // perform authenticated writes; the rendered components are production code.
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'https://tradeos.component.test') return route.abort('blockedbyclient');
    if (url.pathname === '/today-construction-hero.webp') return route.fulfill({ contentType: 'image/webp', body: readFileSync('web/public/today-construction-hero.webp') });
    if (url.pathname === '/api/proxy/jobs/dispatch-summary') return route.fulfill({ json: { needsAttention: 2 } });
    if (url.pathname === '/api/proxy/athena/capabilities') return route.fulfill({ json: { kernelEnabled: false } });
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, json: { error: 'Synthetic transport unavailable' } });
    return route.fulfill({ contentType: 'text/html; charset=utf-8', body: fixture.html });
  });
  await page.goto('https://tradeos.component.test/dashboard' + query);
  await expect(page.locator('.today-experience')).toBeVisible();
}

async function expectNoPageOverflow(page: Page, width: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}

for (const width of [390, 768, 1024, 1440]) {
  for (const theme of ['light', 'dark']) {
    test(`Today production interactions at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await openSyntheticToday(page, '?failure=attention&theme=' + theme);
      await expect(page.getByRole('heading', { name: 'Good morning, Synthetic Owner.' })).toBeVisible();
      await expect(page.locator('.today-view-nav').getByRole('link', { name: 'Needs You —', exact: true })).toBeVisible();
      await expect(page.locator('.today-attention .today-count')).toHaveText('—');
      await expect(page.getByText('Synthetic kitchen framing', { exact: true }).first()).toBeVisible();
      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*\bdark\b)/);
      await expectNoPageOverflow(page, width);

      const workFilters = page.getByRole('group', { name: "Filter today's work" });
      await workFilters.getByRole('button', { name: 'Tasks', exact: true }).click();
      await expect(page.locator('.today-work').getByText('Synthetic permit check', { exact: true })).toBeVisible();
      await expect(page.locator('.today-work').getByText('Synthetic kitchen framing', { exact: true })).toHaveCount(0);
      await workFilters.getByRole('button', { name: 'All', exact: true }).click();
      const timeline = page.getByLabel('Scrollable daily timeline');
      await timeline.getByRole('button', { name: /Synthetic kitchen framing/ }).click();
      const workspace = page.getByRole('dialog', { name: 'Synthetic kitchen framing', exact: true });
      await expect(workspace).toBeVisible();
      await expect(workspace.getByRole('link', { name: 'Open scheduled work' })).toHaveAttribute('href', syntheticTodayData.work[0].href);
      await expect(workspace.getByRole('button', { name: 'Close workspace' })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(workspace).not.toBeVisible();
      await expect(timeline.getByRole('button', { name: /Synthetic kitchen framing/ })).toBeFocused();

      const athena = page.getByRole('button', { name: /Athena Operations partner/ });
      await expect(athena).toHaveAttribute('aria-expanded', 'false');
      await athena.click();
      await expect(page.getByText('Athena is unavailable for this workspace.', { exact: false })).toBeVisible();
      await athena.click();
      await expect(athena).toHaveAttribute('aria-expanded', 'false');

      const dock = page.getByRole('navigation', { name: '404TradeOS Control Dock' });
      await expect(dock).toBeVisible();
      const create = dock.getByRole('button', { name: 'Create', exact: true });
      await create.click();
      const createDialog = page.getByRole('dialog', { name: 'Create', exact: true });
      await expect(createDialog).toBeVisible();
      for (const [name, href] of [
        ['New Estimate', '/projects/new?intent=estimate#simpleScope'],
        ['New Job', '/projects?intent=job'], ['New Customer', '/customers/new'],
        ['New Invoice', '/projects?intent=invoice'], ['New Task', '/projects?intent=task'],
      ]) await expect(createDialog.getByRole('link', { name: new RegExp(name) })).toHaveAttribute('href', href);
      await page.keyboard.press('Escape');
      await expect(createDialog).toHaveCount(0);
      await expect(create).toBeFocused();

      const more = dock.getByRole('button', { name: 'Open more menu' });
      await more.click();
      const moreDialog = page.getByRole('dialog', { name: 'More navigation', exact: true });
      await expect(moreDialog).toBeVisible();
      const focusables = moreDialog.locator('[tabindex="-1"]').locator('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])');
      await focusables.last().focus();
      await page.keyboard.press('Tab');
      await expect(focusables.first()).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(focusables.last()).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(moreDialog).toHaveCount(0);
      await expect(more).toBeFocused();
      await expectNoPageOverflow(page, width);
      await page.screenshot({ path: test.info().outputPath(`today-${theme}-${width}.png`), fullPage: true });
      expect(errors).toEqual([]);
    });
  }
}

test('Needs You filters real source rows, opens context, and preserves unknown total', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await openSyntheticToday(page, '?view=attention&role=office&failure=attention');
  await expect(page.getByText('Office manager', { exact: true })).toBeVisible();
  await expect(page.locator('.today-attention .today-count')).toHaveText('—');
  const list = page.locator('.today-attention');
  await page.getByLabel('Filter by source').selectOption('Proposals');
  await expect(list.getByRole('heading', { name: 'Synthetic deck proposal needs follow-up' })).toBeVisible();
  await expect(list.getByRole('heading', { name: 'Synthetic kitchen task blocked' })).toHaveCount(0);
  await page.getByLabel('Filter by source').selectOption('all');
  await page.getByLabel('Search attention items').fill('kitchen');
  await expect(list.getByRole('heading', { name: 'Synthetic kitchen task blocked' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('1 matching loaded records');
  await page.getByLabel('Search attention items').fill('');
  await page.getByLabel('Filter by assignee').selectOption('Synthetic Office');
  await expect(page.getByRole('status')).toHaveText('1 matching loaded records');
  await page.getByLabel('Filter by priority').selectOption('urgent');
  await expect(page.getByText('No items match these filters.')).toBeVisible();
  await page.getByLabel('Filter by priority').selectOption('all');
  const trigger = page.getByRole('button', { name: 'Review proposal: Synthetic deck proposal needs follow-up' });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Synthetic deck proposal needs follow-up' });
  await expect(dialog.getByRole('link', { name: 'Review proposal' })).toHaveAttribute('href', syntheticTodayData.attention[1].href);
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expectNoPageOverflow(page, 390);
  await page.screenshot({ path: test.info().outputPath('today-needs-you-mobile.png'), fullPage: true });
});

test('field presentation retains assigned work and denies creation entry points', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await openSyntheticToday(page, '?role=field');
  await expect(page.getByText('Field crew', { exact: true })).toBeVisible();
  await expect(page.getByText('Your assigned field work', { exact: true })).toBeVisible();
  await expect(page.locator('.today-quick-create').getByRole('link')).toHaveCount(0);
  await expect(page.getByRole('group', { name: "Filter today's work" }).getByRole('button', { name: 'Tasks', exact: true })).toHaveCount(0);
  await expect(page.getByText('Synthetic deck proposal needs follow-up', { exact: true })).toHaveCount(0);
  await page.getByRole('navigation', { name: '404TradeOS Control Dock' }).getByRole('button', { name: 'Create', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create', exact: true });
  await expect(dialog.getByRole('link', { name: /New (Estimate|Job|Customer|Invoice|Task)/ })).toHaveCount(0);
  await expect(dialog.getByRole('status')).toHaveText('No creation workflows are available for your workspace access.');
  await page.keyboard.press('Escape');
  await page.screenshot({ path: test.info().outputPath('today-field-mobile.png'), fullPage: true });
});

test('theme preference survives a document reload through production theme initialization', async ({ page }) => {
  await openSyntheticToday(page, '?theme=light');
  await page.getByRole('radiogroup', { name: 'Theme', exact: true }).first().getByRole('radio', { name: 'Dark', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem('tradeos-theme'))).toBe('dark');
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByRole('radiogroup', { name: 'Theme', exact: true }).first().getByRole('radio', { name: 'Dark', exact: true })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('radiogroup', { name: 'Theme', exact: true }).first().getByRole('radio', { name: 'System', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('tradeos-theme'))).toBe('system');
});

test('offline state keeps the loaded work usable and disables refresh', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await openSyntheticToday(page, '?failure=attention');
  await page.context().setOffline(true);
  await expect(page.getByRole('status')).toHaveText('Offline. Showing the last loaded records; reconnect before making changes.');
  await expect(page.getByRole('button', { name: 'Refresh Today' })).toBeDisabled();
  await expect(page.locator('.today-work').getByText('Synthetic kitchen framing', { exact: true })).toBeVisible();
  await page.context().setOffline(false);
  await expect(page.getByRole('button', { name: 'Refresh Today' })).toBeEnabled();
  await expect(page.getByText('Offline. Showing the last loaded records;', { exact: false })).toHaveCount(0);
});

for (const role of ['owner', 'office']) {
  test(`${role} saves an operational task once and refreshes only after source confirmation`, async ({ page }) => {
    await page.setViewportSize({ width: role === 'office' ? 390 : 1440, height: 1000 });
    await openSyntheticToday(page, '?view=attention&role=' + role);
    const task = syntheticTodayData.attention[0].task!;
    let writes = 0;
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/proxy/projects/*/tasks/*/status', async route => {
      writes++;
      expect(route.request().method()).toBe('PATCH');
      expect(route.request().postDataJSON()).toEqual({ status: 'completed', expectedUpdatedAt: task.updatedAt });
      await held;
      await route.fulfill({ json: { id: task.taskId, projectId: task.projectId, status: 'completed' } });
    });
    await page.getByRole('button', { name: 'Resolve blocker: Synthetic kitchen task blocked' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Task status', { exact: true }).selectOption('completed');
    await dialog.getByRole('button', { name: 'Save task status' }).click();
    await expect.poll(() => writes).toBe(1);
    await expect(dialog.getByRole('button', { name: 'Saving task…' })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Close workspace' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __testRefreshes?: number }).__testRefreshes || 0)).toBe(0);
    release();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Task saved as completed.' })).toBeVisible();
    expect(writes).toBe(1);
    expect(await page.evaluate(() => (window as unknown as { __testRefreshes?: number }).__testRefreshes)).toBe(1);
  });
}

for (const status of [403, 409, 503]) {
  test(`task save ${status} preserves the unresolved record and allows deliberate recovery`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 1000 });
    await openSyntheticToday(page, '?view=attention&role=office');
    let writes = 0;
    await page.route('**/api/proxy/projects/*/tasks/*/status', route => {
      writes++;
      return route.fulfill({ status, json: { error: 'Synthetic source rejected the update' } });
    });
    await page.getByRole('button', { name: 'Resolve blocker: Synthetic kitchen task blocked' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Task status', { exact: true }).selectOption('completed');
    await dialog.getByRole('button', { name: 'Save task status' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('Synthetic source rejected the update');
    await expect(dialog.getByRole('button', { name: 'Save task status' })).toBeEnabled();
    await expect(page.getByText('Task saved as completed.', { exact: false })).toHaveCount(0);
    expect(writes).toBe(1);
    expect(await page.evaluate(() => (window as unknown as { __testRefreshes?: number }).__testRefreshes || 0)).toBe(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Resolve blocker: Synthetic kitchen task blocked' })).toBeFocused();
  });
}

test('an offline task editor keeps changes local and sends no mutation', async ({ page, context }) => {
  await openSyntheticToday(page, '?view=attention');
  let writes = 0;
  await page.route('**/api/proxy/projects/*/tasks/*/status', route => { writes++; return route.abort(); });
  await page.getByRole('button', { name: 'Resolve blocker: Synthetic kitchen task blocked' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Task status', { exact: true }).selectOption('completed');
  await context.setOffline(true);
  await expect(dialog.getByRole('button', { name: 'Save task status' })).toBeDisabled();
  await expect(dialog.getByText('Reconnect before saving. No changes are queued offline.')).toBeVisible();
  await context.setOffline(false);
  await expect(dialog.getByRole('button', { name: 'Save task status' })).toBeEnabled();
  expect(writes).toBe(0);
});


for (const theme of ['light', 'dark']) {
  test(`field shared tasks open read-only context in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 1000 });
    await openSyntheticToday(page, '?role=field&tasks=shared&theme=' + theme);
    await page.getByRole('group', { name: "Filter today's work" }).getByRole('button', { name: 'Tasks', exact: true }).click();
    await page.locator('.today-work').getByRole('button', { name: /Synthetic shared material check/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Synthetic shared material check' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Save/ })).toHaveCount(0);
    await expect(dialog.getByText('Oct 27', { exact: true })).toBeVisible();
    const sourceLink = dialog.getByRole('link').filter({ hasText: /Open/ });
    await expect(sourceLink).toHaveAttribute('href', '/field?job=test-job');
    await expectNoPageOverflow(page, 390);
    await dialog.screenshot({ path: test.info().outputPath(`today-field-shared-task-${theme}.png`), animations: 'disabled' });
    await sourceLink.click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __testNavigation: string }).__testNavigation)).toBe('/field?job=test-job');
    await expect(dialog).not.toBeVisible();
  });
}
