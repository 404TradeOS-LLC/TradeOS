export interface IndotUnitPriceBenchmark {
  payItemNumber: string;
  description: string;
  unit: string;
  lowPrice: number;
  averagePrice: number;
  highPrice: number;
  totalQuantity: number;
}

export const INDOT_2025_UNIT_PRICE_SOURCE_URL =
  "https://www.in.gov/indot/doing-business-with-indot/files/CY2025-Unit-Price-Summary.xlsx";

export const INDOT_2025_UNIT_PRICE_INDEX_URL =
  "https://www.in.gov/indot/doing-business-with-indot/home/contracts/standards/indot-pay-items-listunit-price-summaries/";

export const INDOT_2025_REGIONAL_BASIS = "Indiana statewide awarded INDOT contracts";

/**
 * Small source-verified sample used as an in-code regression anchor while the
 * full workbook is parsed by scripts/parse-indot-cy2025-unit-prices.py.
 *
 * INDOT states these summaries contain high, low, and average unit bid prices
 * for pay items included in awarded INDOT projects during the prior year, with
 * prices taken from the low bid for each contract.
 *
 * These are composite installed construction prices, not raw material costs.
 * Do not map them directly to Costbook materialCostTypical, laborRate, or
 * equipmentCost. A later reviewed contract must model installed/unit-price
 * benchmark evidence explicitly before promotion into operational pricing.
 */
export const INDOT_2025_UNIT_PRICE_BENCHMARKS: readonly IndotUnitPriceBenchmark[] = [
  {
    payItemNumber: "201-01015",
    description: "CLEARING AND GRUBBING",
    unit: "LS",
    lowPrice: 5000,
    averagePrice: 33043.33,
    highPrice: 120000,
    totalQuantity: 10,
  },
  {
    payItemNumber: "203-02000",
    description: "EXCAVATION, COMMON",
    unit: "CYS",
    lowPrice: 1,
    averagePrice: 27.29,
    highPrice: 505,
    totalQuantity: 1304735,
  },
  {
    payItemNumber: "211-09194",
    description: "B BORROW",
    unit: "TON",
    lowPrice: 125,
    averagePrice: 125,
    highPrice: 125,
    totalQuantity: 10,
  },
  {
    payItemNumber: "301-12231",
    description: "COMPACTED AGGREGATE, NO. 2",
    unit: "CYS",
    lowPrice: 47,
    averagePrice: 86.71,
    highPrice: 1200,
    totalQuantity: 5909,
  },
  {
    payItemNumber: "301-12232",
    description: "COMPACTED AGGREGATE, NO. 5",
    unit: "CYS",
    lowPrice: 45,
    averagePrice: 91.9,
    highPrice: 490,
    totalQuantity: 7362,
  },
  {
    payItemNumber: "301-12234",
    description: "COMPACTED AGGREGATE, NO. 53",
    unit: "CYS",
    lowPrice: 50,
    averagePrice: 100,
    highPrice: 600,
    totalQuantity: 8000,
  },
] as const;

export function getIndot2025UnitPriceBenchmark(payItemNumber: string): IndotUnitPriceBenchmark | undefined {
  return INDOT_2025_UNIT_PRICE_BENCHMARKS.find((item) => item.payItemNumber === payItemNumber);
}
