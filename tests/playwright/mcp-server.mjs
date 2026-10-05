import { spawn } from "node:child_process";
import { resolveAgentTarget } from "./target.mjs";

const target = resolveAgentTarget(process.env);
const executable = process.platform === "win32" ? "npx.cmd" : "npx";
const args = [
  "--no-install",
  "playwright",
  "run-test-mcp-server",
  "--config",
  "playwright.config.ts",
];

const child = spawn(executable, args, {
  cwd: process.cwd(),
  stdio: "inherit",
  env: {
    ...process.env,
    TRADEOS_AGENT_BASE_URL: target,
    PLAYWRIGHT_MCP_ALLOWED_ORIGINS: target,
  },
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
