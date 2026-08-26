---
status: archived
superseded_by: docs/PRODUCT_SCOPE.md
do_not_use_for_implementation: true
---

# TradeOS MVP Foundation Plan

## Product Frame

TradeOS MVP focuses on one narrow job-to-proposal workflow:

1. Login or signup
2. Create or select a customer
3. Create a project
4. Capture a simple scope
5. Save site visit notes, measurements, and photos
6. Ask AI follow-up questions
7. Generate a branded proposal draft
8. Reopen and continue the same project later

Core rule: the customer record owns the relationship, the project record owns the job, and AI writes back to the project context instead of living in a separate chat silo.

## Architecture Decision

The current repo already has a strong multi-tenant backbone:

- `organizations` is the company/account boundary
- `users` plus `organization_memberships` handles authentication and roles
- `customers`, `projects`, `proposals`, `contracts`, `cost_items`, and `assemblies` already exist

Instead of replacing that foundation, the MVP should extend it into a cleaner project-centered workflow. In practice:

- `organizations` acts as the `companies` table in the product model
- `users` plus membership keeps the current auth model
- `projects` becomes the primary AI workspace
- new `site_visits` and `project_files` complete the intake loop
- `proposals` evolves from estimate-only output into a project-scoped proposal draft

## Target Data Model

### Existing tables to extend

- `organizations`
  - add `logo_url`
  - add `phone`
  - add `email`
  - add `address`
  - add `default_labor_rate`
  - add `default_markup_percent`

- `customers`
  - add `address`
  - add `notes`

- `projects`
  - keep current `id`, `org_id`, `customer_id`
  - add `title`
  - add `job_type`
  - add `project_address`
  - add `simple_scope`
  - keep `status`, but normalize around:
    - `lead`
    - `site_visit`
    - `proposal_draft`
    - `proposal_sent`
    - `accepted`
    - `in_production`
    - `completed`
    - `lost`

- `proposals`
  - allow project-first creation without requiring a finalized estimate
  - add `scope_of_work`
  - add `assumptions`
  - add `exclusions`
  - add `timeline`
  - add `price_low`
  - add `price_high`
  - add `final_price`
  - add `payment_schedule_json`
  - add `pdf_url`

- `contracts`
  - keep current structure
  - later align naming with `signed_status` if needed

### New tables

- `site_visits`
  - `id`
  - `project_id`
  - `transcript`
  - `notes`
  - `measurements_json`
  - `ai_questions_json`
  - `missing_info_json`
  - `confidence_score`
  - `created_at`
  - `updated_at`

- `project_files`
  - `id`
  - `project_id`
  - `file_type`
  - `file_url`
  - `file_name`
  - `storage_path`
  - `created_at`

## API Plan

### Auth

- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/login`

### Customers

- `GET /api/v1/customers`
- `POST /api/v1/customers`
- `GET /api/v1/customers/:id`
- `PATCH /api/v1/customers/:id`
- `DELETE /api/v1/customers/:id`

### Projects

- `GET /api/v1/projects`
- `POST /api/v1/projects`
- `GET /api/v1/projects/:id`
- `PATCH /api/v1/projects/:id`
- `PATCH /api/v1/projects/:id/status`

### Site Visit Intake

- `GET /api/v1/projects/:id/site-visits`
- `POST /api/v1/projects/:id/site-visits`
- `PATCH /api/v1/site-visits/:id`

Behavior:

- Stores typed notes today
- Accepts `transcript` now so voice transcription can plug in later
- Generates and stores follow-up questions plus missing info on save

### Project Files

- `GET /api/v1/projects/:id/files`
- `POST /api/v1/projects/:id/files`

Phase 1 behavior:

- Save metadata to `project_files`
- Storage upload can be direct-to-Supabase or server-mediated in the next pass

### Proposals

- `GET /api/v1/proposals/by-project/:projectId`
- `POST /api/v1/proposals`
- `GET /api/v1/proposals/:id`
- `PATCH /api/v1/proposals/:id`
- `POST /api/v1/proposals/:id/send`
- `POST /api/v1/proposals/:id/mark-viewed`
- `POST /api/v1/proposals/:id/accept`
- `POST /api/v1/proposals/:id/reject`
- `GET /api/v1/proposals/:id/pdf`

Creation modes:

- legacy estimate-driven creation
- new project-driven creation from the latest project + site visit context

## AI Service Plan

Create a lightweight project-intake service boundary now:

- input:
  - project title
  - simple scope
  - job type
  - site visit notes
  - transcript
  - measurements
- output:
  - normalized project type
  - follow-up questions
  - missing info list
  - draft scope of work
  - assumptions
  - exclusions
  - timeline suggestion
  - rough price band if confidence is high enough

Implementation approach:

- first pass: deterministic rules and heuristics
- next pass: OpenAI-backed enrichment behind the same service interface
- always persist generated questions and derived output back to the project records

## Frontend Folder Structure

### Current

- `web/src/app/login/page.tsx`
- `web/src/app/signup/page.tsx`
- `web/src/app/(app)/customers/page.tsx`
- `web/src/app/(app)/projects/page.tsx`

### Recommended additions

- `web/src/app/(app)/customers/[id]/page.tsx`
- `web/src/app/(app)/projects/[id]/page.tsx`
- `web/src/app/(app)/projects/[id]/intake/page.tsx`
- `web/src/app/(app)/projects/[id]/proposal/page.tsx`
- `web/src/app/(app)/projects/[id]/proposal/preview/page.tsx`

### Supporting directories

- `web/src/components/projects/`
  - `project-create-form.tsx`
  - `project-status-badge.tsx`
  - `site-visit-form.tsx`
  - `ai-questions-panel.tsx`
  - `proposal-review-form.tsx`

- `web/src/components/customers/`
  - `customer-form.tsx`
  - `customer-summary-card.tsx`

- `web/src/components/proposals/`
  - `proposal-preview.tsx`
  - `proposal-price-summary.tsx`
  - `proposal-acceptance-block.tsx`

- `web/src/lib/`
  - `api.ts`
  - `project-status.ts`
  - `proposal-formatters.ts`

## Coding Roadmap

### Phase 1: Foundation

1. Extend Prisma schema for the project-centered MVP fields
2. Add migration SQL with RLS for new tables
3. Regenerate Prisma client
4. Extend customer and project CRUD validation
5. Add site visit service, controller, and routes
6. Add project file metadata routes
7. Evolve proposal service to support project-first draft generation

### Phase 2: Thin frontend flow

1. Customer detail page
2. Project detail page
3. Site visit intake page
4. Proposal review page
5. PDF preview page

### Phase 3: AI integration hardening

1. Replace heuristics with OpenAI-backed prompt flow
2. Add transcript ingestion path
3. Add photo upload + signed URLs with Supabase Storage
4. Add proposal regeneration from updated project context

## Immediate Build Scope

The first coding pass in this repo should deliver:

- extended schema for companies, customers, projects, proposals
- new `site_visits` and `project_files`
- backend CRUD for project-centered intake
- project-first proposal draft generation
- enough API shape for the frontend to build:
  - `New Project -> Customer Info -> Simple Scope -> AI Questions -> Proposal`
