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

const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
  .refine((value) => {
    // Shape alone is not enough: 2026-02-30 matches YYYY-MM-DD but is not
    // a calendar date, and the ::date cast in the store would fail in
    // Postgres after the fetch. Round-trip the components instead of
    // trusting Date parsing (which normalizes invalid dates). setUTCFullYear
    // — not Date.UTC — so years 0001-0099 are not mapped to 1900-1999;
    // year 0000 is rejected outright.
    const [year, month, day] = value.split("-").map(Number);
    if (year < 1) return false;
    const probe = new Date(0);
    probe.setUTCFullYear(year, month - 1, day);
    return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
  }, "date must be a valid calendar date");

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
