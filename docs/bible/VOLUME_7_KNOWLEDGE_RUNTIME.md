---
status: proposed
owner: platform
last_verified: 2026-07-16
source_of_truth: true
---

# TradeOS Bible — Volume 7: Knowledge Runtime

## Purpose

This volume defines how TradeOS knowledge is connected, selected, verified, updated, and handed to humans and AI agents. It prevents the Bible from becoming another pile of documents by establishing one subject owner, explicit evidence links, current-state boundaries, and mechanical work selection.

The Knowledge Runtime is not a chatbot, vector database, or autonomous mutation engine by default. It begins as a repository-native operating model that agents can read deterministically and that can later be implemented in software only when the contracts are proven.

## Core outcome

A contributor should be able to answer these questions without reconstructing old chat history:

1. Why does TradeOS exist?
2. What product behavior is intended?
3. What engineering standards apply?
4. What is actually implemented now?
5. What work is active?
6. What sprint is next?
7. Which founder decisions constrain the work?
8. Which evidence supports each claim?
9. Which PR or commit changed the truth?
10. Which document must be updated when the work lands?

## Knowledge layers

### Layer 1 — Doctrine

Stable direction and decision rules:

- Volume 1 — Vision
- Volume 2 — Product
- Volume 3 — Engineering
- Volume 4 — Execution
- Volume 5 — Business
- Volume 6 — Founder

Doctrine changes deliberately. It must not be updated merely because one implementation differs temporarily.

### Layer 2 — Verified implementation truth

Current runtime reality:

- `docs/CURRENT_STATE.md`
- `docs/ARCHITECTURE.md`
- `docs/DOMAIN_MODEL.md`
- `docs/API_REFERENCE.md`
- `docs/RBAC_MATRIX.md`
- `docs/WORKFLOW_LIFECYCLES.md`
- module-specific implementation docs

Implementation truth must be grounded in merged code, migrations, tests, configuration, or live infrastructure evidence.

### Layer 3 — Execution state

Current and upcoming work:

- `docs/SPRINT_BACKLOG.md`
- `docs/ENGINEERING_COMMAND_CENTER.md`
- `docs/SESSION_HANDOFF.md`
- open PRs
- active branches and worktrees
- CI status

Execution state changes frequently and must not be copied into permanent doctrine as if it were timeless.

### Layer 4 — Decisions

Why important choices were made:

- founder decision records;
- architecture decision records;
- security findings and accepted risk decisions;
- product decision records;
- pricing and packaging decisions.

A decision record preserves rationale and revisit conditions. It does not replace the canonical document that reflects the decision.

### Layer 5 — Evidence

Supporting material:

- contractor research;
- competitor research;
- user interviews;
- browser verification;
- integration-test results;
- incident reports;
- migration proof;
- analytics and beta feedback.

Evidence supports doctrine and decisions but does not automatically become doctrine.

### Layer 6 — History

Superseded or completed material:

- archived plans;
- old handoffs;
- obsolete product names;
- completed sprint artifacts;
- replaced implementation specifications;
- historical decisions that remain useful for context.

History must remain searchable but must not masquerade as current truth.

## One-subject-one-owner rule

Every subject has exactly one canonical owner.

Examples:

| Subject | Canonical owner |
|---|---|
| Product mission | Volume 1 |
| Product behavior and roles | Volume 2 |
| Engineering standards | Volume 3 |
| Work execution policy | Volume 4 |
| Commercial strategy | Volume 5 |
| Founder intent | Volume 6 |
| Knowledge linking rules | Volume 7 |
| Current implementation | `CURRENT_STATE.md` and scoped implementation docs |
| Active work queue | `SPRINT_BACKLOG.md` |
| Current session continuity | `SESSION_HANDOFF.md` |
| Decision rationale | decision record |
| Research evidence | research document |

Supporting documents may provide evidence or detail. They must link to the canonical owner and must not redefine it.

## Knowledge status labels

Use these labels when ambiguity would mislead an agent:

- `VERIFIED` — proven by merged repository or live evidence;
- `PROPOSED` — intended direction not yet approved or implemented;
- `FOUNDER DECISION REQUIRED` — cannot proceed safely without founder choice;
- `IN_REVIEW` — active PR exists;
- `BLOCKED` — known dependency prevents progress;
- `DEFERRED` — intentionally not active;
- `SUPERSEDED` — replaced by another canonical source;
- `HISTORICAL` — retained for evidence or context;
- `PROHIBITED` — explicitly outside approved behavior.

Do not use `current` metadata as proof that content is correct when code or merged evidence contradicts it.

## Knowledge object model

Every important knowledge object should be identifiable by type and stable ID.

Recommended prefixes:

- `VIS-` — vision principle;
- `PRD-` — product requirement;
- `ENG-` — engineering standard;
- `EXE-` — execution rule;
- `BUS-` — business principle;
- `FDR-` — founder decision;
- `ADR-` — architecture decision;
- `SEC-` — security decision or finding;
- `SPR-` — sprint;
- `PR-` — pull request evidence;
- `INC-` — incident;
- `RES-` — research evidence;
- `MET-` — metric definition.

