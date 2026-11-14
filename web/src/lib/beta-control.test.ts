import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { gatePromotion, nextSafeAction, evaluateChecks, prCardStatus, prStatusTileLabel, isBetaReadinessOperatorRole, parseRequiredCheckPolicy, commitStatusToCheck, collectLatestCommitStatuses, markReviewFetchFailure, isAuthorizedBetaOperator, loadAuthorizedBetaSnapshot, firstStagingDeployment, vercelDeploymentsNextCursor, releaseGates, type PrStatus } from './beta-control.ts';

const candidate: PrStatus = { number: 810, title:'Job handoff', url:'https://github.com/404TradeOS-LLC/TradeOS/pull/810', state:'open', head:'a'.repeat(40), base:'b'.repeat(40), draft:false, mergeable:true, behind:0, unresolvedThreads:0, review:'approved', checks:[{name:'CI', status:'completed', conclusion:'success', url:null}], requiredChecksKnown:true, requiredCheckNames:['CI'], error:null };

const rulesFixture = [
  { type:'deletion', ruleset_id:18958081 },
  { type:'required_status_checks', ruleset_id:18958081, parameters:{ required_status_checks:[
    { context:'Web lint and build', integration_id:15368 },
    { context:'App lint, unit tests, and build', integration_id:15368 },
    { context:'App integration tests', integration_id:15368 },
    { context:'Docs consistency', integration_id:15368 },
  ]}},
  { type:'pull_request', ruleset_id:18958081, parameters:{} },
  { type:'required_status_checks', ruleset_id:999, parameters:{ required_status_checks:[ { context:'Docs consistency', integration_id:777 } ]}},
  { type:'required_status_checks', ruleset_id:18958081, parameters:{ required_status_checks:[ { context:'Unbound check' } ]}},
  { type:'required_status_checks', ruleset_id:18958081, parameters:{} },
  { context:'Not a rule entry' },
  null,
];

test('ruleset payload parses required checks with per-context app bindings', () => {
  const policy = parseRequiredCheckPolicy(rulesFixture);
  assert.equal(policy.known, true);
  assert.deepEqual(policy.names, ['Web lint and build', 'App lint, unit tests, and build', 'App integration tests', 'Docs consistency', 'Unbound check']);
  assert.deepEqual(policy.bindings.find(b=>b.name==='Docs consistency'), { name:'Docs consistency', integrationIds:[15368, 777] });
  assert.deepEqual(policy.bindings.find(b=>b.name==='Unbound check'), { name:'Unbound check', integrationIds:[] });
});

test('non-array ruleset payload is not a readable policy', () => {
  assert.deepEqual(parseRequiredCheckPolicy({ rules: [] }), { known:false, names:[], bindings:[] });
  assert.deepEqual(parseRequiredCheckPolicy(null), { known:false, names:[], bindings:[] });
});

test('bound required check accepts only a success from the bound app', () => {
  const bound: PrStatus = { ...candidate, requiredChecks:[{ name:'CI', integrationIds:[15368] }] };
  assert.equal(evaluateChecks({ ...bound, checks:[{ name:'CI', status:'completed', conclusion:'success', url:null, appId:15368 }] }).state, 'verified');
  assert.equal(evaluateChecks({ ...bound, checks:[{ name:'CI', status:'completed', conclusion:'success', url:null, appId:999 }] }).state, 'blocked');
  assert.equal(evaluateChecks({ ...bound, checks:[{ name:'CI', status:'completed', conclusion:'success', url:null, appId:null }] }).state, 'blocked');
  assert.equal(evaluateChecks({ ...bound, checks:[{ name:'CI', status:'completed', conclusion:'success', url:null }] }).state, 'blocked');
});

test('same-name success from another app never satisfies a bound check', () => {
  const bound: PrStatus = { ...candidate, requiredChecks:[{ name:'CI', integrationIds:[15368] }] };
  assert.equal(evaluateChecks({ ...bound, checks:[
    { name:'CI', status:'completed', conclusion:'success', url:null, appId:999 },
    { name:'CI', status:'in_progress', conclusion:null, url:null, appId:15368 },
  ]}).state, 'blocked');
});

