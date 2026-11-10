# ADR-009: Solo-maintainer founder merge exception

Status: Accepted  
Date: 2026-08-28  
Decision owner: Founder

## Context

TradeOS has operated with one repository maintainer. The live `main` ruleset
requires pull requests, current branches, required checks, resolved
conversations, linear history, and deletion/non-fast-forward protection. An
implicit extra-approval gate previously blocked self-authored pull requests
when no independent reviewer was available. That gate was disabled by the
narrow ruleset change verified on 2026-11-10. A fake independent approval
would provide no additional safety and would misrepresent the review record.

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
- The narrow extra-approval change has been applied and was verified on
  2026-11-10 against active GitHub ruleset [18958081](https://github.com/404TradeOS-LLC/TradeOS/rules/18958081):
  `require_extra_approval_for_unattributed_changes: false` and
  `required_approving_review_count: 0`. Required checks, branch freshness,
  thread resolution, linear history and deletion/non-fast-forward protections
  remain in effect. Future audits must re-check live settings; this ADR does
  not itself change GitHub configuration.

## Alternatives considered

- Keep the implicit extra-approval gate and leave the repository unable to land
  self-authored protected work.
- Add a broad administrator bypass that could skip technical protections.
- Fabricate an independent approval from an automated reviewer.
