export const athenaAuditEventTypes = [
  "request_received",
  "context_gathered",
  "tools_considered",
  "action_attempted",
  "approval_requested",
  "execution_completed",
  "failure",
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
