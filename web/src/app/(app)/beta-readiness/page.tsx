import { notFound, redirect } from 'next/navigation';
import { BetaBoard } from './beta-board';
import { getSession, getSessionToken } from '@/lib/session';
import { getOrganizationSettings, ApiClientError } from '@/lib/api';
import { getBetaSnapshot } from '@/lib/beta-github';
import { isAuthorizedBetaOperator } from '@/lib/beta-control';

export const dynamic='force-dynamic';
export const metadata={title:'Beta readiness | TradeOS',robots:{index:false,follow:false}};

export default async function BetaReadinessPage(){
  const session=await getSession();
  if(!session)redirect('/login');
  const token=await getSessionToken();
  if(!token)notFound();
  let role:string|null=null;
  let orgId:string|null=null;
  try {
    const settings=await getOrganizationSettings(token,AbortSignal.timeout(4000));
    role=settings.currentRole;
    orgId=settings.orgId;
  } catch(error) {
    if(error instanceof ApiClientError && (error.status === 401 || error.status === 403))notFound();
    return <main className="min-h-screen bg-[#111315] px-4 py-14 text-slate-200"><div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-[#1b1d20] p-6"><h1 className="text-lg font-semibold text-white">Beta readiness is temporarily unavailable</h1><p className="mt-2 text-sm leading-6 text-slate-400">Your access check could not be completed. Refresh the page to try again.</p></div></main>;
  }
  // Fail closed before any platform-wide GitHub or deployment reads. This is
  // server-only configuration, not a NEXT_PUBLIC_ variable or tenant setting.
  if(!isAuthorizedBetaOperator(role,orgId,process.env.TRADEOS_BETA_OPERATOR_ORG_ID))notFound();
  return <BetaBoard snapshot={await getBetaSnapshot()}/>;
}