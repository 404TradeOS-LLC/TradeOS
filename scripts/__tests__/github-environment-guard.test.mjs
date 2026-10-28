import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

/**
 * Environment drift guard — root `pr:test` copy.
 *
 * Canonical GitHub environments for this repository (see
 * docs/research/github-environment-audit-2026-10-23.md): workflows may
 * reference ONLY `production`, `staging`, and `abc-sandbox`. A new literal
 * name in a workflow makes GitHub auto-create an unprotected environment
 * on first run.
 *
 * This copy exists because the CI scope detection in
 * verify-repository.yml skips the app suite for workflow-only PRs, while
 * the Docs consistency workflow runs `npm run pr:test` on every PR. The
 * jest copy lives at app/tests/github-environment-guard.test.ts. The two
 * implementations are intentionally identical in logic — keep them in sync.
 */
const CANONICAL_ENVIRONMENTS = new Set(["production", "staging", "abc-sandbox"]);

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WORKFLOWS_DIR = path.join(repositoryRoot, ".github", "workflows");

function parseScalar(raw) {
  const rest = raw.trim();
  if (rest.startsWith("${{")) {
    return {
      value: null,
      problem: "dynamic environment expression cannot be verified statically",
    };
  }
  if (rest.startsWith('"') || rest.startsWith("'")) {
    const quote = rest[0];
    const end = rest.indexOf(quote, 1);
    if (end === -1) return { value: null, problem: "unterminated quoted environment value" };
    const trailing = rest.slice(end + 1).trim();
    if (trailing !== "" && !trailing.startsWith("#")) {
      return { value: null, problem: `unparseable environment value "${rest}"` };
    }
    return { value: rest.slice(1, end), problem: null };
  }
  const [token, ...after] = rest.split(/\s+/);
  const trailing = after.join(" ").trim();
  if (trailing !== "" && !trailing.startsWith("#")) {
    return { value: null, problem: `unparseable environment value "${rest}"` };
  }
  return { value: token, problem: null };
}

/**
 * Extracts `environment:` declarations by YAML structure, not by absolute
 * indentation: a declaration is a mapping key `environment` whose parent
 * path is either the document root (workflow-level) or `jobs.<job-id>`.
 * Literal/folded block scalars (run:/script: payloads) are consumed as
 * content, and same-named keys elsewhere (a step `env:` variable, a script
 * payload field) are not declarations. Both YAML shapes are handled:
 *
 *   environment: production
 *
 *   environment:
 *     name: production
 */
