# API validation runtime security repair

October 27, 2026 · Sprint ID NONE · existing PR #795 (`EXISTING_WORK_FOUND`).

This prerequisite unblocks Today 2.0 PR #798's production-dependency audit. It extends the existing API runtime dependency PR in an isolated checkout, reconciled with main `93d1fff`. No schema, data migration, JWT/membership, role, RLS, financial policy, supplier activation or production environment changes.

## Dependency changes

- Retain the proposed dotenv 18.0.9 and @vercel/functions 3.10.3 updates.
- Move application validation to Zod 4.6.7 and use the package override `$zod` so Vercel's nested Zod 4.1.11 cannot retain the vulnerable implementation. Production code imports Zod 4 directly; no Zod 3 compatibility runtime is used.
- Resolve body-parser 1.20.9 using the exact patch already proposed by PR #799. The lock entry/integrity matches that PR. Once this consolidated repair merges, #799 can be closed as superseded; do not maintain a competing implementation.
- Leave the independent moderate ip-address finding to existing PR #786; the high-severity production audit still runs unchanged.

Advisories: https://github.com/advisories/GHSA-mrhx-c7xc-m3w5 and https://github.com/advisories/GHSA-27r3-jxmh-p828 . Official migration reference: https://zod.dev/v4/changelog .

## Compatibility repairs

Zod 4's UUID validator enforces variant/version semantics that Zod 3 did not. Existing PostgreSQL identifiers and API fixtures include UUID-shaped values outside that narrower set. Replace the existing `z.string().uuid()` validators with `z.guid()` to preserve the original 8-4-4-4-12 hexadecimal contract, including nil/legacy identifiers. This does not grant access to a record: the same identity, membership, permission, parent relation and forced-RLS checks remain authoritative. Malformed identifiers still fail. No generic parser shim or runtime monkey patch is introduced.

Explicit key/value record schemas preserve metadata, bulk material rows, plugin manifests and Athena action test dictionaries. The comma-separated enum helper constrains its generic to string-input/output schemas, preserving literal status output and exact boolean/missing-value behavior through the typed Zod 4 pipeline.

HTTP validation still returns 400 with `error: Validation failed`, structured `details` and request correlation. Zod 4 changes individual issue codes/metadata; consumers must treat details as validation diagnostics rather than a frozen Zod 3 wire schema. No status, authorization or approval policy changes.

## Verification and rollback

Focused compatibility coverage includes oversized constrained arrays rejecting before element validation, legacy/malformed identifiers, comma-separated status enums, exact false/missing query booleans, and HTTP error/request-id preservation. Existing controller, Athena tool/plugin/action, serverless scheduling and tenant suites remain required.

Local focused run: 72/72 passed across six suites; five additional security/compatibility regressions passed across two suites, including a disposable child server surviving compressed trailing bytes and serving its next request. Backend typecheck/build, 416 Athena contracts, four Athena smoke tests, 159 governance tests, 40 documentation helper tests, documentation ownership and whitespace checks pass. The complete backend unit suite is still running at publication time; fresh hosted results remain required. Production audit currently reports zero high/critical findings and one moderate ip-address finding tracked by #786. Full backend lint/type, unit, build, Athena contracts/smoke, documentation checks and hosted PostgreSQL integration/migration rehearsal must be recorded on the final head before approval. Initial type checks exposed the intended record/pipeline incompatibilities; these were repaired without weakening assertions.

Rollback is a normal code/dependency revert; no data recovery is needed. Reverting restores the known vulnerable dependency versions, so rollback is an operational recovery step rather than a security resolution. This is a major validation-runtime compatibility change and remains reviewable under the repository's PR-only rule. No production deployment or independent approval is claimed.
