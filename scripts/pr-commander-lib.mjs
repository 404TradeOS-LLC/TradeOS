// pr-commander-lib.mjs — pure gate logic for the TradeOS Autonomous PR Commander.
//
// This module is deliberately pure: no I/O, no `gh` calls, no environment
// access. Every function is exported for unit tests (`node --test`) and is
// consumed by `scripts/pr-commander.mjs` (CLI) and by
// `.github/workflows/pr-commander.yml` (via the CLI).
//
// Authority: the merge bar encoded here is the 12-condition auto-merge
// readiness contract in AGENTS.md plus the live main ruleset 18958081
// (four required checks, squash/rebase only, required thread resolution,
// strict branch freshness). This module READS policy; it never changes it.
//
// Fail-closed rules baked into evaluateGate():
//   - No head SHA -> no verdict other than BLOCKED. Missing CI is never green.
//   - A DIRTY/CONFLICTING branch gets no pull_request CI at all (#918 lesson),
//     so conflicts are BLOCKED and routed to human resolution.
//   - There is NO review-dismissal path anywhere in this module or in the
//     workflow. Dismissing a blocking review (including a stale CodeRabbit
//     CHANGES_REQUESTED on a superseded head) is founder-only and is surfaced
//     as a founder item, never performed.
//   - Drafts never merge. Protected files (migrations / RLS / auth /
//     protected staging) never merge without a founder item being raised.
//   - A verdict always stands on one exact head SHA (see headVerdictKey()).
//   - evaluateGate() is a pure evaluator: it is armed unless opts says
//     otherwise (`{ armed: false }` yields DRY_RUN_ONLY for a ready snapshot).
//     The dry-run default lives in the CALLERS — the workflow's evaluate job
//     and the CLI always pass `armed` explicitly (false unless the run is
//     armed via the repository variable). Do not assume a bare
//     evaluateGate(snapshot) call is a dry-run.

export const REQUIRED_CHECKS = [
  "Web lint and build",
  "App lint, unit tests, and build",
  "App integration tests",
  "Docs consistency",
];

// Maximum deterministic repair attempts per exact head SHA (requirement 10).
// After this many attempts the PR is BLOCKED_ESCALATED and the Commander stops.
export const MAX_REPAIR_ATTEMPTS = 3;

// Exponential backoff base for repair retries: 60s, 120s, 240s, then null.
export const BACKOFF_BASE_MS = 60_000;

// Marker identifying the single Commander verdict comment on a PR, updated
// in place. Also the repair-attempt counter carrier (see workflow).
export const COMMANDER_MARKER = "<!-- tradeos-pr-commander -->";

// Label applied (armed runs only) when a PR needs a genuine founder decision.
export const FOUNDER_LABEL = "pr-commander:needs-founder";

// Repository variable that arms write-capable actions. The workflow and the
// CLI treat anything other than exactly "true" as dry-run.
export const ARMED_VARIABLE = "TRADEOS_PR_COMMANDER_WRITE_ENABLED";

const VALID_SHA = /^[0-9a-f]{40}$/i;
const GREEN_CONCLUSIONS = new Set(["SUCCESS", "SKIPPED", "NEUTRAL"]);
const FAILED_CONCLUSIONS = new Set([
  "FAILURE",
  "CANCELLED",
  "TIMED_OUT",
  "ACTION_REQUIRED",
]);

function isValidSha(value) {
  return typeof value === "string" && VALID_SHA.test(value);
}

// The exact head SHA a verdict stands on. Returns null when the snapshot
// carries no valid 40-character head SHA — callers must treat null as
// "no evidence at all", never as a pass.
export function headVerdictKey(snapshot) {
  const sha = snapshot?.headSha ?? snapshot?.headRefOid ?? null;
  return isValidSha(sha) ? sha : null;
}

// True only when the repository variable is exactly "true". Absent, empty,
// "True", "1", "yes", or anything else is dry-run. `env` is the process env
// (or a plain object in tests); no other value arms anything.
export function isArmed(env) {
  return env?.[ARMED_VARIABLE] === "true";
}

// Exponential backoff for repair retries on one head SHA.
// `attempt` is the 1-based number of the repair attempt about to be made:
// attempt 1 -> 60s, attempt 2 -> 120s, attempt 3 -> 240s. Attempt 4 or later
// (or any invalid attempt) returns null — max 3 repair attempts per head,
// then escalate, do not retry.
export function nextRetryDelayMs(attempt) {
  const n = Number.isInteger(attempt) ? attempt : 0;
  if (n < 1 || n > MAX_REPAIR_ATTEMPTS) return null;
  return BACKOFF_BASE_MS * 2 ** (n - 1);
}

