#!/usr/bin/env node
import {
  ensureConfigExists,
  evaluateOwnership,
  EXIT_CODES,
  formatReport,
  getChangedFiles,
  helpText,
  loadOwnershipConfig,
  parseArgs,
  repoPath,
  resolveBaseRef,
} from "./docs-check-lib.mjs";

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log(helpText());
      process.exit(EXIT_CODES.OK);
    }

    const configPath = repoPath("docs", "DOC_OWNERSHIP.yml");
    ensureConfigExists(configPath);
    const config = loadOwnershipConfig(configPath);
    const baseRef = resolveBaseRef({ argsBase: args.base });
    const changedFiles = getChangedFiles(baseRef);
    const result = evaluateOwnership({ changedFiles, config });
    console.log(formatReport({ baseRef, result }));
    process.exit(result.missingDocs.length === 0 ? EXIT_CODES.OK : EXIT_CODES.MISSING_DOCS);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const exitCode = message.includes("changed files against") ? EXIT_CODES.GIT_ERROR : EXIT_CODES.CONFIG_ERROR;
    console.error(message);
    process.exit(exitCode);
  }
}

main();
