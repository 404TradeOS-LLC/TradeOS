import assert from 'node:assert/strict';
import test from 'node:test';
import { gatePromotion, nextSafeAction, evaluateChecks, releaseGates, type PrStatus } from './beta-control.ts';

const candidate: PrStatus = { number: 810, title:'Job handoff', url:'https://github.com/404TradeOS-LLC/TradeOS/pull/810', state:'open', head:'a'.repeat(40), base:'b'.repeat(40), draft:false, mergeable:true, behind:0, unresolvedThreads:0, review:'approved', checks:[{name:'CI', status:'completed', conclusion:'success', url:null}], requiredChecksKnown:true, requiredCheckNames:['CI'], error:null };

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