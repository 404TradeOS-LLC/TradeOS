import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma, basePrisma } from "../../db/client";
import { runInDatabaseTransaction } from "../../db/requestSession";
import { athenaSecurityAuditEventTypes, type AthenaAuditEvent, type AthenaAuditRepository, type AthenaAuditStore, type AthenaSecurityAuditQuery } from "./types";

type AuditCorrelation = {
  actionId?: string | null;
  approvalId?: string | null;
};

const TERMINAL_AUDIT_EVENTS = new Set<AthenaAuditEvent["eventType"]>(["execution_completed", "failure"]);
const SECURITY_AUDIT_EVENTS = new Set<string>(athenaSecurityAuditEventTypes);
const DEFAULT_SECURITY_EVENT_LIMIT = 50;
const MAX_SECURITY_EVENT_LIMIT = 200;

function securityEventLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit ?? DEFAULT_SECURITY_EVENT_LIMIT, 1), MAX_SECURITY_EVENT_LIMIT);
}

function isSecurityEvent(event: AthenaAuditEvent): boolean {
  return SECURITY_AUDIT_EVENTS.has(event.eventType);
}

function matchesSecurityQuery(event: AthenaAuditEvent, query: AthenaSecurityAuditQuery): boolean {
  const outcome = event.metadata.outcome;
  return (
    isSecurityEvent(event) &&
    event.organization === query.organizationId &&
    (!query.eventTypes || query.eventTypes.includes(event.eventType as (typeof athenaSecurityAuditEventTypes)[number])) &&
    (!query.actorUserId || event.actor.userId === query.actorUserId) &&
    (!query.outcome || outcome === query.outcome) &&
    (!query.from || event.timestamp >= query.from) &&
    (!query.to || event.timestamp <= query.to)
  );
}

function withInheritedActionCorrelation(event: AthenaAuditEvent, prior?: AuditCorrelation | null): AthenaAuditEvent {
  if (event.eventType !== "execution_completed" || (event.actionId && event.approvalId)) {
    return event;
  }
  return {
    ...event,
    actionId: event.actionId ?? prior?.actionId ?? undefined,
    approvalId: event.approvalId ?? prior?.approvalId ?? undefined,
  };
}

function toAuditEvent(row: {
  id: string;
  createdAt: Date;
  actorUserId: string | null;
  actorRole: string | null;
  orgId: string;
  eventType: string;
  metadataJson: Prisma.JsonValue;
  requestId: string | null;
  traceId: string | null;
  executionId: string | null;
  actionId: string | null;
  approvalId: string | null;
}): AthenaAuditEvent {
  return {
    id: row.id,
    timestamp: row.createdAt,
    actor: { userId: row.actorUserId, role: row.actorRole },
    organization: row.orgId,
    eventType: row.eventType as AthenaAuditEvent["eventType"],
    metadata: (row.metadataJson ?? {}) as Record<string, unknown>,
    requestId: row.requestId ?? undefined,
    traceId: row.traceId ?? undefined,
    executionId: row.executionId ?? undefined,
    actionId: row.actionId ?? undefined,
    approvalId: row.approvalId ?? undefined,
  };
}

export type AthenaTerminalTrackingAuditStore = AthenaAuditStore & {
  hasTerminalEvent(executionId: string): boolean;
};

export function createTerminalTrackingAthenaAuditStore(delegate: AthenaAuditStore): AthenaTerminalTrackingAuditStore {
  const terminalExecutions = new Set<string>();
  return {
    async record(event) {
      await delegate.record(event);
      if (event.executionId && TERMINAL_AUDIT_EVENTS.has(event.eventType)) {
        terminalExecutions.add(event.executionId);
      }
    },
    // Fluid PR-5: batch through the delegate when it has one, so the
    // kernel's deferred flush stays one bounded write; terminal tracking
    // still runs for every event in the batch, in the same order.
    async recordMany(events) {
      if (delegate.recordMany) {
        await delegate.recordMany(events);
      } else {
        for (const event of events) await delegate.record(event);
      }
      for (const event of events) {
        if (event.executionId && TERMINAL_AUDIT_EVENTS.has(event.eventType)) {
          terminalExecutions.add(event.executionId);
        }
      }
    },
    hasTerminalEvent(executionId) {
      return terminalExecutions.has(executionId);
    },
  };
}

