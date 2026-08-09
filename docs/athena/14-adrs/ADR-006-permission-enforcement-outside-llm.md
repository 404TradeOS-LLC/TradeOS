# ADR-006: Permission Enforcement Outside The LLM

Status: Accepted

## Context

LLM output is probabilistic and cannot be trusted as an authorization boundary.

## Decision

Auth, organization membership, RBAC, capability checks, approval gates, and RLS
remain outside the LLM.

## Consequences

Athena can propose actions, but services and policy decide whether execution is
allowed.

## Alternatives Considered

Prompt-enforced permissions; model-visible ACL summaries only; client-side
approval checks.

## Migration/Revisit Conditions

Never revisit without an equivalent deterministic enforcement layer.
