import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateOwnership,
  formatReport,
  getChangedFiles,
  loadOwnershipConfig,
  parseArgs,
  pathMatches,
  resolveBaseRef,
} from "../docs-check-lib.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "./sprint-backlog.test.mjs";

function writeTempConfig(contents) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "tradeos-docs-check-"));
  const filePath = path.join(directory, "DOC_OWNERSHIP.yml");
  fs.writeFileSync(filePath, contents);
  return filePath;
}

function loadTempConfig(contents) {
  return loadOwnershipConfig(writeTempConfig(contents));
}

const config = {
  rules: [
    { paths: ["app/prisma/schema.prisma"], requires: ["docs/DOMAIN_MODEL.md"], explanation: "schema" },
    { paths: ["app/modules/jobs/**"], requires: ["docs/modules/jobs-and-scheduling.md"], explanation: "jobs" },
    {
      paths: ["app/modules/crm/**"],
      requires: ["docs/modules/crm.md", "docs/API_REFERENCE.md", "docs/DOMAIN_MODEL.md", "docs/CURRENT_STATE.md"],
      explanation: "crm",
    },
    { paths: ["app/domain/contracts.ts"], requires: ["docs/RBAC_MATRIX.md", "docs/WORKFLOW_LIFECYCLES.md"], explanation: "contracts" },
    {
      paths: ["docs/ROADMAP.md"],
      requires: ["docs/ENGINEERING_COMMAND_CENTER.md"],
      explanation: "roadmap",
    },
    {
      paths: ["AGENTS.md", "docs/agent-prompts/**"],
      requires: ["docs/REPOSITORY_GOVERNANCE.md", "docs/ENGINEERING_COMMAND_CENTER.md"],
      explanation: "governance",
    },
    {
      paths: ["docs/README.md", "docs/DOC_OWNERSHIP.yml"],
      requires: ["docs/REPOSITORY_GOVERNANCE.md", "docs/ENGINEERING_COMMAND_CENTER.md"],
      explanation: "hierarchy",
    },
  ],
  exemptions: [{ paths: ["app/tests/**"], reason: "tests only" }],
};

test("exact-path matching works", () => {
  const result = evaluateOwnership({
    changedFiles: ["app/prisma/schema.prisma", "docs/DOMAIN_MODEL.md"],
    config,
  });
  assert.deepEqual(result.requiredDocs, ["docs/DOMAIN_MODEL.md"]);
  assert.deepEqual(result.missingDocs, []);
});

test("glob matching works", () => {
  const result = evaluateOwnership({
    changedFiles: ["app/modules/jobs/service.ts"],
    config,
  });
  assert.deepEqual(result.requiredDocs, ["docs/modules/jobs-and-scheduling.md"]);
  assert.deepEqual(result.missingDocs, ["docs/modules/jobs-and-scheduling.md"]);
});

test("phase-3 scenario: backend change without required docs fails", () => {
  const tempConfig = loadTempConfig(`
rules:
  - paths:
      - app/modules/jobs/**
    requires:
      - docs/modules/jobs-and-scheduling.md
exemptions: []
`);
  const result = evaluateOwnership({
    changedFiles: ["app/modules/jobs/service.ts"],
    config: tempConfig,
  });
  assert.deepEqual(result.requiredDocs, ["docs/modules/jobs-and-scheduling.md"]);
  assert.deepEqual(result.missingDocs, ["docs/modules/jobs-and-scheduling.md"]);
});

test("phase-3 scenario: backend change with required docs passes", () => {
  const tempConfig = loadTempConfig(`
rules:
  - paths:
      - app/modules/jobs/**
    requires:
      - docs/modules/jobs-and-scheduling.md
exemptions: []
`);
  const result = evaluateOwnership({
    changedFiles: ["app/modules/jobs/service.ts", "docs/modules/jobs-and-scheduling.md"],
    config: tempConfig,
  });
  assert.deepEqual(result.requiredDocs, ["docs/modules/jobs-and-scheduling.md"]);
  assert.deepEqual(result.missingDocs, []);
});

