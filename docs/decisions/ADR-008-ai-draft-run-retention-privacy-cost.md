# ADR-008: Minimized AI draft-run retention, privacy, and cost policy

Status: Accepted
Date: 2026-08-24
Decision owner: Founder

## Context

S024 requires an explicit policy before TradeOS persists AI draft-run data.
Athena and AI-assist features must remain tenant-scoped, review-first, and
predictable in cost without retaining more customer content than operations
require.

## Decision

TradeOS defaults to metadata-first AI draft-run persistence:

- Persist run identity, actor, organization, model, provider, version,
  timestamps, latency, token counts, estimated cost, tool names, safe status,
  failure code, and provenance references.
- Do not persist raw prompts, raw model outputs, tool arguments, or tool results
  by default. If an explicitly approved operational feature requires content,
  it must be separately scoped, tenant-isolated, access-controlled, encrypted
  through the existing platform controls, and covered by a retention period.
- Retain operational metadata for 90 days by default, then delete it through a
  bounded, idempotent cleanup process. Deletion requests must remove retained
  content and metadata for the requesting organization where legally and
  operationally applicable.
- Never place secrets, credentials, access tokens, refresh tokens, or signing
  keys into AI context or persisted AI content.
- Customer/project data may enter AI context only when required by the
  approved feature and only for the authenticated organization and actor.
  Human access is restricted to authorized operational/debugging access and
  must be auditable.
- Apply a reversible per-organization monthly usage ceiling with soft alerts at
  80% and a hard stop at 100%. A separately authorized organization admin may
  raise or lower the ceiling. A per-user ceiling and background-task budget
  must remain bounded by the organization ceiling.
- Model escalation is disabled by default. An explicit allowlist and budgeted
  fallback are required before using a more expensive model.

## Required data contract

Every retained run must be organization- and actor-scoped and must identify the
model, token/cost estimate, latency, tool names, success/failure, and provenance
needed to audit the result. Content persistence is opt-in and not implied by
this ADR.

## Explicit non-goals

This ADR does not authorize AI generation persistence implementation, new model
providers, autonomous writes, background workers, billing changes, a new
secrets system, or a retention policy for unrelated application data.
