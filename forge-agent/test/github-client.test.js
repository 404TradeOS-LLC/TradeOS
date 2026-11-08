import test from "node:test";
import assert from "node:assert/strict";
import { inspectIssue, createDraft, githubRequest } from "../lib/github-client.js";

const mainSha = "a".repeat(40);
const commitSha = "c".repeat(40);
const input = {
  issueNumber: 910, baseSha: mainSha,
  files: [{ path: "docs/forge/safe.md", content: "# Safe\n" }],
};

function fakeServer({ moved=false, label=true, overlap=false, existing=false,
  overlapText=null, longBody=false, pullFailure=null, matchingOpenPr=false, wrongBase=false,
  preservedBranch=false, preservedTreeMismatch=false, competingPr=null } = {}) {
  const calls=[];
  const fetchImpl=async(url,options)=>{
    const path=new URL(url).pathname+new URL(url).search;
    calls.push({path,method:options.method,body:options.body&&JSON.parse(options.body)});
    let data;
    if(path.endsWith("/git/ref/heads/main")) data={object:{sha:moved?"b".repeat(40):mainSha}};
    else if(path.endsWith("/issues/910")) data={number:910,state:"open",body:longBody?"x".repeat(12001):"# brief",labels:label?[{name:"forge:ready"}]:[]};
    else if(path.endsWith("/pulls?state=open&per_page=100")) data=competingPr?[{number:competingPr.number,head:{ref:"other-branch"},body:"unrelated"}]:(overlap||overlapText)?[{head:{ref:"other"},body:overlapText??"Closes #910"}]:[];
    else if(path.includes("/pulls/") && path.includes("/files")) data=competingPr && path.includes("/pulls/"+competingPr.number+"/files") ? competingPr.files : [];
    else if(path.includes("/pulls?head=")) data=matchingOpenPr?[{number:999,draft:true,html_url:"https://github.com/404TradeOS-LLC/TradeOS/pull/999",head:{ref:"forge/issue-910-"+mainSha.slice(0,12),sha:commitSha},base:{ref:wrongBase?"staging":"main"}}]:[];
    else if(path.includes("/git/ref/heads/forge/")) {
      if(!preservedBranch) return {ok:false,status:404,json:async()=>({message:"Not Found"})};
      data={ref:"refs/heads/forge/issue-910-"+mainSha.slice(0,12),object:{sha:commitSha}};
    }
    else if(path.includes("/git/refs/heads/forge/")) return {ok:true,status:204,json:async()=>{throw Error("204 has no body")}};
    else if(path.startsWith("/repos/404TradeOS-LLC/TradeOS/contents/docs/forge/")) {
      return {ok:existing,status:existing?200:404,json:async()=>({sha:"f".repeat(40)})};
    }
    else if(path.endsWith("/git/commits/"+mainSha)) data={tree:{sha:"b".repeat(40)}};
    else if(path.endsWith("/git/commits/"+commitSha)) data={tree:{sha:preservedTreeMismatch?"d".repeat(40):"b".repeat(40)},parents:[{sha:mainSha}],message:"docs(forge): pilot issue #910"};
    else if(path.endsWith("/git/trees")) data={sha:"b".repeat(40)};
    else if(path.endsWith("/git/commits")) data={sha:commitSha};
    else if(path.endsWith("/git/refs")) data={ref:"refs/heads/forge/issue-910-"+mainSha.slice(0,12)};
    else if(path.endsWith("/pulls")) {
      if(["422","429","500"].includes(pullFailure))return {ok:false,status:Number(pullFailure),json:async()=>({message:"simulated failure"})};
      if(pullFailure==="timeout")throw Error("connection lost");
      data={number:999,draft:true,html_url:"https://github.com/404TradeOS-LLC/TradeOS/pull/999"};
    }
    else throw Error("Unexpected call: "+path);
    return {ok:true,status:200,json:async()=>data};
  };
  return {calls,fetchImpl};
}

test("missing write configuration causes zero requests",async()=>{
  const fake=fakeServer();
  const result=await createDraft(input,{enabled:false,token:"mock",fetchImpl:fake.fetchImpl});
  assert.equal(result.reason,"WRITE_DISABLED");
  assert.equal(fake.calls.length,0);
});

test("moving base SHA, missing label and duplicate PR prevent any write",async()=>{
  for(const options of [{moved:true},{label:false},{overlap:true}]){
    const fake=fakeServer(options);
    await assert.rejects(()=>createDraft(input,{enabled:true,token:"mock",fetchImpl:fake.fetchImpl}));
    assert.equal(fake.calls.filter(x=>x.method!=="GET").length,0);
  }
});

