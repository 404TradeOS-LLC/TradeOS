import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import yaml from "js-yaml";
import { QUEUE_LABEL, REQUIRED_CHECKS, queueBlockers, runMergeQueue } from "../merge-queue.mjs";
import { REQUIRED_PR_SECTIONS } from "../pr-body-check.mjs";

const repository = "404TradeOS-LLC/TradeOS";
const head = "a".repeat(40);
function fixture(overrides = {}) {
  return {
    id: "PR_1", number: 1, state: "OPEN", isDraft: false, baseRefName: "main",
    headRefOid: head, mergeable: "MERGEABLE", reviewDecision: null, mergeQueueEntry: null,
    headRepository: { nameWithOwner: repository },
    labels: { nodes: [{ name: QUEUE_LABEL }], pageInfo: { hasNextPage: false } },
    reviewThreads: { nodes: [], pageInfo: { hasNextPage: false } },
    body: REQUIRED_PR_SECTIONS.map((title) => "## " + title + "\n\nReviewed bounded change.").join("\n\n"),
    commits: { nodes: [{ commit: { oid: head, statusCheckRollup: {
      state: "SUCCESS", contexts: {
        nodes: REQUIRED_CHECKS.map((name) => ({
          __typename: "CheckRun", name, status: "COMPLETED", conclusion: "SUCCESS",
        })), pageInfo: { hasNextPage: false },
      },
    } } }] },
    ...overrides,
  };
}

function api(snapshots = [fixture()], enabled = true) {
  const calls = [];
  let readCount = 0;
  const github = {
    rest: {
      pulls: { list: "list" },
      issues: { removeLabel: async (params) => calls.push({ type: "consume", params }) },
    },
    paginate: async () => [{ number: 1 }],
    graphql: async (query, variables) => {
      if (query.includes("mergeQueue(branch:")) return { repository: { mergeQueue: enabled ? { id: "MQ" } : null } };
      if (query.includes("enqueuePullRequest(input:")) {
        calls.push({ type: "enqueue", variables });
        return { enqueuePullRequest: { mergeQueueEntry: { id: "ENTRY" } } };
      }
      return { repository: { pullRequest: snapshots[Math.min(readCount++, snapshots.length - 1)] } };
    },
  };
  const core = {
    failures: [],
    setFailed(message) { this.failures.push(message); },
    summary: { addHeading() { return this; }, addRaw() { return this; },
      addTable() { return this; }, async write() {} },
  };
  return { github, core, context: { repo: { owner: "404TradeOS-LLC", repo: "TradeOS" } }, calls };
}

