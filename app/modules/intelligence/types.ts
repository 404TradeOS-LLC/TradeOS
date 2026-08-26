export const intelligenceEntityTypes = [
  "customer",
  "job",
  "project",
  "document",
  "photo",
  "estimate",
  "invoice",
  "contract",
  "material",
  "vendor",
  "note",
  "ai_knowledge",
  "task",
  "calendar_event",
  "settings",
] as const;

export type IntelligenceEntityType = (typeof intelligenceEntityTypes)[number];

export interface EntityReference {
  entityType: IntelligenceEntityType;
  entityId: string;
}

export interface SearchDocument extends EntityReference {
  title: string;
  subtitle?: string | null;
  href: string;
  keywords?: string[];
  updatedAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface SearchQueryInput {
  query: string;
  limit?: number;
  entityTypes?: IntelligenceEntityType[];
}

export interface SearchResult extends SearchDocument {
  score: number;
  matchReason: "exact" | "prefix" | "contains" | "fuzzy";
  source: string;
}

export interface SearchSource {
  key: string;
  entityTypes: IntelligenceEntityType[];
  search(orgId: string, input: SearchQueryInput): Promise<SearchDocument[]>;
}

export const notificationCategories = [
  "estimate_accepted",
  "invoice_overdue",
  "weather_alert",
  "schedule_conflict",
  "customer_message",
  "crew_update",
  "ai_suggestion",
  "document_signature",
  "material_delivery",
] as const;

export type NotificationCategory = (typeof notificationCategories)[number];

export const notificationPriorities = ["low", "medium", "high", "critical"] as const;
export type NotificationPriority = (typeof notificationPriorities)[number];

export const notificationStatuses = ["unread", "read", "archived"] as const;
export type NotificationStatus = (typeof notificationStatuses)[number];

export interface NotificationDTO extends EntityReference {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  priority: NotificationPriority;
  status: NotificationStatus;
  actionUrl: string | null;
  activityEventId: string | null;
  createdByUserId: string | null;
  createdAt: string;
  readAt: string | null;
  archivedAt: string | null;
}

export interface CreateNotificationInput extends EntityReference {
  orgId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  priority?: NotificationPriority;
  actionUrl?: string;
  activityEventId?: string;
  createdByUserId?: string;
}

export interface UpdateNotificationInput {
  orgId: string;
  status?: NotificationStatus;
  readAt?: Date | null;
  archivedAt?: Date | null;
}

export interface NotificationFilters {
  orgId: string;
  category?: NotificationCategory;
  priority?: NotificationPriority;
  status?: NotificationStatus;
  unreadOnly?: boolean;
  includeArchived?: boolean;
  limit?: number;
}

export interface ActivityEventDTO extends EntityReference {
  id: string;
  eventType: string;
  title: string;
  description: string | null;
  actorUserId: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: string;
  createdAt: string;
}

export interface CreateActivityEventInput extends EntityReference {
  orgId: string;
  eventType: string;
  title: string;
  description?: string;
  actorUserId?: string;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
}

export interface ActivityFilters {
  orgId: string;
  entityType?: IntelligenceEntityType;
  entityId?: string;
  eventType?: string;
  limit?: number;
}

export const attachmentKinds = ["photo", "video", "document", "pdf", "voice_note", "drawing", "drone_imagery"] as const;
export type AttachmentKind = (typeof attachmentKinds)[number];

export interface AttachmentDTO extends EntityReference {
  id: string;
  kind: AttachmentKind;
  fileName: string;
  mimeType: string | null;
  fileUrl: string;
  previewUrl: string | null;
  storagePath: string | null;
  sizeBytes: number | null;
  durationSeconds: number | null;
  metadata: Record<string, unknown> | null;
  uploadedByUserId: string | null;
  createdAt: string;
}

export interface CreateAttachmentInput extends EntityReference {
  orgId: string;
  kind: AttachmentKind;
  fileName: string;
  mimeType?: string;
  fileUrl: string;
  previewUrl?: string;
  storagePath?: string;
  sizeBytes?: number;
  durationSeconds?: number;
  metadata?: Record<string, unknown>;
  uploadedByUserId?: string;
}

export interface CommentDTO extends EntityReference {
  id: string;
  parentCommentId: string | null;
  body: string;
  authorUserId: string | null;
  mentions: string[];
  reactions: Record<string, string[]>;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommentInput extends EntityReference {
  orgId: string;
  body: string;
  authorUserId?: string;
  parentCommentId?: string;
  mentions?: string[];
}

export interface UpdateCommentInput {
  orgId: string;
  body?: string;
  resolvedAt?: Date | null;
  reactions?: Record<string, string[]>;
}

export interface TagDTO {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  color: string | null;
  description: string | null;
  createdAt: string;
}

export interface CreateTagInput {
  orgId: string;
  name: string;
  color?: string;
  description?: string;
}

export interface TagAssignmentDTO extends EntityReference {
  id: string;
  tagId: string;
  assignedByUserId: string | null;
  createdAt: string;
}

export interface AssignTagInput extends EntityReference {
  orgId: string;
  tagId: string;
  assignedByUserId?: string;
}

export interface SavedViewDTO {
  id: string;
  orgId: string;
  entityType: IntelligenceEntityType;
  name: string;
  description: string | null;
  filterJson: Record<string, unknown>;
  sortJson: Record<string, unknown> | null;
  isShared: boolean;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSavedViewInput {
  orgId: string;
  entityType: IntelligenceEntityType;
  name: string;
  description?: string;
  filterJson: Record<string, unknown>;
  sortJson?: Record<string, unknown>;
  isShared?: boolean;
  createdByUserId?: string;
}

export interface UpdateSavedViewInput {
  orgId: string;
  name?: string;
  description?: string | null;
  filterJson?: Record<string, unknown>;
  sortJson?: Record<string, unknown> | null;
  isShared?: boolean;
}

export interface RecentItemDTO extends SearchDocument {
  id: string;
  userId: string;
  viewedAt: string;
  viewCount: number;
}

export interface RecordRecentItemInput extends SearchDocument {
  orgId: string;
  userId: string;
}

export const featureFlagScopeTypes = ["global", "org", "plan", "user", "beta", "internal"] as const;
export type FeatureFlagScopeType = (typeof featureFlagScopeTypes)[number];

export interface FeatureFlagDTO {
  id: string;
  orgId: string;
  key: string;
  description: string | null;
  enabled: boolean;
  scopeType: FeatureFlagScopeType;
  scopeKey: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertFeatureFlagInput {
  orgId: string;
  key: string;
  description?: string;
  enabled: boolean;
  scopeType?: FeatureFlagScopeType;
  scopeKey?: string | null;
  metadata?: Record<string, unknown>;
}

export interface FeatureFlagEvaluationContext {
  orgId: string;
  userId?: string;
  planKey?: string;
  isBeta?: boolean;
  isInternal?: boolean;
}

export interface FeatureFlagEvaluationResult {
  key: string;
  enabled: boolean;
  matchedScope: FeatureFlagScopeType | "default";
  matchedFlagId: string | null;
}
