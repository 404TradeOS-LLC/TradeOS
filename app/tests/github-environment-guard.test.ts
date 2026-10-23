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

/**
 * Extracts job/workflow-level `environment:` declarations from workflow
 * YAML. GitHub's schema only permits the key at workflow level (indent 0)
 * or as a job property (indent 4 under this repo's 2-space convention), so
 * deeper-indented `environment:` strings — e.g. JavaScript payload fields
 * inside `actions/github-script` steps — are not declarations and are
 * ignored. Both YAML shapes are handled:
 *
 *   environment: production
 *
 *   environment:
 *     name: production
 */
function extractDeclarations(file: string, content: string): EnvironmentDeclaration[] {
  const lines = content.split(/\r?\n/);
  const declarations: EnvironmentDeclaration[] = [];
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (rawLine.trimStart().startsWith("#")) continue;
    const match = rawLine.match(/^(\s*)environment:(\s+(.*?))?\s*$/);
    if (!match) continue;
    const indent = match[1].length;
    if (indent > 4) continue;
    const rest = (match[3] ?? "").trim();
    if (rest !== "") {
      const { value, problem } = parseScalar(rest);
      declarations.push({ file, line: i + 1, value, problem });
      continue;
    }
    // Block form: find `name:` on a following, more-indented line.
    let nameValue: string | null = null;
    let nameProblem: string | null = null;
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j];
      if (next.trim() === "") continue;
      const nextIndent = next.length - next.trimStart().length;
      if (nextIndent <= indent) break;
      const nameMatch = next.match(/^\s*name:\s+(.*?)\s*$/);
      if (nameMatch) {
        const parsed = parseScalar(nameMatch[1]);
        nameValue = parsed.value;
        nameProblem = parsed.problem;
        break;
      }
    }
    if (nameValue === null && nameProblem === null) {
      nameProblem = "environment block declares no `name:`";
    }
    declarations.push({ file, line: i + 1, value: nameValue, problem: nameProblem });
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
    ].join("\n");
    expect(extractDeclarations("payload.yml", content)).toEqual([]);
  });
});
