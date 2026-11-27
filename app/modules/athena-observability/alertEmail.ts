// Athena observability alert email delivery (A10 "Alerts" follow-up to the
// Gemini spend cap, PR #1144).
//
// applyAthenaAlertEvaluations only returns rows it wrote this run, but a
// returned "active" row may be brand-new, reactivated, or merely still
// firing since the last run. Only the first two get an email: a create or
// reactivate resets firstSeenAt to the same instant as lastSeenAt, while a
// still-firing row keeps its original firstSeenAt, so the two timestamps
// distinguish them without extending the AthenaAlertRecord contract. A
// returned "resolved" row always just transitioned this run (apply only
// returns rows it resolved), so every resolved row gets an email.
//
// Delivery is best-effort: the athena_alerts row is the durable record, so
// a failed send is reported per alert and never throws the whole run. The
// recipient comes from ATHENA_ALERT_EMAIL_RECIPIENT; while it is unset the
// caller skips delivery (and logs that) rather than guessing an address.

import { emailService, type EmailService } from "../email/service";
import type { AthenaAlertRecord } from "./types";

// Create/reactivate writes firstSeenAt and lastSeenAt from the same `now`
// (alerts.ts), so the two timestamps serialize identically. A 2s tolerance
// absorbs any clock/serialization skew without ever matching a genuinely
// continuing alert, whose firstSeenAt is at least one evaluation cadence
// (15 minutes) older than its lastSeenAt.
export const NEW_ALERT_TIMESTAMP_TOLERANCE_MS = 2_000;

// Test seam: any object with the sendAthenaAlert method (the real
// EmailService singleton by default).
export type AthenaAlertEmailSender = Pick<EmailService, "sendAthenaAlert">;

export function resolveAlertEmailRecipient(): string | null {
  const raw = process.env.ATHENA_ALERT_EMAIL_RECIPIENT?.trim();
  return raw ? raw : null;
}

export function isNewlyFiringAlert(alert: AthenaAlertRecord): boolean {
  if (alert.status !== "active") return false;
  const firstSeen = Date.parse(alert.firstSeenAt);
  const lastSeen = Date.parse(alert.lastSeenAt);
  if (!Number.isFinite(firstSeen) || !Number.isFinite(lastSeen)) return false;
  return Math.abs(lastSeen - firstSeen) <= NEW_ALERT_TIMESTAMP_TOLERANCE_MS;
}

export function isNewlyResolvedAlert(alert: AthenaAlertRecord): boolean {
  return alert.status === "resolved";
}

export function selectMailableAlerts(alerts: readonly AthenaAlertRecord[]): {
  firing: AthenaAlertRecord[];
  resolved: AthenaAlertRecord[];
} {
  return {
    firing: alerts.filter(isNewlyFiringAlert),
    resolved: alerts.filter(isNewlyResolvedAlert),
  };
}

export interface AthenaAlertEmailFailure {
  ruleId: string;
  dedupeKey: string;
  status: "active" | "resolved";
  error: string;
}

export interface AthenaAlertEmailDeliveryResult {
  emailed: number;
  skipped: number;
  failures: AthenaAlertEmailFailure[];
}

export async function deliverAthenaAlertEmails(input: {
  orgId: string;
  recipient: string;
  alerts: readonly AthenaAlertRecord[];
  emailService?: AthenaAlertEmailSender;
}): Promise<AthenaAlertEmailDeliveryResult> {
  const { firing, resolved } = selectMailableAlerts(input.alerts);
  const mailable = [...firing, ...resolved];
  const sender = input.emailService ?? emailService;
  const failures: AthenaAlertEmailFailure[] = [];
  let emailed = 0;

  for (const alert of mailable) {
    try {
      const result = await sender.sendAthenaAlert({
        to: input.recipient,
        orgId: input.orgId,
        ruleId: alert.ruleId,
        dedupeKey: alert.dedupeKey,
        severity: alert.severity,
        status: alert.status,
        summary: alert.summary,
        firstSeenAt: alert.firstSeenAt,
        lastSeenAt: alert.lastSeenAt,
        resolvedAt: alert.resolvedAt,
      });
      if (result.sent) {
        emailed += 1;
      } else {
        // Non-production skip (transactional email not configured): the
        // alert was not delivered, so report it rather than counting it
        // as sent. In production the service throws instead of skipping.
        failures.push({
          ruleId: alert.ruleId,
          dedupeKey: alert.dedupeKey,
          status: alert.status,
          error: "email delivery skipped: transactional email is not configured",
        });
      }
    } catch (error) {
      failures.push({
        ruleId: alert.ruleId,
        dedupeKey: alert.dedupeKey,
        status: alert.status,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { emailed, skipped: input.alerts.length - mailable.length, failures };
}
