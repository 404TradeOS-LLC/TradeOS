import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyRisk,ciState,chooseNextGate,summarize,REQUIRED_CHECKS} from '../lib/policy.js';
import {authorizeCron} from '../api/cron.js';
const SHA='a'.repeat(40);
const checks=REQUIRED_CHECKS.map(name=>({name,status:'completed',conclusion:'success'}));
const basic={number:1,title:'test',html_url:'https://github.com/404TradeOS-LLC/TradeOS/pull/1',
  head:{sha:SHA},draft:false,mergeable:true};
test('fails closed on unknown files and protects migration changes',()=>{
  assert.equal(classifyRisk([],false),'unknown');
  assert.equal(classifyRisk(['app/prisma/migrations/123/migration.sql'],true),'protected');
  assert.equal(classifyRisk(['web/src/components/Button.tsx'],true),'low');
});
test('requires complete current-head required checks',()=>{
  assert.equal(ciState(checks,true),'passed');
  assert.equal(ciState(checks.slice(1),true),'unknown');
  assert.equal(ciState(checks,false),'unknown');
  assert.equal(ciState([{...checks[0],conclusion:'failure'},...checks.slice(1)],true),'failed');
});
test('unknown reviews block any release claim',()=>{
  const x=summarize(basic,{files:['web/src/App.tsx'],filesComplete:true,checks,checksComplete:true});
  assert.equal(x.gate,'INSPECT_REVIEW');
  assert.notEqual(x.gate,'RELEASE_REVIEW');
});
test('protected changes require release evidence regardless of green CI',()=>{
  const x=summarize(basic,{files:['app/prisma/schema.prisma'],filesComplete:true,checks,checksComplete:true,
    unresolvedReviewThreads:0});
  assert.equal(x.gate,'PROTECTED_RELEASE');
});
test('failed CI outranks draft review',()=>{
  const x=summarize({...basic,draft:true},{files:['web/src/App.tsx'],filesComplete:true,
    checks:[{...checks[0],conclusion:'failure'},...checks.slice(1)],checksComplete:true,unresolvedReviewThreads:0});
  assert.equal(x.gate,'REPAIR_CI');
});
test('head must be full SHA and missing scope blocks automation',()=>{
  assert.equal(chooseNextGate({headSha:'bad'}).gate,'INSPECT_HEAD');
  assert.equal(chooseNextGate({headSha:SHA,risk:'unknown',filesComplete:false}).gate,'INSPECT_SCOPE');
});
test('cron refuses missing and incorrect secrets',()=>{
  const req=(v)=>new Request('https://example.com/api/cron',{headers:{authorization:v}});
  assert.equal(authorizeCron(req('Bearer secret'),'short'),false);
  assert.equal(authorizeCron(req('Bearer wrong-secret-is-long'),'correct-secret-is-long'),false);
  assert.equal(authorizeCron(req('Bearer correct-secret-is-long'),'correct-secret-is-long'),true);
});
