import fs from "node:fs";
import path from "node:path";

/**
 * Environment drift guard.
 *
 * Canonical GitHub environments for this repository (see
 * docs/research/github-environment-audit-2026-10-23.md): workflows may
 * reference ONLY `production`, `staging`, and `abc-sandbox`. A new literal
 * name in a workflow makes GitHub auto-create an unprotected environment on
 * first run, which is exactly how the pre-audit sprawl (and the missing
 * `staging` environment) happened. If a new environment is ever intentional:
 * create and protect it in GitHub first, then add its name here in the same
 * PR that introduces the workflow reference.
 *
 * This guard runs in two harnesses with identical logic, because the CI
 * scope detection in verify-repository.yml skips the app suite for
 * workflow-only PRs: this jest copy covers app-touching changes, and
 * scripts/__tests__/github-environment-guard.test.mjs (root `pr:test`
 * lane, run by Docs consistency on every PR) covers workflow-only changes.
 * Keep the two implementations in sync.
 */
const CANONICAL_ENVIRONMENTS: ReadonlySet<string> = new Set([
  "production",
  "staging",
  "abc-sandbox",
]);

const WORKFLOWS_DIR = path.resolve(__dirname, "../../.github/workflows");

interface EnvironmentDeclaration {
  file: string;
  line: number;
  value: string | null;
  problem: string | null;
}

function parseScalar(raw: string): { value: string | null; problem: string | null } {
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

interface StackEntry {
  indent: number;
  key: string;
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
function extractDeclarations(file: string, content: string): EnvironmentDeclaration[] {
  const lines = content.split(/\r?\n/);
  const declarations: EnvironmentDeclaration[] = [];
  const stack: StackEntry[] = [];
  let blockScalarIndent: number | null = null;
  let pendingIndex: number | null = null;
  let pendingPath: string[] | null = null;

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
    } else if (key === "name" && pendingIndex !== null && pendingPath !== null) {
      const expectedPath = pendingPath;
      const pathMatches =
        parentPath.length === expectedPath.length &&
        parentPath.every((part, idx) => part === expectedPath[idx]);
      if (pathMatches) {
        const { value, problem } = parseScalar(inlineValue);
        declarations[pendingIndex].value = value;
        declarations[pendingIndex].problem = problem;
        pendingIndex = null;
        pendingPath = null;
      }
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

function violationsFor(declarations: EnvironmentDeclaration[]): string[] {
  const violations: string[] = [];
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
          `app/tests/github-environment-guard.test.ts.`,
      );
    }
  }
  return violations;
}

function workflowFiles(): string[] {
  return fs
    .readdirSync(WORKFLOWS_DIR)
    .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
    .sort();
}

describe("GitHub environment drift guard", () => {
  it("reads the workflow directory", () => {
    expect(workflowFiles().length).toBeGreaterThan(0);
  });

  it("finds environment declarations (extractor sanity check)", () => {
    const all = workflowFiles().flatMap((file) =>
      extractDeclarations(file, fs.readFileSync(path.join(WORKFLOWS_DIR, file), "utf8")),
    );
    expect(all.length).toBeGreaterThan(0);
    expect(all.map((d) => d.value)).toContain("production");
  });

  it("every workflow environment is in the canonical set", () => {
    const all = workflowFiles().flatMap((file) =>
      extractDeclarations(file, fs.readFileSync(path.join(WORKFLOWS_DIR, file), "utf8")),
    );
    expect(violationsFor(all)).toEqual([]);
  });
});

describe("environment extractor behavior", () => {
  it("rejects case-drifted and unknown names", () => {
    const decls = extractDeclarations("bogus.yml", "jobs:\n  deploy:\n    environment: Production\n");
    expect(violationsFor(decls)).toHaveLength(1);
    expect(violationsFor(decls)[0]).toContain('environment "Production"');
    expect(violationsFor(decls)[0]).toContain("bogus.yml:3");
  });

  it("extracts job environments at nonstandard indentation", () => {
    const content = [
      "jobs:",
      "    deploy:",
      "        runs-on: ubuntu-latest",
      "        environment: rogue",
    ].join("\n");
    const decls = extractDeclarations("wide.yml", content);
    expect(decls).toHaveLength(1);
    expect(decls[0].value).toBe("rogue");
    expect(violationsFor(decls)).toHaveLength(1);
  });

  it("extracts a workflow-level environment", () => {
    const decls = extractDeclarations("top.yml", "name: CI\nenvironment: staging\njobs:\n  a:\n    runs-on: ubuntu-latest\n");
    expect(decls).toHaveLength(1);
    expect(decls[0].value).toBe("staging");
    expect(violationsFor(decls)).toEqual([]);
  });

  it("accepts the block form with a canonical name", () => {
    const content = [
      "jobs:",
      "  deploy:",
      "    environment:",
      "      name: staging",
      "      url: https://example.invalid",
    ].join("\n");
    const decls = extractDeclarations("block.yml", content);
    expect(decls).toHaveLength(1);
    expect(decls[0].value).toBe("staging");
    expect(violationsFor(decls)).toEqual([]);
  });

  it("flags dynamic environment expressions as unverifiable", () => {
    const decls = extractDeclarations(
      "dynamic.yml",
      "jobs:\n  deploy:\n    environment: ${{ matrix.env }}\n",
    );
    expect(violationsFor(decls)).toHaveLength(1);
    expect(violationsFor(decls)[0]).toContain("dynamic");
  });

  it("ignores script payload fields that are not YAML job environments", () => {
    const content = [
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
    expect(extractDeclarations("payload.yml", content)).toEqual([]);
  });

  it("ignores step env variables named environment", () => {
    const content = [
      "jobs:",
      "  build:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - run: echo hi",
      "        env:",
      "          environment: not-a-declaration",
    ].join("\n");
    expect(extractDeclarations("envvar.yml", content)).toEqual([]);
  });
});
