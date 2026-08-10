import { Prisma } from "@prisma/client";
import { ApiError } from "../../backend/middleware/errorHandler";
import { prisma } from "../../db/client";
import {
  ActivityEventDTO,
  ActivityFilters,
  AssignTagInput,
  AttachmentDTO,
  CommentDTO,
  CreateActivityEventInput,
  CreateAttachmentInput,
  CreateCommentInput,
  CreateNotificationInput,
  CreateSavedViewInput,
  CreateTagInput,
  EntityReference,
  FeatureFlagDTO,
  FeatureFlagEvaluationContext,
  FeatureFlagEvaluationResult,
  IntelligenceEntityType,
  NotificationDTO,
  NotificationFilters,
  NotificationStatus,
  RecentItemDTO,
  RecordRecentItemInput,
  SavedViewDTO,
  SearchDocument,
  SearchQueryInput,
  SearchResult,
  SearchSource,
  TagAssignmentDTO,
  TagDTO,
  UpdateCommentInput,
  UpdateNotificationInput,
  UpdateSavedViewInput,
  UpsertFeatureFlagInput,
} from "./types";
import { normalizeActivityEventType } from "../../domain";

const DEFAULT_LIMIT = 8;
const DEFAULT_ACTIVITY_LIMIT = 40;
const DEFAULT_NOTIFICATION_LIMIT = 40;
const DEFAULT_RECENT_LIMIT = 12;
const DEFAULT_VIEW_LIMIT = 25;

function clampLimit(limit: number | undefined, fallback: number, max: number): number {
  if (!limit) return fallback;
  return Math.max(1, Math.min(limit, max));
}

function toJson(value: Record<string, unknown> | string[] | null | undefined): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function existingJson(value: Prisma.JsonValue | null): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function toRecord(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function toStringArray(value: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);
}

function isSubsequence(query: string, candidate: string): boolean {
  let queryIndex = 0;
  for (let i = 0; i < candidate.length && queryIndex < query.length; i += 1) {
    if (candidate[i] === query[queryIndex]) {
      queryIndex += 1;
    }
  }
  return queryIndex === query.length;
}

export function scoreSearchDocument(query: string, document: SearchDocument): SearchResult {
  const normalizedQuery = query.trim().toLowerCase();
  const haystack = [document.title, document.subtitle ?? "", ...(document.keywords ?? [])].join(" ").toLowerCase();
  const title = document.title.toLowerCase();
  const tokens = tokenize(haystack);

  let score = 0;
  let matchReason: SearchResult["matchReason"] = "fuzzy";

  if (title === normalizedQuery || tokens.includes(normalizedQuery)) {
    score = 120;
    matchReason = "exact";
  } else if (title.startsWith(normalizedQuery) || tokens.some((token) => token.startsWith(normalizedQuery))) {
    score = 95;
    matchReason = "prefix";
  } else if (haystack.includes(normalizedQuery)) {
    score = 72;
    matchReason = "contains";
  } else if (isSubsequence(normalizedQuery, haystack.replace(/\s+/g, ""))) {
    score = 50;
    matchReason = "fuzzy";
  }

  if (document.updatedAt) {
    const ageHours = Math.max(0, (Date.now() - new Date(document.updatedAt).getTime()) / 3_600_000);
    score += Math.max(0, 12 - ageHours / 24);
  }

  return { ...document, score, matchReason, source: "federated" };
}

const customerSearchSource: SearchSource = {
  key: "customers",
  entityTypes: ["customer"],
  async search(orgId, input) {
    const rows = await prisma.customer.findMany({
      where: {
        orgId,
        deletedAt: null,
        OR: input.query
          ? [
              { name: { contains: input.query, mode: "insensitive" } },
              { email: { contains: input.query, mode: "insensitive" } },
              { phone: { contains: input.query, mode: "insensitive" } },
            ]
          : undefined,
      },
      orderBy: { updatedAt: "desc" },
      take: clampLimit(input.limit, DEFAULT_LIMIT, 20),
    });

    return rows.map((row) => ({
      entityType: "customer" as const,
      entityId: row.id,
      title: row.name,
      subtitle: [row.email, row.phone].filter(Boolean).join(" • ") || row.address,
      href: `/customers/${row.id}`,
      keywords: [row.name, row.email ?? "", row.phone ?? "", row.address ?? ""],
      updatedAt: row.updatedAt.toISOString(),
    }));
  },
};

