---
status: current
owner: platform
last_verified: 2026-10-01
source_of_truth: false
related_code:
  - .github/workflows/merge-queue.yml
  - .github/workflows/verify-repository.yml
  - .github/workflows/docs-consistency.yml
  - .github/merge-queue-ruleset.json
  - .github/labels.yml
  - scripts/merge-queue.mjs
  - scripts/__tests__/merge-queue.test.mjs
related_docs:
  - docs/REPOSITORY_GOVERNANCE.md
  - docs/ENGINEERING_COMMAND_CENTER.md
---

# Native merge queue

The `Native merge queue` action inspects explicitly opted-in TradeOS PRs and
enqueues eligible heads through GitHub's `enqueuePullRequest` mutation with
`expectedHeadOid`. GitHub builds a synthetic group against current `main` and
owns protected merging. The checked-in ruleset is an activation template;
committing it does not change live GitHub settings. On 2026-10-01, main was
`89a79d29d399c922b023ae4392514cd09708aa0f` and ruleset `18958081` had no queue rule.
Native execution and activation have not been certified by local mocked tests.

## Activation order

1. Merge this CI support through the existing protected PR process. Both
   required-check providers must be on `main` before enabling the queue.
2. As a repository administrator, import `.github/merge-queue-ruleset.json`
   as a **new additive branch ruleset**. Keep existing ruleset `18958081`
   active, including all four required checks and their GitHub Actions app
   identity, conversation resolution, linear history, deletion protection,
   and force-push protection. Do not replace that ruleset with the template.
   Confirm `Require merge queue` applies to `main`, with squash merging,
   `ALLGREEN`, one concurrent build, one PR per merge, and a 60-minute timeout.
   There are no bypass actors in the template.
3. Create the `status:merge-queue` label from `.github/labels.yml`. For each
   reviewed head, also create and apply the temporary consent label
   `mqh:<full-40-character-SHA>`; this binds consent to that exact head and
   stays within GitHub's 50-character label-name limit. Store a dedicated,
   expiring fine-grained personal access token as the repository secret
   `TRADEOS_MERGE_QUEUE_TOKEN`, scoped only to `404TradeOS-LLC/TradeOS`.
   Grant Contents and Pull requests **write**, and Checks and Commit statuses **read**;
   its owner must have repository write access. Give it no administration or
   ruleset-bypass privileges. Secret creation/rotation is an administrator task.
   The action intentionally refuses apply mode without this secret. Its own
   `GITHUB_TOKEN` is read-only and is used only for dry-run inspection.
4. After reviewing one bounded PR's final head, remove stop/review labels only
   when resolved, add both `status:merge-queue` and
   `mqh:<that-head's-full-40-character-SHA>`, and dispatch `Native merge queue`
   on `main` with its PR number and `apply=false`. Inspect the summary. Then
   dispatch with `apply=true`. Confirm that both `merge_group` workflows
   started and all four required contexts report on the synthetic group SHA.
   Record the enqueue run, group SHA, checks, and resulting protected merge.
5. Only after that live trial, set repository Actions variable
   `TRADEOS_MERGE_QUEUE_ENABLED=true` to enable the 15-minute scheduler and
   completed-CI wakeups. Until then those automatic jobs are skipped. Manual
   dispatch remains available with dry run as the default. Leave the variable
   unset or false to keep all enqueue operations manual.

GitHub suppresses most new workflow events caused by `GITHUB_TOKEN`; a dedicated
token is necessary to drive subsequent group CI. Never fall back to direct
merging, a dispatch that certifies the PR head instead of the group, an admin
bypass, or branch-protection changes when checks are missing. Treat a stuck or
rejected entry as an operational blocker.

## Eligibility and consent

The action paginates open PRs targeting `main`, considers lower PR numbers
first, and re-reads each candidate before mutation. It requires a same-repository,
non-draft open PR, a complete governed PR description, known conflict-free
mergeability, satisfied reviews, resolved conversations, complete label/thread
and check evidence, and a successful check rollup on the exact head. The four
required contexts must be present. Completed skipped/neutral checks are accepted
where GitHub considers them green, preserving the established PR path-scoping
contract. All reported checks must be green. GitHub independently enforces the
live required-check app identities and rules at enqueue and merge time.

`status:do-not-merge`, `status:blocked`, `status:superseded`, and
`owner:human-review` stop entry. A maintainer adds `status:merge-queue` and the
matching `mqh:<full-40-character-SHA>` only after the applicable governance/risk
review of the current head; both labels are required and do not replace review
or authorize unresolved PR-only risks. Fork PRs require manual handling. API
errors, missing evidence, or truncated connections fail closed.

The opt-in labels authorize **one enqueue attempt** and are removed before the
mutation. A second fresh read catches head/blocker changes after label removal,
and `expectedHeadOid` rejects a concurrent head change at enqueue. Consent may
be consumed even if the API rejects entry. Review the summary, repair the
blocker, and reapply the label explicitly; failed/ejected heads do not requeue
on every poll. Eligible PRs that have not yet been attempted retain the label.

Remove the label to withdraw consent before processing. Once GitHub has an
entry, use **Remove from queue** in the native PR/queue UI to cancel it;
adding a stop label alone does not remove an existing native entry. Scheduled
runs are serialized and are not cancelled mid-mutation. Disable the repository
variable to stop automatic entry, and cancel any in-flight run if necessary.
Already queued entries still need explicit native removal.

## Verification and rollback

`Verify repository` runs the complete App, integration, and Web lanes on
`merge_group: checks_requested`; PR path scoping does not apply to group builds.
`Docs consistency` runs root PR-contract/autonomy regressions and ownership
validation against the event's immutable `merge_group.base_sha`. PR-description
validation itself runs on PR events because synthetic groups have no PR body.
Required check names remain unchanged.

Run `npm run pr:test`, `npm run docs:test`, `npm run autonomy:test`,
`npm run docs:check -- --base origin/main`, and the workflow-security CI gate.
Boundary tests cover consent, changed heads, new blockers, incomplete evidence,
missing activation/token, API rejection, and one-shot retry behavior. They do
not replace the live activation trial above.

To roll back automation, set the enable variable false, stop running enqueue
jobs, and remove pending native entries. If native queue itself must be rolled
back, an administrator may disable only the additive queue ruleset after
draining it; preserve the original protected PR ruleset and required checks.
No product deployment, schema, credential rotation, or auth/RLS change is
performed by this action.

References: [GitHub merge queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue),
[workflow token event behavior](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow),
[ruleset API](https://docs.github.com/en/rest/repos/rules#create-a-repository-ruleset),
and [enqueue GraphQL contract](https://docs.github.com/en/graphql/reference/pulls#enqueuepullrequest).