function filePath(file) {
  if (typeof file === "string") return file;
  if (file && typeof file === "object") return file.filename ?? file.path ?? "";
  return "";
}

// Classify a PR's changed files. `files` is an array of plain path strings.
// Classification is intentionally broad (fail-closed): an ambiguous path is
// flagged, and flagging only ever routes the PR to founder review — it never
// weakens a gate. `other` is true exactly when at least one file falls in no
// protected category.
export function classifyPrFiles(files) {
  const paths = Array.isArray(files) ? files.map(filePath).filter(Boolean) : [];
  let migrations = false;
  let rls = false;
  let auth = false;
  let protectedStaging = false;
  let other = false;
  for (const path of paths) {
    const isMigration =
      /(^|\/)prisma\/migrations\//i.test(path) ||
      /\/migrations\//i.test(path) ||
      /migration/i.test(path);
    const isRls =
      /rls/i.test(path) ||
      /row[-_ ]level[-_ ]security/i.test(path) ||
      /force[-_ ]row[-_ ]level[-_ ]security/i.test(path);
    const isAuth =
      /(^|[/_.-])auth/i.test(path) ||
      /authorization/i.test(path) ||
      /permissions/i.test(path) ||
      /jwt/i.test(path) ||
      /oauth/i.test(path) ||
      /middleware\/auth/i.test(path);
    const isProtectedStaging =
      /\.github\/workflows\/(deploy|staging|reconcile)/i.test(path) ||
      /(^|\/)\.env\.(staging|production)/i.test(path) ||
      /deploy-(staging-)?migrations/i.test(path) ||
      /reconcile-(production|staging)/i.test(path) ||
      /staging-orchestrator/i.test(path) ||
      /production.*migration|migration.*production/i.test(path);
    if (isMigration) migrations = true;
    if (isRls) rls = true;
    if (isAuth) auth = true;
    if (isProtectedStaging) protectedStaging = true;
    if (!isMigration && !isRls && !isAuth && !isProtectedStaging) other = true;
  }
  return { migrations, rls, auth, protectedStaging, other };
}

// Detect stacked PRs: groups of PRs whose base branch is another open PR's
// head branch. Returns an array of groups; each group is an array of the PR
// objects themselves, ordered base-first (the PR targeting main first, its
// dependent last). `prs` are snapshots with { number, baseRefName,
// headRefName }. Singletons (base is main or an unknown branch) are not
// stacks and are omitted.
export function detectStacks(prs) {
  const list = Array.isArray(prs) ? prs : [];
  const byHead = new Map(list.map((pr) => [pr?.headRefName, pr]).filter(([k]) => k));
  const visited = new Set();
  const stacks = [];
  for (const pr of list) {
    if (!pr || visited.has(pr.number)) continue;
    // Walk up from this PR to the stack root (the PR whose base is not
    // another open PR's head).
    const chain = [pr];
    const seen = new Set([pr.number]);
    let current = pr;
    while (byHead.has(current.baseRefName) && !seen.has(byHead.get(current.baseRefName).number)) {
      current = byHead.get(current.baseRefName);
      chain.unshift(current);
      seen.add(current.number);
    }
    // Walk down from the root to collect the full chain, in base-first order.
    const full = [...chain];
    const downSeen = new Set(chain.map((p) => p.number));
    let tail = chain[chain.length - 1];
    for (;;) {
      const next = list.find((p) => p.baseRefName === tail.headRefName && !downSeen.has(p.number));
      if (!next) break;
      full.push(next);
      downSeen.add(next.number);
      tail = next;
    }
    for (const p of full) visited.add(p.number);
    if (full.length >= 2) stacks.push(full);
  }
  stacks.sort((a, b) => (a[0]?.number ?? 0) - (b[0]?.number ?? 0));
  return stacks;
}

