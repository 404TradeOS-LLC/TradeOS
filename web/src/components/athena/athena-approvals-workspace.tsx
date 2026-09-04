import { CheckCircle2, Clock3, ShieldAlert, XCircle } from "lucide-react";
import { reviewAthenaApprovalAction, submitAthenaApprovalAction } from "@/app/actions/athena-approvals";
import { EmptyState } from "@/components/ui/empty-state";
import type { AthenaApprovalDetail, AthenaApprovalRecord } from "@/lib/api";

function statusTone(status: AthenaApprovalRecord["status"]): string {
  switch (status) {
    case "granted":
      return "text-success";
    case "denied":
      return "text-destructive";
    case "expired":
    case "revoked":
      return "text-warning";
    default:
      return "text-info";
  }
}

function ApprovalStats({ approvals }: { approvals: AthenaApprovalRecord[] }) {
  const pendingCount = approvals.filter((approval) => approval.status === "pending").length;
  const grantedCount = approvals.filter((approval) => approval.status === "granted").length;
  const deniedCount = approvals.filter((approval) => approval.status === "denied").length;
  const stats = [
    { label: "Pending", value: pendingCount, icon: Clock3, tone: "text-info" },
    { label: "Granted", value: grantedCount, icon: CheckCircle2, tone: "text-success" },
    { label: "Denied", value: deniedCount, icon: XCircle, tone: "text-destructive" },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-3">
      {stats.map(({ label, value, icon: Icon, tone }) => (
        <div key={label} className="rounded-lg border border-border/70 bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
              <p className="mt-2 font-mono text-3xl font-semibold text-foreground">{value}</p>
            </div>
            <Icon className={`size-5 ${tone}`} aria-hidden="true" />
          </div>
        </div>
      ))}
    </section>
  );
}

function ApprovalSubmissionForm() {
  const fieldClass = "rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";
  return (
    <div className="rounded-lg border border-border/70 bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">Submit Approval Request</h2>
      <form action={submitAthenaApprovalAction} className="mt-4 grid gap-3">
        <label htmlFor="athena-approval-action-id" className="text-xs font-medium text-muted-foreground">Action ID</label>
        <input id="athena-approval-action-id" name="actionId" placeholder="Action ID" className={fieldClass} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label htmlFor="athena-approval-tool-id" className="text-xs font-medium text-muted-foreground">Tool ID</label>
            <input id="athena-approval-tool-id" name="toolId" placeholder="Tool ID" className={fieldClass} />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="athena-approval-tool-version" className="text-xs font-medium text-muted-foreground">Tool version</label>
            <input id="athena-approval-tool-version" name="toolVersion" placeholder="Tool version" defaultValue="1.0.0" className={fieldClass} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label htmlFor="athena-approval-risk" className="text-xs font-medium text-muted-foreground">Risk level</label>
            <select id="athena-approval-risk" name="riskLevel" defaultValue="medium" className={fieldClass}>
              <option value="medium">Medium risk</option>
              <option value="high">High risk</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="athena-approval-expiration" className="text-xs font-medium text-muted-foreground">Expiration</label>
            <input id="athena-approval-expiration" name="expiration" type="datetime-local" className={fieldClass} />
          </div>
        </div>
        <label htmlFor="athena-approval-idempotency" className="text-xs font-medium text-muted-foreground">Idempotency key</label>
        <input id="athena-approval-idempotency" name="idempotencyKey" placeholder="Idempotency key" className={fieldClass} />
        <label htmlFor="athena-approval-input-hash" className="text-xs font-medium text-muted-foreground">Canonical input hash</label>
        <input id="athena-approval-input-hash" name="inputHash" placeholder="Canonical input hash" className={fieldClass} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label htmlFor="athena-approval-plan-id" className="text-xs font-medium text-muted-foreground">Plan ID</label>
            <input id="athena-approval-plan-id" name="planId" placeholder="Plan ID" className={fieldClass} />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="athena-approval-step-id" className="text-xs font-medium text-muted-foreground">Step ID</label>
            <input id="athena-approval-step-id" name="stepId" placeholder="Step ID" className={fieldClass} />
          </div>
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background outline-none transition-colors hover:bg-foreground/85 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Submit request
        </button>
      </form>
    </div>
  );
}

