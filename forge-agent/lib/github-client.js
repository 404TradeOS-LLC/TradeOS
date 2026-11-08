import { REPO, READY_LABEL, validateDraft } from "./policy.js";

const PREFIX = "/repos/" + REPO;
const HOST = "https://api.github.com";

export async function githubRequest(path, { method = "GET", token, body, fetchImpl = fetch } = {}) {
  if (typeof path !== "string" || !path.startsWith(PREFIX + "/") ||
    path.includes("..") || path.includes("%") || path.includes("://")) throw Error("Unscoped GitHub API request");
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
  if (response.status === 204) return null;
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
    bodyTruncated: String(result.body ?? "").length > 12000,
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
  if (String(issue.body ?? "").length > 12000) throw Error("Issue body truncated; refuse draft");
  const closing = new RegExp("\\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?):?\\s+(?:" + REPO + ")?#" + plan.issueNumber + "\\b", "i");
  if (prs.some((x) => x.head?.ref === plan.branch || closing.test(x.body ?? ""))) {
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
  // Reconcile a preserved branch before creating a new commit. A prior
  // invocation may have created the branch and commit but failed to publish
  // the PR; the branch is deliberately preserved for review. Commit SHAs are
  // timestamp-dependent, so a fresh commit for identical content would never
  // match the preserved head, and the branch-reuse check below would reject
  // the retry. If the preserved head already carries this exact tree on the
  // same base with the same message, reuse that commit instead.
  const branchPath = "/git/ref/heads/" + plan.branch;
  const preserved = await api(branchPath).catch(() => null);
  let commit;
  if (preserved?.object?.sha) {
    const preservedCommit = await api("/git/commits/" + preserved.object.sha).catch(() => null);
    if (preservedCommit?.tree?.sha === tree.sha &&
        Array.isArray(preservedCommit.parents) &&
        preservedCommit.parents.length === 1 &&
        preservedCommit.parents[0]?.sha === plan.baseSha &&
        preservedCommit.message === "docs(forge): pilot issue #" + plan.issueNumber) {
      commit = { sha: preserved.object.sha };
    }
  }
  if (!commit) {
    commit = await api("/git/commits", {
      method: "POST",
      body: {
        parents: [plan.baseSha], tree: tree.sha,
        message: "docs(forge): pilot issue #" + plan.issueNumber,
      },
    });
  }
  if (!/^[a-f0-9]{40}$/.test(commit.sha ?? "")) throw Error("Commit was not confirmed");
  // Do not reuse a branch unless its head matches the commit we just created.
  // A prior ambiguous request may have created a PR; reconcile before retrying.
  try {
    await api("/git/refs", {
      method: "POST", body: { ref: "refs/heads/" + plan.branch, sha: commit.sha },
    });
  } catch (error) {
    const existing = await api(branchPath).catch(() => null);
    if (existing?.object?.sha !== commit.sha) throw error;
  }
  const findBranchPr = async () => {
    const matches = await api("/pulls?head=" + REPO.split("/")[0] + ":" + plan.branch + "&state=open&per_page=100");
    if (!Array.isArray(matches) || matches.length === 100) throw Error("Incomplete branch PR inventory");
    return matches.find((x) => x.head?.sha === commit.sha && x.head?.ref === plan.branch && x.base?.ref === "main" && x.draft === true);
  };
  let pr;
  try {
    pr = await api("/pulls", {
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
  } catch (error) {
    let matching;
    try { matching = await findBranchPr(); } catch { /* preserve original error */ }
    if (matching) pr = matching;
    else {
      // Never delete a branch after publication failure: another request may have
      // opened a PR between the inventory read and deletion. Preserve for review.
      throw error;
    }
  }
  if (!pr.draft || !Number.isSafeInteger(pr.number) ||
    !String(pr.html_url).startsWith("https://github.com/" + REPO + "/pull/")) {
    throw Error("GitHub did not confirm a draft PR");
  }
  console.info("forge-draft-created", { issue: plan.issueNumber, pr: pr.number, headSha: commit.sha });
  return { ok: true, draft: true, url: pr.html_url, number: pr.number, headSha: commit.sha };
}
