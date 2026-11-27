// Shared Athena observability alert pipeline: evaluate every rule for each
// configured job, apply the results to athena_alerts, and email newly-firing
// (brand-new or reactivated) and newly-resolved alerts to the operator
// mailbox. Used by both entry points so the pipeline exists exactly once:
//   - app/scripts/run-athena-observability-alerts.ts (external cron)
//   - app/backend/routes/athenaObservabilityAlertsCron.routes.ts (Vercel Cron)
//
// The per-job database sessions are the sanctioned background shape from
// alerts.ts: evaluateAthenaAlerts reads through the ambient prisma proxy and
// needs the caller's session; applyAthenaAlertEvaluations opens its own.
// A job whose evaluation or apply throws is recorded with `error` and does
// not stop the remaining jobs. Email delivery is best-effort on top of the
// persisted rows: a failed send is recorded per alert in `emailFailures`
// and never fails the job, so a Resend outage cannot lose alert state or
// block the other orgs' evaluations.

import { basePrisma } from "../../db/client";
import { runWithBackgroundDatabaseSession } from "../../db/requestSession";
import { applyAthenaAlertEvaluations, evaluateAthenaAlerts } from "./alerts";
import {
  deliverAthenaAlertEmails,
  resolveAlertEmailRecipient,
  type AthenaAlertEmailFailure,
  type AthenaAlertEmailSender,
} from "./alertEmail";
import type { MaintenanceJobSpec } from "./maintenanceJobs";
import type { AthenaAlertRecord } from "./types";

export interface AthenaAlertJobResult {
  orgId: string;
  // Rows applyAthenaAlertEvaluations wrote this run (new/reactivated firing
  // plus just-resolved), for the caller's logging/response. Continuing
  // firing rows are included with their bumped lastSeenAt.
  applied: AthenaAlertRecord[];
  firing: number;
  resolved: number;
  emailed: number;
  emailFailures: AthenaAlertEmailFailure[];
  recipientConfigured: boolean;
  // Hard per-job error (evaluation or apply threw). Email failures are NOT
  // recorded here; see emailFailures.
  error?: string;
}

export interface AthenaAlertRunResult {
  recipient: string | null;
  jobs: AthenaAlertJobResult[];
}

export async function runAthenaAlertJobs(
  jobs: readonly MaintenanceJobSpec[],
  options: { emailService?: AthenaAlertEmailSender } = {},
): Promise<AthenaAlertRunResult> {
  const recipient = resolveAlertEmailRecipient();
  const results: AthenaAlertJobResult[] = [];

  for (const job of jobs) {
    try {
      // evaluateAthenaAlerts only reads - it is wrapped in its own
      // background session (separate from applyAthenaAlertEvaluations's own
      // internal session below) rather than nesting one inside the other,
      // since evaluateAthenaAlerts's signature intentionally takes no
      // userId: the read-side session is the caller's responsibility.
      const evaluations = await runWithBackgroundDatabaseSession(
        basePrisma,
        { jobName: "athena-observability-alerts-evaluate", orgId: job.orgId, userId: job.userId },
        () => evaluateAthenaAlerts(job.orgId),
      );

      const applied = await applyAthenaAlertEvaluations(job.orgId, job.userId, evaluations);
      const firing = applied.filter((alert) => alert.status === "active").length;
      const resolved = applied.filter((alert) => alert.status === "resolved").length;

      let emailed = 0;
      let emailFailures: AthenaAlertEmailFailure[] = [];
      if (recipient) {
        const delivery = await deliverAthenaAlertEmails({
          orgId: job.orgId,
          recipient,
          alerts: applied,
          emailService: options.emailService,
        });
        emailed = delivery.emailed;
        emailFailures = delivery.failures;
      }

      results.push({ orgId: job.orgId, applied, firing, resolved, emailed, emailFailures, recipientConfigured: recipient !== null });
    } catch (error) {
      results.push({
        orgId: job.orgId,
        applied: [],
        firing: 0,
        resolved: 0,
        emailed: 0,
        emailFailures: [],
        recipientConfigured: recipient !== null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { recipient, jobs: results };
}