test("ai estimator controller and rate-limit changes require ai-assist docs", () => {
  const tempConfig = loadTempConfig(`
rules:
  - paths:
      - app/modules/ai-estimate-assist/**
      - app/backend/controllers/aiEstimateAssist.controller.ts
      - app/backend/middleware/aiEstimateRateLimit.ts
      - app/backend/routes/aiEstimateAssist.routes.ts
    requires:
      - docs/modules/ai-estimate-assist.md
      - docs/API_REFERENCE.md
      - docs/CURRENT_STATE.md
exemptions: []
`);
  const result = evaluateOwnership({
    changedFiles: ["app/backend/controllers/aiEstimateAssist.controller.ts", "app/backend/middleware/aiEstimateRateLimit.ts"],
    config: tempConfig,
  });
  assert.deepEqual(result.requiredDocs, ["docs/API_REFERENCE.md", "docs/CURRENT_STATE.md", "docs/modules/ai-estimate-assist.md"]);
  assert.deepEqual(result.missingDocs, ["docs/API_REFERENCE.md", "docs/CURRENT_STATE.md", "docs/modules/ai-estimate-assist.md"]);
});

test("multiple matching rules union required docs", () => {
  const result = evaluateOwnership({
    changedFiles: ["app/modules/jobs/service.ts", "app/domain/contracts.ts", "docs/modules/jobs-and-scheduling.md"],
    config,
  });
  assert.deepEqual(result.requiredDocs, [
    "docs/RBAC_MATRIX.md",
    "docs/WORKFLOW_LIFECYCLES.md",
    "docs/modules/jobs-and-scheduling.md",
  ]);
  assert.deepEqual(result.missingDocs, ["docs/RBAC_MATRIX.md", "docs/WORKFLOW_LIFECYCLES.md"]);
});

test("no required docs when no rules match", () => {
  const result = evaluateOwnership({
    changedFiles: ["web/public/logo.svg"],
    config,
  });
  assert.deepEqual(result.requiredDocs, []);
  assert.deepEqual(result.missingDocs, []);
});

test("docs-only module edits do not require docs README", () => {
  const result = evaluateOwnership({
    changedFiles: ["docs/modules/projects.md"],
    config,
  });
  assert.deepEqual(result.requiredDocs, []);
  assert.deepEqual(result.missingDocs, []);
});

test("phase-3 scenario: harmless module-doc edit does not require docs README", () => {
  const tempConfig = loadTempConfig(`
rules:
  - paths:
      - .github/workflows/**
    requires:
      - docs/README.md
  - paths:
      - app/modules/jobs/**
    requires:
      - docs/modules/jobs-and-scheduling.md
exemptions: []
`);
  const result = evaluateOwnership({
    changedFiles: ["docs/modules/jobs-and-scheduling.md"],
    config: tempConfig,
  });
  assert.deepEqual(result.requiredDocs, []);
  assert.deepEqual(result.missingDocs, []);
});

test("roadmap changes require command center update", () => {
  const result = evaluateOwnership({
    changedFiles: ["docs/ROADMAP.md"],
    config,
  });
  assert.deepEqual(result.requiredDocs, ["docs/ENGINEERING_COMMAND_CENTER.md"]);
  assert.deepEqual(result.missingDocs, ["docs/ENGINEERING_COMMAND_CENTER.md"]);
});

test("governance workflow changes require governance docs and command center", () => {
  const result = evaluateOwnership({
    changedFiles: ["AGENTS.md", "docs/REPOSITORY_GOVERNANCE.md"],
    config,
  });
  assert.deepEqual(result.requiredDocs, [
    "docs/ENGINEERING_COMMAND_CENTER.md",
    "docs/REPOSITORY_GOVERNANCE.md",
  ]);
  assert.deepEqual(result.missingDocs, ["docs/ENGINEERING_COMMAND_CENTER.md"]);
});

test("session handoff edits do not require unrelated docs by themselves", () => {
  const result = evaluateOwnership({
    changedFiles: ["docs/SESSION_HANDOFF.md"],
    config,
  });
  assert.deepEqual(result.requiredDocs, []);
  assert.deepEqual(result.missingDocs, []);
});

test("source-of-truth hierarchy changes require governance docs and command center", () => {
  const result = evaluateOwnership({
    changedFiles: ["docs/README.md", "docs/REPOSITORY_GOVERNANCE.md"],
    config,
  });
  assert.deepEqual(result.requiredDocs, [
    "docs/ENGINEERING_COMMAND_CENTER.md",
    "docs/REPOSITORY_GOVERNANCE.md",
  ]);
  assert.deepEqual(result.missingDocs, ["docs/ENGINEERING_COMMAND_CENTER.md"]);
});