test('unbound required check accepts a success from any app', () => {
  const unbound: PrStatus = { ...candidate, requiredChecks:[{ name:'CI', integrationIds:[] }] };
  assert.equal(evaluateChecks({ ...unbound, checks:[{ name:'CI', status:'completed', conclusion:'success', url:null, appId:999 }] }).state, 'verified');
});

test('unknown required check policy is never green', () => {
  assert.equal(evaluateChecks({...candidate,requiredChecksKnown:false}).state, 'unverified');
});
test('required check pending blocks readiness even if other checks succeeded', () => {
  assert.equal(evaluateChecks({...candidate, checks:[{name:'CI',status:'in_progress',conclusion:null,url:null}]}).state, 'blocked');
});
test('unsafe promotion is denied when environment evidence is absent', () => {
  assert.equal(gatePromotion([candidate], releaseGates.map(g=>({...g,state:'unverified'}))).allowed, false);
});
test('unsafe promotion is denied when reviews have unknown resolution', () => {
  const gates=releaseGates.map(g=>({...g,state:'verified' as const}));
  assert.equal(gatePromotion([{...candidate,unresolvedThreads:null}],gates).allowed, false);
});
test('stale PR action prioritizes updating and rerunning checks', () => {
  assert.match(nextSafeAction({...candidate, behind:3}), /rebase|refresh|update/i);
});
test('draft PR action directs review preparation rather than merge', () => {
  assert.match(nextSafeAction({...candidate, number:891,draft:true}), /draft|review/i);
});
test('superseded infrastructure lanes must never recommend merging', () => {
  for (const number of [905,906]) assert.match(nextSafeAction({...candidate,number}), /#907|overlap|supersed/i);
});
test('handoff migration remains protected from replay', () => {
  assert.equal(releaseGates.some(g=>/replay/i.test(g.description) && /handoff/i.test(g.description)),true);
});
test('commit status maps without app identity', () => {
  assert.deepEqual(commitStatusToCheck({ context:'CI', state:'success', target_url:'https://example.test/run/1' }), { name:'CI', status:'completed', conclusion:'success', url:'https://example.test/run/1', appId:null });
  assert.deepEqual(commitStatusToCheck({ context:'CI', state:'pending', target_url:null }), { name:'CI', status:'queued', conclusion:null, url:null, appId:null });
  assert.deepEqual(commitStatusToCheck({ context:'CI', state:'failure', target_url:'https://example.test/run/2' }), { name:'CI', status:'completed', conclusion:'failure', url:'https://example.test/run/2', appId:null });
  assert.equal(commitStatusToCheck({ context:'CI', state:'weird' }), null);
  assert.equal(commitStatusToCheck({ state:'success' }), null);
  assert.equal(commitStatusToCheck(null), null);
});
test('commit status satisfies only an unbound required check', () => {
  const statusCheck = { name:'CI', status:'completed', conclusion:'success', url:null, appId:null };
  assert.equal(evaluateChecks({ ...candidate, requiredChecks:[{ name:'CI', integrationIds:[] }], checks:[statusCheck] }).state, 'verified');
  assert.equal(evaluateChecks({ ...candidate, requiredChecks:[{ name:'CI', integrationIds:[15368] }], checks:[statusCheck] }).state, 'blocked');
});
test('vercel staging lookup helpers keep match criteria and paging cursor', () => {
  const deployments = [
    { target:'production', meta:{ githubCommitRef:'staging' } },
    { target:'preview', meta:{ githubCommitRef:'main' } },
    { target:'preview', meta:{ githubCommitRef:'staging', githubCommitSha:'abc' } },
  ];
  assert.deepEqual(firstStagingDeployment(deployments), deployments[2]);
  assert.equal(firstStagingDeployment([{ target:'preview', meta:null }]), null);
  assert.equal(firstStagingDeployment('nope'), null);
  assert.equal(vercelDeploymentsNextCursor({ pagination:{ next: 1762000000000 } }), 1762000000000);
  assert.equal(vercelDeploymentsNextCursor({ pagination:{} }), null);
  assert.equal(vercelDeploymentsNextCursor({ pagination:{ next:'soon' } }), null);
  assert.equal(vercelDeploymentsNextCursor(null), null);
});

test('newest commit status overrides older success across API pages', () => {
  const seen = new Set<string>();
  const newest = collectLatestCommitStatuses([{ context:'CI', state:'failure', target_url:null }], seen);
  const older = collectLatestCommitStatuses([{ context:'CI', state:'success', target_url:null }], seen);
  assert.equal(newest.length,1);
  assert.equal(newest[0].conclusion,'failure');
  assert.deepEqual(older,[]);
  assert.equal(evaluateChecks({ ...candidate, checks:[...newest,...older] }).state,'blocked');
});

test('pending newest status and malformed newest status cannot resurrect old success', () => {
  const pendingSeen = new Set<string>();
  const pending = collectLatestCommitStatuses([{ context:'CI', state:'pending' }], pendingSeen);
  assert.equal(pending[0].status,'queued');
  assert.deepEqual(collectLatestCommitStatuses([{ context:'CI', state:'success' }],pendingSeen),[]);
  assert.equal(evaluateChecks({ ...candidate, checks:pending }).state,'blocked');
  const malformedSeen = new Set<string>();
  assert.deepEqual(collectLatestCommitStatuses([{ context:'CI', state:'unexpected' }],malformedSeen),[]);
  assert.deepEqual(collectLatestCommitStatuses([{ context:'CI', state:'success' }],malformedSeen),[]);
});


test('collector failure downgrades otherwise passing exact-head CI without hiding a known failure', () => {
  assert.equal(evaluateChecks({ ...candidate, error:'Commit status data unavailable' }).state, 'unverified');
  assert.match(evaluateChecks({ ...candidate, error:'Commit status data unavailable' }).detail, /incomplete|unavailable/i);
  assert.equal(evaluateChecks({ ...candidate, error:'Commit status data unavailable', checks:[{name:'CI',status:'completed',conclusion:'failure',url:null}] }).state,'blocked');
});

test('unbound requirements fail closed when same-name status disagrees with check runs', () => {
  const boundless:PrStatus={...candidate,requiredChecks:[{name:'CI',integrationIds:[]}]};
  const green={name:'CI',status:'completed',conclusion:'success',url:null,appId:15368};
  const red={name:'CI',status:'completed',conclusion:'failure',url:null,appId:null};
  const pending={name:'CI',status:'queued',conclusion:null,url:null,appId:null};
  assert.equal(evaluateChecks({...boundless,checks:[green,red]}).state,'blocked');
  assert.equal(evaluateChecks({...boundless,checks:[green,pending]}).state,'blocked');
  assert.equal(evaluateChecks({...candidate,requiredChecks:undefined,checks:[green,red]}).state,'blocked');
});

test('bound requirements ignore foreign-app failures but block failures from the required app', () => {
  const bound:PrStatus={...candidate,requiredChecks:[{name:'CI',integrationIds:[15368]}]};
  const green={name:'CI',status:'completed',conclusion:'success',url:null,appId:15368};
  const foreignFail={name:'CI',status:'completed',conclusion:'failure',url:null,appId:999};
  const matchingFail={name:'CI',status:'completed',conclusion:'failure',url:null,appId:15368};
  assert.equal(evaluateChecks({...bound,checks:[green,foreignFail]}).state,'verified');
  assert.equal(evaluateChecks({...bound,checks:[green,matchingFail]}).state,'blocked');
});

test('closed-unmerged superseded migration lanes do not block readiness merely for being closed', () => {
  const gates=releaseGates.map(g=>({...g,state:'verified' as const,proof:'https://github.com/404TradeOS-LLC/TradeOS/actions/runs/1'}));
  const canonical={...candidate,merged:false};
  const closed905={...candidate,number:905,state:'closed',merged:false};
  const closed906={...candidate,number:906,state:'closed',merged:false};
  const safe=gatePromotion([canonical,closed905,closed906],gates);
  assert.equal(safe.allowed,false);
  assert.match(safe.reason,/read.only|human.approved/i);
  assert.match(nextSafeAction(closed905),/closed|superseded/i);
  const conflict=gatePromotion([canonical,{...closed905,merged:true}],gates);
  assert.match(conflict.reason,/PR exact.head|source/i);
});

test('failed review read is visible and never mistaken for missing approval', () => {
  const failed=markReviewFetchFailure(candidate);
  assert.match(failed.error||'',/review.*unavailable/i);
  assert.equal(failed.review,'unverified');
  assert.equal(evaluateChecks(failed).state,'unverified');
  assert.match(nextSafeAction(failed),/restore.*read.only/i);
  const second=markReviewFetchFailure({...candidate,error:'Commit status data unavailable'});
  assert.match(second.error||'',/Commit status data unavailable.*Review.*unavailable/i);
});

const OPERATOR_ORG='11111111-1111-4111-8111-111111111111';
const CUSTOMER_ORG='22222222-2222-4222-8222-222222222222';

test('beta platform evidence is restricted to the configured operator organization', () => {
  for (const role of ['owner', 'admin']) {
    assert.equal(isAuthorizedBetaOperator(role, OPERATOR_ORG, OPERATOR_ORG), true);
    assert.equal(isAuthorizedBetaOperator(role, CUSTOMER_ORG, OPERATOR_ORG), false);
  }
  for (const role of ['technician', 'office_manager', 'viewer', null]) {
    assert.equal(isAuthorizedBetaOperator(role, OPERATOR_ORG, OPERATOR_ORG), false);
  }
});

test('beta operator access fails closed on missing, malformed, or ambiguous deployment config', () => {
  for (const allowedOrgId of [undefined, '', ' ', '*', 'org-1', OPERATOR_ORG+','+CUSTOMER_ORG]) {
    assert.equal(isAuthorizedBetaOperator('owner', OPERATOR_ORG, allowedOrgId), false);
  }
  for (const observedOrgId of [null, undefined, '', 'org-1', CUSTOMER_ORG]) {
    assert.equal(isAuthorizedBetaOperator('admin', observedOrgId, OPERATOR_ORG), false);
  }
});

test('operator org identity matches whole UUID values, not case or substring mismatches', () => {
  const mixed='1f2e3d4c-5b6a-4789-8abc-def012345678';
  const upper=mixed.toUpperCase();
  assert.notEqual(upper, mixed, 'fixture must prove case normalization');
  assert.equal(isAuthorizedBetaOperator('owner', upper, mixed), true);
  assert.equal(isAuthorizedBetaOperator('admin', mixed, '  '+upper+'  '), true);
  assert.equal(isAuthorizedBetaOperator('owner', mixed+'-suffix', mixed), false);
});

test('unauthorized operator route access denies before any platform snapshot read', async () => {
  let snapshotCalls = 0;
  let denialCalls = 0;
  const getSnapshot = async () => { snapshotCalls++; return { label: 'platform-release-metadata' }; };
  const deny = (): never => { denialCalls++; throw new Error('notFound'); };

  for (const [role, orgId, configured] of [
    ['owner', CUSTOMER_ORG, OPERATOR_ORG],
    ['admin', CUSTOMER_ORG, OPERATOR_ORG],
    ['technician', OPERATOR_ORG, OPERATOR_ORG],
    ['owner', OPERATOR_ORG, undefined],
    ['admin', OPERATOR_ORG, '*'],
  ] as const) {
    await assert.rejects(loadAuthorizedBetaSnapshot(role, orgId, configured, getSnapshot, deny), /notFound/);
  }
  assert.equal(snapshotCalls, 0, 'denied requests must never call the platform collector');
  assert.equal(denialCalls, 5);
});

test('authorized platform-organization owner and admin reach snapshot exactly once each', async () => {
  let snapshotCalls = 0;
  const getSnapshot = async () => { snapshotCalls++; return { label: 'approved-read-only' }; };
  const deny = (): never => { throw new Error('unexpected denial'); };
  for (const role of ['owner','admin']) {
    const result = await loadAuthorizedBetaSnapshot(role, OPERATOR_ORG, OPERATOR_ORG, getSnapshot, deny);
    assert.deepEqual(result,{label:'approved-read-only'});
  }
  assert.equal(snapshotCalls, 2);
});

test('beta readiness navigation link is gated by operator organization, not role alone', () => {
  const layout = readFileSync(new URL('../app/(app)/layout.tsx', import.meta.url), 'utf8');
  assert.match(layout, /isAuthorizedBetaOperator\s*\(/);
  assert.match(layout, /betaReadinessVisible/);
  assert.match(layout, /process\.env\.TRADEOS_BETA_OPERATOR_ORG_ID/);
  const nav = readFileSync(new URL('../components/shared/app-nav.tsx', import.meta.url), 'utf8');
  assert.match(nav, /betaReadinessVisible\s*=\s*false/);
  assert.doesNotMatch(nav, /isBetaReadinessOperatorRole\(currentRole\)/);
});

test('BetaReadinessPage cannot bypass the authorized collector boundary', () => {
  const source = readFileSync(new URL('../app/(app)/beta-readiness/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /await loadAuthorizedBetaSnapshot\s*\(/);
  assert.doesNotMatch(source, /await getBetaSnapshot\s*\(/);
});

test('beta readiness operator access is exactly owner or admin, never field or unknown roles', () => {
  assert.equal(isBetaReadinessOperatorRole('owner'), true);
  assert.equal(isBetaReadinessOperatorRole('admin'), true);
  for (const role of ['technician', 'manager', 'dispatcher', 'office-manager', '', 'OWNER', 'owner ', undefined, null, 1]) {
    assert.equal(isBetaReadinessOperatorRole(role), false, String(role));
  }
});

test('closed superseded staging alternatives are labeled superseded, not active release failures', () => {
  for (const number of [905, 906]) {
    const closed: PrStatus = { ...candidate, number, state:'closed', merged:false, mergeable:false };
    assert.equal(prCardStatus(closed), 'superseded');
    assert.match(nextSafeAction(closed), /closed|superseded/i);
    assert.equal(prCardStatus({ ...closed, merged:true }), 'blocked');
  }
});

test('unknown draft or mergeability evidence cannot create a green PR card', () => {
  assert.equal(prCardStatus({ ...candidate, mergeable:null }), 'unverified');
  assert.equal(prCardStatus({ ...candidate, draft:null }), 'unverified');
  assert.equal(prCardStatus({ ...candidate, mergeable:null, draft:null }), 'unverified');
  assert.equal(prCardStatus({ ...candidate, mergeable:false }), 'blocked', 'known non-mergeable state stays blocked');
  assert.equal(prCardStatus({
    ...candidate,
    draft:null,
    checks:[{ name:'CI', status:'completed', conclusion:'failure', url:null }],
  }), 'blocked', 'observed failed check stays blocked');
});

test('PR badges never go green for failed collector, unapproved reviews, or conflicting checks', () => {
  assert.equal(prCardStatus({ ...candidate, error:'review source unavailable' }), 'unverified');
  assert.equal(prCardStatus({ ...candidate, review:'unverified' }), 'unverified');
  assert.equal(prCardStatus({ ...candidate, unresolvedThreads:2 }), 'unverified');
  assert.equal(prCardStatus({ ...candidate, checks:[{name:'CI',status:'completed',conclusion:'failure',url:null}] }), 'blocked');
  assert.equal(prCardStatus({ ...candidate, state:'closed', merged:true }), 'merged');
});

test('closed PRs never recommend a branch update, whatever their recorded currency', () => {
  for (const number of [810, 891]) {
    const closedUnmerged: PrStatus = { ...candidate, number, state:'closed', merged:false, behind:3 };
    assert.match(nextSafeAction(closedUnmerged), /closed without merge/i);
    assert.doesNotMatch(nextSafeAction(closedUnmerged), /rebase|update/i);
    assert.doesNotMatch(nextSafeAction({ ...candidate, number, state:'closed', merged:true, behind:3 }), /rebase|update/i);
  }
  assert.match(nextSafeAction({ ...candidate, number:810, state:'closed', merged:true, behind:3 }), /attest.*bindings/i);
  assert.match(nextSafeAction({ ...candidate, number:891, state:'closed', merged:true, behind:3 }), /expense baseline/i);
  const mergedOther = nextSafeAction({ ...candidate, number:820, state:'closed', merged:true, behind:3 });
  assert.match(mergedOther, /merged/i);
  assert.doesNotMatch(mergedOther, /rebase|update/i);
  // Open PRs still recommend updating when behind.
  assert.match(nextSafeAction({ ...candidate, number:810, behind:3 }), /rebase|update/i);
});

test('superseded lane stays actionable even when its historical CI cannot be collected', () => {
  const closed: PrStatus = { ...candidate, number:905, state:'closed', merged:false, mergeable:false, error:'commit statuses unavailable' };
  assert.equal(prCardStatus(closed), 'superseded');
  assert.match(nextSafeAction(closed), /superseded|closed without merge/i);
  assert.doesNotMatch(nextSafeAction(closed), /restore.*visibility/i);
});


test('closed PR status tile says disposition instead of mergeability', () => {
  assert.equal(prStatusTileLabel('closed'), 'Disposition');
  assert.equal(prStatusTileLabel('open'), 'Mergeability');
  assert.equal(prStatusTileLabel('unknown'), 'Mergeability');
});

test('known required-check failure remains blocked despite another collector failure', () => {
  const knownFailure: PrStatus = {
    ...candidate,
    error: 'Review submissions unavailable',
    checks: [{name:'CI',status:'completed',conclusion:'failure',url:null}],
  };
  assert.equal(evaluateChecks(knownFailure).state,'blocked');
  assert.equal(prCardStatus(knownFailure),'blocked');
  assert.equal(prCardStatus({
    ...knownFailure,
    checks:[{name:'CI',status:'completed',conclusion:'success',url:null}],
  }),'unverified');
});

test('known draft and non-mergeable states survive a collector failure', () => {
  assert.equal(prCardStatus({ ...candidate, draft:true, error:'review source unavailable' }), 'draft');
  assert.equal(prCardStatus({ ...candidate, mergeable:false, error:'review source unavailable' }), 'blocked');
  assert.equal(prCardStatus({ ...candidate, draft:true, mergeable:false, error:'review source unavailable' }), 'draft');
  assert.equal(prCardStatus({ ...candidate, error:'review source unavailable' }), 'unverified');
});

test('missing required evidence is unverified only when the collector failed', () => {
  const extraRequired: PrStatus = {
    ...candidate,
    requiredCheckNames: ['CI', 'Security Gate'],
    checks: [{name:'CI',status:'completed',conclusion:'success',url:null}],
  };
  assert.equal(prCardStatus(extraRequired), 'blocked', 'a known missing required check remains blocking');
  assert.equal(prCardStatus({...extraRequired,error:'Commit check collection unavailable'}), 'unverified',
    'missing evidence and a failed collector are uncertainty, not a confirmed failing check');

  const observedRed: PrStatus = {
    ...extraRequired,
    error: 'Review submission collection unavailable',
    checks: [{name:'CI',status:'completed',conclusion:'failure',url:null}],
  };
  assert.equal(prCardStatus(observedRed), 'blocked',
    'an explicitly failing required check remains blocked despite other missing evidence');

  const pending: PrStatus = {
    ...extraRequired,
    error: 'Commit statuses unavailable',
    checks: [{name:'CI',status:'in_progress',conclusion:null,url:null}],
  };
  assert.equal(prCardStatus(pending), 'blocked', 'an observed incomplete required check remains blocking');
});