export function createInMemoryAthenaAuditStore(events: AthenaAuditEvent[] = []): AthenaAuditRepository & { events: AthenaAuditEvent[] } {
  return {
    events,
    async record(event) {
      const priorAction =
        event.eventType === "execution_completed"
          ? [...events].reverse().find((candidate) => candidate.executionId === event.executionId && candidate.eventType === "action_attempted")
          : undefined;
      events.push(withInheritedActionCorrelation(event, priorAction));
    },
    // Fluid PR-5: no batch write exists for the in-memory store; the loop
    // preserves the per-event correlation inheritance of record().
    async recordMany(batch) {
      for (const event of batch) await this.record(event);
    },
    async listForApproval(query) {
      return events
        .filter(
          (event) =>
            event.organization === query.organizationId &&
            (event.approvalId === query.approvalId || event.actionId === query.actionId)
        )
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, query.limit);
    },
    async listSecurityEvents(query) {
      return events
        .filter((event) => matchesSecurityQuery(event, query))
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, securityEventLimit(query.limit));
    },
  };
}

type AthenaAuditDatabase = Pick<PrismaClient, "athenaAuditEvent">;

// Correlation lookup + insert against one database handle. Callers route
// the handle through the ambient transaction themselves: the default
// `prisma` proxy resolves to the request transaction inside
// runInDatabaseTransaction, and an explicitly supplied transaction client
// is already the session the caller owns.
async function recordOnDatabase(database: AthenaAuditDatabase, event: AthenaAuditEvent): Promise<void> {
  const priorAction =
    event.eventType === "execution_completed" && (!event.actionId || !event.approvalId)
      ? await database.athenaAuditEvent.findFirst({
          where: {
            orgId: event.organization,
            executionId: event.executionId,
            eventType: "action_attempted",
          },
          orderBy: { createdAt: "desc" },
          select: { actionId: true, approvalId: true },
        })
      : null;
  const correlatedEvent = withInheritedActionCorrelation(event, priorAction);

  await database.athenaAuditEvent.create({ data: toAuditEventRow(correlatedEvent) });
}

function toAuditEventRow(event: AthenaAuditEvent) {
  return {
    id: event.id,
    orgId: event.organization,
    actorUserId: event.actor.userId,
    actorRole: event.actor.role,
    requestId: event.requestId,
    traceId: event.traceId,
    executionId: event.executionId,
    actionId: event.actionId,
    approvalId: event.approvalId,
    eventType: event.eventType,
    metadataJson: event.metadata as Prisma.InputJsonValue,
    createdAt: event.timestamp,
  };
}

