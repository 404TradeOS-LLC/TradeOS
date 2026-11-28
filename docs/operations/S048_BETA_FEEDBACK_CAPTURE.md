---
status: current
owner: platform
last_verified: 2026-11-28
source_of_truth: true
related_docs:
  - docs/operations/INVITED_BETA.md
  - docs/operations/S048_BETA_ONBOARDING_CHECKLIST.md
  - docs/operations/S048_BETA_SUPPORT_PATH.md
  - docs/operations/S048_BETA_ROLLBACK_PLAN.md
  - docs/operations/S048_BETA_ONBOARDING_EXECUTION_RECORD.md
---

# S048 — Beta Feedback Capture

How the beta contractor's findings reach engineering, how often they are
triaged, and where they are recorded. One named contractor only:
**Mike Lockler, start December 1, 2026**.

## Channel

- **Routine findings:** the contractor reports to the founder (support
  owner — see `S048_BETA_SUPPORT_PATH.md`). The founder routes them
  into the governed issue queue.
- **Critical findings** (suspected cross-tenant access, wrong financial
  output, lost/corrupted data, inability to operate safely): contractor
  contacts the founder at once; the founder stops new invitations
  immediately and opens the incident in the governed issue queue the
  same day.
- **Governed issue queue:** GitHub issues in `404TradeOS-LLC/TradeOS`
  — the same queue the sprint and PR work already uses. No separate
  feedback tool, form, or inbox is introduced by S048.

## Cadence

- **Triage every business day.** Routine feedback is triaged in the
  governed issue queue each business day; nothing waits for a weekly
  batch.
- **Founder feedback review** before any expansion: expand from one
  business to at most three only after seven consecutive days without
  a critical incident *and* a founder feedback review. A critical
  incident restarts that seven-day window after verified resolution.

## What is recorded

Every finding is recorded in the governed issue queue with:

- workflow location (where in Customer → Project → Estimate →
  Proposal → PDF it happened);
- expected result vs actual result;
- severity (routine vs critical, using the critical definition above);
- owner;
- redacted reproduction (never passwords, tokens, or unnecessary
  customer data);
- resolution.

## What is not captured here

- No in-product feedback widget, support-ticket system, or survey is
  built by S048. S093 (in-product feedback and support triage) owns
  that product scope.
- Contractor business details, contact email, consent, and data-policy
  confirmations are recorded privately by the founder, not in the
  issue queue and not in any public document.
- Feedback capture does not close the runbook's open gates
  (clarification answer/regeneration, financial discrepancies, S052
  roles, recovery rehearsal). Those findings are triaged like any
  other, but their closure belongs to their own sprints.
