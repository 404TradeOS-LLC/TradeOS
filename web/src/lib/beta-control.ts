export type EvidenceState = 'verified' | 'blocked' | 'unverified';
export type CheckState = { name: string; status: string; conclusion: string | null; url: string | null; appId?: number | null };
export type RequiredCheckBinding = { name: string; integrationIds: number[] };
export type PrStatus = {
  number: number; title: string; url: string; state: string; head: string | null; base: string | null; merged?: boolean | null;
  draft: boolean | null; mergeable: boolean | null; behind: number | null;
  unresolvedThreads: number | null; review: 'approved' | 'changes-requested' | 'unverified';
  checks: CheckState[]; requiredChecksKnown: boolean; requiredCheckNames: string[]; requiredChecks?: RequiredCheckBinding[]; error: string | null;
};

// Reuse the same strict server-visible role policy in the UI's acceptance tests.
// Unknown/case-mismatched roles never gain control-surface access.
export function isBetaReadinessOperatorRole(role: unknown): role is 'owner' | 'admin' {
  return role === 'owner' || role === 'admin';
}

// PR lanes that were deliberately closed without merging are resolved
// alternatives, not active merge conflicts. Merging one of those overlapping
// migration lanes is an unsafe conflict, not a successful release gate.
export function prCardStatus(pr: PrStatus): string {
  if (pr.number === 905 || pr.number === 906) {
    if (pr.state === 'closed') return pr.merged === false ? 'superseded' : 'blocked';
  }
  if (pr.state === 'closed') return pr.merged === true ? 'merged' : 'blocked';
  if (pr.error) return 'unverified';
  if (pr.draft === true) return 'draft';
  if (pr.mergeable === false) return 'blocked';
  const checks = evaluateChecks(pr);
  if (checks.state === 'verified' && (pr.review !== 'approved' || pr.unresolvedThreads !== 0)) return 'unverified';
  return checks.state;
}

// Parses the GET /rules/branches/main response: an array of rule entries, one
// per rule, each carrying its ruleset id. Only required_status_checks entries
// contribute; contexts are grouped so one context bound by several rulesets
// accepts a success from any of its bound apps. A non-array payload is not a
// readable policy and fails closed.
export function parseRequiredCheckPolicy(payload: unknown): { known: boolean; names: string[]; bindings: RequiredCheckBinding[] } {
  if (!Array.isArray(payload)) return { known: false, names: [], bindings: [] };
  const byName = new Map<string, Set<number>>();
  for (const entry of payload) {
    if (!entry || typeof entry !== 'object') continue;
    if ((entry as Record<string, unknown>).type !== 'required_status_checks') continue;
    const params = (entry as Record<string, unknown>).parameters;
    if (!params || typeof params !== 'object') continue;
    const rows = (params as Record<string, unknown>).required_status_checks;
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const context = (row as Record<string, unknown>).context;
      if (typeof context !== 'string' || !context) continue;
      if (!byName.has(context)) byName.set(context, new Set());
      const id = (row as Record<string, unknown>).integration_id;
      if (typeof id === 'number' && Number.isInteger(id)) byName.get(context)!.add(id);
    }
  }
  const bindings = [...byName.entries()].map(([name, ids]) => ({ name, integrationIds: [...ids] }));
  return { known: true, names: bindings.map(b => b.name), bindings };
}

// Maps one Statuses API entry to a CheckState, or null when malformed.
// Commit statuses carry no app identity, so the mapped row always has
// appId null: evaluateChecks already fails a bound requirement closed for
// null appIds, while an unbound requirement accepts the row like any other
// success. Callers skip nulls.
export function commitStatusToCheck(status: unknown): CheckState | null {
  if (!status || typeof status !== 'object') return null;
  const row = status as Record<string, unknown>;
  if (typeof row.context !== 'string' || !row.context) return null;
  if (row.state !== 'pending' && row.state !== 'success' && row.state !== 'error' && row.state !== 'failure') return null;
  return {
    name: row.context,
    status: row.state === 'pending' ? 'queued' : 'completed',
    conclusion: row.state === 'success' ? 'success' : row.state === 'pending' ? null : 'failure',
    url: typeof row.target_url === 'string' ? row.target_url : null,
    appId: null,
  };
}

