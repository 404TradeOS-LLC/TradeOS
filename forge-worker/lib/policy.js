// Read-only diagnostic policy; scripts/merge-queue.mjs remains release authority.
export const REPO = '404TradeOS-LLC/TradeOS';
export const REQUIRED_CHECKS = Object.freeze(['Docs consistency', 'App lint, unit tests, and build', 'App integration tests', 'Web lint and build']);
const PROTECTED = /(^|\/)(prisma\/migrations|schema\.prisma|auth|middleware\/databaseSession|payments|invoices|billing|rls|migrations|\.github\/workflows|secrets|supabase)(\/|\.|$)/i;

export function classifyRisk(paths, complete = false) {
  if (!Array.isArray(paths) || !complete) return 'unknown';
  return paths.some(path => PROTECTED.test(String(path))) ? 'protected' : 'low';
}

export function chooseNextGate(item) {
  const head = item?.headSha;
  if (!item || !/^[a-f0-9]{40}$/.test(head ?? '')) return {gate:'INSPECT_HEAD',priority:100,action:'Verify the current PR head SHA.'};
  if (!item.filesComplete || item.risk === 'unknown') return {gate:'INSPECT_SCOPE',priority:95,action:'Fetch complete changed-file evidence and classify protected paths.'};
  if (item.ciState === 'failed') return {gate:'REPAIR_CI',priority:90,action:'Reproduce the exact-head failing check and repair only the scoped defect.'};
  if (item.ciState !== 'passed') return {gate:'RECONCILE_CI',priority:85,action:'Confirm all required exact-head checks are present, completed and successful.'};
  if (item.draft) return {gate:'DRAFT_REVIEW',priority:80,action:'Finish evidence and review before marking the draft ready.'};
  if (item.unresolvedReviewThreads === null) return {gate:'INSPECT_REVIEW',priority:75,action:'Read all review threads using an authenticated, paginated GitHub connection.'};
  if (item.unresolvedReviewThreads > 0 || item.reviewDecision === 'changes_requested') return {gate:'RESOLVE_REVIEW',priority:70,action:'Repair findings and verify each thread at the exact head.'};
  if (item.mergeable !== true) return {gate:'RECONCILE_BRANCH',priority:65,action:'Confirm the branch is conflict-free and current under repository governance.'};
  if (item.risk === 'protected') return {gate:'PROTECTED_RELEASE',priority:60,action:'Obtain protected staging and authenticated acceptance evidence; this worker cannot approve release.'};
  if (item.reviewDecision === 'unknown' || item.reviewDecision === 'unverified') return {gate:'INSPECT_REVIEW',priority:75,action:'Review approval is unverified; confirm reviewer evidence before any release claim.'};
  return {gate:'RELEASE_REVIEW',priority:50,action:'Perform final governance review using the canonical merge queue; no automatic merge authorization.'};
}

export function ciState(checkRuns, complete) {
  if (!complete || !Array.isArray(checkRuns)) return 'unknown';
  const names = new Map(checkRuns.map(c=>[c.name,c]));
  const failed = checkRuns.some(c => c.status === 'completed' && ['failure','timed_out','action_required','cancelled'].includes(c.conclusion));
  if (failed) return 'failed';
  if (REQUIRED_CHECKS.some(name=>!names.has(name))) return 'unknown';
  return REQUIRED_CHECKS.every(name => {
    const c = names.get(name);
    return c.status === 'completed' && ['success','skipped','neutral'].includes(c.conclusion);
  }) ? 'passed' : 'pending';
}

export function summarize(pr, {files=[],filesComplete=false,checks=[],checksComplete=false,unresolvedReviewThreads=null,reviewDecision='unknown'}={}) {
  const risk=classifyRisk(files,filesComplete);
  const result={
    number:pr.number,title:String(pr.title??'').slice(0,180),url:pr.html_url,
    headSha:pr.head?.sha??null,draft:Boolean(pr.draft),
    mergeable:pr.mergeable??null,risk,filesComplete,ciState:ciState(checks,checksComplete),
    unresolvedReviewThreads,reviewDecision
  };
  return {...result,...chooseNextGate(result)};
}
