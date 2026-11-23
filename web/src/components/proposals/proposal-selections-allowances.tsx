"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  createProposalAllowanceAction,
  createProposalSelectionAction,
  deleteProposalAllowanceAction,
  deleteProposalSelectionAction,
  updateProposalAllowanceAction,
  updateProposalSelectionAction,
} from "@/app/actions/proposals";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { formatInvoiceCurrency, formatProposalDueDate } from "@/lib/document-workflow";
import type { Proposal, ProposalAllowance, ProposalSelection } from "@/lib/api";

function SelectionRow({
  projectId,
  proposalId,
  selection,
  editable,
}: {
  projectId: string;
  proposalId: string;
  selection: ProposalSelection;
  editable: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [updateState, updateAction, updatePending] = useActionState(updateProposalSelectionAction, undefined);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteProposalSelectionAction, undefined);
  const dueDate = formatProposalDueDate(selection.dueDate);

  if (editing && editable) {
    return (
      <li className="rounded-lg border border-border/60 p-3">
        <form
          action={updateAction}
          className="grid gap-3"
          // Returned validation/API errors are fulfilled actions, so React
          // resets uncontrolled fields. Keep edits on failure; a successful
          // save leaves the submitted values, which now match the saved row.
          onReset={(event) => event.preventDefault()}
        >
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="proposalId" value={proposalId} />
          <input type="hidden" name="selectionId" value={selection.id} />
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`selection-label-${selection.id}`}>Selection</Label>
              <Input id={`selection-label-${selection.id}`} name="label" defaultValue={selection.label} maxLength={120} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`selection-detail-${selection.id}`}>Chosen option</Label>
              <Input id={`selection-detail-${selection.id}`} name="detail" defaultValue={selection.detail ?? ""} maxLength={500} />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <SelectField label="Decision status" id={`selection-status-${selection.id}`} name="status" defaultValue={selection.status}>
              <option value="action_required">Action Required</option>
              <option value="confirmed">Confirmed</option>
            </SelectField>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`selection-due-${selection.id}`}>Decide by</Label>
              <Input
                id={`selection-due-${selection.id}`}
                name="dueDate"
                type="date"
                defaultValue={selection.dueDate ? selection.dueDate.slice(0, 10) : ""}
              />
            </div>
          </div>
          {updateState?.error && <p className="text-sm text-destructive">{updateState.error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={updatePending} size="sm">
              {updatePending ? "Saving…" : "Save selection"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-border/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">{selection.label}</div>
          <div className="mt-1 text-sm font-medium">
            {selection.detail ?? (dueDate ? `Choose by ${dueDate}` : "No option chosen yet")}
          </div>
          {selection.detail && dueDate && <div className="mt-1 text-xs text-muted-foreground">Decide by {dueDate}</div>}
        </div>
        <StatusBadge status={selection.status} />
      </div>
      {editable && (
        <div className="mt-3 flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
          {confirmingDelete ? (
            <form action={deleteAction} className="flex gap-2">
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="proposalId" value={proposalId} />
              <input type="hidden" name="selectionId" value={selection.id} />
              <Button type="submit" variant="destructive" size="sm" disabled={deletePending}>
                {deletePending ? "Deleting…" : "Confirm delete"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setConfirmingDelete(false)}>
                Keep
              </Button>
            </form>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirmingDelete(true)}>
              Delete
            </Button>
          )}
        </div>
      )}
      {deleteState?.error && <p className="mt-2 text-sm text-destructive">{deleteState.error}</p>}
    </li>
  );
}

