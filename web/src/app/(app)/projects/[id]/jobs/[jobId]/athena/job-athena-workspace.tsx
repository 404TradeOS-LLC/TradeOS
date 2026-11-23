"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { AthenaWorkspace } from "@/components/athena/athena-workspace";
import type { SaveJobNoteResult } from "@/components/athena/athena-confirmation-card";
import { clientFetch, ClientApiError } from "@/lib/clientApi";

// Job-specific starters from the canonical Figma workspace (frame 289:2).
const JOB_STARTERS = [
  "Turn a scope into an estimate",
  "Summarize this job",
  "Find what needs attention",
  "Draft a follow-up",
] as const;

interface JobAthenaWorkspaceProps {
  jobId: string;
  projectId: string;
  customerId?: string;
  estimateId?: string;
  jobNumber: string;
  jobTitle: string;
  scopeDetails: Record<string, string>;
  canReviewApprovals: boolean;
}

/**
 * Client wrapper for the job-scoped Athena route. Owns the one write this
 * route performs: saving a confirmed note through the existing Job note
 * service (POST /api/v1/jobs/:jobId/notes via the authenticated proxy — the
 * same endpoint the field note form uses). The workspace renders the Confirm
 * Write card; this callback runs only after the contractor confirms.
 */
export function JobAthenaWorkspace({
  jobId,
  projectId,
  customerId,
  estimateId,
  jobNumber,
  jobTitle,
  scopeDetails,
  canReviewApprovals,
}: JobAthenaWorkspaceProps) {
  const router = useRouter();

  const saveJobNote = useCallback(
    async (body: string): Promise<SaveJobNoteResult> => {
      try {
        await clientFetch(`/api/v1/jobs/${jobId}/notes`, {
          method: "POST",
          body: JSON.stringify({ body }),
        });
        router.refresh();
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof ClientApiError ? error.message : "Unable to save this note.",
        };
      }
    },
    [jobId, router]
  );

  return (
    <AthenaWorkspace
      selectedScope={{ jobId, projectId, customerId, estimateId }}
      jobWriteTarget={{ jobId, jobNumber, jobTitle }}
      onSaveJobNote={saveJobNote}
      scopeDetails={scopeDetails}
      starters={JOB_STARTERS}
      canReviewApprovals={canReviewApprovals}
    />
  );
}
