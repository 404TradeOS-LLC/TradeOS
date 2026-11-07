import test from 'node:test';
import assert from 'node:assert/strict';
import {collectQueue,resetQueueCacheForTests,reviewVerdict} from '../lib/github.js';
import {GET as health} from '../api/health.js';
import {GET as queue} from '../api/queue.js';
import {GET as cron} from '../api/cron.js';
import {REQUIRED_CHECKS} from '../lib/policy.js';

const sha='a'.repeat(40);
const example={number:91,title:'Fix protected job handoff',html_url:'https://github.com/404TradeOS-LLC/TradeOS/pull/91',
  head:{sha},draft:false,mergeable:true};
const reply=(body)=>new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});
let fetches=[];
function mockFetch(url) {
  fetches.push(String(url));
  if (String(url).includes('/pulls?state=open')) return Promise.resolve(reply([example]));
  if (String(url).includes('/pulls/91/files')) return Promise.resolve(reply([{filename:'app/prisma/migrations/2026/migration.sql'}]));
  if (String(url).includes('/commits/'+sha+'/check-runs')) {
    const checks=REQUIRED_CHECKS.map(name=>({name,status:'completed',conclusion:'success'}));
    return Promise.resolve(reply({total_count:checks.length,check_runs:checks}));
  }
  if (String(url).includes('/pulls/91/reviews')) return Promise.resolve(reply([]));
  if (String(url).endsWith('/pulls/91')) return Promise.resolve(reply(example));
  return Promise.reject(new Error('Unexpected API path'));
}

test('worker fetches bounded exact-head evidence and fails closed on unavailable reviews',async()=>{
  const oldFetch=global.fetch,oldToken=process.env.GITHUB_READ_TOKEN;
  fetches=[];resetQueueCacheForTests();
  delete process.env.GITHUB_READ_TOKEN;global.fetch=mockFetch;
  try{
    const data=await collectQueue();
    assert.equal(data.repository,'404TradeOS-LLC/TradeOS');
    assert.equal(data.items.length,1);
    assert.equal(data.items[0].headSha,sha);
    assert.equal(data.items[0].ciState,'passed');
    assert.equal(data.items[0].risk,'protected');
    assert.equal(data.items[0].gate,'INSPECT_REVIEW');
    assert.ok(fetches.some(url=>url.includes('/commits/'+sha+'/check-runs')));
  }finally{
    global.fetch=oldFetch;
    if(oldToken===undefined)delete process.env.GITHUB_READ_TOKEN;else process.env.GITHUB_READ_TOKEN=oldToken;
  }
});

test('health is explicit about disabled code execution and merge authority',async()=>{
  const response=health();
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.status,'online');
  assert.equal(data.codeExecutionEnabled,false);
  assert.equal(data.mergeEnabled,false);
  assert.equal(data.productionAccess,false);
});

test('queue handler exposes evidence without mutating repository',async()=>{
  const oldFetch=global.fetch,oldToken=process.env.GITHUB_READ_TOKEN;
  fetches=[];resetQueueCacheForTests();
  delete process.env.GITHUB_READ_TOKEN;global.fetch=mockFetch;
  try{
    const response=await queue();
    assert.equal(response.status,200);
    const data=await response.json();
    assert.equal(data.readOnly,true);
    assert.equal(data.items[0].gate,'INSPECT_REVIEW');
  }finally{
    global.fetch=oldFetch;
    if(oldToken===undefined)delete process.env.GITHUB_READ_TOKEN;else process.env.GITHUB_READ_TOKEN=oldToken;
  }
});

test('review verdict distinguishes approval from unverified evidence',()=>{
  assert.equal(reviewVerdict([{user:{id:1},state:'APPROVED'}]),'approved');
  assert.equal(reviewVerdict([{user:{id:1},state:'CHANGES_REQUESTED'},{user:{id:2},state:'APPROVED'}]),'changes_requested');
  assert.equal(reviewVerdict([{user:{id:1},state:'COMMENTED'}]),'unverified');
  assert.equal(reviewVerdict([]),'unverified');
  assert.equal(reviewVerdict(null),'unknown');
  assert.equal(reviewVerdict(new Array(100).fill({user:{id:1},state:'APPROVED'})),'unknown');
});

test('cron never runs without a secret or accepts a bad one',async()=>{
  const original=process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;
  try{
    const url='https://example.com/api/cron';
    assert.equal((await cron(new Request(url))).status,503);
    process.env.CRON_SECRET='strong-example-secret-for-tests';
    assert.equal((await cron(new Request(url,{headers:{authorization:'Bearer wrong'}}))).status,401);
  }finally{
    if(original===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=original;
  }
});


test('a moving PR head invalidates the entire inspection instead of mixing old checks and new metadata',async()=>{
  const originalFetch=global.fetch,originalToken=process.env.GITHUB_READ_TOKEN;
  resetQueueCacheForTests();
  delete process.env.GITHUB_READ_TOKEN;
  global.fetch=(url)=>{
    if(String(url).endsWith('/pulls/91')) return Promise.resolve(reply({...example,head:{sha:'b'.repeat(40)}}));
    return mockFetch(url);
  };
  try{
    const data=await collectQueue();
    assert.equal(data.items.length,1);
    assert.equal(data.items[0].gate,'EVIDENCE_UNAVAILABLE');
    assert.notEqual(data.items[0].ciState,'passed');
  }finally{
    global.fetch=originalFetch;
    if(originalToken===undefined)delete process.env.GITHUB_READ_TOKEN;
    else process.env.GITHUB_READ_TOKEN=originalToken;
    resetQueueCacheForTests();
  }
});
