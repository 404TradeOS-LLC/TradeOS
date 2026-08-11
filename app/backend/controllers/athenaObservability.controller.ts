import { Request, Response } from "express";
import { z } from "zod";
import { isAthenaObservabilityEnabled } from "../../modules/athena-kernel/flags";
import { getCostSummary, getEventHealth, getModelMetrics, getOverviewMetrics, getToolMetrics } from "../../modules/athena-observability/metricsService";
import { getTrace, getTraceByRequest, searchTraces } from "../../modules/athena-observability/traceService";
import { listAthenaAlerts } from "../../modules/athena-observability/alerts";
import { requireOrgId, requireRoles } from "../requestContext";
import { ApiError } from "../middleware/errorHandler";

// A10 Observability HTTP surface (docs/athena/roadmap/
// A10-observability-implementation-plan.md "Trace query service",
// "Operator authorization"). Every handler here follows the same three-step
// shape every other Athena controller uses: feature flag gate, then
// authorization, then Zod-validated input - and nothing here queries Prisma
// directly, only the athena-observability service functions (query/
// aggregation layer owns all persistence access).
//
// Authorization is deliberately narrower than existing
// requireOrgAdmin()/current_app_can_administer() (which also admits
// 'dispatcher' - see app/backend/requestContext.ts and the athena_alerts RLS
// policy comment in the A10 migration): observability exposes cost, traces,
// and error detail across the whole organization, which this repo treats as
// owner/admin-only operator data, not a role every admin-adjacent role
// should see by default.
function requireObservabilityAccess(req: Request) {
  if (!isAthenaObservabilityEnabled()) {
    throw new ApiError(404, `Route not found: ${req.method} ${req.path}`);
  }
  const auth = requireRoles(req, ["owner", "admin"]);
  const orgId = requireOrgId(req);
  return { auth, orgId };
}

const windowQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

function resolveWindow(query: { from?: string; to?: string }): { from: string; to: string } {
  const to = query.to ?? new Date().toISOString();
  const from = query.from ?? new Date(new Date(to).getTime() - 24 * 60 * 60 * 1000).toISOString();
  return { from, to };
}

const athenaKernelStateSchema = z.enum([
  "created",
  "context_building",
  "routing",
  "planning",
  "policy_check",
  "awaiting_approval",
  "executing",
  "degraded",
  "needs_clarification",
  "partially_succeeded",
  "succeeded",
  "failed",
  "denied",
  "expired",
  "cancelled",
]);

const traceSearchQuerySchema = z.object({
  traceId: z.string().uuid().optional(),
  requestId: z.string().uuid().optional(),
  executionId: z.string().uuid().optional(),
  status: athenaKernelStateSchema.optional(),
  toolId: z.string().trim().max(200).optional(),
  model: z.string().trim().max(200).optional(),
  provider: z.string().trim().max(200).optional(),
  actorUserId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.string().uuid().optional(),
});

export const athenaObservabilityController = {
  async overview(req: Request, res: Response): Promise<void> {
    const { orgId } = requireObservabilityAccess(req);
    const query = windowQuerySchema.parse(req.query);
    const window = resolveWindow(query);
    res.json(await getOverviewMetrics({ orgId, ...window }));
  },

  async searchTraces(req: Request, res: Response): Promise<void> {
    const { orgId } = requireObservabilityAccess(req);
    const query = traceSearchQuerySchema.parse(req.query);
    res.json(await searchTraces({ orgId, ...query }));
  },

  async getTrace(req: Request, res: Response): Promise<void> {
    const { orgId } = requireObservabilityAccess(req);
    const traceId = z.string().uuid().parse(req.params.traceId);
    const trace = await getTrace(orgId, traceId);
    if (!trace) {
      throw new ApiError(404, "Trace not found");
    }
    res.json(trace);
  },

  async getTraceByRequest(req: Request, res: Response): Promise<void> {
    const { orgId } = requireObservabilityAccess(req);
    const requestId = z.string().uuid().parse(req.params.requestId);
    const trace = await getTraceByRequest(orgId, requestId);
    if (!trace) {
      throw new ApiError(404, "Trace not found");
    }
    res.json(trace);
  },

  async toolMetrics(req: Request, res: Response): Promise<void> {
    const { orgId } = requireObservabilityAccess(req);
    const query = windowQuerySchema.parse(req.query);
    const window = resolveWindow(query);
    res.json(await getToolMetrics({ orgId, ...window }));
  },

  async modelMetrics(req: Request, res: Response): Promise<void> {
    const { orgId } = requireObservabilityAccess(req);
    const query = windowQuerySchema.parse(req.query);
    const window = resolveWindow(query);
    res.json(await getModelMetrics({ orgId, ...window }));
  },

  async costSummary(req: Request, res: Response): Promise<void> {
    const { orgId } = requireObservabilityAccess(req);
    const query = windowQuerySchema.parse(req.query);
    const window = resolveWindow(query);
    res.json(await getCostSummary({ orgId, ...window }));
  },

  async eventHealth(req: Request, res: Response): Promise<void> {
    const { orgId } = requireObservabilityAccess(req);
    const query = windowQuerySchema.parse(req.query);
    const window = resolveWindow(query);
    res.json(await getEventHealth({ orgId, ...window }));
  },

  async alerts(req: Request, res: Response): Promise<void> {
    const { orgId } = requireObservabilityAccess(req);
    const status = z.enum(["active", "resolved"]).optional().parse(req.query.status);
    res.json(await listAthenaAlerts({ orgId, status }));
  },
};
