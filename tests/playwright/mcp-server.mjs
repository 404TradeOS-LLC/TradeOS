import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const executable = process.platform === "win32" ? "npx.cmd" : "npx";
const args = [
  "--no-install",
  "playwright",
  "run-test-mcp-server",
  "--config",
  "playwright.mcp.config.ts",
];

// The sandbox egress CA rotates within minutes, so the MCP Firefox profile
// goes stale unless it is re-synced at launch. Sync before spawning: a
// failed sync fails the launch with a clear message instead of letting
// every HTTPS navigation die with SEC_ERROR_UNKNOWN. The helper is a no-op
// (exit 0) outside a Hatch sandbox or without a configured profile, so
// other machines are unaffected. Output goes to stderr only: stdout is the
// MCP transport and must stay clean JSON-RPC.
const syncResult = spawnSync(
  process.execPath,
  [fileURLToPath(new URL("./sync-egress-ca.mjs", import.meta.url))],
  { encoding: "utf8", env: process.env },
);
if (syncResult.stdout?.trim()) console.error(syncResult.stdout.trim());
if (syncResult.status !== 0) {
  const detail = (syncResult.stderr ?? "").trim() || syncResult.error?.message || "";
  if (detail) console.error(detail);
  console.error(
    "Failed to start the Playwright test MCP server: the egress CA could not be synced, so secure network access is unavailable.",
  );
  process.exit(1);
}

// Drop inherited MCP origin filters: agents may browse any site for observation.
// Release CI retains its own separately validated target configuration.
const {
  PLAYWRIGHT_MCP_ALLOWED_ORIGINS: _allowed,
  PLAYWRIGHT_MCP_BLOCKED_ORIGINS: _blocked,
  ...browserEnv
} = process.env;

const child = spawn(executable, args, {
  cwd: process.cwd(),
  stdio: "inherit",
  env: browserEnv,
});

child.once("error", (error) => {
  console.error(`Failed to start the Playwright test MCP server: ${error.message}`);
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  if (signal) {
    console.error(`Playwright test MCP server exited from signal ${signal}`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
