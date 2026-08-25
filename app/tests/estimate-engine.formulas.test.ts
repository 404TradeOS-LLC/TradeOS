import {
  adjustedMaterialCost,
  applyOverhead,
  burdenedLaborRate,
  equipmentCost,
  estimateTaxAmount,
  laborCost,
  laborHours,
  marginFromMarkup,
  markupFromMargin,
  sellPrice,
} from "../modules/estimate-engine/formulas";

describe("Estimate Engine — Labor formulas", () => {
  it("computes labor hours as quantity / production rate", () => {
    expect(laborHours(100, 20)).toBe(5);
  });

  it("throws when production rate is zero or negative", () => {
    expect(() => laborHours(100, 0)).toThrow();
    expect(() => laborHours(100, -1)).toThrow();
  });

  it("burdens the base hourly rate by the burden percentage", () => {
    // $30/hr base, 25% burden -> $37.50/hr
    expect(burdenedLaborRate(30, 25)).toBeCloseTo(37.5, 2);
  });

  it("applies a regional labor index on top of the burdened rate", () => {
    // $30/hr base, 25% burden, 1.1 region index -> $41.25/hr
    expect(burdenedLaborRate(30, 25, 1.1)).toBeCloseTo(41.25, 2);
  });

  it("computes total labor cost = hours * burdened rate", () => {
    // 100 SF at 20 SF/hr = 5 hours; $30/hr base, 25% burden = $37.50/hr -> $187.50
    const cost = laborCost({ quantity: 100, productionRate: 20, baseHourlyRate: 30, burdenPct: 25 });
    expect(cost).toBeCloseTo(187.5, 2);
  });
});

describe("Estimate Engine — Material formulas", () => {
  it("applies the waste factor on top of base material cost", () => {
    // 100 units at $5/unit with 10% waste -> $500 * 1.10 = $550
    const cost = adjustedMaterialCost({ quantity: 100, unitCost: 5, wasteFactorPct: 10 });
    expect(cost).toBeCloseTo(550, 2);
  });

  it("applies a regional material index before the waste factor", () => {
    // 100 units at $5/unit, 1.2 region index, 10% waste -> $600 * 1.10 = $660
    const cost = adjustedMaterialCost({ quantity: 100, unitCost: 5, wasteFactorPct: 10, regionMaterialIndex: 1.2 });
    expect(cost).toBeCloseTo(660, 2);
  });
});

describe("Estimate Engine — Equipment formulas", () => {
  it("computes hourly-based equipment cost when no daily rate applies", () => {
    // 5 hours at ($20 ownership + $10 operating)/hr -> $150
    const cost = equipmentCost({ hours: 5, ownershipCostPerHour: 20, operatingCostPerHour: 10 });
    expect(cost).toBeCloseTo(150, 2);
  });

  it("uses the daily rate once hours meet or exceed a billable day", () => {
    // 9 hours, billable day = 8hr, daily rate $300 -> ceil(9/8)=2 days -> $600
    const cost = equipmentCost({ hours: 9, ownershipCostPerHour: 20, operatingCostPerHour: 10, dailyRate: 300 });
    expect(cost).toBeCloseTo(600, 2);
  });

  it("falls back to hourly cost when hours are below a billable day even if a daily rate is set", () => {
    // 4 hours < 8hr billable day -> hourly: 4 * (20+10) = 120
    const cost = equipmentCost({ hours: 4, ownershipCostPerHour: 20, operatingCostPerHour: 10, dailyRate: 300 });
    expect(cost).toBeCloseTo(120, 2);
  });
});

describe("Estimate Engine — Overhead & Profit formulas", () => {
  it("applies direct overhead then indirect overhead percentage", () => {
    // job cost 1000 + direct overhead 100 = 1100, * 1.10 (10% indirect) = 1210
    expect(applyOverhead(1000, 100, 10)).toBeCloseTo(1210, 2);
  });

  it("computes sell price in markup mode", () => {
    // cost 1000, 25% markup -> 1250
    expect(sellPrice({ totalCost: 1000, mode: "markup", markupPct: 25 })).toBeCloseTo(1250, 2);
  });

  it("computes sell price in target-margin mode", () => {
    // cost 1000, 20% target margin -> 1000 / 0.8 = 1250
    expect(sellPrice({ totalCost: 1000, mode: "targetMargin", targetMarginPct: 20 })).toBeCloseTo(1250, 2);
  });

  it("demonstrates markup and margin are not the same percentage for the same job", () => {
    // A 25% markup on $1000 cost sells for $1250 -> margin = 250/1250 = 20%, not 25%
    const price = sellPrice({ totalCost: 1000, mode: "markup", markupPct: 25 });
    const impliedMargin = ((price - 1000) / price) * 100;
    expect(impliedMargin).toBeCloseTo(20, 2);
    expect(impliedMargin).not.toBeCloseTo(25, 2);
  });

  it("converts between markup and margin consistently", () => {
    expect(markupFromMargin(20)).toBeCloseTo(25, 2);
    expect(marginFromMarkup(25)).toBeCloseTo(20, 2);
  });

  it("rejects a target margin of 100% or more (division by zero/negative)", () => {
    expect(() => sellPrice({ totalCost: 1000, mode: "targetMargin", targetMarginPct: 100 })).toThrow();
  });

  it("allocates tax to taxable scope after overhead and markup", () => {
    // $100 direct cost, 10% overhead, 20% markup => $132 pre-tax.
    // Half taxable => $66 taxable selling price, 10% tax => $6.60.
    expect(estimateTaxAmount({ preTaxTotalPrice: 132, jobCost: 100, taxableJobCost: 50, taxPct: 10 })).toBe(6.6);
  });
});
