import { Request, Response } from "express";
import { z } from "zod";
import { requireAuthContext, requireOrgAdmin, requireOrgId, requirePermissions } from "../requestContext";
import {
  ActivityTimelineService,
  AttachmentService,
  FeatureFlagsService,
  GlobalSearchService,
  NotificationCenterService,
  RecentlyViewedService,
  SavedViewsService,
  TagsService,
  UniversalCommentsService,
} from "../../modules/intelligence/service";
import {
  attachmentKinds,
  featureFlagScopeTypes,
  intelligenceEntityTypes,
  notificationCategories,
  notificationPriorities,
  notificationStatuses,
} from "../../modules/intelligence/types";

const searchService = new GlobalSearchService();
const activityService = new ActivityTimelineService();
const notificationService = new NotificationCenterService();
const attachmentService = new AttachmentService();
const commentsService = new UniversalCommentsService();
const tagsService = new TagsService();
const savedViewsService = new SavedViewsService();
const recentItemsService = new RecentlyViewedService();
const featureFlagsService = new FeatureFlagsService();

const entityTypeSchema = z.enum(intelligenceEntityTypes);

const searchQuerySchema = z.object({
  q: z.string().trim().default(""),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  entityTypes: z
    .string()
    .optional()
    .transform((value) => (value ? value.split(",").map((item) => item.trim()).filter(Boolean) : undefined))
    .pipe(z.array(entityTypeSchema).optional()),
});

