import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { getSessionToken } from "@/lib/session";
import {
  feeReviewStatusLabel,
  formatFeeCents,
  normalizePermitsSearchParams,
  permitStatusLabel,
  type FeeReview,
  type PermitTask,
} from "@/lib/costbook-permits";
import { getFeeReviews, getPermitTasks } from "@/lib/costbook-permits-api";
import { PermitTaskSubmitButton } from "./permit-task-submit-button";

export const metadata: Metadata = {
  title: "Permit Tasks & Fee Reviews | Codes & Permits | TradeOS",
  description: "Owner-assigned permit and inspection tasks and price-neutral fee reviews for one project.",
};

function TaskCard({ task }: { task: PermitTask }) {
  return (
    <article className="grid gap-3 rounded-xl border border-border/70 bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">{task.title}</h3>
          <p className="text-sm text-muted-foreground">
            {task.taskKind === "permit" ? "Permit task" : "Inspection task"}
            {task.permitNumber ? ` · Permit ${task.permitNumber}` : " · No permit number recorded"}
          </p>
        </div>
        <span className="rounded-full border border-border/70 px-3 py-1 text-xs font-medium">
          {permitStatusLabel(task.permitStatus)}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Due</dt>
          <dd>{task.dueDate ?? "No due date"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Evidence refs</dt>
          <dd>{task.evidence.length}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">History entries</dt>
          <dd>{task.history.length}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Assessment</dt>
          <dd>{task.assessmentId ? "Linked" : "Not linked"}</dd>
        </div>
      </dl>
      {task.evidence.length > 0 ? (
        <ul className="grid gap-1 text-sm">
          {task.evidence.map((item, index) => (
            <li key={`${item.reference}-${index}`} className="text-muted-foreground">
              {item.label} — {item.reference}
            </li>
          ))}
        </ul>
      ) : null}
      {task.permitStatus === "not_submitted" ? (
        <PermitTaskSubmitButton taskId={task.id} expectedUpdatedAt={task.updatedAt} />
      ) : null}
    </article>
  );
}

function FeeReviewCard({ review }: { review: FeeReview }) {
  return (
    <article className="grid gap-3 rounded-xl border border-border/70 bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">{formatFeeCents(review.feeCents, review.currency)}</h3>
          <p className="text-sm text-muted-foreground">
            {review.feeSource ? `${review.feeSource === "verified" ? "Verified" : "Quoted"} fee` : "Fee source not stated"}
            {review.estimateId ? " · Linked to an estimate" : " · No estimate linked"}
          </p>
        </div>
        <span className="rounded-full border border-border/70 px-3 py-1 text-xs font-medium">
          {feeReviewStatusLabel(review.status)}
        </span>
      </div>
      {review.note ? <p className="text-sm">{review.note}</p> : null}
      <p className="text-sm text-muted-foreground">
        {review.mayAffectEstimate
          ? "Approved with a CostItem explicitly selected. The cost effect goes through the normal explicit CostItem step — this review itself changed no estimate."
          : "No estimate effect. Pending, rejected, and unselected fees never change an estimate."}
      </p>
      {review.reviewedAt ? (
        <p className="text-sm text-muted-foreground">Reviewed {new Date(review.reviewedAt).toLocaleDateString()}</p>
      ) : null}
    </article>
  );
}

export default async function PermitTasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const token = await getSessionToken();
  const { projectId } = normalizePermitsSearchParams(await searchParams);
  let tasks: PermitTask[] = [];
  let feeReviews: FeeReview[] = [];
  let error: string | null = null;

  if (token && projectId) {
    try {
      [tasks, feeReviews] = await Promise.all([getPermitTasks(token, projectId), getFeeReviews(token, projectId)]);
    } catch {
      error = "TradeOS couldn't retrieve permit tasks for this project.";
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Permit Tasks & Fee Reviews"
        description="Owner-assigned permit and inspection work for one project, with explicit statuses and price-neutral fee reviews."
        backHref="/costbook"
        backLabel="Costbook"
      />

      <p className="rounded-xl border border-border/70 bg-card p-4 text-sm">
        No source link or AI message counts as a permit. Permit statuses are set only by a person — TradeOS never
        infers a status, and submitting a permit always requires an explicit confirmation step.
      </p>

      {!token ? (
        <EmptyState title="Sign in required" description="An authenticated Costbook session is required to view permit tasks." />
      ) : !projectId ? (
        <EmptyState
          title="Choose a project first"
          description="Permit tasks and fee reviews live on a project. Open a project and follow its permit tasks link with a project selected."
        />
      ) : error ? (
        <EmptyState title="Couldn't load permit tasks" description={error} />
      ) : (
        <>
          <section className="grid gap-3">
            <h2 className="text-lg font-semibold">Permit &amp; inspection tasks ({tasks.length})</h2>
            {tasks.length === 0 ? (
              <EmptyState title="No permit tasks yet" description="An owner or admin creates permit and inspection tasks for this project." />
            ) : (
              tasks.map((task) => <TaskCard key={task.id} task={task} />)
            )}
          </section>
          <section className="grid gap-3">
            <h2 className="text-lg font-semibold">Fee reviews ({feeReviews.length})</h2>
            {feeReviews.length === 0 ? (
              <EmptyState title="No fee reviews yet" description="Quoted or verified permit fees are reviewed here before anything can affect an estimate." />
            ) : (
              feeReviews.map((review) => <FeeReviewCard key={review.id} review={review} />)
            )}
          </section>
          <p className="text-sm text-muted-foreground">
            <Link href="/projects" className="underline">
              Back to projects
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
