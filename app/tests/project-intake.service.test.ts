import { buildProjectIntake } from "../modules/project-intake/service";

describe("buildProjectIntake", () => {
  // ── 1. Deck ──────────────────────────────────────────────────────────────
  describe("Build a 16x20 treated deck with stairs.", () => {
    const result = buildProjectIntake("Build a 16x20 treated deck with stairs.");

    it("classifies trade as Deck", () => expect(result.trade).toBe("Deck"));
    it("sets projectType", () => expect(result.projectType).toBe("Outdoor Structure"));
    it("sets category", () => expect(result.category).toBe("Exterior Improvements"));
    it("does not flag dimensions as missing", () => {
      expect(result.missingInformation.map((m) => m.field)).not.toContain("dimensions");
    });
    it("does not flag decking material as missing (treated called out)", () => {
      expect(result.missingInformation.map((m) => m.field)).not.toContain("decking material");
    });
    it("does not flag stairs as missing", () => {
      expect(result.missingInformation.map((m) => m.field)).not.toContain("stairs");
    });
    it("flags guard rails as still missing", () => {
      expect(result.missingInformation.map((m) => m.field)).toContain("guard rails");
    });
    it("includes a scopeOfWork that reflects the input", () => {
      expect(result.proposalDraft.scopeOfWork).toContain("16x20");
    });
    it("has no pricing fields anywhere in the proposal draft", () => {
      expect(result.proposalDraft).not.toHaveProperty("priceBand");
      expect(result.proposalDraft).not.toHaveProperty("priceLow");
      expect(result.proposalDraft).not.toHaveProperty("priceHigh");
    });
  });

  // ── 2. Roofing ───────────────────────────────────────────────────────────
  describe("Replace a 32 square architectural shingle roof.", () => {
    const result = buildProjectIntake("Replace a 32 square architectural shingle roof.");

    it("classifies trade as Roofing", () => expect(result.trade).toBe("Roofing"));
    it("sets projectType", () => expect(result.projectType).toBe("Roof Replacement / Repair"));
    it("does not flag squares as missing", () => {
      expect(result.missingInformation.map((m) => m.field)).not.toContain("squares");
    });
    it("does not flag tear-off as missing ('replace' recognized)", () => {
      expect(result.missingInformation.map((m) => m.field)).not.toContain("tear-off");
    });
    it("flags pitch as still missing", () => {
      expect(result.missingInformation.map((m) => m.field)).toContain("pitch");
    });
  });

  // ── 3. Bathroom Remodel ──────────────────────────────────────────────────
  describe("Complete master bathroom remodel.", () => {
    const result = buildProjectIntake("Complete master bathroom remodel.");

    it("classifies trade as Bathroom Remodel", () => expect(result.trade).toBe("Bathroom Remodel"));
    it("does not flag remodel scope level as missing ('complete')", () => {
      expect(result.missingInformation.map((m) => m.field)).not.toContain("remodel scope level");
    });
    it("flags square footage as missing (no dimensions given)", () => {
      expect(result.missingInformation.map((m) => m.field)).toContain("square footage");
    });
    it("has a lower confidence score than a scope with more detail", () => {
      const withDetail = buildProjectIntake("Complete master bathroom remodel, 8x10 space, new tile and vanity, permit included.");
      expect(result.confidenceScore.score).toBeLessThan(withDetail.confidenceScore.score);
    });
  });

  // ── 4. Fence ─────────────────────────────────────────────────────────────
  describe("Install 240 feet of privacy fence.", () => {
    const result = buildProjectIntake("Install 240 feet of privacy fence.");

    it("classifies trade as Fence", () => expect(result.trade).toBe("Fence"));
    it("does not flag linear footage as missing", () => {
      expect(result.missingInformation.map((m) => m.field)).not.toContain("linear footage");
    });
    it("does not flag material as missing ('privacy fence')", () => {
      expect(result.missingInformation.map((m) => m.field)).not.toContain("material");
    });
    it("flags gates as still missing", () => {
      expect(result.missingInformation.map((m) => m.field)).toContain("gates");
    });
  });

  // ── 5. Concrete ──────────────────────────────────────────────────────────
  describe("Pour a 20x30 concrete patio.", () => {
    const result = buildProjectIntake("Pour a 20x30 concrete patio.");

    it("classifies trade as Concrete", () => expect(result.trade).toBe("Concrete"));
    it("does not flag dimensions/area as missing", () => {
      expect(result.missingInformation.map((m) => m.field)).not.toContain("dimensions/area");
    });
    it("flags finish type as still missing", () => {
      expect(result.missingInformation.map((m) => m.field)).toContain("finish type");
    });
  });

  // ── 6. Tree Service ──────────────────────────────────────────────────────
  describe("Remove three maple trees and grind stumps.", () => {
    const result = buildProjectIntake("Remove three maple trees and grind stumps.");

    it("classifies trade as Tree Service", () => expect(result.trade).toBe("Tree Service"));
    it("does not flag tree count as missing ('three')", () => {
      expect(result.missingInformation.map((m) => m.field)).not.toContain("tree count");
    });
    it("does not flag stump grinding scope as missing", () => {
      expect(result.missingInformation.map((m) => m.field)).not.toContain("stump grinding scope");
    });
    it("does not flag tree species as missing ('maple')", () => {
      expect(result.missingInformation.map((m) => m.field)).not.toContain("tree species");
    });
    it("includes a 30/40/30 payment schedule", () => {
      const schedule = result.proposalDraft.paymentSchedule;
      expect(schedule[0].amountPercent).toBe(30);
      expect(schedule[1].amountPercent).toBe(40);
      expect(schedule[2].amountPercent).toBe(30);
    });
  });

  // ── 7. Siding ────────────────────────────────────────────────────────────
  describe("Install LP SmartSide siding.", () => {
    const result = buildProjectIntake("Install LP SmartSide siding.");

    it("classifies trade as Siding", () => expect(result.trade).toBe("Siding"));
    it("does not flag material as missing ('LP SmartSide')", () => {
      expect(result.missingInformation.map((m) => m.field)).not.toContain("material");
    });
    it("flags square footage as still missing", () => {
      expect(result.missingInformation.map((m) => m.field)).toContain("square footage");
    });
  });

  // ── 8. Pole Barn ─────────────────────────────────────────────────────────
  describe("Build a 30x40 pole barn.", () => {
    const result = buildProjectIntake("Build a 30x40 pole barn.");

    it("classifies trade as Pole Barn", () => expect(result.trade).toBe("Pole Barn"));
    it("does not flag dimensions as missing", () => {
      expect(result.missingInformation.map((m) => m.field)).not.toContain("dimensions");
    });
    it("flags intended use as still missing", () => {
      expect(result.missingInformation.map((m) => m.field)).toContain("intended use");
    });
  });

  // ── 9. Windows ───────────────────────────────────────────────────────────
  describe("Replace 15 vinyl windows.", () => {
    const result = buildProjectIntake("Replace 15 vinyl windows.");

    it("classifies trade as Windows", () => expect(result.trade).toBe("Windows"));
    it("does not flag unit count as missing ('15 windows')", () => {
      expect(result.missingInformation.map((m) => m.field)).not.toContain("unit count");
    });
    it("does not flag material as missing ('vinyl')", () => {
      expect(result.missingInformation.map((m) => m.field)).not.toContain("material");
    });
    it("flags replacement type as still missing", () => {
      expect(result.missingInformation.map((m) => m.field)).toContain("replacement type");
    });
  });

  // ── 10. Kitchen Remodel ──────────────────────────────────────────────────
  describe("Kitchen remodel with custom cabinets.", () => {
    const result = buildProjectIntake("Kitchen remodel with custom cabinets.");

    it("classifies trade as Kitchen Remodel", () => expect(result.trade).toBe("Kitchen Remodel"));
    it("does not flag cabinet scope as missing", () => {
      expect(result.missingInformation.map((m) => m.field)).not.toContain("cabinet scope");
    });
    it("flags countertop material as still missing", () => {
      expect(result.missingInformation.map((m) => m.field)).toContain("countertop material");
    });
  });

  // ── Universal assertions across all 10 required scopes ──────────────────
  describe("every result", () => {
    const scopes = [
      "Build a 16x20 treated deck with stairs.",
      "Replace a 32 square architectural shingle roof.",
      "Complete master bathroom remodel.",
      "Install 240 feet of privacy fence.",
      "Pour a 20x30 concrete patio.",
      "Remove three maple trees and grind stumps.",
      "Install LP SmartSide siding.",
      "Build a 30x40 pole barn.",
      "Replace 15 vinyl windows.",
      "Kitchen remodel with custom cabinets.",
    ];

    it.each(scopes)("has all required top-level fields for: %s", (scope) => {
      const r = buildProjectIntake(scope);
      expect(r).toHaveProperty("trade");
      expect(r).toHaveProperty("projectType");
      expect(r).toHaveProperty("category");
      expect(Array.isArray(r.missingInformation)).toBe(true);
      expect(Array.isArray(r.followUpQuestions)).toBe(true);
      expect(r).toHaveProperty("confidenceScore");
      expect(r.proposalDraft).toHaveProperty("scopeOfWork");
      expect(r.proposalDraft).toHaveProperty("assumptions");
      expect(r.proposalDraft).toHaveProperty("exclusions");
      expect(r.proposalDraft).toHaveProperty("timeline");
      expect(r.proposalDraft).toHaveProperty("paymentSchedule");
    });

    it.each(scopes)("classifies a real trade (not null) for: %s", (scope) => {
      expect(buildProjectIntake(scope).trade).not.toBeNull();
    });

    it.each(scopes)("every missingInformation item has field/reason/importance for: %s", (scope) => {
      const { missingInformation } = buildProjectIntake(scope);
      for (const item of missingInformation) {
        expect(typeof item.field).toBe("string");
        expect(typeof item.reason).toBe("string");
        expect(["Critical", "Recommended", "Optional"]).toContain(item.importance);
      }
    });

    it.each(scopes)("followUpQuestions has one entry per missing field for: %s", (scope) => {
      const { missingInformation, followUpQuestions } = buildProjectIntake(scope);
      expect(followUpQuestions.length).toBe(missingInformation.length);
    });

    it.each(scopes)("confidenceScore shape is well-formed for: %s", (scope) => {
      const { confidenceScore } = buildProjectIntake(scope);
      expect(confidenceScore.score).toBeGreaterThanOrEqual(0);
      expect(confidenceScore.score).toBeLessThanOrEqual(100);
      expect(["Very Low", "Low", "Moderate", "High", "Very High"]).toContain(confidenceScore.level);
      expect(confidenceScore.missingCritical).toBeGreaterThanOrEqual(0);
      expect(confidenceScore.missingRecommended).toBeGreaterThanOrEqual(0);
      expect(typeof confidenceScore.reasoning).toBe("string");
      expect(confidenceScore.reasoning.length).toBeGreaterThan(0);
    });

    it.each(scopes)("proposal draft has no pricing/materials/labor fields for: %s", (scope) => {
      const { proposalDraft } = buildProjectIntake(scope);
      expect(proposalDraft).not.toHaveProperty("priceBand");
      expect(proposalDraft).not.toHaveProperty("priceLow");
      expect(proposalDraft).not.toHaveProperty("priceHigh");
      expect(proposalDraft).not.toHaveProperty("materials");
      expect(proposalDraft).not.toHaveProperty("laborCost");
    });
  });

  // ── Unrecognized scope ───────────────────────────────────────────────────
  describe("unrecognized scope", () => {
    const result = buildProjectIntake("Need someone to come take a look at some general property work.");

    it("returns null trade", () => expect(result.trade).toBeNull());
    it("falls back to General Contracting projectType", () => expect(result.projectType).toBe("General Contracting"));
    it("falls back to Uncategorized category", () => expect(result.category).toBe("Uncategorized"));
    it("flags project type as the missing field", () => {
      expect(result.missingInformation).toHaveLength(1);
      expect(result.missingInformation[0].field).toBe("project type");
      expect(result.missingInformation[0].importance).toBe("Critical");
    });
    it("has a very low confidence score", () => {
      expect(result.confidenceScore.level).toBe("Very Low");
      expect(result.confidenceScore.score).toBeLessThan(25);
    });
    it("still returns a follow-up question", () => {
      expect(result.followUpQuestions.length).toBeGreaterThan(0);
    });
  });
});
