#!/usr/bin/env node
// Driver for running and screenshotting the TradeOS Cost Book API + admin UI.
// Run from app/: node .claude/skills/run-tradeos-costbook-api/driver.mjs <command>
//
// Commands:
//   db        Start/reuse the disposable tradeos-costbook-test Postgres container + apply migrations
//   seed      Seed sample org/user/data (admin role) and write the dev bearer token to .dev-token
//   serve     Write .env (restricted role), build, and start the API in the background; wait for /health
//   shot      Drive /admin/pricing-history with Playwright at a given viewport and screenshot it
//   stop      Kill the background API process
//   all       db -> seed -> serve -> shot (one-shot end-to-end smoke run)

import { execSync, spawn } from "node:child_process";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import path from "node:path";

const APP_DIR = path.resolve(import.meta.dirname, "..", "..", "..");
const CONTAINER = "tradeos-costbook-test";
const PORT = 55432;
const ADMIN_URL = `postgresql://postgres:tradeos_test@127.0.0.1:${PORT}/tradeos_test?schema=public`;
const APP_DB_URL = `postgresql://tradeos_app:tradeos_app_test@127.0.0.1:${PORT}/tradeos_test?schema=public`;
const ORG_ID = "00000000-0000-0000-0000-000000000001";
const TOKEN_FILE = path.join(APP_DIR, ".dev-token");
const PID_FILE = path.join(APP_DIR, ".dev-server.pid");
const SCREENSHOT_DIR = path.join(import.meta.dirname, "screenshots");

function sh(cmd, opts = {}) {
  return execSync(cmd, { cwd: APP_DIR, stdio: "inherit", ...opts });
}

function shOut(cmd, opts = {}) {
  return execSync(cmd, { cwd: APP_DIR, encoding: "utf8", ...opts }).trim();
}

function containerStatus() {
  try {
    return shOut(`docker inspect -f "{{.State.Running}}" ${CONTAINER}`, { stdio: ["pipe", "pipe", "pipe"] });
  } catch {
    return null;
  }
}

async function cmdDb(args = []) {
  const fresh = args.includes("--fresh");
  if (containerStatus() === "true" && !fresh) {
    console.log(`[db] ${CONTAINER} already running, reusing it (pass --fresh to recreate)`);
  } else {
    if (fresh) console.log(`[db] --fresh requested, recreating ${CONTAINER}`);
    console.log(`[db] starting fresh ${CONTAINER} container on 127.0.0.1:${PORT}`);
    sh(
      `docker rm -f ${CONTAINER} >/dev/null 2>&1 || true; ` +
        `docker run --name ${CONTAINER} -e POSTGRES_PASSWORD=tradeos_test -e POSTGRES_DB=tradeos_test ` +
        `-p 127.0.0.1:${PORT}:5432 -d postgres:16-alpine >/dev/null`
    );
    for (let i = 0; i < 30; i++) {
      try {
        shOut(`docker exec ${CONTAINER} pg_isready -U postgres -d tradeos_test`, { stdio: ["pipe", "pipe", "pipe"] });
        break;
      } catch {
        await sleep(1000);
      }
    }
    // Same rollout automation production deploys and test:integration use
    // (scripts/deploy-migrations.sh: tracked Prisma migrations + idempotent
    // app-role provisioning) — one path, not a fourth hand-rolled copy of it.
    // Requires a host `psql` client; see SKILL.md Prerequisites.
    sh(`DATABASE_ADMIN_URL="${ADMIN_URL}" APP_DB_ROLE_PASSWORD="tradeos_app_test" bash scripts/deploy-migrations.sh`);
  }
}

function cmdSeed() {
  // Seeding inserts an organization row, which forced RLS blocks for the
  // restricted tradeos_app role by design (see db/migrations/0002_enable_org_rls.sql).
  // Seed must run as the admin/superuser connection.
  console.log("[seed] generating Prisma client against admin connection");
  sh(`DATABASE_URL="${ADMIN_URL}" npx prisma generate`);
  console.log("[seed] running db:seed");
  const out = shOut(
    `DATABASE_URL="${ADMIN_URL}" AUTH_JWT_SECRET="local-dev-secret-not-for-production-use-only" ` +
      `AUTH_ISSUER="tradeos-costbook" AUTH_AUDIENCE="tradeos-costbook-api" npx ts-node db/seed/seed.ts`
  );
  console.log(out);
  const match = out.match(/Dev bearer token: (\S+)/);
  if (!match) throw new Error("seed output did not contain a dev bearer token");
  writeFileSync(TOKEN_FILE, match[1]);
  console.log(`[seed] wrote dev token to ${TOKEN_FILE}`);
}

