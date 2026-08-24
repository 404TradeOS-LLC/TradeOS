---
status: current
owner: platform
last_verified: 2026-08-24
source_of_truth: false
related_code:
  - docs/SPRINT_BACKLOG.md
  - docs/architecture/S015_BRAND_PROFILE_SETTINGS_ADAPTER_PLAN.md
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
---

# Session Handoff

## Mission

S016 is the sole numbered sprint implementation lane on
`feature/s016-implementation`, based on `origin/main` `240e977`. It consumes
canonical Brand Studio branding through the existing proposal, invoice,
contract, and authenticated portal document-rendering seams. S014 and S015 are
DONE; S017, S020, and S022 remain read-only future work.

## Current truth

- S021 implementation and completion evidence are merged; S014 and S024 are
  DONE through founder-decision PR #301; S020's legal boundary is resolved by
  ADR-007.
- S015 implementation PR #310 and completion evidence PR #312 are merged.
- S016 is READY through governance-only PR #313 and is the only implementation
  lane authorized by the canonical selector.
- The implementation currently adds server-derived brand resolution, safe
  fallback/color and asset handling, PDF header/contact/trust-signal wiring,
  and focused resolver coverage without schema, migration, auth, RLS-policy,
  payment, signature, or portal-identity changes.

## Readiness contract

Brand Studio remains canonical. S016 must reuse the existing frame/generator
seams, preserve authenticated organization context, route/content-type
contracts, lifecycle and commercial semantics, safe escaping, deterministic
fallbacks, and forced RLS. No new renderer, storage model, asset lifecycle,
public branding, customer identity, payment, signature, schema, or migration
architecture is authorized.

## Verification and blockers

- Focused App typecheck and document/proposal/invoice/contract test suites pass
  in the current worktree.
- PostgreSQL/RLS integration, complete repository gates, remote CI/review, and
  authenticated production/browser PDF evidence remain pending.
- No production credential or authenticated browser state is stored or
  required for the repository-side implementation.

## Next action

Finish S016 focused service/PDF and route/RLS evidence, run the required local
gates, inspect the final diff, then publish one reviewable S016 PR. Do not
begin S017, S020, or S022 implementation from this branch; after verified
merge, record separate S016 completion evidence before selecting the next
numbered sprint.

## Next Eligible Sprint

Sprint ID: S016
Eligibility: S016 remains the lowest-numbered READY sprint and is the sole implementation lane on `feature/s016-implementation`.
Dependencies: S014 and S015 are DONE; S016 readiness is supplied by PR #313.
Overlap check: No other numbered sprint receives implementation writes; S017, S020, and S022 remain read-only.
Startup prompt: Finish and publish S016, merge only after required checks/reviews/evidence pass, then create separate completion evidence before selecting the next sprint.
