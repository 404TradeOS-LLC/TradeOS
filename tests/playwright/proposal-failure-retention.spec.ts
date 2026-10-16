import { expect, test } from '@playwright/test';

// Manual non-production validation regression. An incomplete payment row is
// rejected by createProposalAction before any backend proposal creation call.
const path = process.env.TRADEOS_PROPOSAL_RETENTION_PATH;
const state = process.env.TRADEOS_PROPOSAL_RETENTION_STATE;

test.describe('Proposal creation failure recovery', () => {
  test.skip(!path, 'Set a sanitized proposal-new route to run this matrix.');
  if (path && (!path.startsWith('/') || path.startsWith('//'))) {
    throw new Error('TRADEOS_PROPOSAL_RETENTION_PATH must be a relative application path');
  }
  if (state) test.use({ storageState: state, trace: 'off', video: 'off' });

  for (const width of [390, 768, 1024, 1440]) {
    test(`retains edits after repeated server validation at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(path!);
      const edits = [
        ['Company name', 'Recovery test contractor'],
        ['Estimated timeline', 'Recovery test timeline'],
        ['Scope of work override', 'Recovery test scope'],
        ['Assumptions override', 'Recovery test assumption'],
        ['Exclusions override', 'Recovery test exclusion'],
        ['Terms & conditions', 'Recovery test terms'],
      ];
      for (const [label, value] of edits) await page.getByLabel(label, { exact: true }).fill(value);
      await page.getByLabel('Show line-item detail on the proposal').check();
      await page.getByLabel('Milestone 1', { exact: true }).fill('Recovery test deposit');
      // Force server validation even if the saved draft supplied a default percent.
      await page.locator('#paymentPercent0').fill('');
      await page.locator('#paymentNotes0').fill('Recovery test payment note');
      const estimateId = await page.getByLabel('Estimate', { exact: true }).inputValue();

      for (let attempt = 0; attempt < 2; attempt++) {
        await page.getByRole('button', { name: 'Create proposal', exact: true }).click();
        const error = page.getByRole('alert').filter({ hasText: 'Each payment row needs a label and percent.' });
        await expect(error).toBeFocused();
        for (const [label, value] of edits) await expect(page.getByLabel(label, { exact: true })).toHaveValue(value);
        await expect(page.getByLabel('Show line-item detail on the proposal')).toBeChecked();
        await expect(page.getByLabel('Milestone 1', { exact: true })).toHaveValue('Recovery test deposit');
        await expect(page.locator('#paymentPercent0')).toHaveValue('');
        await expect(page.locator('#paymentNotes0')).toHaveValue('Recovery test payment note');
        await expect(page.getByLabel('Estimate', { exact: true })).toHaveValue(estimateId);
        await page.keyboard.press('Tab');
        await expect(page.getByRole('button', { name: 'Create proposal', exact: true })).toBeFocused();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  }
});
