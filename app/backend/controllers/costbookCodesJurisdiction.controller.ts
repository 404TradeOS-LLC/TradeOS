/**
 * Codes & Permits jurisdiction / assessment / hints controllers (issue #946, TODO 4).
 *
 * Read-only matching and hints plus the tenant-scoped assessment write path.
 * All routes sit behind the global /api/v1 requireAuth + databaseSession
 * middleware; these handlers additionally require `costbook.read` for reads
 * and `costbook.write` for assessment creation. Owner sign-off requires the
 * owner or admin role.
 *
 * Fail-closed note: jurisdiction records come from the empty fail-closed
 * store until TODO 2's codes_authority / codes_jurisdiction / codes_source
 * tables land and a database-backed store replaces it. Until then every
 * project resolves to `needs_verification` — never a guessed jurisdiction.
 */
import { Request, Response } from "express";
import { z } from "zod";
import { requireAuthContext, requireOrgId, requirePermissions, requireRoles } from "../requestContext";
import { prisma } from "../../db/client";
import { ApiError } from "../middleware/errorHandler";
import { EstimateEngineService } from "../../modules/estimate-engine/service";
import { CodesJobAssessmentService } from "../../modules/costbook/codes/assessment";
import { buildEstimateHints } from "../../modules/costbook/codes/hints";
import { emptyJurisdictionRecordStore, resolveJurisdiction } from "../../modules/costbook/codes/jurisdiction";
import type { SiteInput } from "../../modules/costbook/codes/types";

const assessmentService = new CodesJobAssessmentService();
const estimateService = new EstimateEngineService();
const jurisdictionStore = emptyJurisdictionRecordStore;

const uuid = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  "must be a UUID",
);
const booleanQuery = z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .optional();

const jurisdictionQuerySchema = z
  .object({
    projectId: uuid,
    workType: z.string().trim().min(1).max(120).optional(),
    state: z.string().trim().regex(/^[A-Za-z]{2}$/).transform((value) => value.toUpperCase()).optional(),
    county: z.string().trim().min(1).max(80).optional(),
    city: z.string().trim().min(1).max(80).optional(),
    parcelId: z.string().trim().min(1).max(80).optional(),
    incorporated: booleanQuery,
    zoningDistrict: z.string().trim().min(1).max(80).optional(),
    signCategory: z.enum(["on-premises", "off-premises"]).optional(),
    nearStateRoad: booleanQuery,
    crossesRoadEdge: booleanQuery,
    rightOfWayBoundaryVerified: booleanQuery,
    signDetailsVerified: booleanQuery,
    electricalConnectionVerified: booleanQuery,
  })
  .strict();

const citationSchema = z.object({
  source_id: z.string().trim().min(1).max(120),
  rationale: z.string().trim().min(1).max(500),
}).strict();

const createAssessmentSchema = z.object({
  projectId: uuid,
  estimateId: uuid.optional().nullable(),
  workType: z.string().trim().min(1).max(120),
  status: z.enum(["needs_review", "in_review", "needs_verification"]).optional(),
  citations: z.array(citationSchema).max(20),
  unknowns: z.array(z.string().trim().min(1).max(500)).max(20),
}).strict();

const listAssessmentsQuerySchema = z
  .object({
    projectId: uuid.optional(),
    estimateId: uuid.optional(),
  })
  .strict()
  .refine((value) => Boolean(value.projectId) !== Boolean(value.estimateId), {
    message: "Provide exactly one of projectId or estimateId",
  });

function siteFromProject(project: { siteAddress: string | null }, query: z.infer<typeof jurisdictionQuerySchema>): SiteInput {
  return {
    parcelId: query.parcelId ?? null,
    siteAddress: project.siteAddress,
    city: query.city ?? null,
    county: query.county ?? null,
    state: query.state ?? null,
    incorporated: query.incorporated ?? null,
    zoningDistrict: query.zoningDistrict ?? null,
    signCategory: query.signCategory ?? null,
    nearStateRoad: query.nearStateRoad ?? null,
    crossesRoadEdge: query.crossesRoadEdge ?? null,
    rightOfWayBoundaryVerified: query.rightOfWayBoundaryVerified ?? null,
    signDetailsVerified: query.signDetailsVerified ?? null,
    electricalConnectionVerified: query.electricalConnectionVerified ?? null,
  };
}

export const costbookCodesJurisdictionController = {
  async getJurisdiction(req: Request, res: Response) {
    requirePermissions(req, ["costbook.read"]);
    const orgId = requireOrgId(req);
    const query = jurisdictionQuerySchema.parse(req.query);
    const project = await prisma.project.findFirst({ where: { id: query.projectId, orgId } });
    if (!project) throw new ApiError(404, `Project ${query.projectId} not found`);
    const site = siteFromProject(project, query);
    const workType = query.workType ?? "general work";
    const records = await jurisdictionStore.listForSite(site);
    const resolution = resolveJurisdiction(site, records, workType);
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ projectId: project.id, site: { siteAddress: project.siteAddress }, ...resolution });
  },

  async listAssessments(req: Request, res: Response) {
    requirePermissions(req, ["costbook.read"]);
    const orgId = requireOrgId(req);
    const query = listAssessmentsQuerySchema.parse(req.query);
    const rows = query.projectId
      ? await assessmentService.listForProject(query.projectId, orgId)
      : await assessmentService.listForEstimate(query.estimateId as string, orgId);
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ items: rows, total: rows.length });
  },

  async createAssessment(req: Request, res: Response) {
    requirePermissions(req, ["costbook.write"]);
    const orgId = requireOrgId(req);
    const auth = requireAuthContext(req);
    const body = createAssessmentSchema.parse(req.body);
    const created = await assessmentService.create({
      orgId,
      projectId: body.projectId,
      estimateId: body.estimateId ?? null,
      workType: body.workType,
      status: body.status,
      citations: body.citations,
      unknowns: body.unknowns,
      createdBy: auth.userId,
    });
    res.status(201).json(created);
  },

  async signOffAssessment(req: Request, res: Response) {
    requireRoles(req, ["owner", "admin"]);
    const orgId = requireOrgId(req);
    const auth = requireAuthContext(req);
    const signed = await assessmentService.signOff(req.params.id, orgId, auth.userId);
    res.json(signed);
  },

  async getEstimateHints(req: Request, res: Response) {
    requirePermissions(req, ["costbook.read"]);
    const orgId = requireOrgId(req);
    const estimateId = req.params.estimateId;
    if (!uuid.safeParse(estimateId).success) throw new ApiError(400, "estimateId must be a UUID");
    const estimate = await estimateService.getById(estimateId, orgId);
    const project = await prisma.project.findFirst({ where: { id: estimate.projectId, orgId } });
    if (!project) throw new ApiError(404, `Project ${estimate.projectId} not found`);
    const estimateAssessments = await assessmentService.listForEstimate(estimateId, orgId);
    const projectAssessments = await assessmentService.listForProject(project.id, orgId);
    const seen = new Set<string>();
    const assessments = [...estimateAssessments, ...projectAssessments].filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });
    const workType = assessments[0]?.workType ?? "general work";
    const site: SiteInput = { siteAddress: project.siteAddress };
    const records = await jurisdictionStore.listForSite(site);
    const jurisdiction = resolveJurisdiction(site, records, workType);
    const hints = buildEstimateHints({
      estimateId: estimate.id,
      projectId: project.id,
      estimateTotal: Number(estimate.totalPrice),
      jurisdiction,
      assessments,
    });
    res.setHeader("Cache-Control", "private, no-store");
    res.json(hints);
  },
};
