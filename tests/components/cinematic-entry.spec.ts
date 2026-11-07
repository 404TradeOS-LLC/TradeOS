import { test, expect, type Page } from "@playwright/test";
import {
  readFileSync,
  writeFileSync,
  mkdtempSync,
  rmSync,
  existsSync,
} from "node:fs";
import { createRequire } from "node:module";
import { resolve, join, basename } from "node:path";
import { tmpdir } from "node:os";
const webRequire = createRequire(resolve("web/package.json"));
let directory: string, css: string;
test.beforeAll(async () => {
  test.setTimeout(180_000);
  directory = mkdtempSync(join(tmpdir(), "tradeos-entry-"));
  writeFileSync(
    join(directory, "entry.tsx"),
    `import React from 'react';import {createRoot} from 'react-dom/client';import {LoginEntry} from '@/components/entry/login-entry';createRoot(document.getElementById('root')).render(<LoginEntry/>);`,
  );
  // Only Next navigation/image adapters and the server transport are synthetic.
  // Production React, entry components, controls, CSS and renderer are bundled.
  writeFileSync(
    join(directory, "next-link.tsx"),
    `import React from 'react';export default function Link(props){return <a {...props}/>}`,
  );
  writeFileSync(
    join(directory, "next-image.tsx"),
    `import React from 'react';export default function Image({priority,...props}){return <img {...props}/>}`,
  );
  writeFileSync(
    join(directory, "auth.ts"),
    `export async function loginAction(_previous,form){window.loginCalls=(window.loginCalls||0)+1;return new Promise(resolve=>{window.failLogin=()=>resolve({error:'Email or password is incorrect.'})})}`,
  );
  writeFileSync(
    join(directory, "loader.cjs"),
    `const ts=require(${JSON.stringify(webRequire.resolve("typescript"))});module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText};`,
  );
  writeFileSync(
    join(directory, "css-loader.cjs"),
    `module.exports=function(){return 'export default {root:"root"}'};`,
  );
  const webpack = webRequire("next/dist/compiled/webpack/webpack").webpack;
  await new Promise<void>((done, fail) =>
    webpack(
      {
        mode: "development",
        devtool: false,
        entry: join(directory, "entry.tsx"),
        output: {
          path: directory,
          filename: "bundle.js",
          chunkFilename: "[name].js",
          publicPath: "/",
        },
        resolve: {
          extensions: [".tsx", ".ts", ".js"],
          alias: {
            "@/app/actions/auth": join(directory, "auth.ts"),
            "next/link": join(directory, "next-link.tsx"),
            "next/image": join(directory, "next-image.tsx"),
            "@": resolve("web/src"),
          },
          modules: [resolve("web/node_modules"), "node_modules"],
        },
        module: {
          rules: [
            { test: /\.tsx?$/, use: join(directory, "loader.cjs") },
            { test: /\.css$/, use: join(directory, "css-loader.cjs") },
          ],
        },
      },
      (
        error: Error | null,
        stats: { hasErrors(): boolean; toString(): string },
      ) =>
        error
          ? fail(error)
          : stats.hasErrors()
            ? fail(Error(stats.toString()))
            : done(),
    ),
  );
  const globalCss = await webRequire("postcss")([
    webRequire("@tailwindcss/postcss")({ base: resolve("web") }),
  ]).process(readFileSync("web/src/app/globals.css", "utf8"), {
    from: resolve("web/src/app/globals.css"),
  });
  // CSS modules' only export is root; unwrap :global for this standalone harness.
  css =
    globalCss.css +
    "\n" +
    readFileSync("web/src/components/entry/entry.module.css", "utf8").replace(
      /:global\(([^)]+)\)/g,
      "$1",
    );
});
test.afterAll(() => {
  if (directory) rmSync(directory, { recursive: true, force: true });
});
async function open(page: Page) {
  await page.route("http://entry.test/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/") {
      await route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html lang="en"><meta charset="utf-8"><title>TradeOS isolated entry test</title><style>${css}</style><body><div id="root"></div><script src="/bundle.js"></script></body></html>`,
      });
      return;
    }
    const file = pathname.startsWith("/entry/")
      ? resolve("web/public" + pathname)
      : join(directory, basename(pathname));
    if (!existsSync(file)) {
      await route.fulfill({ status: 404, body: "Not found" });
      return;
    }
    await route.fulfill({
      contentType: file.endsWith(".js")
        ? "text/javascript"
        : file.endsWith(".svg")
          ? "image/svg+xml"
          : "font/woff2",
      body: readFileSync(file),
    });
  });
  await page.goto("http://entry.test/");
}
for (const width of [390, 768, 1024, 1440]) {
  test(`entry validation, recovery and pending failure at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page);
    await expect(
      page.getByRole("dialog", { name: "TradeOS introduction" }),
    ).toHaveCount(0);
    const email = page.getByLabel("Email address", { exact: true }),
      password = page.getByLabel("Password", { exact: true }),
      submit = page.getByRole("button", { name: "Sign in", exact: true });
    for (const field of [email, password, submit])
      expect((await field.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await submit.click();
    await expect(email).toBeFocused();
    await expect(email).toHaveAttribute("aria-invalid", "true");
    expect(
      await page.evaluate(
        () => (window as unknown as { loginCalls?: number }).loginCalls || 0,
      ),
    ).toBe(0);
    await email.fill("synthetic@example.test");
    await password.fill("synthetic-test-password");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(password).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(password).toHaveAttribute("type", "password");
    await submit.click();
    await expect(
      page.getByRole("button", { name: "Signing in…" }),
    ).toBeDisabled();
    expect(
      await page.evaluate(
        () => (window as unknown as { loginCalls: number }).loginCalls,
      ),
    ).toBe(1);
    await page.evaluate(() =>
      (window as unknown as { failLogin(): void }).failLogin(),
    );
    await expect(page.getByRole("alert")).toHaveText(
      "Email or password is incorrect.",
    );
    await expect(email).toHaveValue("synthetic@example.test");
    await expect(password).toHaveValue("synthetic-test-password");
    await expect(submit).toBeEnabled();
    await expect(
      page.getByRole("link", { name: "Forgot password?" }),
    ).toHaveAttribute("href", "/forgot-password");
    await expect(
      page.getByRole("link", { name: "Create one" }),
    ).toHaveAttribute("href", "/signup");
    await page.screenshot({
      path: test.info().outputPath(`entry-failure-${width}.png`),
      fullPage: true,
    });
  });
}
test("first and returning intro complete on schedule and support keyboard skip", async ({
  page,
}) => {
  // Deterministic timing: install Playwright's virtual clock before the
  // page loads, so both intro exit timers run on fake time. Advancing the
  // clock replaces the wall-clock race this test used to have (a real 4s
  // timer against a 6s assertion window) and the init script that stretched
  // the returning timer to 60s so Escape could be exercised. No assertion
  // is weakened: the 4s/2.5s durations are still read from the rendered
  // styles, and Tab, Escape, and Skip semantics are still exercised.
  await page.clock.install();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await open(page);
  const intro = page.getByRole("dialog", { name: "TradeOS introduction" });
  await expect(intro).toHaveCSS("animation-duration", "4s");
  await expect(page.getByRole("button", { name: "Skip intro" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Skip intro" })).toBeFocused();
  await page.clock.runFor(4000);
  await expect(intro).toBeHidden();
  await expect(page.getByLabel("Email address")).toBeEnabled();
  await page.reload();
  // The virtual clock stays installed across the reload (verified: a
  // reloaded page's timer still answers to runFor), so the returning intro
  // cannot dismiss itself before Escape is exercised. Never add a
  // waitForTimeout here: it advances the fake clock and would fire the
  // returning timer.
  await expect(intro).toHaveCSS("animation-duration", "2.5s");
  await expect(page.getByRole("button", { name: "Skip intro" })).toBeFocused();
  await expect(intro).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(intro).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeFocused();
});
test("intro dismisses on the wall-clock schedule in a real browser", async ({
  page,
}) => {
  // Real-browser regression for the login intro overstay: no virtual clock
  // is installed, so the exit timer runs on wall-clock time and any
  // main-thread block that delays it shows up as a failure instead of being
  // masked by fake time.
  //
  // The film's lifetime is measured in-page with a MutationObserver, not
  // with Playwright's visibility polling: the very main-thread blocks this
  // test guards against delay Playwright's observation of the dialog by
  // seconds (on one run the dialog was reported visible only 202ms before
  // it detached, although its timer had run for the full 2.5s), so polled
  // timings are meaningless here. The observer records performance.now()
  // as a microtask right after the mutating commit, which is accurate to
  // milliseconds. Bounds are the intended durations plus 1.5s of
  // scheduling slack, measured from the moment the film mounts (the exit
  // timer's own start): 4s + 1.5s first visit, 2.5s + 1.5s returning.
  // Measuring from navigation instead would conflate bundle/mount overhead
  // (~2s on software renderers, highly variable) with the timer and make
  // the test flaky. The empty-submit click after each dismissal proves the
  // film no longer intercepts pointer events on the sign-in form.
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
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const readTiming = () =>
    page.evaluate(() => {
      const w = window as unknown as {
        __introTiming: { added?: number; removed?: number };
      };
      return w.__introTiming;
    });
  // Wait for the in-page observer to record both the mount and the
  // dismissal. This deliberately does not gate on Playwright's visibility
  // polling: the observer runs as a microtask in the page, so it records
  // the true mount/dismissal moments even while the main thread is busy.
  const waitTiming = async (label: string) => {
    const deadline = Date.now() + 15000;
    for (;;) {
      const t = await readTiming();
      if (t.added !== undefined && t.removed !== undefined) return t;
      if (Date.now() > deadline)
        throw new Error(
          `${label}: intro timing incomplete after 15s (added=${t.added}, removed=${t.removed})`,
        );
      await page.waitForTimeout(100);
    }
  };
  const dismissAndProveReachable = async () => {
    const email = page.getByLabel("Email address", { exact: true });
    await expect(email).toBeEnabled();
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(email).toBeFocused();
    await expect(email).toHaveAttribute("aria-invalid", "true");
  };
  await open(page);
  const first = await waitTiming("first-visit intro");
  const firstMs = first.removed! - first.added!;
  console.log(`first-visit intro visible for ${Math.round(firstMs)}ms`);
  expect(firstMs).toBeLessThanOrEqual(5500);
  await dismissAndProveReachable();
  await page.reload();
  const returning = await waitTiming("returning intro");
  const returningMs = returning.removed! - returning.added!;
  console.log(
    `returning intro visible for ${Math.round(returningMs)}ms`,
  );
  expect(returningMs).toBeLessThanOrEqual(4000);
  await dismissAndProveReachable();
});
test("GPU failure and blocked storage retain a skippable vector fallback", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw Error("Storage unavailable");
      },
    });
    const native = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: Parameters<typeof native>
    ) {
      if (String(args[0]).startsWith("webgl")) return null;
      return Reflect.apply(native, this, args);
    } as typeof native;
  });
  await open(page);
  const intro = page.getByRole("dialog", { name: "TradeOS introduction" });
  await expect(intro).toBeVisible();
  await expect(intro.locator(".film-fallback")).toBeVisible();
  await page.getByRole("button", { name: "Skip intro" }).click();
  await expect(intro).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeFocused();
});