const activityQuerySchema = z.object({
  entityType: entityTypeSchema.optional(),
  entityId: z.string().uuid().optional(),
  eventType: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const referenceQuerySchema = z.object({
  entityType: entityTypeSchema,
  entityId: z.string().uuid(),
});

const createActivitySchema = z.object({
  entityType: entityTypeSchema,
  entityId: z.string().uuid(),
  eventType: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  occurredAt: z.string().datetime().optional(),
});

const createNotificationSchema = z.object({
  entityType: entityTypeSchema,
  entityId: z.string().uuid(),
  category: z.enum(notificationCategories),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(2000),
  priority: z.enum(notificationPriorities).optional(),
  actionUrl: z.string().trim().optional(),
  activityEventId: z.string().uuid().optional(),
});

const updateNotificationSchema = z.object({
  status: z.enum(notificationStatuses),
});

const notificationQuerySchema = z.object({
  category: z.enum(notificationCategories).optional(),
  priority: z.enum(notificationPriorities).optional(),
  status: z.enum(notificationStatuses).optional(),
  unreadOnly: z.coerce.boolean().optional(),
  includeArchived: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const createAttachmentSchema = z.object({
  entityType: entityTypeSchema,
  entityId: z.string().uuid(),
  kind: z.enum(attachmentKinds),
  fileName: z.string().trim().min(1).max(240),
  mimeType: z.string().trim().max(160).optional(),
  fileUrl: z.string().url(),
  previewUrl: z.string().url().optional(),
  storagePath: z.string().trim().max(500).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  durationSeconds: z.number().int().nonnegative().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const createCommentSchema = z.object({
  entityType: entityTypeSchema,
  entityId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
  parentCommentId: z.string().uuid().optional(),
  mentions: z.array(z.string().uuid()).optional(),
});

const updateCommentSchema = z.object({
  body: z.string().trim().min(1).max(4000).optional(),
  resolvedAt: z.string().datetime().nullable().optional(),
  reactions: z.record(z.string(), z.array(z.string().uuid())).optional(),
});

const createTagSchema = z.object({
  name: z.string().trim().min(1).max(80),
  color: z.string().trim().max(32).optional(),
  description: z.string().trim().max(240).optional(),
});

const assignTagSchema = z.object({
  entityType: entityTypeSchema,
  entityId: z.string().uuid(),
  tagId: z.string().uuid(),
});

const createSavedViewSchema = z.object({
  entityType: entityTypeSchema,
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(240).optional(),
  filterJson: z.record(z.string(), z.unknown()),
  sortJson: z.record(z.string(), z.unknown()).optional(),
  isShared: z.boolean().optional(),
});

const updateSavedViewSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(240).nullable().optional(),
  filterJson: z.record(z.string(), z.unknown()).optional(),
  sortJson: z.record(z.string(), z.unknown()).nullable().optional(),
  isShared: z.boolean().optional(),
});

const recordRecentItemSchema = z.object({
  entityType: entityTypeSchema,
  entityId: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  subtitle: z.string().trim().max(240).optional(),
  href: z.string().trim().min(1).max(240),
  keywords: z.array(z.string().trim().min(1).max(80)).optional(),
  updatedAt: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const createFeatureFlagSchema = z.object({
  key: z.string().trim().min(1).max(120),
  description: z.string().trim().max(240).optional(),
  enabled: z.boolean(),
  scopeType: z.enum(featureFlagScopeTypes).optional(),
  scopeKey: z.string().trim().max(120).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const evaluateFeatureFlagSchema = z.object({
  key: z.string().trim().min(1).max(120),
  userId: z.string().uuid().optional(),
  planKey: z.string().trim().max(120).optional(),
  isBeta: z.boolean().optional(),
  isInternal: z.boolean().optional(),
});

export const intelligenceController = {
  async search(req: Request, res: Response) {
    const query = searchQuerySchema.parse(req.query);
    res.json(
      await searchService.search(requireOrgId(req), {
        query: query.q,
        limit: query.limit,
        entityTypes: query.entityTypes,
      })
    );
  },

  async listActivity(req: Request, res: Response) {
    const query = activityQuerySchema.parse(req.query);
    if (query.entityType === "task") {
      requirePermissions(req, ["crm.read"]);
    }
    res.json(await activityService.list({ orgId: requireOrgId(req), ...query }));
  },

  async createActivity(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const body = createActivitySchema.parse(req.body);
    res.status(201).json(
      await activityService.record({
        orgId: requireOrgId(req),
        entityType: body.entityType,
        entityId: body.entityId,
        eventType: body.eventType,
        title: body.title,
        description: body.description,
        actorUserId: auth.userId,
        metadata: body.metadata,
        occurredAt: body.occurredAt ? new Date(body.occurredAt) : undefined,
      })
    );
  },

  async listNotifications(req: Request, res: Response) {
    const query = notificationQuerySchema.parse(req.query);
    res.json(await notificationService.list({ orgId: requireOrgId(req), ...query }));
  },

  async createNotification(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const body = createNotificationSchema.parse(req.body);
    res.status(201).json(
      await notificationService.create({
        orgId: requireOrgId(req),
        entityType: body.entityType,
        entityId: body.entityId,
        category: body.category,
        title: body.title,
        body: body.body,
        priority: body.priority,
        actionUrl: body.actionUrl,
        activityEventId: body.activityEventId,
        createdByUserId: auth.userId,
      })
    );
  },

  async updateNotification(req: Request, res: Response) {
    const body = updateNotificationSchema.parse(req.body);
    res.json(await notificationService.update(req.params.id, { orgId: requireOrgId(req), status: body.status }));
  },

  async listAttachments(req: Request, res: Response) {
    const query = referenceQuerySchema.parse(req.query);
    res.json(await attachmentService.list(requireOrgId(req), query));
  },

  async createAttachment(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const body = createAttachmentSchema.parse(req.body);
    res.status(201).json(
      await attachmentService.create({
        orgId: requireOrgId(req),
        ...body,
        uploadedByUserId: auth.userId,
      })
    );
  },

  async removeAttachment(req: Request, res: Response) {
    await attachmentService.remove(requireOrgId(req), req.params.id);
    res.status(204).send();
  },

  async listComments(req: Request, res: Response) {
    const query = referenceQuerySchema.parse(req.query);
    res.json(await commentsService.list(requireOrgId(req), query));
  },

  async createComment(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const body = createCommentSchema.parse(req.body);
    res.status(201).json(
      await commentsService.create({
        orgId: requireOrgId(req),
        entityType: body.entityType,
        entityId: body.entityId,
        body: body.body,
        parentCommentId: body.parentCommentId,
        mentions: body.mentions,
        authorUserId: auth.userId,
      })
    );
  },

  async updateComment(req: Request, res: Response) {
    const body = updateCommentSchema.parse(req.body);
    res.json(
      await commentsService.update(req.params.id, {
        orgId: requireOrgId(req),
        body: body.body,
        resolvedAt: body.resolvedAt === undefined ? undefined : body.resolvedAt === null ? null : new Date(body.resolvedAt),
        reactions: body.reactions,
      })
    );
  },

  async listTags(req: Request, res: Response) {
    res.json(await tagsService.listTags(requireOrgId(req)));
  },

  async createTag(req: Request, res: Response) {
    const body = createTagSchema.parse(req.body);
    res.status(201).json(await tagsService.createTag({ orgId: requireOrgId(req), ...body }));
  },

  async listTagAssignments(req: Request, res: Response) {
    const query = referenceQuerySchema.parse(req.query);
    res.json(await tagsService.listAssignments(requireOrgId(req), query));
  },

  async assignTag(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const body = assignTagSchema.parse(req.body);
    res.status(201).json(
      await tagsService.assign({
        orgId: requireOrgId(req),
        entityType: body.entityType,
        entityId: body.entityId,
        tagId: body.tagId,
        assignedByUserId: auth.userId,
      })
    );
  },

  async removeTagAssignment(req: Request, res: Response) {
    await tagsService.removeAssignment(requireOrgId(req), req.params.id);
    res.status(204).send();
  },

  async listSavedViews(req: Request, res: Response) {
    const entityType = req.query.entityType ? entityTypeSchema.parse(req.query.entityType) : undefined;
    res.json(await savedViewsService.list(requireOrgId(req), entityType));
  },

  async createSavedView(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const body = createSavedViewSchema.parse(req.body);
    res.status(201).json(await savedViewsService.create({ orgId: requireOrgId(req), ...body, createdByUserId: auth.userId }));
  },

  async updateSavedView(req: Request, res: Response) {
    const body = updateSavedViewSchema.parse(req.body);
    res.json(await savedViewsService.update(req.params.id, { orgId: requireOrgId(req), ...body }));
  },

  async removeSavedView(req: Request, res: Response) {
    await savedViewsService.remove(requireOrgId(req), req.params.id);
    res.status(204).send();
  },

  async listRecentItems(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const limit = req.query.limit ? z.coerce.number().int().min(1).max(25).parse(req.query.limit) : undefined;
    res.json(await recentItemsService.list(requireOrgId(req), auth.userId, limit));
  },

  async recordRecentItem(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const body = recordRecentItemSchema.parse(req.body);
    res.status(201).json(await recentItemsService.record({ orgId: requireOrgId(req), userId: auth.userId, ...body }));
  },

  async listFeatureFlags(req: Request, res: Response) {
    requireOrgAdmin(req);
    res.json(await featureFlagsService.list(requireOrgId(req)));
  },

  async upsertFeatureFlag(req: Request, res: Response) {
    requireOrgAdmin(req);
    const body = createFeatureFlagSchema.parse(req.body);
    res.status(201).json(await featureFlagsService.upsert({ orgId: requireOrgId(req), ...body }));
  },

  async evaluateFeatureFlag(req: Request, res: Response) {
    requireOrgAdmin(req);
    const body = evaluateFeatureFlagSchema.parse(req.body);
    res.json(await featureFlagsService.evaluate(requireOrgId(req), body.key, { orgId: requireOrgId(req), ...body }));
  },
};
