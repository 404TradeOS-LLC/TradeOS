---
status: archived
superseded_by: docs/WORKFLOW_LIFECYCLES.md
do_not_use_for_implementation: true
---

# Project Lifecycle

This document is preserved as a historical planning artifact.

Warning: it predates the current source-of-truth hierarchy and should not be used for implementation decisions. Current lifecycle truth lives in `docs/WORKFLOW_LIFECYCLES.md`, `docs/modules/projects.md`, and `docs/CURRENT_STATE.md`.

## Goal

TradeOS is moving from an estimating platform into a project lifecycle platform for contractors.

The project workspace is now the single operating hub for each job:

`Lead -> Opportunity -> Estimate -> Proposal -> Contract -> Active Job -> Field Execution -> Change Orders -> Closeout -> Warranty -> Archived`

## Lifecycle stages

### Lead

- Initial customer and project record
- Basic scope and address
- No committed estimate or field data yet

### Opportunity

- Qualified project worth pursuing
- Scope is being clarified
- Customer, address, and early notes are in place

### Estimate

- One or more estimate versions exist
- Costing and review are in progress
- AI estimate assist can support line-item decisions

### Proposal

- Customer-facing scope, assumptions, exclusions, timeline, and pricing are assembled
- Proposal can be sent, viewed, accepted, declined, or expired

### Contract

- Accepted proposal becomes a signable agreement
- Signature capture, timestamp, and audit detail are tracked

### Active Job

- Work is awarded and ready for execution
- Project workspace becomes the operational source of truth

### Field Execution

- Site visits capture structured operational context
- Photos, customer notes, materials needed, safety notes, and punch items stay attached to the project
- Lightweight tasks help coordinate field follow-through

### Change Orders

- Scope changes are created against the project
- Change orders can be priced, approved, rejected, and compared against the original estimate context
- Cost delta and schedule impact stay visible in the workspace

### Closeout

- Final invoice and project-completion items are tracked
- Documents, signatures, and field records remain bundled to the project

### Warranty

- Warranty is now part of the lifecycle model and workspace structure
- First-class warranty claims are still future work

### Archived

- Completed projects can remain readable without staying in the active operations queue

## Project Workspace

Each project now has a tabbed workspace with:

- Overview
- Estimate History
- Proposals
- Contracts
- Invoices
- Photos
- Documents
- Site Visits
- Tasks
- Change Orders
- Timeline
- Warranty
- Notes
- Activity

This keeps estimating, documents, field capture, and operational coordination in one route instead of scattering them across disconnected tools.

## Timeline model

The timeline currently derives events from existing source records, including:

- Customer Created
- Project Created
- Estimate Created
- Site Visit Captured
- Proposal Sent, Viewed, Accepted, or Declined
- Contract Created or Signed
- Invoice Generated, Sent, Due, or Paid
- Change Order Created, Approved, or Rejected
- Attachment Added
- Task Created or Completed

This gives the workspace a useful chronological narrative today without introducing a separate event-log subsystem yet.

## Future AI integration

Structured site visits are the key future AI intake source.

The current model already preserves:

- field measurements
- transcript-ready notes
- customer notes
- materials needed
- safety notes
- punch list
- linked photos

That data can later feed:

- stronger proposal drafts
- scope-gap detection
- change-order suggestions
- closeout and warranty checklists
- future knowledge-engine feedback loops

## What is intentionally deferred

The lifecycle expansion still avoids:

- scheduling
- payroll
- accounting
- inventory
- CRM rewrites

TradeOS is extending the existing architecture, not replacing it.
