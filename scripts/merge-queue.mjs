import { validatePrBody } from "./pr-body-check.mjs";

export const QUEUE_LABEL = "status:merge-queue";
export const REQUIRED_CHECKS = [
  "Web lint and build", "App lint, unit tests, and build",
  "App integration tests", "Docs consistency",
];
const STOP_LABELS = new Set([
  "status:do-not-merge", "status:blocked", "status:superseded", "owner:human-review",
]);
const GREEN = new Set(["SUCCESS", "SKIPPED", "NEUTRAL"]);

export function queueBlockers(pr, repository, { requireConsent = true } = {}) {
  if (!pr) return ["PR unavailable"];
  const blockers = [];
  const labels = pr.labels?.nodes?.map((label) => label.name) ?? [];
  if (pr.state !== "OPEN" || pr.isDraft) blockers.push("closed or draft");
  if (pr.baseRefName !== "main" || pr.headRepository?.nameWithOwner !== repository) {
    blockers.push("wrong base or fork");
  }
  if (requireConsent && !labels.includes(QUEUE_LABEL)) blockers.push("queue label missing");
  if (labels.some((label) => STOP_LABELS.has(label))) blockers.push("stop/review label present");
  if (!Array.isArray(pr.labels?.nodes) || !Array.isArray(pr.reviewThreads?.nodes) ||
      pr.labels?.pageInfo?.hasNextPage !== false || pr.reviewThreads?.pageInfo?.hasNextPage !== false) {
    blockers.push("incomplete label/thread evidence");
  }
  if (pr.mergeQueueEntry) blockers.push("already queued");
  if (!/^[a-f0-9]{40}$/.test(pr.headRefOid ?? "")) blockers.push("head SHA unavailable");
  if (pr.mergeable !== "MERGEABLE") blockers.push("conflicting or unknown mergeability");
  if (["CHANGES_REQUESTED", "REVIEW_REQUIRED"].includes(pr.reviewDecision)) {
    blockers.push("review not satisfied");
  }
  if (pr.reviewThreads?.nodes?.some((thread) => !thread.isResolved)) {
    blockers.push("unresolved review conversation");
  }
  if (!validatePrBody(pr.body).ok) blockers.push("PR description incomplete");
  const commit = pr.commits?.nodes?.[0]?.commit;
  const rollup = commit?.statusCheckRollup;
  const contexts = rollup?.contexts?.nodes ?? [];
  if (commit?.oid !== pr.headRefOid || rollup?.state !== "SUCCESS" ||
      rollup?.contexts?.pageInfo?.hasNextPage !== false || !contexts.length) {
    blockers.push("head checks missing, pending, failing, or incomplete");
  }
  if (contexts.some((check) => check.__typename === "CheckRun"
    ? check.status !== "COMPLETED" || !GREEN.has(check.conclusion)
    : check.__typename !== "StatusContext" || check.state !== "SUCCESS")) {
    blockers.push("a reported check is not green");
  }
  const names = new Set(contexts.map((check) => check.name ?? check.context));
  if (REQUIRED_CHECKS.some((name) => !names.has(name))) blockers.push("required check context absent");
  return blockers;
}

export const PR_QUERY = [
  "query($owner: String!, $name: String!, $number: Int!) {",
  " repository(owner: $owner, name: $name) { pullRequest(number: $number) {",
  "  id number state body isDraft baseRefName headRefOid mergeable reviewDecision",
  "  headRepository { nameWithOwner } mergeQueueEntry { id }",
  "  labels(first: 100) { nodes { name } pageInfo { hasNextPage } }",
  "  reviewThreads(first: 100) { nodes { isResolved } pageInfo { hasNextPage } }",
  "  commits(last: 1) { nodes { commit { oid statusCheckRollup {",
  "    state contexts(first: 100) { nodes { __typename",
  "      ... on CheckRun { name status conclusion }",
  "      ... on StatusContext { context state }",
  "    } pageInfo { hasNextPage } }",
  "  } } } }",
  " } }",
  "}",
].join("\n");

export async function runMergeQueue({ github, context, core, apply = false, prNumber = 0 }) {
  const { owner, repo: name } = context.repo;
  const repository = owner + "/" + name;
  if (repository !== "404TradeOS-LLC/TradeOS") throw new Error("Unexpected repository");
  if (!Number.isSafeInteger(prNumber) || prNumber < 0) throw new Error("Invalid PR number");
  const state = await github.graphql(
    'query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { mergeQueue(branch: "main") { id } } }',
    { owner, name },
  );
  const enabled = Boolean(state.repository?.mergeQueue?.id);
  if (apply && !enabled) throw new Error("Enable the native main merge queue before applying");
  const candidates = prNumber ? [{ number: prNumber }] : await github.paginate(
    github.rest.pulls.list, { owner, repo: name, state: "open", base: "main", per_page: 100 },
  );
  const rows = [];
  let failed = false;
  const read = async (number) => (await github.graphql(PR_QUERY, { owner, name, number }))
    .repository?.pullRequest;
  // Deterministic dispatch ordering; GitHub owns FIFO once entries are queued.
  for (const { number } of candidates.sort((a, b) => a.number - b.number)) {
    try {
      const initial = await read(number);
      const blockers = queueBlockers(initial, repository);
      if (blockers.length) {
        rows.push({ number, result: "BLOCKED", detail: blockers.join("; ") });
        continue;
      }
      if (!apply) {
        rows.push({ number, result: enabled ? "READY" : "ACTIVATION_REQUIRED", head: initial.headRefOid });
        continue;
      }
      const fresh = await read(number);
      const freshBlockers = queueBlockers(fresh, repository);
      if (fresh?.headRefOid !== initial.headRefOid || freshBlockers.length) {
        rows.push({ number, result: "CHANGED", detail: "Head or eligibility changed; no mutation" });
        continue;
      }
      // Consume one-shot consent before enqueue. Rejected/ejected heads never
      // automatically loop back into the queue on every scheduled poll.
      await github.rest.issues.removeLabel({ owner, repo: name, issue_number: number, name: QUEUE_LABEL });
      const final = await read(number);
      if (final?.headRefOid !== fresh.headRefOid ||
          queueBlockers(final, repository, { requireConsent: false }).length) {
        failed = true;
        rows.push({ number, result: "CHANGED", detail: "Consent consumed; reapply label after review" });
        continue;
      }
      const result = await github.graphql(
        "mutation($id: ID!, $head: GitObjectID!) { enqueuePullRequest(input: { pullRequestId: $id, expectedHeadOid: $head }) { mergeQueueEntry { id } } }",
        { id: final.id, head: final.headRefOid },
      );
      if (!result.enqueuePullRequest?.mergeQueueEntry?.id) throw new Error("Queue entry not returned");
      rows.push({ number, result: "QUEUED", head: final.headRefOid });
    } catch {
      failed = true;
      rows.push({ number, result: "API_ERROR", detail: "No merge attempted; inspect permissions/state and reapply consent if consumed" });
    }
  }
  await core.summary.addHeading("TradeOS native merge queue")
    .addRaw(apply ? "Apply mode: GitHub controls group CI and merging.\n\n" : "Dry run: no labels or queue entries changed.\n\n")
    .addRaw(enabled ? "Native queue detected.\n\n" : "Native queue activation is required.\n\n")
    .addTable([
      [{ data: "PR", header: true }, { data: "Result", header: true }, { data: "Evidence", header: true }],
      ...rows.map((row) => ["#" + row.number, row.result, row.detail ?? row.head ?? ""]),
    ]).write();
  if (failed) core.setFailed("Some queue operations failed; consult the summary. No direct merge fallback.");
  return rows;
}
