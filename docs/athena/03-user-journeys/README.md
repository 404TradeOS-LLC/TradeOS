---
status: current
owner: platform
last_verified: 2026-08-09
source_of_truth: true
---

# Volume 3 - User Journeys

The core journey rule is: no person should have to re-enter information that
another person already supplied. Athena carries verified facts forward and asks
only for missing, stale, contradictory, or approval-sensitive details.

## Owner Journey

| Stage | User need | Athena behavior | No re-entry rule |
| --- | --- | --- | --- |
| Morning review | Know what needs attention | Summarizes leads, jobs, overdue invoices, weather risk, and approvals | Reuses events, dashboard, calendar, dispatch, invoices |
| Margin review | Protect pricing | Flags estimates below margin rules and asks before final pricing changes | Reuses costbook, estimate, project, and org preferences |
| Approval | Authorize consequential action | Presents explicit approval card for invoice, contract, refund, permission, or cancellation | Shows record context and prior decisions |
| Follow-up | Keep customers warm | Recommends warranty, maintenance, and unpaid-invoice outreach | Reuses customer, invoice, warranty, and maintenance history |

## Dispatcher Journey

| Stage | User need | Athena behavior | No re-entry rule |
| --- | --- | --- | --- |
| Schedule prep | Fill the board | Suggests schedule options from approved jobs, durations, skills, geography, weather, and calendar constraints | Reuses proposal approval, job scope, technician assignment, and calendar context |
| Conflict handling | Avoid double-booking | Flags conflicts and prepares reschedule options | Reuses current dispatch state and job priority |
| Dispatch | Keep technicians informed | Drafts dispatch notes and reminders | Reuses customer, project, address, scope, photos, and safety notes |
| Recovery | Handle interruptions | Replans around no-shows, weather, or emergency jobs with approval as needed | Reuses existing assignments and field status |

## Estimator Journey

| Stage | User need | Athena behavior | No re-entry rule |
| --- | --- | --- | --- |
| Qualification | Understand the lead | Extracts scope, location, urgency, photos, and missing questions | Reuses lead intake and customer record |
| Estimate draft | Build pricing quickly | Retrieves costbook and Knowledge Runtime candidates, prepares a reviewable draft | Reuses captured scope and project details |
| Review | Avoid unsafe pricing | Marks assumptions, low confidence, missing dimensions, and margin warnings | Reuses org pricing preferences and costbook |
| Proposal handoff | Send clean proposal | Prepares proposal language from approved estimate | Reuses approved line items and customer preferences |

## Field Technician Journey

| Stage | User need | Athena behavior | No re-entry rule |
| --- | --- | --- | --- |
| Start day | Know where to go and what to bring | Briefs schedule, addresses, scope, materials, customer notes, and weather | Reuses dispatch, project, customer, inventory, and weather context |
| On site | Capture work evidence | Organizes notes, photos, blockers, and customer requests | Reuses job checklist and project scope |
| Change found | Escalate safely | Drafts change-order notes and routes approval | Reuses field evidence and pricing context |
| Completion | Close work cleanly | Prepares completion summary and invoice-ready facts | Reuses job status, photos, notes, and approved changes |

## Office Manager Journey

| Stage | User need | Athena behavior | No re-entry rule |
| --- | --- | --- | --- |
| Inbox/admin | Turn communication into work | Drafts replies, creates internal reminders, and links customers/projects | Reuses CRM and conversation context |
| Documents | Track proposal, contract, invoice state | Surfaces documents waiting on customer or internal action | Reuses lifecycle events and document state |
| Billing | Move cash forward | Drafts follow-ups and flags overdue invoices | Reuses invoice, payment, customer, and owner policy context |
| Maintenance | Build repeat business | Recommends recurring service outreach | Reuses warranty, job, equipment, and customer history |

## Cross-Persona Lifecycle

| Lifecycle stage | Owner | Dispatcher | Estimator | Technician | Office Manager | Athena continuity |
| --- | --- | --- | --- | --- | --- | --- |
| Lead | Reviews priority | Sees potential capacity impact | Gets scope hints | Notified only if field visit needed | Captures contact details | Creates or links customer/project |
| Qualification | Sets go/no-go policy | Advises schedule availability | Asks missing scope questions | Adds site facts if visited | Maintains CRM | Stores attributed requirements |
| Estimate | Reviews margin | Notes timing constraints | Builds draft | Provides field constraints | Tracks document readiness | Reuses qualified scope and costbook |
| Proposal | Approves sensitive terms | Plans tentative slot | Produces proposal-ready summary | No duplicate input | Sends/tracks proposal | Emits ProposalSent/Viewed |
| Customer Approval | Approves exceptions | Converts work to schedule | Clarifies scope changes | Prepares for work | Records customer response | Emits JobApproved |
| Scheduling | Sees capacity and revenue | Owns assignment | Supplies duration assumptions | Confirms availability | Sends reminders | Suggests schedule from existing facts |
| Dispatch | Monitors risk | Sends assignment | Answers scope questions | Receives job packet | Handles customer communication | No retyped address/scope/notes |
| Field Execution | Sees exceptions | Monitors status | Supports changes | Performs work | Logs customer updates | Emits TechnicianArrived/WorkStarted |
| Completion | Reviews profitability | Closes schedule | Reviews variance | Captures evidence | Prepares billing | Emits WorkCompleted |
| Invoice | Approves final pricing if needed | Confirms job complete | Explains variance | Supplies completion notes | Generates and tracks invoice | High-risk send approval |
| Payment | Reviews cash | No primary action | No primary action | No primary action | Records/follows up payment | Emits InvoicePaid |
| Warranty | Reviews liability | Schedules warranty work | Estimates warranty exceptions | Performs warranty visit | Tracks customer communication | Emits WarrantyActivated |
| Maintenance | Sets retention policy | Schedules recurring work | Estimates add-ons | Performs visit | Sends follow-up | Emits MaintenanceDue |
| Repeat Customer | Reviews relationship | Prioritizes schedule | Reuses history | Reuses job context | Maintains CRM | Starts new lifecycle from known facts |

## Handoff Matrix

| From | To | Required handoff payload |
| --- | --- | --- |
| Lead intake | Estimator | Customer, address, scope, photos, urgency, missing questions |
| Estimator | Owner | Estimate summary, margin flags, assumptions, approval risks |
| Owner | Office Manager | Approved proposal terms, customer-facing notes, send/hold decision |
| Customer approval | Dispatcher | Approved scope, preferred dates, constraints, deposit/payment state |
| Dispatcher | Technician | Job packet, address, contact, scope, photos, materials, safety notes |
| Technician | Office Manager | Completion notes, photos, customer signoff, exceptions |
| Office Manager | Owner | Invoice/payment status, collection risk, follow-up recommendation |

## Failure And Interruption Scenarios

| Scenario | Athena response |
| --- | --- |
| Missing context provider | Continue with partial context, mark unavailable provider, do not infer missing facts |
| Conflicting customer data | Present conflict with sources and request correction before write |
| Tool timeout | Retry only if idempotent; otherwise stop with pending-safe state |
| Permission denial | Explain missing capability without revealing inaccessible data |
| Customer changes scope | Draft change-order summary and require approval before price/contract impact |
| Technician loses connectivity | Queue local notes where supported; mark unsynced state clearly |
| Weather risk appears | Recommend reschedule or prep actions; approvals depend on impact |
| Payment/invoice error | Stop, preserve audit trail, and require owner/office review |