function ApprovalQueue({ approvals }: { approvals: AthenaApprovalRecord[] }) {
  return (
    <div className="rounded-lg border border-border/70 bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">Approval Queue</h2>
      {approvals.length === 0 ? (
        <div className="mt-4"><EmptyState title="No approval requests" description="No medium- or high-risk Athena actions have been submitted for review." /></div>
      ) : (
        <div className="mt-4 space-y-3">
          {approvals.map((approval) => (
            <a key={approval.approvalId} href={`/athena/approvals?approvalId=${approval.approvalId}`} className="block rounded-lg border border-border/70 bg-background px-4 py-3 transition-colors hover:border-foreground/30">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{approval.toolId}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{approval.actionId}</p>
                </div>
                <span className={`text-xs font-medium uppercase tracking-[0.14em] ${statusTone(approval.status)}`}>{approval.status}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function ApprovalReviewDetail({ selectedApproval }: { selectedApproval: AthenaApprovalDetail | null }) {
  return (
    <div className="rounded-lg border border-border/70 bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Review Detail</h2>
          <p className="mt-1 text-sm text-muted-foreground">Bound to exact actor, action, plan step, and canonical input hash.</p>
        </div>
        <ShieldAlert className="size-5 text-warning" aria-hidden="true" />
      </div>
      {!selectedApproval ? (
        <div className="mt-6"><EmptyState title="Select an approval" description="Choose an approval request from the queue to review its binding and audit trail." /></div>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border/70 bg-background p-4"><p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Risk</p><p className="mt-2 text-lg font-semibold capitalize text-foreground">{selectedApproval.approval.riskLevel}</p></div>
            <div className="rounded-lg border border-border/70 bg-background p-4"><p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Status</p><p className={`mt-2 text-lg font-semibold capitalize ${statusTone(selectedApproval.approval.status)}`}>{selectedApproval.approval.status}</p></div>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border/70 bg-background p-4"><dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Tool</dt><dd className="mt-2 break-all text-sm text-foreground">{selectedApproval.approval.toolId}@{selectedApproval.approval.toolVersion}</dd></div>
            <div className="rounded-lg border border-border/70 bg-background p-4"><dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Approval ID</dt><dd className="mt-2 break-all text-sm text-foreground">{selectedApproval.approval.approvalId}</dd></div>
            <div className="rounded-lg border border-border/70 bg-background p-4"><dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Action</dt><dd className="mt-2 break-all text-sm text-foreground">{selectedApproval.approval.actionId}</dd></div>
            <div className="rounded-lg border border-border/70 bg-background p-4"><dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Plan Step</dt><dd className="mt-2 break-all text-sm text-foreground">{selectedApproval.approval.planId} / {selectedApproval.approval.stepId}</dd></div>
            <div className="rounded-lg border border-border/70 bg-background p-4"><dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Requester</dt><dd className="mt-2 break-all text-sm text-foreground">{selectedApproval.approval.userId}</dd></div>
            <div className="rounded-lg border border-border/70 bg-background p-4"><dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Input Hash</dt><dd className="mt-2 break-all text-sm text-foreground">{selectedApproval.approval.inputHash}</dd></div>
          </dl>
          {selectedApproval.approval.status === "pending" ? (
            <div className="flex flex-wrap gap-3">
              <form action={reviewAthenaApprovalAction}><input type="hidden" name="approvalId" value={selectedApproval.approval.approvalId} /><input type="hidden" name="decision" value="grant" /><button type="submit" className="rounded-md bg-success px-4 py-2 text-sm font-medium text-success-foreground outline-none transition-colors hover:bg-success/85 focus-visible:ring-3 focus-visible:ring-ring/50">Grant</button></form>
              <form action={reviewAthenaApprovalAction}><input type="hidden" name="approvalId" value={selectedApproval.approval.approvalId} /><input type="hidden" name="decision" value="deny" /><button type="submit" className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground outline-none transition-colors hover:bg-destructive/85 focus-visible:ring-3 focus-visible:ring-ring/50">Deny</button></form>
            </div>
          ) : null}
          <div>
            <h3 className="text-sm font-semibold text-foreground">Audit Trail</h3>
            <div className="mt-3 space-y-3">
              {selectedApproval.auditEvents.length === 0 ? <EmptyState title="No audit events yet" description="This approval has not accumulated any Athena audit events yet." /> : selectedApproval.auditEvents.map((event) => (
                <div key={event.id} className="rounded-lg border border-border/70 bg-background p-4">
                  <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium capitalize text-foreground">{event.eventType.replaceAll("_", " ")}</p><p className="text-xs text-muted-foreground">{new Date(event.timestamp).toLocaleString()}</p></div>
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs text-muted-foreground">{JSON.stringify(event.metadata, null, 2)}</pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AthenaApprovalsWorkspace({ approvals, selectedApproval }: { approvals: AthenaApprovalRecord[]; selectedApproval: AthenaApprovalDetail | null }) {
  return (
    <>
      <ApprovalStats approvals={approvals} />
      <section className="grid gap-6 xl:grid-cols-[1.2fr,1.8fr]">
        <div className="flex flex-col gap-6"><ApprovalSubmissionForm /><ApprovalQueue approvals={approvals} /></div>
        <ApprovalReviewDetail selectedApproval={selectedApproval} />
      </section>
    </>
  );
}
