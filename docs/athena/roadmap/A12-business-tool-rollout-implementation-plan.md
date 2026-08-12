---
status: draft
owner: platform
last_verified: 2026-08-11
source_of_truth: true
related_docs:
  - ../README.md
  - ../roadmap.md
  - ../06-tool-registry/README.md
  - ../09-security/README.md
  - ../10-events/README.md
  - A6-action-engine-implementation-plan.md
  - A8-event-integration-implementation-plan.md
  - A9-tool-sdk-implementation-plan.md
  - A10-observability-implementation-plan.md
  - A11-security-hardening-implementation-plan.md
  - ../../TRADEOS_BIBLE.md
---

# A12 Business Tool Rollout Implementation Plan

Milestone: A12 - Business Tool Rollout
Purpose: give Athena its first production, first-party business tools
(estimating, dispatch, office/customer, field technician, Costbook pricing
intelligence), built entirely on A1-A11 with no new framework, permission
system, event bus, telemetry, or security layer.

This is the first milestone where `A2 has no production tools registered
yet` (the comment this codebase carried since A1) stops being true. Every
tool here is real, calls a real application service, and is reachable from
`athena.controller.ts`.

## 1. Current business domain map

Confirmed by direct repo inspection (schema.prisma, `app/modules/**`,
`app/backend/controllers/**`) before any A12 code was written.

| Domain | Exists? | Service | Key methods used by A12 |
|---|---|---|---|
| Customer | Yes | `modules/crm/service.ts` (`CrmService`) | `getCustomer`, bounded `listCustomers`, `listNotes`, `createNote` |
| Project | Partially (model only; logic lives in controller + `project-tasks`) | `modules/project-tasks/service.ts` (`ProjectTasksService`) | `create` (follow-ups/tasks) |
| Estimate | Yes | `modules/estimate-engine/service.ts` (`EstimateEngineService`) | `create`, `getById`, `listByProject`, atomic `addLineItemAndRecalculate`, `finalize`, new `compareEstimates` |
| Invoice | Yes | `modules/invoices/service.ts` (`InvoicesService`) | `listByProject` (read-only use in A12; no invoice is created or sent by any A12 tool) |
| Dispatch/Job/Technician | Yes (most mature domain) | `modules/jobs/service.ts` (`JobsService`) | `getById`, `schedule`, `addAssignment`, `getScheduleConflicts`, `getDispatchSummary`, `update` (status), `listAssignments` |
| Costbook | Yes (large, pre-existing subsystem) | `modules/cost-database/service.ts`, `modules/assemblies-database/service.ts`, `modules/estimate-engine/formulas.ts` | `search`, `getUnitCost`, `getAssemblyUnitCost`, `sellPrice`/`marginFromMarkup` |
| Events (A8) | Registered, mostly unpublished before A12 | `modules/athena-events/{registry,service}.ts` | 16 canonical types registered; `ProposalSent` was the first production publisher before A12 |
| Permissions | App-level RBAC, coarse-grained | `domain/contracts.ts` | `DomainPermission` (11 values), 4 canonical roles |

## 2. Existing Athena capabilities (A1-A11, verified)

- A9 `defineTool()` -> A2 `AthenaToolDefinition`. No validation duplicate;
  A2's `assertValidToolDefinition()` remains the only runtime check.
- A2 registry (`createAthenaToolRegistry()`) had **zero production
  registration** before A12 - only tests/contract-kit built ad hoc
  registries. `athena.controller.ts` calls
  `service.handleRequest({...})` without a `toolRegistry`, so the kernel
  defaulted to an empty one.
- A6 `executeAthenaAction()` re-verifies A4's permission decision, takes
  `tool.risk`/`compensationPolicy` as authoritative, and executes under
  `raceWithTimeout`. No tool had driven it against a real business mutation
  before A12.
- A4 `evaluateAthenaPermission()`: `risk: "low"` -> `allow`;
  `"medium"|"high"` -> `approval_required`. Production has **no real
  caller-facing approval-verifier submission surface yet** (tracked as
  separate future work in the A6 plan) - so any tool marked
  medium/high risk cannot actually complete in production today.
