---
status: current
owner: platform
last_verified: 2026-08-11
source_of_truth: true
related_code:
  - app/domain/contracts.ts
  - app/modules/auth/service.ts
  - app/modules/jobs/service.ts
  - app/modules/athena-tools
  - app/modules/athena-permissions
---

# RBAC Matrix

## Canonical roles

Current canonical roles:

- `owner`
- `admin`
- `dispatcher`
- `technician`

Legacy compatibility mappings:

- `estimator` maps to canonical `dispatcher`
- `viewer` maps to canonical `technician`

Legacy roles are compatibility inputs only. New documentation and new product claims must use the canonical role names.

## Shared permission model

Shared permission keys from `app/domain/contracts.ts`:

- `team.manage`
- `company.manage`
- `settings.manage`
- `crm.read`
- `crm.write`
- `dispatch.manage`
- `billing.read`
- `billing.write`
- `documents.manage`
- `notes.write`
- `activity.read`
- `costbook.read`
- `costbook.write`
- `costbook.manage`

## Major-module permissions

| Module | owner | admin | dispatcher | technician |
| --- | --- | --- | --- | --- |
| Team and organization management | Full | Full except ownership transfer semantics | Company/settings oriented management only where granted by shared permissions | No |
| CRM and projects | Read/write | Read/write | Read/write | Read-only |
| Jobs and scheduling | Full including overrides | Full including overrides | Manages dispatch and assignments without owner-only overrides | Field-scoped access only |
| Proposals, contracts, invoices | Full | Full | Operational document and billing support | Read-only |
| AI suggestion generate/apply (`POST .../ai-suggestions`, `.../ai-suggestions/apply`) | Full through `crm.read`/`crm.write` | Full through `crm.read`/`crm.write` | Full through `crm.read`/`crm.write` | Read-only (`crm.read`); cannot apply suggestions |
| Structured AI estimator draft/apply | Full through `billing.write` | Full through `billing.write` | Operational estimating support through `billing.write` | No write access |
| Costbook workspace foundation | Full through `costbook.read`/`costbook.write`/`costbook.manage` | Full through `costbook.read`/`costbook.write`/`costbook.manage` | Read-only through `costbook.read` | Read-only through `costbook.read` |
| Notes and activity | Full | Full | Full | Can write notes and read activity |
| Brand Studio and settings | Full | Full | Supported through `settings.manage` and `company.manage` | No |

Costbook hierarchy PATCH operations intentionally split ordinary editing from lifecycle control. Changes to Division, Category, or Subcategory fields such as `code`, `name`, and `sortOrder` require `costbook.write`; any PATCH that includes `isActive` additionally requires `costbook.manage`, matching the existing manage-only DELETE/deactivation boundary. Owner/admin currently hold both permissions, but this distinction is enforced independently so a future write-only Costbook role cannot activate or deactivate hierarchy records.

## Tenant-boundary behavior

- all roles are tenant-scoped by organization membership
- no role bypasses RLS
- cross-organization reads and writes are denied by session-scoped RLS
- request headers cannot select or impersonate a tenant

## Assigned-technician restrictions

Jobs have extra scope restrictions beyond the shared permission map:

- technicians can only access jobs where they have an active assignment
- technicians can accept or decline only their own assignments
- technicians may move assigned jobs through field states that the service permits
- owners and admins can override schedule conflicts
- only owners and admins can reopen completed jobs
- `GET /api/v1/jobs/dispatch-summary` (the Dispatcher Workspace's org-wide attention aggregate) requires authentication but no elevated role — it introduces no new privilege check. The existing `jobs_select_policy` RLS narrowing above still applies to its underlying `count()` queries, so a non-owner/admin/dispatcher caller receives real, correctly-scoped-to-them counts rather than an org-wide total; the response labels this via a `scope` field so the UI never presents a narrowed count as if it were org-wide

## Athena business tools (A12)

A12's 19 first-party Athena tools (`app/modules/athena-tools/**`) declare permissions from the exact same shared permission-key list above - no separate Athena permission system exists, and A4 (`app/modules/athena-permissions`) remains the sole authority that evaluates them at dispatch time. Every tool is `risk: "low"`, so A4 auto-`allow`s any actor whose role already holds the declared permission via the shared role table above; A4 `deny`s everyone else, the same as any other route.

| Permission | Athena tools gated by it |
| --- | --- |
| `crm.read` | `office.search-customers`, `office.summarize-customer`, `field.job-context`, `field.create-recommendation` |
| `crm.write` | `office.create-follow-up` |
| `billing.read` | `estimator.analyze-estimate`, `estimator.compare-estimates`, `costbook.lookup`, `costbook.analyze-margin`, `costbook.recommend-price` |
| `billing.write` | `estimator.create-estimate`, `estimator.update-estimate`, `office.prepare-invoice` (preview-only - see below) |
| `dispatch.manage` | `dispatcher.schedule-job`, `dispatcher.assign-technician`, `dispatcher.optimize-day`, `dispatcher.weather-impact` |
| `notes.write` | `field.add-note` |
| none (`[]`) | `field.update-job-status` - `JobsService`'s own `assertFieldWorker`/`assertManager` and technician-assignment checks are the real authorization boundary for who can transition a specific job, since no shared permission key here is granular enough to express "the technician assigned to this job" |

Two tools are gated by a permission stronger than what they technically execute, deliberately, to keep the *capability* restricted to the intended persona even though the *action* is read-only: `office.prepare-invoice` requires `billing.write` (office/management roles only) but never creates or sends an invoice - it returns a preview draft only, matching the shared permission table's existing "Proposals, contracts, invoices" row (technician stays read-only). `costbook.recommend-price` requires only `billing.read` and never writes a stored price, so a technician (who already holds `billing.read`) can see a price recommendation without needing `billing.write`.

See `docs/athena/roadmap/A12-business-tool-rollout-implementation-plan.md` section 5 for why every A12 tool is `risk: "low"` rather than `medium`/`high` (in short: none of them sends, finalizes, or changes a stored price - the categories that would require approval - and production has no real approval-verifier submission surface yet for a `medium`/`high`-risk tool to complete against).

## Athena approvals and audit review

- Athena approval review routes and the operator-facing `/athena/approvals`
  surface are limited to `owner` and `admin`.
- A requester may submit and read their own approval request record, but may
  not review or self-grant it.
- Database RLS on `athena_approvals` allows requester reads and inserts, while
  row updates are restricted to operator roles (`owner`/`admin`/`dispatcher`)
  as a defense-in-depth floor under the narrower HTTP layer.
- Athena audit/event review in the operator console is also owner/admin only,
  even though the underlying audit table keeps actor-scoped visibility for
  non-operator callers.

## Current auth-specific constraints

- first-owner provisioning creates an `owner`; this only happens once per identity — `POST /api/v1/auth/bootstrap` looks up an existing membership (by verified `authSubject`/email) before ever provisioning, so calling it again for an already-bootstrapped user (which the frontend now does on every login, not just at signup) returns their existing role and never creates a second organization or membership, and the client-supplied `organizationName` is ignored entirely once a membership already exists. That lookup runs inside a transaction that explicitly sets the `app.login_lookup` → `app.user_id` → `app.org_id` RLS session flags in sequence (a fixed production bug — see `docs/modules/auth-and-tenancy.md`'s Database security invariants), since the request has no established org context yet
- `organizationName` (and only `organizationName`/`regionCode`/`fullName`) is the sole client input the first-owner provisioning path accepts; `bootstrapSchema` (`app/backend/controllers/auth.controller.ts`) is a Zod `.strict()` object, so a request body carrying `role`, `userId`, `authSubject`, or `organizationId` is rejected outright (`400`, before any provisioning logic runs) — see `app/tests/auth.controller.bootstrap.test.ts`. Role is always the hardcoded `"owner"` literal in `OrganizationProvisioningService.provision`; identity is always the verified JWT's `authSubject`/email, never the request body
- team invites are currently limited to `dispatcher` and `technician` roles
- compatibility values may still appear in stored memberships but are normalized during auth/session resolution
- legacy `estimator` retains existing compatibility permissions and has read-only Costbook access through `costbook.read`; it does not receive `costbook.write` or `costbook.manage`
