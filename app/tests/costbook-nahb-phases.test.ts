import {
  NAHB_PHASE_TITLES,
  TRADEOS_ASSEMBLIES,
  isNahbPhase,
  tradeosAssembliesByNahbPhase,
  type NahbPhase,
} from "../modules/costbook/tradeosAssemblies";

describe("Costbook NAHB build phases", () => {
  it("tags all 88 assemblies with a valid NAHB phase", () => {
    expect(TRADEOS_ASSEMBLIES).toHaveLength(88);
    for (const assembly of TRADEOS_ASSEMBLIES) {
      expect(isNahbPhase(assembly.nahbPhase)).toBe(true);
    }
  });

  it("distributes assemblies across the residential build sequence as designed", () => {
    const counts = new Map<NahbPhase, number>();
    for (const assembly of TRADEOS_ASSEMBLIES) {
      counts.set(assembly.nahbPhase, (counts.get(assembly.nahbPhase) ?? 0) + 1);
    }
    // 1000 demo/site work, 2000 excavation/foundation, 3000 rough structure,
    // 4000 dry-in, 5000 finishing trades. 6000 (completion/inspection) is
    // intentionally empty — punchlist work is not assembly work.
    expect(counts.get("1000")).toBe(13);
    expect(counts.get("2000")).toBe(11);
    expect(counts.get("3000")).toBe(10);
    expect(counts.get("4000")).toBe(16);
    expect(counts.get("5000")).toBe(38);
    expect(counts.get("6000") ?? 0).toBe(0);
  });

  it("preserves existing CSI divisions alongside the new phase tags", () => {
    const byId = new Map(TRADEOS_ASSEMBLIES.map((a) => [a.id, a]));
    // Spot checks: phase tags must not have disturbed CSI classification.
    expect(byId.get("demo-drywall-stud-bare")).toMatchObject({ csiDivision: "02", nahbPhase: "1000" });
    expect(byId.get("framing-wall-ext-2x6-16oc")).toMatchObject({ csiDivision: "06", nahbPhase: "3000" });
    const roofing = TRADEOS_ASSEMBLIES.find((a) => a.trade === "Roofing" && a.csiDivision === "07");
    expect(roofing?.nahbPhase).toBe("4000");
  });

  it("looks up assemblies by NAHB phase with official titles", () => {
    const dryIn = tradeosAssembliesByNahbPhase("4000");
    expect(dryIn.length).toBe(16);
    expect(dryIn.every((a) => a.nahbPhase === "4000")).toBe(true);
    expect(NAHB_PHASE_TITLES["4000"]).toBe("Full Enclosure (Dry-in)");
    expect(Object.keys(NAHB_PHASE_TITLES)).toHaveLength(6);
  });

  it("keeps every build phase 1000-5000 populated", () => {
    for (const phase of ["1000", "2000", "3000", "4000", "5000"] as NahbPhase[]) {
      expect(tradeosAssembliesByNahbPhase(phase).length).toBeGreaterThan(0);
    }
  });
});
