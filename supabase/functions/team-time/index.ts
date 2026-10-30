// Source-controlled candidate derived from deployed staging Edge Function v6.
// The new bounded pagination is NOT deployed; verify against live v6 before release.
// The service-role key bypasses PostgreSQL RLS; all user/org/job checks in this
// function are therefore mandatory. Do NOT deploy to production by copying
// this file without an independent security, secrets, and CI review.
// TradeOS Team & Time staging API. All access is scoped to the authenticated
// Supabase user, active organization membership, and server-side job assignment.
const ORIGINS=new Set(['https://tradeos-dashboard-preview.showb201.chatgpt.site','http://localhost:5173','http://localhost:4173','http://127.0.0.1:4173'])
const SUPERVISORS=new Set(['owner','admin','manager','dispatcher'])
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const validId=(value:unknown):value is string=>typeof value==='string'&&UUID.test(value)
const now=()=>new Date().toISOString()
const value=(input:unknown,max=500)=>typeof input==='string'?input.trim().slice(0,max):''
function cors(req:Request){const origin=req.headers.get('origin')||'';return {'Access-Control-Allow-Origin':ORIGINS.has(origin)?origin:'https://tradeos-dashboard-preview.showb201.chatgpt.site','Access-Control-Allow-Headers':'apikey, authorization, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Max-Age':'600','Vary':'Origin'}}
function reply(req:Request,data:unknown,status=200){return Response.json(data,{status,headers:{...cors(req),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}
class HttpError extends Error{status:number;constructor(status:number,message:string){super(message);this.status=status}}
function key(kind:'secret'|'publishable'){
 const modern=Deno.env.get(kind==='secret'?'SUPABASE_SECRET_KEYS':'SUPABASE_PUBLISHABLE_KEYS')
 if(modern){
  const parsed=JSON.parse(modern)
  const name=parsed.default||Object.values(parsed)[0]
  // Supabase supplies an environment variable name in this map, not the key itself.
  if(typeof name==='string')return Deno.env.get(name)||''
 }
 return Deno.env.get(kind==='secret'?'SUPABASE_SERVICE_ROLE_KEY':'SUPABASE_ANON_KEY')||''
}
function url(table:string,params:Record<string,string>){const u=new URL(`/rest/v1/${table}`,Deno.env.get('SUPABASE_URL'));for(const [k,v] of Object.entries(params))u.searchParams.set(k,v);return u}
async function db(table:string,params:Record<string,string>={},method='GET',payload?:unknown){
 const response=await fetch(url(table,params),{method,headers:{apikey:key('secret'),'Content-Type':'application/json',...(method==='GET'?{}:{Prefer:method==='POST'&&params.on_conflict?'resolution=merge-duplicates,return=representation':'return=representation'})},body:payload===undefined?undefined:JSON.stringify(payload)})
 if(!response.ok){const body=await response.json().catch(()=>({}));if(response.status===409||body.code==='23505'||body.code==='23P01')throw new HttpError(409,'This time record changed. Refresh and try again.');throw new HttpError(500,'The time service could not save this change.')}
 return response.status===204?[]:await response.json()
}
// Pagination is scoped by the already-verified organization and user filters.
// Never truncate approvals/exports to an arbitrary first page. Fail explicitly
// at a hard resource limit instead of returning a misleading partial result.
async function allRows<T>(table:string,params:Record<string,string>,maxRows=10000):Promise<T[]>{ 
 const pageSize=200
 const all:T[]=[]
 for(let offset=0;offset<=maxRows;offset+=pageSize){
  const page=await db(table,{...params,limit:String(pageSize),offset:String(offset)}) as T[]
  if(!Array.isArray(page))throw new HttpError(503,'Team & Time could not load the complete records.')
  all.push(...page)
  if(all.length>maxRows)throw new HttpError(503,'Too many time records to display or export. Narrow this workspace before continuing.')
  if(page.length<pageSize)return all
 }
 throw new HttpError(503,'Team & Time did not finish loading records. No partial export was returned.')
}
async function actor(req:Request){
 const token=req.headers.get('authorization')||''
 if(!/^Bearer\s+\S+$/.test(token))throw new HttpError(401,'Sign in to record time.')
 const response=await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`,{headers:{apikey:key('publishable'),Authorization:token}})
 if(!response.ok)throw new HttpError(401,'Your session has expired. Sign in again.')
 const auth=await response.json()
 if(!validId(auth.id))throw new HttpError(401,'A valid worker session is required.')
 const users=await db('users',{select:'id,full_name',auth_subject:`eq.${auth.id}`,is_active:'eq.true',limit:'1'})
 if(!users[0])throw new HttpError(403,'Your account is not active in TradeOS.')
 return users[0]
}
async function context(user:{id:string},orgId:unknown){
 const memberships=await db('organization_memberships',{select:'org_id,role',user_id:`eq.${user.id}`,status:'eq.active',limit:'50'})
 if(!memberships.length)throw new HttpError(403,'Your account is not on an active team.')
 if(!validId(orgId))return {memberships,selected:null}
 const selected=memberships.find((m:{org_id:string})=>m.org_id===orgId)
 if(!selected)throw new HttpError(403,'This organization is not available to your account.')
 return {memberships,selected}
}
async function shiftInOrg(id:unknown,orgId:string){
 if(!validId(id))throw new HttpError(400,'Select a valid time entry.')
 const rows=await db('team_time_shifts',{select:'*',id:`eq.${id}`,org_id:`eq.${orgId}`,limit:'1'})
 if(!rows[0])throw new HttpError(404,'That time entry is no longer available.')
 return rows[0]
}
async function profile(orgId:string,userId:string){
 const rows=await db('team_time_profiles',{select:'org_id,user_id,worker_type,subcontractor_id,active',org_id:`eq.${orgId}`,user_id:`eq.${userId}`,limit:'1'})
 if(!rows[0]?.active)throw new HttpError(403,'Your worker profile needs to be set up before clocking in.')
 return rows[0]
}
async function authorizedJob(orgId:string,userId:string,jobId:unknown){
 if(!validId(jobId))throw new HttpError(400,'Select a job assigned to you.')
 const [job]=await db('jobs',{select:'id,org_id,title,scheduled_start,scheduled_end',id:`eq.${jobId}`,org_id:`eq.${orgId}`,archived_at:'is.null',limit:'1'})
 const [assignment]=await db('job_assignments',{select:'id',org_id:`eq.${orgId}`,job_id:`eq.${jobId}`,user_id:`eq.${userId}`,removed_at:'is.null',limit:'1'})
 if(!job||!assignment)throw new HttpError(403,'This job is not assigned to your account.')
 return job
}
async function bootstrap(req:Request,user:{id:string,full_name:string},orgId:unknown){
 const {memberships,selected}=await context(user,orgId)
 if(!selected&&memberships.length===1)return bootstrap(req,user,memberships[0].org_id)
 const organizationIds=memberships.map((m:{org_id:string})=>m.org_id).filter(validId)
 const organizationNames=await db('organizations',{select:'id,name',id:`in.(${organizationIds.join(',')})`,limit:'50'})
 const organizations=memberships.map((m:{org_id:string,role:string})=>({id:m.org_id,name:organizationNames.find((o:{id:string})=>o.id===m.org_id)?.name||'Company',role:m.role}))
 if(!selected)return reply(req,{organizations,selectOrganization:true})
 const org=selected.org_id,supervisor=SUPERVISORS.has(selected.role)
 const ownProfile=(await db('team_time_profiles',{select:'user_id,worker_type,active',org_id:`eq.${org}`,user_id:`eq.${user.id}`,limit:'1'}))[0]||null
 const assignments=await allRows<{job_id:string}>('job_assignments',{select:'job_id',org_id:`eq.${org}`,user_id:`eq.${user.id}`,removed_at:'is.null',order:'id.asc'})
 const shifts=await allRows<{job_id:string}>('team_time_shifts',{select:'id,org_id,worker_user_id,worker_type,job_id,started_at,ended_at,break_started_at,break_minutes,note,status,corrected_at,correction_reason,reviewed_at,reviewed_by_id,updated_at',org_id:`eq.${org}`,...(supervisor?{}:{worker_user_id:`eq.${user.id}`}),order:'started_at.desc,id.desc'})
 const jobIds=[...new Set([...assignments.map((a:{job_id:string})=>a.job_id),...shifts.map((s:{job_id:string})=>s.job_id)])].filter(validId)
 const jobs=jobIds.length?await db('jobs',{select:'id,title,scheduled_start,scheduled_end',org_id:`eq.${org}`,id:`in.(${jobIds.join(',')})`,archived_at:'is.null',limit:'100'}):[]
 let workers=[]
 if(supervisor){const memberships=await db('organization_memberships',{select:'user_id,role',org_id:`eq.${org}`,status:'eq.active',limit:'100'});const ids=memberships.map((m:{user_id:string})=>m.user_id).filter(validId);const names=ids.length?await db('users',{select:'id,full_name',id:`in.(${ids.join(',')})`,is_active:'eq.true',limit:'100'}):[];const profiles=await db('team_time_profiles',{select:'user_id,worker_type,active',org_id:`eq.${org}`,limit:'100'});workers=names.map((n:{id:string,full_name:string})=>({id:n.id,name:n.full_name,role:memberships.find((m:{user_id:string})=>m.user_id===n.id)?.role,workerType:profiles.find((p:{user_id:string})=>p.user_id===n.id)?.worker_type||null,active:profiles.find((p:{user_id:string})=>p.user_id===n.id)?.active??false}))}
 return reply(req,{orgId:org,role:selected.role,user:{id:user.id,name:user.full_name},workerType:ownProfile?.active?ownProfile.worker_type:null,supervisor,jobs,assignedJobIds:assignments.map((a:{job_id:string})=>a.job_id),shifts,workers,organizations})
}
async function mutate(req:Request,body:Record<string,unknown>,user:{id:string}){
 const action=body.action
 const {selected}=await context(user,body.orgId)
 if(!selected)throw new HttpError(400,'Select an organization first.')
 const org=selected.org_id,supervisor=SUPERVISORS.has(selected.role),at=now()
 if(action==='configure_profile'){
  if(!supervisor)throw new HttpError(403,'Only a team manager can set worker types.')
  const workerId=body.workerId,type=body.workerType,subId=body.subcontractorId
  if(!validId(workerId)||!['employee','subcontractor'].includes(String(type)))throw new HttpError(400,'Choose a team member and worker type.')
  const [member]=await db('organization_memberships',{select:'id',org_id:`eq.${org}`,user_id:`eq.${workerId}`,status:'eq.active',limit:'1'})
  if(!member)throw new HttpError(403,'This person is not on your team.')
  if(subId!==null&&subId!==undefined){if(type!=='subcontractor'||!validId(subId))throw new HttpError(400,'Choose a valid subcontractor.');const [sub]=await db('subcontractors',{select:'id',id:`eq.${subId}`,org_id:`eq.${org}`,limit:'1'});if(!sub)throw new HttpError(403,'That subcontractor is not in this organization.')}
  const [saved]=await db('team_time_profiles',{on_conflict:'org_id,user_id'},'POST',{org_id:org,user_id:workerId,worker_type:type,subcontractor_id:type==='subcontractor'?(subId||null):null,active:true,updated_at:at})
  return reply(req,{profile:saved})
 }
 if(action==='clock_in'){
  const worker=await profile(org,user.id)
  const job=await authorizedJob(org,user.id,body.jobId)
  const [shift]=await db('team_time_shifts',{},'POST',{org_id:org,worker_user_id:user.id,worker_type:worker.worker_type,job_id:job.id,started_at:at,status:'open',last_actor_id:user.id,last_action:'clock_in'})
  return reply(req,{shift},201)
 }
 if(['break_start','break_end','clock_out'].includes(String(action))){
  const shift=await shiftInOrg(body.shiftId,org)
  if(shift.worker_user_id!==user.id)throw new HttpError(403,'You can only change your own open shift.')
  if(shift.ended_at)throw new HttpError(409,'This shift has already ended.')
  const filters:Record<string,string>={id:`eq.${shift.id}`,org_id:`eq.${org}`,worker_user_id:`eq.${user.id}`,ended_at:'is.null',status:'eq.open'}
  let changes:Record<string,unknown>={last_actor_id:user.id,last_action:action,updated_at:at}
  if(action==='break_start'){
   if(shift.break_started_at)throw new HttpError(409,'A break is already running.')
   changes={...changes,break_started_at:at}
   filters['break_started_at']='is.null'
  }else if(action==='break_end'){
   if(!shift.break_started_at)throw new HttpError(409,'No break is running.')
   changes={...changes,break_started_at:null,break_minutes:shift.break_minutes+Math.max(0,Math.round((Date.parse(at)-Date.parse(shift.break_started_at))/60000))}
   filters['break_started_at']=`eq.${shift.break_started_at}`
  }else{
   const extra=shift.break_started_at?Math.max(0,Math.round((Date.parse(at)-Date.parse(shift.break_started_at))/60000)):0
   changes={...changes,ended_at:at,break_started_at:null,break_minutes:shift.break_minutes+extra,note:value(body.note),status:'pending'}
   filters['break_started_at']=shift.break_started_at?`eq.${shift.break_started_at}`:'is.null'
  }
  const rows=await db('team_time_shifts',{...filters,select:'*'},'PATCH',changes)
  if(rows.length!==1)throw new HttpError(409,'This shift changed. Refresh and try again.')
  return reply(req,{shift:rows[0]})
 }
 if(action==='correct'||action==='approve'||action==='reopen'){
  if(!supervisor)throw new HttpError(403,'Only a team manager can review time.')
  const shift=await shiftInOrg(body.shiftId,org)
  if(!shift.ended_at)throw new HttpError(409,'Clock out before reviewing a shift.')
  let changes:Record<string,unknown>={last_actor_id:user.id,last_action:action,updated_at:at}
  if(action==='correct'){
   const reason=value(body.reason),start=Date.parse(String(body.startedAt)),end=Date.parse(String(body.endedAt)),breakMinutes=Number(body.breakMinutes)
   if(!reason||!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>24*3600000||!Number.isInteger(breakMinutes)||breakMinutes<0||breakMinutes*60000>=end-start)throw new HttpError(400,'Enter valid shift times, break minutes, and a correction reason.')
   changes={...changes,started_at:new Date(start).toISOString(),ended_at:new Date(end).toISOString(),break_minutes:breakMinutes,break_started_at:null,status:'pending',corrected_at:at,correction_reason:reason,reviewed_at:null,reviewed_by_id:null}
  }else{
   const expected=action==='approve'?'pending':'approved'
   if(shift.status!==expected)throw new HttpError(409,'This shift has already changed review state.')
   changes={...changes,status:action==='approve'?'approved':'pending',reviewed_at:action==='approve'?at:null,reviewed_by_id:action==='approve'?user.id:null}
  }
  const rows=await db('team_time_shifts',{id:`eq.${shift.id}`,org_id:`eq.${org}`,status:`eq.${shift.status}`,updated_at:`eq.${shift.updated_at}`,select:'*'},'PATCH',changes)
  if(rows.length!==1)throw new HttpError(409,'This shift changed. Refresh and try again.')
  return reply(req,{shift:rows[0]})
 }
 throw new HttpError(400,'This time action is not available.')
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(req)})
 if(req.method!=='POST')return reply(req,{error:'Use POST.'},405)
 try{
  const body=await req.json().catch(()=>null)
  if(!body||typeof body!=='object'||Array.isArray(body))throw new HttpError(400,'Send a valid time request.')
  const user=await actor(req)
  return body.action==='bootstrap'?await bootstrap(req,user,body.orgId):await mutate(req,body,user)
 }catch(error){const status=error instanceof HttpError?error.status:500;return reply(req,{error:status===500?'The time service is unavailable. Try again later.':(error as Error).message},status)}
})
