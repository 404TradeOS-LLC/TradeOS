import { randomUUID } from "node:crypto";
import { dispatchDueAthenaEventDeliveries } from "./dispatch";
import type { AthenaEventDispatchDueSummary } from "./dispatch";
import { athenaEventAuthorizationDeniedError } from "./errors";
import { publishAthenaEvent } from "./publisher";
import { replayAthenaDeadLetter } from "./replay";
import { createPrismaAthenaEventRepository } from "./store";
import type { AthenaEventRepository } from "./store";
import { recordCanonicalEventPublished, recordCanonicalEventPublishFailure } from "./transactionalContext";
import type {
  AthenaBusinessEvent,
  AthenaEventActor,
  AthenaEventDeadLetter,
  AthenaEventDelivery,
  AthenaEventSubscriber,
  AthenaPublishEventInput,
  AthenaPublishEventResult,
} from "./types";

// A8 Event Service (docs/athena/roadmap/
// A8-event-integration-implementation-plan.md). This is the *only*
// supported way the rest of Athena touches events - application services
// (e.g. modules/proposals/service.ts's ProposalsService.send()) call
// publish() here, never store.ts/repository internals directly, mirroring
// A7's athena-memory/service.ts role exactly.
//
// Isolation posture (Event Model And Isolation, layer 1 - application):
// - publish() takes orgId directly on the input (the calling service is
//   trusted to supply its own orgId, the same way every other write path in
//   this codebase is) - there is no separate actor to cross-check against.
// - getById()/listDeadLetters() (reads) return null/[] on an actor/orgId
//   mismatch instead of throwing - the same anti-enumeration posture A7
//   established, nothing to leak by staying silent.
// - replayDeadLetter() (a write) throws athenaEventAuthorizationDeniedError
//   on an actor/orgId mismatch - a mutation attempt has nothing to leak by
//   failing loudly.

const DEFAULT_DISPATCH_LIMIT = 50;
const MAX_DISPATCH_LIMIT = 500;

function assertCallerOrgMatches(orgId: string, actor: AthenaEventActor, correlationId: string): void {
  if (!orgId || actor.orgId !== orgId) {
    throw athenaEventAuthorizationDeniedError(correlationId);
  }
}

function clampDispatchLimit(limit: number | undefined): number {
  if (!limit || !Number.isFinite(limit) || limit <= 0) return DEFAULT_DISPATCH_LIMIT;
  return Math.min(Math.floor(limit), MAX_DISPATCH_LIMIT);
}

export interface AthenaEventServiceDeps {
  repository?: AthenaEventRepository;
  // Static/in-process subscriber list (A8 has no dynamic subscription API).
  // Production default is an empty array - dark by default, per the plan
  // doc's "zero registered subscribers anywhere in production for this
  // milestone".
  subscribers?: AthenaEventSubscriber[];
}

export interface AthenaEventService {
  publish<TPayload = unknown>(input: AthenaPublishEventInput<TPayload>): Promise<AthenaPublishEventResult>;
  getById(orgId: string, actor: AthenaEventActor, id: string): Promise<AthenaBusinessEvent | null>;
  dispatchDue(orgId: string, limit?: number): Promise<AthenaEventDispatchDueSummary>;
  replayDeadLetter(orgId: string, actor: AthenaEventActor, deadLetterId: string): Promise<AthenaEventDelivery>;
  listDeadLetters(orgId: string, actor: AthenaEventActor, eventId?: string): Promise<AthenaEventDeadLetter[]>;
}

export function createAthenaEventService(deps: AthenaEventServiceDeps = {}): AthenaEventService {
  const repository = deps.repository ?? createPrismaAthenaEventRepository();
  const subscribers = deps.subscribers ?? [];

  return {
    async publish(input) {
      try {
        const result = await publishAthenaEvent(repository, input, subscribers);
        recordCanonicalEventPublished(input.type);
        return result;
      } catch (error) {
        recordCanonicalEventPublishFailure(input.type, error);
        throw error;
      }
    },

    async getById(orgId, actor, id) {
      if (!orgId || actor.orgId !== orgId) return null;
      return repository.findEventById(orgId, id);
    },

    async dispatchDue(orgId, limit) {
      return dispatchDueAthenaEventDeliveries(repository, orgId, subscribers, clampDispatchLimit(limit));
    },

    async replayDeadLetter(orgId, actor, deadLetterId) {
      const correlationId = randomUUID();
      assertCallerOrgMatches(orgId, actor, correlationId);
      return replayAthenaDeadLetter(repository, { orgId, deadLetterId });
    },

    async listDeadLetters(orgId, actor, eventId) {
      if (!orgId || actor.orgId !== orgId) return [];
      return repository.listDeadLetters(orgId, eventId);
    },
  };
}

// Module-level singleton, lazily constructed on first call, so callers like
// modules/proposals/service.ts's ProposalsService.send() can call
// getDefaultAthenaEventService().publish(...) cheaply and repeatedly without
// recreating the Prisma repository each time. Production default: real
// Prisma repository, empty subscriber list.
let defaultAthenaEventServiceInstance: AthenaEventService | undefined;

export function getDefaultAthenaEventService(): AthenaEventService {
  if (!defaultAthenaEventServiceInstance) {
    defaultAthenaEventServiceInstance = createAthenaEventService();
  }
  return defaultAthenaEventServiceInstance;
}
