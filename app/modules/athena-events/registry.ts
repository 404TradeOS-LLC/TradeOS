// Canonical business event type/version registry (docs/athena/roadmap/
// A8-event-integration-implementation-plan.md: "Canonical event type/version
// registry (registry.ts) seeded with the 16 event names from docs/athena/
// 10-events/README.md's 'Canonical Business Events' table at version
// 1.0.0"). Code-defined and in-memory, same "static, code-loaded catalog"
// posture as athena-tool-registry/registry.ts and athena-context-engine/
// registry.ts, but simpler: A8 ships no dynamic register()/discover() API,
// only the closed type/version membership check publish() (owned by another
// file in this module) uses to fail closed on anything unregistered.

export const ATHENA_CANONICAL_EVENT_TYPES = [
  "LeadCreated",
  "EstimateStarted",
  "EstimateCompleted",
  "ProposalSent",
  "ProposalViewed",
  "JobApproved",
  "JobScheduled",
  "TechnicianAssigned",
  "TechnicianArrived",
  "WorkStarted",
  "WorkCompleted",
  "InvoiceGenerated",
  "InvoicePaid",
  "WarrantyActivated",
  "MaintenanceDue",
  "CustomerFollowUpDue",
] as const;

export type AthenaCanonicalEventType = (typeof ATHENA_CANONICAL_EVENT_TYPES)[number];

// Every canonical event is seeded at "1.0.0" only in A8. A future major
// version would add another entry to the corresponding type's array, not
// replace it - existing subscribers keep resolving the version they were
// built against (10-events/README.md "Versioning": "breaking changes require
// a new major event version").
const REGISTERED_VERSIONS: Record<AthenaCanonicalEventType, readonly string[]> = {
  LeadCreated: ["1.0.0"],
  EstimateStarted: ["1.0.0"],
  EstimateCompleted: ["1.0.0"],
  ProposalSent: ["1.0.0"],
  ProposalViewed: ["1.0.0"],
  JobApproved: ["1.0.0"],
  JobScheduled: ["1.0.0"],
  TechnicianAssigned: ["1.0.0"],
  TechnicianArrived: ["1.0.0"],
  WorkStarted: ["1.0.0"],
  WorkCompleted: ["1.0.0"],
  InvoiceGenerated: ["1.0.0"],
  InvoicePaid: ["1.0.0"],
  WarrantyActivated: ["1.0.0"],
  MaintenanceDue: ["1.0.0"],
  CustomerFollowUpDue: ["1.0.0"],
};

function isCanonicalEventType(type: string): type is AthenaCanonicalEventType {
  return Object.prototype.hasOwnProperty.call(REGISTERED_VERSIONS, type);
}

// Closed by default (A8 roadmap: "closed by default: publishing an
// unregistered type/version pair fails validation rather than being
// silently accepted"). The actual rejection happens wherever publish() is
// implemented - this predicate only answers the membership question.
export function isAthenaEventTypeVersionRegistered(type: string, version: string): boolean {
  if (!isCanonicalEventType(type)) {
    return false;
  }
  return REGISTERED_VERSIONS[type].includes(version);
}

export function listRegisteredAthenaEventVersions(type: string): string[] {
  if (!isCanonicalEventType(type)) {
    return [];
  }
  return [...REGISTERED_VERSIONS[type]];
}