- A8: publishing an unregistered `{type, version}` fails closed. Tools never
  publish; they wrap what a service already published via
  `athena-tool-sdk/events.ts`'s `eventRef()`.
- A10/A11: fully automatic for any tool dispatched through the kernel's
  normal plan/step loop (`athena-kernel/service.ts`) - action span, cost
  tracking, alert-rule coverage, the A11 risk-engine gate (secret-shaped
  input, prompt injection, cross-tenant reference, tool-trust), and
  telemetry redaction all apply with zero tool-authored code. A12 tools
  never call `recordAthenaTelemetry`, `evaluateAthenaSecurityRisk`,
  `detectSecrets`, or `redactSecrets` directly.

## 3. Missing business services (and how A12 closes the gap)

Identified gaps, and the minimal, in-domain fix applied (no unrelated
refactors, no new frameworks):

1. **No estimate/job business events were ever published.** Fixed by adding
   five `getDefaultAthenaEventService().publish(...)` call sites, following
   the exact non-blocking `try { publish } catch { console.error }` pattern
   `modules/proposals/service.ts`'s `send()` already established:
   - `EstimateEngineService.create()` -> `EstimateStarted`
   - `EstimateEngineService.finalize()` -> `EstimateCompleted`
   - `JobsService.schedule()` -> `JobScheduled`
   - `JobsService.addAssignment()` -> `TechnicianAssigned`
   - `JobsService.complete()` -> `WorkCompleted`
2. **No estimate comparison logic.** `EstimateEngineService` gets one new
   method, `compareEstimates(estimateIdA, estimateIdB, orgId)`, returning a
   cost/margin/line-item diff. Pure addition to an existing service, not a
   new module.
3. **No dedicated "prepare an invoice draft" computation.** `Invoice.Prepare`
   deliberately performs **no database write at all** - it composes a draft
   preview from `EstimateEngineService`/`InvoicesService` reads. This
   satisfies the spec's restriction ("must NOT send automatically... modify
   accounting records without approval") without requiring the not-yet-built
   production approval-verifier surface (see risk classification, section 5).
4. **`app/domain/contracts.ts`'s `DomainPermission` has no
   `estimate.write`/`pricing.view`-grade granularity.** A12 deliberately does
   **not** extend this enum - doing so touches RLS/role-matrix/docs far
   beyond A12's scope. Section 5 maps every A12 tool onto the existing 11
   permissions instead.
5. **`AthenaResourceRequest.entityType` (A4) only supports `"job"`
   object-scoping.** A12 does not extend it; all A12 tools rely on
   `ctx.orgId` + the underlying service's own `orgId`-scoped queries for
   tenant isolation, the same posture every non-Athena route already uses.

## 4. Tool catalog (19 tools, 5 domains)

All IDs follow `tradeos.athena.tools.<domain>.<action>`, version `1.0.0`,
owner `athena-tools-<domain>`, module `app/modules/athena-tools/<domain>/`.

### Estimator (`athena-tools-estimator`)

| Tool ID suffix | Service call | Mutates? | Permission | Risk | Event |
|---|---|---|---|---|---|
| `estimator.create-estimate` | `EstimateEngineService.create` | yes (draft) | `billing.write` | low | `EstimateStarted` |
| `estimator.update-estimate` | `EstimateEngineService.addLineItemAndRecalculate` | yes (draft, atomic) | `billing.write` | low | none (not final) |
| `estimator.analyze-estimate` | `EstimateEngineService.getById` + `formulas.ts` margin math | no | `billing.read` | low | none |
| `estimator.compare-estimates` | `EstimateEngineService.compareEstimates` (new) | no | `billing.read` | low | none |

### Dispatcher (`athena-tools-dispatcher`)

