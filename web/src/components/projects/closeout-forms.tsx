"use client";

import { useActionState, useState } from "react";
import {
  createCloseoutAction,
  createPunchItemAction,
  createWarrantyAction,
  deleteWarrantyAction,
  markCloseoutReadyAction,
  recordCloseoutHandoffAction,
  reopenPunchItemAction,
  resolvePunchItemAction,
  verifyPunchItemAction,
} from "@/app/actions/closeout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClassName =
  "h-10 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function CloseoutStartForm({ projectId, hasCompletedJob }: { projectId: string; hasCompletedJob: boolean }) {
  const [state, formAction, isPending] = useActionState(createCloseoutAction, undefined);

  return (
    <form action={formAction} className="grid gap-4 rounded-2xl border border-border/70 bg-card/90 p-5">
      <input type="hidden" name="projectId" value={projectId} />
      <div>
        <h3 className="text-base font-semibold text-foreground">Start closeout</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasCompletedJob
            ? "Open the closeout record for this project: the artifact checklist, punch list, and warranty records live here."
            : "Closeout starts once a job on this project is completed. If the backend disagrees, its reason will be shown here."}
        </p>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Starting…" : "Start closeout"}
        </Button>
      </div>
    </form>
  );
}

export function PunchItemCreateForm({
  projectId,
  jobOptions,
  memberOptions,
}: {
  projectId: string;
  jobOptions: Array<{ id: string; label: string }>;
  memberOptions: Array<{ userId: string; label: string }>;
}) {
  const [state, formAction, isPending] = useActionState(createPunchItemAction, undefined);

  return (
    <form action={formAction} className="grid gap-4 rounded-2xl border border-border/70 bg-card/90 p-5">
      <input type="hidden" name="projectId" value={projectId} />
      <div>
        <h3 className="text-base font-semibold text-foreground">Add punch item</h3>
        <p className="mt-1 text-sm text-muted-foreground">Anything still to fix, finish, or verify before handoff.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="punch-title">Title</Label>
          <Input id="punch-title" name="title" placeholder="Touch up paint at entry trim" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="punch-priority">Priority</Label>
          <select id="punch-priority" name="priority" defaultValue="medium" className={selectClassName}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div className="grid gap-2 md:col-span-2">
          <Label htmlFor="punch-description">Description</Label>
          <Input id="punch-description" name="description" placeholder="What needs to be done, and where" />
        </div>
        {jobOptions.length > 0 ? (
          <div className="grid gap-2">
            <Label htmlFor="punch-job">Linked job</Label>
            <select id="punch-job" name="jobId" className={selectClassName}>
              <option value="">Project-wide (no linked job)</option>
              {jobOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {memberOptions.length > 0 ? (
          <div className="grid gap-2">
            <Label htmlFor="punch-assignee">Assignee</Label>
            <select id="punch-assignee" name="assignedUserId" className={selectClassName}>
              <option value="">Unassigned</option>
              {memberOptions.map((option) => (
                <option key={option.userId} value={option.userId}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="grid gap-2">
          <Label htmlFor="punch-due-date">Due date</Label>
          <Input id="punch-due-date" name="dueDate" type="date" />
        </div>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Adding…" : "Add punch item"}
        </Button>
      </div>
    </form>
  );
}

export function WarrantyCreateForm({
  projectId,
  sourceOptions,
}: {
  projectId: string;
  sourceOptions: Array<{ id: string; label: string; type: "contract" | "invoice" }>;
}) {
  const [state, formAction, isPending] = useActionState(createWarrantyAction, undefined);
  const [sourceType, setSourceType] = useState<"contract" | "invoice" | "other">("contract");
  // The picker only ever offers records of the chosen source type, so the
  // linked record the action maps to contractId/invoiceId is always the
  // kind the contractor declared. "Other record" has no picker: there is
  // no contract or invoice to link.
  const visibleSourceOptions = sourceOptions.filter((option) => option.type === sourceType);

  return (
    <form action={formAction} className="grid gap-4 rounded-2xl border border-border/70 bg-card/90 p-5">
      <input type="hidden" name="projectId" value={projectId} />
      <div>
        <h3 className="text-base font-semibold text-foreground">Record warranty</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Record only a warranty the contractor actually gave. No terms or dates are filled in for you.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="warranty-title">Title</Label>
          <Input id="warranty-title" name="title" placeholder="Workmanship warranty" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="warranty-source-type">Warranty comes from</Label>
          <select
            id="warranty-source-type"
            name="sourceType"
            value={sourceType}
            onChange={(event) => setSourceType(event.target.value as "contract" | "invoice" | "other")}
            className={selectClassName}
          >
            <option value="contract">Contract</option>
            <option value="invoice">Invoice</option>
            <option value="other">Other record</option>
          </select>
        </div>
        <div className="grid gap-2 md:col-span-2">
          <Label htmlFor="warranty-coverage">Coverage as stated in the contract — quote it, do not paraphrase or invent</Label>
          <textarea
            id="warranty-coverage"
            name="coverageText"
            rows={3}
            placeholder="Paste the warranty wording exactly as written in the contract or invoice."
            className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
        {visibleSourceOptions.length > 0 ? (
          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="warranty-source">Linked source record</Label>
            <select id="warranty-source" name="sourceId" className={selectClassName}>
              <option value="">No linked source record</option>
              {visibleSourceOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="grid gap-2">
          <Label htmlFor="warranty-starts">Starts (optional)</Label>
          <Input id="warranty-starts" name="startsAt" type="date" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="warranty-ends">Ends (optional)</Label>
          <Input id="warranty-ends" name="endsAt" type="date" />
        </div>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Record warranty"}
        </Button>
      </div>
    </form>
  );
}

// ---- Mutation forms (finding 13 + 14) ----
// The create forms above already use useActionState; these one-button
// mutations follow the same pattern so a failed request returns the
// backend's reason to the form (instead of escaping) and the button is
// disabled with progress text until the action finishes. The success
// redirect still happens outside the action's catch, in the action.

export function MarkCloseoutReadyForm({ projectId, disabled }: { projectId: string; disabled: boolean }) {
  const [state, formAction, isPending] = useActionState(markCloseoutReadyAction, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="projectId" value={projectId} />
      {state?.error && <p className="mb-2 text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={disabled || isPending}>
        {isPending ? "Marking ready…" : "Mark ready"}
      </Button>
    </form>
  );
}

export function RecordCloseoutHandoffForm({ projectId }: { projectId: string }) {
  const [state, formAction, isPending] = useActionState(recordCloseoutHandoffAction, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="projectId" value={projectId} />
      {state?.error && <p className="mb-2 text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Recording handoff…" : "Record handoff"}
      </Button>
    </form>
  );
}

const PUNCH_TRANSITIONS = {
  resolve: { action: resolvePunchItemAction, label: "Resolve", pendingLabel: "Resolving…", variant: "outline" as const },
  verify: { action: verifyPunchItemAction, label: "Verify", pendingLabel: "Verifying…", variant: "outline" as const },
  reopen: { action: reopenPunchItemAction, label: "Reopen", pendingLabel: "Reopening…", variant: "ghost" as const },
} as const;

export function PunchItemTransitionForm({
  projectId,
  punchItemId,
  transition,
}: {
  projectId: string;
  punchItemId: string;
  transition: keyof typeof PUNCH_TRANSITIONS;
}) {
  const { action, label, pendingLabel, variant } = PUNCH_TRANSITIONS[transition];
  const [state, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="punchItemId" value={punchItemId} />
      {state?.error && <p className="mb-2 text-sm text-destructive">{state.error}</p>}
      <Button type="submit" variant={variant} size="sm" disabled={isPending}>
        {isPending ? pendingLabel : label}
      </Button>
    </form>
  );
}

export function DeleteWarrantyForm({ projectId, warrantyId }: { projectId: string; warrantyId: string }) {
  const [state, formAction, isPending] = useActionState(deleteWarrantyAction, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="warrantyId" value={warrantyId} />
      {state?.error && <p className="mb-2 text-sm text-destructive">{state.error}</p>}
      <Button type="submit" variant="ghost" size="sm" disabled={isPending}>
        {isPending ? "Removing…" : "Remove"}
      </Button>
    </form>
  );
}
