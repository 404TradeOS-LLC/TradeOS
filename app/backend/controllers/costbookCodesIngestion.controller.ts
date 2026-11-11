import { Request, Response } from "express";
import { z } from "zod";
import { requirePermissions } from "../requestContext";
import {
  approveCodeSource,
  getCodeSource,
  ingestOfficialCodeSource,
  listCodeSourceReviewQueue,
  listCodeSources,
  rejectCodeSource,
} from "../../modules/costbook/codes/ingestion";

const dateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");

// Dates are accepted only as source-stated values transcribed by the human
// trigger; the service stores them as given and never invents one. There is
// no field for fetched body text anywhere in this API: only citation, URL,
// hash and metadata are ever persisted.
const ingestSchema = z.object({
  jurisdictionId: z.guid(),
  authorityId: z.guid(),
  codeFamily: z.string().trim().min(1).max(120),
  section: z.string().trim().min(1).max(200).optional(),
  citation: z.string().trim().min(1).max(300),
  title: z.string().trim().min(1).max(300),
  sourceUrl: z.string().trim().url().max(2000),
  licenseNote: z.string().trim().min(1).max(1000).optional(),
  publishedDate: dateSchema.optional(),
  amendedDate: dateSchema.optional(),
  effectiveDate: dateSchema.optional(),
  expiryDate: dateSchema.optional(),
}).strict();

const listQuerySchema = z.object({
  status: z.enum(["research", "reviewed", "superseded"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
}).strict();

const idParamSchema = z.object({ id: z.guid() });

const approveSchema = z.object({
  reviewNotes: z.string().trim().min(1).max(4000).optional(),
}).strict();

const rejectSchema = z.object({
  reason: z.string().trim().min(1).max(4000),
  reviewNotes: z.string().trim().min(1).max(4000).optional(),
}).strict();

export const costbookCodesIngestionController = {
  /**
   * Explicit human trigger for governed ingestion. There is no background
   * fetch, scraper, or cron behind this route: each call fetches exactly
   * one allowlisted official URL, hashes it, and versions it. Owner/admin
   * only (`costbook.manage`).
   */
  async ingest(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.manage"]);
    const input = ingestSchema.parse(req.body);
    res.json(await ingestOfficialCodeSource(auth, input));
  },

  async list(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.read"]);
    const query = listQuerySchema.parse(req.query);
    res.setHeader("Cache-Control", "private, no-store");
    res.json(await listCodeSources(auth, { status: query.status, limit: query.limit }));
  },

  async reviewQueue(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.read"]);
    res.setHeader("Cache-Control", "private, no-store");
    res.json(await listCodeSourceReviewQueue(auth));
  },

  async getById(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.read"]);
    const { id } = idParamSchema.parse(req.params);
    res.setHeader("Cache-Control", "private, no-store");
    res.json(await getCodeSource(auth, id));
  },

  async approve(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.manage"]);
    const { id } = idParamSchema.parse(req.params);
    const input = approveSchema.parse(req.body ?? {});
    res.json(await approveCodeSource(auth, id, { reviewNotes: input.reviewNotes }));
  },

  async reject(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.manage"]);
    const { id } = idParamSchema.parse(req.params);
    const input = rejectSchema.parse(req.body);
    res.json(await rejectCodeSource(auth, id, { reason: input.reason, reviewNotes: input.reviewNotes }));
  },
};