IDs should be introduced gradually where they create traceability. Existing documents do not need mass renumbering merely to satisfy this model.

## Required link types

### `implements`

A sprint, PR, or commit implements a product requirement or engineering standard.

### `constrained_by`

Work is constrained by a founder decision, security rule, lifecycle contract, or architecture decision.

### `verified_by`

A claim is supported by tests, merged code, browser evidence, infrastructure evidence, or research.

### `supersedes`

A new decision or canonical source replaces an older one.

### `depends_on`

A sprint or decision requires another merged capability or resolved choice.

### `conflicts_with`

Two active branches, PRs, documents, or decisions cannot safely proceed together.

### `updates`

A merged change requires a specific current-state, module, lifecycle, or Bible update.

### `derived_from`

A doctrine statement or requirement was derived from research or customer evidence.

## Traceability contract

A production-impacting sprint should be traceable as:

```text
Founder or product principle
→ product requirement
→ engineering constraint
→ sprint
→ branch/worktree
→ PR
→ tests and review evidence
→ merge commit
→ current-state update
→ handoff and next sprint
```

Not every typo fix requires the full chain. Security, tenancy, financial, contractual, lifecycle, AI mutation, migration, and customer-facing workflow changes do.

## Sprint knowledge contract

Every sprint must link to:

- the contractor or business outcome;
- applicable Bible volumes;
- verified current state;
- dependencies;
- founder decisions;
- allowed and forbidden paths;
- required tests;
- completion evidence;
- documentation updates.

A sprint is not `READY` merely because it has tasks. It is ready only when dependencies are merged, scope is unoccupied, decisions are resolved, and required infrastructure is available.

## Pull request knowledge contract

Every PR should state:

- sprint or defect addressed;
- user/business outcome;
- exact scope;
- changed modules;
- explicit exclusions;
- security and tenancy impact;
- tests performed;
- tests blocked;
- docs updated;
- known remaining risk;
- merge readiness.

A PR description is evidence for the change, not permanent source of truth. After merge, canonical docs must reflect any lasting behavior change.

## Decision knowledge contract

A decision record must include:

- stable ID;
- status;
- date;
- owner;
- question;
- verified context;
- options;
- choice;
- rationale;
- consequences;
- affected knowledge objects;
- implementation requirement;
- revisit trigger;
- superseded decision, when applicable.

Unrecorded major decisions should not be inferred from chat fragments.

## Evidence strength hierarchy

When sources conflict, prefer:

1. live production or integration evidence;
2. merged code and migrations;
3. tests that exercise the claimed behavior;
4. explicit approved decision records;
5. current implementation documentation;
6. product and founder doctrine;
7. open PR descriptions;
8. research conclusions;
9. session handoffs;
10. old plans, prompts, or chat summaries.

This hierarchy does not allow implementation accidents to silently rewrite founder intent. A contradiction between implementation and doctrine must be surfaced and resolved.

## Contradiction protocol

When two sources disagree:

1. identify the exact claims and paths;
2. classify each source layer;
3. inspect merged and live evidence;
4. determine whether the issue is stale documentation, implementation drift, or unresolved strategy;
5. update the incorrect source only after the truth is established;
6. create a founder decision record when doctrine or market direction is affected;
7. record supersession rather than deleting meaningful history immediately.

Agents must not choose whichever document best supports the task they want to do.

## Scoped knowledge-retrieval additions

