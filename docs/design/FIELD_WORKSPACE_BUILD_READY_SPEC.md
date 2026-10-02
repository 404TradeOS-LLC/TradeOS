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
