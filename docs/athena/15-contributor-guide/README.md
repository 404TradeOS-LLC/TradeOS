---
status: current
owner: platform
last_verified: 2026-08-09
source_of_truth: true
---

# Volume 15 - Contributor Guide

This guide explains how future contributors should extend Athena without
breaking TradeOS boundaries.

## Add A Tool

1. Identify the application service that owns the business behavior.
2. Add the tool under `app/modules/athena-tools/**` and register it in `createProductionAthenaToolRegistry()`.
3. Define the C002 tool metadata and C003 result shape, including `name`, `category`, and `outputSchema`.
4. Prefer `defineTool()` from `app/modules/athena-tool-sdk`.
5. Validate input before execution.
6. Call the service; do not query the database directly.
7. Emit events through service-owned behavior where appropriate.
8. Add unit, contract, authorization, tenant, retry, and envelope tests.

## Add A Context Provider

Define C010 metadata, owner, freshness, cache policy, criticality, timeout,
permissions, output shape, degraded behavior, and telemetry. Providers gather
facts only; they do not make business decisions or write records.

## Add A Memory Type

Define scope, source attribution, confidence, retention, correction, deletion,
visibility, audit metadata, privacy classification, and conflict behavior before
writing production memory.

## Add An Event

Define C008 event name, version, publisher, aggregate/entity, payload schema,
idempotency key, retry semantics, replay behavior, consumers, and dead-letter
handling. Add contract tests and update this Bible if the event is canonical.

## Add Permissions

Prefer existing TradeOS permission keys. If a new permission is required, update
the canonical RBAC contract and ensure routes/services enforce it outside the
LLM before Athena can use it.

## Add Telemetry

Emit C011 records with correlation IDs, redaction, duration, status, error code,
model/provider when applicable, cost metrics, and action/tool IDs. Do not log
secrets, raw payment data, or unnecessary PII.

## Test Athena Changes

Run focused tests for changed units plus contract, docs, authorization, tenant,
failure/retry, prompt-injection, and E2E checks as relevant. A model response
that looks right is not verification.

## Review Athena PRs

Reviewers should verify: service boundary, permission enforcement, approval
policy, context freshness, memory attribution/deletion, event versioning, result
envelope, observability, tests, docs, and rollback plan.

## Deprecate A Contract

Mark replacement, compatibility window, migration steps, sunset date, affected
tools/plugins, and historical-read behavior. Breaking removals require a new
major version and explicit consumer migration.

## Add A Third-Party Integration

Use the plugin manifest and review process. Never grant broad context or
database access. Install, revoke, and observe by organization and capability.
