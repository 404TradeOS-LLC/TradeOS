const db = {
  organizationOnboardingState: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
};
jest.mock("../db/client", () => ({ prisma: db }));
import { OnboardingService } from "../modules/onboarding/service";

const ORG = "org-a";
const NOW = new Date("2026-11-25T07:00:00Z");

function row(overrides: Record<string, unknown> = {}) {
  return {
    orgId: ORG,
    status: "in_progress",
    currentStep: 1,
    workTypes: ["Painting"],
    scopeText: null,
    laborRateCents: 4800,
    region: null,
    skippedAt: null,
    completedAt: null,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("onboarding service (DES-3 slice 2)", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("returns null when the org has no onboarding row yet", async () => {
    db.organizationOnboardingState.findUnique.mockResolvedValue(null);
    await expect(new OnboardingService(db as never).getState(ORG)).resolves.toBeNull();
    expect(db.organizationOnboardingState.findUnique).toHaveBeenCalledWith({ where: { orgId: ORG } });
  });

  it("returns the persisted state as a DTO", async () => {
    db.organizationOnboardingState.findUnique.mockResolvedValue(row({ status: "skipped", skippedAt: NOW }));
    const state = await new OnboardingService(db as never).getState(ORG);
    expect(state).toMatchObject({ orgId: ORG, status: "skipped", currentStep: 1, laborRateCents: 4800 });
    expect(state?.skippedAt).toBe("2026-11-25T07:00:00.000Z");
  });

  it("rejects an absent org before any query", async () => {
    await expect(new OnboardingService(db as never).getState("")).rejects.toMatchObject({ statusCode: 401 });
    await expect(new OnboardingService(db as never).skip(null)).rejects.toMatchObject({ statusCode: 401 });
    expect(db.organizationOnboardingState.findUnique).not.toHaveBeenCalled();
    expect(db.organizationOnboardingState.upsert).not.toHaveBeenCalled();
  });

  it("saveProgress upserts the wizard fields and reopens a skipped row", async () => {
    db.organizationOnboardingState.findUnique.mockResolvedValue(row({ status: "skipped", skippedAt: NOW }));
    db.organizationOnboardingState.upsert.mockResolvedValue(row({ status: "in_progress", currentStep: 2 }));
    const state = await new OnboardingService(db as never).saveProgress(ORG, {
      currentStep: 2,
      scopeText: "Paint the garage floor.",
    });
    expect(state.status).toBe("in_progress");
    const update = db.organizationOnboardingState.upsert.mock.calls[0][0].update;
    expect(update.status).toBe("in_progress");
    expect(update.skippedAt).toBeNull();
    expect(update.currentStep).toBe(2);
    expect(update.scopeText).toBe("Paint the garage floor.");
  });

  it("saveProgress keeps a completed row completed while updating defaults", async () => {
    db.organizationOnboardingState.findUnique.mockResolvedValue(row({ status: "completed", completedAt: NOW }));
    db.organizationOnboardingState.upsert.mockResolvedValue(row({ status: "completed", laborRateCents: 5500 }));
    const state = await new OnboardingService(db as never).saveProgress(ORG, { laborRateCents: 5500 });
    expect(state.status).toBe("completed");
    const update = db.organizationOnboardingState.upsert.mock.calls[0][0].update;
    expect(update.status).toBeUndefined();
    expect(update.laborRateCents).toBe(5500);
  });

  it("saveProgress rejects an out-of-range step and labor rate before any write", async () => {
    await expect(new OnboardingService(db as never).saveProgress(ORG, { currentStep: 3 })).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(
      new OnboardingService(db as never).saveProgress(ORG, { laborRateCents: 50 }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      new OnboardingService(db as never).saveProgress(ORG, { region: "x".repeat(121) }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(db.organizationOnboardingState.upsert).not.toHaveBeenCalled();
  });

  it("skip persists a skipped state for the org", async () => {
    db.organizationOnboardingState.upsert.mockResolvedValue(row({ status: "skipped", skippedAt: NOW }));
    const state = await new OnboardingService(db as never).skip(ORG);
    expect(state.status).toBe("skipped");
    const update = db.organizationOnboardingState.upsert.mock.calls[0][0].update;
    expect(update.status).toBe("skipped");
    expect(update.completedAt).toBeNull();
  });

  it("complete requires a work type and a real scope, then persists completion", async () => {
    await expect(new OnboardingService(db as never).complete(ORG, { workTypes: [], scopeText: "Paint it." })).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      new OnboardingService(db as never).complete(ORG, { workTypes: ["Painting"], scopeText: "Too short" }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(db.organizationOnboardingState.upsert).not.toHaveBeenCalled();

    db.organizationOnboardingState.upsert.mockResolvedValue(
      row({ status: "completed", currentStep: 2, completedAt: NOW }),
    );
    const state = await new OnboardingService(db as never).complete(ORG, {
      workTypes: ["Painting"],
      scopeText: "Paint a 2.5-car garage floor.",
      laborRateCents: 4800,
      region: "Terre Haute, IN",
    });
    expect(state.status).toBe("completed");
    const create = db.organizationOnboardingState.upsert.mock.calls[0][0].create;
    expect(create).toMatchObject({
      orgId: ORG,
      status: "completed",
      currentStep: 2,
      workTypes: ["Painting"],
      scopeText: "Paint a 2.5-car garage floor.",
      laborRateCents: 4800,
      region: "Terre Haute, IN",
    });
    expect(create.skippedAt).toBeNull();
  });
});
