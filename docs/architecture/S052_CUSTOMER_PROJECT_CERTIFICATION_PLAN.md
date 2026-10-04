---
status: current
owner: platform
last_verified: 2026-10-03
source_of_truth: false
related_docs:
  - docs/SPRINT_BACKLOG.md
  - docs/testing/BETA_EVIDENCE.md
  - docs/CURRENT_STATE.md
---

# S052 Customer and Project Certification Plan

## Mission

Certify the Customer → ServiceAddress → Project vertical already implemented on current `main`. Do not redesign or replace the Customer, CRM, ServiceAddress, Project, authentication, membership, or tenant-isolation contracts.

## Existing implementation

- PR #586 rebuilt the valid Customer ↔ Project work from stale draft #565 onto current main.
- PR #629 preserves the exact server-created Customer id and opens the created Customer record.
- Customer duplicate advice is bounded, same-organization, advisory, and fail-closed on incomplete lookup.
- ServiceAddress writes use the existing organization/Customer-scoped CRM service boundary.
- Project create/update persists `customerId`, `siteAddress`, and `simpleScope` through the existing Project controller.
- Existing tests cover duplicate-flow behavior, permissions, parent scoping, and Project persistence.

## Authorized evidence work

Extend the existing Beta Evidence harness with an opt-in `s052` scenario. It may add fixture-secret names, role-specific authentication setup, browser/API assertions, screenshots/reports, and focused harness tests needed to prove the existing contract.

The scenario must prove:

1. owner happy path;
2. admin happy path;
3. Customer create and update;
4. duplicate advisory review without silent merge/write;
5. validation denial without unintended mutation;
6. ServiceAddress create/persistence through reload;
7. Project creation linked to the Customer with address and scope retained after reload;
8. inactive-membership denial;
9. cross-tenant Customer/Project denial;
10. 1440/768/390 responsive evidence and exact deployed-SHA correlation.

The canonical 1024 viewport may remain in the run as additional evidence.

## Fixture boundary

Use only the approved non-production synthetic TradeOS smoke tenant and prepared negative fixtures. Do not create or mutate production data. Owner/admin/inactive identities must be dedicated synthetic accounts. Foreign Customer/Project fixtures must belong to a separate synthetic tenant.

If required identities or foreign fixtures are absent, preflight must say NOT READY and the sprint remains `IN_REVIEW`; never weaken the checks or substitute a founder account.

## Stop conditions

Stop and report instead of expanding scope if evidence requires:

- a new role, permission, or membership policy;
- auth-provider or login-policy changes;
- RLS/tenant-policy changes;
- schema or migration changes;
- automatic Customer merge behavior;
- another Customer, Lead, CRM, or Project persistence model;
- production access or real customer records;
- unrelated sprint implementation.

A reproducible current-main defect inside the existing S052 contract may be repaired in the same sprint only when the fix is bounded and preserves the existing security/domain model.

## Completion

S052 may move to `IN_REVIEW` once the certification PR exists. It may move to `DONE` only after the implementation/evidence PR is merged and a retained full non-production `s052` run proves the acceptance contract.
