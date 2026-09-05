# RC full contractor lifecycle evidence

Status: IN PROGRESS
Date: 2026-09-02
Branch: `rc/e2e-full-lifecycle-20260902`

## Goal

Prove the authenticated contractor path on a non-production Vercel Preview backed only by the TradeOS Staging Supabase project:

`login -> customer -> project -> estimate -> proposal -> acceptance -> contract -> invoice -> payment -> job -> schedule -> field progression -> completion`

The existing canonical beta evidence stops at invoice creation. It is necessary evidence, but it is not sufficient to claim the complete contractor lifecycle above.

## First live-product gap found

The Jobs backend already supports job creation, assignment, scheduling, dispatch, field-state progression, and completion. The shipped frontend exposed existing jobs in the project workspace and management actions in `/dispatch`, but there was no reachable contractor UI action to create the initial Job row. A contractor therefore could not transition from approved/billable project work into field execution without calling the API directly.

This branch adds the smallest bridge without changing job lifecycle, RBAC, RLS, schema, or backend route contracts:

- project header action: `Create job`
- `/projects/[id]/jobs/new`
- load existing customer service addresses through the authenticated same-origin proxy
- create a service address when the customer has none
- create the job through the existing `POST /api/v1/jobs` route
- continue directly into `/dispatch`, where existing assignment/schedule/state controls remain authoritative

## Evidence requirements before promotion

- Vercel Preview must build from this branch and remain non-production.
- Preview must use the staging backend/Supabase dependency contract only.
- Existing beta evidence must still pass at 1440, 1024, 768, and 390 widths.
- A real authenticated smoke user must create the synthetic lifecycle records through the UI.
- Invoice payment must be recorded through the staff invoice payment form and persisted in the Payment ledger.
- A job must be created through the new project UI, scheduled through Dispatch, progressed through the existing lifecycle, and completed.
- Staging SQL/API evidence must prove the resulting entities belong to the smoke organization.
- Foreign-tenant fixture reads must remain denied/not found.

No production data is to be used or mutated by this evidence run.
