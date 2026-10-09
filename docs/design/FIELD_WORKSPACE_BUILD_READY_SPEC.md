# Field Workspace — Build-Ready Specification

## Outcome

Keep Field action-first and contractor-usable while staying inside capabilities that exist on current `main`. Richer Figma behavior is target-only unless route, persistence, permission and evidence exist.

## Current production contract

Authoritative seams:
- `web/src/app/(app)/field/page.tsx`
- `web/src/components/field/field-job-actions.tsx`
- `web/src/components/field/field-note-form.tsx`
- `web/src/components/field/field-workspace-contract.test.ts`
- existing Job lifecycle/backend contracts

Current technician workspace supports:
- authenticated technician role gate and assignment-scoped jobs;
- today's job list/current detail;
- directions/work briefing;
- recent notes + note submission;
- Start travel, Arrived, Pause with reason, Resume, Complete;
- one dominant fixed mobile lifecycle action above Control Dock;
- explicit separation between field completion and invoice handoff.

## Current states

Job selection: loading · no assigned jobs · selected job · route/access failure.

Lifecycle mutation: available · Saving… · failure with prior Job truth preserved · acknowledged updated state.

The action derives from persisted Job status and does not expose office-owned schedule/assign/delete actions.

## Mobile contract

At 390 px keep current-job identity, briefing, one dominant lifecycle action, contextual Pause, visible mutation failure and safe-area spacing above Control Dock.

## Target-only Figma capabilities

The master contains richer examples for photo capture, measurements, quick capture, task expansion, issues, change orders, materials/deliveries, customer decisions, crew/time, activity, completion/punch, offline/sync, contextual Athena and a richer desktop job workspace.

These are not all current production capabilities. Current contract tests specifically require no Take photo, Create issue, Record change, offline or inventory advertising.

## Offline boundary

Offline sync/background queue is not implemented on current main. Do not represent it as available. A future implementation needs an explicit device-local persistence, acknowledgement, idempotency/conflict, retry, encryption and session-invalidation contract before the Figma Offline/Sync states become implementation-ready.

## Athena boundary

Do not wire Figma examples such as receiving-photo comparison, missing-material detection, customer updates or generated change work unless the backing field data/action contract exists and preserves review/authorization.

## Acceptance criteria

- technician route remains authenticated, role-gated, assignment-scoped and tenant-safe;
- lifecycle actions remain the existing bounded transitions;
- pending prevents duplicate submit;
- failure keeps prior Job truth and shows error;
- Complete does not imply invoice/payment completion;
- notes stay inside the authenticated Job boundary;
- mobile keeps one dominant state-aware action above Control Dock;
- unsupported photo/issue/change/offline/inventory/messaging/timekeeping/payment controls remain absent;
- no Figma target is labeled implemented without backing runtime evidence.

## Next five TODO items

1. Capture current-main lifecycle evidence where fixtures permit.
2. Verify mutation failure at 390 px preserves prior state and error copy.
3. Verify technician assignment denial and organization boundary behavior.
4. Reconcile each richer Figma field frame to an owning backlog/domain contract before implementation.
5. Start S066 only when its readiness/dependency contract permits the bounded action-first slice; do not smuggle in offline/photo/change persistence.


## Field capture implementation gate — 2026-10-09

**Status: proposed contract, not a shipped photo/issue feature.** Before enabling the richer Figma capture actions, implement and review these boundaries:

1. **Resource ownership:** Each attachment or issue must belong to an existing Job, organization and authorized actor. Derive organization and actor from the authenticated server session; never trust a client-supplied tenant identifier. Technician writes must be limited to assigned jobs and permitted lifecycle states. Re-check access on every read, download and mutation.
2. **Upload contract:** Use a server-issued short-lived, job-scoped upload authorization with content type, maximum byte size and object-key constraints. Store opaque object keys and metadata, not arbitrary user-supplied public URLs. Keep storage private and validate content after upload before making it visible.
3. **Persistence and audit:** Record the job, organization, uploader, creation time, content digest, review state and attachment/issue relationship. Prevent cross-tenant reads with the existing forced-RLS posture and add explicit denial tests. Issue/change records must not modify contractual price or scope without the governed change-order review path.
4. **Acknowledgement and retry:** A photo/issue is submitted only after server acknowledgement; errors leave the user's local draft visible without claiming successful sync. Define idempotency and duplicate-upload handling before retry behavior. Offline queues, background sync and device encryption remain out of scope.
5. **Evidence before release:** Add API and real-PostgreSQL/RLS tests for authorized assigned technician, unassigned technician, foreign tenant, revoked membership, malformed upload and replay. Capture authenticated 390px and desktop browser evidence including denied/failure states and verify private object access. No release label until those checks pass.

### Immediate validation commands

From the repository root, run the existing Field component contract tests with the web package's Node test command, then run the web typecheck and required repository checks. Follow with the governed authenticated browser and PostgreSQL/RLS evidence workflows. Static source-contract assertions do not substitute for any of those runtime checks.

### Design reconciliation

The Figma photo, issue, change and offline states remain **TARGET** until the above storage, access, audit, review and evidence contracts are implemented. Preserve one dominant mobile action and keep field completion separate from invoice/payment completion.