test("all required docs changed passes", () => {
  const result = evaluateOwnership({
    changedFiles: ["app/domain/contracts.ts", "docs/RBAC_MATRIX.md", "docs/WORKFLOW_LIFECYCLES.md"],
    config,
  });
  assert.deepEqual(result.missingDocs, []);
});

test("malformed YAML config throws", () => {
  const filePath = writeTempConfig("rules: nope");
  assert.throws(() => loadOwnershipConfig(filePath), /must be an array/);
});

test("phase-3 scenario: malformed ownership configuration fails clearly", () => {
  const filePath = writeTempConfig(`
rules:
  - paths:
      - app/modules/jobs/**
    requires: nope
exemptions: []
`);
  assert.throws(() => loadOwnershipConfig(filePath), /rules\[0\]\.requires must be a non-empty string array/);
});

test("base-ref resolution respects explicit and CI base refs", () => {
  assert.equal(resolveBaseRef({ argsBase: "feature/base", env: {}, git: () => "" }), "feature/base");
  assert.equal(resolveBaseRef({ env: { GITHUB_BASE_REF: "main" }, git: () => "" }), "origin/main");
});

test("path matcher supports exact and glob", () => {
  assert.equal(pathMatches("app/modules/jobs/service.ts", "app/modules/jobs/**"), true);
  assert.equal(pathMatches("docs/README.md", "docs/README.md"), true);
  assert.equal(pathMatches("web/src/app/page.tsx", "app/modules/jobs/**"), false);
});

test("help parser handles help flag", () => {
  assert.deepEqual(parseArgs(["--help"]), { help: true, base: null });
});

test("report marks failures clearly", () => {
  const report = formatReport({
    baseRef: "origin/main",
    result: evaluateOwnership({
      changedFiles: ["app/modules/jobs/service.ts"],
      config,
    }),
  });
  assert.match(report, /Missing documentation updates/);
  assert.match(report, /Result: FAIL/);
});

test("changed files include committed, staged, unstaged, and untracked paths", () => {
  const responses = new Map([
    ["diff --name-status -M origin/main...HEAD", "M\tapp/domain/contracts.ts\n"],
    ["diff --name-status -M --cached", "M\tdocs/RBAC_MATRIX.md\n"],
    ["diff --name-status -M", "M\tdocs/WORKFLOW_LIFECYCLES.md\n"],
    ["ls-files --others --exclude-standard", "docs/new-file.md\n"],
  ]);
  const git = (args) => responses.get(args.join(" ")) ?? "";
  assert.deepEqual(getChangedFiles("origin/main", git), [
    "app/domain/contracts.ts",
    "docs/RBAC_MATRIX.md",
    "docs/WORKFLOW_LIFECYCLES.md",
    "docs/new-file.md",
  ]);
});

test("rename within same owned path requires the same docs", () => {
  const result = evaluateOwnership({
    changedFiles: [
      "app/modules/jobs/service.ts",
      "app/modules/jobs/service-renamed.ts",
      "docs/modules/jobs-and-scheduling.md",
    ],
    config,
  });
  assert.deepEqual(result.requiredDocs, ["docs/modules/jobs-and-scheduling.md"]);
  assert.deepEqual(result.missingDocs, []);
});

test("phase-3 scenario: renamed source file checks both old and new paths", () => {
  const tempConfig = loadTempConfig(`
rules:
  - paths:
      - app/modules/jobs/**
    requires:
      - docs/modules/jobs-and-scheduling.md
  - paths:
      - app/modules/crm/**
    requires:
      - docs/modules/crm.md
      - docs/API_REFERENCE.md
exemptions: []
`);
  const result = evaluateOwnership({
    changedFiles: [
      "app/modules/jobs/service.ts",
      "app/modules/crm/service.ts",
      "docs/modules/jobs-and-scheduling.md",
      "docs/modules/crm.md",
      "docs/API_REFERENCE.md",
    ],
    config: tempConfig,
  });
  assert.deepEqual(result.requiredDocs, [
    "docs/API_REFERENCE.md",
    "docs/modules/crm.md",
    "docs/modules/jobs-and-scheduling.md",
  ]);
  assert.deepEqual(result.missingDocs, []);
});