const projectSearchSource: SearchSource = {
  key: "projects",
  entityTypes: ["project"],
  async search(orgId, input) {
    const rows = await prisma.project.findMany({
      where: {
        orgId,
        OR: input.query
          ? [
              { name: { contains: input.query, mode: "insensitive" } },
              { jobType: { contains: input.query, mode: "insensitive" } },
              { siteAddress: { contains: input.query, mode: "insensitive" } },
            ]
          : undefined,
      },
      include: { customer: true },
      orderBy: { updatedAt: "desc" },
      take: clampLimit(input.limit, DEFAULT_LIMIT, 20),
    });

    return rows.map((row) => ({
      entityType: "project" as const,
      entityId: row.id,
      title: row.name,
      subtitle: [row.customer?.name, row.jobType, row.siteAddress].filter(Boolean).join(" • "),
      href: `/projects/${row.id}`,
      keywords: [row.name, row.customer?.name ?? "", row.jobType ?? "", row.siteAddress ?? "", row.status],
      updatedAt: row.updatedAt.toISOString(),
    }));
  },
};

const estimateSearchSource: SearchSource = {
  key: "estimates",
  entityTypes: ["estimate"],
  async search(orgId, input) {
    const rows = await prisma.estimate.findMany({
      where: {
        orgId,
        OR: input.query
          ? [
              { project: { name: { contains: input.query, mode: "insensitive" } } },
              { status: { contains: input.query, mode: "insensitive" } },
            ]
          : undefined,
      },
      include: { project: true },
      orderBy: { updatedAt: "desc" },
      take: clampLimit(input.limit, DEFAULT_LIMIT, 20),
    });

    return rows.map((row) => ({
      entityType: "estimate" as const,
      entityId: row.id,
      title: `Estimate v${row.version} • ${row.project.name}`,
      subtitle: [row.status, `$${Number(row.totalPrice).toFixed(2)}`].join(" • "),
      href: `/projects/${row.projectId}/estimates/${row.id}`,
      keywords: [row.project.name, row.status, `estimate ${row.version}`],
      updatedAt: row.updatedAt.toISOString(),
    }));
  },
};

const invoiceSearchSource: SearchSource = {
  key: "invoices",
  entityTypes: ["invoice"],
  async search(orgId, input) {
    const rows = await prisma.invoice.findMany({
      where: {
        project: { orgId },
        OR: input.query
          ? [
              { status: { contains: input.query, mode: "insensitive" } },
              { type: { contains: input.query, mode: "insensitive" } },
              { project: { name: { contains: input.query, mode: "insensitive" } } },
            ]
          : undefined,
      },
      include: { project: true },
      orderBy: { updatedAt: "desc" },
      take: clampLimit(input.limit, DEFAULT_LIMIT, 20),
    });

    return rows.map((row) => ({
      entityType: "invoice" as const,
      entityId: row.id,
      title: `Invoice #${row.invoiceNumber} • ${row.project.name}`,
      subtitle: [row.status, row.type, `$${Number(row.amount).toFixed(2)}`].filter(Boolean).join(" • "),
      href: `/projects/${row.projectId}/invoices/${row.id}`,
      keywords: [row.project.name, row.status, row.type, `invoice ${row.invoiceNumber}`],
      updatedAt: row.updatedAt.toISOString(),
    }));
  },
};