function SelectionAddForm({ projectId, proposalId }: { projectId: string; proposalId: string }) {
  const [state, formAction, isPending] = useActionState(createProposalSelectionAction, undefined);
  // Returned validation/API errors are fulfilled actions, so React resets
  // uncontrolled fields. Keep edits on failure and clear the form only
  // after a successful save, by remounting it (same onReset guard as the
  // proposal creation form).
  const [formKey, setFormKey] = useState(0);
  const submittedRef = useRef(false);
  useEffect(() => {
    if (isPending) {
      submittedRef.current = true;
      return;
    }
    if (submittedRef.current && !state?.error) {
      submittedRef.current = false;
      setFormKey((key) => key + 1);
    } else {
      submittedRef.current = false;
    }
  }, [isPending, state]);
  return (
    <form
      key={formKey}
      action={formAction}
      className="grid gap-3 rounded-lg border border-dashed border-border/70 p-3"
      onReset={(event) => event.preventDefault()}
    >
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="proposalId" value={proposalId} />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-selection-label">Selection</Label>
          <Input id="new-selection-label" name="label" placeholder="e.g. PENDANTS" maxLength={120} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-selection-detail">Chosen option</Label>
          <Input id="new-selection-detail" name="detail" placeholder="Leave blank until decided" maxLength={500} />
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <SelectField label="Decision status" id="new-selection-status" name="status" defaultValue="action_required">
          <option value="action_required">Action Required</option>
          <option value="confirmed">Confirmed</option>
        </SelectField>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-selection-due">Decide by</Label>
          <Input id="new-selection-due" name="dueDate" type="date" />
        </div>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={isPending} size="sm" className="w-full md:w-auto">
        {isPending ? "Adding selection…" : "Add selection"}
      </Button>
    </form>
  );
}

