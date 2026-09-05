import type { Contract, Invoice, JobSummary, Project, Proposal } from "../../lib/api";

export type ContinueWorkingStage = "proposal_not_sent" | "contract_needed" | "scheduling_needed" | "invoice_needed";

export interface ContinueWorkingProjectInput {
  id: string;
  name: string;
  status: Project["status"];
  customer: { name: string | null } | null;
  proposals: Array<Pick<Proposal, "id" | "status" | "createdAt">>;
  contracts: Array<Pick<Contract, "id" | "status" | "createdAt">>;
  invoices: Array<Pick<Invoice, "id">>;
  jobs: Array<Pick<JobSummary, "id" | "status" | "archivedAt">>;
}

export interface ContinueWorkingRow {
  projectId: string;
  projectName: string;
  customerName: string;
  stage: ContinueWorkingStage;
  label: string;
  helper: string;
  href: string;
  sinceIso: string | null;
}

// Furthest-along-toward-getting-paid wins when a project could match more
// than one stage, and is also the sort key across projects — invoicing
// completed work is closer to cash than scheduling a signed contract, which
// in turn is closer than drafting a contract for an accepted proposal.
const STAGE_PRIORITY: Record<ContinueWorkingStage, number> = {
  invoice_needed: 0,
  scheduling_needed: 1,
  contract_needed: 2,
  proposal_not_sent: 3,
};

const STAGE_COPY: Record<ContinueWorkingStage, { label: string; helper: string }> = {
  proposal_not_sent: { label: "Send the proposal", helper: "Started but not yet sent to the customer." },
  contract_needed: { label: "Draft the contract", helper: "The customer accepted a proposal — no contract exists yet." },
  scheduling_needed: { label: "Schedule the job", helper: "The contract is signed but no job has been scheduled yet." },
  invoice_needed: { label: "Send the invoice", helper: "Field work is complete but no invoice has been created yet." },
};

function toCustomerName(name: string | null | undefined): string {
  return name ?? "No customer linked";
}

function hrefForStage(projectId: string, stage: ContinueWorkingStage, proposalId: string | undefined): string {
  if (stage === "scheduling_needed") return "/dispatch";
  if (stage === "proposal_not_sent" && proposalId) return `/projects/${projectId}/proposals/${proposalId}`;
  return `/projects/${projectId}`;
}

/**
 * Determines the single most-advanced "continue working" stage for one
 * project, or `null` when nothing here is a genuine in-progress next step.
 *
 * Deliberately does not repeat what needs-attention-model.ts already
 * surfaces (draft/ready estimates, stale or unsigned proposals, and
 * overdue/unpaid invoices) — this only covers the stages between those:
 * proposal drafted but not sent, proposal accepted but no contract,
 * contract signed but not scheduled, and work completed but not invoiced.
 */
function toContinueWorkingRow(project: ContinueWorkingProjectInput): ContinueWorkingRow | null {
  if (project.status === "archived") return null;

  const latestProposal = project.proposals[0] ?? null;
  const latestContract = project.contracts[0] ?? null;
  const activeJobs = project.jobs.filter((job) => !job.archivedAt);
  const hasCompletedJob = activeJobs.some((job) => job.status === "completed");
  const hasScheduledJob = activeJobs.some((job) => job.status !== "unscheduled");
  const customerName = toCustomerName(project.customer?.name);

  function build(stage: ContinueWorkingStage, sinceIso: string | null): ContinueWorkingRow {
    const copy = STAGE_COPY[stage];
    return {
      projectId: project.id,
      projectName: project.name,
      customerName,
      stage,
      label: copy.label,
      helper: copy.helper,
      href: hrefForStage(project.id, stage, latestProposal?.id),
      sinceIso,
    };
  }

  if (hasCompletedJob && project.invoices.length === 0) {
    return build("invoice_needed", null);
  }
  if (latestContract?.status === "signed" && !hasScheduledJob) {
    return build("scheduling_needed", latestContract.createdAt);
  }
  if (latestProposal?.status === "accepted" && (!latestContract || latestContract.status === "voided")) {
    return build("contract_needed", latestProposal.createdAt);
  }
  if (latestProposal && (latestProposal.status === "draft" || latestProposal.status === "generated")) {
    return build("proposal_not_sent", latestProposal.createdAt);
  }

  return null;
}

/**
 * Builds the ranked "Continue working" list: at most one row per project,
 * furthest-along stage first, and oldest-since-that-stage first within a
 * stage so the longest-idle work surfaces first.
 */
export function buildContinueWorkingRows(projects: ContinueWorkingProjectInput[], limit = 6): ContinueWorkingRow[] {
  return projects
    .map(toContinueWorkingRow)
    .filter((row): row is ContinueWorkingRow => row !== null)
    .sort((a, b) => {
      const stageDelta = STAGE_PRIORITY[a.stage] - STAGE_PRIORITY[b.stage];
      if (stageDelta !== 0) return stageDelta;
      const aTime = a.sinceIso ? new Date(a.sinceIso).getTime() : Number.POSITIVE_INFINITY;
      const bTime = b.sinceIso ? new Date(b.sinceIso).getTime() : Number.POSITIVE_INFINITY;
      return aTime - bTime;
    })
    .slice(0, limit);
}