function writeEnv() {
  const envPath = path.join(APP_DIR, ".env");
  writeFileSync(
    envPath,
    [
      `DATABASE_URL="${APP_DB_URL}"`,
      `PORT=4000`,
      `AUTH_JWT_SECRET="local-dev-secret-not-for-production-use-only"`,
      `AUTH_ISSUER="tradeos-costbook"`,
      `AUTH_AUDIENCE="tradeos-costbook-api"`,
      `RLS_TRANSACTION_TIMEOUT_MS=60000`,
      `PLATFORM_PROVISIONING_SECRET="local-dev-provisioning-secret-32chars-min"`,
      "",
    ].join("\n")
  );
  console.log(`[serve] wrote ${envPath} (restricted tradeos_app role)`);
}

async function cmdServe() {
  try {
    const existingPid = shOut("lsof -ti :4000 -sTCP:LISTEN", { stdio: ["pipe", "pipe", "pipe"] });
    if (existingPid) {
      throw new Error(
        `port 4000 is already bound by pid ${existingPid} (a stray previous run?). ` +
          `Run \`driver.mjs stop\` or \`kill ${existingPid}\` first.`
      );
    }
  } catch (e) {
    if (e.message?.includes("already bound")) throw e;
    // lsof found nothing -> exits non-zero -> fall through, port is free
  }

  writeEnv();
  console.log("[serve] npm run build");
  sh("npm run build");
  console.log("[serve] starting API in the background");
  const child = spawn("node", ["dist/backend/start.js"], {
    cwd: APP_DIR,
    detached: true,
    stdio: ["ignore", "ignore", "ignore"],
  });
  child.unref();
  writeFileSync(PID_FILE, String(child.pid));
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch("http://localhost:4000/health");
      if (res.ok) {
        console.log("[serve] /health OK, pid", child.pid);
        return;
      }
    } catch {
      // not up yet
    }
    await sleep(500);
  }
  throw new Error("API did not become healthy within 15s");
}

function cmdStop() {
  if (!existsSync(PID_FILE)) {
    console.log("[stop] no pid file, nothing to do");
    return;
  }
  const pid = readFileSync(PID_FILE, "utf8").trim();
  try {
    process.kill(Number(pid));
    console.log(`[stop] killed pid ${pid}`);
  } catch (e) {
    console.log(`[stop] pid ${pid} already gone (${e.message})`);
  }
}

async function cmdShot(args) {
  const route = args[0] || "/admin/pricing-history";
  const width = Number(args[1] || 390);
  const height = Number(args[2] || 844);
  if (!existsSync(TOKEN_FILE)) throw new Error("no .dev-token — run `seed` first");
  const token = readFileSync(TOKEN_FILE, "utf8").trim();

  const { chromium } = await import("playwright");
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const outFile = path.join(SCREENSHOT_DIR, `${route.replace(/\//g, "_")}_${width}x${height}.png`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height } });
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto(`http://localhost:4000${route}`);
  if (route.includes("pricing-history") || route.includes("member-history")) {
    await page.fill('textarea[name="bearerToken"], input[name="bearerToken"]', token);
    await page.fill('input[name="orgId"]', ORG_ID);
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle");
  }

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  await page.screenshot({ path: outFile, fullPage: true });
  await browser.close();

  console.log(`[shot] saved ${outFile}`);
  console.log(`[shot] scrollWidth=${scrollWidth} clientWidth=${clientWidth} ${scrollWidth > clientWidth ? "OVERFLOW" : "OK"}`);
  if (consoleErrors.length) console.log("[shot] console errors:", consoleErrors);
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  switch (cmd) {
    case "db":
      await cmdDb(args);
      break;
    case "seed":
      cmdSeed();
      break;
    case "serve":
      await cmdServe();
      break;
    case "stop":
      cmdStop();
      break;
    case "shot":
      await cmdShot(args);
      break;
    case "all":
      // Always recreates the container: seed.ts is only idempotent for
      // org/user/membership, not for the rest of the sample data, so
      // reseeding an already-seeded container throws a unique-constraint error.
      await cmdDb(["--fresh"]);
      cmdSeed();
      await cmdServe();
      await cmdShot(args);
      break;
    default:
      console.error("usage: driver.mjs <db [--fresh]|seed|serve|stop|shot [route] [width] [height]|all [route] [width] [height]>");
      process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
