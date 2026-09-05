# ADR-006: Brand Studio is the canonical organization-brand source

Status: Accepted
Date: 2026-08-24
Decision owner: Founder

## Context

TradeOS has Settings and Brand Studio surfaces that can describe organization
branding. Document rendering needs one authoritative brand record, while
existing callers and stored compatibility data must not be invalidated by the
convergence.

## Decision

Brand Studio is the product-facing canonical source of organization branding.
Settings remains a compatibility and administration surface that reads and
writes through the Brand Studio-owned adapter. New document-rendering behavior
must resolve persisted organization branding through this canonical boundary.

The adapter must preserve existing organization scoping, permissions, fallback
values, and compatibility reads while the remaining Settings/Brand Studio
surface is migrated incrementally. No destructive historical rewrite is
implied by this decision.

## Consequences

- S014's source-of-truth decision is resolved.
- S015 may implement the compatibility adapter and migration-safe read/write
  boundary.
- S016 may consume the approved branding boundary for proposal, invoice,
  contract, and portal document rendering.
- Document rendering must remain deterministic when branding is missing or
  incomplete by using the existing safe fallback behavior.
- A future decision is required for public marketing-site theming; this ADR is
  limited to organization/product document branding.

## Explicit non-goals

This ADR does not authorize a portal redesign, a new asset-storage model,
destructive data migration, permission widening, or changes to document
lifecycle/signature semantics.
