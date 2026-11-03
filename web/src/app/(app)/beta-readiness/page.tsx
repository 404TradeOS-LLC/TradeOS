import { notFound, redirect } from 'next/navigation';
import { BetaBoard } from './beta-board';
import { getSession, getSessionToken } from '@/lib/session';
import { getOrganizationSettings } from '@/lib/api';
import { getBetaSnapshot } from '@/lib/beta-github';

export const dynamic='force-dynamic';
export const metadata={title:'Beta readiness | TradeOS',robots:{index:false,follow:false}};

export default async function BetaReadinessPage(){
  const session=await getSession();
  if(!session)redirect('/login');
  const token=await getSessionToken();
  if(!token)notFound();
  let role:string|null=null;
  try{role=(await getOrganizationSettings(token,AbortSignal.timeout(4000))).currentRole;}
  catch{notFound();}
  if(role!=='owner'&&role!=='admin')notFound();
  return <BetaBoard snapshot={await getBetaSnapshot()}/>;
}