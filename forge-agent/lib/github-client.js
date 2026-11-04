import { REPO, READY_LABEL, validateDraft } from "./policy.js";

const PREFIX = "/repos/" + REPO;
const HOST = "https://api.github.com";

export async function githubRequest(path, { method = "GET", token, body, fetchImpl = fetch } = {}) {
  if (typeof path !== "string" || !path.startsWith(PREFIX + "/") ||
    path.includes("..") || path.includes("://")) throw Error("Unscoped GitHub API request");
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "tradeos-forge-agent",
  };
  if (token) headers.Authorization = "Bearer " + token;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetchImpl(HOST + path, {
    method, headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    const error = Error("GitHub HTTP " + response.status + " in " + method);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export async function inspectIssue(number, {
  readToken = process.env.FORGE_GITHUB_READ_TOKEN,
  fetchImpl = fetch,
} = {}) {
  if (!Number.isSafeInteger(number) || number < 1) throw Error("Invalid issue");
  const result = await githubRequest(PREFIX + "/issues/" + number, { token: readToken, fetchImpl });
  if (result.number !== number || result.pull_request) throw Error("GitHub issue identity mismatch");
  return {
    repository: REPO, number, state: result.state,
    title: String(result.title ?? "").slice(0, 240),
    labels: (result.labels ?? []).map((x) => x.name),
    body: String(result.body ?? "").slice(0, 12000),
    url: "https://github.com/" + REPO + "/issues/" + number,
    trust: "untrusted-issue-content",
  };
}

export async function createDraft(input, {
  enabled = process.env.FORGE_WRITE_ENABLED === "true",
  token = process.env.FORGE_GITHUB_WRITE_TOKEN,
  fetchImpl = fetch,
} = {}) {
  // A disabled or unconfigured agent cannot perform even one write.
  if (!enabled || !token) return { ok: false, reason: "WRITE_DISABLED" };
  const plan = validateDraft(input);
  const api = (path, options = {}) => githubRequest(PREFIX + path, {
    ...options, token, fetchImpl,
  });
  const [main, issue, prs] = await Promise.all([
    api("/git/ref/heads/main"),
    api("/issues/" + plan.issueNumber),
    api("/pulls?state=open&per_page=100"),
  ]);
  if (main.object?.sha !== plan.baseSha) throw Error("Main moved; current head required");
  if (!Array.isArray(prs) || prs.length === 100) throw Error("Incomplete PR inventory");
  if (issue.number !== plan.issueNumber || issue.pull_request || issue.state !== "open") {
    throw Error("Issue not open");
  }
  if (!(issue.labels ?? []).some((x) => x.name === READY_LABEL)) {
    throw Error("Issue lacks forge:ready label");
  }
  if (prs.some((x) => x.head?.ref === plan.branch ||
    (x.body ?? "").includes("Closes #" + plan.issueNumber))) {
    throw Error("Overlapping open PR detected");
  }
  const base = await api("/git/commits/" + plan.baseSha);
  if (!/^[a-f0-9]{40}$/.test(base.tree?.sha ?? "")) throw Error("Missing base tree");
  const latest = await api("/git/ref/heads/main");
  if (latest.object?.sha !== plan.baseSha) throw Error("Main moved during preflight");
  // A docs-only pilot may ADD Markdown, never silently replace a reviewed file.
  // Check each path against the exact base SHA before the first write request.
  // Only GitHub's explicit 404 means that the file does not exist.
  await Promise.all(plan.files.map(async (file) => {
    try {
      await api("/contents/" + file.path + "?ref=" + plan.baseSha);
    } catch (error) {
      if (error.status === 404) return;
      throw error;
    }
    throw Error("Proposed docs/forge file already exists on main");
  }));

  const tree = await api("/git/trees", {
    method: "POST",
    body: {
      base_tree: base.tree.sha,
      tree: plan.files.map((f) => ({
        path: f.path, mode: "100644", type: "blob", content: f.content,
      })),
    },
  });
  const commit = await api("/git/commits", {
    method: "POST",
    body: {
      parents: [plan.baseSha], tree: tree.sha,
      message: "docs(forge): pilot issue #" + plan.issueNumber,
    },
  });
  if (!/^[a-f0-9]{40}$/.test(commit.sha ?? "")) throw Error("Commit was not confirmed");
  await api("/git/refs", {
    method: "POST", body: { ref: "refs/heads/" + plan.branch, sha: commit.sha },
  });
  const pr = await api("/pulls", {
    method: "POST",
    body: {
      base: "main", head: plan.branch, draft: true,
      title: "docs(forge): pilot issue #" + plan.issueNumber,
      body: [
        "## Summary", "Draft-only Forge pilot for issue #" + plan.issueNumber,
        "", "Closes #" + plan.issueNumber,
        "", "## Scope", "Only Markdown under docs/forge/ is permitted.",
        "", "## Required Startup Verification",
        "- [x] Issue label, open PR overlap and exact-main checks",
        "", "## Change Checklist", "- [x] Bounded draft PR",
        "- [ ] Independent review and CI", "",
        "## Documentation Impact", "docs/forge/ only", "",
        "## Verification",
        "- [ ] Hosted exact-head checks pending; model-reported tests are not evidence", "",
        "## Environment-Blocked Checks", "Authenticated acceptance not included in docs pilot.", "",
        "## Risk Review", "No merge, production data or protected migration access.", "",
        "## Known Limitations", "Docs-only pilot, not general-purpose code publishing.", "",
        "## Follow-Up Work", "Complete reviewed release gates before merging.",
      ].join("\n"),
    },
  });
  if (!pr.draft || !Number.isSafeInteger(pr.number) ||
    !String(pr.html_url).startsWith("https://github.com/" + REPO + "/pull/")) {
    throw Error("GitHub did not confirm a draft PR");
  }
  console.info("forge-draft-created", { issue: plan.issueNumber, pr: pr.number, headSha: commit.sha });
  return { ok: true, draft: true, url: pr.html_url, number: pr.number, headSha: commit.sha };
}
