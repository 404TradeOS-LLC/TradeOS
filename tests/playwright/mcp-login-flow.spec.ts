import { expect, test, type Page } from '@playwright/test';

// Real-browser regression coverage for the TradeOS sign-in workflow,
// including the signature intro film ("TradeOS introduction" dialog).
// Unauthenticated: exercises the login form and client-side validation only.
// No credentials are used; no login attempt reaches the backend.
// Run against staging with TRADEOS_AGENT_BASE_URL set to the staging alias
// (https://tradeos-costbook-web-git-staging-billykshowalters.vercel.app).
//
// Film timing is ENTRY_TIMING in web/src/components/entry/entry-state.ts:
// 4000ms first visit, 2500ms returning. The film auto-dismisses on that
// schedule; the Skip button is focused on mount; Escape dismisses; Tab is
// trapped to Skip; prefers-reduced-motion skips the film entirely. The form
// inside .entry-content is inert while the film plays (up to 4s) — that is
// the approved design, and these tests pin it: early interaction must be
// blocked, and the form must be usable immediately after dismissal with no
// lost submit. A ~23s overstay was the pre-fix defect (software-renderer
// PMREM block, fixed by the guard in web/src/components/entry/cinema.ts);
// the bounds below fail loudly on any recurrence instead of hiding it
// behind a long wait.

// Collects console errors and uncaught page errors from page load onward.
// Call before goto; assert on the returned array at the end of the test.
// One narrow exception: the Vercel Speed Insights script
// (/_vercel/speed-insights/script.js) is injected for Vercel deployments
// and 404s on any non-Vercel origin, including a local production build.
// That 404 is deployment-infrastructure noise, not an application error,
// so it is filtered out; every other console error still fails the test.
function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    // Chrome reports a failed resource load as "Failed to load resource:
    // ... 404 (Not Found)" without the URL in the message text; the URL
    // is in the message location instead.
    if (
      msg.text().includes('Failed to load resource') &&
      msg.location()?.url?.includes('/_vercel/speed-insights/script.js')
    )
      return;
    errors.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    errors.push(`pageerror: ${err.message}`);
  });
  return errors;
}

const introDialog = (page: Page) =>
  page.getByRole('dialog', { name: 'TradeOS introduction' });
const skipButton = (page: Page) =>
  page.getByRole('button', { name: 'Skip intro' });
const signInHeading = (page: Page) =>
  page.getByRole('heading', { name: 'Welcome back.' });

// Measures the film's mount-to-dismiss lifetime in-page with a
// MutationObserver, as in tests/components/cinematic-entry.spec.ts: polled
// visibility timings are meaningless when the main thread is blocked, while
// the observer records the true mount/dismissal moments as a microtask.
// Bounds are the intended durations plus slack for timer scheduling
// delay on shared/loaded runners, measured from the moment the film
// mounts (the exit timer's own start): 4s + 2s first visit, 2.5s + 2.5s
// returning. A returning leg has measured 4.3s on a loaded runner with no
// product defect involved (reload re-parses while the timer runs); the
// ~23s overstay this guards against still fails by a wide margin.
async function installIntroTimingProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as {
      __introTiming: { added?: number; removed?: number };
    };
    w.__introTiming = {};
    const record = () => {
      const present = !!document.querySelector(
        '[aria-label="TradeOS introduction"]',
      );
      const now = performance.now();
      if (present && w.__introTiming.added === undefined)
        w.__introTiming.added = now;
      if (
        !present &&
        w.__introTiming.added !== undefined &&
        w.__introTiming.removed === undefined
      )
        w.__introTiming.removed = now;
    };
    new MutationObserver(record).observe(document, {
      childList: true,
      subtree: true,
    });
  });
}

async function readIntroTiming(page: Page): Promise<{
  added?: number;
  removed?: number;
}> {
  return page.evaluate(() => {
    const w = window as unknown as {
      __introTiming: { added?: number; removed?: number };
    };
    return w.__introTiming;
  });
}

