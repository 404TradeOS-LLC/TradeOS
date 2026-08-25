---
status: current
owner: platform
last_verified: 2026-08-24
source_of_truth: true
related_docs:
  - docs/SPRINT_BACKLOG.md
  - docs/CURRENT_STATE.md
  - docs/SESSION_HANDOFF.md
  - docs/modules/brand-studio.md
  - docs/modules/settings-and-operations.md
---

# S017 — Brand asset lifecycle and cleanup readiness contract

## Readiness

S017 is promoted to READY by this governance-only readiness change. S015 and
S016 are DONE with merged implementation and completion evidence. This
document authorizes exactly one later S017 implementation lane; it does not
contain runtime implementation or storage mutation.

Before implementation begins, refresh origin/main, rerun the canonical
selector, and confirm that no S017 implementation PR, branch, worktree, or
overlapping storage/Brand Studio change has appeared.

## Product contract

S017 owns safe lifecycle handling for the existing organization-scoped
Settings brand uploads. The current source of truth remains the unique
SettingsAssetUpload(orgId, assetKey) metadata row plus the private
project-files object at its server-generated storagePath.

The implementation must:

1. Preserve upload-new-then-record-current behavior. A new object is uploaded
   under a server-generated name, metadata is persisted through the existing
   authenticated backend boundary, and only the previously recorded object may
   be considered superseded.
2. Keep the active asset safe across failures. If metadata persistence fails,
   remove only the newly uploaded object best-effort; if superseded-object
   deletion fails, keep the new metadata/current object authoritative and
   surface a bounded repair signal rather than failing a successful upload.
3. Make explicit removal idempotent. Clear the current metadata through the
   existing organization-scoped API, then remove only the exact object returned
   by that operation. Never delete an object selected from client input alone.
4. Add a bounded, dry-run-capable cleanup/reconciliation path for orphaned
   generated brand-upload objects. It may inspect only the private bucket,
   exact organization brand-assets prefixes, server-generated object names,
   and objects older than an explicit grace period. It must never delete the
   current metadata-referenced object.
5. Keep cleanup conservative when storage or metadata evidence is incomplete:
   report the candidate and leave it untouched. Do not infer ownership of
   arbitrary external URLs or general BrandAsset records.
6. Make repeated cleanup safe and observable. A second run must not turn a
   prior successful cleanup into an error, and logs/results must identify
   counts and failure classes without exposing tokens, raw storage credentials,
   or customer data.

No new asset source of truth, public bucket, remote fetch trust boundary,
automatic deletion of arbitrary URLs, or customer-visible branding policy is
authorized.

## Existing implementation baseline

- web/src/app/actions/settings.ts already performs upload-new-then-delete-old
  for the four supported Settings asset keys and documents the orphan failure
  windows.
- web/src/lib/settingsAssetUpload.ts owns allowed keys, MIME/size checks,
  UUID organization validation, generated object names, and exact storage
  prefixes.
- SettingsAssetUpload has one current row per organization/key and is
  organization-scoped through the existing backend API and forced RLS.
- web/src/app/api/brand-assets/[orgId]/[assetKey]/route.ts is the
  authenticated private-bucket byte proxy and must retain same-org checks,
  no-store, and nosniff protections.
- BrandAsset records may contain externally hosted or otherwise non-owned
  URLs; S017 must not treat those rows as deletable storage objects.
- S015 owns Settings/Brand Studio compatibility and S016 owns document
  rendering; neither source of truth may be duplicated or redesigned.

## Authorized implementation surface

Expected paths, subject to final implementation evidence:

- web/src/app/actions/settings.ts
- web/src/lib/settingsAssetUpload.ts
- a small server-only cleanup/reconciliation helper under web/src/lib/ or
  web/src/app/actions/
- focused Web tests for upload, replacement, remove, path validation, and
  cleanup behavior
- existing Settings/Brand Studio API helpers only where required to preserve
  the current contract
- owner documentation required by docs/DOC_OWNERSHIP.yml

A schema or migration is not expected. If reliable cleanup requires a new
history table, retention policy, bucket-wide destructive operation, new
scheduler, new credential, or new RLS policy, stop at a reviewable plan and
prepare the required decision packet instead of expanding S017.

## Authorization, storage, and tenant contract

- Upload and removal remain limited to the existing authenticated
  admin-equivalent permissions: team.manage, company.manage, or
  settings.manage.
- Organization identity comes from the authenticated session and trusted
  backend response, never from a client-selected organization ID.
- Metadata reads/writes remain behind the existing bearer-authenticated API,
  request-scoped database session, and forced PostgreSQL RLS.
- Storage operations use the existing server-only service-role client; no
  service-role key or storage state may reach the browser, logs, tests, or PR.
- Cleanup must reject malformed organization IDs, unsupported asset keys,
  path traversal, arbitrary buckets, and object paths outside the exact
  generated prefix.
- Cross-organization proxy reads, metadata operations, and cleanup selection
  must fail closed.

## Required implementation tests

Behavioral coverage must include:

- successful replacement records the new object and attempts deletion only of
  the previously recorded object;
- metadata persistence failure cleans the new orphan without touching the old
  current object;
- superseded-object deletion failure preserves successful upload semantics and
  produces a bounded repair result;
- explicit removal is idempotent and deletes only the exact metadata-confirmed
  path;
- cleanup dry-run reports eligible orphan candidates without deleting;
- cleanup deletes only stale, generated, non-current objects beneath the exact
  organization/key prefix;
- current objects, recent objects, malformed paths, other organizations,
  unsupported keys, arbitrary external URLs, and unrelated bucket objects are
  never deleted;
- repeated cleanup is safe and cleanup failures are classified without secret
  leakage;
- same-org authorization succeeds and unauthenticated, inactive-member,
  wrong-role, cross-org, malformed-ID, and direct-object attempts fail closed;
- existing Brand Studio/Settings tests and the private asset proxy contract
  remain green.

Required validation includes focused Web tests, Web lint/build, git diff
check, npm run pr:preflight -- --base origin/main, npm run pr:test,
npm run docs:test, npm run docs:check -- --base origin/main, and the
repository's applicable App/API/RLS checks when backend helpers are touched.

## Explicit non-goals and stop conditions

S017 must not change Brand Studio ownership, document rendering, customer
identity, auth policy, permissions, RLS policy, payment/billing semantics,
schema without review, public bucket visibility, arbitrary URL deletion,
remote asset fetching, or unrelated S020/S022/S027 work.

Stop for founder or architecture review if cleanup semantics require a new
retention period with customer-facing consequences, irreversible production
deletion without a recoverable dry-run/review boundary, a new third-party
storage provider, a production credential/configuration change, a migration,
or a new background-job architecture.

## Completion evidence required

After implementation merge, a separate governance-only evidence PR must record
the implementation PR and merge SHA, lifecycle behavior, failure/retry
semantics, authorization/RLS evidence, cleanup dry-run/deletion evidence,
tests, explicit non-goals, and any production storage reconciliation that was
not available locally. Only that merged evidence may change S017 from
IN_REVIEW to DONE.