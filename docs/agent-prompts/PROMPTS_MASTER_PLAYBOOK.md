---
status: current
owner: platform
last_verified: 2026-08-18
source_of_truth: false
related_code:
  - scripts/prompt-manager.mjs
  - scripts/prompt-manager-lib.mjs
  - scripts/__tests__/prompt-manager.test.mjs
  - package.json
---

# TradeOS Prompt Manager & Operational Playbook

This document serves as the master reference and registry for all AI engineering, maintenance, and architecture prompts across **Gemini**, **Claude Code (in WebStorm)**, and **ChatGPT**.

This is a convenience layer over prompt *text*, not a competing policy document. The canonical startup/completion flows, RBAC, and merge policy remain owned by `docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md`, `AGENTS.md`, and `docs/REPOSITORY_GOVERNANCE.md`; several templates below restate specific procedural detail (exact validation commands, tenancy rules) inline for copy-paste convenience, so treat those details as a snapshot, not the source of truth — if a template and the real canonical doc ever disagree, the canonical doc wins.

---

## 🚀 Fast Usage (Interactive CLI)

You can launch the interactive prompt builder directly from your terminal or WebStorm:

```bash
# Launch interactive menu
npm run prompt

# List all available prompt IDs
npm run prompt list

# View prompt variables & template
npm run prompt show <prompt-id>

# Copy rendered prompt directly to macOS clipboard
npm run prompt copy <prompt-id>

# Customize parameters inline (the -- separator is required so npm forwards
# these flags to the script instead of swallowing them as npm's own config)
npm run prompt -- copy backend --FEATURE_NAME="Job Assignments" --PERMISSION_KEY="jobs.write"
```

---

## 📋 Catalog of Registered Prompts

| Prompt ID | Category | Primary Target | Description |
| :--- | :--- | :--- | :--- |
| `startup` | Workflow & Governance | Claude Code / ChatGPT | Canonical startup flow, branch check, overlap verification |
| `backend` | Backend Engineering | Claude Code / ChatGPT | Express routes, services, RLS boundaries, and `runInDatabaseTransaction` |
| `database-rls` | Database & Security | Gemini / Claude Code | Prisma migrations, Supabase forced RLS policies, cent-safety |
| `frontend` | Frontend Engineering | Claude Code / ChatGPT | Next.js App Router, Tailwind, honest loading/empty/error states |
| `auth-supabase` | Authentication & Security | Gemini / Claude Code | Supabase JWT verification, session resolution, `/finish-setup` |
| `vercel-cloudflare` | Infrastructure & Deployment | Gemini / Claude Code | Vercel serverless packaging, proxy middleware, CORS, Cloudflare |
| `athena-tool` | AI & Athena Subsystems | Claude Code / ChatGPT | First-party Athena business tools, idempotency, event outbox |
| `bugfix` | Maintenance & Debugging | Claude Code / ChatGPT | Root-cause analysis, surgical minimal fix, automated regression tests |
| `pr-gate` | Quality Assurance & CI | All Agents | Pre-PR diff audit, full test matrix execution, RLS tenant audit |
| `docs-handoff` | Documentation & State | All Agents | Atomic update to `CURRENT_STATE.md` and `SESSION_HANDOFF.md` |

---

## 🛠️ Prompt Templates & Specifications

### 1. `startup` — Session Startup & Autonomy Reconciliation
- **When to use**: Before any coding session with Claude Code in WebStorm or ChatGPT.
- **Variables**: `ALLOWED_PATHS`, `FORBIDDEN_PATHS`, `MISSION_GOAL`
```markdown
Execute the Canonical Startup Flow in `docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md` before making any edits:
1. Verify the current git branch, HEAD commit, and working tree state.
2. Read `docs/TRADEOS_BIBLE.md` and `docs/CURRENT_STATE.md` as sources of truth.
3. Check open PRs and `docs/SESSION_HANDOFF.md` for active lane collisions.
4. Output your understanding of:
   - Target Scope & Allowed Paths: {{ALLOWED_PATHS}}
   - Forbidden Paths: {{FORBIDDEN_PATHS}}
   - Mission Goal: {{MISSION_GOAL}}
   - Planned Verification Commands
Do not generate code diffs until this startup check is reported and confirmed.
```

---

