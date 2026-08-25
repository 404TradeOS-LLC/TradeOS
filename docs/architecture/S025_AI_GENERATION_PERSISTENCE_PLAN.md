# S025 — AI generation persistence plan

Status: READY
Dependencies: S024 (`DONE` through ADR-008 and founder-decision PR #301)
Founder decision required: NO — ADR-008 is the accepted product/privacy/cost boundary.

## Objective

Persist metadata and review provenance for approved AI generations so each
generation is addressable, auditable, and organization/actor scoped without
retaining raw prompts, raw model output, tool arguments, or tool results by
default.

## Existing baseline

- `AthenaExecution` and `AthenaTelemetryRecordRow` already persist
  organization-scoped, redacted execution and model metadata through the
  application-service persistence seam.
- The kernel provider contract already exposes provider, model, and optional
  token/cost usage without fabricating missing usage data.
- Existing Athena retention cleanup is bounded, idempotent, and runs inside an
  authenticated organization-scoped background session.
- AI Estimate Assist remains review-first and applies accepted changes through
  existing application services; the structured draft/apply path now correlates
  its metadata generation record with the human review without creating a
  second write path.

## In scope

- A single addressable generation record with organization, actor, execution
  or request correlation, provider/model/version, timestamps, latency,
  token/cost usage when supplied, safe status/failure code, tool-name metadata,
  and provenance references.
- Review provenance that records the authorized reviewer, review outcome,
  review time, and the generation/review correlation without storing raw AI
  content by default.
- Organization/actor authorization and forced-RLS coverage, including
  same-organization access, cross-organization denial, unauthenticated
  denial, malformed identifiers, and unauthorized review attempts.
- A 90-day default metadata retention expiry and bounded, idempotent cleanup
  compatible with the existing Athena maintenance pattern.
- Repository documentation and evidence for the data contract, migration,
  tests, and operational limitations.

## AI Estimate Assist review correlation

Authenticated structured draft generation returns the persisted metadata record
identifier without exposing raw prompt or model content. The existing structured
review/apply request accepts that identifier and records the reviewer, outcome,
and bounded apply counts through the existing transaction. The business write
still occurs only through the existing Estimate Engine review-first path.

## Explicit non-goals

- Raw prompt, output, tool-argument, or tool-result persistence by default.
- New model providers, model escalation, autonomous business writes, billing
  changes, public links, customer-facing retention settings, or a new secrets
  system.
- Replacing `AthenaExecution`, `AthenaTelemetryRecordRow`, or existing
  AI Estimate Assist review-token/idempotency behavior without evidence that
  the existing seam cannot satisfy this contract.
- Background workers beyond the existing bounded maintenance-job pattern.

## Acceptance contract

1. Every persisted generation has a stable identifier and is organization and
   actor scoped; retrieval and review provenance fail closed outside that
   scope.
2. Metadata is allowlisted and redacted. Missing provider token/cost data is
   represented as unknown rather than estimated from prompt text.
3. Review provenance is append-only or otherwise conflict-safe, identifies the
   reviewer and outcome, and cannot authorize a business mutation outside the
   existing review-first application-service path.
4. Metadata expires after the ADR-008 default window through bounded,
   repeatable cleanup; cleanup preserves tenant isolation and does not delete
   unrelated data.
5. Migration upgrade and fresh-database paths, service tests, authorization/
   RLS tests, redaction tests, retention tests, typecheck/lint/build, and
   repository governance/docs checks pass.

## Security and privacy contract

- Authentication is required for user-facing reads and review actions.
- Organization context is derived server-side; caller-supplied organization
  identifiers are not trusted for authorization.
- Forced PostgreSQL RLS and service-layer organization checks both apply.
- Secrets, tokens, credentials, raw content, and unnecessary PII are excluded
  before persistence and covered by adversarial tests.
- Any future content persistence requires a separately scoped decision and is
  not authorized by this sprint.

## Migration and implementation constraints

Inspect current schema, migrations, open PRs, and RLS policy before editing.
Prefer one additive tenant-owned model or the smallest extension of the
existing execution seam. Do not introduce destructive migration behavior,
unreviewed indexes, or a second AI persistence system.

## Evidence required before implementation completion

- Focused generation/review service and redaction tests.
- Same-organization, cross-organization, unauthenticated, malformed-ID, and
  unauthorized-review tests, including PostgreSQL-backed RLS where required.
- Fresh migration and existing-database upgrade verification.
- Retention cleanup idempotency and boundary-date evidence.
- Exact-head CI, documentation ownership, branch currency, sprint governance,
  and completion-evidence records.
