import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

interface ProjectQuickActionsProps {
  projectId: string;
}

export function ProjectQuickActions({ projectId }: ProjectQuickActionsProps) {
  return (
    <div className="grid gap-3">
      <Link href={`/projects/${projectId}/intake`} className={buttonVariants()}>
        Add site visit notes
      </Link>
      <Link href={`/projects/${projectId}/proposals/new`} className={buttonVariants({ variant: "secondary" })}>
        Draft proposal
      </Link>
    </div>
  );
}