async function waitIntroTiming(
  page: Page,
  label: string,
): Promise<{ added: number; removed: number }> {
  const deadline = Date.now() + 15000;
  for (;;) {
    const t = await readIntroTiming(page);
    if (t.added !== undefined && t.removed !== undefined)
      return { added: t.added, removed: t.removed };
    if (Date.now() > deadline)
      throw new Error(
        `${label}: intro timing incomplete after 15s (added=${t.added}, removed=${t.removed})`,
      );
    await page.waitForTimeout(100);
  }
}

test.describe('TradeOS sign-in workflow', () => {
  test('login form renders, validates empty submit, no overflow at 390 and 1440', async ({
    page,
  }) => {
    // Harness budget only: the operative regression bound is the 10s film
    // wait below. 60s lets that assertion report cleanly on slow targets
    // instead of the default 30s test timeout firing mid-assertion.
    test.setTimeout(60000);
    const errors = collectConsoleErrors(page);
    // Force motion on so the intro mounts deterministically: LoginEntry
    // only opens it when prefers-reduced-motion is NOT reduce.
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    // Install the in-page mount/dismiss probe BEFORE goto: the film can
    // mount and dismiss before Playwright's first visibility poll when
    // the page's load event is held open by a slow subresource (the
    // returning film lasts only 2.5s), so toBeVisible alone can miss a
    // healthy film entirely. The observer records the true mount moment
    // even then; waiting on it proves the intro actually appeared.
    await installIntroTimingProbe(page);
    await page.goto('/login');
    const intro = introDialog(page);
    await waitIntroTiming(page, 'intro');
    await expect(intro).toBeHidden({ timeout: 10000 });
    await expect(page).toHaveTitle(/Sign in \| TradeOS/);
    await expect(signInHeading(page)).toBeVisible();
    await expect(page.getByPlaceholder('you@company.com')).toBeVisible();
    await expect(page.getByPlaceholder('Enter your password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();

    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Enter a valid email address.')).toBeVisible();
    await expect(page.getByText('Enter your password.')).toBeVisible();

    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow).toBe(false);
    }
    expect(errors).toEqual([]);
  });

  test('intro dismisses on the real-time schedule, first and returning visit', async ({
    page,
  }) => {
    // No virtual clock is installed: the exit timer runs on wall-clock
    // time, so any main-thread block that delays it (the ~23s overstay
    // failure mode) shows up as a failure instead of being masked by
    // fake time. Covers the staging surface the component-level
    // wall-clock test cannot: the real deployment, real browser, and
    // real network path.
    test.setTimeout(90000);
    const errors = collectConsoleErrors(page);
    // Force a first visit for the first leg so it genuinely measures the
    // 4s first-visit film: a persistent profile (like the MCP Firefox
    // profile) already carries the visited flag, which would silently
    // turn the first leg into a second returning visit and leave the
    // true first-visit timing unexercised on this target. The reload
    // afterwards is a genuine returning visit.
    //
    // Clear the flag exactly once: addInitScript re-runs on every
    // navigation, including the reload below, so an unconditional clear
    // would delete the flag LoginEntry remembers on the first leg and
    // turn the returning leg into a second first visit (its 5s bound
    // would then accept the 4s first-visit film). The sessionStorage
    // marker survives the reload in the same tab but is fresh for every
    // test's new context, so the guard fires only before the first leg.
    await page.addInitScript(() => {
      if (
        !window.sessionStorage.getItem('tradeos.test.visit-cleared.v1')
      ) {
        window.localStorage.removeItem('tradeos.entry.visited.v2');
        window.sessionStorage.setItem('tradeos.test.visit-cleared.v1', '1');
      }
    });
    await installIntroTimingProbe(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/login');
    const first = await waitIntroTiming(page, 'first-visit intro');
    const firstMs = first.removed - first.added;
    console.log(`first-visit intro visible for ${Math.round(firstMs)}ms`);
    expect(firstMs).toBeLessThanOrEqual(6000);
    // Dismissal must unblock the form: an empty submit right after the
    // film goes away has to register, not be swallowed.
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Enter a valid email address.')).toBeVisible();

    await page.reload();
    const returning = await waitIntroTiming(page, 'returning intro');
    const returningMs = returning.removed - returning.added;
    console.log(
      `returning intro visible for ${Math.round(returningMs)}ms`,
    );
    expect(returningMs).toBeLessThanOrEqual(5000);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Enter a valid email address.')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('form is inert while the film plays, usable immediately after dismissal', async ({
    page,
  }) => {
    test.setTimeout(60000);
    const errors = collectConsoleErrors(page);
    // Force a first visit so the film runs its full 4s window: on a
    // returning visit it lasts only 2.5s, and the probe below (inert
    // check + click) can straddle the dismissal on a slow target — the
    // click would then land after dismissal, focus the live field, and
    // fail as a false inert violation. Clearing the visit flag before
    // load makes LoginEntry treat this as a first visit.
    await page.addInitScript(() => {
      window.localStorage.removeItem('tradeos.entry.visited.v2');
    });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    // Navigate on commit, not load: a slow subresource can hold the
    // page's load event open past the film's 4s lifetime, so the default
    // wait would return only after the dialog already dismissed and the
    // visibility assertion below would fail on a healthy app. The dialog
    // wait that follows is the synchronization point instead.
    await page.goto('/login', { waitUntil: 'commit' });
    const intro = introDialog(page);
    // Capture the field's box from the server-rendered HTML before
    // waiting for the dialog, so the click below follows the visibility
    // check with no extra roundtrips inside the film window.
    const email = page.getByPlaceholder('you@company.com');
    const box = await email.boundingBox();
    expect(box).not.toBeNull();
    await expect(intro).toBeVisible({ timeout: 10000 });

    // While the film is up, the form subtree is inert by design
    // (LoginEntry renders .entry-content inert while opening).
    const inertWhilePlaying = await page.evaluate(
      () =>
        (document.querySelector('.entry-content') as HTMLElement | null)
          ?.inert === true,
    );
    expect(inertWhilePlaying).toBe(true);

    // A real pointer click aimed at the email field must not reach it:
    // the film overlay intercepts the event, so the field stays empty
    // and unfocused (focus leaves Skip for the clicked overlay, but
    // must never land on the inert field). Re-check the film is still
    // up right before clicking: if it already dismissed, a click that
    // focuses the live field would be correct behavior, not an inert
    // failure, and this assertion must fail loudly instead of blaming
    // the film.
    await expect(intro).toBeVisible({ timeout: 1000 });
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await expect(email).not.toBeFocused();
    await expect(email).toHaveValue('');
    const activeTag = await page.evaluate(
      () => document.activeElement?.tagName ?? null,
    );
    expect(activeTag).not.toBe('INPUT');

    // After the scheduled dismissal the form is live at once: fill and
    // submit, and the validation result proves the submit was not lost.
    await expect(intro).toBeHidden({ timeout: 10000 });
    const inertAfterDismissal = await page.evaluate(
      () =>
        (document.querySelector('.entry-content') as HTMLElement | null)
          ?.inert === true,
    );
    expect(inertAfterDismissal).toBe(false);
    await email.fill('not-an-email');
    await page.getByPlaceholder('Enter your password').fill('x');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Enter a valid email address.')).toBeVisible();
    await expect(email).toBeFocused();
    expect(errors).toEqual([]);
  });

  test('keyboard access: Tab stays on Skip, Escape dismisses and focuses the heading', async ({
    page,
  }) => {
    test.setTimeout(60000);
    const errors = collectConsoleErrors(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    // Navigate on commit, not load: same slow-subresource hazard as the
    // inert-form test — the default wait can return after the film
    // already dismissed. Synchronize on the mounted dialog instead.
    await page.goto('/login', { waitUntil: 'commit' });
    const intro = introDialog(page);
    await expect(intro).toBeVisible({ timeout: 10000 });

    // Skip is focused on mount, and the dialog traps Tab to it.
    await expect(skipButton(page)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(skipButton(page)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(skipButton(page)).toBeFocused();

    // Escape dismisses at once (no waiting out the 4s timer) and focus
    // returns to the sign-in heading.
    await page.keyboard.press('Escape');
    await expect(intro).toBeHidden({ timeout: 2000 });
    await expect(signInHeading(page)).toBeFocused();

    // The form is usable immediately after the keyboard dismissal.
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Enter a valid email address.')).toBeVisible();
    await expect(page.getByText('Enter your password.')).toBeVisible();
    expect(errors).toEqual([]);
  });
});
