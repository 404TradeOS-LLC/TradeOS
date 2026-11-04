import {timingSafeEqual} from 'node:crypto';
import {collectQueue} from '../lib/github.js';
export function authorizeCron(request,secret=process.env.CRON_SECRET) {
  if (typeof secret!=='string' || secret.length<16) return false;
  const provided=request.headers.get('authorization')??'';
  const expected='Bearer '+secret;
  const a=Buffer.from(provided), b=Buffer.from(expected);
  return a.length===b.length && timingSafeEqual(a,b);
}
export async function GET(request) {
  if (!process.env.CRON_SECRET || process.env.CRON_SECRET.length<16) {
    return Response.json({error:'Cron authentication is not configured'},{status:503});
  }
  if (!authorizeCron(request)) return Response.json({error:'Unauthorized'},{status:401});
  try {
    const queue=await collectQueue();
    // Daily cron intentionally emits no comments and changes no PR/branch state.
    console.log(JSON.stringify({event:'forge_audit',timestamp:queue.generatedAt,
      count:queue.items.length,gates:queue.items.map(({number,gate})=>({number,gate}))}));
    return Response.json({status:'audited',timestamp:queue.generatedAt,count:queue.items.length,readOnly:true});
  } catch {
    return Response.json({error:'GitHub audit failed; no action taken'},{status:503});
  }
}