Agents use the
[Canonical Startup Flow](../agent-prompts/NEXT_SPRINT_PROTOCOL.md#canonical-startup-flow)
for the repository-wide reading and live-state order. After that required flow,
they retrieve only the relevant Bible volumes, implementation records, and
decision documents needed for the declared task. They should not ingest the
entire repository blindly when a scoped knowledge path exists.

## Answer construction protocol

When an agent reports project state, it must separate:

- verified current fact;
- interpretation;
- recommendation;
- assumption;
- founder decision required;
- blocked evidence.

The agent must cite repository paths, PRs, commits, or test results internally in the handoff or review summary when the distinction matters.

## Write protocol

Knowledge writes follow ownership:

- doctrine changes update the owning Bible volume;
- implementation changes update `CURRENT_STATE` or scoped implementation docs;
- execution changes update backlog and handoff;
- decisions create or update decision records;
- research remains in research documents;
- superseded content is marked or archived after review.

Do not copy the same paragraph into multiple canonical documents.

## Read-only AI runtime principle

The initial Knowledge Runtime is read-only and repository-backed.

It may:

- retrieve relevant documents;
- rank likely sources;
- identify contradictions;
- suggest required updates;
- prepare a sprint or review packet;
- produce traceability reports.

It must not automatically:

- rewrite doctrine;
- change sprint status;
- merge PRs;
- approve founder decisions;
- archive or delete documents;
- alter runtime data;
- treat generated summaries as verified truth.

## Future software implementation

A later software runtime may index structured metadata and relationships, but only after the repository-native contracts are stable.

Possible future components:

- document manifest;
- subject-owner registry;
- knowledge graph index;
- decision registry;
- sprint-to-requirement traceability;
- stale-link and contradiction detection;
- PR evidence ingestion;
- source freshness scoring;
- agent context packet generation.

These are `PROPOSED`, not current product promises.

## Document manifest

A future manifest should track:

- path;
- title;
- owner;
- layer;
- status;
- canonical subjects;
- supporting subjects;
- last verified date;
- evidence links;
- superseded-by path;
- archive eligibility;
- required reviewers.

The docs audit should inform this manifest. It must not be generated from filenames alone.

## Freshness policy

Freshness depends on subject volatility:

- session handoff: each working session;
- sprint backlog: every merge or material blocker change;
- current state: every merged behavior change;
- architecture and lifecycle docs: every affected merge;
- competitor and pricing research: dated and reverified before external claims;
- doctrine: reviewed when strategy changes, not churned for routine implementation;
- decision records: immutable history plus explicit supersession.

An old document can remain correct. A new document can be wrong. Dates inform review; they do not decide truth.

## Archive policy

Archive only after:

1. canonical replacement is identified;
2. unique evidence is preserved;
3. inbound links are updated;
4. ownership rules permit the move;
5. live agents and PRs no longer depend on the old path;
6. founder approval is obtained for high-impact product, business, or vision material.

Archive is preferred over deletion when historical rationale remains useful.

## Deletion policy

Deletion is reserved for:

- generated junk;
- exact duplicate files with no unique history;
- invalid temporary artifacts;
- sensitive material that should never have been committed;
- files explicitly approved for removal after audit.

No AI agent may perform broad documentation deletion solely because content appears repetitive.

## Knowledge-runtime health checks

Track:

- canonical subjects with multiple owners;
- broken internal links;
- stale PR references;
- merged work still marked pending;
- READY sprints overlapping open PRs;
- decisions without implementation updates;
- implementation changes without current-state updates;
- unsupported pricing or competitor claims;
- doctrine statements contradicted by current behavior;
- handoffs that reference missing worktrees or branches.

## Knowledge quality gates

The knowledge system is healthy when:

- every major subject has one owner;
- agents can determine the next safe sprint mechanically;
- current implementation claims are evidence-backed;
- decisions are traceable;
- duplicate documents do not compete for authority;
- stale content is labeled or archived;
- PRs update lasting truth after merge;
- founder intent remains distinguishable from implementation state.

## Anti-patterns

- treating the Bible as a replacement for current state;
- treating current code as permission to rewrite doctrine silently;
- copying the same strategy into multiple volumes;
- using session handoffs as long-term architecture;
- marking generated summaries as verified facts;
- creating a second sprint queue;
- creating a second decision register;
- archiving research because its conclusions appear in doctrine;
- deleting history before links and unique evidence are checked;
- building a vector database before document ownership is resolved;
- allowing AI to mutate canonical knowledge without review.

## Initial implementation sequence

### Phase 1 — Audit

- inventory all docs;
- classify canonical, supporting, live, historical, merge, superseded, and removal candidates;
- identify contradictions and duplicate clusters;
- identify founder decisions.

### Phase 2 — Ownership

- establish canonical subject map;
- add or correct metadata;
- define document manifest;
- wire Bible and operational links.

### Phase 3 — Consolidation

- merge unique doctrine into owning volumes;
- preserve research and decisions as evidence;
- update links;
- mark superseded docs.

### Phase 4 — Archive

- move approved superseded material;
- preserve redirects or index entries where useful;
- remove true junk only after review.

### Phase 5 — Automation

- add docs tests for duplicate IDs, invalid statuses, broken canonical links, stale ownership, and sprint dependency integrity;
- generate agent context packets;
- add contradiction and freshness reports.

### Phase 6 — Productized runtime

- consider structured indexing or a read-only knowledge service only after repository contracts prove stable.

## Founder shortcut

When the Knowledge Runtime is healthy, the founder should be able to say:

> Run the next TradeOS sprint.

The agent should retrieve the necessary doctrine, implementation truth, decisions, evidence, live PR state, and execution rules without asking the founder to recreate the mission.

## Canonical principle

The Knowledge Runtime connects truth; it does not invent it.

Its job is to make the right source easy to find, contradictions hard to ignore, decisions traceable, work mechanically selectable, and lasting changes reflected in the correct owner document.

## Related sources

- `docs/TRADEOS_BIBLE.md`
- `docs/SPRINT_BACKLOG.md`
- `docs/CURRENT_STATE.md`
- `docs/ENGINEERING_COMMAND_CENTER.md`
- `docs/SESSION_HANDOFF.md`
- `docs/DOC_OWNERSHIP.yml`
- `docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md`
- `docs/bible/VOLUME_1_VISION.md`
- `docs/bible/VOLUME_2_PRODUCT.md`
- `docs/bible/VOLUME_3_ENGINEERING.md`
- `docs/bible/VOLUME_4_EXECUTION.md`
- `docs/bible/VOLUME_5_BUSINESS.md`
- `docs/bible/VOLUME_6_FOUNDER.md`
- `docs/decisions/`
- `docs/research/`
