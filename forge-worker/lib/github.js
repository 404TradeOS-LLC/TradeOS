import { REPO, summarize } from './policy.js';

const API='https://api.github.com';
const FETCH_LIMIT=12;
let cached=null;
let cachedUntil=0;
// Test-only: clears the 60-second queue cache so tests control their own state.
export function resetQueueCacheForTests() { cached=null; cachedUntil=0; }
function githubHeaders() {
  const headers={'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'tradeos-forge-readonly'};
  if (process.env.GITHUB_READ_TOKEN) headers.Authorization='Bearer '+process.env.GITHUB_READ_TOKEN;
  return headers;
}
async function request(path,opts={}) {
  if (typeof path !== 'string' || !path.startsWith('/')) throw Error('Invalid GitHub API path');
  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(),8000);
  try {
    const response=await fetch(API+path,{...opts,headers:{...githubHeaders(),...opts.headers},signal:controller.signal});
    if (!response.ok) throw Error('GitHub returned HTTP '+response.status);
    return await response.json();
  } finally {clearTimeout(timeout);}
}
async function threads(number) {
  if (!process.env.GITHUB_READ_TOKEN) return null;
  const query='query($owner:String!,$repo:String!,$number:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$number){reviewThreads(first:100){nodes{isResolved}pageInfo{hasNextPage}}}}}';
  const response=await request('/graphql',{method:'POST',body:JSON.stringify({query,variables:{owner:'404TradeOS-LLC',repo:'TradeOS',number}}),headers:{'Content-Type':'application/json'}});
  if (response.errors?.length) return null;
  const node=response.data?.repository?.pullRequest?.reviewThreads;
  if (!node || node.pageInfo?.hasNextPage !== false || !Array.isArray(node.nodes)) return null;
  return node.nodes.filter(t=>!t.isResolved).length;
}
export function reviewVerdict(reviews) {
  if (!Array.isArray(reviews) || reviews.length>=100) return 'unknown';
  const latest=new Map();
  for (const r of reviews) {
    const id=r.user?.id;
    if (id && r.state!=='COMMENTED') latest.set(id,r.state);
  }
  const states=[...latest.values()];
  if (states.includes('CHANGES_REQUESTED')) return 'changes_requested';
  if (states.includes('APPROVED')) return 'approved';
  return 'unverified';
}
async function item(pr) {
  const root='/repos/'+REPO;
  // The list endpoint omits mergeable, so fetch the single-PR detail for it.
  // A null detail value stays null (unknown) and the policy gate fails closed.
  const [detail,filesResponse,checksResponse,reviewsResponse,unresolved] = await Promise.all([
    request(root+'/pulls/'+pr.number),
    request(root+'/pulls/'+pr.number+'/files?per_page=100'),
    request(root+'/commits/'+encodeURIComponent(pr.head.sha)+'/check-runs?per_page=100'),
    request(root+'/pulls/'+pr.number+'/reviews?per_page=100'),
    threads(pr.number).catch(()=>null)
  ]);
  // Never combine data from different head commits. An updated PR must be
  // retried from a fresh list snapshot, not evaluated from mixed evidence.
  if (!detail?.head?.sha || detail.head.sha !== pr.head?.sha) {
    throw Error('Pull request head moved during evidence collection');
  }
  const checks=checksResponse.check_runs??[];
  return summarize({...pr,mergeable:detail?.mergeable ?? null},{
    files:filesResponse.map(f=>f.filename),
    filesComplete:filesResponse.length<100,
    checks,
    checksComplete:checksResponse.total_count===checks.length && checks.length>0,
    unresolvedReviewThreads:unresolved,
    reviewDecision:reviewVerdict(reviewsResponse)
  });
}
export async function collectQueue() {
  if (cached && Date.now()<cachedUntil) return cached;
  const list=await request('/repos/'+REPO+'/pulls?state=open&base=main&per_page='+FETCH_LIMIT);
  if (!Array.isArray(list)) throw Error('Unexpected GitHub response');
  const result=[];
  // Three-at-a-time caps both API load and execution time on the Hobby runtime.
  for (let offset=0; offset<list.length; offset+=3) {
    const batch=list.slice(offset,offset+3);
    const inspected=await Promise.all(batch.map(async(pr)=>{
      try {return await item(pr);}
      catch {
        const fallback=summarize(pr);
        return {...fallback,gate:'EVIDENCE_UNAVAILABLE',priority:99,
          action:'GitHub detail request failed; do not infer check or review readiness.'};
      }
    }));
    result.push(...inspected);
  }
  result.sort((a,b)=>b.priority-a.priority || a.number-b.number);
  cached={repository:REPO,generatedAt:new Date().toISOString(),headBound:true,readOnly:true,limitedTo:FETCH_LIMIT,
    truncated:list.length===FETCH_LIMIT,items:result};
  cachedUntil=Date.now()+60_000;
  return cached;
}
