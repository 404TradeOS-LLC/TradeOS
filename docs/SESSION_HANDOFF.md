---
status: current
owner: platform
last_verified: 2026-09-19
source_of_truth: false
related_docs:
  - docs/SPRINT_BACKLOG.md
  - docs/CURRENT_STATE.md
  - docs/architecture/ASSEMBLY_CATALOG_IMPLEMENTATION.md
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
---

# Session Handoff

## Mission

Continue the founder-authorized Assembly Catalog work as a sequence of bounded,
mergeable slices. The current slice closes the mapping-quality, atomicity,
versioning, and tenant-integration gaps identified after the first 14-recipe
NAHB/CSI catalog landed.

## Current truth

- Current work continues existing PR #520 on branch
  `coderabbitai/post-merge-2/f59bab1`, rebased onto `origin/main` at `a44939f`.
  Reconciliation classified the task `EXISTING_WORK_FOUND`; do not open a
  duplicate PR.
- The starter catalog now has catalog/recipe versions, reviewed-source metadata,
  pinned component quantities, compatible unit/type declarations, and a derived
  coverage matrix for its 10 residential work groups and 14 recipes.
- Installation rejects repeated Cost Items and incompatible unit/type mappings,
  then creates the Assembly and AssemblyItem rows in one explicit transaction.
  The transaction helper reuses an active request transaction so RLS session
  identity is preserved.
- The web catalog uses bounded server-backed Cost Item search for both manual
  composition and starter mapping. Starter results explain and disable duplicate
  or incompatible choices instead of allowing a bad recipe to reach install.
- Live integration coverage now exercises starter installation within an RLS
  session, verifies tenant invisibility, and confirms a foreign mapping leaves
  no partial Assembly. Service/catalog snapshots cover the versioned contract.
- Repository preflight passes: 2,302 backend tests across 261 suites, backend
  lint/build, 283 web tests, web lint/build, docs checks/tests, governance tests,
  and `git diff --check` are green locally. The Docker-backed integration lane
  is environment-blocked here and remains required in CI.
- No schema, migration, RLS-policy, pricing-formula, estimate, or takeoff behavior
  changed in this slice.

## Next safe action

Review the final diff, update PR #520's title/body to describe the complete
slice, and force-push only with an exact `--force-with-lease` against its
pre-rebase remote head. Confirm required CI, including the Docker-backed
integration lane, on the published head. Do not claim rendered browser or
production evidence unless it is actually captured.

## Next Eligible Sprint

Sprint ID: NONE
Eligibility: `NONE`; this remains directly authorized out-of-band work and does not change numbered sprint status. S048 still requires a founder decision, and S039/S044/S045 remain blocked on production access.
Dependencies: Existing Costbook Assembly, Cost Item, Estimate pricing, request-session, RBAC, and forced-RLS foundations are present on `main`.
Overlap check: live reconciliation on 2026-09-19 found PR #520 as the directly overlapping continuation and PR #519 as non-overlapping completion evidence.
Startup prompt: Continue only PR #520's bounded Assembly Catalog quality slice; reconcile live branch/PR state before editing or publishing.
