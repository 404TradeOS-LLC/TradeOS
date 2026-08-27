export const athenaAuditEventTypes = [
  "request_received",
  "context_gathered",
  "tools_considered",
  "action_attempted",
  "approval_requested",
  "execution_completed",
  "failure",
  "authentication_succeeded",
  "security_decision",
  "tenant_access_denied",
  "privilege_denied",
  "sensitive_action_attempted",
  "sensitive_action_completed",
] as const;

export type AthenaAuditEventType = (typeof athenaAuditEventTypes)[number];

export interface AthenaAuditEvent {
  id: string;
  timestamp: Date;
  actor: { userId: string | null; role: string | null };
  organization: string;
  eventType: AthenaAuditEventType;
  metadata: Record<string, unknown>;
  requestId?: string;
  traceId?: string;
  executionId?: string;
  actionId?: string;
  approvalId?: string;
}

export interface AthenaAuditStore {
  record(event: AthenaAuditEvent): Promise<void>;
}

export interface AthenaAuditApprovalQuery {
  organizationId: string;
  approvalId: string;
  actionId: string;
  limit: number;
}

export const athenaSecurityAuditEventTypes = [
  "authentication_succeeded",
  "security_decision",
  "tenant_access_denied",
  "privilege_denied",
  "sensitive_action_attempted",
  "sensitive_action_completed",
] as const satisfies readonly AthenaAuditEventType[];

export type AthenaSecurityAuditEventType = (typeof athenaSecurityAuditEventTypes)[number];

export type AthenaSecurityAuditOutcome = "allowed" | "denied" | "attempted" | "succeeded" | "failed";

export interface AthenaSecurityAuditQuery {
  organizationId: string;
  eventTypes?: readonly AthenaSecurityAuditEventType[];
  actorUserId?: string;
  outcome?: AthenaSecurityAuditOutcome;
  from?: Date;
  to?: Date;
  limit?: number;
}

export interface AthenaAuditReader {
  listForApproval(query: AthenaAuditApprovalQuery): Promise<AthenaAuditEvent[]>;
}

export interface AthenaSecurityAuditReader {
  listSecurityEvents(query: AthenaSecurityAuditQuery): Promise<AthenaAuditEvent[]>;
}

export type AthenaAuditRepository = AthenaAuditStore & AthenaAuditReader & AthenaSecurityAuditReader;