| Tool ID suffix | Service call | Mutates? | Permission | Risk | Event |
|---|---|---|---|---|---|
| `dispatcher.schedule-job` | `JobsService.schedule` | yes | `dispatch.manage` | low | `JobScheduled` |
| `dispatcher.assign-technician` | `JobsService.addAssignment` | yes | `dispatch.manage` | low | `TechnicianAssigned` |
| `dispatcher.optimize-day` | `JobsService.getDispatchSummary` + `getScheduleConflicts` using the summary's organization-local day range | no | `dispatch.manage` | low | none |
| `dispatcher.weather-impact` | reads `aiContext.weather` (A3 provider section) | no | `dispatch.manage` | low | none |

`weather-impact` explicitly does not call any external weather API - A3's
`weather` provider section is a real, typed extension point
(`athena-context-engine/types.ts`'s `ATHENA_CONTEXT_SECTIONS`) that A1
never populates yet. The tool reads whatever the context engine supplies and
returns a clear "no weather context available" result when it is empty,
per this rollout's explicit "do not invent external integrations" rule.

### Office Manager (`athena-tools-office`)

| Tool ID suffix | Service call | Mutates? | Permission | Risk | Event |
|---|---|---|---|---|---|
| `office.search-customers` | bounded `CrmService.listCustomers({ query, limit })`/`getCustomer` | no | `crm.read` | low | none |
| `office.summarize-customer` | `CrmService.getCustomer` + `listNotes` | no | `crm.read` | low | none |
| `office.create-follow-up` | `ProjectTasksService.create` | yes | `notes.write` | low | none (no canonical event registered for tasks) |
| `office.prepare-invoice` | `EstimateEngineService.getById` + `InvoicesService.listByProject` (read-only compose) | no | `billing.write` | low | none |

### Field Technician (`athena-tools-field`)

| Tool ID suffix | Service call | Mutates? | Permission | Risk | Event |
|---|---|---|---|---|---|
| `field.job-context` | `JobsService.getById`, explicitly minimized before crossing the AI boundary | no | `crm.read` | low | none |
| `field.update-job-status` | `JobsService.update`/transition methods | yes | `[]` (JobsService's own `assertFieldWorker`/`assertManager` is the real authorization layer, same posture as `recallPreferenceTool`'s empty `permissions`) | low | `WorkCompleted` only when the transition is to `completed` (delegates to the already-wired `JobsService.complete`) |
| `field.add-note` | `CrmService.createNote` (`entityType: "job"`) | yes | `notes.write` | low | none |
| `field.create-recommendation` | pure computation over `JobsService.getById` output, no persistence | no | `crm.read` | low | none |

### Costbook Intelligence (`athena-tools-costbook`)

| Tool ID suffix | Service call | Mutates? | Permission | Risk | Event |
|---|---|---|---|---|---|
| `costbook.lookup` | `CostDatabaseService.search` + `AssembliesDatabaseService.search` | no | `billing.read` | low | none |
| `costbook.analyze-margin` | `CostDatabaseService.getUnitCost` + `formulas.ts`'s `marginFromMarkup` | no | `billing.read` | low | none |
| `costbook.recommend-price` | `CostDatabaseService.getUnitCost` + `formulas.ts`'s `sellPrice` | no (recommendation only, never writes `CostItem`/`Material` pricing) | `billing.read` | low | none |

## 5. Risk/approval classification rationale

Every A12 tool is `risk: "low"`. This is a deliberate reading of this
rollout's own "Approval Requirements" section, not a shortcut:

- "Athena may automatically: search, summarize, analyze, recommend,
  **prepare drafts**." Every mutating tool above creates or updates
  internal, reversible, draft/operational state (a draft estimate, a
  scheduled job, a technician assignment, a task, a job note) - never a
  sent proposal, a finalized/sent invoice, a changed stored price, or any
  outbound customer communication.
- "Athena requires approval for: sending customer messages, sending
  invoices, changing prices, destructive actions, external commitments,
  financial actions." None of the 19 tools does any of these. `Invoice.Prepare`
  and `Costbook.RecommendPrice` are read-only by construction specifically
  so they never cross into that category.
- A4's policy escalates `risk: "medium"|"high"` straight to
  `approval_required`, which production cannot yet verify (no real
  approval-submission surface exists - see section 3). Marking an
  in-scope-per-spec "automatic" capability as medium/high would make it
  permanently unusable, not more secure. If a future milestone adds a tool
  that actually sends/finalizes/changes prices, it must be classified
  `medium`/`high` and that approval-verifier surface becomes a hard
  prerequisite for it - explicitly out of scope for A12.

`confirmationPolicy` is `"never"` for pure reads and `"contextual"` for the
in-domain mutations, as UI-facing metadata only (A4 does not consult it).

## 6. Event model

A12 tools only ever *reference* events already published by the application
service they call (`eventRef(type, id)` from `athena-tool-sdk/events.ts`).
Every event type used above is drawn from A8's existing canonical registry
(`athena-events/registry.ts`) - `EstimateStarted`, `EstimateCompleted`,
`JobScheduled`, `TechnicianAssigned`, `WorkCompleted` - not new, illustrative
names. No A12 tool or service publishes an unregistered event type; A8
already fails closed on that. Event payload values use public DTO-normalized
numbers/ISO timestamps rather than raw persistence-layer `Decimal`/`Date`
values.

## 7. Module/file layout convention (owned by this plan, for every future tool)

```text
app/modules/athena-tools/
  registry.ts              # createProductionAthenaToolRegistry(): AthenaToolRegistry
  index.ts                 # barrel
  estimator/*.tool.ts
  dispatcher/*.tool.ts
  office/*.tool.ts
  field/*.tool.ts
  costbook/*.tool.ts
app/tests/
  athena-tools.<domain>.<action>.contracts.test.ts
```

## 8. How to add a new Athena business tool (9 steps)

Same sequence `docs/athena/06-tool-registry/README.md`'s "Create your first
Athena tool" already documents, made concrete for business domains:

1. Identify the application service method the tool calls. Never Prisma
   directly.
2. Define the input with a real Zod schema in the tool file.
3. Declare `permissions`/`risk`/`confirmationPolicy`/`timeoutMs`/
   `idempotency`/`compensationPolicy` per the tables in section 4-5 of this
   doc (or extend the table for a new capability).
4. Inject the service(s) as explicit constructor params on a
   `create<Name>Tool(deps)` factory - never a global locator.
5. Implement `execute()`, returning `successResult()`/`failureResult()`
   from the public `athena-tool-sdk` entrypoint.
6. If the service call published a canonical event, wrap its `{type, id}`
   with `eventRef()` in the result's `events`. Never publish directly.
7. Register the tool in `app/modules/athena-tools/registry.ts`.
8. Add `describeAthenaToolContract(tool, { validInput, invalidInputs })`
   from `athena-tool-sdk/contractTestKit.ts` in a
   `athena-tools.<domain>.<action>.contracts.test.ts` file.
9. If the tool's underlying service needed a new method, add it to the
   existing service module, never a parallel one.

## 9. Subagent assignments

- Subagent (primary/self): framework (`registry.ts`, this doc, event
  publishing wired into `estimate-engine/service.ts` and `jobs/service.ts`),
  kernel wiring (`athena.controller.ts`), final integration/verification.
- Subagent 2: Estimator (4 tools + `compareEstimates` + contract tests).
- Subagent 3: Dispatcher (4 tools + contract tests).
- Subagent 4: Office Manager (4 tools + contract tests).
- Subagent 5: Field Technician (4 tools + contract tests).
- Subagent 6: Costbook Intelligence (3 tools + contract tests).
- Subagent 7 (primary/self): adversarial security/architecture review of
  all of the above before commit.

## 10. Explicit exclusions (unchanged from the rollout brief)

No Plugin SDK, marketplace, voice assistant, mobile app, accounting
replacement, payment processing, autonomous pricing changes, autonomous
customer communication, unrestricted autonomous behavior, ERP replacement,
and no A13+ work.
