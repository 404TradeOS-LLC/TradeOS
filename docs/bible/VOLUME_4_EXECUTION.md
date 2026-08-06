---
status: current
owner: platform
last_verified: 2026-08-06
source_of_truth: true
---

# TradeOS Bible — Volume 4: Execution

## Purpose

This volume defines how TradeOS work moves from idea to merged, verified, documented, releasable product. It is the operating playbook for the founder, Claude, Codex, and future contributors.

The goal is not process for its own sake. The goal is sustained forward motion without losing product truth, duplicating work, corrupting scope, or depending on memory from a prior chat session.

## 1. Execution doctrine

TradeOS execution follows these laws:

1. truth lives in the repository and live GitHub state, not chat memory;
2. work is divided into narrow, independently verifiable sprints;
3. one sprint maps to one branch, one worktree, and one pull request;
4. agents inspect existing work before creating new work;
5. implementation, tests, documentation, and handoff move together;
6. consequential ambiguity stops execution instead of being silently invented;
7. merged evidence, not confidence language, marks work complete;
8. automation may prepare and verify work, but governance gates remain explicit;
9. parallel work is permitted only when file scope and dependencies do not overlap;
10. every completed mission leaves the repository easier to resume than it was before.

## 2. Source-of-truth hierarchy

When sources disagree, use this order:

1. current merged runtime behavior and database state;
2. current GitHub PR, branch, ruleset, and CI state;
3. canonical repository documents;
4. accepted architecture decision records;
5. sprint backlog and session handoff;
6. issue and PR descriptions;
7. prior chat summaries and informal notes.

An agent must correct lower-ranked sources when stronger evidence proves them stale.

## 3. Canonical execution documents

The execution system is distributed intentionally:

- `docs/TRADEOS_BIBLE.md` — operating index;
- `docs/SPRINT_BACKLOG.md` — executable numbered queue;
- `docs/ENGINEERING_COMMAND_CENTER.md` — current phase, priorities, blockers, and operating context;
- `docs/CURRENT_STATE.md` — verified product and technical baseline;
- `docs/SESSION_HANDOFF.md` — concise resumption point;
- `docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md` — mechanical sprint-selection procedure;
- `docs/REPOSITORY_GOVERNANCE.md` — branch, PR, worktree, and merge policy;
- `AGENTS.md` — repository-wide agent instructions;
- `docs/DOC_OWNERSHIP.yml` — documentation update obligations.

No single document should duplicate every detail from the others.

## 4. Strategic roadmap versus executable backlog

`docs/ROADMAP.md` explains direction, phases, and major outcomes.

`docs/SPRINT_BACKLOG.md` defines the next mergeable unit of work.

Broad roadmap language does not override the numbered sprint queue unless:

- a dependency changed;
- a new release blocker appeared;
- an open PR created overlap;
- infrastructure became unavailable;
- a security issue requires emergency priority;
- the founder made an explicit product decision;
- repository evidence proves the planned sprint obsolete.

Any reprioritization must be recorded, not merely stated in chat.

## 5. Sprint status vocabulary

Only these statuses are valid:

- `DONE` — merged evidence exists and completion criteria passed;
- `IN_REVIEW` — implementation is in an open PR or formal review state;
- `READY` — dependencies are satisfied, scope is unoccupied, and execution can begin;
- `BLOCKED` — a specific dependency, infrastructure gap, or decision prevents work;
- `PLANNED` — valid future work whose dependencies are not yet complete;
- `DEFERRED` — intentionally postponed beyond the active execution horizon;
- `CANCELLED` — no longer part of the product plan.

Confidence, local commits, passing local tests, or a pushed branch do not qualify as `DONE`.

## 6. Definition of Ready

A sprint may be marked `READY` only when all of the following are true:

- its objective is understandable;
- dependencies are merged or verifiably available;
- allowed and forbidden paths are defined;
- no open PR or active worktree overlaps the scope;
- required tests are named;
- acceptance criteria are testable;
- product language and lifecycle expectations are clear;
- necessary infrastructure is available or not required;
- no unresolved founder decision blocks implementation;
- the expected branch and PR shape are known.

If any requirement is missing, the sprint remains `PLANNED` or becomes `BLOCKED`.

## 7. Definition of Done

A sprint is `DONE` only when:

- its PR is merged;
- required CI checks passed on the merged change;
- the final diff stayed within scope;
- acceptance criteria have evidence;
- required source-of-truth docs were updated;
- migrations or deployment steps are recorded where applicable;
- known residual risk is documented;
- the sprint record contains PR and merge evidence;
- the session handoff identifies the next safe action;
- no unresolved review thread materially affects the change.

