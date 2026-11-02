import assert from 'node:assert/strict';
import test from 'node:test';
import { recommendNextGate } from '../forge-gatekeeper-lib.mjs';

const HEAD = 'a'.repeat(40);
function input(overrides = {}) {
  return {
    pr: {number: 42, state: 'OPEN', isDraft: false, headRefOid: HEAD,
      mergeable: 'MERGEABLE', reviewDecision: 'APPROVED',
      reviewThreads: {nodes: [], pageInfo: {hasNextPage: false}} },
    blockers: [],
    evidence: {headSha: HEAD, risk: 'low', staging: 'not_required', acceptance: 'verified'},
    ...overrides,
  };
}

test('refuses missing PR and never returns merge permission', () => {
  assert.equal(recommendNextGate(input({pr: null})).gate, 'INSPECT_PR');
  assert.equal(recommendNextGate(input()).gate, 'HUMAN_RELEASE_REVIEW');
  assert.equal('mayMerge' in recommendNextGate(input()), false);
});
test('refuses stale or malformed head evidence before trusting acceptance', () => {
  assert.equal(recommendNextGate(input({pr: {...input().pr, headRefOid: 'short'}})).gate, 'INSPECT_HEAD');
  assert.equal(recommendNextGate(input({evidence: {...input().evidence, headSha: 'b'.repeat(40)}})).gate, 'RECHECK_HEAD_EVIDENCE');
});
test('fails closed on unclassified risk and incomplete review pagination', () => {
  assert.equal(recommendNextGate(input({evidence: {...input().evidence, risk: 'unknown'}})).gate, 'CLASSIFY_RISK');
  assert.equal(recommendNextGate(input({pr: {...input().pr, reviewThreads: null}})).gate, 'INSPECT_REVIEW_EVIDENCE');
});
test('prioritizes current-head failed CI and missing required checks', () => {
  const pr = {...input().pr, commits: {nodes: [{commit: {
    oid: HEAD, statusCheckRollup: {state: 'FAILURE', contexts: {nodes: [{__typename: 'CheckRun', name: 'Docs consistency', status: 'COMPLETED', conclusion: 'FAILURE'}], pageInfo: {hasNextPage: false}}},
  }}]}};
  assert.equal(recommendNextGate(input({pr, blockers: ['a reported check is not green']})).gate, 'REPAIR_CI');
  assert.equal(recommendNextGate(input({blockers: ['required check context absent']})).gate, 'INSPECT_CI');
});
test('cannot repair from stale CI; must inspect the matching head', () => {
  const pr = {...input().pr, commits: {nodes: [{commit: {oid: 'b'.repeat(40)}}]}};
  assert.equal(recommendNextGate(input({pr, blockers: ['head checks missing, pending, failing, or incomplete']})).gate, 'INSPECT_CI');
});
test('draft, review, and branch failures remain held', () => {
  assert.equal(recommendNextGate(input({pr: {...input().pr, isDraft: true}})).gate, 'DRAFT_REVIEW');
  assert.equal(recommendNextGate(input({pr: {...input().pr, reviewThreads: {nodes: [{isResolved: false}], pageInfo: {hasNextPage: false}}}})).gate, 'RESOLVE_REVIEW');
  assert.equal(recommendNextGate(input({pr: {...input().pr, mergeable: 'CONFLICTING'}})).gate, 'RECONCILE_BRANCH');
});
test('protected risk requires protected staging evidence and acceptance', () => {
  assert.equal(recommendNextGate(input({evidence: {...input().evidence, risk: 'protected', staging: 'missing'}})).gate, 'PROTECTED_STAGING');
  assert.equal(recommendNextGate(input({evidence: {...input().evidence, risk: 'protected', staging: 'verified', acceptance: 'missing'}})).gate, 'AUTHENTICATED_ACCEPTANCE');
});
test('incomplete evidence and remaining governance blockers never pass', () => {
  assert.equal(recommendNextGate(input({evidence: {...input().evidence, acceptance: 'unknown'}})).gate, 'AUTHENTICATED_ACCEPTANCE');
  assert.equal(recommendNextGate(input({blockers: ['PR description incomplete']})).gate, 'GOVERNANCE_REPAIR');
  assert.equal(recommendNextGate(input({evidence: {...input().evidence, risk: 'low', staging: 'unknown'}})).gate, 'CLASSIFY_RISK');
});
test('closed PR cannot be dispatched for implementation', () => {
  assert.equal(recommendNextGate(input({pr: {...input().pr, state: 'CLOSED'}})).gate, 'NO_ACTION');
});