const documentSearchSource: SearchSource = {
  key: "documents",
  entityTypes: ["document", "photo"],
  async search(orgId, input) {
    const rows = await prisma.projectFile.findMany({
      where: {
        project: { orgId },
        OR: input.query
          ? [
              { fileName: { contains: input.query, mode: "insensitive" } },
              { fileType: { contains: input.query, mode: "insensitive" } },
              { project: { name: { contains: input.query, mode: "insensitive" } } },
            ]
          : undefined,
      },
      include: { project: true },
      orderBy: { createdAt: "desc" },
      take: clampLimit(input.limit, DEFAULT_LIMIT, 20),
    });

    return rows.map((row) => ({
      entityType: row.fileType.startsWith("image") ? ("photo" as const) : ("document" as const),
      entityId: row.id,
      title: row.fileName,
      subtitle: [row.project.name, row.fileType].filter(Boolean).join(" • "),
      href: `/projects/${row.projectId}`,
      keywords: [row.fileName, row.fileType, row.project.name],
      updatedAt: row.createdAt.toISOString(),
    }));
  },
};

export class GlobalSearchService {
  private readonly sources: SearchSource[];

  constructor(sources: SearchSource[] = [customerSearchSource, projectSearchSource, estimateSearchSource, invoiceSearchSource, documentSearchSource]) {
    this.sources = sources;
  }

  async search(orgId: string, input: SearchQueryInput): Promise<SearchResult[]> {
    const query = input.query.trim();
    if (!query) return [];

    const matchingSources = input.entityTypes?.length
      ? this.sources.filter((source) => source.entityTypes.some((entityType) => input.entityTypes?.includes(entityType)))
      : this.sources;

    const docs = await Promise.all(matchingSources.map(async (source) => ({ source: source.key, docs: await source.search(orgId, input) })));
    return docs
      .flatMap(({ source, docs: items }) => items.map((item) => ({ ...scoreSearchDocument(query, item), source })))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, clampLimit(input.limit, DEFAULT_LIMIT, 50));
  }
}

export class ActivityTimelineService {
  constructor(private readonly db: typeof prisma = prisma) {}

  async list(filters: ActivityFilters): Promise<ActivityEventDTO[]> {
    const rows = await this.db.activityEvent.findMany({
      where: {
        orgId: filters.orgId,
        entityType: filters.entityType,
        entityId: filters.entityId,
        eventType: filters.eventType,
      },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: clampLimit(filters.limit, DEFAULT_ACTIVITY_LIMIT, 100),
    });

    return rows.map(toActivityEventDTO);
  }

  async record(input: CreateActivityEventInput): Promise<ActivityEventDTO> {
    const row = await this.db.activityEvent.create({
      data: {
        orgId: input.orgId,
        entityType: input.entityType,
        entityId: input.entityId,
        eventType: normalizeActivityEventType(input.eventType),
        title: input.title,
        description: input.description,
        actorUserId: input.actorUserId,
        metadataJson: toJson(input.metadata),
        occurredAt: input.occurredAt ?? new Date(),
      },
    });

    return toActivityEventDTO(row);
  }
}

export class NotificationCenterService {
  constructor(private readonly activityService = new ActivityTimelineService()) {}

  async list(filters: NotificationFilters): Promise<NotificationDTO[]> {
    const rows = await prisma.notification.findMany({
      where: {
        orgId: filters.orgId,
        category: filters.category,
        priority: filters.priority,
        ...(filters.unreadOnly
          ? { archivedAt: null, readAt: null }
          : filters.status === "archived" || filters.includeArchived
            ? undefined
            : { archivedAt: null }),
      },
      orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
      take: clampLimit(filters.limit, DEFAULT_NOTIFICATION_LIMIT, 100),
    });

    const filteredRows =
      filters.status && filters.status !== "archived"
        ? rows.filter((row) => deriveNotificationStatus(row.readAt, row.archivedAt) === filters.status)
        : rows;

    return filteredRows.map(toNotificationDTO);
  }

