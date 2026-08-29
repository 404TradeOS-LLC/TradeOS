---
status: current
owner: platform
last_verified: 2026-08-29
source_of_truth: true
related_docs:
  - docs/SPRINT_BACKLOG.md
  - docs/CURRENT_STATE.md
  - docs/SESSION_HANDOFF.md
  - docs/modules/brand-studio.md
  - docs/modules/settings-and-operations.md
---

# S017 — Brand asset lifecycle and cleanup

## Completion state

S017 is `DONE`. Implementation PR #317 merged as
`4b02c8257d7934a4e18d304ce9bdd8ba51878645`; corrective PR #319 merged as
`8ebb1a84302eafcab529f3db2f93c63000a76ffe`. Completion evidence is recorded in
`docs/architecture/S017_COMPLETION_EVIDENCE.md`.

This document now records the landed contract rather than presenting S017 as a
future implementation lane.

## Landed product contract

S017 owns safe lifecycle handling for the existing organization-scoped
Settings brand uploads. The source of truth remains the unique
`SettingsAssetUpload(orgId, assetKey)` metadata row plus the private
`project-files` object at its server-generated `storagePath`.

The landed implementation:

1. Preserves upload-new-then-record-current behavior. A new object is uploaded
   under a server-generated name, metadata is persisted through the existing
   authenticated backend boundary, and only the previously recorded object is
   considered superseded.
2. Keeps the active asset safe across failures. If metadata persistence fails,
   only the newly uploaded object is removed best-effort; if superseded-object
   deletion fails, the new metadata/current object remains authoritative.
3. Makes explicit removal idempotent. Current metadata is cleared through the
   existing organization-scoped API, then only the exact returned object path
   is eligible for removal.
4. Provides a bounded, dry-run-by-default cleanup/reconciliation path for
   orphaned generated brand-upload objects. It inspects only the private bucket,
   exact organization brand-assets prefixes, server-generated object names,
   and objects older than the 24-hour grace period. The current metadata-
   referenced object is never eligible.
5. Fails closed when Storage listing evidence is incomplete. Candidates from an
   incomplete namespace listing are discarded rather than deleted.
6. Keeps repeated cleanup safe and observable without logging credentials,
   tokens, or customer payloads.

No new asset source of truth, public bucket, remote fetch trust boundary,
automatic deletion of arbitrary URLs, customer-visible retention policy, or
scheduler/background-job architecture was introduced.

## Implementation surface

- `web/src/app/actions/settings.ts` — upload/replacement/removal behavior
- `web/src/lib/settingsAssetUpload.ts` — allowed keys, MIME/size validation,
  generated object names, and exact storage prefixes
- `web/src/lib/settingsAssetCleanup.ts` — conservative orphan reconciliation
- `web/src/app/api/brand-assets/[orgId]/[assetKey]/route.ts` — authenticated
  private-bucket byte proxy
- `SettingsAssetUpload` — one current metadata row per organization/key behind
  the existing backend API and forced RLS

`BrandAsset` records may contain externally hosted or otherwise non-owned URLs;
those rows are not treated as deletable Storage ownership evidence.

## Authorization, storage, and tenant contract

- Upload, removal, and cleanup remain limited to the existing authenticated
  admin-equivalent permissions: `team.manage`, `company.manage`, or
  `settings.manage`.
- Organization identity is derived from the authenticated session and trusted
  backend response, never from a client-selected organization ID.
- Metadata reads/writes remain behind the bearer-authenticated API,
  request-scoped database session, and forced PostgreSQL RLS.
- Storage operations use the existing server-only service-role client; no
  service-role key or storage state reaches the browser.
- Cleanup rejects malformed organization IDs, unsupported asset keys, path
  traversal, arbitrary buckets, and paths outside the exact generated prefix.
- Cross-organization proxy reads, metadata operations, and cleanup selection
  fail closed.

## Verification evidence

The shipped implementation and corrective merge passed focused Web tests,
TypeScript, lint, production build, documentation checks, repository
verification, live documentation reconciliation, sprint governance, dependency
review, and branch currency checks. The focused post-correction suite recorded
17 passing tests. See `S017_COMPLETION_EVIDENCE.md` for the retained evidence.

## Known limitation

Cleanup is intentionally operator-invoked and dry-run by default. A stale
orphan can therefore remain in private Storage until the reconciliation action
is run after the grace period. S017 deliberately did not add an automatic
scheduler because that would have introduced a new background-job/retention
policy boundary.

## Explicit non-goals

S017 does not change Brand Studio ownership, document rendering, customer
identity, auth policy, permissions, RLS policy, payment/billing semantics,
public bucket visibility, arbitrary URL deletion, remote asset fetching, or
supplier/Costbook behavior.