// Dependency-safe merge order: a PR merges only after the PR whose head
// branch it is based on. Depth 0 = base is main (or not an open PR's head);
// each stacked level adds one. Ties break by PR number for determinism.
// A dependency cycle (A based on B based on A) cannot be ordered safely, so
// orderMerges THROWS an Error naming the cycle instead of returning an
// order. Callers must surface the cycle as a founder item and merge nothing
// from the cyclic set.
export function orderMerges(prs) {
  const list = Array.isArray(prs) ? [...prs] : [];
  const byHead = new Map(list.map((pr) => [pr?.headRefName, pr]).filter(([k]) => k));
  const depthOf = (pr, trail = []) => {
    const base = byHead.get(pr?.baseRefName);
    if (!base || base === pr) return 0;
    if (trail.includes(pr.number)) {
      const cycle = [...trail, pr.number].join(" -> ");
      throw new Error(`PR dependency cycle detected: ${cycle}`);
    }
    return depthOf(base, [...trail, pr.number]) + 1;
  };
  const scored = list.map((pr) => ({ pr, depth: depthOf(pr) }));
  scored.sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth;
    return (a.pr?.number ?? 0) - (b.pr?.number ?? 0);
  });
  return scored.map(({ pr }) => pr);
}

// Normalize a `gh pr view --json` payload (or a partial one) into the lib
// snapshot shape. A lib-shaped snapshot passes through unchanged, except
// that `headRefOid` is accepted as an alias for `headSha`.
//
// This lives in the lib (not the CLI) because the workflow's inline node
// blocks call evaluateGate directly: they MUST normalize first. Calling
// evaluateGate on a raw `gh pr view` payload silently reads zero checks
// (`statusCheckRollup` is not `checks`), which mis-evaluates every PR as
// BLOCKED on "missing required check evidence" — and would have made the
// armed re-evaluation never reach MERGE_READY. See the regression test in
// scripts/__tests__/pr-commander-gate.test.mjs.
export function normalizeSnapshot(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Snapshot must be a JSON object");
  }
  const checks = [];
  const rollup = raw.statusCheckRollup;
  if (Array.isArray(rollup)) {
    for (const entry of rollup) {
      if (entry && typeof entry.name === "string") {
        checks.push({ name: entry.name, conclusion: entry.conclusion ?? null, status: entry.status ?? null });
      }
    }
  } else if (Array.isArray(raw.checks)) {
    for (const entry of raw.checks) {
      if (entry && typeof entry.name === "string") checks.push(entry);
    }
  }
  const threadsRaw = raw.reviewThreads;
  let threads = raw.threads ?? null;
  if (!threads && threadsRaw) {
    const nodes = Array.isArray(threadsRaw.nodes) ? threadsRaw.nodes : Array.isArray(threadsRaw) ? threadsRaw : [];
    threads = {
      total: nodes.length,
      unresolved: nodes.filter((t) => t?.isResolved !== true).length,
    };
  }
  const filesRaw = raw.files ?? [];
  const files = filesRaw.map((f) => (typeof f === "string" ? f : f?.path ?? f?.filename ?? "")).filter(Boolean);
  const reviews = Array.isArray(raw.reviews)
    ? raw.reviews.map((r) => ({ state: r?.state ?? null, author: r?.author?.login ?? r?.author ?? null }))
    : [];
  return {
    number: raw.number ?? null,
    headSha: raw.headSha ?? raw.headRefOid ?? null,
    isDraft: Boolean(raw.isDraft),
    mergeStateStatus: raw.mergeStateStatus ?? null,
    mergeable: raw.mergeable ?? null,
    reviewDecision: raw.reviewDecision ?? null,
    checks,
    threads: threads ?? { total: 0, unresolved: 0 },
    reviews,
    baseRefName: raw.baseRefName ?? null,
    headRefName: raw.headRefName ?? null,
    files,
    attempts: Number.isInteger(raw.attempts) ? raw.attempts : undefined,
    adr009Record: Boolean(raw.adr009Record),
    prOnlyCategory: Boolean(raw.prOnlyCategory),
  };
}

function checkByName(snapshot) {
  const map = new Map();
  for (const check of Array.isArray(snapshot?.checks) ? snapshot.checks : []) {
    if (check && typeof check.name === "string") map.set(check.name, check);
  }
  return map;
}

function checkState(check) {
  if (!check) return "missing";
  const conclusion = (check.conclusion ?? "").toUpperCase();
  if (GREEN_CONCLUSIONS.has(conclusion)) return "green";
  if (FAILED_CONCLUSIONS.has(conclusion)) return "failed";
  const status = (check.status ?? "").toUpperCase();
  if (["QUEUED", "IN_PROGRESS", "PENDING", "EXPECTED", "WAITING"].includes(status)) return "pending";
  if (conclusion === "" || conclusion === null) return "pending";
  return "failed";
}

