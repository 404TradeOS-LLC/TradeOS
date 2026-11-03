import 'server-only';
import { releaseGates, parseRequiredCheckPolicy, collectLatestCommitStatuses, firstStagingDeployment, vercelDeploymentsNextCursor, type BetaSnapshot, type CheckState, type PrStatus, markReviewFetchFailure, type DeploymentObservation, type RequiredCheckBinding } from './beta-control';

const OWNER='404TradeOS-LLC';
const REPO='TradeOS';
const PR_NUMBERS=[810,891,905,906] as const;
const API=`https://api.github.com/repos/${OWNER}/${REPO}`;
const TOKEN=process.env.TRADEOS_GITHUB_READ_TOKEN;
const HEADERS: Record<string,string> = {
  Accept:'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28',
  ...(TOKEN ? { Authorization:`Bearer ${TOKEN}` }: {}),
};

type JsonRecord=Record<string,unknown>;
function asObject(value:unknown): JsonRecord {return value !== null && typeof value==='object' ? value as JsonRecord : {};}
function str(value:unknown):string|null {return typeof value==='string' ? value : null;}
async function github(path:string):Promise<JsonRecord> {
  const response=await fetch(`${API}${path}`,{headers:HEADERS,cache:'no-store',signal:AbortSignal.timeout(8000)});
  if(!response.ok) throw new Error(`GitHub ${response.status} for read-only ${path.split('?')[0]}`);
  return asObject(await response.json());
}
// Required checks come from the main branch ruleset, not legacy branch
// protection (which 404s: main is protected by ruleset, not a protection
// object). The rules read needs no special scope on a public repository and
// fails closed to unknown, never verified. No legacy fallback: a stale
// protection object must never override the ruleset policy.
async function requiredCheckPolicy(): Promise<{known:boolean;names:string[];bindings:RequiredCheckBinding[]}> {
  try {
    const response=await fetch(`${API}/rules/branches/main`,{headers:HEADERS,cache:'no-store',signal:AbortSignal.timeout(8000)});
    if(!response.ok) throw new Error(`GitHub ${response.status} for rules/branches/main`);
    return parseRequiredCheckPolicy(await response.json());
  }catch{return {known:false,names:[],bindings:[]};}
}
async function threadsFor(number:number):Promise<number|null> {
  if(!TOKEN) return null;
  const query=`query($owner:String!,$repo:String!,$number:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$number){reviewThreads(first:100){pageInfo{hasNextPage}nodes{isResolved}}}}}`;
  try {
    const response=await fetch('https://api.github.com/graphql',{method:'POST',headers:{...HEADERS,'Content-Type':'application/json'},body:JSON.stringify({query,variables:{owner:OWNER,repo:REPO,number}}),cache:'no-store',signal:AbortSignal.timeout(8000)});
    if(!response.ok) return null;
    const body=asObject(await response.json());
    if(Array.isArray(body.errors)&&body.errors.length) return null;
    const connection=asObject(asObject(asObject(body.data).repository).pullRequest).reviewThreads;
    const result=asObject(connection);
    if(asObject(result.pageInfo).hasNextPage===true || !Array.isArray(result.nodes)) return null;
    return result.nodes.filter((node:unknown)=>asObject(node).isResolved!==true).length;
  }catch{return null;}
}
async function commitStatuses(head: string): Promise<CheckState[]> {
  // Statuses are a separate API surface from check runs: a required context
  // published only as a commit status is invisible to the check-runs read.
  // Rows map with appId null (see commitStatusToCheck), so a status can
  // satisfy only an unbound requirement, never a bound one.
  const rows: CheckState[] = [];
  const seenContexts = new Set<string>();
  let next: string | null = `${API}/commits/${head}/statuses?per_page=100`;
  for (let page = 0; next && page < 10; page++) {
    const response: Response = await fetch(next, { headers: HEADERS, cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`GitHub ${response.status} for commit statuses`);
    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new Error('Commit statuses not an array');
    rows.push(...collectLatestCommitStatuses(data, seenContexts));
    next = response.headers.get('link')?.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
  }
  if (next) throw new Error('Commit status pagination incomplete');
  return rows;
}
async function readPR(number:number, required:{known:boolean;names:string[];bindings:RequiredCheckBinding[]}):Promise<PrStatus> {
  const url=`https://github.com/${OWNER}/${REPO}/pull/${number}`;
  try {
    const p=await github(`/pulls/${number}`);
    const head=str(asObject(p.head).sha);
    const base=str(asObject(p.base).sha);
    const errors:string[]=[];
    const requests=await Promise.allSettled([
      head ? github(`/commits/${head}/check-runs?per_page=100&filter=latest`) : Promise.reject(Error('No head SHA')),
      head ? github(`/compare/main...${head}`) : Promise.reject(Error('No head SHA')),
      threadsFor(number),
      head ? commitStatuses(head) : Promise.reject(Error('No head SHA')),
    ]);
    const [checkResult, compareResult, threadResult, statusResult]=requests;
    let checks:CheckState[]=[];
    const checkCoverage=checkResult.status==='fulfilled' &&
      Array.isArray(checkResult.value.check_runs) &&
      typeof checkResult.value.total_count === 'number' &&
      Number.isInteger(checkResult.value.total_count) &&
      checkResult.value.total_count <= checkResult.value.check_runs.length;
    if(checkResult.status==='fulfilled') {
      const data=checkResult.value;
      const rows=Array.isArray(data.check_runs) ? data.check_runs : [];
      checks=rows.map((item:unknown)=>{
        const c=asObject(item);
        const app=asObject(c.app);
        return {name:str(c.name)||'Unnamed check', status:str(c.status)||'unknown',conclusion:str(c.conclusion),url:str(c.html_url),appId:typeof app.id==='number'&&Number.isInteger(app.id)?app.id:null};
      });
    }else {errors.push('Current-head check data unavailable');}
    if(statusResult.status==='fulfilled') checks.push(...statusResult.value);
    else if(head) errors.push('Commit status data unavailable');
    let behind:number|null=null;
    if(compareResult.status==='fulfilled' && typeof compareResult.value.behind_by==='number') behind=compareResult.value.behind_by;
    else errors.push('Main branch comparison unavailable');
    const review:PrStatus['review']='unverified';
    let unresolvedThreads:number|null=null;
    if(threadResult.status==='fulfilled') unresolvedThreads=threadResult.value;
    // Check-run listing truncation cannot be certified as complete.
    const merged = typeof p.merged === 'boolean' ? p.merged :
      typeof p.merged_at === 'string' ? true : p.merged_at === null ? false : null;
    return {number,title:str(p.title)||`PR #${number}`,url,state:str(p.state)||'unknown',head,base,merged,draft:typeof p.draft==='boolean'?p.draft:null,
      mergeable:typeof p.mergeable==='boolean'?p.mergeable:null,behind,unresolvedThreads,review,checks,
      requiredChecksKnown:required.known&&checkCoverage,requiredCheckNames:required.names,requiredChecks:required.bindings,error:errors.length?errors.join('; '):null};
  }catch(e){return {number,title:`PR #${number}`,url,state:'unknown',head:null,base:null,merged:null,draft:null,mergeable:null,behind:null,unresolvedThreads:null,review:'unverified',checks:[],requiredChecksKnown:false,requiredCheckNames:[],requiredChecks:[],error:e instanceof Error?e.message:'GitHub read failed'};}
}

// GitHub /reviews returns an array; normalize it separately from object endpoints.
async function ghArray(path:string):Promise<unknown[]> {
  const rows:unknown[]=[];
  let next:string|null=`${API}${path}`;
  for(let page=0;next&&page<10;page++){
    const response: Response=await fetch(next,{headers:HEADERS,cache:'no-store',signal:AbortSignal.timeout(8000)});
    if(!response.ok) throw Error(`GitHub ${response.status}`);
    const data:unknown=await response.json();
    if(!Array.isArray(data))throw Error('Reviews not an array');
    rows.push(...data);
    next=response.headers.get('link')?.match(/<([^>]+)>;\s*rel="next"/)?.[1]??null;
  }
  if(next) throw Error('Review pagination incomplete');
  return rows;
}

async function findVercelDeployment(projectId:string|undefined):Promise<DeploymentObservation|null> {
  const token=process.env.TRADEOS_VERCEL_READ_TOKEN;
  if(!token||!projectId) return null;
  try{
    // Page through deployments with a fixed bound: the first page alone can
    // miss the latest staging deployment once more than 25 newer
    // deployments exist. The list cursor is a millisecond timestamp passed
    // back as `until`; stop at the first staging match, and report
    // unavailable only after the bound is exhausted.
    let until:number|null=null;
    for(let page=0;page<4;page++){
      const url=new URL('https://api.vercel.com/v6/deployments');url.searchParams.set('projectId',projectId);url.searchParams.set('limit','25');
      if(until!==null) url.searchParams.set('until',String(until));
      if(process.env.TRADEOS_VERCEL_TEAM_ID) url.searchParams.set('teamId',process.env.TRADEOS_VERCEL_TEAM_ID);
      const r=await fetch(url,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.timeout(8000)});
      if(!r.ok)return null;
      const body=asObject(await r.json());
      const deployment=firstStagingDeployment(body.deployments);
      if(deployment){
        return {sha:str(asObject(deployment.meta).githubCommitSha),state:str(deployment.readyState)||'unknown',target:str(deployment.target)||'preview',
          url:typeof deployment.url==='string' && /^[a-z0-9-]+\.vercel\.app$/i.test(deployment.url)?`https://${deployment.url}`:null,
          observedAt:typeof deployment.createdAt==='number'?new Date(deployment.createdAt).toISOString():null};
      }
      until=vercelDeploymentsNextCursor(body);
      if(until===null)return null;
    }
    return null;
  }catch{return null;}
}

