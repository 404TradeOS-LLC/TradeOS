"use client";

import { useActionState } from "react";
import { createProjectTaskAction } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ProjectTaskForm({ projectId, jobs = [], members = [], canAssignIdentity = false }: { canAssignIdentity?: boolean; projectId: string; jobs?: Array<{ id: string; title: string }>; members?: Array<{ userId: string; fullName: string | null; email: string; status: string }> }) {
  const [state, formAction, isPending] = useActionState(createProjectTaskAction, undefined);

  return (
    <form action={formAction} className="grid gap-4 rounded-2xl border border-border/70 bg-card/90 p-5">
      <input type="hidden" name="projectId" value={projectId} />
      <div>
        <h3 className="text-base font-semibold text-foreground">Add a field task</h3>
        <p className="mt-1 text-sm text-muted-foreground">Keep the task system lightweight and job-focused.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2 md:col-span-2">
          <Label htmlFor="title">Task title</Label>
          <Input id="title" name="title" placeholder="Call dumpster vendor" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="task-job">Job</Label>
          <select id="task-job" name="jobId" className="min-h-11 rounded-md border border-input bg-background px-3"><option value="">Project task (no job)</option>{jobs.map(job => <option key={job.id} value={job.id}>{job.title}</option>)}</select>
        </div>
        {canAssignIdentity ? <div className="grid gap-2">
          <Label htmlFor="task-user">Responsible member</Label>
          <select id="task-user" name="assignedUserId" className="min-h-11 rounded-md border border-input bg-background px-3"><option value="">No personal assignment</option>{members.filter(member => member.status === "active").map(member => <option key={member.userId} value={member.userId}>{member.fullName || member.email}</option>)}</select>
          <p className="text-xs text-muted-foreground">Technicians must be assigned to the selected job to update this task.</p>
        </div> : null}
        <div className="grid gap-2">
          <Label htmlFor="assignedTo">Display label (optional)</Label>
          <Input id="assignedTo" name="assignedTo" placeholder="Field lead" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="dueDate">Due date</Label>
          <Input id="dueDate" name="dueDate" type="date" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="priority">Priority</Label>
          <select
            id="priority"
            name="priority"
            defaultValue="medium"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div className="grid gap-2 md:col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" name="notes" rows={3} placeholder="Access details, dependencies, or materials to bring." />
        </div>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Create task"}
        </Button>
      </div>
    </form>
  );
}