test("an explicitly queued green main PR is eligible", () => {
  assert.deepEqual(queueBlockers(fixture(), repository), []);
});
for (const [name, override] of [
  ["draft", { isDraft: true }],
  ["closed", { state: "CLOSED" }],
  ["fork", { headRepository: { nameWithOwner: "outsider/TradeOS" } }],
  ["wrong base", { baseRefName: "staging" }],
  ["conflict", { mergeable: "CONFLICTING" }],
  ["unknown mergeability", { mergeable: "UNKNOWN" }],
  ["changes requested", { reviewDecision: "CHANGES_REQUESTED" }],
  ["required review", { reviewDecision: "REVIEW_REQUIRED" }],
  ["queued already", { mergeQueueEntry: { id: "ENTRY" } }],
  ["no consent", { labels: { nodes: [], pageInfo: { hasNextPage: false } } }],
  ["stop label", { labels: { nodes: [{ name: QUEUE_LABEL }, { name: "status:do-not-merge" }],
    pageInfo: { hasNextPage: false } } }],
  ["human review", { labels: { nodes: [{ name: QUEUE_LABEL }, { name: "owner:human-review" }],
    pageInfo: { hasNextPage: false } } }],
  ["unresolved thread", { reviewThreads: { nodes: [{ isResolved: false }],
    pageInfo: { hasNextPage: false } } }],
  ["truncated threads", { reviewThreads: { nodes: [], pageInfo: { hasNextPage: true } } }],
  ["missing threads", { reviewThreads: null }],
  ["missing label pagination", { labels: { nodes: [{ name: QUEUE_LABEL }] } }],
  ["invalid body", { body: "Ready!" }],
  ["absent checks", { commits: { nodes: [] } }],
]) {
  test("refuses " + name, () => assert.ok(queueBlockers(fixture(override), repository).length));
}
test("pending, failed, missing required, and stale-head checks are refused", () => {
  for (const mutate of [
    (pr) => { pr.commits.nodes[0].commit.oid = "b".repeat(40); },
    (pr) => { pr.commits.nodes[0].commit.statusCheckRollup.state = "FAILURE"; },
    (pr) => { pr.commits.nodes[0].commit.statusCheckRollup.contexts.nodes[0].status = "IN_PROGRESS"; },
    (pr) => { pr.commits.nodes[0].commit.statusCheckRollup.contexts.nodes.pop(); },
    (pr) => { pr.commits.nodes[0].commit.statusCheckRollup.contexts.pageInfo.hasNextPage = true; },
    (pr) => { delete pr.commits.nodes[0].commit.statusCheckRollup.contexts.pageInfo; },
  ]) {
    const pr = fixture();
    mutate(pr);
    assert.ok(queueBlockers(pr, repository).length);
  }
});
test("dry run performs no mutation, including when native activation is missing", async () => {
  const mock = api([fixture()], false);
  const result = await runMergeQueue({ ...mock, apply: false });
  assert.equal(result[0].result, "ACTIVATION_REQUIRED");
  assert.deepEqual(mock.calls, []);
});
test("blocked candidates never consume consent in apply mode", async () => {
  const mock = api([fixture({ isDraft: true })]);
  assert.equal((await runMergeQueue({ ...mock, apply: true }))[0].result, "BLOCKED");
  assert.deepEqual(mock.calls, []);
});
test("open PR pagination is requested and candidates are inspected in stable order", async () => {
  const mock = api();
  let params;
  mock.github.paginate = async (_method, options) => {
    params = options;
    return [{ number: 12 }, { number: 2 }];
  };
  const rows = await runMergeQueue({ ...mock });
  assert.deepEqual(rows.map((row) => row.number), [2, 12]);
  assert.deepEqual(params, { owner: "404TradeOS-LLC", repo: "TradeOS", state: "open", base: "main", per_page: 100 });
  assert.deepEqual(mock.calls, []);
});
test("manual selection still requires consent and does not enumerate other PRs", async () => {
  const mock = api([fixture({ labels: { nodes: [], pageInfo: { hasNextPage: false } } })]);
  mock.github.paginate = async () => { throw new Error("unexpected enumeration"); };
  const rows = await runMergeQueue({ ...mock, apply: true, prNumber: 19 });
  assert.equal(rows[0].number, 19);
  assert.equal(rows[0].result, "BLOCKED");
  assert.deepEqual(mock.calls, []);
});
test("invalid repository or PR number is rejected before API mutations", async () => {
  const mock = api();
  await assert.rejects(runMergeQueue({ ...mock, prNumber: -1 }), /Invalid PR number/);
  await assert.rejects(runMergeQueue({ ...mock, context: { repo: { owner: "outsider", repo: "TradeOS" } } }), /Unexpected repository/);
  assert.deepEqual(mock.calls, []);
});
test("apply refuses disabled native queues without consuming consent", async () => {
  const mock = api([fixture()], false);
  await assert.rejects(runMergeQueue({ ...mock, apply: true }), /Enable the native/);
  assert.deepEqual(mock.calls, []);
});
test("consumes consent and enqueues using an exact-head compare-and-swap", async () => {
  const final = fixture({ labels: { nodes: [], pageInfo: { hasNextPage: false } } });
  const mock = api([fixture(), fixture(), final]);
  assert.equal((await runMergeQueue({ ...mock, apply: true }))[0].result, "QUEUED");
  assert.equal(mock.calls[0].type, "consume");
  assert.deepEqual(mock.calls[1], { type: "enqueue", variables: { id: "PR_1", head } });
});
test("a head race before consent consumption performs no mutation", async () => {
  const mock = api([fixture(), fixture({ headRefOid: "b".repeat(40) })]);
  assert.equal((await runMergeQueue({ ...mock, apply: true }))[0].result, "CHANGED");
  assert.deepEqual(mock.calls, []);
});
test("a newly added blocker after consent consumption prevents enqueue", async () => {
  const mock = api([fixture(), fixture(), fixture({ isDraft: true })]);
  assert.equal((await runMergeQueue({ ...mock, apply: true }))[0].result, "CHANGED");
  assert.deepEqual(mock.calls.map((call) => call.type), ["consume"]);
  assert.equal(mock.core.failures.length, 1);
});
test("an API rejection never falls back to direct merge", async () => {
  const mock = api();
  mock.github.rest.issues.removeLabel = async () => { throw new Error("Forbidden"); };
  assert.equal((await runMergeQueue({ ...mock, apply: true }))[0].result, "API_ERROR");
  assert.deepEqual(mock.calls, []);
});
test("enqueue rejection consumes consent once and never retries a failed head", async () => {
  const consumed = fixture({ labels: { nodes: [], pageInfo: { hasNextPage: false } } });
  const mock = api([fixture(), fixture(), consumed]);
  const graphql = mock.github.graphql;
  mock.github.graphql = async (query, variables) => {
    if (query.includes("enqueuePullRequest(input:")) throw new Error("Head changed");
    return graphql(query, variables);
  };
  assert.equal((await runMergeQueue({ ...mock, apply: true }))[0].result, "API_ERROR");
  assert.equal((await runMergeQueue({ ...mock, apply: true }))[0].result, "BLOCKED");
  assert.deepEqual(mock.calls.map((call) => call.type), ["consume"]);
});
test("all current required check providers run on merge groups", () => {
  for (const file of ["verify-repository.yml", "docs-consistency.yml"]) {
    const workflow = yaml.load(fs.readFileSync(".github/workflows/" + file, "utf8"));
    assert.deepEqual(workflow.on.merge_group, { types: ["checks_requested"], branches: ["main"] });
  }
  const docs = yaml.load(fs.readFileSync(".github/workflows/docs-consistency.yml", "utf8"));
  const ownerCheck = docs.jobs["docs-consistency"].steps.find((s) => s.name === "Run docs consistency check");
  assert.match(ownerCheck.env.BASE_REF, /github.event.merge_group.base_sha/);
});
test("privileged queue only loads main and has no direct-merge/branch-update operation", () => {
  const workflow = yaml.load(fs.readFileSync(".github/workflows/merge-queue.yml", "utf8"));
  assert.equal(workflow.concurrency["cancel-in-progress"], false);
  assert.ok(!workflow.on.pull_request_target);
  assert.equal(workflow.jobs.enqueue.steps[0].with.ref, "main");
  assert.equal(workflow.jobs.enqueue.steps[0].with["persist-credentials"], false);
  assert.match(workflow.jobs.enqueue.if, /TRADEOS_MERGE_QUEUE_ENABLED/);
  assert.equal(workflow.on.workflow_dispatch.inputs.apply.default, false);
  assert.ok(!workflow.jobs.enqueue.permissions.actions);
  assert.ok(Object.values(workflow.jobs.enqueue.permissions).every((value) => value === "read"));
  const action = workflow.jobs.enqueue.steps[1];
  assert.match(action.with["github-token"], /secrets.TRADEOS_MERGE_QUEUE_TOKEN/);
  // Execute the workflow seam with absent credentials: no helper/API is reached.
  const script = new Function("process", "github", "context", "core", "return (async () => {" + action.with.script + "})()");
  return assert.rejects(script({ env: { QUEUE_APPLY: "true", QUEUE_TOKEN_CONFIGURED: "false" } }, null, null, null), /Configure TRADEOS_MERGE_QUEUE_TOKEN/);
});
test("ruleset template adds only a serial all-green queue with no bypass", () => {
  const config = JSON.parse(fs.readFileSync(".github/merge-queue-ruleset.json", "utf8"));
  assert.deepEqual(config.bypass_actors, []);
  assert.deepEqual(config.conditions.ref_name, { include: ["refs/heads/main"], exclude: [] });
  assert.equal(config.enforcement, "active");
  assert.deepEqual(config.rules.map((rule) => rule.type), ["merge_queue"]);
  assert.equal(config.rules[0].parameters.grouping_strategy, "ALLGREEN");
  assert.equal(config.rules[0].parameters.max_entries_to_build, 1);
  assert.equal(config.rules[0].parameters.max_entries_to_merge, 1);
  assert.equal(config.rules[0].parameters.merge_method, "SQUASH");
});
test("queue implementation contains no direct merge or branch update", () => {
  const source = fs.readFileSync("scripts/merge-queue.mjs", "utf8");
  assert.doesNotMatch(source, /mergePullRequest|updateBranch|force: true|--admin/);
});