### 2. `backend` — Backend Service & API Route Implementation
- **When to use**: Adding or refactoring Express controllers, routes, or services in `app/`.
- **Variables**: `FEATURE_NAME`, `CONTROLLER_PATH`, `ROUTE_PATH`, `MODULE_PATH`, `PERMISSION_KEY`
```markdown
Implement the backend changes for {{FEATURE_NAME}} in `app/`:
- Allowed Paths: `{{CONTROLLER_PATH}}`, `{{ROUTE_PATH}}`, `{{MODULE_PATH}}/**`
- Rules & Constraints:
  1. Tenancy: Enforce organization scoping strictly from request context (`req.orgId`). Never trust caller-supplied `organizationId`.
  2. Permissions: Gate endpoints with `requirePermissions('{{PERMISSION_KEY}}')`.
  3. Database Transactions: Use `runInDatabaseTransaction()` from `app/db/requestSession.ts`. Do NOT call `prisma.$transaction()` directly.
  4. Validation: Use strict Zod schemas rejecting unknown fields (`.strict()`).
  5. Audit & Telemetry: Record timeline events via `ActivityTimelineService` where appropriate.
- Tests: Add unit tests under `app/tests/` covering success, validation rejection (400), unauthorized access (403), and missing resources (404).
- Verification: Run `cd app && npm test && npm run lint && npm run build`.
```

---

### 3. `database-rls` — Supabase Postgres Migration & Forced RLS Hardening
- **When to use**: Creating tables or modifying database schema on Supabase Postgres.
- **Variables**: `TABLE_NAME`, `MIGRATION_NAME`, `MANAGE_HELPER`
```markdown
Design a Prisma migration and Supabase PostgreSQL RLS policy for `{{TABLE_NAME}}`:
- Constraints:
  1. Migration File: Generate under `app/prisma/migrations/YYYYMMDDHHMMSS_{{MIGRATION_NAME}}/migration.sql`.
  2. RLS Enforcement: Add `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` to `{{TABLE_NAME}}`.
  3. Tenant Policy: Restrict SELECT/INSERT/UPDATE/DELETE to authenticated organizations using helper functions (e.g., `{{MANAGE_HELPER}}`). Pin all helper functions to `SET search_path = ''`.
  4. Role Boundaries: Ensure the `tradeos_app` runtime role has correct grants without bypassing RLS (`rolbypassrls: false`).
  5. Precision: Use `numeric(10,2)` or integer cents for currency fields; avoid floating-point types.
- Verification: Verify schema consistency via `npx prisma validate` and add regression test coverage for cross-tenant isolation in `app/tests/rls.integration.ts`.
```

---

### 4. `frontend` — Frontend Component & Next.js App Router Engineering
- **When to use**: Building UI in `web/` using Tailwind and Server Actions.
- **Variables**: `PAGE_NAME`, `ROUTE_PATH`, `COMPONENT_PATH`, `ACTION_PATH`
```markdown
Implement the UI for {{PAGE_NAME}} in `web/`:
- Allowed Paths: `{{ROUTE_PATH}}/**`, `{{COMPONENT_PATH}}/**`, `{{ACTION_PATH}}`
- Rules & Constraints:
  1. App Router & Layout: Adhere to standard PageHeader, Card, and Badge primitives from `web/src/components/ui/` and `web/src/components/shared/`.
  2. Honest State Degradation: Do not fabricate placeholder data. Implement explicit loading skeletons (`loading.tsx`), empty states (`EmptyState`), and error fallbacks.
  3. Server Actions & Security: Verify Supabase user session server-side. Never import `SUPABASE_SERVICE_ROLE_KEY` into browser bundles (guarded by `web/src/lib/envSecurity.test.ts`).
  4. Mobile & Desktop Responsive: Ensure tables include `min-w-[820px]` desktop styling with mobile card list alternatives (`hidden md:block` / `md:hidden`).
- Verification: Run `cd web && npm test && npm run lint && npm run build`.
```

---

### 5. `auth-supabase` — Supabase Auth, Session & Finish-Setup Debugging
- **When to use**: Fixing login issues, session refreshes, or user bootstrap.
- **Variables**: `AUTH_SCENARIO`
```markdown
Diagnose and repair the authentication / session issue with {{AUTH_SCENARIO}}:
- Context:
  - Frontend proxy: `web/src/proxy.ts` / `web/src/lib/supabase/proxy.ts`
  - Backend JWT verification: `app/backend/auth/jwt.ts` (RS256 JWKS via `jose ^4.15.9`)
  - Bootstrap endpoint: `POST /api/v1/auth/bootstrap` & `AuthService.bootstrapSupabaseIdentity`
- Requirements:
  1. Inspect the session resolution sequence (`app.login_lookup` -> `app.user_id` -> `app.org_id`).
  2. Ensure unprovisioned identities without an organization gracefully redirect to `/finish-setup` with `details.code: 'organization_name_required'`.
  3. Confirm Server Actions properly forward auth cookies and bearer tokens.
  4. Provide regression tests in `app/tests/auth.service.test.ts` or `app/tests/jwt.supabase.test.ts`.
```

---

### 6. `vercel-cloudflare` — Vercel & Cloudflare Production Diagnostics
- **When to use**: Diagnosing deployment errors, proxy headers, CORS, or bundle packaging.
- **Variables**: `ERROR_LOGS`

````markdown
Investigate this Vercel / Cloudflare runtime error:
```
{{ERROR_LOGS}}
```

Check against known TradeOS deployment contracts:
1. Proxy & Middleware: Ensure `web/src/proxy.ts` matcher excludes public routes (`/login`, `/signup`) and covers all `(app)` routes.
2. CORS & Proxy Headers: Verify `TRUST_PROXY=1` configuration and `isAllowedCorsOrigin` in `app/backend/middleware/productionHardening.ts`.
3. Serverless Packaging: Confirm sibling packages like `packages/knowledge-engine` are vendored via `app/scripts/vendor-knowledge-engine.js` if accessed by backend Lambdas.
4. Turbopack Root: Ensure `turbopack.root` in `web/next.config.ts` correctly spans the repository root.
Report the exact root cause, proposed minimal fix, and affected files.
````

---

### 7. `athena-tool` — Athena AI Kernel & Business Tool Implementation
- **When to use**: Registering new low-risk operational tools in Athena.
- **Variables**: `TOOL_NAME`, `TARGET_SERVICE`, `RISK_LEVEL`
```markdown
Implement a new Athena business tool: `{{TOOL_NAME}}`
- Target Directory: `app/modules/athena-tools/`
- Architecture Guidelines:
  1. Tool Definition: Use `defineTool()` wrapper around `{{TARGET_SERVICE}}`. Do NOT query Prisma directly.
  2. Risk Level: Set to `risk: '{{RISK_LEVEL}}'` for reversible internal drafts/operational changes.
  3. Idempotency: Bind actions to `AthenaIdempotencyStore` with organization/actor execution keys.
  4. Event Integration: If emitting canonical events, use the atomic outbox persistence in `app/modules/athena-events`.
  5. Telemetry & Observability: Ensure actions inherit `spanType` and error codes compatible with `app/modules/athena-observability`.
- Tests: Add tool unit tests in `app/tests/athena-tools.test.ts` verifying input validation and service execution.
```

---

### 8. `bugfix` — Isolated Bug Fix & Root-Cause Analysis
- **When to use**: Fixing a specific defect safely without breaking adjacent systems.
- **Variables**: `MODULE_NAME`, `BUG_DESCRIPTION`

````markdown
We have a bug in {{MODULE_NAME}}:
```
{{BUG_DESCRIPTION}}
```

Follow this three-step remediation protocol:
1. Root-Cause Analysis: Identify the exact line and condition causing the failure. Explain why existing unit tests did not catch it.
2. Minimal Surgical Fix: Apply the fix without modifying unrelated files, refactoring existing contracts, or altering database schemas.
3. Regression Test: Write a dedicated automated test in `app/tests/` or `web/src/` that reproduces the bug on unpatched code and passes on patched code.
Run verification commands to prove zero regressions.
````

---

### 9. `pr-gate` — Pre-PR Sanity Check & Verification Gate
- **When to use**: Auditing your branch before opening or merging a PR.
- **Variables**: `BRANCH_NAME`
```markdown
Perform the Canonical Pre-PR Verification Gate on branch `{{BRANCH_NAME}}`:
1. Inspect full `git diff main` to ensure no debug code, secrets, lockfile noise, or unapproved files were changed.
2. Execute full validation suite:
   - Backend: `cd app && npm test && npm run lint && npm run build`
   - Frontend: `cd web && npm test && npm run lint && npm run build`
   - Docs Governance: `npm run docs:check`
3. Check Multi-Tenant Safety: Verify no route bypasses RLS or accepts unverified tenant IDs.
4. Output a summary table with:
   - Files Modified
   - Tests Passing / Blocked
   - Remaining Known Risks or Tech Debt
```

---

### 10. `docs-handoff` — Sprint Handoff & Documentation Reconciliation
- **When to use**: Concluding a sprint and updating repository state.
- **Variables**: `FEATURE_OR_SPRINT`
```markdown
Update repository documentation following the completion of {{FEATURE_OR_SPRINT}}:
1. Update `docs/CURRENT_STATE.md`:
   - Add the verified implementation facts and file paths under "Recent verified changes".
   - Note any new blockers or unresolved technical debt.
2. Update `docs/SESSION_HANDOFF.md`:
   - State the current mission status, merged commit SHAs, and active out-of-band PRs.
   - Set "Next Eligible Sprint" based on `docs/SPRINT_BACKLOG.md`.
3. Update `docs/DOC_OWNERSHIP.yml` if new files or modules were introduced.
Ensure documentation reflects exact repository reality without forward-looking claims.
```
