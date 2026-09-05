# ADR-009: Solo-maintainer founder merge exception

Status: Accepted  
Date: 2026-08-28  
Decision owner: Founder

## Context

TradeOS currently has one repository maintainer. The live `main` ruleset already
requires pull requests, current branches, required checks, resolved
conversations, linear history, and deletion/non-fast-forward protection, but an
implicit extra-approval rule can still block a self-authored pull request when
no independent reviewer exists. A fake independent approval would provide no
additional safety and would misrepresent the review record.

## Decision

When no qualified independent reviewer is available, the founder may explicitly
authorize the founder or an authorized administrator to complete the merge
review for a pull request. The authorization must be recorded in the PR and
must include:

- the founder authorization and the reason independent review is unavailable;
- the PR scope, affected risk boundaries, and rollback/recovery plan;
- the final reviewed head SHA and green required-check evidence;
- confirmation that conversations are resolved and the branch is current;
- confirmation that no unresolved security, tenant-isolation, migration,
  financial, contractual, or production finding remains; and
- the owner and trigger for restoring independent review when another qualified
  maintainer joins.

The live ruleset must keep required approving reviews at zero for the current
solo-maintainer period and disable only the implicit
`require_extra_approval_for_unattributed_changes` gate. It must not add a broad
bypass that skips required checks, branch freshness, conversation resolution,
linear history, deletion protection, or non-fast-forward protection. The
exception is not an approval, and no agent or founder may claim that it is.

Production migration environment approvals, secret controls, security checks,
tenant isolation, and product/legal decisions remain independently required.

## Consequences

- A one-person repository can merge fully validated work without inventing a
  second reviewer.
- Every exceptional merge has an auditable founder decision and risk record.
- The technical branch-protection envelope remains intact.
- The approving-review requirement must be raised when another qualified
  maintainer or reviewer becomes available.
- The current live ruleset still needs the narrow extra-approval configuration
  change; repository documentation alone does not alter GitHub settings.

## Alternatives considered

- Keep the implicit extra-approval gate and leave the repository unable to land
  self-authored protected work.
- Add a broad administrator bypass that could skip technical protections.
- Fabricate an independent approval from an automated reviewer.
