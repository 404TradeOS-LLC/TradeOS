"use client";

import { useActionState } from "react";
import { updateProjectAction } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Project } from "@/lib/api";

export function EditProjectForm({ project }: { project: Project }) {
  const [state, formAction, isPending] = useActionState(updateProjectAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="projectId" value={project.id} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Project name</Label>
        <Input id="name" name="name" defaultValue={project.name} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="jobType">Job type</Label>
        <Input id="jobType" name="jobType" defaultValue={project.jobType ?? ""} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="siteAddress">Site address</Label>
        <Input id="siteAddress" name="siteAddress" defaultValue={project.siteAddress ?? ""} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="simpleScope">Simple scope</Label>
        <Textarea id="simpleScope" name="simpleScope" rows={5} defaultValue={project.simpleScope ?? ""} />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