  async create(input: CreateNotificationInput): Promise<NotificationDTO> {
    const row = await prisma.notification.create({
      data: {
        orgId: input.orgId,
        entityType: input.entityType,
        entityId: input.entityId,
        category: input.category,
        title: input.title,
        body: input.body,
        priority: input.priority ?? "medium",
        actionUrl: input.actionUrl,
        activityEventId: input.activityEventId,
        createdByUserId: input.createdByUserId,
      },
    });

    await this.activityService.record({
      orgId: input.orgId,
      entityType: input.entityType,
      entityId: input.entityId,
      eventType: `notification.${input.category}`,
      title: input.title,
      description: input.body,
      actorUserId: input.createdByUserId,
      metadata: { priority: row.priority, notificationId: row.id },
    });

    return toNotificationDTO(row);
  }

  async update(id: string, input: UpdateNotificationInput): Promise<NotificationDTO> {
    const existing = await prisma.notification.findFirst({ where: { id, orgId: input.orgId } });
    if (!existing) throw new ApiError(404, `Notification ${id} not found`);

    const nextReadAt =
      input.status === "read"
        ? input.readAt ?? existing.readAt ?? new Date()
        : input.status === "unread"
          ? null
          : input.readAt !== undefined
            ? input.readAt
            : existing.readAt;

    const nextArchivedAt =
      input.status === "archived"
        ? input.archivedAt ?? existing.archivedAt ?? new Date()
        : input.status
          ? null
          : input.archivedAt !== undefined
            ? input.archivedAt
            : existing.archivedAt;

    const row = await prisma.notification.update({
      where: { id },
      data: {
        readAt: nextReadAt,
        archivedAt: nextArchivedAt,
      },
    });

    return toNotificationDTO(row);
  }
}

export class AttachmentService {
  constructor(private readonly activityService = new ActivityTimelineService()) {}

