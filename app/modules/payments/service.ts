import { prisma } from "../../db/client";
import { getRollingWindowUtc, resolveOrgTimezone } from "../jobs/dispatchRules";

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getCurrentWeekBoundaryUtc(referenceInstant: Date, timezone: string) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(referenceInstant);
  const weekdayIndex = WEEKDAY_INDEX[weekday] ?? 0;

  const { endUtc: startUtc } = getRollingWindowUtc(referenceInstant, timezone, -weekdayIndex);
  const { endUtc } = getRollingWindowUtc(referenceInstant, timezone, 7 - weekdayIndex);

  return { startUtc, endUtc };
}

export class PaymentLedgerService {
  async listCurrentWeek(orgId: string, referenceInstant = new Date()) {
    const organizationSettings = await prisma.organizationSettings.findUnique({ where: { orgId } });
    const settingsJson = isRecord(organizationSettings?.settingsJson) ? organizationSettings.settingsJson : {};
    const rawTimezone = typeof settingsJson.timezone === "string" ? settingsJson.timezone : null;
    const timezone = resolveOrgTimezone(rawTimezone);
    const { startUtc, endUtc } = getCurrentWeekBoundaryUtc(referenceInstant, timezone.timezone);

    const rows = await prisma.payment.findMany({
      where: {
        orgId,
        status: "recorded",
        paymentDate: {
          gte: startUtc,
          lt: endUtc,
        },
      },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            amount: true,
            status: true,
            project: {
              select: {
                id: true,
                name: true,
                customer: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
    });

    const payments = rows.map((row) => ({
      id: row.id,
      invoiceId: row.invoiceId,
      amount: Number(row.amount),
      paymentDate: row.paymentDate.toISOString(),
      method: row.method,
      status: row.status,
      reference: row.reference,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      invoice: {
        id: row.invoice.id,
        invoiceNumber: row.invoice.invoiceNumber,
        amount: Number(row.invoice.amount),
        status: row.invoice.status,
        project: row.invoice.project,
      },
    }));

    return {
      period: "current_week" as const,
      timezone,
      rangeUtc: {
        start: startUtc.toISOString(),
        end: endUtc.toISOString(),
      },
      totalAmount: payments.reduce((sum, payment) => sum + payment.amount, 0),
      paymentCount: payments.length,
      payments,
    };
  }
}
