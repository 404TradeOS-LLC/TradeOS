import { ATHENA_CANONICAL_EVENT_TYPES, isAthenaEventTypeVersionRegistered, listRegisteredAthenaEventVersions } from "../modules/athena-events/registry";

// Canonical event list must match docs/athena/10-events/README.md's
// "Canonical Business Events" table exactly - 16 names, each seeded at
// "1.0.0" only in A8.
const CANONICAL_EVENTS_FROM_DOCS = [
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

describe("athena-events registry", () => {
  it("seeds exactly the 16 canonical event names from docs/athena/10-events/README.md", () => {
    expect(ATHENA_CANONICAL_EVENT_TYPES.length).toBe(16);
    expect([...ATHENA_CANONICAL_EVENT_TYPES].sort()).toEqual([...CANONICAL_EVENTS_FROM_DOCS].sort());
  });

  it.each(CANONICAL_EVENTS_FROM_DOCS)("registers %s at version 1.0.0", (type) => {
    expect(isAthenaEventTypeVersionRegistered(type, "1.0.0")).toBe(true);
    expect(listRegisteredAthenaEventVersions(type)).toEqual(["1.0.0"]);
  });

  it("returns false for a completely unregistered event type", () => {
    expect(isAthenaEventTypeVersionRegistered("SomethingMadeUp", "1.0.0")).toBe(false);
  });

  it("returns false for an unregistered version of a known event type", () => {
    expect(isAthenaEventTypeVersionRegistered("ProposalSent", "2.0.0")).toBe(false);
  });

  it("returns an empty array from listRegisteredAthenaEventVersions for an unknown type", () => {
    expect(listRegisteredAthenaEventVersions("SomethingMadeUp")).toEqual([]);
  });

  it("is closed by default: no type is registered at every version", () => {
    expect(isAthenaEventTypeVersionRegistered("ProposalSent", "0.9.0")).toBe(false);
    expect(isAthenaEventTypeVersionRegistered("ProposalSent", "latest")).toBe(false);
  });

  it("does not mutate the list returned by listRegisteredAthenaEventVersions across calls", () => {
    const first = listRegisteredAthenaEventVersions("ProposalSent");
    first.push("9.9.9");
    const second = listRegisteredAthenaEventVersions("ProposalSent");
    expect(second).toEqual(["1.0.0"]);
  });
});
