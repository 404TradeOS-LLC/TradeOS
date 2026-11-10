/**
 * Codes job assessment service tests (issue #946, TODO 4).
 * Mocked-Prisma unit tests for validation, org scoping, and sign-off rules.
 * These do NOT prove RLS — live cross-tenant coverage is in
 * app/tests/rls.integration.ts.
 */
import { CodesJobAssessmentService } from "../modules/costbook/codes/assessment";

const ORG = "10000000-0000-0000-0000-000000000001";
const OTHER_ORG = "20000000-0000-0000-0000-000000000002";
const PROJECT = "10000000-0000-4000-8000-000000000081";
const ESTIMATE = "10000000-0000-4000-8000-000000000091";
const ACTOR = "10000000-0000-0000-0000-000000000011";

function assessmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "30000000-0000-4000-8000-000000000001",
    orgId: ORG,
    projectId: PROJECT,
    estimateId: ESTIMATE,
    workType: "sign replacement",
    status: "needs_review",
    citations: [{ source_id: "vigo-zoning-signs", rationale: "County sign rules must be confirmed." }],
    unknowns: ["Confirm the zoning district."],
    ownerSignoff: false,
    signedOffBy: null,
    signedOffAt: null,
    createdBy: ACTOR,
    createdAt: new Date("2026-11-09T12:00:00.000Z"),
    updatedAt: new Date("2026-11-09T12:00:00.000Z"),
    ...overrides,
  };
}

function mockDb() {
  return {
    project: { findFirst: jest.fn() },
    estimate: { findFirst: jest.fn() },
    codesJobAssessment: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
}

describe("CodesJobAssessmentService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates an assessment for a project in the caller's org", async () => {
    const db = mockDb();
    db.project.findFirst.mockResolvedValue({ id: PROJECT });
    db.estimate.findFirst.mockResolvedValue({ id: ESTIMATE });
    db.codesJobAssessment.create.mockResolvedValue(assessmentRow());
    const service = new CodesJobAssessmentService(db as any);

    const created = await service.create({
      orgId: ORG,
      projectId: PROJECT,
      estimateId: ESTIMATE,
      workType: "sign replacement",
      citations: [{ source_id: "vigo-zoning-signs", rationale: "County sign rules must be confirmed." }],
      unknowns: ["Confirm the zoning district."],
      createdBy: ACTOR,
    });

    expect(db.project.findFirst).toHaveBeenCalledWith({ where: { id: PROJECT, orgId: ORG } });
    expect(db.codesJobAssessment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orgId: ORG,
          projectId: PROJECT,
          estimateId: ESTIMATE,
          status: "needs_review",
          ownerSignoff: false,
        }),
      }),
    );
    expect(created.status).toBe("needs_review");
    expect(created.ownerSignoff).toBe(false);
  });

  it("refuses owner_approved at creation — approval requires the sign-off path", async () => {
    const db = mockDb();
    const service = new CodesJobAssessmentService(db as any);
    // Runtime rejection of owner_approved at creation (the input type
    // already excludes it; the cast proves the service still refuses it).
    const input = {
      orgId: ORG,
      projectId: PROJECT,
      workType: "sign replacement",
      status: "owner_approved",
      citations: [],
      unknowns: [],
    } as unknown as Parameters<CodesJobAssessmentService["create"]>[0];
    await expect(service.create(input)).rejects.toThrow(/owner approval requires sign-off/);
    expect(db.codesJobAssessment.create).not.toHaveBeenCalled();
  });

  it("returns 404 for a project outside the caller's org instead of leaking it", async () => {
    const db = mockDb();
    db.project.findFirst.mockResolvedValue(null);
    const service = new CodesJobAssessmentService(db as any);
    await expect(
      service.create({
        orgId: OTHER_ORG,
        projectId: PROJECT,
        workType: "sign replacement",
        citations: [],
        unknowns: [],
      }),
    ).rejects.toThrow(/not found/);
    expect(db.codesJobAssessment.create).not.toHaveBeenCalled();
  });

  it("returns 404 when the estimate does not belong to the project", async () => {
    const db = mockDb();
    db.project.findFirst.mockResolvedValue({ id: PROJECT });
    db.estimate.findFirst.mockResolvedValue(null);
    const service = new CodesJobAssessmentService(db as any);
    await expect(
      service.create({
        orgId: ORG,
        projectId: PROJECT,
        estimateId: ESTIMATE,
        workType: "sign replacement",
        citations: [],
        unknowns: [],
      }),
    ).rejects.toThrow(/not found for this project/);
  });

  it("rejects malformed citations and unknowns", async () => {
    const db = mockDb();
    const service = new CodesJobAssessmentService(db as any);
    await expect(
      service.create({
        orgId: ORG,
        projectId: PROJECT,
        workType: "sign replacement",
        citations: [{ source_id: "", rationale: "x" }],
        unknowns: [],
      }),
    ).rejects.toThrow(/source_id/);
    await expect(
      service.create({
        orgId: ORG,
        projectId: PROJECT,
        workType: "sign replacement",
        citations: [],
        unknowns: [""],
      }),
    ).rejects.toThrow(/unknown/);
  });

  it("signs off an assessment once, stamping actor and time, and refuses a second approval", async () => {
    const db = mockDb();
    db.codesJobAssessment.findFirst.mockResolvedValue(assessmentRow());
    db.codesJobAssessment.update.mockResolvedValue(
      assessmentRow({ status: "owner_approved", ownerSignoff: true, signedOffBy: ACTOR, signedOffAt: new Date("2026-11-09T13:00:00.000Z") }),
    );
    const service = new CodesJobAssessmentService(db as any);

    const signed = await service.signOff("30000000-0000-4000-8000-000000000001", ORG, ACTOR);
    expect(signed.status).toBe("owner_approved");
    expect(signed.ownerSignoff).toBe(true);
    expect(signed.signedOffBy).toBe(ACTOR);
    expect(signed.signedOffAt).toBe("2026-11-09T13:00:00.000Z");
    expect(db.codesJobAssessment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "30000000-0000-4000-8000-000000000001" },
        data: expect.objectContaining({ status: "owner_approved", ownerSignoff: true, signedOffBy: ACTOR }),
      }),
    );

    db.codesJobAssessment.findFirst.mockResolvedValue(
      assessmentRow({ status: "owner_approved", ownerSignoff: true }),
    );
    await expect(service.signOff("30000000-0000-4000-8000-000000000001", ORG, ACTOR)).rejects.toThrow(/already owner-approved/);
  });

  it("lists assessments for a project newest first, scoped to the org", async () => {
    const db = mockDb();
    db.project.findFirst.mockResolvedValue({ id: PROJECT });
    db.codesJobAssessment.findMany.mockResolvedValue([assessmentRow()]);
    const service = new CodesJobAssessmentService(db as any);
    const rows = await service.listForProject(PROJECT, ORG);
    expect(db.codesJobAssessment.findMany).toHaveBeenCalledWith({
      where: { projectId: PROJECT, orgId: ORG },
      orderBy: { createdAt: "desc" },
    });
    expect(rows).toHaveLength(1);
  });
});
