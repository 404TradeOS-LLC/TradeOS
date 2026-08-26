---
status: archived
superseded_by: docs/modules/ai-estimate-assist.md
do_not_use_for_implementation: true
---

# AI Estimating Architecture

## Sprint 9 goal

Sprint 9 adds a production-ready AI-assisted estimating workflow that helps estimators understand scope, select likely assemblies and cost items, surface missing information, and prepare a review draft.

The AI does not price work.

The Estimate Engine remains the only pricing authority.

## Workflow

1. Dashboard
2. Customer
3. Project
4. New Estimate
5. AI Estimate Assist
6. Human Review
7. Estimate Builder
8. Proposal

## Core architecture

### 1. Scope intake

The estimator starts on the AI Estimate Assist page with a plain-language scope-of-work field.

The page also includes:

- example prompts
- voice-ready UX placeholder
- photo-upload placeholder

If the field is empty, the backend falls back to:

1. project `simpleScope`
2. seeded default validation scope

### 2. Deterministic runtime analysis

The assist workflow calls the read-only Knowledge Runtime.

Current runtime responsibilities:

- detect likely trade
- match assemblies
- match cost items
- calculate confidence
- explain rationale
- identify assumptions
- identify missing inputs
- produce review warnings

This remains deterministic and file-backed.

Out of scope:

- RAG
- vector search
- external AI calls
- knowledge writes

### 3. Suggestion drafting

The backend merges matched assemblies and matched cost items into a reviewed draft suggestion list.

Each suggestion includes:

- suggestion type
- title
- quantity
- unit
- confidence
- rationale
- estimate-target resolution state

### 4. Estimate target resolution

Knowledge Runtime records are not the same thing as app-owned `assembly` and `costItem` rows.

Before a suggestion can be added to an estimate, it must resolve to an app-owned estimate target.

Resolution order:

1. direct ID match if the record already exists in app-owned tables
2. reviewed name similarity match against assemblies or cost items in the org cost book
3. manual human selection in the UI when automatic resolution is not strong enough

This preserves the boundary that AI can suggest selections but cannot create pricing records.

### 5. Human review

Nothing auto-commits.

For every suggestion, the estimator can:

- accept
- reject
- edit quantity
- edit estimate description
- remap to an app-owned assembly or cost item

### 6. Estimate Builder handoff

Accepted suggestions are added through the existing Estimate Engine write path:

- `POST /api/v1/estimates/:id/ai-suggestions/apply`
- internally calls `EstimateEngineService.addLineItem(...)`

This keeps one pricing authority:

- pricing comes from the existing cost item and assembly databases
- roll-up math still happens in the Estimate Engine
- AI never invents prices

## Key backend files

- `app/modules/ai-estimate-assist/service.ts`
- `app/modules/ai-estimate-assist/types.ts`
- `app/backend/controllers/aiEstimateAssist.controller.ts`
- `app/backend/routes/aiEstimateAssist.routes.ts`
- `app/modules/knowledge-runtime/service.ts`
- `app/modules/estimate-engine/service.ts`

## Key frontend files

- `web/src/app/(app)/projects/[id]/estimates/[estimateId]/assist/page.tsx`
- `web/src/components/estimate-assist/ai-estimate-assist.tsx`
- `web/src/app/(app)/projects/[id]/estimates/[estimateId]/builder.tsx`
- `web/src/lib/api.ts`

## API shape

### Generate reviewed suggestions

`POST /api/v1/estimates/:id/ai-suggestions`

Returns:

- resolved scope text
- knowledge match payload
- reviewed draft suggestions

### Apply accepted suggestions

`POST /api/v1/estimates/:id/ai-suggestions/apply`

Request includes reviewed suggestions with:

- accepted/rejected/pending status
- edited quantity
- edited description
- selected app-owned target

Response includes:

- applied suggestions
- skipped suggestions

## Testing coverage

Sprint 9 verification covers:

- empty scope
- concrete driveway
- roofing replacement
- deck build
- tree removal
- rejected suggestions

## Known limitations

- Runtime matching is still deterministic and keyword-heavy.
- Automatic resolution from Knowledge Runtime records into app-owned estimate targets is best-effort, not perfect.
- Review feedback is not yet persisted as an audit log.
- Photo context and RAG remain intentionally out of scope.

## Sprint 10 recommendation

Focus Sprint 10 on:

1. persistent review feedback logging
2. stronger target resolution
3. scoped photo/transcript attachments without RAG
4. versioned import boundary design
