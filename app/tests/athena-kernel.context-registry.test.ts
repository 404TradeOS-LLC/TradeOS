import { createLiveAthenaContextRegistry } from "../modules/athena-kernel/contextRegistry";

describe("live Athena context registry", () => {
  it("registers the first-party customer, estimate, and costbook providers", () => {
    const registry = createLiveAthenaContextRegistry();
    const sections = registry.list().map((provider) => provider.section);
    expect(sections).toEqual(expect.arrayContaining(["customers", "estimates", "costbook"]));
  });
});