test("authorized pilot can only create a draft, never merge",async()=>{
  const fake=fakeServer();
  const result=await createDraft(input,{enabled:true,token:"mock",fetchImpl:fake.fetchImpl});
  assert.equal(result.ok,true);
  assert.equal(result.draft,true);
  assert.equal(result.headSha,commitSha);
  const writes=fake.calls.filter(x=>x.method!=="GET");
  assert.deepEqual(writes.map(x=>x.path),[
    "/repos/404TradeOS-LLC/TradeOS/git/trees",
    "/repos/404TradeOS-LLC/TradeOS/git/commits",
    "/repos/404TradeOS-LLC/TradeOS/git/refs",
    "/repos/404TradeOS-LLC/TradeOS/pulls",
  ]);
  assert.equal(writes[0].body.tree[0].path,"docs/forge/safe.md");
  assert.equal(writes[0].body.base_tree,"b".repeat(40));
  assert.deepEqual(writes[1].body.parents,[mainSha]);
  assert.equal(writes[3].body.base,"main");
  assert.equal(writes[3].body.draft,true);
});

test("github client cannot target another repository or host",async()=>{
  await assert.rejects(()=>githubRequest("/repos/foreign/repo/issues/1",{
    fetchImpl:async()=>{ throw Error("network should never be reached"); },
  }),/Unscoped/);
});

test("issue inspection rejects PR objects masquerading as issue",async()=>{
  await assert.rejects(()=>inspectIssue(910,{
    fetchImpl:async()=>({ok:true,status:200,json:async()=>({number:910,pull_request:{url:"x"}})}),
  }),/identity mismatch/);
});

test("existing docs/forge file must be rejected before any write", async () => {
  const fake = fakeServer({existing:true});
  await assert.rejects(() => createDraft(input,{enabled:true,token:"mock",fetchImpl:fake.fetchImpl}), /already exists/);
  assert.ok(fake.calls.some(c=>c.path.includes("/contents/docs/forge/safe.md?ref="+mainSha)));
  assert.equal(fake.calls.filter(c=>c.method!=="GET").length,0);
});


test("review regression: closing keywords block duplicate issue drafts", async () => {
  for(const overlapText of ["Fixes #910","RESOLVED #910","close #910","Fixed #910"]) {
    const fake=fakeServer({overlapText});
    await assert.rejects(() => createDraft(input,{enabled:true,token:"mock",fetchImpl:fake.fetchImpl}), /Overlapping/);
    assert.equal(fake.calls.filter(c=>c.method!=="GET").length,0);
  }
});

test("review regression: truncated issue bodies are flagged and cannot be drafted", async () => {
  const truncated=fakeServer({longBody:true});
  const issue=await inspectIssue(910,{fetchImpl:truncated.fetchImpl});
  assert.equal(issue.body.length,12000);
  assert.equal(issue.bodyTruncated,true);
  const complete=fakeServer();
  const normal=await inspectIssue(910,{fetchImpl:complete.fetchImpl});
  assert.equal(normal.bodyTruncated,false);
  await assert.rejects(()=>createDraft(input,{enabled:true,token:"mock",fetchImpl:truncated.fetchImpl}),/truncated|too long|exceeds/i);
  assert.equal(truncated.calls.filter(c=>c.method!=="GET").length,0);
});

test("review regression: encoded traversal cannot escape GitHub repository",async()=>{
  const fake=fakeServer();
  await assert.rejects(()=>githubRequest("/repos/404TradeOS-LLC/TradeOS/contents/%2e%2e/%2e%2e/foreign/repo",{fetchImpl:fake.fetchImpl}),/Unscoped/);
  assert.equal(fake.calls.length,0);
});

test("review regression: a definitively rejected draft preserves its branch for reconciliation",async()=>{
  const fake=fakeServer({pullFailure:"422"});
  await assert.rejects(()=>createDraft(input,{enabled:true,token:"mock",fetchImpl:fake.fetchImpl}),/422/);
  assert.equal(fake.calls.filter(c=>c.method==="DELETE").length,0);
  assert.ok(fake.calls.some(c=>c.path.includes("/pulls?head=")));
});

test("review regression: uncertain draft failure preserves its branch for reconciliation",async()=>{
  const fake=fakeServer({pullFailure:"timeout"});
  await assert.rejects(()=>createDraft(input,{enabled:true,token:"mock",fetchImpl:fake.fetchImpl}),/connection lost|reconcil/i);
  assert.equal(fake.calls.filter(c=>c.method==="DELETE").length,0);
});

test("write tool must retain explicit human approval",async()=>{
  const {readFileSync}=await import("node:fs");
  const text=readFileSync(new URL("../agent/tools/publish_draft_pr.ts",import.meta.url),"utf8");
  assert.match(text,/approval:\s*always\(\)/);
});