// GitHub's commit-status list is newest-first. Consume only the first status
// for each context, even if older successes appear on subsequent pages.
// Reserve a context before mapping: malformed newer data must never allow a
// stale success to satisfy a required check.
export function collectLatestCommitStatuses(statuses: unknown[], seenContexts: Set<string>): CheckState[] {
  const latest: CheckState[] = [];
  for (const raw of statuses) {
    if (!raw || typeof raw !== 'object') continue;
    const context = (raw as Record<string, unknown>).context;
    if (typeof context !== 'string' || !context || seenContexts.has(context)) continue;
    seenContexts.add(context);
    const check = commitStatusToCheck(raw);
    if (check) latest.push(check);
  }
  return latest;
}

// Pure Vercel list-deployments helpers, kept here for testability (the
// reader module is server-only and cannot be imported by node tests).
// firstStagingDeployment mirrors the board's staging-match criteria:
// non-production target with a staging branch ref, first match in list
// order (newest first). vercelDeploymentsNextCursor reads the list cursor
// (a millisecond timestamp) or null when paging ends or is malformed.
export function firstStagingDeployment(deployments: unknown): Record<string, unknown> | null {
  if (!Array.isArray(deployments)) return null;
  for (const item of deployments) {
    if (!item || typeof item !== 'object') continue;
    const d = item as Record<string, unknown>;
    const meta = d.meta;
    if (d.target !== 'production' && meta && typeof meta === 'object' && (meta as Record<string, unknown>).githubCommitRef === 'staging') return d;
  }
  return null;
}
export function vercelDeploymentsNextCursor(body: unknown): number | null {
  if (!body || typeof body !== 'object') return null;
  const pagination = (body as Record<string, unknown>).pagination;
  if (!pagination || typeof pagination !== 'object') return null;
  const next = (pagination as Record<string, unknown>).next;
  return typeof next === 'number' && Number.isFinite(next) ? next : null;
}
export type ReleaseGate = { id: string; phase: string; label: string; description: string; state: EvidenceState; proof: string | null; action: string };
export type DeploymentObservation = { sha: string | null; state: string; target: string; url: string | null; observedAt: string | null };
export type BetaSnapshot = {
  fetchedAt: string; prs: PrStatus[]; gates: ReleaseGate[];
  deployments: { api: DeploymentObservation | null; web: DeploymentObservation | null; runtimeBindingIdentity: null };
  workflowRuns: { id: number; url: string; name: string; conclusion: string | null; head: string | null; createdAt: string }[];
  errors: string[];
};

