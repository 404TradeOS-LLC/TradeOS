import assert from 'node:assert/strict';
import test from 'node:test';
import { gatePromotion, nextSafeAction, evaluateChecks, parseRequiredCheckPolicy, releaseGates, type PrStatus } from './beta-control.ts';

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