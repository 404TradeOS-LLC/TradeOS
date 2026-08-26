---
status: archived
superseded_by: docs/WORKFLOW_LIFECYCLES.md
do_not_use_for_implementation: true
---

# Document Workflow

## Summary

TradeOS now supports a connected document lifecycle that stays inside the existing project-first architecture:

`Estimate -> Proposal -> Customer Review -> Accepted -> Contract -> Signature -> Invoice -> Payment Status`

The workflow is intentionally not accounting software and intentionally does not include payment processing yet.

## Proposal lifecycle

### Source

Proposals are created from:

- an estimate-backed workflow, or
- a project-first draft built from site-visit context

### Statuses

Stored backend statuses:

- `draft`
- `sent`
- `viewed`
- `accepted`
- `rejected`

UI-derived statuses:

- `declined` from `rejected`
- `expired` when a sent or viewed proposal ages beyond the validity window

### Supported actions

- edit draft
- preview PDF
- download PDF
- send
- resend
- mark viewed
- accept
- decline
- duplicate into a new draft

## Contract lifecycle

### Entry point

Contracts are created only from accepted proposals.

### Captured data

- terms text
- typed signer name
- signer email
- drawn signature image
- timestamp
- IP placeholder

### Statuses

- `pending_signature`
- `signed`
- `voided`

### Outputs

- signed contract page
- contract audit trail view
- downloadable PDF

## Invoice lifecycle

### Entry point

Invoices are created from project context and can reference:

- an estimate
- a proposal
- full billing
- progress billing

### Supported states

Stored or derived states surfaced in the UI:

- Draft
- Sent
- Viewed placeholder
- Paid
- Partially Paid placeholder
- Overdue
- Cancelled

Current backend write actions support draft, sent, paid, and void. Overdue is derived from due date, and partial-payment or viewed states remain future placeholders until payment records exist.

### Current capabilities

- invoice detail page
- progress invoice summary
- final invoice summary
- running balance
- payment-history placeholder
- credit memo placeholder
- downloadable PDF

## Customer interactions

Sprint 10 adds a simplified customer portal mode inside the existing authenticated app shell.

Portal routes:

- `/portal/projects/[id]`
- `/portal/proposals/[proposalId]`
- `/portal/contracts/[contractId]`
- `/portal/invoices/[invoiceId]`

Customers can:

- review proposals
- mark proposals viewed
- accept proposals
- review contracts
- sign contracts
- review invoices
- download PDFs
- see project status

This intentionally does not introduce new auth or public share links yet.

## Timeline and notifications

The workflow now derives a project activity timeline spanning:

- Estimate Created
- Proposal Generated
- Proposal Sent
- Proposal Viewed
- Proposal Accepted
- Contract Sent/Created
- Contract Signed
- Invoice Generated
- Invoice Sent
- Invoice Paid

The system also surfaces a notification framework for:

- Proposal Sent
- Proposal Viewed
- Proposal Accepted
- Contract Signed
- Invoice Due
- Invoice Paid

Current notification delivery is mock/UI-level. Future work should persist events and connect them to email or SMS delivery.

## Future payment integration

Before payment processing is introduced, the backend should add:

- payment records
- partial-payment ledger support
- invoice balance adjustments
- credit memos
- reminder jobs
- delivery logging

Once those exist, payment processors like Stripe can be layered onto the existing invoice lifecycle rather than forcing a rewrite.
