# ADR-004: Low-Risk Autonomy And Approval For High-Risk Actions

Status: Accepted

## Context

Athena should reduce work without silently creating legal, financial,
operational, or destructive side effects.

## Decision

Low-risk actions may run automatically where policy permits. Medium-risk
actions follow contextual policy. High-risk actions always require explicit
approval.

## Consequences

Users get speed for drafts and summaries while retaining control over
consequential actions.

## Alternatives Considered

Approval for every action; broad autonomy; per-prompt self-classification.

## Migration/Revisit Conditions

Revisit risk categories with production incident evidence, customer policy
needs, or legal/compliance requirements.