// Fluid PR-5 (Lever 3 write coalescing): one bounded write for a whole
// batch of events — one createMany for the inserts, plus one correlation
// lookup per execution_completed event that lacks action/approval ids
// (the kernel's draft path has none, so the batch is a single call).
// An empty batch is a no-op (Prisma rejects an empty createMany).
//
// Codex P2 on PR #1171: a preceding action_attempted in the same batch is
// not yet in the database when the correlation lookup runs, so findFirst
// cannot see it and the completion persists without correlation —
// AthenaApprovalsService.getDetail() then omits it from the audit trail
// because listForApproval() filters by action/approval ids. Resolve
// correlation from preceding same-org, same-execution batch events first
// and fall back to the database only when the batch has none. Only
// preceding events seed the batch map (in-order pass), and only attempts
// carrying at least one id seed it, so an id-less attempt never shadows
// the database fallback.
async function recordManyOnDatabase(database: AthenaAuditDatabase, events: AthenaAuditEvent[]): Promise<void> {
  if (events.length === 0) return;
  const batchCorrelation = new Map<string, Map<string, AuditCorrelation>>();
  const rows = [];
  for (const event of events) {
    if (event.eventType === "action_attempted" && event.executionId && (event.actionId || event.approvalId)) {
      let byExecution = batchCorrelation.get(event.organization);
      if (!byExecution) {
        byExecution = new Map<string, AuditCorrelation>();
        batchCorrelation.set(event.organization, byExecution);
      }
      byExecution.set(event.executionId, { actionId: event.actionId ?? null, approvalId: event.approvalId ?? null });
    }
    let priorAction: AuditCorrelation | null = null;
    if (event.eventType === "execution_completed" && (!event.actionId || !event.approvalId)) {
      priorAction = event.executionId ? batchCorrelation.get(event.organization)?.get(event.executionId) ?? null : null;
      if (!priorAction) {
        priorAction = await database.athenaAuditEvent.findFirst({
          where: {
            orgId: event.organization,
            executionId: event.executionId,
            eventType: "action_attempted",
          },
          orderBy: { createdAt: "desc" },
          select: { actionId: true, approvalId: true },
        });
      }
    }
    rows.push(toAuditEventRow(withInheritedActionCorrelation(event, priorAction)));
  }
  await database.athenaAuditEvent.createMany({ data: rows });
}

export function createPrismaAthenaAuditStore(database: AthenaAuditDatabase = prisma): AthenaAuditRepository {
  return {
    async record(event) {
      // An explicitly supplied database already owns its transaction and
      // session (e.g. resolveAuthContext's direct basePrisma.$transaction
      // in app/backend/auth/session.ts, or an in-memory stand-in): run the
      // correlation lookup and insert on it directly. Wrapping it in
      // runInDatabaseTransaction would open a second transaction on
      // basePrisma — with connection_limit=1 that acquisition times out
      // while the caller's transaction holds the only connection, and the
      // best-effort audit event is silently dropped. The default prisma
      // path keeps the short actor-scoped RLS session below.
      if (database !== prisma) {
        await recordOnDatabase(database, event);
        return;
      }
      // Fluid PR-4: the correlation read and the insert share one short RLS
      // session from the chat controller's actor when no request transaction
      // is active; the ambient transaction is reused otherwise.
      await runInDatabaseTransaction(basePrisma, async () => recordOnDatabase(database, event));
    },
    async recordMany(events) {
      // Same routing as record(): an explicitly supplied database already
      // owns its transaction and session, so the batch runs on it directly;
      // the default prisma path keeps the short actor-scoped RLS session.
      if (database !== prisma) {
        await recordManyOnDatabase(database, events);
        return;
      }
      await runInDatabaseTransaction(basePrisma, async () => recordManyOnDatabase(database, events));
    },
    async listForApproval(query) {
      const rows = await database.athenaAuditEvent.findMany({
        where: {
          orgId: query.organizationId,
          OR: [{ approvalId: query.approvalId }, { actionId: query.actionId }],
        },
        orderBy: { createdAt: "desc" },
        take: query.limit,
      });
      return rows.map(toAuditEvent);
    },
    async listSecurityEvents(query) {
      const rows = await database.athenaAuditEvent.findMany({
        where: {
          orgId: query.organizationId,
          eventType: { in: [...(query.eventTypes ?? athenaSecurityAuditEventTypes)] },
          actorUserId: query.actorUserId,
          createdAt: { gte: query.from, lte: query.to },
          metadataJson: query.outcome
            ? { path: ["outcome"], equals: query.outcome }
            : undefined,
        },
        orderBy: { createdAt: "desc" },
        take: securityEventLimit(query.limit),
      });
      return rows.map(toAuditEvent);
    },
  };
}