// Evaluate one PR snapshot against the merge bar.
//
//   evaluateGate(snapshot, opts) — opts = { armed } (optional).
//   The evaluator is armed unless opts says otherwise: omitting opts (or
//   passing { armed: true }) lets a ready snapshot return MERGE_READY;
//   { armed: false } returns DRY_RUN_ONLY instead. The dry-run default of
//   the Commander as a whole lives in the callers (workflow evaluate job
//   and CLI), which always pass `armed` explicitly.
//
// Snapshot shape:
//   { number, headSha, isDraft, mergeStateStatus, mergeable, reviewDecision,
//     checks: [{ name, conclusion, status? }], threads: { total, unresolved },
//     reviews: [{ state, author? }], baseRefName, headRefName, files[],
//     attempts?, adr009Record?, prOnlyCategory? }
//
// Verdicts (worst-first precedence: BLOCKED_ESCALATED > BLOCKED >
// REPAIRABLE > DRY_RUN_ONLY / MERGE_READY):
//   MERGE_READY       — every gate passes AND the evaluation is armed.
//   DRY_RUN_ONLY      — every gate passes but the evaluation is not armed:
//                       the PR would be merge-ready; nothing may be merged.
//   REPAIRABLE        — a repairable defect: a failing check, unresolved
//                       review threads, or a behind branch (rebase).
//   BLOCKED           — a hard stop: draft, conflict, missing/pending
//                       required-check evidence, a standing CHANGES_REQUESTED
//                       review, an ADR-009 record required but absent, or a
//                       protected change needing a founder decision.
//                       Never auto-mergeable from here.
//   BLOCKED_ESCALATED — repair attempts exhausted (3 per head); stop.
//
// The ADR-009 requirement is derived from snapshot.files: migration files
// trigger it (as does an explicit prOnlyCategory flag). A standing change
// request is read from reviewDecision and/or a CHANGES_REQUESTED entry in
// reviews. Both cases are BLOCKED with a founderItem naming the dismissal
// (for CHANGES_REQUESTED) or the ADR-009 item — the Commander never
// dismisses a review and never fabricates an ADR-009 record.
//
// The review gate is ONLY the absence of a standing CHANGES_REQUESTED: the
// live ruleset requires zero approving reviews, so a null/absent
// reviewDecision (or REVIEW_REQUIRED) does not block on its own. What blocks
// for lack of review is the ADR-009 requirement, which comes from the
// changed files — not from the review state.
//
// MERGE_READY / DRY_RUN_ONLY require all of: valid head SHA; non-draft;
// mergeable MERGEABLE; merge state CLEAN; all four required checks green;
// zero unresolved threads; no standing CHANGES_REQUESTED; no protected
// RLS/auth/staging change; no ADR-009 requirement left unrecorded; fewer
// than 3 repair attempts. A non-main base does not change the verdict —
// merge ordering is enforced separately by orderMerges() in the workflow —
// but it is recorded as a reason and a next action.
export function evaluateGate(snapshot, opts = {}) {
  const armed = opts?.armed !== false;
  const reasons = [];
  const nextActions = [];
  const founderItems = [];
  const headSha = headVerdictKey(snapshot);
  const attempts = Number.isInteger(snapshot?.attempts) && snapshot.attempts >= 0
    ? snapshot.attempts
    : 0;

  let verdict = "MERGE_READY";
  const demote = (candidate) => {
    const rank = {
      MERGE_READY: 0,
      DRY_RUN_ONLY: 0,
      REPAIRABLE: 1,
      BLOCKED: 2,
      BLOCKED_ESCALATED: 3,
    };
    if (rank[candidate] > rank[verdict]) verdict = candidate;
  };

  if (!headSha) {
    reasons.push("Head SHA unavailable or invalid — no evidence can be trusted for this PR.");
    nextActions.push("Re-read the PR snapshot and re-evaluate once the exact head SHA is known.");
    return { verdict: "BLOCKED", reasons, nextActions, founderItems, headSha: null };
  }

  if (attempts >= MAX_REPAIR_ATTEMPTS) {
    reasons.push(
      `Repair attempts exhausted (${attempts} of ${MAX_REPAIR_ATTEMPTS} on head ${headSha}); persistent failure.`,
    );
    nextActions.push("Stop automatic repair for this head; escalate to the founder with the failure evidence.");
    founderItems.push(
      `PR #${snapshot?.number ?? "?"}: repair attempts exhausted on ${headSha}; decide whether to abandon, re-scope, or hand-repair it.`,
    );
    return { verdict: "BLOCKED_ESCALATED", reasons, nextActions, founderItems, headSha };
  }

  if (snapshot?.isDraft) {
    reasons.push("PR is a draft; drafts never merge.");
    nextActions.push("Complete the implementation and required evidence, then surface as ready-to-undraft for the founder.");
    founderItems.push(
      `PR #${snapshot?.number ?? "?"}: undraft decision is founder-only; undraft only when READY.`,
    );
    demote("BLOCKED");
  }

  const mergeable = snapshot?.mergeable;
  const mergeState = snapshot?.mergeStateStatus;
  if (mergeable === "CONFLICTING" || mergeState === "DIRTY") {
    reasons.push(
      "Branch conflicts with its base (merge state DIRTY/CONFLICTING). A conflicting branch gets no pull_request CI runs at all, so missing CI must not be read as green.",
    );
    nextActions.push("Route the conflict to human resolution; do not rebase or force-push on the Commander's authority.");
    demote("BLOCKED");
  } else if (mergeState === "BEHIND") {
    reasons.push("Branch is behind its base; strict required checks require a current branch.");
    nextActions.push("Rebase onto the base via the governed pr-maintenance workflow (armed runs only), then re-evaluate at the new head.");
    demote("REPAIRABLE");
  } else if (mergeState === "BLOCKED") {
    reasons.push("GitHub reports merge state BLOCKED.");
    nextActions.push("Read the blocking check or review state at the exact head and clear the underlying cause.");
    demote("BLOCKED");
  } else if (mergeState === "UNKNOWN") {
    reasons.push("Merge state UNKNOWN — mergeability evidence is incomplete.");
    nextActions.push("Re-read mergeability at the exact head before any further decision.");
    demote("BLOCKED");
  } else if (mergeState === "HAS_HOOKS") {
    reasons.push("Merge state HAS_HOOKS — pre-merge hooks are still running.");
    nextActions.push("Wait for hooks to settle, then re-read all evidence at the exact head.");
    demote("BLOCKED");
  }

  // ADR-009 requirement is derived from the changed files: migration files
  // trigger it (as does an explicit PR-only category flag). RLS / auth /
  // protected-staging changes are founder decisions in their own right:
  // ADR-009 covers the merge-review requirement only, never product,
  // security, or operational decisions — so those stay BLOCKED even with an
  // ADR-009 record, until the founder decides.
  const files = classifyPrFiles(snapshot?.files ?? []);
  const adr009Required = files.migrations || snapshot?.prOnlyCategory === true;
  const protectedKinds = [];
  if (files.rls) protectedKinds.push("row-level security");
  if (files.auth) protectedKinds.push("authentication/authorization");
  if (files.protectedStaging) protectedKinds.push("protected staging/migration workflow");
  if (protectedKinds.length > 0) {
    reasons.push(`PR touches protected surface(s): ${protectedKinds.join(", ")}.`);
    nextActions.push("Do not apply migrations or change auth/RLS on the Commander's authority; route to the founder with the file list.");
    founderItems.push(
      `PR #${snapshot?.number ?? "?"}: protected change (${protectedKinds.join(", ")}) needs the founder's word; staging-apply clicks, migration applies, and auth/RLS decisions are founder-only.`,
    );
    demote("BLOCKED");
  }
  if (adr009Required && !snapshot?.adr009Record) {
    reasons.push(
      "ADR-009 record required but absent: the PR touches migration files or is in a PR-only/human-decision category, and no complete founder-exception record is present.",
    );
    nextActions.push("Complete the ADR-009 record in the PR (founder authorization, reason independent review is unavailable, risk boundaries, rollback plan, final head, follow-up owner) or obtain an independent review.");
    founderItems.push(
      `PR #${snapshot?.number ?? "?"}: ADR-009 record required — complete the founder-exception record or obtain independent review before merge.`,
    );
    demote("BLOCKED");
  }

  const checks = checkByName(snapshot);
  const failedRequired = [];
  const pendingRequired = [];
  const missingRequired = [];
  for (const name of REQUIRED_CHECKS) {
    const state = checkState(checks.get(name));
    if (state === "failed") failedRequired.push(name);
    else if (state === "pending") pendingRequired.push(name);
    else if (state === "missing") missingRequired.push(name);
  }
  if (missingRequired.length > 0) {
    reasons.push(
      `Required check evidence missing for: ${missingRequired.join(", ")}. Missing CI is not green — a conflicting or not-yet-run branch reports nothing.`,
    );
    nextActions.push("Re-read the check rollup at the exact head; if the branch conflicts, resolve the conflict first.");
    demote("BLOCKED");
  }
  if (pendingRequired.length > 0) {
    reasons.push(`Required check(s) still pending at head ${headSha}: ${pendingRequired.join(", ")}.`);
    nextActions.push("Wait for CI to settle, then re-read all evidence at the exact head; never merge on pending checks.");
    demote("BLOCKED");
  }
  if (failedRequired.length > 0) {
    reasons.push(`Required check(s) failing at head ${headSha}: ${failedRequired.join(", ")}.`);
    nextActions.push("Repair the deterministic root cause on the PR branch, add a regression test for any behavior change, re-run the failing check, and re-evaluate at the new head.");
    demote("REPAIRABLE");
  }
  const failedOther = [];
  for (const [name, check] of checks) {
    if (!REQUIRED_CHECKS.includes(name) && checkState(check) === "failed") failedOther.push(name);
  }
  if (failedOther.length > 0) {
    reasons.push(`Non-required check(s) failing: ${failedOther.join(", ")}.`);
    nextActions.push("Repair the failing check or confirm with evidence that it is out of scope before merge.");
    demote("REPAIRABLE");
  }

  const unresolved = snapshot?.threads?.unresolved ?? 0;
  if (unresolved > 0) {
    reasons.push(`${unresolved} unresolved review thread(s) (of ${snapshot?.threads?.total ?? "?"} total).`);
    nextActions.push("Address each finding on the PR branch, verify the correction, and resolve the thread only after the fix is verified on the current head. The Commander never auto-resolves a thread in v1 (see implementation note).");
    demote("REPAIRABLE");
  }

  const reviewDecision = snapshot?.reviewDecision ?? null;
  const reviews = Array.isArray(snapshot?.reviews) ? snapshot.reviews : [];
  const changesRequested = reviews.some((r) => r?.state === "CHANGES_REQUESTED");
  if (reviewDecision === "CHANGES_REQUESTED" || changesRequested) {
    reasons.push(
      "A blocking CHANGES_REQUESTED review stands (possibly a stale CodeRabbit review on a superseded head).",
    );
    nextActions.push("Address the findings and request CodeRabbit re-review after the repair push; if the review is stale on a superseded head, surface it for the founder's dismissal word.");
    founderItems.push(
      `PR #${snapshot?.number ?? "?"}: standing CHANGES_REQUESTED review — dismissal is founder-only; the Commander never dismisses a blocking review.`,
    );
    demote("BLOCKED");
  }
  // NOTE: a null/absent reviewDecision (or REVIEW_REQUIRED) does not block:
  // the live ruleset requires zero approving reviews. The ADR-009
  // requirement comes from the changed files (above), not from review state.

  if (snapshot?.baseRefName && snapshot.baseRefName !== "main") {
    reasons.push(
      `Stacked PR: base is '${snapshot.baseRefName}', not 'main'. Merge only after the base PR lands (dependency order via orderMerges()).`,
    );
    nextActions.push("Hold auto-merge until the base PR has merged, even if this PR is otherwise ready.");
  }

  if (verdict === "MERGE_READY") {
    if (armed) {
      reasons.push(
        `All gates pass at head ${headSha}: non-draft, mergeable, current, all four required checks green, zero unresolved threads, review satisfied.`,
      );
      nextActions.push(`Enable auto-merge (gh pr merge --auto --squash) only after re-reading the head immediately before merging; merge SHA must be ${headSha}.`);
    } else {
      reasons.push(
        `All gates pass at head ${headSha}, but the run is not armed: dry-run only, no merge will be enabled.`,
      );
      nextActions.push(`Arm the run (repository variable ${ARMED_VARIABLE}=true plus a workflow_dispatch with mode=armed) to enable auto-merge at head ${headSha} after a fresh re-read.`);
      verdict = "DRY_RUN_ONLY";
    }
  }

  // Keep the returned object to the contracted shape plus the head it stands on.
  return { verdict, reasons, nextActions, founderItems, headSha };
}

