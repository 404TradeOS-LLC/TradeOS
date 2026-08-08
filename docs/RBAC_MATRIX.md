---
status: current
owner: platform
last_verified: 2026-08-08
source_of_truth: true
related_code:
  - app/domain/contracts.ts
  - app/modules/auth/service.ts
  - app/modules/jobs/service.ts
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

## Major-module permissions

| Module | owner | admin | dispatcher | technician |
| --- | --- | --- | --- | --- |
| Team and organization management | Full | Full except ownership transfer semantics | Company/settings oriented management only where granted by shared permissions | No |
| CRM and projects | Read/write | Read/write | Read/write | Read-only |
| Jobs and scheduling | Full including overrides | Full including overrides | Manages dispatch and assignments without owner-only overrides | Field-scoped access only |
| Proposals, contracts, invoices | Full | Full | Operational document and billing support | Read-only |
| AI suggestion generate/apply (`POST .../ai-suggestions`, `.../ai-suggestions/apply`) | Full through `crm.read`/`crm.write` | Full through `crm.read`/`crm.write` | Full through `crm.read`/`crm.write` | Read-only (`crm.read`); cannot apply suggestions |
| Structured AI estimator draft/apply | Full through `billing.write` | Full through `billing.write` | Operational estimating support through `billing.write` | No write access |
| Notes and activity | Full | Full | Full | Can write notes and read activity |
| Brand Studio and settings | Full | Full | Supported through `settings.manage` and `company.manage` | No |

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

## Current auth-specific constraints

- first-owner provisioning creates an `owner`; this only happens once per identity — `POST /api/v1/auth/bootstrap` looks up an existing membership (by verified `authSubject`/email) before ever provisioning, so calling it again for an already-bootstrapped user (which the frontend now does on every login, not just at signup) returns their existing role and never creates a second organization or membership, and the client-supplied `organizationName` is ignored entirely once a membership already exists
- team invites are currently limited to `dispatcher` and `technician` roles
- compatibility values may still appear in stored memberships but are normalized during auth/session resolution
