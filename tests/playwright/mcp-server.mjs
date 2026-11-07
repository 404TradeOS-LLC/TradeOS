import { spawn } from "node:child_process";

const executable = process.platform === "win32" ? "npx.cmd" : "npx";
const args = [
  "--no-install",
  "playwright",
  "run-test-mcp-server",
  "--config",
  "playwright.mcp.config.ts",
];

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
