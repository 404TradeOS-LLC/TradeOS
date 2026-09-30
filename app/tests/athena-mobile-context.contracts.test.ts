import { assembleAthenaContext } from "../modules/athena-context-engine/assembler";
import { createMobileFieldProvider } from "../modules/athena-context-engine/providers/mobileFieldProvider";
import { createAthenaContextRegistry } from "../modules/athena-context-engine/registry";

const fakeJob = {
  id: "11111111-1111-4111-8111-111111111111",
  jobNumber: "J-1042",
  title: "Replace condenser fan motor",
  status: "scheduled",
  priority: "normal",
  scheduledStart: "2026-09-11T13:00:00.000Z",
  scheduledEnd: "2026-09-11T15:00:00.000Z",
  arrivalWindowStart: "2026-09-11T12:30:00.000Z",
  arrivalWindowEnd: "2026-09-11T13:30:00.000Z",
  serviceAddress: { city: "Terre Haute", state: "IN", addressLine1: "123 Hidden St", addressLine2: null },
  customer: { name: "Hidden Customer", email: "hidden@example.com", phone: "5555555555" },
};

const input = {
  orgId: "org-1",
  actor: { userId: "tech-1", role: "technician" as const },
  selectedScope: { jobId: fakeJob.id, page: "/jobs/selected" },
  deadline: new Date(Date.now() + 5000),
  cancellationSignal: new AbortController().signal,
};

describe("A14 mobile field context", () => {
  test("uses JobsService-scoped lookup and omits customer contact/street details", async () => {
    const getById = jest.fn(async () => fakeJob as never);
    const provider = createMobileFieldProvider({}, { getById } as never);
    const result = await provider.provide({ ...input, interaction: { channel: "mobile" } });

    expect(provider.activation).toBe("explicit_only");
    expect(getById).toHaveBeenCalledWith("org-1", fakeJob.id, expect.objectContaining({ userId: "tech-1", orgId: "org-1", role: "technician" }));
    expect(result.data.job).toEqual(expect.objectContaining({ jobId: fakeJob.id, serviceArea: { city: "Terre Haute", state: "IN" } }));
    expect(JSON.stringify(result.data)).not.toContain("Hidden Customer");
    expect(JSON.stringify(result.data)).not.toContain("hidden@example.com");
    expect(JSON.stringify(result.data)).not.toContain("123 Hidden St");
    expect(result.omittedFields).toEqual(expect.arrayContaining(["customer.email", "customer.phone", "serviceAddress.addressLine1"]));
  });

  test("has a bounded field latency budget", async () => {
    const provider = createMobileFieldProvider({}, { getById: async () => fakeJob as never } as never);
    expect(provider.timeoutMs).toBeLessThanOrEqual(1500);
    const start = performance.now();
    await provider.provide({ ...input, interaction: { channel: "voice" } });
    expect(performance.now() - start).toBeLessThan(250);
  });

  test("returns useful page context without broad hydration when no job is selected", async () => {
    const getById = jest.fn();
    const provider = createMobileFieldProvider({}, { getById } as never);
    const result = await provider.provide({ ...input, interaction: { channel: "mobile" }, selectedScope: { page: "/dispatch" } });
    expect(result.data).toEqual({ surface: "mobile", selectedPage: "/dispatch", job: null });
    expect(result.itemCount).toBe(0);
    expect(getById).not.toHaveBeenCalled();
  });

  test("does not activate mobile context for ordinary text dispatch but does for explicit mobile/voice requests", async () => {
    const getById = jest.fn(async () => fakeJob as never);
    const registry = createAthenaContextRegistry();
    registry.register(createMobileFieldProvider({}, { getById } as never));
    const base = {
      orgId: "org-1",
      actor: { userId: "tech-1", role: "technician" as const },
      permissions: [],
      selectedScope: { jobId: fakeJob.id },
      featureFlags: [],
      requestedIntents: ["dispatch_overview"],
      clientSignal: new AbortController().signal,
    };

    const text = await assembleAthenaContext(registry, { ...base, interaction: { channel: "text" }, explicitSections: [] });
    expect(text.sections.mobile).toBeUndefined();
    expect(getById).not.toHaveBeenCalled();

    const mobile = await assembleAthenaContext(registry, { ...base, interaction: { channel: "mobile" }, explicitSections: ["mobile"] });
    expect(mobile.sections.mobile?.status).toBe("available");
    expect(getById).toHaveBeenCalledTimes(1);

    const voice = await assembleAthenaContext(registry, { ...base, interaction: { channel: "voice" }, explicitSections: ["mobile"] });
    expect(voice.sections.mobile?.status).toBe("available");
    expect(getById).toHaveBeenCalledTimes(2);
  });
});
