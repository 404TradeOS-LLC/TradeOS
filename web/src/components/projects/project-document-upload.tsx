"use client";

import { useActionState, useState } from "react";
import { uploadProjectDocumentAction } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DOCUMENT_TYPES = [
  { value: "plans", label: "Plans" },
  { value: "permits", label: "Permits" },
  { value: "specifications", label: "Specifications" },
  { value: "customer_upload", label: "Customer upload" },
  { value: "document", label: "General document" },
] as const;

export function ProjectDocumentUpload({ projectId }: { projectId: string }) {
  const [state, formAction, isPending] = useActionState(uploadProjectDocumentAction, undefined);
  const [isDragging, setIsDragging] = useState(false);

  return (
    <form action={formAction} className="grid gap-4 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-5">
      <input type="hidden" name="projectId" value={projectId} />
      <div>
        <h3 className="text-base font-semibold text-foreground">Upload project documents</h3>
        <p className="mt-1 text-sm text-muted-foreground">Drop plans, permits, specs, and customer files into the project record.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        <div className="grid gap-2">
          <Label htmlFor="fileType">Document type</Label>
          <select
            id="fileType"
            name="fileType"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {DOCUMENT_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <label
          htmlFor="file"
          className={`grid min-h-36 cursor-pointer place-items-center rounded-2xl border px-4 py-6 text-center transition-colors ${
            isDragging ? "border-foreground bg-background" : "border-border/70 bg-background/80"
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={() => setIsDragging(false)}
        >
          <div className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Drag a file here or tap to browse</span>
            <span className="text-sm text-muted-foreground">Supports photos, PDFs, and common office files up to 12MB.</span>
          </div>
          <Input id="file" name="file" type="file" className="sr-only" />
        </label>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Uploading…" : "Upload document"}
        </Button>
      </div>
    </form>
  );
}