// ---------------------------------------------------------------------------
// AI repair worker (Phase 4) — Codex mention trigger.
//
// The Commander never runs an AI agent itself. The worker is a single
// mechanical trigger: the armed `act` job posts a `@codex address that
// feedback` comment on a REPAIRABLE PR, and the already-installed
// ChatGPT Codex GitHub app (contents:write, pull_requests:write —
// verified live 2026-11-11) does the repair work in its own cloud
// environment and pushes the fix to the PR branch. The Commander then
// re-evaluates the new head on its next run: fresh CI, fresh verdict.
//
// What is verified vs assumed (2026-11-11):
//   - VERIFIED: Codex is installed on this repo (selected repos) and
//     reviews PRs automatically (review 5865476212 on PR #968). Its own
//     review receipt documents the triggers: PR open / draft ready /
//     "@codex review", and "@codex address that feedback" to update a PR.
//   - UNCONFIRMED until the end-to-end validation run observes it: that
//     Codex pushes a fix commit to a PR branch in THIS repo, and that it
//     responds to a mention posted by github-actions[bot] (as opposed to
//     a human). Zero commits by chatgpt-codex-connector[bot] exist in
//     this repo. Do not claim the push works until it is observed.
//   - Copilot is UNAVAILABLE (0 seats, verified live) and is not a path.
//   - The Claude GitHub app is installed org-wide but has no repo wiring
//     and zero observed activity on TradeOS — not a path either.
//
// Safety invariants (encoded in isAiRepairEligible + the workflow):
//   - At most ONE AI invocation per exact head SHA (ai-repair marker in
//     the verdict comment, same pattern as repair-attempts). A new head
//     resets it. An invocation counts as one of the 3 repair attempts.
//   - Same-repo PRs only (Codex cannot push to a fork branch on the
//     Commander's authority, and the Commander never pushes to main).
//   - No protected files in the PR (migrations / RLS / auth / protected
//     staging, via classifyPrFiles — fail-closed). A PR touching those
//     surfaces is never handed to the AI worker.
//   - Never a draft, never a conflicting branch, never a behind branch
//     (a behind branch is rebased first; invoking Codex on a stale head
//     wastes the invocation and its push may conflict).
//   - The worker never approves, merges, dismisses a review, or resolves
//     a thread — the comment instructs Codex to do none of those, and the
//     Commander has no code path that does them on the worker's behalf.
//     The merge bar (green required checks, zero unresolved threads, no
//     standing change request) still decides every merge.
//   - The invocation is a PR comment (the audit trail): posted by
//     github-actions[bot], timestamped, carrying the exact instruction,
//     the failing check names, and the head SHA. The verdict comment
//     records `ai-repair:<sha>:<n>`.

