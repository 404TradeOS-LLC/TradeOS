"use client";
import { useActionState } from "react";
import { assignProjectTaskAction } from "@/app/actions/projects";
import type { ProjectTask } from "@/lib/api";
export function ProjectTaskAssignmentForm({ task, jobs, members }: { task: ProjectTask; jobs: Array<{ id: string; title: string }>; members: Array<{ userId: string; fullName: string | null; email: string; status: string }> }) {
  const [state, action, pending] = useActionState(assignProjectTaskAction, {});
  return <details className="rounded-lg border border-border p-3"><summary className="min-h-11 cursor-pointer text-sm font-medium">Manage assignment</summary>
    <form action={action} aria-label={`Assign ${task.title}`} className="grid gap-3 pt-3">
      <input type="hidden" name="projectId" value={task.projectId} /><input type="hidden" name="taskId" value={task.id} /><input type="hidden" name="expectedUpdatedAt" value={task.updatedAt} />
      <label className="grid gap-1 text-sm">Job<select name="jobId" defaultValue={task.jobId ?? ""} disabled={pending || state.saved} className="min-h-11 rounded-md border border-input bg-background px-3"><option value="">No job</option>{jobs.map(job => <option key={job.id} value={job.id}>{job.title}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Responsible member<select name="assignedUserId" defaultValue={task.assignedUserId ?? ""} disabled={pending || state.saved} className="min-h-11 rounded-md border border-input bg-background px-3"><option value="">No personal assignment</option>{members.filter(member => member.status === "active").map(member => <option key={member.userId} value={member.userId}>{member.fullName || member.email}</option>)}</select></label>
      {task.assignedUserId && !members.some(member => member.userId === task.assignedUserId && member.status === "active") ? <p role="alert" className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs">The current assignee is no longer an active member. Saving with “No personal assignment” clears the assignment.</p> : null}
      <p className="text-xs text-muted-foreground">Technician status updates require an active assignment to this job. Display names do not grant access.</p>
      {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}{state.saved ? <p role="status" className="text-sm text-success">Assignment saved.</p> : null}
      <button type="submit" disabled={pending || state.saved} className="min-h-11 rounded-md bg-primary px-3 text-primary-foreground disabled:opacity-50">{pending ? "Saving…" : "Save assignment"}</button>
    </form>
  </details>;
}