test("definitive rejection does not delete a branch with an existing PR",async()=>{
  const fake=fakeServer({pullFailure:"422",matchingOpenPr:true});
  const result=await createDraft(input,{enabled:true,token:"mock",fetchImpl:fake.fetchImpl});
  assert.equal(result.number,999);
  assert.equal(fake.calls.filter(c=>c.method==="DELETE").length,0);
});

test("ambiguous publication failure can reconcile an already-created draft",async()=>{
  const fake=fakeServer({pullFailure:"timeout",matchingOpenPr:true});
  const result=await createDraft(input,{enabled:true,token:"mock",fetchImpl:fake.fetchImpl});
  assert.equal(result.draft,true);
  assert.equal(fake.calls.filter(c=>c.method==="DELETE").length,0);
});


test("transient HTTP errors never trigger branch deletion", async () => {
  for (const pullFailure of ["429", "500"]) {
    const fake = fakeServer({ pullFailure });
    await assert.rejects(
      () => createDraft(input, { enabled: true, token: "mock", fetchImpl: fake.fetchImpl }),
      new RegExp(pullFailure)
    );
    assert.equal(fake.calls.filter(c => c.method === "DELETE").length, 0);
  }
});


test("qualified and colon-separated closing references prevent duplicate drafts",async()=>{
  for(const overlapText of ["Fixes 404TradeOS-LLC/TradeOS#910","Closes: #910","Resolves: 404TradeOS-LLC/TradeOS#910"]){
    const fake=fakeServer({overlapText});
    await assert.rejects(()=>createDraft(input,{enabled:true,token:"mock",fetchImpl:fake.fetchImpl}),/Overlapping/);
    assert.equal(fake.calls.filter(c=>c.method!=="GET").length,0);
  }
});

test("a draft targeting another base cannot reconcile an ambiguous publication",async()=>{
  const fake=fakeServer({pullFailure:"timeout",matchingOpenPr:true,wrongBase:true});
  await assert.rejects(()=>createDraft(input,{enabled:true,token:"mock",fetchImpl:fake.fetchImpl}),/connection lost/);
  assert.equal(fake.calls.filter(c=>c.method==="DELETE").length,0);
});

test("definitive rejection preserves the branch when PR inventory is empty",async()=>{
  const fake=fakeServer({pullFailure:"422"});
  await assert.rejects(()=>createDraft(input,{enabled:true,token:"mock",fetchImpl:fake.fetchImpl}),/422/);
  assert.equal(fake.calls.filter(c=>c.method==="DELETE").length,0);
});

test("review regression: a preserved branch with the identical tree is reused instead of a duplicate commit",async()=>{
  const fake=fakeServer({preservedBranch:true});
  const result=await createDraft(input,{enabled:true,token:"mock",fetchImpl:fake.fetchImpl});
  assert.equal(result.ok,true);
  assert.equal(result.headSha,commitSha);
  // No fresh commit was created: commit SHAs are timestamp-dependent, so a
  // duplicate commit could never match the preserved head.
  assert.equal(fake.calls.filter(c=>c.path.endsWith("/git/commits")&&c.method==="POST").length,0);
  assert.ok(fake.calls.some(c=>c.path.includes("/git/ref/heads/forge/")));
});

test("review regression: a preserved branch with different content is not reused",async()=>{
  const fake=fakeServer({preservedBranch:true,preservedTreeMismatch:true});
  const result=await createDraft(input,{enabled:true,token:"mock",fetchImpl:fake.fetchImpl});
  assert.equal(result.ok,true);
  assert.equal(fake.calls.filter(c=>c.path.endsWith("/git/commits")&&c.method==="POST").length,1);
});

test("review regression: a competing open PR adding the same docs/forge path blocks publication",async()=>{
  const fake=fakeServer({competingPr:{number:123,files:[{filename:"docs/forge/safe.md"}]}});
  await assert.rejects(()=>createDraft(input,{enabled:true,token:"mock",fetchImpl:fake.fetchImpl}),/Overlapping/);
  assert.equal(fake.calls.filter(c=>c.method!=="GET").length,0);
  assert.ok(fake.calls.some(c=>c.path.includes("/pulls/123/files")));
});

test("review regression: a competing open PR adding a different path does not block publication",async()=>{
  const fake=fakeServer({competingPr:{number:123,files:[{filename:"docs/forge/other.md"}]}});
  const result=await createDraft(input,{enabled:true,token:"mock",fetchImpl:fake.fetchImpl});
  assert.equal(result.ok,true);
});