function AllowanceRow({
  projectId,
  proposalId,
  allowance,
  editable,
}: {
  projectId: string;
  proposalId: string;
  allowance: ProposalAllowance;
  editable: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [updateState, updateAction, updatePending] = useActionState(updateProposalAllowanceAction, undefined);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteProposalAllowanceAction, undefined);

  if (editing && editable) {
    return (
      <li className="rounded-lg border border-border/60 p-3">
        <form
          action={updateAction}
          className="grid gap-3"
          // Returned validation/API errors are fulfilled actions, so React
          // resets uncontrolled fields. Keep edits on failure; a successful
          // save leaves the submitted values, which now match the saved row.
          onReset={(event) => event.preventDefault()}
        >
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="proposalId" value={proposalId} />
          <input type="hidden" name="allowanceId" value={allowance.id} />
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`allowance-description-${allowance.id}`}>Allowance</Label>
              <Input
                id={`allowance-description-${allowance.id}`}
                name="description"
                defaultValue={allowance.description}
                maxLength={200}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`allowance-amount-${allowance.id}`}>Amount</Label>
              <Input
                id={`allowance-amount-${allowance.id}`}
                name="amount"
                inputMode="decimal"
                defaultValue={allowance.amount}
                required
              />
            </div>
          </div>
          {updateState?.error && <p className="text-sm text-destructive">{updateState.error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={updatePending} size="sm">
              {updatePending ? "Saving…" : "Save allowance"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-border/60 p-3">
      <div className="flex items-start justify-between gap-3 text-sm">
        <div className="font-medium">{allowance.description}</div>
        <div className="font-medium">{formatInvoiceCurrency(allowance.amount)}</div>
      </div>
      {editable && (
        <div className="mt-3 flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
          {confirmingDelete ? (
            <form action={deleteAction} className="flex gap-2">
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="proposalId" value={proposalId} />
              <input type="hidden" name="allowanceId" value={allowance.id} />
              <Button type="submit" variant="destructive" size="sm" disabled={deletePending}>
                {deletePending ? "Deleting…" : "Confirm delete"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setConfirmingDelete(false)}>
                Keep
              </Button>
            </form>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirmingDelete(true)}>
              Delete
            </Button>
          )}
        </div>
      )}
      {deleteState?.error && <p className="mt-2 text-sm text-destructive">{deleteState.error}</p>}
    </li>
  );
}

function AllowanceAddForm({ projectId, proposalId }: { projectId: string; proposalId: string }) {
  const [state, formAction, isPending] = useActionState(createProposalAllowanceAction, undefined);
  // Returned validation/API errors are fulfilled actions, so React resets
  // uncontrolled fields. Keep edits on failure and clear the form only
  // after a successful save, by remounting it (same onReset guard as the
  // proposal creation form).
  const [formKey, setFormKey] = useState(0);
  const submittedRef = useRef(false);
  useEffect(() => {
    if (isPending) {
      submittedRef.current = true;
      return;
    }
    if (submittedRef.current && !state?.error) {
      submittedRef.current = false;
      setFormKey((key) => key + 1);
    } else {
      submittedRef.current = false;
    }
  }, [isPending, state]);
  return (
    <form
      key={formKey}
      action={formAction}
      className="grid gap-3 rounded-lg border border-dashed border-border/70 p-3"
      onReset={(event) => event.preventDefault()}
    >
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="proposalId" value={proposalId} />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-allowance-description">Allowance</Label>
          <Input id="new-allowance-description" name="description" placeholder="e.g. PENDANT LIGHTING" maxLength={200} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-allowance-amount">Amount</Label>
          <Input id="new-allowance-amount" name="amount" inputMode="decimal" placeholder="0.00" required />
        </div>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={isPending} size="sm" className="w-full md:w-auto">
        {isPending ? "Adding allowance…" : "Add allowance"}
      </Button>
    </form>
  );
}

export function ProposalSelectionsAllowances({ projectId, proposal }: { projectId: string; proposal: Proposal }) {
  const selections = proposal.selections ?? [];
  const allowances = proposal.allowances ?? [];
  const allowancesTotal = proposal.allowancesTotal ?? allowances.reduce((sum, allowance) => sum + allowance.amount, 0);
  // The backend rejects writes on accepted proposals (and proposals with a
  // contract); hide the editors there instead of offering a failing save.
  const editable = proposal.status !== "accepted";

  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>Selections &amp; allowances</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        <section aria-label="Selections">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">03 · Selections</div>
          {selections.length === 0 ? (
            <div className="mt-2">
              <EmptyState
                title="No selections recorded."
                description="Add the customer decisions this proposal depends on — cabinet finish, countertop, fixtures — and mark each Confirmed or Action Required with a decide-by date."
              />
            </div>
          ) : (
            <ul className="mt-3 space-y-3">
              {selections.map((selection) => (
                <SelectionRow
                  key={selection.id}
                  projectId={projectId}
                  proposalId={proposal.id}
                  selection={selection}
                  editable={editable}
                />
              ))}
            </ul>
          )}
          {editable && (
            <div className="mt-3">
              <SelectionAddForm projectId={projectId} proposalId={proposal.id} />
            </div>
          )}
        </section>

        <section aria-label="Allowances">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">04 · Allowances</div>
          {allowances.length === 0 ? (
            <div className="mt-2">
              <EmptyState
                title="No allowances recorded."
                description="Add allowance lines for items priced later — pendant lighting, cabinet hardware — with the amount set aside for each."
              />
            </div>
          ) : (
            <>
              <ul className="mt-3 space-y-3">
                {allowances.map((allowance) => (
                  <AllowanceRow
                    key={allowance.id}
                    projectId={projectId}
                    proposalId={proposal.id}
                    allowance={allowance}
                    editable={editable}
                  />
                ))}
              </ul>
              <div className="mt-3 flex items-start justify-between border-t-2 border-foreground/80 pt-3 font-bold">
                <span className="text-xs uppercase tracking-[0.15em]">Total allowance</span>
                <span>{formatInvoiceCurrency(allowancesTotal)}</span>
              </div>
            </>
          )}
          {editable && (
            <div className="mt-3">
              <AllowanceAddForm projectId={projectId} proposalId={proposal.id} />
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Allowances are shown for reference. They are not added to the proposal total — the final price above is unchanged by
            them.
          </p>
        </section>

        {!editable && (
          <p className="text-xs text-muted-foreground">
            This proposal is accepted, so selections and allowances are read-only here. Duplicate it to revise them.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