// These gates are attestation requirements, not checkboxes an operator can self-certify.
// A GitHub green check or a successful preflight is not accepted as staging/browser proof.
export const releaseGates: ReleaseGate[] = [
  { id:'inventory',phase:'01 · Database',label:'Migration inventory and SHA-256 checksums',description:'Reconcile exact source inventory with staging _prisma_migrations; preserve the completed 20261028151000_accepted_proposal_job_handoff checksum and never replay the handoff migration.',state:'unverified',proof:null,action:'Run the protected read-only staging inventory/checksum preflight and archive source SHA + ledger output.' },
  { id:'authorization',phase:'01 · Database',label:'Staging-only migration authorization',description:'Require a reviewed, main-trusted protected staging workflow, exact approved SHA and human Environment approval; never use production credentials.',state:'unverified',proof:null,action:'Review #907 protected runner and obtain a separate staging Environment approval only after preflight passes.' },
  { id:'ledger',phase:'01 · Database',label:'Migration ledger postflight',description:'Prove all expected migration rows, no duplicate/unfinished rows, pinned handoff checksum and separate payer-migration identity.',state:'unverified',proof:null,action:'Record the protected apply run and read-only postflight ledger proof; do not repeat Job handoff.' },
  { id:'tenant',phase:'02 · Security',label:'Tenant isolation and RLS',description:'Verify owner, technician, inactive, and foreign-tenant boundaries plus forced RLS and expected policies on expense/event tables.',state:'unverified',proof:null,action:'Run authenticated cross-tenant denial and staging RLS/policy probes, with links to immutable artifacts.' },
  { id:'deployments',phase:'03 · Runtime',label:'Matching staging API and web deployment SHAs',description:'Match staged API/web releases to approved application head; READY alone does not establish parity.',state:'unverified',proof:null,action:'Promote API first, then web at one approved source SHA; record readiness, aliases and runtime route health.' },
  { id:'bindings',phase:'03 · Runtime',label:'Protected runtime binding identity',description:'Attest effective API and web environment bindings to the same approved non-production data plane without exposing secrets.',state:'unverified',proof:null,action:'Collect the protected staging-binding attestation and verify environment/project identity.' },
  { id:'roles',phase:'04 · Browser',label:'Authenticated owner and technician workflows',description:'Prove accepted Proposal → Job, job expenses, role permission boundaries and persistence/reload.',state:'unverified',proof:null,action:'Run owner and technician end-to-end staging acceptance with distinct synthetic accounts.' },
  { id:'receipts',phase:'04 · Browser',label:'Private receipt upload, download and denial',description:'Prove upload/reload/download, file validation, private storage, foreign-tenant denial and cleanup behavior.',state:'unverified',proof:null,action:'Capture authenticated receipt success and forbidden-access proof with non-sensitive artifact links.' },
  { id:'viewports',phase:'04 · Browser',label:'Four-width evidence 1440 / 1024 / 768 / 390',description:'Require all four viewport checkpoints in the same approved full evidence run and a passing artifact validator.',state:'unverified',proof:null,action:'After staging parity, dispatch beta-evidence.yml mode=full against the approved nonproduction RC.' },
  { id:'rollback',phase:'05 · Reliability',label:'Rollback, recovery and concurrency',description:'Verify accepted→Job concurrent idempotency and rollback; expense idempotency and partial receipt failure recovery.',state:'unverified',proof:null,action:'Execute staging concurrency and rollback cases, capturing request IDs and resulting state without sensitive payloads.' },
  { id:'approval',phase:'06 · Release',label:'Final independent release approval',description:'Require head-specific required checks, resolved review threads, protected staging evidence and explicit reviewer disposition. No production action.',state:'unverified',proof:null,action:'Reconcile all exact-head checks and artifact links, then obtain separate release review.' },
];

function evaluateCheckRows(pr: PrStatus): {state: EvidenceState; detail: string} {
  if (!pr.head || !pr.requiredChecksKnown) return {state:'unverified',detail:'Required-check policy or exact head is not established'};
  const bindings = pr.requiredChecks;
  if (bindings && bindings.length > 0) {
    for (const binding of bindings) {
      const rows = pr.checks.filter(c => c.name === binding.name &&
        (binding.integrationIds.length === 0 || (c.appId != null && binding.integrationIds.includes(c.appId))));
      if (rows.length === 0) return {state:'blocked',detail:`Required check missing at head or from approved GitHub App: ${binding.name}`};
      // Unbound contexts include every source with the same name. Bound
      // contexts consider only approved app IDs. Any pending or failing
      // applicable result defeats a success, never the other way around.
      if (!rows.every(c => c.status === 'completed' && c.conclusion === 'success'))
        return {state:'blocked',detail:`Required check incomplete, failed or conflicting: ${binding.name}`};
    }
    return {state:'verified',detail:`${bindings.length} required check(s) successful at current head`};
  }
  if (pr.requiredCheckNames.length === 0) return {state:'unverified',detail:'Required-check policy or exact head is not established'};
  for (const name of pr.requiredCheckNames) {
    const rows = pr.checks.filter(c => c.name === name);
    if (rows.length === 0) return {state:'blocked',detail:`Required check missing at head: ${name}`};
    if (!rows.every(c => c.status === 'completed' && c.conclusion === 'success'))
      return {state:'blocked',detail:`Required check incomplete, failed or conflicting: ${name}`};
  }
  return {state:'verified',detail:`${pr.requiredCheckNames.length} required check(s) successful at current head`};
}