// Marker identifying AI repair invocations on a head, carried by the
// Commander verdict comment (same pattern as repair-attempts).
export const AI_REPAIR_MARKER_PREFIX = "ai-repair:";

// Names of required + non-required checks whose conclusion is a failure
// (same failure set as checkState). Pure; used by the AI worker prompt so
// Codex is pointed at the exact failing check(s) instead of the whole run.
export function failedCheckNames(snapshot) {
  const names = [];
  const checks = Array.isArray(snapshot?.checks) ? snapshot.checks : [];
  for (const check of checks) {
    if (!check || typeof check.name !== "string") continue;
    const conclusion = (check.conclusion ?? "").toUpperCase();
    if (FAILED_CONCLUSIONS.has(conclusion)) names.push(check.name);
  }
  return names;
}

// Whether the AI repair worker may be invoked for this PR at this head.
// Pure and fail-closed: every unknown or unsafe input yields ineligible.
// `input` shape:
//   { files, isDraft, mergeable, mergeStateStatus, failedChecks: string[],
//     unresolvedThreads: number, attempts: number, aiInvocations: number,
//     sameRepo: boolean }
// `attempts` is the per-head repair-attempt count (deterministic + rebase +
// AI share the cap of 3); `aiInvocations` is the per-head AI count (cap 1).
export function isAiRepairEligible(input = {}) {
  const reasons = [];
  const files = classifyPrFiles(input?.files ?? []);
  if (input?.isDraft === true) reasons.push("PR is a draft; the AI worker never runs on a draft.");
  const mergeable = input?.mergeable;
  const mergeState = input?.mergeStateStatus;
  if (mergeable === "CONFLICTING" || mergeState === "DIRTY") {
    reasons.push("Branch conflicts with its base; conflicts are routed to human resolution.");
  }
  if (mergeState === "BEHIND") {
    reasons.push("Branch is behind its base; rebase first — invoking Codex on a stale head wastes the invocation.");
  }
  if (files.migrations || files.rls || files.auth || files.protectedStaging) {
    const kinds = [];
    if (files.migrations) kinds.push("migrations");
    if (files.rls) kinds.push("row-level security");
    if (files.auth) kinds.push("authentication/authorization");
    if (files.protectedStaging) kinds.push("protected staging");
    reasons.push(`PR touches protected surface(s): ${kinds.join(", ")}. The AI worker never touches those.`);
  }
  if (input?.sameRepo !== true) reasons.push("PR is from a fork; the AI worker runs on same-repo branches only.");
  const attempts = Number.isInteger(input?.attempts) && input.attempts >= 0 ? input.attempts : 0;
  if (attempts >= MAX_REPAIR_ATTEMPTS) {
    reasons.push(`Repair attempts exhausted (${attempts} of ${MAX_REPAIR_ATTEMPTS} on this head).`);
  }
  const aiInvocations = Number.isInteger(input?.aiInvocations) && input.aiInvocations >= 0 ? input.aiInvocations : 0;
  if (aiInvocations >= 1) reasons.push("The AI worker was already invoked once on this head; at most one invocation per head.");
  const failedChecks = Array.isArray(input?.failedChecks) ? input.failedChecks : [];
  const unresolvedThreads = Number.isInteger(input?.unresolvedThreads) && input.unresolvedThreads >= 0
    ? input.unresolvedThreads
    : 0;
  if (failedChecks.length === 0 && unresolvedThreads === 0) {
    reasons.push("Nothing for the AI worker to address: no failing check and no unresolved review thread.");
  }
  return { eligible: reasons.length === 0, reasons };
}

