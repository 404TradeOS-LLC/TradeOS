---
status: current
owner: platform
last_verified: 2026-08-12
---

# CODEOWNERS Policy

TradeOS uses `.github/CODEOWNERS` to identify repository paths that require explicit ownership awareness before merge. The file does not replace CI, branch protection, `AGENTS.md`, or `docs/REPOSITORY_GOVERNANCE.md`; it adds a path-ownership signal for sensitive changes.

## Sensitive ownership boundaries

Explicit ownership applies to repository governance and automation; authentication, tenancy, authorization, and request-scoped RLS; Prisma schema and migrations; migration deployment and application-role provisioning; deployment configuration; Athena foundation/security/permission/action-engine surfaces; and billing/payment modules.

The default repository owner remains the current solo maintainer so ordinary low-risk changes still receive an owner assignment without introducing artificial team boundaries.

## Merge policy

A CODEOWNERS match is not by itself evidence that a change is safe. Sensitive changes must still satisfy required CI, branch protection, unresolved-thread rules, and the autonomous-development restrictions in `AGENTS.md`.

When GitHub rules are configured to require code-owner review, these paths become human-gated even if an automated maintenance agent authored or repaired the pull request. Until that repository setting is enabled, CODEOWNERS provides ownership routing and review visibility but does not independently block merge.

## Future team growth

As qualified maintainers join, replace the solo owner on sensitive paths with the appropriate GitHub teams rather than broadening autonomous authority. Domain teams should own their business rules while platform/security ownership should remain on shared auth, data, deployment, and Athena foundation boundaries.