export function evaluateChecks(pr: PrStatus): {state: EvidenceState; detail: string} {
  const observed = evaluateCheckRows(pr);
  // A separate fetch failure (such as commit statuses or branch compare)
  // invalidates a green source assessment, but does not conceal a known red.
  if (pr.error && observed.state === 'verified')
    return {state:'unverified',detail:'GitHub evidence collection incomplete or unavailable: ' + pr.error};
  return observed;
}

export function markReviewFetchFailure(pr: PrStatus): PrStatus {
  return {...pr, review:'unverified', error:[pr.error,'Review submissions unavailable'].filter(Boolean).join('; ')};
}

function isClosedSupersededLane(pr: PrStatus): boolean {
  return (pr.number === 905 || pr.number === 906) && pr.state === 'closed' && pr.merged === false;
}

export function nextSafeAction(pr: PrStatus): string {
  if (pr.error) return 'Restore read-only GitHub visibility and refresh; keep every release gate blocked.';
  if (isClosedSupersededLane(pr)) return 'Superseded migration lane closed without merge; retain #907 and its protected staging workflow. No duplicate migration action is required.';
  if ((pr.number===905 || pr.number===906) && pr.merged===true) return 'An overlapping migration lane was merged: verify workflow conflicts and protected staging policy before any release.';
  if (pr.number===905 || pr.number===906) return 'Compare this overlapping migration path with merged #907; reconcile and close the superseded lane after review. Do not merge duplicate staging workflows.';
  if (pr.draft) return 'Keep draft; reconcile exact-head tests, review findings and staging dependency before requesting ready-for-review.';
  if (pr.behind !== null && pr.behind > 0) return 'Safely update/rebase against current main, then rerun exact-head required checks.';
  if (pr.behind === null) return 'Verify branch currency against main before any merge recommendation.';
  if (pr.unresolvedThreads===null) return 'Fetch complete GitHub review-thread resolution with server-side read credentials.';
  if (pr.unresolvedThreads>0) return `Resolve ${pr.unresolvedThreads} outstanding review thread(s) on the current source.`;
  if (pr.review!=='approved') return 'Obtain an independent current-head review disposition; commentary is not an approval.';
  const checks=evaluateChecks(pr);
  if (checks.state!=='verified') return `Reconcile current-head CI: ${checks.detail}.`;
  if (pr.mergeable!==true) return 'Resolve GitHub merge conflicts or unknown mergeability; do not force merge.';
  if (pr.number===810) return 'Attest matching nonproduction API/web bindings and capture authenticated step-9, concurrency and rollback evidence.';
  if (pr.number===891) return 'Run protected staging Expense baseline then separately approved payer migration; verify RLS, receipts and owner/technician acceptance.';
  return 'Complete protected staging proof before final release review.';
}

export function gatePromotion(prs: PrStatus[], gates: ReleaseGate[]): { allowed: boolean; reason: string } {
  if(prs.some(p=>!isClosedSupersededLane(p) && (p.error || p.state!=='open' || p.merged===true || p.draft!==false || p.mergeable!==true || p.behind!==0 || p.unresolvedThreads!==0 || p.review!=='approved' || evaluateChecks(p).state!=='verified'))) {
    return {allowed:false,reason:'PR exact-head source, review, mergeability or branch gates are incomplete.'};
  }
  if(gates.length!==releaseGates.length || gates.some(g=>g.state!=='verified' || !g.proof)) {
    return {allowed:false,reason:'Protected staging, runtime or authenticated release evidence remains unverified.'};
  }
  // This read-only console deliberately cannot authorize or execute release writes.
  return {allowed:false,reason:'Read-only control surface: human-approved protected release path is required.'};
}