test("rename across ownership boundaries unions old and new path requirements", () => {
  const result = evaluateOwnership({
    changedFiles: [
      "app/modules/jobs/service.ts",
      "app/modules/crm/service.ts",
      "docs/modules/jobs-and-scheduling.md",
      "docs/modules/crm.md",
      "docs/API_REFERENCE.md",
      "docs/DOMAIN_MODEL.md",
      "docs/CURRENT_STATE.md",
    ],
    config,
  });
  assert.deepEqual(result.requiredDocs, [
    "docs/API_REFERENCE.md",
    "docs/CURRENT_STATE.md",
    "docs/DOMAIN_MODEL.md",
    "docs/modules/crm.md",
    "docs/modules/jobs-and-scheduling.md",
  ]);
  assert.deepEqual(result.missingDocs, []);
});

test("old-path rule is still enforced for renames", () => {
  const result = evaluateOwnership({
    changedFiles: [
      "app/modules/jobs/service.ts",
      "app/modules/crm/service.ts",
      "docs/modules/crm.md",
      "docs/API_REFERENCE.md",
      "docs/DOMAIN_MODEL.md",
      "docs/CURRENT_STATE.md",
    ],
    config,
  });
  assert.deepEqual(result.missingDocs, ["docs/modules/jobs-and-scheduling.md"]);
});

test("new-path rule is enforced for renames", () => {
  const result = evaluateOwnership({
    changedFiles: [
      "app/modules/jobs/service.ts",
      "app/modules/crm/service.ts",
      "docs/modules/jobs-and-scheduling.md",
    ],
    config,
  });
  assert.deepEqual(result.missingDocs, [
    "docs/API_REFERENCE.md",
    "docs/CURRENT_STATE.md",
    "docs/DOMAIN_MODEL.md",
    "docs/modules/crm.md",
  ]);
});

test("exact rename and modified rename entries are both parsed", () => {
  const responses = new Map([
    ["diff --name-status -M origin/main...HEAD", "R100\tapp/modules/jobs/service.ts\tapp/modules/jobs/service-renamed.ts\nR087\tapp/modules/crm/service.ts\tapp/modules/crm/service-v2.ts\n"],
    ["diff --name-status -M --cached", ""],
    ["diff --name-status -M", ""],
    ["ls-files --others --exclude-standard", ""],
  ]);
  const git = (args) => responses.get(args.join(" ")) ?? "";
  assert.deepEqual(getChangedFiles("origin/main", git), [
    "app/modules/crm/service-v2.ts",
    "app/modules/crm/service.ts",
    "app/modules/jobs/service-renamed.ts",
    "app/modules/jobs/service.ts",
  ]);
});

test("malformed rename input fails clearly", () => {
  const responses = new Map([
    ["diff --name-status -M origin/main...HEAD", "R100\tapp/modules/jobs/service.ts\n"],
    ["diff --name-status -M --cached", ""],
    ["diff --name-status -M", ""],
    ["ls-files --others --exclude-standard", ""],
  ]);
  const git = (args) => responses.get(args.join(" ")) ?? "";
  assert.throws(() => getChangedFiles("origin/main", git), /Malformed rename\/copy git diff --name-status line/);
});

test("phase-3 scenario: no matching rule follows documented behavior", () => {
  const tempConfig = loadTempConfig(`
rules:
  - paths:
      - app/modules/jobs/**
    requires:
      - docs/modules/jobs-and-scheduling.md
exemptions: []
`);
  const result = evaluateOwnership({
    changedFiles: ["web/public/logo.svg"],
    config: tempConfig,
  });
  assert.deepEqual(result.requiredDocs, []);
  assert.deepEqual(result.missingDocs, []);
  assert.match(
    formatReport({ baseRef: "origin/main", result }),
    /Required documentation files: none/,
  );
});

test("multiple simultaneous renames include every old and new path", () => {
  const responses = new Map([
    [
      "diff --name-status -M origin/main...HEAD",
      "R100\tapp/modules/jobs/service.ts\tapp/modules/jobs/service-renamed.ts\nR091\tapp/modules/crm/service.ts\tapp/modules/crm/service-v2.ts\nR100\tapp/domain/contracts.ts\tapp/domain/contracts-renamed.ts\n",
    ],
    ["diff --name-status -M --cached", ""],
    ["diff --name-status -M", ""],
    ["ls-files --others --exclude-standard", ""],
  ]);
  const git = (args) => responses.get(args.join(" ")) ?? "";
  assert.deepEqual(getChangedFiles("origin/main", git), [
    "app/domain/contracts-renamed.ts",
    "app/domain/contracts.ts",
    "app/modules/crm/service-v2.ts",
    "app/modules/crm/service.ts",
    "app/modules/jobs/service-renamed.ts",
    "app/modules/jobs/service.ts",
  ]);
});
