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
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await open(page);
  const intro = page.getByRole("dialog", { name: "TradeOS introduction" });
  await expect(intro).toHaveCSS("animation-duration", "4s");
  await expect(page.getByRole("button", { name: "Skip intro" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Skip intro" })).toBeFocused();
  await expect(intro).toBeHidden({ timeout: 6000 });
  await expect(page.getByLabel("Email address")).toBeEnabled();
  await page.reload();
  await expect(intro).toHaveCSS("animation-duration", "2.5s");
  await page.keyboard.press("Escape");
  await expect(intro).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeFocused();
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