“Ready to merge” is not “done.”

## 8. Sprint sizing

A sprint should normally fit into one reviewable PR.

A sprint is too large when it combines multiple independent product decisions, spans unrelated modules, or makes review impossible without broad architecture reconstruction.

Large initiatives must be decomposed into:

- contract or schema preparation;
- backend behavior;
- frontend behavior;
- integration and migration work;
- documentation and rollout verification;
- follow-up hardening.

A sprint is too small when it creates administrative overhead without producing a useful, verifiable outcome.

## 9. Sprint selection doctrine

Autonomous execution selects the lowest-numbered eligible `READY` sprint,
executes exactly one sprint in an isolated branch and worktree, and stops after
handoff. The sole executable selection sequence is the
[Sprint Selection and Execution](../agent-prompts/NEXT_SPRINT_PROTOCOL.md#sprint-selection-and-execution)
section of the Next Sprint Protocol. If no sprint qualifies, the agent reports
the exact blocker instead of inventing work.

## 10. Founder command

The normal founder instruction is:

> Run the next TradeOS sprint.

The agent is responsible for resolving the next eligible sprint from repository evidence.

The founder should not need to manufacture a technical prompt when a valid `READY` sprint exists.

## 11. Founder decisions

An agent must request a founder decision when work changes:

- target customer or market positioning;
- pricing or packaging;
- product scope or module boundaries;
- consequential AI autonomy;
- legal or contractual behavior;
- customer-visible lifecycle meaning;
- security posture or risk acceptance;
- irreversible data migration behavior;
- branding direction;
- launch timing or beta commitments.

Agents should not ask the founder to decide routine implementation details already governed by architecture, tests, or existing product doctrine.

## 12. Branch policy

Branch names should communicate intent:

- `feature/<mission>`;
- `fix/<mission>`;
- `docs/<mission>`;
- `chore/<mission>`;
- `security/<mission>`.

Rules:

- branch from the verified intended base;
- do not perform feature work directly on `main`;
- do not reuse stale branches for unrelated missions;
- do not rewrite shared history casually;
- use `--force-with-lease` only when a legitimate rebase requires it and remote state is reverified;
- never use plain `--force`;
- delete merged branches only after worktree and dependency review.

## 13. Worktree policy

Each active mission should have its own linked worktree.

A worktree is occupied territory when another agent, IDE window, or active process may be using it.

Before creating a worktree:

- fetch origin;
- inspect `git worktree list`;
- confirm the target directory does not exist;
- confirm the branch is not checked out elsewhere;
- confirm the mission does not overlap an active PR.

Never repair, prune, reset, or delete another mission’s worktree without explicit scope and evidence.

Use a fresh worktree when:

- an existing path has safety-classifier problems;
- branch state is uncertain;
- another process may be active;
- a review should be isolated from implementation;
- stale metadata could contaminate the mission.

## 14. Parallel-agent coordination

Parallel work is encouraged when it is genuinely independent.

Before parallelizing, define for every lane:

- mission;
- branch;
- worktree;
- allowed files;
- forbidden files;
- dependencies;
- expected PR;
- stop conditions.

Parallel-safe examples:

- one agent expands Product documentation while another expands Engineering documentation;
- one agent repairs a frontend bug while another performs a docs-only roadmap audit;
- one agent runs a security diff review while another works on a non-overlapping product module.

Unsafe examples:

- two agents editing the same source-of-truth document;
- two branches implementing the same feature;
- one agent rebasing a branch while another pushes to it;
- frontend and backend agents independently changing a shared contract without coordination;
- one agent cleaning worktrees while another is using them.

## 15. Conductor responsibility

The coordinating agent or founder must maintain a mission map containing:

- active lane;
- assigned agent;
- branch and worktree;
- PR number;
- occupied paths;
- dependency state;
- expected completion evidence.

When overlap is discovered, stop one lane and redirect it to review, validation, or a different volume rather than allowing competing implementations.

## 16. Agent startup doctrine

No editing begins until repository identity, authority, live overlap, mission
scope, validation, documentation impact, and stop conditions are known. The
sole executable sequence and required evidence are defined by the
[Canonical Startup Flow](../agent-prompts/NEXT_SPRINT_PROTOCOL.md#canonical-startup-flow).

## 17. Agent completion doctrine

Every agent proves scope, validation, documentation, repository state, and the
next safe action before handoff. The sole executable sequence is the
[Canonical Completion Flow](../agent-prompts/NEXT_SPRINT_PROTOCOL.md#canonical-completion-flow).

## 18. Founder Summary doctrine

Completion reports expose outcomes, evidence, blocked checks, repository and
PR state, residual risk, and the backlog-derived next safe action. The
canonical completion flow owns the exact report contract; supporting documents
must not restate it or hide blocked validation in narrative text.

## 19. Pull request lifecycle

Repository Governance owns the operational PR and worktree lifecycle. Durable
execution invariants are: implementation remains scoped; draft publication
precedes `IN_REVIEW`; required checks and review precede merge; merge evidence
precedes `DONE`; and verified merge precedes cleanup.

## 20. Draft PR policy

Open a draft PR when:

- implementation is pushed but validation remains;
- external infrastructure verification is pending;
- review feedback is expected before final polish;
- the branch needs visible coordination to prevent duplicate work.

A draft PR must still have a useful title, summary, scope, validation state, and remaining risks.

Do not use draft status to conceal an undefined mission.

## 21. PR description standard

Every PR should state:

- the user or engineering problem;
- the chosen solution;
- changed modules or files;
- explicit exclusions;
- migration or deployment implications;
- security implications;
- test results with exact counts where available;
- blocked or unperformed verification;
- remaining risks.

Avoid claims such as “fully verified,” “signed URL,” “live tested,” or “production ready” unless evidence supports them precisely.

## 22. Review standard

Review is evidence-driven.

A reviewer must inspect:

- behavior and edge cases;
- authorization and tenancy;
- validation;
- lifecycle correctness;
- transaction and retry behavior;
- accessibility and responsive behavior for UI;
- schema and migration safety;
- docs consistency;
- scope discipline;
- test adequacy;
- misleading PR claims.

Review conclusions:

- approve technically;
- request concrete changes;
- comment with non-blocking concerns;
- stop for founder or architecture decision.

## 23. Solo-maintainer governance

TradeOS may operate with one human maintainer.

The recommended protected workflow is:

- PR required;
- required CI checks enabled;
- branch up-to-date requirement enabled where practical;
- conversation resolution required;
- linear history maintained;
- force pushes and deletions protected;
- required human approvals set to zero when no independent maintainer exists.

Automation and documented self-audit replace a fictional second engineer; they do not replace tests or PR visibility.

## 24. Required status checks

The expected repository checks are:

- `Docs consistency`;
- `App lint, unit tests, and build`;
- `App integration tests`;
- `Web lint and build`.

A ruleset must use the actual job names recognized by GitHub, not merely a workflow grouping name.

Required checks may evolve, but the Command Center and governance docs must be updated when they do.

## 25. Local validation policy

Run the repository’s actual scripts. Do not invent substitute commands.

Typical validation includes:

- focused unit tests;
- complete package tests;
- integration tests;
- lint;
- type checking or build;
- documentation tests;
- documentation ownership checks;
- `git diff --check`;
- browser verification when claimed or required.

A local pass does not permit claiming CI is green before GitHub reports success.

## 26. Browser verification

Browser verification must be described honestly:

- exact environment;
- authenticated or unauthenticated path;
- screen sizes checked;
- workflows completed;
- console or network errors observed;
- data source used;
- infrastructure limitations.

Do not claim a live walkthrough when only source inspection or build verification occurred.

## 27. External infrastructure verification

Some behavior requires real services:

- Supabase Auth;
- Supabase Storage;
- production RLS;
- email or SMS providers;
- payment providers;
- deployment environments;
- DNS and public URLs;
- third-party integrations.

When unavailable:

- run the strongest local equivalent;
- document the exact blocked proof;
- keep the PR draft if the missing proof is required;
- do not weaken authentication or production controls to create an artificial test path.

## 28. Documentation ownership

Implementation and source-of-truth documentation move together according to `docs/DOC_OWNERSHIP.yml`.

Docs updates should explain current truth, not narrate every code edit.

The Bible changes only when doctrine, product definition, operating policy, or long-term execution rules change.

`CURRENT_STATE.md` changes when verified implementation state changes.

`SESSION_HANDOFF.md` changes whenever the next engineer’s resumption point changes.

## 29. Session handoff standard

A handoff is concise, current, and replaceable.

It must answer:

- what just landed or remains open;
- current branch and PR state;
- tests and blockers;
- occupied worktrees;
- next eligible sprint;
- why it is eligible;
- dependencies;
- overlapping PRs checked;
- exact startup prompt or command.

It must not become a permanent chronological journal.

## 30. Stop conditions

An agent stops without pushing or merging when:

- remote branch state moved unexpectedly;
- scope overlap appears;
- an unplanned runtime file changes;
- a product decision is required;
- architecture is ambiguous;
- required tests fail;
- infrastructure proof remains mandatory and unavailable;
- a destructive command lacks clear authorization;
- a safety restriction blocks a necessary step;
- conflict resolution would discard newer source-of-truth behavior;
- the mission would require silently expanding scope.

Stopping correctly is successful execution, not failure.

## 31. Conflict-resolution policy

During rebase or merge conflict resolution:

- identify which side contains newer verified behavior;
- preserve current main’s source-of-truth facts;
- preserve branch intent only where still accurate;
- avoid resolving runtime conflicts in a docs-only mission;
- stop when resolution requires a product decision;
- rerun the full required validation afterward;
- use `--force-with-lease`, never plain `--force`, when rewritten history must update the PR branch.

## 32. Bug workflow

For a verified bug:

1. reproduce or establish evidence;
2. define expected behavior;
3. identify root cause;
4. create a focused fix branch;
5. add the narrowest meaningful regression test;
6. fix without unrelated cleanup;
7. validate affected workflows;
8. document residual risk;
9. open a focused PR.

Do not convert a bug fix into an architecture rewrite unless the existing architecture makes a safe narrow fix impossible.

## 33. Feature workflow

For a feature:

1. verify it belongs in Vision, Product, and Roadmap;
2. confirm lifecycle, permissions, and tenancy expectations;
3. define acceptance criteria and exclusions;
4. prepare contracts or schema first when required;
5. implement backend and frontend through coordinated boundaries;
6. test happy paths, failures, permissions, and empty states;
7. update docs and onboarding implications;
8. verify migration and rollout posture;
9. open a draft PR early enough to expose overlap.

## 34. Research workflow

Research work must produce decisions or constraints, not just volume.

A research sprint should record:

- question;
- evidence sources;
- contractor or user signal;
- repository implications;
- product recommendation;
- assumptions;
- unresolved questions;
- implementation readiness;
- founder decisions required.

Research must not be presented as implemented product behavior.

## 35. Technical-debt workflow

Technical debt enters the sprint system only when it has:

- verified evidence;
- user, reliability, security, or development-cost impact;
- a bounded remediation path;
- acceptance criteria;
- priority relative to release goals.

Do not perform broad cleanup merely because files look old.

Dead code removal requires caller verification, dependency review, tests, and scope control.

## 36. Security workflow

Security findings require:

- evidence of the vulnerable path;
- tenancy and authorization analysis;
- severity calibration;
- narrow remediation;
- regression tests;
- migration or rollout consideration;
- explicit residual risk.

Security fixes take priority over normal sprint order when exploitation or cross-tenant exposure is plausible.

## 37. Architecture decision records

Create or update an ADR when a decision:

- changes module boundaries;
- introduces a new persistence pattern;
- changes tenancy or security posture;
- creates a long-lived integration contract;
- changes AI mutation policy;
- accepts meaningful technical risk;
- replaces a previously canonical approach.

An ADR records context, decision, alternatives, consequences, and status.

## 38. Release readiness

A release candidate requires:

- green required CI;
- migration review;
- environment and secrets verification;
- critical workflow checks;
- tenancy and RLS verification;
- customer document verification;
- portal verification;
- observability and rollback readiness;
- known-risk register;
- release notes;
- founder approval of remaining product risk.

## 39. Production deployment

A production deployment plan must identify:

- exact commit or release;
- migration order;
- backup or rollback strategy;
- environment variables and secrets;
- approval gates;
- monitoring window;
- smoke tests;
- owner for incident response;
- customer communication when required.

Deployment success cannot be inferred solely from a green build.

## 40. Rollback policy

Rollback planning depends on change type:

- application-only changes may revert to a prior deployment;
- additive migrations may permit application rollback;
- destructive or data-transforming migrations require explicit forward and reverse strategy;
- external side effects may need compensating actions;
- customer-visible documents may require correction rather than deletion.

Never claim rollback safety without considering database and external effects.

## 41. Incident response

For an incident:

1. stabilize impact;
2. preserve evidence;
3. identify affected organizations and workflows;
4. stop risky deployments;
5. communicate current facts without speculation;
6. apply the narrowest safe mitigation;
7. verify recovery;
8. document timeline and root cause;
9. create follow-up sprints;
10. update doctrine if the incident exposed a process failure.

## 42. Emergency changes

Emergency work may bypass normal sprint order but not truth or evidence.

An emergency change still requires:

- a dedicated branch;
- focused diff;
- available tests;
- explicit risk statement;
- PR visibility;
- post-merge follow-up;
- handoff and incident record.

## 43. Beta execution

Beta rollout should proceed in controlled cohorts.

Each beta cycle must define:

- participating contractors;
- enabled workflows;
- onboarding owner;
- migration or seed data;
- success metrics;
- support channel;
- issue severity policy;
- feedback capture;
- rollback or disable path;
- next-cycle decision.

Beta feedback becomes evidence for backlog reprioritization, not an uncontrolled stream of immediate feature additions.

## 44. Customer feedback loop

Feedback is classified as:

- bug;
- usability friction;
- missing workflow;
- misunderstanding or onboarding gap;
- performance issue;
- integration request;
- feature idea;
- strategic signal.

Repeated pain in a core workflow outranks isolated requests for peripheral features.

## 45. Founder daily operating rhythm

A useful daily review should answer:

- what merged;
- what is in review;
- what is blocked;
- what checks failed;
- what founder decisions are waiting;
- what the next eligible sprint is;
- whether parallel work remains non-overlapping;
- what product or customer risk needs attention.

The founder should not need to reconstruct repository state from multiple agent transcripts.

## 46. Weekly engineering review

The weekly review should cover:

- merged sprint outcomes;
- backlog status transitions;
- open PR age and overlap;
- CI reliability;
- escaped defects;
- technical debt added and removed;
- security posture;
- beta or customer feedback;
- documentation drift;
- next week’s parallel lanes;
- founder decisions.

## 47. Monthly and quarterly review

Monthly:

- validate milestone progress;
- review performance and reliability trends;
- audit stale branches and worktrees;
- reconcile Current State and Roadmap;
- review infrastructure cost and operational gaps.

Quarterly:

- revalidate target customer and positioning;
- review competitive changes;
- adjust major roadmap phases;
- review pricing and packaging assumptions;
- evaluate architecture and staffing needs;
- retire or defer work that no longer serves the mission.

## 48. Metrics for execution quality

Track:

- sprint lead time;
- PR cycle time;
- CI pass rate;
- escaped defects;
- reopened work;
- blocked time;
- percentage of sprints with complete evidence;
- documentation consistency failures;
- overlap or duplicate-work incidents;
- rollback frequency;
- customer-impacting incidents;
- founder decision latency.

Metrics diagnose the system; they are not targets to game.

## 49. Execution anti-patterns

Prohibited patterns include:

- starting work without checking open PRs;
- creating duplicate architecture or duplicate feature branches;
- treating chat output as committed repository truth;
- mixing cleanup with feature implementation;
- claiming tests that were not run;
- claiming live verification from source inspection;
- changing governance to force one PR through without considering lasting policy;
- bypassing tenancy or auth to make a demo easier;
- opening broad PRs with unclear acceptance criteria;
- leaving stale handoffs after merge;
- marking work `DONE` before merge;
- silently changing founder intent;
- continuing after a stop condition.

## 50. Canonical execution checklist

Before work:

- [ ] fetch origin;
- [ ] verify repo, branch, worktree, HEAD, upstream, and cleanliness;
- [ ] read current source-of-truth docs;
- [ ] inspect open PRs, recent merges, and active worktrees;
- [ ] select one eligible sprint;
- [ ] define scope, tests, acceptance criteria, and stop conditions.

Before push:

- [ ] inspect full diff;
- [ ] confirm allowed paths only;
- [ ] run required validation;
- [ ] update required docs;
- [ ] fetch remote state again;
- [ ] confirm branch did not move unexpectedly;
- [ ] commit focused changes;
- [ ] push without unsafe force.

Before merge:

- [ ] PR description matches reality;
- [ ] required checks are green;
- [ ] review findings are resolved;
- [ ] branch is current as required;
- [ ] migrations and deployment implications are understood;
- [ ] remaining risks are explicit;
- [ ] merge method follows repository policy.

After merge:

- [ ] verify merge commit;
- [ ] sync local `main` with `--ff-only`;
- [ ] record sprint evidence;
- [ ] update handoff;
- [ ] identify next eligible sprint;
- [ ] clean branch and worktree only when safe.

## 51. Operating promise

TradeOS execution should make progress visible, reversible where practical, reviewable, and resumable.

No founder should have to remember which agent touched which branch, which test was skipped, or what comes next. The repository must answer those questions.

## Related sources

- `docs/SPRINT_BACKLOG.md`
- `docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md`
- `docs/ENGINEERING_COMMAND_CENTER.md`
- `docs/SESSION_HANDOFF.md`
- `docs/REPOSITORY_GOVERNANCE.md`
- `docs/DOC_OWNERSHIP.yml`
- `AGENTS.md`