  async list(orgId: string, reference: EntityReference): Promise<AttachmentDTO[]> {
    const rows = await prisma.attachment.findMany({
      where: { orgId, entityType: reference.entityType, entityId: reference.entityId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toAttachmentDTO);
  }

  async create(input: CreateAttachmentInput): Promise<AttachmentDTO> {
    const row = await prisma.attachment.create({
      data: {
        orgId: input.orgId,
        entityType: input.entityType,
        entityId: input.entityId,
        kind: input.kind,
        fileName: input.fileName,
        mimeType: input.mimeType,
        fileUrl: input.fileUrl,
        previewUrl: input.previewUrl,
        storagePath: input.storagePath,
        sizeBytes: input.sizeBytes,
        durationSeconds: input.durationSeconds,
        metadataJson: toJson(input.metadata),
        uploadedByUserId: input.uploadedByUserId,
      },
    });

    await this.activityService.record({
      orgId: input.orgId,
      entityType: input.entityType,
      entityId: input.entityId,
      eventType: "attachment.uploaded",
      title: `Attachment uploaded: ${input.fileName}`,
      actorUserId: input.uploadedByUserId,
      metadata: { attachmentId: row.id, kind: row.kind },
    });

    return toAttachmentDTO(row);
  }

  async remove(orgId: string, id: string): Promise<void> {
    const existing = await prisma.attachment.findFirst({ where: { id, orgId } });
    if (!existing) throw new ApiError(404, `Attachment ${id} not found`);
    await prisma.attachment.delete({ where: { id } });
  }
}

export class UniversalCommentsService {
  constructor(private readonly activityService = new ActivityTimelineService()) {}

  async list(orgId: string, reference: EntityReference): Promise<CommentDTO[]> {
    const rows = await prisma.comment.findMany({
      where: { orgId, entityType: reference.entityType, entityId: reference.entityId },
      orderBy: [{ createdAt: "asc" }],
    });
    return rows.map(toCommentDTO);
  }

  async create(input: CreateCommentInput): Promise<CommentDTO> {
    const row = await prisma.comment.create({
      data: {
        orgId: input.orgId,
        entityType: input.entityType,
        entityId: input.entityId,
        body: input.body,
        authorUserId: input.authorUserId,
        parentCommentId: input.parentCommentId,
        mentionsJson: toJson(input.mentions ?? []),
        reactionsJson: toJson({}),
      },
    });

    await this.activityService.record({
      orgId: input.orgId,
      entityType: input.entityType,
      entityId: input.entityId,
      eventType: "comment.created",
      title: "Comment added",
      description: input.body.slice(0, 160),
      actorUserId: input.authorUserId,
      metadata: { commentId: row.id, hasMentions: (input.mentions ?? []).length > 0 },
    });

    return toCommentDTO(row);
  }

  async update(id: string, input: UpdateCommentInput): Promise<CommentDTO> {
    const existing = await prisma.comment.findFirst({ where: { id, orgId: input.orgId } });
    if (!existing) throw new ApiError(404, `Comment ${id} not found`);

    const row = await prisma.comment.update({
      where: { id },
      data: {
        body: input.body ?? existing.body,
        resolvedAt: input.resolvedAt !== undefined ? input.resolvedAt : existing.resolvedAt,
        reactionsJson: input.reactions !== undefined ? toJson(input.reactions) : existingJson(existing.reactionsJson),
      },
    });

    return toCommentDTO(row);
  }
}

export class TagsService {
  async listTags(orgId: string): Promise<TagDTO[]> {
    const rows = await prisma.tag.findMany({ where: { orgId }, orderBy: { name: "asc" } });
    return rows.map(toTagDTO);
  }

  async createTag(input: CreateTagInput): Promise<TagDTO> {
    const slug = slugify(input.name);
    const row = await prisma.tag.upsert({
      where: { orgId_slug: { orgId: input.orgId, slug } },
      update: {
        color: input.color ?? undefined,
        description: input.description ?? undefined,
      },
      create: {
        orgId: input.orgId,
        name: input.name,
        slug,
        color: input.color,
        description: input.description,
      },
    });

    return toTagDTO(row);
  }

  async listAssignments(orgId: string, reference: EntityReference): Promise<TagAssignmentDTO[]> {
    const rows = await prisma.tagAssignment.findMany({
      where: { orgId, entityType: reference.entityType, entityId: reference.entityId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toTagAssignmentDTO);
  }

  async assign(input: AssignTagInput): Promise<TagAssignmentDTO> {
    const tag = await prisma.tag.findFirst({ where: { id: input.tagId, orgId: input.orgId } });
    if (!tag) throw new ApiError(404, `Tag ${input.tagId} not found`);

    const row = await prisma.tagAssignment.upsert({
      where: {
        orgId_tagId_entityType_entityId: {
          orgId: input.orgId,
          tagId: input.tagId,
          entityType: input.entityType,
          entityId: input.entityId,
        },
      },
      update: { assignedByUserId: input.assignedByUserId ?? undefined },
      create: {
        orgId: input.orgId,
        tagId: input.tagId,
        entityType: input.entityType,
        entityId: input.entityId,
        assignedByUserId: input.assignedByUserId,
      },
    });

    return toTagAssignmentDTO(row);
  }

  async removeAssignment(orgId: string, id: string): Promise<void> {
    const existing = await prisma.tagAssignment.findFirst({ where: { id, orgId } });
    if (!existing) throw new ApiError(404, `Tag assignment ${id} not found`);
    await prisma.tagAssignment.delete({ where: { id } });
  }
}

export class SavedViewsService {
  async list(orgId: string, entityType?: IntelligenceEntityType): Promise<SavedViewDTO[]> {
    const rows = await prisma.savedView.findMany({
      where: { orgId, entityType },
      orderBy: [{ isShared: "desc" }, { updatedAt: "desc" }],
      take: DEFAULT_VIEW_LIMIT,
    });
    return rows.map(toSavedViewDTO);
  }

  async create(input: CreateSavedViewInput): Promise<SavedViewDTO> {
    const row = await prisma.savedView.create({
      data: {
        orgId: input.orgId,
        entityType: input.entityType,
        name: input.name,
        description: input.description,
        filterJson: input.filterJson as Prisma.InputJsonValue,
        sortJson: toJson(input.sortJson),
        isShared: input.isShared ?? false,
        createdByUserId: input.createdByUserId,
      },
    });
    return toSavedViewDTO(row);
  }

  async update(id: string, input: UpdateSavedViewInput): Promise<SavedViewDTO> {
    const existing = await prisma.savedView.findFirst({ where: { id, orgId: input.orgId } });
    if (!existing) throw new ApiError(404, `Saved view ${id} not found`);

    const row = await prisma.savedView.update({
      where: { id },
      data: {
        name: input.name ?? existing.name,
        description: input.description !== undefined ? input.description : existing.description,
        filterJson: input.filterJson !== undefined ? (input.filterJson as Prisma.InputJsonValue) : existingJson(existing.filterJson),
        sortJson: input.sortJson !== undefined ? toJson(input.sortJson) : existingJson(existing.sortJson),
        isShared: input.isShared ?? existing.isShared,
      },
    });
    return toSavedViewDTO(row);
  }

  async remove(orgId: string, id: string): Promise<void> {
    const existing = await prisma.savedView.findFirst({ where: { id, orgId } });
    if (!existing) throw new ApiError(404, `Saved view ${id} not found`);
    await prisma.savedView.delete({ where: { id } });
  }
}

export class RecentlyViewedService {
  async list(orgId: string, userId: string, limit = DEFAULT_RECENT_LIMIT): Promise<RecentItemDTO[]> {
    const rows = await prisma.recentItem.findMany({
      where: { orgId, userId },
      orderBy: { lastViewedAt: "desc" },
      take: clampLimit(limit, DEFAULT_RECENT_LIMIT, 25),
    });
    return rows.map(toRecentItemDTO);
  }

  async record(input: RecordRecentItemInput): Promise<RecentItemDTO> {
    const row = await prisma.recentItem.upsert({
      where: {
        orgId_userId_entityType_entityId: {
          orgId: input.orgId,
          userId: input.userId,
          entityType: input.entityType,
          entityId: input.entityId,
        },
      },
      update: {
        title: input.title,
        subtitle: input.subtitle,
        href: input.href,
        keywordsJson: toJson(input.keywords ?? []),
        metadataJson: toJson(input.metadata ?? {}),
        updatedAtIso: input.updatedAt,
        lastViewedAt: new Date(),
        viewCount: { increment: 1 },
      },
      create: {
        orgId: input.orgId,
        userId: input.userId,
        entityType: input.entityType,
        entityId: input.entityId,
        title: input.title,
        subtitle: input.subtitle,
        href: input.href,
        keywordsJson: toJson(input.keywords ?? []),
        metadataJson: toJson(input.metadata ?? {}),
        updatedAtIso: input.updatedAt,
      },
    });
    return toRecentItemDTO(row);
  }
}

export class FeatureFlagsService {
  async list(orgId: string): Promise<FeatureFlagDTO[]> {
    const rows = await prisma.featureFlag.findMany({
      where: { orgId },
      orderBy: [{ key: "asc" }, { scopeType: "asc" }, { createdAt: "asc" }],
    });
    return rows.map(toFeatureFlagDTO);
  }

  async upsert(input: UpsertFeatureFlagInput): Promise<FeatureFlagDTO> {
    const scopeType = input.scopeType ?? "org";
    const existing = await prisma.featureFlag.findFirst({
      where: {
        orgId: input.orgId,
        key: input.key,
        scopeType,
        scopeKey: input.scopeKey ?? null,
      },
    });
    const row = existing
      ? await prisma.featureFlag.update({
          where: { id: existing.id },
          data: {
            description: input.description,
            enabled: input.enabled,
            metadataJson: toJson(input.metadata ?? {}),
          },
        })
      : await prisma.featureFlag.create({
          data: {
            orgId: input.orgId,
            key: input.key,
            description: input.description,
            enabled: input.enabled,
            scopeType,
            scopeKey: input.scopeKey ?? null,
            metadataJson: toJson(input.metadata ?? {}),
          },
        });
    return toFeatureFlagDTO(row);
  }

  async evaluate(orgId: string, key: string, context: FeatureFlagEvaluationContext): Promise<FeatureFlagEvaluationResult> {
    const flags = await prisma.featureFlag.findMany({ where: { orgId, key } });

    const scopes: Array<{ scopeType: FeatureFlagDTO["scopeType"]; scopeKey: string | null; active: boolean }> = [
      { scopeType: "internal", scopeKey: "true", active: Boolean(context.isInternal) },
      { scopeType: "user", scopeKey: context.userId ?? null, active: Boolean(context.userId) },
      { scopeType: "org", scopeKey: orgId, active: true },
      { scopeType: "plan", scopeKey: context.planKey ?? null, active: Boolean(context.planKey) },
      { scopeType: "beta", scopeKey: "true", active: Boolean(context.isBeta) },
      { scopeType: "global", scopeKey: null, active: true },
    ];

    for (const scope of scopes) {
      if (!scope.active) continue;
      const match = flags.find((flag) => flag.scopeType === scope.scopeType && (flag.scopeType === "org" ? flag.scopeKey === orgId || flag.scopeKey === null : flag.scopeKey === scope.scopeKey));
      if (match) {
        return {
          key,
          enabled: match.enabled,
          matchedScope: match.scopeType as FeatureFlagDTO["scopeType"],
          matchedFlagId: match.id,
        };
      }
    }

    return {
      key,
      enabled: false,
      matchedScope: "default",
      matchedFlagId: null,
    };
  }
}

function deriveNotificationStatus(readAt: Date | null, archivedAt: Date | null): NotificationStatus {
  if (archivedAt) return "archived";
  if (readAt) return "read";
  return "unread";
}

function toNotificationDTO(row: {
  id: string;
  entityType: string;
  entityId: string;
  category: string;
  title: string;
  body: string;
  priority: string;
  actionUrl: string | null;
  activityEventId: string | null;
  createdByUserId: string | null;
  createdAt: Date;
  readAt: Date | null;
  archivedAt: Date | null;
}): NotificationDTO {
  return {
    id: row.id,
    entityType: row.entityType as NotificationDTO["entityType"],
    entityId: row.entityId,
    category: row.category as NotificationDTO["category"],
    title: row.title,
    body: row.body,
    priority: row.priority as NotificationDTO["priority"],
    status: deriveNotificationStatus(row.readAt, row.archivedAt),
    actionUrl: row.actionUrl,
    activityEventId: row.activityEventId,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt?.toISOString() ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
  };
}

function toActivityEventDTO(row: {
  id: string;
  entityType: string;
  entityId: string;
  eventType: string;
  title: string;
  description: string | null;
  actorUserId: string | null;
  metadataJson: Prisma.JsonValue | null;
  occurredAt: Date;
  createdAt: Date;
}): ActivityEventDTO {
  return {
    id: row.id,
    entityType: row.entityType as ActivityEventDTO["entityType"],
    entityId: row.entityId,
    eventType: row.eventType,
    title: row.title,
    description: row.description,
    actorUserId: row.actorUserId,
    metadata: toRecord(row.metadataJson),
    occurredAt: row.occurredAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

function toAttachmentDTO(row: {
  id: string;
  entityType: string;
  entityId: string;
  kind: string;
  fileName: string;
  mimeType: string | null;
  fileUrl: string;
  previewUrl: string | null;
  storagePath: string | null;
  sizeBytes: number | null;
  durationSeconds: number | null;
  metadataJson: Prisma.JsonValue | null;
  uploadedByUserId: string | null;
  createdAt: Date;
}): AttachmentDTO {
  return {
    id: row.id,
    entityType: row.entityType as AttachmentDTO["entityType"],
    entityId: row.entityId,
    kind: row.kind as AttachmentDTO["kind"],
    fileName: row.fileName,
    mimeType: row.mimeType,
    fileUrl: row.fileUrl,
    previewUrl: row.previewUrl,
    storagePath: row.storagePath,
    sizeBytes: row.sizeBytes,
    durationSeconds: row.durationSeconds,
    metadata: toRecord(row.metadataJson),
    uploadedByUserId: row.uploadedByUserId,
    createdAt: row.createdAt.toISOString(),
  };
}

function toCommentDTO(row: {
  id: string;
  entityType: string;
  entityId: string;
  parentCommentId: string | null;
  body: string;
  authorUserId: string | null;
  mentionsJson: Prisma.JsonValue | null;
  reactionsJson: Prisma.JsonValue | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): CommentDTO {
  return {
    id: row.id,
    entityType: row.entityType as CommentDTO["entityType"],
    entityId: row.entityId,
    parentCommentId: row.parentCommentId,
    body: row.body,
    authorUserId: row.authorUserId,
    mentions: toStringArray(row.mentionsJson),
    reactions: toRecord(row.reactionsJson) as Record<string, string[]>,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toTagDTO(row: { id: string; orgId: string; name: string; slug: string; color: string | null; description: string | null; createdAt: Date }): TagDTO {
  return {
    id: row.id,
    orgId: row.orgId,
    name: row.name,
    slug: row.slug,
    color: row.color,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
  };
}

function toTagAssignmentDTO(row: {
  id: string;
  entityType: string;
  entityId: string;
  tagId: string;
  assignedByUserId: string | null;
  createdAt: Date;
}): TagAssignmentDTO {
  return {
    id: row.id,
    entityType: row.entityType as TagAssignmentDTO["entityType"],
    entityId: row.entityId,
    tagId: row.tagId,
    assignedByUserId: row.assignedByUserId,
    createdAt: row.createdAt.toISOString(),
  };
}

function toSavedViewDTO(row: {
  id: string;
  orgId: string;
  entityType: string;
  name: string;
  description: string | null;
  filterJson: Prisma.JsonValue;
  sortJson: Prisma.JsonValue | null;
  isShared: boolean;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SavedViewDTO {
  return {
    id: row.id,
    orgId: row.orgId,
    entityType: row.entityType as SavedViewDTO["entityType"],
    name: row.name,
    description: row.description,
    filterJson: (toRecord(row.filterJson) ?? {}) as Record<string, unknown>,
    sortJson: toRecord(row.sortJson),
    isShared: row.isShared,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toRecentItemDTO(row: {
  id: string;
  userId: string;
  entityType: string;
  entityId: string;
  title: string;
  subtitle: string | null;
  href: string;
  keywordsJson: Prisma.JsonValue | null;
  metadataJson: Prisma.JsonValue | null;
  updatedAtIso: string | null;
  lastViewedAt: Date;
  viewCount: number;
}): RecentItemDTO {
  return {
    id: row.id,
    userId: row.userId,
    entityType: row.entityType as RecentItemDTO["entityType"],
    entityId: row.entityId,
    title: row.title,
    subtitle: row.subtitle,
    href: row.href,
    keywords: toStringArray(row.keywordsJson),
    metadata: toRecord(row.metadataJson) ?? undefined,
    updatedAt: row.updatedAtIso,
    viewedAt: row.lastViewedAt.toISOString(),
    viewCount: row.viewCount,
  };
}

function toFeatureFlagDTO(row: {
  id: string;
  orgId: string;
  key: string;
  description: string | null;
  enabled: boolean;
  scopeType: string;
  scopeKey: string | null;
  metadataJson: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}): FeatureFlagDTO {
  return {
    id: row.id,
    orgId: row.orgId,
    key: row.key,
    description: row.description,
    enabled: row.enabled,
    scopeType: row.scopeType as FeatureFlagDTO["scopeType"],
    scopeKey: row.scopeKey,
    metadata: toRecord(row.metadataJson),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
