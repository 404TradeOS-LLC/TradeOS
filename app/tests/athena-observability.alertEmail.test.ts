// Unit coverage for modules/athena-observability/alertEmail.ts: which
// applied rows get an email (newly firing / reactivated / newly resolved,
// never a continuing firing row) and that one failed send does not block
// the others. No database or network involved - the sender is a fake.
import {
  deliverAthenaAlertEmails,
  isNewlyFiringAlert,
  isNewlyResolvedAlert,
  resolveAlertEmailRecipient,
  selectMailableAlerts,
} from "../modules/athena-observability/alertEmail";
import type { AthenaAlertRecord } from "../modules/athena-observability/types";

const ORG = "org-1";
const RECIPIENT = "hello@404tradeos.com";

function alertRecord(overrides: Partial<AthenaAlertRecord> = {}): AthenaAlertRecord {
  return {
    id: "alert-1",
    orgId: ORG,
    ruleId: "daily_spend_cap_reached",
    dedupeKey: "daily_spend_cap_reached",
    severity: "high",
    status: "active",
    summary: "Daily spend cap of $1.00 reached",
    metadata: {},
    firstSeenAt: "2026-11-27T07:00:00.000Z",
    lastSeenAt: "2026-11-27T07:00:00.000Z",
    resolvedAt: null,
    ...overrides,
  };
}

describe("resolveAlertEmailRecipient", () => {
  const OLD = process.env.ATHENA_ALERT_EMAIL_RECIPIENT;

  afterEach(() => {
    if (OLD === undefined) delete process.env.ATHENA_ALERT_EMAIL_RECIPIENT;
    else process.env.ATHENA_ALERT_EMAIL_RECIPIENT = OLD;
  });

  it("returns the trimmed recipient when set", () => {
    process.env.ATHENA_ALERT_EMAIL_RECIPIENT = "  hello@404tradeos.com  ";
    expect(resolveAlertEmailRecipient()).toBe("hello@404tradeos.com");
  });

  it("returns null when unset or blank", () => {
    delete process.env.ATHENA_ALERT_EMAIL_RECIPIENT;
    expect(resolveAlertEmailRecipient()).toBeNull();
    process.env.ATHENA_ALERT_EMAIL_RECIPIENT = "   ";
    expect(resolveAlertEmailRecipient()).toBeNull();
  });
});

describe("new-vs-continuing selection", () => {
  it("treats a brand-new firing alert (firstSeenAt == lastSeenAt) as mailable", () => {
    expect(isNewlyFiringAlert(alertRecord())).toBe(true);
  });

  it("treats a reactivated firing alert (firstSeenAt reset to lastSeenAt) as mailable", () => {
    expect(isNewlyFiringAlert(alertRecord({
      firstSeenAt: "2026-11-27T09:00:00.000Z",
      lastSeenAt: "2026-11-27T09:00:00.000Z",
    }))).toBe(true);
  });

  it("does not mail a continuing firing alert (firstSeenAt older than lastSeenAt)", () => {
    expect(isNewlyFiringAlert(alertRecord({
      firstSeenAt: "2026-11-27T06:45:00.000Z",
      lastSeenAt: "2026-11-27T07:00:00.000Z",
    }))).toBe(false);
  });

  it("treats every resolved row as newly resolved (apply only returns rows it resolved this run)", () => {
    expect(isNewlyResolvedAlert(alertRecord({ status: "resolved", resolvedAt: "2026-11-27T07:00:00.000Z" }))).toBe(true);
    expect(isNewlyResolvedAlert(alertRecord())).toBe(false);
  });

  it("partitions applied rows into firing and resolved without the continuing rows", () => {
    const rows = [
      alertRecord({ dedupeKey: "new" }),
      alertRecord({ dedupeKey: "continuing", firstSeenAt: "2026-11-27T06:45:00.000Z" }),
      alertRecord({ dedupeKey: "resolved", status: "resolved", resolvedAt: "2026-11-27T07:00:00.000Z" }),
    ];
    const selected = selectMailableAlerts(rows);
    expect(selected.firing.map((row) => row.dedupeKey)).toEqual(["new"]);
    expect(selected.resolved.map((row) => row.dedupeKey)).toEqual(["resolved"]);
  });
});

describe("deliverAthenaAlertEmails", () => {
  it("emails newly-firing and newly-resolved alerts and skips continuing ones", async () => {
    const sendAthenaAlert = jest.fn().mockResolvedValue({ sent: true, providerMessageId: "re_1" });
    const rows = [
      alertRecord({ dedupeKey: "new" }),
      alertRecord({ dedupeKey: "continuing", firstSeenAt: "2026-11-27T06:45:00.000Z" }),
      alertRecord({ dedupeKey: "resolved", status: "resolved", resolvedAt: "2026-11-27T07:00:00.000Z" }),
    ];

    const result = await deliverAthenaAlertEmails({
      orgId: ORG,
      recipient: RECIPIENT,
      alerts: rows,
      emailService: { sendAthenaAlert },
    });

    expect(result).toEqual({ emailed: 2, skipped: 1, failures: [] });
    expect(sendAthenaAlert).toHaveBeenCalledTimes(2);
    expect(sendAthenaAlert).toHaveBeenCalledWith(expect.objectContaining({ to: RECIPIENT, orgId: ORG, dedupeKey: "new", status: "active" }));
    expect(sendAthenaAlert).toHaveBeenCalledWith(expect.objectContaining({ dedupeKey: "resolved", status: "resolved" }));
  });

  it("records a failed send per alert and still emails the rest", async () => {
    const sendAthenaAlert = jest.fn()
      .mockRejectedValueOnce(new Error("Resend email request failed (500)"))
      .mockResolvedValue({ sent: true, providerMessageId: "re_2" });
    const rows = [
      alertRecord({ dedupeKey: "failing" }),
      alertRecord({ dedupeKey: "ok", ruleId: "cost_spike" }),
    ];

    const result = await deliverAthenaAlertEmails({
      orgId: ORG,
      recipient: RECIPIENT,
      alerts: rows,
      emailService: { sendAthenaAlert },
    });

    expect(result.emailed).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.failures).toEqual([
      { ruleId: "daily_spend_cap_reached", dedupeKey: "failing", status: "active", error: "Resend email request failed (500)" },
    ]);
    expect(sendAthenaAlert).toHaveBeenCalledTimes(2);
  });

  it("reports a skipped send (email not configured) as a delivery failure, not a sent email", async () => {
    const sendAthenaAlert = jest.fn().mockResolvedValue({ sent: false, skipped: true });
    const result = await deliverAthenaAlertEmails({
      orgId: ORG,
      recipient: RECIPIENT,
      alerts: [alertRecord()],
      emailService: { sendAthenaAlert },
    });

    expect(result.emailed).toBe(0);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].error).toMatch(/not configured/);
  });

  it("sends nothing when no applied row is mailable", async () => {
    const sendAthenaAlert = jest.fn();
    const result = await deliverAthenaAlertEmails({
      orgId: ORG,
      recipient: RECIPIENT,
      alerts: [alertRecord({ firstSeenAt: "2026-11-27T06:45:00.000Z" })],
      emailService: { sendAthenaAlert },
    });

    expect(result).toEqual({ emailed: 0, skipped: 1, failures: [] });
    expect(sendAthenaAlert).not.toHaveBeenCalled();
  });
});
