---
status: current
owner: platform
last_verified: 2026-08-10
source_of_truth: true
---

# Domain Model

TradeOS domain entities remain application-owned. Athena consumes domain/application services and does not become a parallel system of record.

## Athena memory

A7 introduces `athena_memories` as infrastructure-owned durable assistant memory with explicit tenant, subject, source, confidence, retention, lifecycle, and audit fields.

Memory scope values are `user`, `organization`, `project`, `job`, and `conversation`, but A7 enables only scopes with complete authorization semantics:

- user/conversation: exact actor only;
- organization: exact organization, admin-capable mutation;
- project/job: contract-recognized but fail-closed until explicit object-scope authorization is implemented at both service and RLS layers.

Caller-facing memory retrieval exposes only active, unexpired records. Corrected/deleted history is not a normal memory-read surface. Corrections create a new active row with `supersedes`; forgetting clears stored value/metadata while retaining minimal audit identity/status.

Athena memory does not replace project, job, customer, estimate, invoice, payment, dispatch, costbook, or other TradeOS domain state. Those records remain authoritative in their existing application modules.