async function workflowRuns():Promise<BetaSnapshot['workflowRuns']>{
  try {
    const x=await github('/actions/workflows/beta-evidence.yml/runs?per_page=10');
    return (Array.isArray(x.workflow_runs)?x.workflow_runs:[]).map((item:unknown)=>{
      const v=asObject(item);return {id:Number(v.id),url:str(v.html_url)||`https://github.com/${OWNER}/${REPO}/actions/workflows/beta-evidence.yml`,
        name:str(v.name)||'Beta Evidence',conclusion:str(v.conclusion),head:str(v.head_sha),createdAt:str(v.created_at)||''};
    }).filter(r=>Number.isInteger(r.id));
  }catch{return [];}
}

export async function getBetaSnapshot():Promise<BetaSnapshot> {
  const [required, reviews] = await Promise.all([
    requiredCheckPolicy(),
    Promise.all(PR_NUMBERS.map(async number=>{
      try{return [number,await ghArray(`/pulls/${number}/reviews?per_page=100`)] as const;}catch{return [number,null] as const;}
    }))
  ]);
  const reviewByPr=new Map<number,unknown[]|null>(reviews);
  const [prs,runs,api,web]=await Promise.all([
    Promise.all(PR_NUMBERS.map(n=>readPR(n,required))),
    workflowRuns(),
    findVercelDeployment(process.env.TRADEOS_VERCEL_STAGING_API_PROJECT_ID),
    findVercelDeployment(process.env.TRADEOS_VERCEL_STAGING_WEB_PROJECT_ID),
  ]);
  for(const pr of prs){
    const rows=reviewByPr.get(pr.number);
    if(!rows) {
      // A failed read is not proof of no approvals. Surface the visibility
      // failure and deny all green PR/release indicators.
      Object.assign(pr, markReviewFetchFailure(pr));
      continue;
    }
    if(rows){
      const latest=new Map<string,{state:string;commit:string|null}>();
      for(const entry of rows){const r=asObject(entry);const login=str(asObject(r.user).login);const state=str(r.state);
        if(login&&state&&state!=='COMMENTED'&&state!=='PENDING'&&!login.endsWith('[bot]')&&!login.toLowerCase().includes('coderabbit')&&!login.toLowerCase().includes('copilot'))latest.set(login,{state,commit:str(r.commit_id)});
      }
      const values=[...latest.values()];
      pr.review=values.some(v=>v.state==='CHANGES_REQUESTED')?'changes-requested':(values.some(v=>v.state==='APPROVED'&&pr.head!==null&&v.commit===pr.head)?'approved':'unverified');
    }
  }
  const errors=prs.filter(p=>p.error).map(p=>`#${p.number}: ${p.error}`);
  if(!required.known)errors.push('Required-check policy (main ruleset) could not be read; merge gate unverified.');
  if(!TOKEN)errors.push('GitHub review threads require TRADEOS_GITHUB_READ_TOKEN; thread state unverified.');
  return {fetchedAt:new Date().toISOString(),prs,gates:releaseGates,
    deployments:{api,web,runtimeBindingIdentity:null},workflowRuns:runs,errors};
}