// The exact comment the Commander posts to invoke Codex on a PR.
// Pure: the caller fills in the failing check names, the unresolved-thread
// count, the head SHA, and the run URL. The trigger phrase is the one
// Codex's own review receipt documents ("@codex address that feedback").
// The scope limits and prohibitions are part of the instruction, not
// commentary: the worker must not exceed them, and the merge bar still
// decides the merge regardless of what Codex pushes.
export function buildAiRepairComment(input = {}) {
  const pr = input?.pr ?? "?";
  const headSha = input?.headSha ?? "unknown";
  const failingChecks = Array.isArray(input?.failingChecks) ? input.failingChecks : [];
  const unresolvedThreads = Number.isInteger(input?.unresolvedThreads) && input.unresolvedThreads >= 0
    ? input.unresolvedThreads
    : 0;
  const runUrl = input?.runUrl ?? "";
  const lines = [
    "<!-- tradeos-pr-commander-ai-repair -->",
    "@codex address that feedback",
    "",
    `PR Commander (automated repair worker): the required check(s) ${failingChecks.length ? failingChecks.map((c) => "`" + c + "`").join(", ") : "(none failing — see review threads)"} are failing on PR #${pr} at head \`${headSha}\`.`,
  ];
  if (runUrl) lines.push(`Failing CI: ${runUrl}`);
  if (unresolvedThreads > 0) lines.push(`${unresolvedThreads} unresolved review thread(s) also stand on this PR.`);
  lines.push(
    "",
    "Please make the minimal fix for the failing check(s): identify the root cause from the failing check log, implement the narrowly scoped fix, and add or update a regression test that fails before the fix and passes after it. Run the relevant unit tests and lint/build before pushing.",
    "",
    "Scope limits (do not exceed them):",
    "- Touch only the files needed for this fix. Do not modify migrations, authentication/authorization, row-level security, workflow files, or production configuration.",
    "- Push the fix to this PR's branch only — never to main.",
    "- Do not approve this PR, merge it, dismiss any review, or resolve any review thread. A human re-review and the required checks decide the merge.",
    "- If the failure is a chain dependency (a missing table, type, or module that only lands when another PR merges) rather than a defect in this PR, say so in a comment and push nothing.",
    "",
    "The Commander re-evaluates this PR on its next run: a new push creates a new head, fresh CI runs, and the verdict is recomputed.",
  );
  return lines.join("\n");
}
