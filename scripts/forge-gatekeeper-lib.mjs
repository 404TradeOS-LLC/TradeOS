// Read-only next-action recommendations. The existing merge queue owns eligibility;
// this module only sequences remediation and never authorizes a merge or deployment.
const VALID_SHA = /^[a-f0-9]{40}$/;
const RISK = new Set(['low', 'protected']);
const STAGING = new Set(['verified', 'not_required', 'missing']);
const ACCEPTANCE = new Set(['verified', 'not_required', 'missing']);

function recommendation(pr, gate, action, blockers = []) {
  return {
    prNumber: Number.isSafeInteger(pr?.number) ? pr.number : null,
    headSha: VALID_SHA.test(pr?.headRefOid ?? '') ? pr.headRefOid : null,
    gate,
    nextAction: action,
    blockers,
    readOnly: true,
  };
}

export function recommendNextGate({pr, blockers = [], evidence = {}} = {}) {
  if (!pr || typeof pr !== 'object') {
    return recommendation(null, 'INSPECT_PR', 'Retrieve the full live PR and current head.');
  }
  if (pr.state !== 'OPEN') {
    return recommendation(pr, 'NO_ACTION', 'Do not dispatch work on a closed PR.');
  }
  if (!VALID_SHA.test(pr.headRefOid ?? '')) {
    return recommendation(pr, 'INSPECT_HEAD', 'Read the exact current 40-character head SHA.');
  }
  if (evidence.headSha !== pr.headRefOid) {
    return recommendation(pr, 'RECHECK_HEAD_EVIDENCE', 'Refresh all evidence at the exact current PR head.');
  }
  if (!RISK.has(evidence.risk) || !STAGING.has(evidence.staging) ||
      (evidence.risk === 'low' && evidence.staging !== 'not_required') ||
      (evidence.risk === 'protected' && evidence.staging === 'not_required')) {
    return recommendation(pr, 'CLASSIFY_RISK', 'Classify changed paths and protected staging requirements before automation.');
  }
  if (!Array.isArray(pr.reviewThreads?.nodes) || pr.reviewThreads?.pageInfo?.hasNextPage !== false) {
    return recommendation(pr, 'INSPECT_REVIEW_EVIDENCE', 'Fetch all review conversations; incomplete pagination cannot establish readiness.');
  }
  if (!Array.isArray(blockers)) {
    return recommendation(pr, 'INSPECT_PR', 'Recompute the canonical repository queue blockers from live PR evidence.');
  }

  const commit = pr.commits?.nodes?.[0]?.commit;
  const checkRollup = commit?.statusCheckRollup;
  const checkNodes = checkRollup?.contexts?.nodes ?? [];
  const stale = Boolean(commit && commit.oid !== pr.headRefOid);
  const badChecks = blockers.some((b) => b === 'head checks missing, pending, failing, or incomplete' ||
    b === 'a reported check is not green' || b === 'required check context absent');
  if (badChecks) {
    const failedAtHead = !stale && commit?.oid === pr.headRefOid &&
      checkNodes.some((c) => (c.__typename === 'CheckRun' && c.status === 'COMPLETED' &&
        ['FAILURE', 'TIMED_OUT', 'ACTION_REQUIRED', 'CANCELLED'].includes(c.conclusion)) ||
        (c.__typename === 'StatusContext' && ['FAILURE', 'ERROR'].includes(c.state)));
    return recommendation(pr, failedAtHead ? 'REPAIR_CI' : 'INSPECT_CI',
      failedAtHead ? 'Reproduce the failing exact-head check; repair only a deterministic repository defect.' :
        'Reconcile required check names, completeness, pending status and exact-head identity.', blockers);
  }
  if (pr.isDraft) {
    return recommendation(pr, 'DRAFT_REVIEW', 'Review the scoped implementation and required evidence before marking ready.', blockers);
  }
  if (pr.reviewThreads.nodes.some((thread) => thread.isResolved !== true) ||
      ['CHANGES_REQUESTED', 'REVIEW_REQUIRED'].includes(pr.reviewDecision)) {
    return recommendation(pr, 'RESOLVE_REVIEW', 'Address and verify findings, then resolve conversations at this head.', blockers);
  }
  if (pr.mergeable !== 'MERGEABLE') {
    return recommendation(pr, 'RECONCILE_BRANCH', 'Inspect merge conflicts, freshness and branch policy without forcing updates.', blockers);
  }
  if (evidence.risk === 'protected' && evidence.staging !== 'verified') {
    return recommendation(pr, 'PROTECTED_STAGING', 'Obtain approved staging-only migration, binding and rollback evidence.', blockers);
  }
  if (!ACCEPTANCE.has(evidence.acceptance) || evidence.acceptance === 'missing' ||
      (evidence.risk === 'protected' && evidence.acceptance === 'not_required')) {
    return recommendation(pr, 'AUTHENTICATED_ACCEPTANCE', 'Capture required authenticated, head-bound runtime acceptance.', blockers);
  }
  if (blockers.length > 0) {
    return recommendation(pr, 'GOVERNANCE_REPAIR', 'Resolve remaining canonical merge-queue blockers; do not bypass them.', blockers);
  }
  return recommendation(pr, 'HUMAN_RELEASE_REVIEW',
    'Recheck live branch protection and evidence; release authority remains with the existing GitHub gates.');
}