function extractDeclarations(file, content) {
  const lines = content.split(/\r?\n/);
  const declarations = [];
  const stack = [];
  let blockScalarIndent = null;
  let pendingIndex = null;
  let pendingPath = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const stripped = rawLine.trimStart();
    if (stripped === "" || stripped.startsWith("#")) continue;
    const indent = rawLine.length - stripped.length;

    if (blockScalarIndent !== null) {
      if (indent > blockScalarIndent) continue;
      blockScalarIndent = null;
    }

    // A sequence entry ("- key: value") acts as a mapping key two columns
    // deeper than the dash.
    let effectiveIndent = indent;
    let text = stripped;
    if (text.startsWith("- ")) {
      effectiveIndent = indent + 2;
      text = text.slice(2);
    }
    const keyMatch = text.match(/^([^:#\s][^:#]*?):(?:\s+(.*?))?\s*$/);
    if (!keyMatch) continue;
    const key = keyMatch[1].trim().replace(/^["']|["']$/g, "");
    const inlineValue = (keyMatch[2] ?? "").trim();

    while (stack.length > 0 && stack[stack.length - 1].indent >= effectiveIndent) {
      stack.pop();
    }
    const parentPath = stack.map((entry) => entry.key);

    const isEnvironmentKey =
      key === "environment" &&
      (parentPath.length === 0 ||
        (parentPath.length === 2 && parentPath[0] === "jobs"));

    if (isEnvironmentKey) {
      if (inlineValue !== "") {
        const { value, problem } = parseScalar(inlineValue);
        declarations.push({ file, line: i + 1, value, problem });
        pendingIndex = null;
        pendingPath = null;
      } else {
        declarations.push({ file, line: i + 1, value: null, problem: null });
        pendingIndex = declarations.length - 1;
        pendingPath = [...parentPath, "environment"];
      }
    } else if (
      key === "name" &&
      pendingIndex !== null &&
      pendingPath !== null &&
      parentPath.length === pendingPath.length &&
      parentPath.every((part, idx) => part === pendingPath[idx])
    ) {
      const { value, problem } = parseScalar(inlineValue);
      declarations[pendingIndex].value = value;
      declarations[pendingIndex].problem = problem;
      pendingIndex = null;
      pendingPath = null;
    }

    if (inlineValue.startsWith("|") || inlineValue.startsWith(">")) {
      blockScalarIndent = effectiveIndent;
    }
    stack.push({ indent: effectiveIndent, key });
  }

  for (const decl of declarations) {
    if (decl.value === null && decl.problem === null) {
      decl.problem = "environment block declares no `name:`";
    }
  }
  return declarations;
}

function violationsFor(declarations) {
  const violations = [];
  for (const decl of declarations) {
    const where = `.github/workflows/${decl.file}:${decl.line}`;
    if (decl.problem !== null) {
      violations.push(`${where} — ${decl.problem}`);
    } else if (decl.value !== null && !CANONICAL_ENVIRONMENTS.has(decl.value)) {
      violations.push(
        `${where} — environment "${decl.value}" is not in the canonical set ` +
          `{${[...CANONICAL_ENVIRONMENTS].join(", ")}}. GitHub auto-creates unknown ` +
          `environments with no protection rules on first run. Create and protect the ` +
          `environment first, then add its name to CANONICAL_ENVIRONMENTS in ` +
          `scripts/__tests__/github-environment-guard.test.mjs.`,
      );
    }
  }
  return violations;
}

function workflowFiles() {
  return fs
    .readdirSync(WORKFLOWS_DIR)
    .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
    .sort();
}

function allDeclarations() {
  return workflowFiles().flatMap((file) =>
    extractDeclarations(file, fs.readFileSync(path.join(WORKFLOWS_DIR, file), "utf8")),
  );
}

test("guard reads the workflow directory and finds declarations", () => {
  assert.ok(workflowFiles().length > 0);
  const all = allDeclarations();
  assert.ok(all.length > 0);
  assert.ok(all.map((d) => d.value).includes("production"));
});

test("every workflow environment is in the canonical set", () => {
  assert.deepEqual(violationsFor(allDeclarations()), []);
});

test("extractor rejects case-drifted and unknown names", () => {
  const decls = extractDeclarations("bogus.yml", "jobs:\n  deploy:\n    environment: Production\n");
  const violations = violationsFor(decls);
  assert.equal(violations.length, 1);
  assert.match(violations[0], /environment "Production"/);
  assert.match(violations[0], /bogus\.yml:3/);
});

test("extractor handles nonstandard indentation structurally", () => {
  const content = [
    "jobs:",
    "    deploy:",
    "        runs-on: ubuntu-latest",
    "        environment: rogue",
  ].join("\n");
  const decls = extractDeclarations("wide.yml", content);
  assert.equal(decls.length, 1);
  assert.equal(decls[0].value, "rogue");
  assert.equal(violationsFor(decls).length, 1);
});

test("extractor accepts the block form with a canonical name", () => {
  const content = [
    "jobs:",
    "  deploy:",
    "    environment:",
    "      name: staging",
    "      url: https://example.invalid",
  ].join("\n");
  const decls = extractDeclarations("block.yml", content);
  assert.equal(decls.length, 1);
  assert.equal(decls[0].value, "staging");
  assert.deepEqual(violationsFor(decls), []);
});

test("extractor flags dynamic environment expressions", () => {
  const decls = extractDeclarations(
    "dynamic.yml",
    "jobs:\n  deploy:\n    environment: ${{ matrix.env }}\n",
  );
  const violations = violationsFor(decls);
  assert.equal(violations.length, 1);
  assert.match(violations[0], /dynamic/);
});

test("extractor ignores script payloads and step env variables", () => {
  const payload = [
    "jobs:",
    "  evidence:",
    "    steps:",
    "      - uses: actions/github-script@v7",
    "        with:",
    "          script: |",
    "            const payload = {",
    "                environment: process.env.TRADEOS_AGENT_ENVIRONMENT,",
    "            };",
    "            environment: rogue",
  ].join("\n");
  assert.deepEqual(extractDeclarations("payload.yml", payload), []);

  const envVar = [
    "jobs:",
    "  build:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - run: echo hi",
    "        env:",
    "          environment: not-a-declaration",
  ].join("\n");
  assert.deepEqual(extractDeclarations("envvar.yml", envVar), []);
});
