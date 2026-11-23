"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { formatStatusLabel } from "@/components/shared/status-badge";
import { JobAthenaWorkspace } from "./job-athena-workspace";

interface JobAthenaSheetProps {
  jobId: string;
  projectId: string;
  customerId?: string;
  estimateId?: string;
  jobNumber: string;
  jobTitle: string;
  jobStatus: string;
  scopeDetails: Record<string, string>;
  canReviewApprovals: boolean;
}

/**
 * DES-4 mobile context sheet (canonical Figma frame 289:165): the job-scoped
 * Athena workspace presented as a bottom sheet at phone widths.
 *
 * The sheet chrome follows the frame — drag handle, "Athena" heading with the
 * Job scoped badge, the job identity line, and the workspace in its compact
 * form with the composer pinned to the sheet's bottom. The sheet floats
 * between the app header and the Control Dock (8px side margins, ending
 * above the dock), over the app canvas; the product bar and dock stay visible
 * around it, as drawn.
 *
 * Content is the same job workspace as the desktop route: same DES-4 role
 * gating (decided server-side before this renders), same kernel, same
 * Confirm Write flow — the card renders inside the sheet unchanged. Closing
 * the sheet returns to the job page, the route's parent.
 *
 * Frame behaviors not specified and therefore not invented here: true
 * drag-to-dismiss / snap points (the frame shows a handle but no drag
 * physics). Dismissal is backdrop, Escape, or Close — the production sheet
 * contract. The "Job scoped" badge uses the production outline Badge, the
 * same treatment as the workspace's scope label; the frame's solid blue fill
 * has no production Badge variant.
 */
export function JobAthenaSheet({
  jobId,
  projectId,
  customerId,
  estimateId,
  jobNumber,
  jobTitle,
  jobStatus,
  scopeDetails,
  canReviewApprovals,
}: JobAthenaSheetProps) {
  const router = useRouter();

  const handleClose = useCallback(() => {
    router.push(`/projects/${projectId}/jobs/${jobId}`);
  }, [projectId, jobId, router]);

  return (
    <BottomSheet
      label={`Athena · ${jobTitle}`}
      closeLabel="Close Athena"
      onClose={handleClose}
      panelClassName="inset-x-2 top-28 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] max-h-none rounded-2xl border pb-4"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-xl font-semibold text-foreground">Athena</h2>
            <Badge variant="outline">Job scoped</Badge>
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {jobTitle} · {jobNumber} · {formatStatusLabel(jobStatus)}
          </p>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="min-h-11 shrink-0 rounded-lg px-3 text-sm text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Close
        </button>
      </div>

      <JobAthenaWorkspace
        jobId={jobId}
        projectId={projectId}
        customerId={customerId}
        estimateId={estimateId}
        jobNumber={jobNumber}
        jobTitle={jobTitle}
        scopeDetails={scopeDetails}
        canReviewApprovals={canReviewApprovals}
        compact
        stickyComposer
      />
    </BottomSheet>
  );
}
