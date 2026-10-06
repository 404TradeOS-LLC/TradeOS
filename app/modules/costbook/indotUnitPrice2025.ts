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
 * Full CY2025 INDOT weighted-average unit price summary: every pay item bid on
 * awarded INDOT contracts during 2025 — low / high / weighted-average unit prices
 * from the low bid per contract. Parsed from the official workbook 2026-10-06.
 *
 * These are composite installed construction prices, not raw material costs.
 * Do not map them directly to Costbook materialCostTypical, laborRate, or
 * equipmentCost. A later reviewed contract must model installed/unit-price
 * benchmark evidence explicitly before promotion into operational pricing.
 */
export const INDOT_2025_UNIT_PRICE_BENCHMARKS: readonly IndotUnitPriceBenchmark[] = [
  {
    payItemNumber: "105-06807", description: "ADDITIONAL",
    unit: "LS", lowPrice: 33000.0, averagePrice: 42291.92,
    highPrice: 51583.83, totalQuantity: 2,
  },
  {
    payItemNumber: "105-06845", description: "CONSTRUCTION ENGINEERING",
    unit: "LS", lowPrice: 1.0, averagePrice: 59331.22,
    highPrice: 4186322.08, totalQuantity: 354,
  },
  {
    payItemNumber: "105-09645", description: "CONSTRUCTION ENGINEERING AND INSPECTION, UTILITY RELOCATION UTILITY RELOCATION",
    unit: "LS", lowPrice: 13439.22, averagePrice: 79609.8,
    highPrice: 200000.0, totalQuantity: 4,
  },
  {
    payItemNumber: "105-11823", description: "CONSTRUCTION ENGINEERING, GPS ROVER",
    unit: "LS", lowPrice: 75000.0, averagePrice: 75000.0,
    highPrice: 75000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "105-12018", description: "UTILITY PROTECTION",
    unit: "LS", lowPrice: 7500.0, averagePrice: 7750.0,
    highPrice: 8000.0, totalQuantity: 2,
  },
  {
    payItemNumber: "106-12979", description: "E-TICKET INCENTIVE",
    unit: "EACH", lowPrice: 2.0, averagePrice: 2.0,
    highPrice: 2.0, totalQuantity: 150,
  },
  {
    payItemNumber: "107-09358", description: "INSPECTION HOLE, DEEPER THAN 3 FT",
    unit: "EACH", lowPrice: 0.01, averagePrice: 619.64,
    highPrice: 3400.0, totalQuantity: 1094,
  },
  {
    payItemNumber: "107-09367", description: "INSPECTION HOLE, 3 FT DEEP OR LESS",
    unit: "EACH", lowPrice: 1.0, averagePrice: 498.23,
    highPrice: 1700.0, totalQuantity: 534,
  },
  {
    payItemNumber: "110-01001", description: "MOBILIZATION AND DEMOBILIZATION",
    unit: "LS", lowPrice: 3000.0, averagePrice: 175839.36,
    highPrice: 5600000.0, totalQuantity: 363,
  },
  {
    payItemNumber: "110-07025", description: "MOBILIZATION AND DEMOBILIZATION",
    unit: "EACH", lowPrice: 7185.06, averagePrice: 17144.78,
    highPrice: 22500.0, totalQuantity: 22,
  },
  {
    payItemNumber: "113-01614", description: "PARTNERING OVERHEAD",
    unit: "LS", lowPrice: 10000.0, averagePrice: 36666.67,
    highPrice: 70000.0, totalQuantity: 3,
  },
  {
    payItemNumber: "201-01015", description: "CLEARING AND GRUBBING",
    unit: "LS", lowPrice: 5000.0, averagePrice: 33043.33,
    highPrice: 120000.0, totalQuantity: 10,
  },
  {
    payItemNumber: "201-02245", description: "TREE, 6 IN., REMOVE",
    unit: "EACH", lowPrice: 110.0, averagePrice: 250.78,
    highPrice: 850.0, totalQuantity: 303,
  },
  {
    payItemNumber: "201-02250", description: "TREE, 10 IN., REMOVE",
    unit: "EACH", lowPrice: 160.0, averagePrice: 417.15,
    highPrice: 2000.0, totalQuantity: 244,
  },
  {
    payItemNumber: "201-02255", description: "TREE, 18 IN., REMOVE",
    unit: "EACH", lowPrice: 250.0, averagePrice: 795.04,
    highPrice: 4000.0, totalQuantity: 287,
  },
  {
    payItemNumber: "201-02260", description: "TREE, 30 IN., REMOVE",
    unit: "EACH", lowPrice: 850.0, averagePrice: 1983.18,
    highPrice: 5000.0, totalQuantity: 127,
  },
  {
    payItemNumber: "201-02265", description: "TREE, 48 IN., REMOVE",
    unit: "EACH", lowPrice: 1200.0, averagePrice: 2436.26,
    highPrice: 10000.0, totalQuantity: 66,
  },
  {
    payItemNumber: "201-02270", description: "TREE, 60 IN., REMOVE",
    unit: "EACH", lowPrice: 3200.0, averagePrice: 6712.5,
    highPrice: 12000.0, totalQuantity: 8,
  },
  {
    payItemNumber: "201-06587", description: "CLEARING AND GRUBBING",
    unit: "ACRE", lowPrice: 5000.0, averagePrice: 24221.07,
    highPrice: 400000.0, totalQuantity: 14,
  },
  {
    payItemNumber: "201-52370", description: "CLEARING RIGHT-OF-WAY",
    unit: "LS", lowPrice: 1.0, averagePrice: 57615.74,
    highPrice: 1200000.0, totalQuantity: 278,
  },
  {
    payItemNumber: "201-90788", description: "DEBRIS, REMOVE, STRUCTURE NO.",
    unit: "LS", lowPrice: 2400.0, averagePrice: 33821.14,
    highPrice: 135000.0, totalQuantity: 22,
  },
  {
    payItemNumber: "202-01000", description: "STRUCTURES AND OBSTRUCTIONS, REMOVE",
    unit: "LS", lowPrice: 24498.04, averagePrice: 35947.99,
    highPrice: 47397.94, totalQuantity: 2,
  },
  {
    payItemNumber: "202-01073", description: "GABIONS, REMOVE",
    unit: "CYS", lowPrice: 70.0, averagePrice: 77.5,
    highPrice: 130.0, totalQuantity: 32,
  },
  {
    payItemNumber: "202-01261", description: "TESTING FOR ASBESTOS",
    unit: "EACH", lowPrice: 2000.0, averagePrice: 2000.0,
    highPrice: 2000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "202-01604", description: "ROADWAY COLUMN, REMOVE",
    unit: "EACH", lowPrice: 400.0, averagePrice: 400.0,
    highPrice: 400.0, totalQuantity: 2,
  },
  {
    payItemNumber: "202-01845", description: "CONDUIT, REMOVE",
    unit: "LFT", lowPrice: 1.5, averagePrice: 30.22,
    highPrice: 150.0, totalQuantity: 2461,
  },
  {
    payItemNumber: "202-02240", description: "PAVEMENT REMOVAL",
    unit: "SYS", lowPrice: 0.01, averagePrice: 18.7,
    highPrice: 165.5, totalQuantity: 440309,
  },
  {
    payItemNumber: "202-02271", description: "HEADWALL, REMOVE",
    unit: "EACH", lowPrice: 215.62, averagePrice: 1642.47,
    highPrice: 12000.0, totalQuantity: 49,
  },
  {
    payItemNumber: "202-02272", description: "PAVED SIDE DITCH, REMOVE",
    unit: "LFT", lowPrice: 3.0, averagePrice: 17.33,
    highPrice: 150.0, totalQuantity: 6930,
  },
  {
    payItemNumber: "202-02273", description: "CENTER CURB, CONCRETE, REMOVE",
    unit: "SYS", lowPrice: 10.0, averagePrice: 25.08,
    highPrice: 946.84, totalQuantity: 3850,
  },
  {
    payItemNumber: "202-02274", description: "CURB, CONCRETE INTEGRAL, REMOVE",
    unit: "LFT", lowPrice: 8.5, averagePrice: 13.01,
    highPrice: 15.0, totalQuantity: 2752,
  },
  {
    payItemNumber: "202-02276", description: "GUTTER TURNOUT, REINFORCED CONCRETE, REMOVE",
    unit: "EACH", lowPrice: 200.0, averagePrice: 441.61,
    highPrice: 924.83, totalQuantity: 3,
  },
  {
    payItemNumber: "202-02277", description: "GUTTER LIP, REMOVE",
    unit: "LFT", lowPrice: 40.0, averagePrice: 40.0,
    highPrice: 40.0, totalQuantity: 58,
  },
  {
    payItemNumber: "202-02278", description: "CURB, CONCRETE, REMOVE",
    unit: "LFT", lowPrice: 1.31, averagePrice: 12.27,
    highPrice: 205.0, totalQuantity: 61562,
  },
  {
    payItemNumber: "202-02279", description: "CURB AND GUTTER, REMOVE",
    unit: "LFT", lowPrice: 2.07, averagePrice: 16.88,
    highPrice: 94.26, totalQuantity: 29732,
  },
  {
    payItemNumber: "202-02637", description: "PIPE ABANDON AND GROUT FILL",
    unit: "LFT", lowPrice: 14.0, averagePrice: 56.84,
    highPrice: 245.0, totalQuantity: 17648,
  },
  {
    payItemNumber: "202-02771", description: "CONCRETE APRON, REMOVE",
    unit: "EACH", lowPrice: 1500.0, averagePrice: 1500.0,
    highPrice: 1500.0, totalQuantity: 2,
  },
  {
    payItemNumber: "202-02772", description: "CASTING, REMOVE",
    unit: "EACH", lowPrice: 100.0, averagePrice: 474.17,
    highPrice: 1100.0, totalQuantity: 30,
  },
  {
    payItemNumber: "202-02859", description: "GRATED BOX END SECTION, REMOVE",
    unit: "EACH", lowPrice: 1100.0, averagePrice: 1941.43,
    highPrice: 2600.0, totalQuantity: 7,
  },
  {
    payItemNumber: "202-02928", description: "CATCH BASIN, REMOVE",
    unit: "EACH", lowPrice: 503.0, averagePrice: 749.37,
    highPrice: 1235.0, totalQuantity: 19,
  },
  {
    payItemNumber: "202-03000", description: "HOUSES AND BUILDINGS, REMOVE, PARCEL NO.",
    unit: "LS", lowPrice: 9500.0, averagePrice: 53300.0,
    highPrice: 130000.0, totalQuantity: 5,
  },
  {
    payItemNumber: "202-03135", description: "REGULATED ASBESTOS CONTAINING MATERIALS, REMOVE",
    unit: "SFT", lowPrice: 5.1, averagePrice: 8.55,
    highPrice: 150.0, totalQuantity: 1757,
  },
  {
    payItemNumber: "202-03729", description: "REGULATED ASBESTOS CONTAINING MATERIALS, REMOVE",
    unit: "LFT", lowPrice: 50.0, averagePrice: 50.0,
    highPrice: 50.0, totalQuantity: 33,
  },
  {
    payItemNumber: "202-03875", description: "CONCRETE STEPS, REMOVE",
    unit: "EACH", lowPrice: 850.0, averagePrice: 858.33,
    highPrice: 1000.0, totalQuantity: 18,
  },
  {
    payItemNumber: "202-04126", description: "WALL, STONE, RESET",
    unit: "LFT", lowPrice: 100.0, averagePrice: 100.0,
    highPrice: 100.0, totalQuantity: 69,
  },
  {
    payItemNumber: "202-04435", description: "DELINEATOR POST, REMOVE",
    unit: "EACH", lowPrice: 32.0, averagePrice: 46.42,
    highPrice: 50.0, totalQuantity: 38,
  },
  {
    payItemNumber: "202-04486", description: "LITTER, REMOVE",
    unit: "MILE", lowPrice: 320.0, averagePrice: 439.46,
    highPrice: 600.0, totalQuantity: 682,
  },
  {
    payItemNumber: "202-04791", description: "PARKING BARRIER, REMOVE",
    unit: "EACH", lowPrice: 48.0, averagePrice: 53.38,
    highPrice: 68.0, totalQuantity: 78,
  },
  {
    payItemNumber: "202-04890", description: "WELL",
    unit: "EACH", lowPrice: 5000.0, averagePrice: 5000.0,
    highPrice: 5000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "202-04997", description: "RAILROAD",
    unit: "LS", lowPrice: 26000.0, averagePrice: 26000.0,
    highPrice: 26000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "202-05545", description: "REGULATED MATERIALS, DISPOSE, TYPE C",
    unit: "CYS", lowPrice: 85.0, averagePrice: 128.77,
    highPrice: 340.0, totalQuantity: 719,
  },
  {
    payItemNumber: "202-05550", description: "REGULATED MATERIALS, REMOVE, TYPE C",
    unit: "CYS", lowPrice: 65.0, averagePrice: 119.14,
    highPrice: 190.0, totalQuantity: 514,
  },
  {
    payItemNumber: "202-05555", description: "REGULATED MATERIALS, TRANSPORT, TYPE C",
    unit: "CYS", lowPrice: 35.0, averagePrice: 95.85,
    highPrice: 800.0, totalQuantity: 733,
  },
  {
    payItemNumber: "202-05571", description: "TESTING FOR WASTES, TYPE",
    unit: "EACH", lowPrice: 250.0, averagePrice: 4437.81,
    highPrice: 7000.0, totalQuantity: 16,
  },
  {
    payItemNumber: "202-06312", description: "REMOVE",
    unit: "SFT", lowPrice: 20.0, averagePrice: 20.0,
    highPrice: 20.0, totalQuantity: 316,
  },
  {
    payItemNumber: "202-06541", description: "REMOVE",
    unit: "EACH", lowPrice: 1950.0, averagePrice: 9000.69,
    highPrice: 18587.89, totalQuantity: 11,
  },
  {
    payItemNumber: "202-06542", description: "RELOCATE",
    unit: "EACH", lowPrice: 2497.32, averagePrice: 2497.32,
    highPrice: 2497.32, totalQuantity: 1,
  },
  {
    payItemNumber: "202-06580", description: "CONTAMINATED SOIL, REMOVE",
    unit: "CYS", lowPrice: 22.0, averagePrice: 55.84,
    highPrice: 1050.0, totalQuantity: 3890,
  },
  {
    payItemNumber: "202-07003", description: "REMOVE",
    unit: "LS", lowPrice: 2500.0, averagePrice: 3750.0,
    highPrice: 5000.0, totalQuantity: 2,
  },
  {
    payItemNumber: "202-07553", description: "REGULATED MATERIALS, REMOVE, TYPE Y",
    unit: "CYS", lowPrice: 50.0, averagePrice: 50.0,
    highPrice: 50.0, totalQuantity: 2,
  },
  {
    payItemNumber: "202-07554", description: "REGULATED MATERIALS, TRANSPORT, TYPE Y",
    unit: "CYS", lowPrice: 79.0, averagePrice: 79.02,
    highPrice: 100.0, totalQuantity: 2391,
  },
  {
    payItemNumber: "202-07555", description: "REGULATED MATERIALS, DISPOSE, TYPE Y",
    unit: "CYS", lowPrice: 64.0, averagePrice: 64.34,
    highPrice: 100.0, totalQuantity: 2450,
  },
  {
    payItemNumber: "202-07603", description: "TESTING FOR WASTES, TYPE C",
    unit: "EACH", lowPrice: 500.0, averagePrice: 1769.23,
    highPrice: 6000.0, totalQuantity: 26,
  },
  {
    payItemNumber: "202-11979", description: "WATER SYSTEM, ABANDON",
    unit: "LS", lowPrice: 52100.0, averagePrice: 52100.0,
    highPrice: 52100.0, totalQuantity: 1,
  },
  {
    payItemNumber: "202-12017", description: "SIGNAL CABLE, REMOVE",
    unit: "LFT", lowPrice: 3.25, averagePrice: 3.25,
    highPrice: 3.25, totalQuantity: 6259,
  },
  {
    payItemNumber: "202-12024", description: "CABLE BARRIER, REMOVE",
    unit: "LFT", lowPrice: 2.5, averagePrice: 2.5,
    highPrice: 2.5, totalQuantity: 1592,
  },
  {
    payItemNumber: "202-12026", description: "SAFETY TERMINAL, REMOVE",
    unit: "EACH", lowPrice: 55.0, averagePrice: 55.0,
    highPrice: 55.0, totalQuantity: 2,
  },
  {
    payItemNumber: "202-12542", description: "DEBRIS REMOVAL",
    unit: "EACH", lowPrice: 5000.0, averagePrice: 5000.0,
    highPrice: 5000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "202-12755", description: "CONTAMINATED GROUNDWATER, REMOVE",
    unit: "LS", lowPrice: 110040.11, averagePrice: 110040.11,
    highPrice: 110040.11, totalQuantity: 1,
  },
  {
    payItemNumber: "202-51133", description: "RAILING, REMOVE",
    unit: "LFT", lowPrice: 9.0, averagePrice: 21.07,
    highPrice: 90.0, totalQuantity: 478,
  },
  {
    payItemNumber: "202-51328", description: "PRESENT STRUCTURE, REMOVE PORTIONS, STRUCTURE NO. NO.",
    unit: "LS", lowPrice: 100.0, averagePrice: 131012.5,
    highPrice: 750000.0, totalQuantity: 120,
  },
  {
    payItemNumber: "202-51330", description: "PRESENT STRUCTURE, REMOVE, STRUCTURE NO.",
    unit: "LS", lowPrice: 4500.0, averagePrice: 117483.29,
    highPrice: 1600000.0, totalQuantity: 94,
  },
  {
    payItemNumber: "202-51368", description: "SLOPEWALL, REMOVE",
    unit: "SYS", lowPrice: 19.35, averagePrice: 52.45,
    highPrice: 450.0, totalQuantity: 4729,
  },
  {
    payItemNumber: "202-52710", description: "SIDEWALK CONCRETE, REMOVE",
    unit: "SYS", lowPrice: 5.0, averagePrice: 30.85,
    highPrice: 205.0, totalQuantity: 39245,
  },
  {
    payItemNumber: "202-62420", description: "BRIDGE RAILING, REMOVE",
    unit: "LFT", lowPrice: 1.0, averagePrice: 29.44,
    highPrice: 550.0, totalQuantity: 3459,
  },
  {
    payItemNumber: "202-74035", description: "SIGN, REMOVE",
    unit: "EACH", lowPrice: 25.0, averagePrice: 107.09,
    highPrice: 394.0, totalQuantity: 102,
  },
  {
    payItemNumber: "202-74045", description: "SIGN AND SUPPORTS, CHANNEL POSTS, REMOVE",
    unit: "EACH", lowPrice: 135.75, averagePrice: 169.82,
    highPrice: 175.0, totalQuantity: 20,
  },
  {
    payItemNumber: "202-74055", description: "OVERHEAD SIGN STRUCTURE, BOX TRUSS, REMOVE TRUSS, REMOVE",
    unit: "EACH", lowPrice: 20000.0, averagePrice: 21955.21,
    highPrice: 22389.7, totalQuantity: 11,
  },
  {
    payItemNumber: "202-74080", description: "OVERHEAD SIGN STRUCTURE, CANTILEVER, REMOVE CANTILEVER, REMOVE",
    unit: "EACH", lowPrice: 4832.09, averagePrice: 6972.07,
    highPrice: 7652.85, totalQuantity: 12,
  },
  {
    payItemNumber: "202-74095", description: "BRIDGE BRACKET ASSEMBLY, REMOVE",
    unit: "EACH", lowPrice: 473.0, averagePrice: 473.0,
    highPrice: 473.0, totalQuantity: 2,
  },
  {
    payItemNumber: "202-86946", description: "HANDHOLE, REMOVE",
    unit: "EACH", lowPrice: 100.0, averagePrice: 1302.69,
    highPrice: 3072.65, totalQuantity: 71,
  },
  {
    payItemNumber: "202-90277", description: "DETECTOR HOUSING, REMOVE",
    unit: "EACH", lowPrice: 50.0, averagePrice: 335.41,
    highPrice: 1024.31, totalQuantity: 439,
  },
  {
    payItemNumber: "202-90747", description: "RETAINING WALL, REMOVE",
    unit: "LFT", lowPrice: 15.0, averagePrice: 72.06,
    highPrice: 500.0, totalQuantity: 438,
  },
  {
    payItemNumber: "202-91385", description: "INLET, REMOVE",
    unit: "EACH", lowPrice: 175.0, averagePrice: 748.55,
    highPrice: 19000.0, totalQuantity: 692,
  },
  {
    payItemNumber: "202-91707", description: "LIGHT FIXTURE AND CONDUIT, REMOVE",
    unit: "EACH", lowPrice: 1372.0, averagePrice: 1372.0,
    highPrice: 1372.0, totalQuantity: 1,
  },
  {
    payItemNumber: "202-91840", description: "FENCE, CHAIN LINK, REMOVE",
    unit: "LFT", lowPrice: 4.0, averagePrice: 11.76,
    highPrice: 38.0, totalQuantity: 3321,
  },
  {
    payItemNumber: "202-91922", description: "STUMP, REMOVE",
    unit: "EACH", lowPrice: 138.24, averagePrice: 278.7,
    highPrice: 950.0, totalQuantity: 35,
  },
  {
    payItemNumber: "202-92222", description: "TESTING FOR CONTAMINATED MATERIAL RETURN",
    unit: "EACH", lowPrice: 700.0, averagePrice: 950.0,
    highPrice: 1200.0, totalQuantity: 6,
  },
  {
    payItemNumber: "202-92607", description: "SIGN POST, CHANNEL, REMOVE",
    unit: "EACH", lowPrice: 75.0, averagePrice: 75.0,
    highPrice: 75.0, totalQuantity: 1,
  },
  {
    payItemNumber: "202-93047", description: "MANHOLE, REMOVE",
    unit: "EACH", lowPrice: 250.0, averagePrice: 694.75,
    highPrice: 2650.0, totalQuantity: 156,
  },
  {
    payItemNumber: "202-93615", description: "CONCRETE, REMOVE",
    unit: "SYS", lowPrice: 20.0, averagePrice: 27.06,
    highPrice: 1442.0, totalQuantity: 590,
  },
  {
    payItemNumber: "202-93741", description: "GUARDRAIL END TREATMENT, REMOVE",
    unit: "EACH", lowPrice: 100.0, averagePrice: 655.43,
    highPrice: 2731.91, totalQuantity: 234,
  },
  {
    payItemNumber: "202-93763", description: "LIGHT STANDARD AND FOUNDATION, REMOVE",
    unit: "EACH", lowPrice: 746.77, averagePrice: 954.72,
    highPrice: 2912.82, totalQuantity: 15,
  },
  {
    payItemNumber: "202-93995", description: "SIGNAL POLE FOUNDATION, REMOVE",
    unit: "EACH", lowPrice: 1665.57, averagePrice: 2177.05,
    highPrice: 3200.0, totalQuantity: 3,
  },
  {
    payItemNumber: "202-93999", description: "SIGNAL POLE, REMOVE",
    unit: "EACH", lowPrice: 900.0, averagePrice: 1410.38,
    highPrice: 1665.57, totalQuantity: 3,
  },
  {
    payItemNumber: "202-94425", description: "APRON, REMOVE",
    unit: "SYS", lowPrice: 27.0, averagePrice: 27.0,
    highPrice: 27.0, totalQuantity: 365,
  },
  {
    payItemNumber: "202-94747", description: "POST, REMOVE",
    unit: "EACH", lowPrice: 100.0, averagePrice: 263.77,
    highPrice: 500.0, totalQuantity: 10,
  },
  {
    payItemNumber: "202-94749", description: "CURB, ASPHALT, REMOVE",
    unit: "LFT", lowPrice: 6.78, averagePrice: 9.1,
    highPrice: 9.5, totalQuantity: 2095,
  },
  {
    payItemNumber: "202-94810", description: "CURB TURNOUT, REMOVE",
    unit: "EACH", lowPrice: 934.94, averagePrice: 961.63,
    highPrice: 1015.0, totalQuantity: 3,
  },
  {
    payItemNumber: "202-94954", description: "BARRIER WALL, CONCRETE, REMOVE",
    unit: "LFT", lowPrice: 20.0, averagePrice: 36.39,
    highPrice: 142.5, totalQuantity: 20807,
  },
  {
    payItemNumber: "202-95027", description: "IMPACT ATTENUATOR, REMOVE",
    unit: "EACH", lowPrice: 1200.0, averagePrice: 2665.19,
    highPrice: 4795.57, totalQuantity: 3,
  },
  {
    payItemNumber: "202-95579", description: "SERVICE POINT, REMOVE",
    unit: "EACH", lowPrice: 100.0, averagePrice: 1235.4,
    highPrice: 2100.0, totalQuantity: 20,
  },
  {
    payItemNumber: "202-96022", description: "CONCRETE FOUNDATION, REMOVE",
    unit: "EACH", lowPrice: 3705.6, averagePrice: 3823.36,
    highPrice: 4000.0, totalQuantity: 5,
  },
  {
    payItemNumber: "202-96035", description: "CONCRETE WALL, REMOVE",
    unit: "LFT", lowPrice: 100.0, averagePrice: 144.29,
    highPrice: 255.0, totalQuantity: 56,
  },
  {
    payItemNumber: "202-96133", description: "PIPE, REMOVE",
    unit: "LFT", lowPrice: 4.25, averagePrice: 32.45,
    highPrice: 945.0, totalQuantity: 66049,
  },
  {
    payItemNumber: "202-96151", description: "TRANSPORTATION OF SALVAGEABLE ITEMS",
    unit: "LS", lowPrice: 1263.12, averagePrice: 4284.71,
    highPrice: 8391.0, totalQuantity: 3,
  },
  {
    payItemNumber: "202-96328", description: "FOUNDATION, STREET LIGHT, REMOVE",
    unit: "EACH", lowPrice: 380.0, averagePrice: 380.0,
    highPrice: 380.0, totalQuantity: 4,
  },
  {
    payItemNumber: "202-96391", description: "MAST ARM, REMOVE",
    unit: "EACH", lowPrice: 55.0, averagePrice: 517.78,
    highPrice: 650.0, totalQuantity: 9,
  },
  {
    payItemNumber: "202-96430", description: "FENCE AND POSTS, REMOVE",
    unit: "LS", lowPrice: 1559.0, averagePrice: 4186.33,
    highPrice: 6000.0, totalQuantity: 3,
  },
  {
    payItemNumber: "202-96531", description: "FENCE RIGHT-OF-WAY, REMOVE",
    unit: "LFT", lowPrice: 6.0, averagePrice: 14.64,
    highPrice: 148.0, totalQuantity: 670,
  },
  {
    payItemNumber: "202-97009", description: "FIRE HYDRANT ASSEMBLY, REMOVE",
    unit: "EACH", lowPrice: 921.0, averagePrice: 2848.8,
    highPrice: 5523.79, totalQuantity: 29,
  },
  {
    payItemNumber: "202-98370", description: "POLE, REMOVE",
    unit: "EACH", lowPrice: 629.59, averagePrice: 1091.77,
    highPrice: 1200.0, totalQuantity: 45,
  },
  {
    payItemNumber: "202-98488", description: "PIPE END SECTION, REMOVE",
    unit: "EACH", lowPrice: 110.0, averagePrice: 846.74,
    highPrice: 9500.0, totalQuantity: 118,
  },
  {
    payItemNumber: "202-99080", description: "CONCRETE, REMOVE",
    unit: "CYS", lowPrice: 2000.0, averagePrice: 2250.0,
    highPrice: 2300.0, totalQuantity: 6,
  },
  {
    payItemNumber: "202-99187", description: "FENCE, FARM FIELD, REMOVE",
    unit: "LFT", lowPrice: 2.0, averagePrice: 7.8,
    highPrice: 115.71, totalQuantity: 5881,
  },
  {
    payItemNumber: "202-99626", description: "FOUNDATION FOR SIGNING, REMOVE",
    unit: "EACH", lowPrice: 2550.0, averagePrice: 2658.33,
    highPrice: 3200.0, totalQuantity: 6,
  },
  {
    payItemNumber: "203-02000", description: "EXCAVATION, COMMON",
    unit: "CYS", lowPrice: 1.0, averagePrice: 27.29,
    highPrice: 505.0, totalQuantity: 1304735,
  },
  {
    payItemNumber: "203-02010", description: "EXCAVATION, ROCK",
    unit: "CYS", lowPrice: 109.4, averagePrice: 180.69,
    highPrice: 500.0, totalQuantity: 3596,
  },
  {
    payItemNumber: "203-02020", description: "EXCAVATION, UNCLASSIFIED",
    unit: "CYS", lowPrice: 12.0, averagePrice: 35.14,
    highPrice: 230.0, totalQuantity: 42748,
  },
  {
    payItemNumber: "203-02040", description: "EXCAVATION, Y",
    unit: "CYS", lowPrice: 189.0, averagePrice: 189.0,
    highPrice: 189.0, totalQuantity: 312,
  },
  {
    payItemNumber: "203-02055", description: "EMBANKMENT",
    unit: "CYS", lowPrice: 25.0, averagePrice: 47.62,
    highPrice: 80.0, totalQuantity: 423,
  },
  {
    payItemNumber: "203-02070", description: "BORROW",
    unit: "CYS", lowPrice: 0.01, averagePrice: 14.65,
    highPrice: 1100.0, totalQuantity: 577627,
  },
  {
    payItemNumber: "203-02100", description: "EXCAVATION, PEAT",
    unit: "CYS", lowPrice: 120.0, averagePrice: 120.0,
    highPrice: 120.0, totalQuantity: 91,
  },
  {
    payItemNumber: "203-07042", description: "EMBANKMENT FOUNDATION SOILS TREATMENT",
    unit: "SYS", lowPrice: 50.5, averagePrice: 50.5,
    highPrice: 50.5, totalQuantity: 388,
  },
  {
    payItemNumber: "203-08279", description: "EXPANDED POLYSTYRENE FILL",
    unit: "CYS", lowPrice: 190.0, averagePrice: 190.0,
    highPrice: 190.0, totalQuantity: 118,
  },
  {
    payItemNumber: "203-08607", description: "LINEAR GRADING",
    unit: "LFT", lowPrice: 1.25, averagePrice: 6.73,
    highPrice: 65.0, totalQuantity: 443850,
  },
  {
    payItemNumber: "203-09036", description: "LIGHTWEIGHT AGGREGATE",
    unit: "CYS", lowPrice: 12.0, averagePrice: 12.0,
    highPrice: 12.0, totalQuantity: 913,
  },
  {
    payItemNumber: "203-09754", description: "COHESIVE ENCASEMENT MATERIAL",
    unit: "CYS", lowPrice: 77.11, averagePrice: 77.11,
    highPrice: 77.11, totalQuantity: 173,
  },
  {
    payItemNumber: "203-51223", description: "EXCAVATION, WATERWAY",
    unit: "CYS", lowPrice: 1.0, averagePrice: 77.86,
    highPrice: 330.0, totalQuantity: 15924,
  },
  {
    payItemNumber: "204-02290", description: "SETTLEMENT PLATE",
    unit: "EACH", lowPrice: 4533.33, averagePrice: 4533.33,
    highPrice: 4533.33, totalQuantity: 6,
  },
  {
    payItemNumber: "204-08415", description: "STAKE, SETTLEMENT",
    unit: "EACH", lowPrice: 1300.0, averagePrice: 2196.66,
    highPrice: 2495.54, totalQuantity: 8,
  },
  {
    payItemNumber: "205-06933", description: "TEMPORARY INLET PROTECTION",
    unit: "EACH", lowPrice: 541.0, averagePrice: 541.0,
    highPrice: 541.0, totalQuantity: 6,
  },
  {
    payItemNumber: "205-08594", description: "FILTER SOCK",
    unit: "LFT", lowPrice: 6.5, averagePrice: 6.5,
    highPrice: 6.5, totalQuantity: 78,
  },
  {
    payItemNumber: "205-09387", description: "TEMPORARY TURBIDITY CURTAIN",
    unit: "LFT", lowPrice: 45.0, averagePrice: 52.1,
    highPrice: 62.5, totalQuantity: 535,
  },
  {
    payItemNumber: "205-11587", description: "TEMPORARY GEOTEXTILE",
    unit: "SYS", lowPrice: 2.8, averagePrice: 2.8,
    highPrice: 2.8, totalQuantity: 665,
  },
  {
    payItemNumber: "205-11626", description: "PUMP AROUND",
    unit: "EACH", lowPrice: 0.01, averagePrice: 9880.02,
    highPrice: 79000.0, totalQuantity: 433,
  },
  {
    payItemNumber: "205-12616", description: "STORMWATER MANAGEMENT IMPLEMENTATION",
    unit: "LS", lowPrice: 1.0, averagePrice: 18788.82,
    highPrice: 408600.0, totalQuantity: 284,
  },
  {
    payItemNumber: "205-12618", description: "SWQCP PREPARATION",
    unit: "LS", lowPrice: 665.0, averagePrice: 5327.77,
    highPrice: 48400.0, totalQuantity: 89,
  },
  {
    payItemNumber: "206-04301", description: "SHEET PILING, STEEL, S=18.1",
    unit: "SFT", lowPrice: 100.0, averagePrice: 100.0,
    highPrice: 100.0, totalQuantity: 336,
  },
  {
    payItemNumber: "206-11761", description: "SHEET PILING, STEEL, S=48.5",
    unit: "SFT", lowPrice: 205.0, averagePrice: 205.0,
    highPrice: 205.0, totalQuantity: 771,
  },
  {
    payItemNumber: "206-51215", description: "EXCAVATION, X",
    unit: "CYS", lowPrice: 100.0, averagePrice: 392.72,
    highPrice: 1700.0, totalQuantity: 274,
  },
  {
    payItemNumber: "206-51220", description: "EXCAVATION, WET",
    unit: "CYS", lowPrice: 25.0, averagePrice: 112.03,
    highPrice: 460.0, totalQuantity: 3082,
  },
  {
    payItemNumber: "206-51225", description: "EXCAVATION, DRY",
    unit: "CYS", lowPrice: 24.0, averagePrice: 70.84,
    highPrice: 138.34, totalQuantity: 825,
  },
  {
    payItemNumber: "206-51230", description: "EXCAVATION, FOUNDATION, UNCLASSIFIED",
    unit: "CYS", lowPrice: 20.0, averagePrice: 74.92,
    highPrice: 500.0, totalQuantity: 7868,
  },
  {
    payItemNumber: "206-51235", description: "COFFERDAM",
    unit: "LS", lowPrice: 2500.0, averagePrice: 58502.71,
    highPrice: 400517.86, totalQuantity: 76,
  },
  {
    payItemNumber: "206-51817", description: "SHEET PILING, STEEL",
    unit: "SFT", lowPrice: 68.0, averagePrice: 82.84,
    highPrice: 99.0, totalQuantity: 6030,
  },
  {
    payItemNumber: "206-93520", description: "TEMPORARY SHEET PILING",
    unit: "SFT", lowPrice: 0.01, averagePrice: 7.02,
    highPrice: 35.0, totalQuantity: 6032,
  },
  {
    payItemNumber: "207-08264", description: "SUBGRADE TREATMENT, TYPE II",
    unit: "SYS", lowPrice: 3.0, averagePrice: 22.01,
    highPrice: 450.0, totalQuantity: 267881,
  },
  {
    payItemNumber: "207-08266", description: "SUBGRADE TREATMENT, TYPE III",
    unit: "SYS", lowPrice: 0.01, averagePrice: 3.93,
    highPrice: 60.0, totalQuantity: 79020,
  },
  {
    payItemNumber: "207-09935", description: "SUBGRADE TREATMENT, TYPE IC",
    unit: "SYS", lowPrice: 5.6, averagePrice: 33.1,
    highPrice: 415.0, totalQuantity: 692751,
  },
  {
    payItemNumber: "207-12635", description: "SUBGRADE TREATMENT, TYPE IBC",
    unit: "SYS", lowPrice: 9.95, averagePrice: 14.0,
    highPrice: 36.76, totalQuantity: 900875,
  },
  {
    payItemNumber: "208-02046", description: "GRADING IN GORE AREA",
    unit: "EACH", lowPrice: 6023.0, averagePrice: 6023.0,
    highPrice: 6023.0, totalQuantity: 3,
  },
  {
    payItemNumber: "211-02050", description: "B BORROW",
    unit: "CYS", lowPrice: 0.01, averagePrice: 44.84,
    highPrice: 400.0, totalQuantity: 59485,
  },
  {
    payItemNumber: "211-06467", description: "AGGREGATE FOR END BENT BACKFILL",
    unit: "CYS", lowPrice: 80.0, averagePrice: 139.77,
    highPrice: 336.0, totalQuantity: 3486,
  },
  {
    payItemNumber: "211-09194", description: "B BORROW",
    unit: "TON", lowPrice: 125.0, averagePrice: 125.0,
    highPrice: 125.0, totalQuantity: 10,
  },
  {
    payItemNumber: "211-09264", description: "STRUCTURE BACKFILL, TYPE 1",
    unit: "CYS", lowPrice: 1.0, averagePrice: 62.75,
    highPrice: 300.0, totalQuantity: 57081,
  },
  {
    payItemNumber: "211-09265", description: "STRUCTURE BACKFILL, TYPE 2",
    unit: "CYS", lowPrice: 1.0, averagePrice: 69.36,
    highPrice: 1250.0, totalQuantity: 127236,
  },
  {
    payItemNumber: "211-09266", description: "STRUCTURE BACKFILL, TYPE 3",
    unit: "CYS", lowPrice: 61.0, averagePrice: 71.35,
    highPrice: 140.0, totalQuantity: 54494,
  },
  {
    payItemNumber: "211-09267", description: "STRUCTURE BACKFILL, TYPE 4",
    unit: "CYS", lowPrice: 213.5, averagePrice: 297.89,
    highPrice: 425.0, totalQuantity: 304,
  },
  {
    payItemNumber: "211-09268", description: "STRUCTURE BACKFILL, TYPE 5",
    unit: "CYS", lowPrice: 80.0, averagePrice: 209.82,
    highPrice: 1600.0, totalQuantity: 23701,
  },
  {
    payItemNumber: "212-06281", description: "STOCKPILED SELECTED MATERIAL",
    unit: "CYS", lowPrice: 30.0, averagePrice: 30.0,
    highPrice: 30.0, totalQuantity: 322,
  },
  {
    payItemNumber: "213-08068", description: "DRILLED HOLE FOR FLOWABLE BACKFILL",
    unit: "EACH", lowPrice: 50.0, averagePrice: 160.8,
    highPrice: 483.0, totalQuantity: 123,
  },
  {
    payItemNumber: "213-09269", description: "FLOWABLE BACKFILL, NON-REMOVABLE",
    unit: "CYS", lowPrice: 160.0, averagePrice: 275.4,
    highPrice: 1700.0, totalQuantity: 1798,
  },
  {
    payItemNumber: "213-09270", description: "FLOWABLE BACKFILL, REMOVABLE",
    unit: "CYS", lowPrice: 255.0, averagePrice: 380.73,
    highPrice: 655.0, totalQuantity: 600,
  },
  {
    payItemNumber: "214-07202", description: "GEOGRID, TYPE IA",
    unit: "SYS", lowPrice: 6.0, averagePrice: 6.0,
    highPrice: 6.0, totalQuantity: 127,
  },
  {
    payItemNumber: "214-11609", description: "GEOCELL CONFINEMENT SYSTEM",
    unit: "SYS", lowPrice: 68.0, averagePrice: 71.67,
    highPrice: 75.0, totalQuantity: 225,
  },
  {
    payItemNumber: "214-11796", description: "GEOGRID, TYPE IB",
    unit: "SYS", lowPrice: 0.1, averagePrice: 2.82,
    highPrice: 33.0, totalQuantity: 329179,
  },
  {
    payItemNumber: "214-12236", description: "GEOTEXTILE FOR PAVEMENT, TYPE 1A",
    unit: "SYS", lowPrice: 0.95, averagePrice: 1.78,
    highPrice: 4.0, totalQuantity: 7803,
  },
  {
    payItemNumber: "214-12237", description: "GEOTEXTILE FOR PAVEMENT, TYPE 1B",
    unit: "SYS", lowPrice: 0.25, averagePrice: 0.93,
    highPrice: 5.0, totalQuantity: 7230,
  },
  {
    payItemNumber: "214-12238", description: "GEOTEXTILE FOR PAVEMENT, TYPE 2A",
    unit: "SYS", lowPrice: 1.5, averagePrice: 4.05,
    highPrice: 81.97, totalQuantity: 233931,
  },
  {
    payItemNumber: "214-12239", description: "GEOTEXTILE FOR PAVEMENT, TYPE 2B",
    unit: "SYS", lowPrice: 1.5, averagePrice: 4.0,
    highPrice: 29.07, totalQuantity: 314246,
  },
  {
    payItemNumber: "214-12456", description: "GEOTEXTILE FOR PAVEMENT, INTERLAYER",
    unit: "SYS", lowPrice: 3.65, averagePrice: 4.99,
    highPrice: 6.25, totalQuantity: 71265,
  },
  {
    payItemNumber: "214-12927", description: "GEOTEXTILE FOR MOISTURE MANAGEMENT, TYPE 1MA",
    unit: "SYS", lowPrice: 4.0, averagePrice: 5.99,
    highPrice: 10.0, totalQuantity: 5233,
  },
  {
    payItemNumber: "215-12637", description: "CHEMICAL MODIFICATION, SOILS, CEMENT",
    unit: "SYS", lowPrice: 10.0, averagePrice: 12.48,
    highPrice: 17.1, totalQuantity: 63731,
  },
  {
    payItemNumber: "216-06394", description: "CELLULAR CONCRETE FILL, CLASS IV",
    unit: "CYS", lowPrice: 1120.0, averagePrice: 1120.0,
    highPrice: 1120.0, totalQuantity: 11,
  },
  {
    payItemNumber: "217-11917", description: "DRYING SOILS FOR EMBANKMENT",
    unit: "TON", lowPrice: 222.1, averagePrice: 257.18,
    highPrice: 365.0, totalQuantity: 387,
  },
  {
    payItemNumber: "301-12231", description: "COMPACTED AGGREGATE, NO. 2",
    unit: "CYS", lowPrice: 47.0, averagePrice: 86.71,
    highPrice: 1200.0, totalQuantity: 5909,
  },
  {
    payItemNumber: "301-12232", description: "COMPACTED AGGREGATE, NO. 5",
    unit: "CYS", lowPrice: 45.0, averagePrice: 91.9,
    highPrice: 490.0, totalQuantity: 7362,
  },
  {
    payItemNumber: "301-12233", description: "COMPACTED AGGREGATE, NO. 8",
    unit: "CYS", lowPrice: 35.0, averagePrice: 87.2,
    highPrice: 750.0, totalQuantity: 16679,
  },
  {
    payItemNumber: "301-12234", description: "COMPACTED AGGREGATE, NO. 53",
    unit: "CYS", lowPrice: 25.79, averagePrice: 72.68,
    highPrice: 640.0, totalQuantity: 118374,
  },
  {
    payItemNumber: "302-06464", description: "SUBBASE FOR PCCP",
    unit: "CYS", lowPrice: 50.0, averagePrice: 139.03,
    highPrice: 392.0, totalQuantity: 16814,
  },
  {
    payItemNumber: "302-07455", description: "DENSE GRADED SUBBASE",
    unit: "CYS", lowPrice: 45.0, averagePrice: 102.07,
    highPrice: 446.0, totalQuantity: 11419,
  },
  {
    payItemNumber: "302-12387", description: "AGGREGATE DRAINAGE LAYER",
    unit: "CYS", lowPrice: 63.0, averagePrice: 63.0,
    highPrice: 63.0, totalQuantity: 1000,
  },
  {
    payItemNumber: "303-000164", description: "COMPACTED AGGREGATE, FOR TRAILS",
    unit: "TON", lowPrice: 50.0, averagePrice: 50.0,
    highPrice: 50.0, totalQuantity: 104,
  },
  {
    payItemNumber: "303-01180", description: "COMPACTED AGGREGATE, NO. 53",
    unit: "TON", lowPrice: 20.0, averagePrice: 42.91,
    highPrice: 500.0, totalQuantity: 167353,
  },
  {
    payItemNumber: "303-05738", description: "AGGREGATE, NO. 5",
    unit: "TON", lowPrice: 65.0, averagePrice: 65.0,
    highPrice: 65.0, totalQuantity: 274,
  },
  {
    payItemNumber: "303-07449", description: "COMPACTED AGGREGATE, NO. 73",
    unit: "TON", lowPrice: 10.0, averagePrice: 35.28,
    highPrice: 400.0, totalQuantity: 66589,
  },
  {
    payItemNumber: "303-08210", description: "COMPACTED AGGREGATE, NO. 53, TEMPORARY FOR DRIVEWAYS",
    unit: "TON", lowPrice: 10.0, averagePrice: 29.68,
    highPrice: 147.0, totalQuantity: 18418,
  },
  {
    payItemNumber: "303-90466", description: "SUBBALLAST",
    unit: "TON", lowPrice: 103.75, averagePrice: 103.75,
    highPrice: 103.75, totalQuantity: 37,
  },
  {
    payItemNumber: "303-92491", description: "BALLAST",
    unit: "TON", lowPrice: 150.0, averagePrice: 150.0,
    highPrice: 150.0, totalQuantity: 28,
  },
  {
    payItemNumber: "304-07493", description: "WIDENING WITH HMA, TYPE B",
    unit: "TON", lowPrice: 110.0, averagePrice: 186.04,
    highPrice: 680.0, totalQuantity: 3409,
  },
  {
    payItemNumber: "304-07494", description: "WIDENING WITH HMA, TYPE C",
    unit: "TON", lowPrice: 85.0, averagePrice: 128.48,
    highPrice: 650.0, totalQuantity: 15158,
  },
  {
    payItemNumber: "304-07789", description: "WIDENING WITH HMA, TYPE D",
    unit: "TON", lowPrice: 73.0, averagePrice: 82.63,
    highPrice: 284.3, totalQuantity: 32542,
  },
  {
    payItemNumber: "304-12623", description: "HMA PATCHING, FULL DEPTH, TYPE B",
    unit: "TON", lowPrice: 100.0, averagePrice: 231.38,
    highPrice: 2000.0, totalQuantity: 16116,
  },
  {
    payItemNumber: "304-12624", description: "HMA PATCHING, PARTIAL DEPTH, TYPE B",
    unit: "TON", lowPrice: 100.0, averagePrice: 204.27,
    highPrice: 1000.0, totalQuantity: 6535,
  },
  {
    payItemNumber: "304-12625", description: "HMA PATCHING, FULL DEPTH, TYPE C",
    unit: "TON", lowPrice: 107.0, averagePrice: 179.24,
    highPrice: 950.0, totalQuantity: 73877,
  },
  {
    payItemNumber: "304-12626", description: "HMA PATCHING, PARTIAL DEPTH, TYPE C",
    unit: "TON", lowPrice: 107.0, averagePrice: 184.78,
    highPrice: 990.0, totalQuantity: 24476,
  },
  {
    payItemNumber: "304-12627", description: "HMA PATCHING, FULL DEPTH, TYPE D",
    unit: "TON", lowPrice: 114.0, averagePrice: 197.19,
    highPrice: 900.0, totalQuantity: 44470,
  },
  {
    payItemNumber: "304-12628", description: "HMA PATCHING, PARTIAL DEPTH, TYPE D",
    unit: "TON", lowPrice: 81.0, averagePrice: 177.19,
    highPrice: 716.29, totalQuantity: 19214,
  },
  {
    payItemNumber: "305-07463", description: "PCC BASE PATCHING, 8 IN.",
    unit: "SYS", lowPrice: 115.0, averagePrice: 115.0,
    highPrice: 115.0, totalQuantity: 229,
  },
  {
    payItemNumber: "305-08445", description: "PCC BASE, 4 IN.",
    unit: "SYS", lowPrice: 125.0, averagePrice: 125.0,
    highPrice: 125.0, totalQuantity: 42,
  },
  {
    payItemNumber: "305-10243", description: "PCC BASE, 7 IN.",
    unit: "SYS", lowPrice: 410.0, averagePrice: 410.0,
    highPrice: 410.0, totalQuantity: 37,
  },
  {
    payItemNumber: "305-12695", description: "LEAN CONCRETE BASE, 9 IN.",
    unit: "SYS", lowPrice: 55.0, averagePrice: 59.47,
    highPrice: 113.68, totalQuantity: 38121,
  },
  {
    payItemNumber: "306-08033", description: "MILLING, ASPHALT, 1 IN.",
    unit: "SYS", lowPrice: 1.15, averagePrice: 1.27,
    highPrice: 4.5, totalQuantity: 185696,
  },
  {
    payItemNumber: "306-08034", description: "MILLING, ASPHALT, 1 1/2 IN.",
    unit: "SYS", lowPrice: 0.75, averagePrice: 1.68,
    highPrice: 500.0, totalQuantity: 2290217,
  },
  {
    payItemNumber: "306-08036", description: "MILLING, ASPHALT, 2 IN.",
    unit: "SYS", lowPrice: 0.75, averagePrice: 1.83,
    highPrice: 36.5, totalQuantity: 3488420,
  },
  {
    payItemNumber: "306-08037", description: "MILLING, ASPHALT, 3 IN.",
    unit: "SYS", lowPrice: 1.89, averagePrice: 1.89,
    highPrice: 1.89, totalQuantity: 245,
  },
  {
    payItemNumber: "306-08038", description: "MILLING, ASPHALT, 4 IN.",
    unit: "SYS", lowPrice: 0.01, averagePrice: 2.62,
    highPrice: 22.0, totalQuantity: 895839,
  },
  {
    payItemNumber: "306-08039", description: "MILLING, ASPHALT REMOVAL",
    unit: "SYS", lowPrice: 0.01, averagePrice: 5.45,
    highPrice: 21.5, totalQuantity: 179452,
  },
  {
    payItemNumber: "306-08041", description: "MILLING, PCCP",
    unit: "SYS", lowPrice: 0.01, averagePrice: 3.05,
    highPrice: 16.0, totalQuantity: 70656,
  },
  {
    payItemNumber: "306-08042", description: "MILLING, SCARIFICATION",
    unit: "SYS", lowPrice: 1.0, averagePrice: 1.22,
    highPrice: 24.0, totalQuantity: 538953,
  },
  {
    payItemNumber: "306-08043", description: "MILLING, TRANSITION",
    unit: "SYS", lowPrice: 1.1, averagePrice: 7.38,
    highPrice: 50.0, totalQuantity: 101428,
  },
  {
    payItemNumber: "306-08159", description: "MILLING, ASPHALT",
    unit: "SYS", lowPrice: 1.65, averagePrice: 2.74,
    highPrice: 6.0, totalQuantity: 325671,
  },
  {
    payItemNumber: "306-08432", description: "MILLING, APPROACH",
    unit: "SYS", lowPrice: 1.25, averagePrice: 5.19,
    highPrice: 40.0, totalQuantity: 324988,
  },
  {
    payItemNumber: "306-10113", description: "MILLING, ASPHALT, 4 1/2 IN.",
    unit: "SYS", lowPrice: 2.45, averagePrice: 3.24,
    highPrice: 22.0, totalQuantity: 107033,
  },
  {
    payItemNumber: "306-10127", description: "MILLING, ASPHALT, 6 IN.",
    unit: "SYS", lowPrice: 2.0, averagePrice: 4.59,
    highPrice: 6.79, totalQuantity: 151410,
  },
  {
    payItemNumber: "306-10163", description: "MILLING, ASPHALT, 2 1/2 IN.",
    unit: "SYS", lowPrice: 2.53, averagePrice: 2.6,
    highPrice: 2.7, totalQuantity: 265542,
  },
  {
    payItemNumber: "306-11553", description: "MILLING, ASPHALT, 3/4 IN.",
    unit: "SYS", lowPrice: 1.76, averagePrice: 1.76,
    highPrice: 1.76, totalQuantity: 86826,
  },
  {
    payItemNumber: "306-11619", description: "MILLING, ASPHALT, 5 IN.",
    unit: "SYS", lowPrice: 2.35, averagePrice: 3.25,
    highPrice: 10.0, totalQuantity: 130097,
  },
  {
    payItemNumber: "306-11872", description: "MILLING, PROFILE",
    unit: "SYS", lowPrice: 0.39, averagePrice: 2.81,
    highPrice: 18.5, totalQuantity: 752668,
  },
  {
    payItemNumber: "307-12253", description: "CORRECTIVE AGGREGATE, FDR",
    unit: "TON", lowPrice: 18.0, averagePrice: 18.0,
    highPrice: 18.0, totalQuantity: 10708,
  },
  {
    payItemNumber: "307-12254", description: "FULL DEPTH RECLAMATION",
    unit: "SYS", lowPrice: 4.7, averagePrice: 5.41,
    highPrice: 6.5, totalQuantity: 216058,
  },
  {
    payItemNumber: "307-12256", description: "STABILIZING MATERIAL, PORTLAND CEMENT",
    unit: "TON", lowPrice: 210.0, averagePrice: 213.72,
    highPrice: 220.0, totalQuantity: 4801,
  },
  {
    payItemNumber: "308-12259", description: "STABILIZING MATERIAL, ASPHALT EMULSION",
    unit: "TON", lowPrice: 685.0, averagePrice: 685.0,
    highPrice: 685.0, totalQuantity: 1575,
  },
  {
    payItemNumber: "309-12695", description: "LEAN CONCRETE BASE, 9 IN.",
    unit: "SYS", lowPrice: 20.0, averagePrice: 88.47,
    highPrice: 165.0, totalQuantity: 2909,
  },
  {
    payItemNumber: "401-000001", description: "QC/QA-HMA, 2, 58S, SURFACE, 9.5 mm",
    unit: "TON", lowPrice: 0.01, averagePrice: 86.56,
    highPrice: 283.0, totalQuantity: 71481,
  },
  {
    payItemNumber: "401-000002", description: "QC/QA-HMA, 3, 58S, SURFACE, 9.5 mm",
    unit: "TON", lowPrice: 75.0, averagePrice: 105.01,
    highPrice: 800.0, totalQuantity: 106022,
  },
  {
    payItemNumber: "401-000003", description: "QC/QA-HMA, 4, 58S, SURFACE, 9.5 mm",
    unit: "TON", lowPrice: 178.0, averagePrice: 327.82,
    highPrice: 888.0, totalQuantity: 109,
  },
  {
    payItemNumber: "401-000004", description: "QC/QA-HMA, 2, 58H, SURFACE, 9.5 mm",
    unit: "TON", lowPrice: 96.0, averagePrice: 96.0,
    highPrice: 96.0, totalQuantity: 29,
  },
  {
    payItemNumber: "401-000005", description: "QC/QA-HMA, 3, 58H, SURFACE, 9.5 mm",
    unit: "TON", lowPrice: 72.0, averagePrice: 98.02,
    highPrice: 1000.0, totalQuantity: 391189,
  },
  {
    payItemNumber: "401-000006", description: "QC/QA-HMA, 4, 58H, SURFACE, 9.5 mm",
    unit: "TON", lowPrice: 92.0, averagePrice: 100.76,
    highPrice: 564.0, totalQuantity: 25450,
  },
  {
    payItemNumber: "401-000008", description: "QC/QA-HMA, 3, 58E, SURFACE, 9.5 mm",
    unit: "TON", lowPrice: 86.0, averagePrice: 89.79,
    highPrice: 310.0, totalQuantity: 38932,
  },
  {
    payItemNumber: "401-000009", description: "QC/QA-HMA, 4, 58E, SURFACE, 9.5 mm",
    unit: "TON", lowPrice: 84.0, averagePrice: 103.04,
    highPrice: 375.0, totalQuantity: 188126,
  },
  {
    payItemNumber: "401-000010", description: "QC/QA-HMA, 2, 58S, SURFACE, 12.5 mm",
    unit: "TON", lowPrice: 96.0, averagePrice: 96.0,
    highPrice: 96.0, totalQuantity: 6394,
  },
  {
    payItemNumber: "401-000011", description: "QC/QA-HMA, 3, 58S, SURFACE, 12.5 mm",
    unit: "TON", lowPrice: 91.0, averagePrice: 91.0,
    highPrice: 91.0, totalQuantity: 7683,
  },
  {
    payItemNumber: "401-000014", description: "QC/QA-HMA, 3, 58H, SURFACE, 12.5 mm",
    unit: "TON", lowPrice: 88.0, averagePrice: 103.45,
    highPrice: 110.0, totalQuantity: 14975,
  },
  {
    payItemNumber: "401-000020", description: "QC/QA-HMA, 3, 58S, INTERMEDIATE, 9.5 mm",
    unit: "TON", lowPrice: 175.0, averagePrice: 181.08,
    highPrice: 190.0, totalQuantity: 143,
  },
  {
    payItemNumber: "401-000028", description: "QC/QA-HMA, 2, 58S, INTERMEDIATE, 12.5 mm",
    unit: "TON", lowPrice: 70.0, averagePrice: 81.59,
    highPrice: 136.0, totalQuantity: 723,
  },
  {
    payItemNumber: "401-000029", description: "QC/QA-HMA, 3, 58S, INTERMEDIATE, 12.5 mm",
    unit: "TON", lowPrice: 72.45, averagePrice: 72.45,
    highPrice: 72.45, totalQuantity: 9409,
  },
  {
    payItemNumber: "401-000032", description: "QC/QA-HMA, 3, 58H, INTERMEDIATE, 12.5 mm",
    unit: "TON", lowPrice: 94.0, averagePrice: 94.0,
    highPrice: 94.0, totalQuantity: 13069,
  },
  {
    payItemNumber: "401-000037", description: "QC/QA-HMA, 2, 58S, INTERMEDIATE, 19.0 mm",
    unit: "TON", lowPrice: 0.01, averagePrice: 77.11,
    highPrice: 350.0, totalQuantity: 54895,
  },
  {
    payItemNumber: "401-000038", description: "QC/QA-HMA, 3, 58S, INTERMEDIATE, 19.0 mm",
    unit: "TON", lowPrice: 73.0, averagePrice: 95.92,
    highPrice: 845.35, totalQuantity: 50193,
  },
  {
    payItemNumber: "401-000039", description: "QC/QA-HMA, 4, 58S, INTERMEDIATE, 19.0 mm",
    unit: "TON", lowPrice: 197.0, averagePrice: 197.0,
    highPrice: 197.0, totalQuantity: 58,
  },
  {
    payItemNumber: "401-000040", description: "QC/QA-HMA, 2, 58H, INTERMEDIATE, 19.0 mm",
    unit: "TON", lowPrice: 87.0, averagePrice: 132.8,
    highPrice: 155.0, totalQuantity: 147,
  },
  {
    payItemNumber: "401-000041", description: "QC/QA-HMA, 3, 58H, INTERMEDIATE, 19.0 mm",
    unit: "TON", lowPrice: 70.0, averagePrice: 87.81,
    highPrice: 2500.0, totalQuantity: 194291,
  },
  {
    payItemNumber: "401-000042", description: "QC/QA-HMA, 4, 58H, INTERMEDIATE, 19.0 mm",
    unit: "TON", lowPrice: 106.0, averagePrice: 106.0,
    highPrice: 106.0, totalQuantity: 978,
  },
  {
    payItemNumber: "401-000044", description: "QC/QA-HMA, 3, 58E, INTERMEDIATE, 19.0 mm",
    unit: "TON", lowPrice: 80.0, averagePrice: 82.3,
    highPrice: 375.0, totalQuantity: 66101,
  },
  {
    payItemNumber: "401-000045", description: "QC/QA-HMA, 4, 58E, INTERMEDIATE, 19.0 mm",
    unit: "TON", lowPrice: 81.0, averagePrice: 98.25,
    highPrice: 478.0, totalQuantity: 159038,
  },
  {
    payItemNumber: "401-000046", description: "QC/QA-HMA, 2, 58S, BASE, 25.0 mm",
    unit: "TON", lowPrice: 65.0, averagePrice: 84.45,
    highPrice: 300.0, totalQuantity: 22040,
  },
  {
    payItemNumber: "401-000047", description: "QC/QA-HMA, 3, 58S, BASE, 25.0 mm",
    unit: "TON", lowPrice: 70.0, averagePrice: 98.71,
    highPrice: 845.35, totalQuantity: 117711,
  },
  {
    payItemNumber: "401-000048", description: "QC/QA-HMA, 4, 58S, BASE, 25.0 mm",
    unit: "TON", lowPrice: 72.5, averagePrice: 81.76,
    highPrice: 206.0, totalQuantity: 82312,
  },
  {
    payItemNumber: "401-000050", description: "QC/QA-HMA, 3, 58H, BASE, 25.0 mm",
    unit: "TON", lowPrice: 234.0, averagePrice: 234.0,
    highPrice: 234.0, totalQuantity: 32,
  },
  {
    payItemNumber: "401-000052", description: "QC/QA-HMA, 2, 58S, BASE, 19.0 mm",
    unit: "TON", lowPrice: 72.0, averagePrice: 96.05,
    highPrice: 252.0, totalQuantity: 13585,
  },
  {
    payItemNumber: "401-000053", description: "QC/QA-HMA, 3, 58S, BASE, 19.0 mm",
    unit: "TON", lowPrice: 71.25, averagePrice: 89.79,
    highPrice: 325.0, totalQuantity: 139283,
  },
  {
    payItemNumber: "401-000055", description: "QC/QA-HMA, 3, 58H, BASE, 19.0 mm",
    unit: "TON", lowPrice: 90.0, averagePrice: 90.0,
    highPrice: 90.0, totalQuantity: 1235,
  },
  {
    payItemNumber: "401-000056", description: "QC/QA-HMA, 4, 58S, BASE, 19.0 mm",
    unit: "TON", lowPrice: 84.57, averagePrice: 100.13,
    highPrice: 118.0, totalQuantity: 33564,
  },
  {
    payItemNumber: "401-000062", description: "QC/QA-HMA, 3, 58E, INTERMEDIATE, OG, 19.0 mm",
    unit: "TON", lowPrice: 85.0, averagePrice: 89.35,
    highPrice: 177.66, totalQuantity: 3481,
  },
  {
    payItemNumber: "401-000067", description: "QC/QA-HMA, 4, 58E, INTERMEDIATE, OG, 19.0 mm",
    unit: "TON", lowPrice: 77.0, averagePrice: 89.86,
    highPrice: 217.0, totalQuantity: 70083,
  },
  {
    payItemNumber: "401-10258", description: "JOINT ADHESIVE, SURFACE",
    unit: "LFT", lowPrice: 0.01, averagePrice: 0.53,
    highPrice: 25.0, totalQuantity: 1637652,
  },
  {
    payItemNumber: "401-10259", description: "JOINT ADHESIVE, INTERMEDIATE",
    unit: "LFT", lowPrice: 0.01, averagePrice: 0.62,
    highPrice: 14.5, totalQuantity: 1054616,
  },
  {
    payItemNumber: "401-11526", description: "JOINT ADHESIVE",
    unit: "LFT", lowPrice: 0.01, averagePrice: 0.51,
    highPrice: 54.0, totalQuantity: 1289599,
  },
  {
    payItemNumber: "401-11785", description: "LIQUID ASPHALT SEALANT",
    unit: "LFT", lowPrice: 0.01, averagePrice: 0.06,
    highPrice: 10.0, totalQuantity: 1074416,
  },
  {
    payItemNumber: "401-12169", description: "INERTIAL PROFILER, HMA",
    unit: "LS", lowPrice: 1.0, averagePrice: 6655.54,
    highPrice: 20000.0, totalQuantity: 41,
  },
  {
    payItemNumber: "401-12439", description: "VOID REDUCING ASPHALT MEMBRANE FOR HMA",
    unit: "LFT", lowPrice: 0.01, averagePrice: 3.03,
    highPrice: 16.0, totalQuantity: 3060445,
  },
  {
    payItemNumber: "401-12664", description: "HMA SPRAY PAVER EMULSION",
    unit: "TON", lowPrice: 635.0, averagePrice: 935.19,
    highPrice: 1199.06, totalQuantity: 1012,
  },
  {
    payItemNumber: "402-07451", description: "HMA WEDGE AND LEVEL, TYPE B",
    unit: "TON", lowPrice: 95.0, averagePrice: 156.38,
    highPrice: 1860.0, totalQuantity: 1537,
  },
  {
    payItemNumber: "402-07452", description: "HMA WEDGE AND LEVEL, TYPE C",
    unit: "TON", lowPrice: 80.0, averagePrice: 142.73,
    highPrice: 335.0, totalQuantity: 3712,
  },
  {
    payItemNumber: "402-07787", description: "HMA WEDGE AND LEVEL, TYPE D",
    unit: "TON", lowPrice: 335.0, averagePrice: 335.0,
    highPrice: 335.0, totalQuantity: 100,
  },
  {
    payItemNumber: "402-10084", description: "HMA FOR TEMPORARY PAVEMENT, TYPE B",
    unit: "TON", lowPrice: 77.0, averagePrice: 104.64,
    highPrice: 275.0, totalQuantity: 7014,
  },
  {
    payItemNumber: "402-10086", description: "HMA FOR TEMPORARY PAVEMENT, TYPE C",
    unit: "TON", lowPrice: 98.82, averagePrice: 127.31,
    highPrice: 393.0, totalQuantity: 8200,
  },
  {
    payItemNumber: "402-10087", description: "HMA FOR TEMPORARY PAVEMENT, TYPE D",
    unit: "TON", lowPrice: 85.0, averagePrice: 122.11,
    highPrice: 450.0, totalQuantity: 30990,
  },
  {
    payItemNumber: "404-05514", description: "SEAL COAT, TYPE 5",
    unit: "SYS", lowPrice: 12.0, averagePrice: 50.78,
    highPrice: 171.0, totalQuantity: 410,
  },
  {
    payItemNumber: "406-05520", description: "ASPHALT FOR TACK COAT",
    unit: "TON", lowPrice: 0.01, averagePrice: 649.54,
    highPrice: 3132.19, totalQuantity: 4473,
  },
  {
    payItemNumber: "406-05521", description: "ASPHALT FOR TACK COAT",
    unit: "SYS", lowPrice: 0.01, averagePrice: 0.63,
    highPrice: 6.0, totalQuantity: 404628,
  },
  {
    payItemNumber: "408-07478", description: "CRACKS AND JOINTS IN ASPHALT PAVEMENT, ROUT AND SEAL",
    unit: "TON", lowPrice: 1.0, averagePrice: 2289.91,
    highPrice: 8000.0, totalQuantity: 29,
  },
  {
    payItemNumber: "408-12028", description: "CRACKS IN ASPHALT PAVEMENT, FILL",
    unit: "TON", lowPrice: 1.0, averagePrice: 1766.25,
    highPrice: 11000.0, totalQuantity: 323,
  },
  {
    payItemNumber: "410-000073", description: "QC/QA-HMA, 4, 58E, SURFACE, 9.5 mm - SMA",
    unit: "TON", lowPrice: 132.0, averagePrice: 133.71,
    highPrice: 138.0, totalQuantity: 88526,
  },
  {
    payItemNumber: "410-12466", description: "VOID REDUCING ASPHALT MEMBRANE FOR SMA",
    unit: "LFT", lowPrice: 1.55, averagePrice: 2.3,
    highPrice: 2.85, totalQuantity: 601444,
  },
  {
    payItemNumber: "410-12665", description: "SMA SPRAY PAVER EMULSION",
    unit: "TON", lowPrice: 680.0, averagePrice: 734.54,
    highPrice: 931.52, totalQuantity: 755,
  },
  {
    payItemNumber: "411-09521", description: "MICRO-SURFACING, WARRANTED, MULTIPLE COURSE",
    unit: "SYS", lowPrice: 6.15, averagePrice: 6.15,
    highPrice: 6.15, totalQuantity: 54064,
  },
  {
    payItemNumber: "411-11461", description: "MICRO-SURFACING, WARRANTED, FOR APPROACHES, MULTIPLE COURSE MULTIPLE COURSE",
    unit: "SYS", lowPrice: 6.15, averagePrice: 6.15,
    highPrice: 6.15, totalQuantity: 3620,
  },
  {
    payItemNumber: "412-09355", description: "FOG SEAL",
    unit: "SYS", lowPrice: 0.6, averagePrice: 0.6,
    highPrice: 0.6, totalQuantity: 1989,
  },
  {
    payItemNumber: "414-11468", description: "ULTRATHIN BONDED WEARING COURSE, 9.5 mm",
    unit: "SYS", lowPrice: 7.5, averagePrice: 7.5,
    highPrice: 7.5, totalQuantity: 44854,
  },
  {
    payItemNumber: "415-11527", description: "BASE SEAL",
    unit: "TON", lowPrice: 783.04, averagePrice: 783.04,
    highPrice: 783.04, totalQuantity: 107,
  },
  {
    payItemNumber: "416-12129", description: "COLD IN-PLACE RECYCLING",
    unit: "SYS", lowPrice: 3.2, averagePrice: 3.69,
    highPrice: 4.35, totalQuantity: 400220,
  },
  {
    payItemNumber: "416-12262", description: "CORRECTIVE AGGREGATE, CIR",
    unit: "TON", lowPrice: 20.0, averagePrice: 21.29,
    highPrice: 62.0, totalQuantity: 6502,
  },
  {
    payItemNumber: "416-12263", description: "STABILIZING MATERIAL, ASPHALT EMULSION",
    unit: "TON", lowPrice: 680.0, averagePrice: 680.0,
    highPrice: 680.0, totalQuantity: 883,
  },
  {
    payItemNumber: "416-12468", description: "STABILIZING MATERIAL, PORTLAND CEMENT",
    unit: "TON", lowPrice: 240.0, averagePrice: 240.0,
    highPrice: 240.0, totalQuantity: 145,
  },
  {
    payItemNumber: "417-12211", description: "COLD CENTRAL PLANT RECYCLING",
    unit: "SYS", lowPrice: 8.5, averagePrice: 8.5,
    highPrice: 8.5, totalQuantity: 85131,
  },
  {
    payItemNumber: "417-12212", description: "CORRECTIVE AGGREGATE, CCPR",
    unit: "TON", lowPrice: 7.0, averagePrice: 7.0,
    highPrice: 7.0, totalQuantity: 1107,
  },
  {
    payItemNumber: "417-12213", description: "STABILIZING MATERIAL, ASPHALT EMULSION, CCPR",
    unit: "TON", lowPrice: 667.95, averagePrice: 667.95,
    highPrice: 667.95, totalQuantity: 767,
  },
  {
    payItemNumber: "501-06321", description: "QC/QA-PCCP, 10 IN.",
    unit: "SYS", lowPrice: 81.5, averagePrice: 94.71,
    highPrice: 104.98, totalQuantity: 45504,
  },
  {
    payItemNumber: "501-06323", description: "QC/QA-PCCP, 12 IN.",
    unit: "SYS", lowPrice: 125.89, averagePrice: 125.89,
    highPrice: 125.89, totalQuantity: 9457,
  },
  {
    payItemNumber: "501-06325", description: "QC/QA-PCCP, 14 IN.",
    unit: "SYS", lowPrice: 104.8, averagePrice: 106.49,
    highPrice: 142.0, totalQuantity: 36209,
  },
  {
    payItemNumber: "501-06326", description: "QC/QA-PCCP, 15 IN.",
    unit: "SYS", lowPrice: 230.0, averagePrice: 230.0,
    highPrice: 230.0, totalQuantity: 2532,
  },
  {
    payItemNumber: "501-09107", description: "QC/QA-PCCP, 9 IN.",
    unit: "SYS", lowPrice: 81.5, averagePrice: 81.5,
    highPrice: 81.5, totalQuantity: 21270,
  },
  {
    payItemNumber: "501-12171", description: "INERTIAL PROFILER, PCCP",
    unit: "LS", lowPrice: 10000.0, averagePrice: 14500.0,
    highPrice: 19000.0, totalQuantity: 2,
  },
  {
    payItemNumber: "501-12752", description: "QC/QA CONTINUOUS REINFORCED CONCRETE PAVEMENT, 13 IN.",
    unit: "SYS", lowPrice: 175.0, averagePrice: 175.0,
    highPrice: 175.0, totalQuantity: 33533,
  },
  {
    payItemNumber: "502-06327", description: "PCCP, 10 IN.",
    unit: "SYS", lowPrice: 83.0, averagePrice: 115.7,
    highPrice: 400.0, totalQuantity: 7048,
  },
  {
    payItemNumber: "502-06328", description: "PCCP, 11 IN.",
    unit: "SYS", lowPrice: 98.0, averagePrice: 123.12,
    highPrice: 150.0, totalQuantity: 946,
  },
  {
    payItemNumber: "502-06329", description: "PCCP, 12 IN.",
    unit: "SYS", lowPrice: 93.0, averagePrice: 113.67,
    highPrice: 225.0, totalQuantity: 10114,
  },
  {
    payItemNumber: "502-06330", description: "PCCP, 13 IN.",
    unit: "SYS", lowPrice: 150.0, averagePrice: 154.39,
    highPrice: 182.0, totalQuantity: 423,
  },
  {
    payItemNumber: "502-06331", description: "PCCP, 14 IN.",
    unit: "SYS", lowPrice: 139.0, averagePrice: 150.16,
    highPrice: 215.0, totalQuantity: 4677,
  },
  {
    payItemNumber: "502-06457", description: "PCCP, 9 IN.",
    unit: "SYS", lowPrice: 91.25, averagePrice: 102.34,
    highPrice: 120.0, totalQuantity: 4960,
  },
  {
    payItemNumber: "502-06627", description: "PCCP, 6 IN.",
    unit: "SYS", lowPrice: 57.0, averagePrice: 60.8,
    highPrice: 350.0, totalQuantity: 6779,
  },
  {
    payItemNumber: "502-06999", description: "PCCP, 8 IN.",
    unit: "SYS", lowPrice: 80.0, averagePrice: 98.33,
    highPrice: 170.0, totalQuantity: 3294,
  },
  {
    payItemNumber: "502-11543", description: "PCCP, 4 IN.",
    unit: "SYS", lowPrice: 45.0, averagePrice: 52.39,
    highPrice: 120.0, totalQuantity: 5500,
  },
  {
    payItemNumber: "502-11564", description: "PCCP, 7 IN.",
    unit: "SYS", lowPrice: 108.0, averagePrice: 127.3,
    highPrice: 254.0, totalQuantity: 948,
  },
  {
    payItemNumber: "503-03489", description: "RETROFITTED TIE BARS",
    unit: "EACH", lowPrice: 3.0, averagePrice: 45.0,
    highPrice: 272.0, totalQuantity: 9182,
  },
  {
    payItemNumber: "503-05240", description: "D-1 CONTRACTION JOINT",
    unit: "LFT", lowPrice: 4.5, averagePrice: 19.73,
    highPrice: 97.0, totalQuantity: 81087,
  },
  {
    payItemNumber: "503-09261", description: "PCCP STITCHING",
    unit: "EACH", lowPrice: 46.29, averagePrice: 46.56,
    highPrice: 224.36, totalQuantity: 9233,
  },
  {
    payItemNumber: "503-12476", description: "JOINTED REINFORCED CONCRETE PAVEMENT, 12 IN.",
    unit: "SYS", lowPrice: 175.0, averagePrice: 202.3,
    highPrice: 250.0, totalQuantity: 2982,
  },
  {
    payItemNumber: "503-12477", description: "TERMINAL JOINT, TYPE HMA",
    unit: "LFT", lowPrice: 175.17, averagePrice: 392.48,
    highPrice: 647.42, totalQuantity: 6345,
  },
  {
    payItemNumber: "503-12478", description: "TERMINAL JOINT, TYPE PCCP",
    unit: "LFT", lowPrice: 182.0, averagePrice: 310.92,
    highPrice: 425.0, totalQuantity: 1920,
  },
  {
    payItemNumber: "503-12479", description: "EXPANSION JOINT WITH LOAD TRANSFER",
    unit: "LFT", lowPrice: 16.0, averagePrice: 40.04,
    highPrice: 120.0, totalQuantity: 1416,
  },
  {
    payItemNumber: "503-12480", description: "TERMINAL JOINT, RETROFIT POLYMER MODIFIED ASPHALT",
    unit: "SFT", lowPrice: 58.0, averagePrice: 116.52,
    highPrice: 225.0, totalQuantity: 5637,
  },
  {
    payItemNumber: "503-12505", description: "JOINTED REINFORCED CONCRETE PAVEMENT, 14 IN.",
    unit: "SYS", lowPrice: 169.64, averagePrice: 188.62,
    highPrice: 204.0, totalQuantity: 1893,
  },
  {
    payItemNumber: "503-12668", description: "JOINTED REINFORCED CONCRETE PAVEMENT, 15 IN.",
    unit: "SYS", lowPrice: 255.0, averagePrice: 255.0,
    highPrice: 255.0, totalQuantity: 1126,
  },
  {
    payItemNumber: "506-06333", description: "PCCP PATCHING, FULL DEPTH",
    unit: "SYS", lowPrice: 124.0, averagePrice: 190.22,
    highPrice: 1900.0, totalQuantity: 61414,
  },
  {
    payItemNumber: "506-06334", description: "PCCP PATCHING, PARTIAL DEPTH",
    unit: "SYS", lowPrice: 155.0, averagePrice: 500.43,
    highPrice: 843.0, totalQuantity: 541,
  },
  {
    payItemNumber: "507-07482", description: "CRACKS IN PCCP, ROUT AND SEAL",
    unit: "LFT", lowPrice: 2.5, averagePrice: 7.55,
    highPrice: 100.0, totalQuantity: 2999,
  },
  {
    payItemNumber: "507-07505", description: "RETROFIT LOAD TRANSFER",
    unit: "EACH", lowPrice: 47.2, averagePrice: 198.93,
    highPrice: 815.0, totalQuantity: 211,
  },
  {
    payItemNumber: "507-08269", description: "CRACKS IN PCCP, FILLED",
    unit: "LFT", lowPrice: 1.69, averagePrice: 2.97,
    highPrice: 5.5, totalQuantity: 7541,
  },
  {
    payItemNumber: "507-08271", description: "JOINTS IN PCCP, FILLED",
    unit: "LFT", lowPrice: 1.3, averagePrice: 4.01,
    highPrice: 35.0, totalQuantity: 16241,
  },
  {
    payItemNumber: "507-08272", description: "JOINTS IN PCCP, SAW AND SEAL",
    unit: "LFT", lowPrice: 1.39, averagePrice: 4.83,
    highPrice: 35.0, totalQuantity: 12133,
  },
  {
    payItemNumber: "507-12941", description: "RCBA CRACK FILLING, PCC SEALER/HEALER",
    unit: "LFT", lowPrice: 1.0, averagePrice: 9.67,
    highPrice: 50.0, totalQuantity: 1299,
  },
  {
    payItemNumber: "508-000151", description: "RESONANCE STRENGTH METER",
    unit: "EACH", lowPrice: 266.67, averagePrice: 266.67,
    highPrice: 266.67, totalQuantity: 117,
  },
  {
    payItemNumber: "509-12191", description: "JOINT REPAIR, PARTIAL DEPTH",
    unit: "SFT", lowPrice: 50.0, averagePrice: 75.3,
    highPrice: 410.0, totalQuantity: 21736,
  },
  {
    payItemNumber: "509-12192", description: "JOINT REPAIR, BOTTOM-HALF",
    unit: "SFT", lowPrice: 20.0, averagePrice: 91.72,
    highPrice: 450.0, totalQuantity: 1625,
  },
  {
    payItemNumber: "601-000132", description: "MODIFIED W-BEAM POST",
    unit: "EACH", lowPrice: 280.0, averagePrice: 280.0,
    highPrice: 280.0, totalQuantity: 2,
  },
  {
    payItemNumber: "601-01115", description: "GUARDRAIL, W-BEAM, 1 FT 6.75 IN. SPACING",
    unit: "LFT", lowPrice: 74.0, averagePrice: 74.0,
    highPrice: 74.0, totalQuantity: 38,
  },
  {
    payItemNumber: "601-01128", description: "GUARDRAIL TRANSITION, TYPE WGB",
    unit: "EACH", lowPrice: 2190.0, averagePrice: 2651.67,
    highPrice: 3000.0, totalQuantity: 3,
  },
  {
    payItemNumber: "601-01522", description: "GUARDRAIL TRANSITION, TYPE TGB",
    unit: "EACH", lowPrice: 1975.0, averagePrice: 2830.14,
    highPrice: 3750.0, totalQuantity: 67,
  },
  {
    payItemNumber: "601-01625", description: "GUARDRAIL CONNECTOR SYSTEM, W-BEAM, CURVED, TYPE 1",
    unit: "EACH", lowPrice: 1500.0, averagePrice: 1750.0,
    highPrice: 2000.0, totalQuantity: 4,
  },
  {
    payItemNumber: "601-01626", description: "GUARDRAIL CONNECTOR SYSTEM, W-BEAM, CURVED, TYPE 2",
    unit: "EACH", lowPrice: 1500.0, averagePrice: 1956.38,
    highPrice: 2401.0, totalQuantity: 8,
  },
  {
    payItemNumber: "601-01700", description: "GUARDRAIL TERMINAL SYSTEM, W-BEAM, CURVED, TYPE 1",
    unit: "EACH", lowPrice: 2400.0, averagePrice: 2988.32,
    highPrice: 3634.05, totalQuantity: 19,
  },
  {
    payItemNumber: "601-01701", description: "GUARDRAIL TERMINAL SYSTEM, W-BEAM, CURVED, TYPE 2",
    unit: "EACH", lowPrice: 2950.0, averagePrice: 3375.0,
    highPrice: 4150.0, totalQuantity: 4,
  },
  {
    payItemNumber: "601-01740", description: "GUARDRAIL TERMINAL SYSTEM, W-BEAM, CURVED, TYPE 4",
    unit: "EACH", lowPrice: 2400.0, averagePrice: 2752.31,
    highPrice: 3200.0, totalQuantity: 13,
  },
  {
    payItemNumber: "601-01839", description: "GUARDRAIL TERMINAL SYSTEM, W-BEAM, CURVED, TYPE 6",
    unit: "EACH", lowPrice: 2410.0, averagePrice: 2902.08,
    highPrice: 3692.0, totalQuantity: 12,
  },
  {
    payItemNumber: "601-01846", description: "GUARDRAIL TERMINAL SYSTEM, W-BEAM, CURVED, TYPE 3",
    unit: "EACH", lowPrice: 2100.0, averagePrice: 2877.21,
    highPrice: 3800.0, totalQuantity: 66,
  },
  {
    payItemNumber: "601-01848", description: "GUARDRAIL TERMINAL SYSTEM, W-BEAM, CURVED, TYPE 5",
    unit: "EACH", lowPrice: 2700.0, averagePrice: 3069.22,
    highPrice: 3375.0, totalQuantity: 6,
  },
  {
    payItemNumber: "601-02103", description: "GUARDRAIL, W-BEAM, SHOP CURVED, 6 FT 3 IN. SPACING",
    unit: "LFT", lowPrice: 31.0, averagePrice: 40.79,
    highPrice: 49.7, totalQuantity: 125,
  },
  {
    payItemNumber: "601-02211", description: "GUARDRAIL POST, 8.5 LBS PER LFT, 7 FT LONG, GALVANIZED",
    unit: "EACH", lowPrice: 100.0, averagePrice: 107.13,
    highPrice: 120.0, totalQuantity: 1010,
  },
  {
    payItemNumber: "601-02241", description: "GUARDRAIL, REMOVE",
    unit: "LFT", lowPrice: 0.01, averagePrice: 3.67,
    highPrice: 60.0, totalQuantity: 215896,
  },
  {
    payItemNumber: "601-02800", description: "GUARDRAIL TRANSITION, TYPE TGT",
    unit: "EACH", lowPrice: 2350.0, averagePrice: 2350.0,
    highPrice: 2350.0, totalQuantity: 1,
  },
  {
    payItemNumber: "601-03452", description: "EXCAVATION OF DAMAGED STEEL BEAM GUARDRAIL, BURIED END SECTI ON LABOR ONLY",
    unit: "EACH", lowPrice: 610.0, averagePrice: 610.0,
    highPrice: 610.0, totalQuantity: 6,
  },
  {
    payItemNumber: "601-03453", description: "GUARDRAIL, CLAMP BAR, 7.125 IN., ALUMINUM",
    unit: "EACH", lowPrice: 37.0, averagePrice: 37.0,
    highPrice: 37.0, totalQuantity: 30,
  },
  {
    payItemNumber: "601-03456", description: "GUARDRAIL POST, WOOD, TYPE W5",
    unit: "EACH", lowPrice: 100.0, averagePrice: 104.92,
    highPrice: 116.0, totalQuantity: 26,
  },
  {
    payItemNumber: "601-03457", description: "GUARDRAIL, W THRIE-BEAM, RAIL SECTION, 12 FT 6 IN.",
    unit: "EACH", lowPrice: 325.0, averagePrice: 328.95,
    highPrice: 350.0, totalQuantity: 19,
  },
  {
    payItemNumber: "601-03464", description: "GUARDRAIL, STEEL CURVED TERMINAL END SECTION",
    unit: "EACH", lowPrice: 68.0, averagePrice: 91.82,
    highPrice: 100.0, totalQuantity: 17,
  },
  {
    payItemNumber: "601-03467", description: "ALUMINUM TO STEEL SPLICE CONNECTOR, TYPE A S",
    unit: "EACH", lowPrice: 300.0, averagePrice: 300.0,
    highPrice: 300.0, totalQuantity: 1,
  },
  {
    payItemNumber: "601-03471", description: "CAT UNIT COMPLETE WITHOUT FOUNDATION TUBES OR SOIL PLATES AB OVE GROUND COMPONENTS ONLY",
    unit: "EACH", lowPrice: 1800.0, averagePrice: 4989.61,
    highPrice: 9200.0, totalQuantity: 77,
  },
  {
    payItemNumber: "601-03599", description: "GUARDRAIL, THRIE-BEAM, RAIL SECTION, 12 FT 6 IN.",
    unit: "EACH", lowPrice: 207.0, averagePrice: 207.0,
    highPrice: 207.0, totalQuantity: 2,
  },
  {
    payItemNumber: "601-04150", description: "GUARDRAIL, THRIE-BEAM, 6 FT 3 IN. SPACING",
    unit: "LFT", lowPrice: 48.0, averagePrice: 65.22,
    highPrice: 88.0, totalQuantity: 79,
  },
  {
    payItemNumber: "601-05071", description: "GUARDRAIL TERMINAL SYSTEM, W-BEAM, CURVED, TYPE 7",
    unit: "EACH", lowPrice: 2600.0, averagePrice: 3273.0,
    highPrice: 3900.0, totalQuantity: 8,
  },
  {
    payItemNumber: "601-05585", description: "GUARDRAIL TERMINAL SYSTEM, W-BEAM, CURVED, TYPE 8",
    unit: "EACH", lowPrice: 3000.0, averagePrice: 3000.0,
    highPrice: 3000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "601-05586", description: "GUARDRAIL TERMINAL SYSTEM, W-BEAM, CURVED, TYPE 9",
    unit: "EACH", lowPrice: 2650.0, averagePrice: 3141.67,
    highPrice: 3575.0, totalQuantity: 3,
  },
  {
    payItemNumber: "601-05856", description: "CAT",
    unit: "EACH", lowPrice: 65.0, averagePrice: 439.25,
    highPrice: 2250.0, totalQuantity: 113,
  },
  {
    payItemNumber: "601-05999", description: "CURVED TERMINAL END",
    unit: "EACH", lowPrice: 150.0, averagePrice: 581.06,
    highPrice: 2000.0, totalQuantity: 5,
  },
  {
    payItemNumber: "601-06035", description: "GUARDRAIL, RESET",
    unit: "LFT", lowPrice: 8.0, averagePrice: 28.93,
    highPrice: 438.0, totalQuantity: 12477,
  },
  {
    payItemNumber: "601-06037", description: "GUARDRAIL END TREATMENT, TYPE  I",
    unit: "EACH", lowPrice: 1457.0, averagePrice: 1670.5,
    highPrice: 2495.0, totalQuantity: 6,
  },
  {
    payItemNumber: "601-06053", description: "GUARDRAIL",
    unit: "EACH", lowPrice: 30.0, averagePrice: 30.0,
    highPrice: 30.0, totalQuantity: 225,
  },
  {
    payItemNumber: "601-06233", description: "IMPACT ATTENUATOR, ED-W1, TL-3",
    unit: "EACH", lowPrice: 13000.0, averagePrice: 14114.29,
    highPrice: 19000.0, totalQuantity: 7,
  },
  {
    payItemNumber: "601-06234", description: "IMPACT ATTENUATOR, R1-W1, TL-2",
    unit: "EACH", lowPrice: 24800.0, averagePrice: 24800.0,
    highPrice: 24800.0, totalQuantity: 3,
  },
  {
    payItemNumber: "601-06238", description: "IMPACT ATTENUATOR, R1-W1, TL-3",
    unit: "EACH", lowPrice: 24000.0, averagePrice: 29500.0,
    highPrice: 35000.0, totalQuantity: 2,
  },
  {
    payItemNumber: "601-06246", description: "IMPACT ATTENUATOR, R2-W1, TL-3",
    unit: "EACH", lowPrice: 36000.0, averagePrice: 36000.0,
    highPrice: 36000.0, totalQuantity: 2,
  },
  {
    payItemNumber: "601-06248", description: "IMPACT ATTENUATOR, R2-W3, TL-3",
    unit: "EACH", lowPrice: 52000.0, averagePrice: 52000.0,
    highPrice: 52000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "601-06273", description: "GUARDRAIL END TREATMENT, TYPE SKT-350",
    unit: "EACH", lowPrice: 40.0, averagePrice: 540.1,
    highPrice: 1600.0, totalQuantity: 672,
  },
  {
    payItemNumber: "601-06289", description: "IMPACT ATTENUATOR, RESET, CR-W1, TL-3",
    unit: "EACH", lowPrice: 3300.0, averagePrice: 3300.0,
    highPrice: 3300.0, totalQuantity: 1,
  },
  {
    payItemNumber: "601-06303", description: "IMPACT ATTENUATOR, RESET, R2-W2, TL-2",
    unit: "EACH", lowPrice: 2700.0, averagePrice: 2700.0,
    highPrice: 2700.0, totalQuantity: 1,
  },
  {
    payItemNumber: "601-06306", description: "IMPACT ATTENUATOR, RESET, R2-W1, TL-3",
    unit: "EACH", lowPrice: 6655.0, averagePrice: 6655.0,
    highPrice: 6655.0, totalQuantity: 1,
  },
  {
    payItemNumber: "601-06307", description: "IMPACT ATTENUATOR, RESET, R2-W2, TL-3",
    unit: "EACH", lowPrice: 4241.0, averagePrice: 4241.0,
    highPrice: 4241.0, totalQuantity: 1,
  },
  {
    payItemNumber: "601-06374", description: "GUARDRAIL TRANSITION, TYPE TGS-1",
    unit: "EACH", lowPrice: 927.0, averagePrice: 1354.5,
    highPrice: 1650.0, totalQuantity: 40,
  },
  {
    payItemNumber: "601-06774", description: "COMBINATION ATTENUATING TERMINAL",
    unit: "EACH", lowPrice: 8000.0, averagePrice: 8000.0,
    highPrice: 8000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "601-06777", description: "GRAVEL BARREL ARRAY",
    unit: "EACH", lowPrice: 11500.0, averagePrice: 11500.0,
    highPrice: 11500.0, totalQuantity: 4,
  },
  {
    payItemNumber: "601-06798", description: "TIMBER BLOCK",
    unit: "EACH", lowPrice: 18.0, averagePrice: 19.0,
    highPrice: 20.0, totalQuantity: 4000,
  },
  {
    payItemNumber: "601-06854", description: "GUARDRAIL, W-BEAM, NESTED",
    unit: "EACH", lowPrice: 50.0, averagePrice: 2620.0,
    highPrice: 4100.0, totalQuantity: 5,
  },
  {
    payItemNumber: "601-06855", description: "GUARDRAIL, W-BEAM, CABLE TERMINAL ANCHOR",
    unit: "EACH", lowPrice: 1000.0, averagePrice: 1263.47,
    highPrice: 1450.0, totalQuantity: 17,
  },
  {
    payItemNumber: "601-07009", description: "IMPACT ATTENUATOR, LS-W1, TL-1",
    unit: "EACH", lowPrice: 25450.0, averagePrice: 27475.0,
    highPrice: 29500.0, totalQuantity: 2,
  },
  {
    payItemNumber: "601-07050", description: "GUARDRAIL END TREATMENT, TYPE OS, RESET",
    unit: "EACH", lowPrice: 1100.0, averagePrice: 1707.3,
    highPrice: 3000.0, totalQuantity: 10,
  },
  {
    payItemNumber: "601-07607", description: "IMPACT ATTENUATOR",
    unit: "EACH", lowPrice: 900.0, averagePrice: 8919.7,
    highPrice: 44000.0, totalQuantity: 66,
  },
  {
    payItemNumber: "601-08132", description: "GUARDRAIL, THRIE-BEAM, BLOCKOUT, STEEL",
    unit: "EACH", lowPrice: 85.0, averagePrice: 92.5,
    highPrice: 100.0, totalQuantity: 80,
  },
  {
    payItemNumber: "601-08133", description: "GUARDRAIL POST, STEEL, 8.5 LBS PER LFT, 10 FT",
    unit: "EACH", lowPrice: 115.0, averagePrice: 115.0,
    highPrice: 115.0, totalQuantity: 30,
  },
  {
    payItemNumber: "601-08146", description: "IMPACT ATTENUATOR, SD-W1, TL-2",
    unit: "EACH", lowPrice: 24250.0, averagePrice: 24250.0,
    highPrice: 24250.0, totalQuantity: 2,
  },
  {
    payItemNumber: "601-09146", description: "IMPACT ATTENUATOR, CR1-W1, TL-2",
    unit: "EACH", lowPrice: 2900.0, averagePrice: 2900.0,
    highPrice: 2900.0, totalQuantity: 2,
  },
  {
    payItemNumber: "601-09238", description: "HAND DIG GUARDRAIL POST HOLES",
    unit: "EACH", lowPrice: 60.0, averagePrice: 118.55,
    highPrice: 600.0, totalQuantity: 450,
  },
  {
    payItemNumber: "601-12281", description: "GUARDRAIL, MGS W-BEAM, 6 FT 3 IN. SPACING",
    unit: "LFT", lowPrice: 15.0, averagePrice: 20.72,
    highPrice: 40.0, totalQuantity: 109095,
  },
  {
    payItemNumber: "601-12282", description: "GUARDRAIL, MGS W-BEAM, 3 FT 1.5 IN. SPACING",
    unit: "LFT", lowPrice: 31.0, averagePrice: 41.27,
    highPrice: 46.0, totalQuantity: 1311,
  },
  {
    payItemNumber: "601-12283", description: "GUARDRAIL, MGS W-BEAM, 1 FT 6.75 IN. SPACING",
    unit: "LFT", lowPrice: 60.0, averagePrice: 60.0,
    highPrice: 60.0, totalQuantity: 25,
  },
  {
    payItemNumber: "601-12284", description: "GUARDRAIL, MGS W-BEAM, DOUBLE FACED, 6 FT 3 IN. SPACING",
    unit: "LFT", lowPrice: 28.0, averagePrice: 31.56,
    highPrice: 45.0, totalQuantity: 2004,
  },
  {
    payItemNumber: "601-12286", description: "GUARDRAIL, MGS W-BEAM, SHOP CURVED, 6 FT 3 IN. SPACING",
    unit: "LFT", lowPrice: 25.0, averagePrice: 33.69,
    highPrice: 40.0, totalQuantity: 253,
  },
  {
    payItemNumber: "601-12287", description: "GUARDRAIL, MGS, LONG SPAN, TYPE 1",
    unit: "EACH", lowPrice: 1075.0, averagePrice: 1642.08,
    highPrice: 2000.0, totalQuantity: 13,
  },
  {
    payItemNumber: "601-12288", description: "GUARDRAIL, MGS, LONG SPAN, TYPE 2",
    unit: "EACH", lowPrice: 1075.0, averagePrice: 1433.97,
    highPrice: 2200.0, totalQuantity: 29,
  },
  {
    payItemNumber: "601-12289", description: "GUARDRAIL HEIGHT TRANSITION, MGS",
    unit: "EACH", lowPrice: 750.0, averagePrice: 1023.37,
    highPrice: 2575.0, totalQuantity: 220,
  },
  {
    payItemNumber: "601-12291", description: "GUARDRAIL TRANSITION, MGS WITH CURB",
    unit: "EACH", lowPrice: 2600.0, averagePrice: 3280.38,
    highPrice: 4765.0, totalQuantity: 96,
  },
  {
    payItemNumber: "601-12292", description: "GUARDRAIL TRANSITION, MGS WITHOUT CURB",
    unit: "EACH", lowPrice: 2556.0, averagePrice: 3199.36,
    highPrice: 4800.0, totalQuantity: 349,
  },
  {
    payItemNumber: "601-12293", description: "GUARDRAIL, MGS, STRUCTURE TOP-MOUNTED POSTS",
    unit: "EACH", lowPrice: 360.0, averagePrice: 423.46,
    highPrice: 610.0, totalQuantity: 94,
  },
  {
    payItemNumber: "601-12294", description: "GUARDRAIL, MGS W-BEAM, CABLE TERMINAL ANCHOR",
    unit: "EACH", lowPrice: 1050.0, averagePrice: 1367.96,
    highPrice: 2000.0, totalQuantity: 55,
  },
  {
    payItemNumber: "601-12404", description: "MODIFIED MGS W-BEAM POST",
    unit: "EACH", lowPrice: 230.0, averagePrice: 270.0,
    highPrice: 550.0, totalQuantity: 11,
  },
  {
    payItemNumber: "601-12422", description: "GUARDRAIL, W-BEAM, STRUCTURE TOP-MOUNTED POSTS",
    unit: "EACH", lowPrice: 360.0, averagePrice: 425.38,
    highPrice: 530.0, totalQuantity: 13,
  },
  {
    payItemNumber: "601-12583", description: "GUARDRAIL, MGS, SIDE-MOUNTED POST, DECK",
    unit: "EACH", lowPrice: 400.0, averagePrice: 400.0,
    highPrice: 400.0, totalQuantity: 326,
  },
  {
    payItemNumber: "601-52501", description: "GUARDRAIL, POST",
    unit: "EACH", lowPrice: 30.0, averagePrice: 57.3,
    highPrice: 275.0, totalQuantity: 356,
  },
  {
    payItemNumber: "601-52540", description: "GUARDRAIL TERMINAL SECTION, W-BEAM",
    unit: "EACH", lowPrice: 88.0, averagePrice: 758.67,
    highPrice: 2100.0, totalQuantity: 3,
  },
  {
    payItemNumber: "601-61320", description: "GUARDRAIL, STEEL BEAM, CURVED SECTION, GALVANIZED, 12 GAUGE",
    unit: "LFT", lowPrice: 21.0, averagePrice: 24.0,
    highPrice: 30.0, totalQuantity: 1500,
  },
  {
    payItemNumber: "601-61340", description: "GUARDRAIL POST, 15.5 LBS PER FT, GALVANIZED, 6 FT 3 IN. LONG NG",
    unit: "EACH", lowPrice: 50.0, averagePrice: 57.88,
    highPrice: 85.0, totalQuantity: 1040,
  },
  {
    payItemNumber: "601-61350", description: "GUARDRAIL POST BRACKET, 15.5 LBS  PER LFT, GALVANIZED, 1 FT 2.25 IN.",
    unit: "EACH", lowPrice: 13.0, averagePrice: 13.0,
    highPrice: 13.0, totalQuantity: 80,
  },
  {
    payItemNumber: "601-61370", description: "GUARDRAIL POST BRACKET, 8.5 LBS PER LFT, GALVANIZED 1 FT 2.2 5 IN.",
    unit: "EACH", lowPrice: 15.0, averagePrice: 15.0,
    highPrice: 15.0, totalQuantity: 125,
  },
  {
    payItemNumber: "601-61380", description: "GUARDRAIL TERMINAL SECTION, FLAT END, GALVANIZED",
    unit: "EACH", lowPrice: 95.0, averagePrice: 122.5,
    highPrice: 150.0, totalQuantity: 2,
  },
  {
    payItemNumber: "601-61390", description: "GUARDRAIL TERMINAL END SECTION, CURVED, SINGLE FACE, GALVANI ZED",
    unit: "EACH", lowPrice: 61.0, averagePrice: 90.67,
    highPrice: 150.0, totalQuantity: 15,
  },
  {
    payItemNumber: "601-61400", description: "GUARDRAIL, BURIED END, GALVANIZED, SINGLE FACE",
    unit: "EACH", lowPrice: 1800.0, averagePrice: 1800.0,
    highPrice: 1800.0, totalQuantity: 1,
  },
  {
    payItemNumber: "601-61410", description: "GUARDRAIL TERMINAL SECTION, DOUBLE FACE, GALVANIZED",
    unit: "EACH", lowPrice: 250.0, averagePrice: 250.0,
    highPrice: 250.0, totalQuantity: 1,
  },
  {
    payItemNumber: "601-61550", description: "GUARDRAIL TERMINAL END SECTION, ALUMINUM",
    unit: "EACH", lowPrice: 210.0, averagePrice: 210.0,
    highPrice: 210.0, totalQuantity: 5,
  },
  {
    payItemNumber: "601-62070", description: "GUARDRAIL, STEEL BEAM, GALVANIZED",
    unit: "LFT", lowPrice: 14.0, averagePrice: 16.05,
    highPrice: 20.0, totalQuantity: 43000,
  },
  {
    payItemNumber: "601-62080", description: "GUARDRAIL, STEEL BEAM, CURVED SECTION, GALVANIZED",
    unit: "LFT", lowPrice: 20.0, averagePrice: 20.0,
    highPrice: 20.0, totalQuantity: 1440,
  },
  {
    payItemNumber: "601-62090", description: "GUARDRAIL, STEEL BEAM, INSTALL",
    unit: "LFT", lowPrice: 6.5, averagePrice: 6.97,
    highPrice: 7.0, totalQuantity: 265,
  },
  {
    payItemNumber: "601-62100", description: "GUARDRAIL POST, STEEL, INSTALL",
    unit: "EACH", lowPrice: 32.0, averagePrice: 37.33,
    highPrice: 40.0, totalQuantity: 15,
  },
  {
    payItemNumber: "601-62110", description: "GUARDRAIL, CHANNEL, 6.7 LBS PER LFT, INSTALL",
    unit: "LFT", lowPrice: 5.0, averagePrice: 5.67,
    highPrice: 7.0, totalQuantity: 150,
  },
  {
    payItemNumber: "601-62120", description: "GUARDRAIL POST BRACKET, INSTALL",
    unit: "EACH", lowPrice: 10.0, averagePrice: 12.54,
    highPrice: 21.0, totalQuantity: 13,
  },
  {
    payItemNumber: "601-62150", description: "GUARDRAIL POST, 15.5 LBS PER LFT, GALVANIZED, 7 FT 0 IN. LON G",
    unit: "EACH", lowPrice: 50.0, averagePrice: 50.57,
    highPrice: 85.0, totalQuantity: 122,
  },
  {
    payItemNumber: "601-62297", description: "GUARDRAIL, STANDARD TERMINAL CONNECTOR, MICHIGAN END SHOE END SHOE",
    unit: "EACH", lowPrice: 62.0, averagePrice: 120.67,
    highPrice: 150.0, totalQuantity: 3,
  },
  {
    payItemNumber: "601-62460", description: "GUARDRAIL, ANCHOR CABLE ASSEMBLY, 0.75 IN.",
    unit: "EACH", lowPrice: 108.0, averagePrice: 108.0,
    highPrice: 108.0, totalQuantity: 60,
  },
  {
    payItemNumber: "601-62530", description: "GUARDRAIL, PIER CONNECTION, ES",
    unit: "EACH", lowPrice: 130.0, averagePrice: 240.0,
    highPrice: 350.0, totalQuantity: 2,
  },
  {
    payItemNumber: "601-62540", description: "GUARDRAIL POST, PLUMB",
    unit: "EACH", lowPrice: 20.0, averagePrice: 22.83,
    highPrice: 30.0, totalQuantity: 5900,
  },
  {
    payItemNumber: "601-62550", description: "GUARDRAIL, TUBING, ELLIPTICAL, ALUMINUM",
    unit: "LFT", lowPrice: 34.0, averagePrice: 34.0,
    highPrice: 34.0, totalQuantity: 250,
  },
  {
    payItemNumber: "601-62580", description: "GUARDRAIL, SPLICE BAR, ALUMINUM",
    unit: "EACH", lowPrice: 34.0, averagePrice: 34.0,
    highPrice: 34.0, totalQuantity: 25,
  },
  {
    payItemNumber: "601-62630", description: "GUARDRAIL POST, ALUMINUM, 6 FT 3 IN.",
    unit: "EACH", lowPrice: 196.0, averagePrice: 196.0,
    highPrice: 196.0, totalQuantity: 1,
  },
  {
    payItemNumber: "601-62640", description: "GUARDRAIL POST, ALUMINUM, 5 FT 3 IN.",
    unit: "EACH", lowPrice: 196.0, averagePrice: 196.0,
    highPrice: 196.0, totalQuantity: 5,
  },
  {
    payItemNumber: "601-62680", description: "GUARDRAIL TERMINAL SECTION, SINGLE FACE, BURIED END, ALUMINU M",
    unit: "EACH", lowPrice: 700.0, averagePrice: 700.0,
    highPrice: 700.0, totalQuantity: 1,
  },
  {
    payItemNumber: "601-90382", description: "GUARDRAIL POST, ALUMINUM, 7 FT, 0 IN.",
    unit: "EACH", lowPrice: 130.0, averagePrice: 130.0,
    highPrice: 130.0, totalQuantity: 1,
  },
  {
    payItemNumber: "601-90389", description: "GUARDRAIL TERMINAL SECTION, GALVANIZED, 11 IN.",
    unit: "EACH", lowPrice: 61.0, averagePrice: 218.5,
    highPrice: 250.0, totalQuantity: 6,
  },
  {
    payItemNumber: "601-90962", description: "GUARDRAIL, EXPANSION ANCHORS, REPLACEMENT",
    unit: "EACH", lowPrice: 80.0, averagePrice: 80.0,
    highPrice: 80.0, totalQuantity: 5,
  },
  {
    payItemNumber: "601-91147", description: "GUARDRAIL END TREATMENT, RESET",
    unit: "EACH", lowPrice: 875.0, averagePrice: 2970.0,
    highPrice: 5100.0, totalQuantity: 5,
  },
  {
    payItemNumber: "601-91198", description: "GUARDRAIL POST, MODIFIED",
    unit: "EACH", lowPrice: 150.0, averagePrice: 150.0,
    highPrice: 150.0, totalQuantity: 4,
  },
  {
    payItemNumber: "601-91468", description: "GUARDRAIL POST, 8.5 LBS PER LFT, GALVANIZED, 6 FT 0 IN. LONG G",
    unit: "EACH", lowPrice: 125.0, averagePrice: 125.0,
    highPrice: 125.0, totalQuantity: 600,
  },
  {
    payItemNumber: "601-91504", description: "GUARDRAIL POST, W1, 10 IN. X 10 IN.",
    unit: "EACH", lowPrice: 115.0, averagePrice: 195.0,
    highPrice: 275.0, totalQuantity: 2,
  },
  {
    payItemNumber: "601-91505", description: "GUARDRAIL POST, W2, 8 IN. X 8 IN.",
    unit: "EACH", lowPrice: 115.0, averagePrice: 125.0,
    highPrice: 175.0, totalQuantity: 6,
  },
  {
    payItemNumber: "601-91510", description: "GUARDRAIL POST, W3, 8 IN. X 8 IN.",
    unit: "EACH", lowPrice: 115.0, averagePrice: 115.0,
    highPrice: 115.0, totalQuantity: 5,
  },
  {
    payItemNumber: "601-91511", description: "GUARDRAIL POST, W4, 8 IN. X 8 IN.",
    unit: "EACH", lowPrice: 100.0, averagePrice: 110.71,
    highPrice: 115.0, totalQuantity: 7,
  },
  {
    payItemNumber: "601-91542", description: "GUARDRAIL, BLOCKOUT, 6 IN. X 8 IN., B1",
    unit: "EACH", lowPrice: 20.0, averagePrice: 26.39,
    highPrice: 50.0, totalQuantity: 36,
  },
  {
    payItemNumber: "601-91575", description: "GUARDRAIL, BLOCKOUT, 6 IN. X 8 IN., B2",
    unit: "EACH", lowPrice: 20.0, averagePrice: 32.86,
    highPrice: 37.0, totalQuantity: 7,
  },
  {
    payItemNumber: "601-91576", description: "GUARDRAIL, BLOCKOUT, 6 IN. X 8 IN., B3",
    unit: "EACH", lowPrice: 20.0, averagePrice: 28.93,
    highPrice: 40.0, totalQuantity: 14,
  },
  {
    payItemNumber: "601-91649", description: "GUARDRAIL, THRIE-BEAM TRANSITION SECTION, GALVANIZED",
    unit: "EACH", lowPrice: 170.0, averagePrice: 361.82,
    highPrice: 500.0, totalQuantity: 22,
  },
  {
    payItemNumber: "601-91650", description: "GUARDRAIL, THRIE-BEAM EXPANSION RAIL, GALVANIZED",
    unit: "LFT", lowPrice: 125.0, averagePrice: 125.0,
    highPrice: 125.0, totalQuantity: 5,
  },
  {
    payItemNumber: "601-91653", description: "GUARDRAIL, THRIE-BEAM TERMINAL CONNECTOR, GALVANIZED",
    unit: "EACH", lowPrice: 110.0, averagePrice: 131.67,
    highPrice: 175.0, totalQuantity: 3,
  },
  {
    payItemNumber: "601-93346", description: "GUARDRAIL, CONNECTOR, AS",
    unit: "EACH", lowPrice: 160.0, averagePrice: 171.43,
    highPrice: 200.0, totalQuantity: 7,
  },
  {
    payItemNumber: "601-94689", description: "GUARDRAIL END TREATMENT, TYPE OS",
    unit: "EACH", lowPrice: 35.0, averagePrice: 2763.12,
    highPrice: 4800.0, totalQuantity: 806,
  },
  {
    payItemNumber: "601-94690", description: "GUARDRAIL END TREATMENT, TYPE MS",
    unit: "EACH", lowPrice: 43.0, averagePrice: 5545.41,
    highPrice: 9600.0, totalQuantity: 44,
  },
  {
    payItemNumber: "601-95342", description: "GUARDRAIL, SPLICE PLATE, C, GALVANIZED",
    unit: "EACH", lowPrice: 100.0, averagePrice: 141.25,
    highPrice: 200.0, totalQuantity: 8,
  },
  {
    payItemNumber: "601-95972", description: "GUARDRAIL POST (CRT), 8 IN. X 6 IN. TREATED LUMBER, 6 FT 0 I N. LONG",
    unit: "EACH", lowPrice: 120.0, averagePrice: 130.0,
    highPrice: 150.0, totalQuantity: 45,
  },
  {
    payItemNumber: "601-97080", description: "TEMPORARY GUARDRAIL END TREATMENT, TYPE OS",
    unit: "EACH", lowPrice: 4570.0, averagePrice: 4570.0,
    highPrice: 4570.0, totalQuantity: 2,
  },
  {
    payItemNumber: "601-98636", description: "GUARDRAIL, CHANNEL, 10 KG PER M, GALVANIZED, 125 MM",
    unit: "LFT", lowPrice: 9.0, averagePrice: 12.75,
    highPrice: 14.0, totalQuantity: 400,
  },
  {
    payItemNumber: "601-98637", description: "GUARDRAIL, BURIED END, TERMINAL CONNECTOR, GALVANIZED",
    unit: "EACH", lowPrice: 96.0, averagePrice: 96.0,
    highPrice: 96.0, totalQuantity: 1,
  },
  {
    payItemNumber: "601-98638", description: "GUARDRAIL, SPLICE PLATE, ALUMINUM",
    unit: "EACH", lowPrice: 87.0, averagePrice: 87.0,
    highPrice: 87.0, totalQuantity: 1,
  },
  {
    payItemNumber: "601-99105", description: "GUARDRAIL, W-BEAM, 6 FT 3 IN. SPACING",
    unit: "LFT", lowPrice: 20.0, averagePrice: 23.22,
    highPrice: 140.0, totalQuantity: 19184,
  },
  {
    payItemNumber: "601-99106", description: "GUARDRAIL, W-BEAM, 3 FT 1.5 IN. SPACING",
    unit: "LFT", lowPrice: 34.0, averagePrice: 39.04,
    highPrice: 65.0, totalQuantity: 104,
  },
  {
    payItemNumber: "601-99108", description: "GUARDRAIL, W-BEAM, DOUBLE FACED, 6 FT 3 IN. SPACING",
    unit: "LFT", lowPrice: 28.0, averagePrice: 32.0,
    highPrice: 38.0, totalQuantity: 350,
  },
  {
    payItemNumber: "601-99109", description: "GUARDRAIL, W-BEAM, DOUBLE FACED, 3 FT 1.5 IN. SPACING",
    unit: "LFT", lowPrice: 44.0, averagePrice: 44.0,
    highPrice: 44.0, totalQuantity: 50,
  },
  {
    payItemNumber: "601-99123", description: "GUARDRAIL TRANSITION, TYPE GP",
    unit: "EACH", lowPrice: 2700.0, averagePrice: 3510.0,
    highPrice: 3800.0, totalQuantity: 4,
  },
  {
    payItemNumber: "601-99132", description: "GUARDRAIL HEIGHT TRANSITION, VH, 6 FT 3 IN. SPACING",
    unit: "EACH", lowPrice: 100.0, averagePrice: 190.34,
    highPrice: 511.0, totalQuantity: 10,
  },
  {
    payItemNumber: "601-99133", description: "GUARDRAIL HEIGHT TRANSITION, VH, 12 FT 6 IN. SPACING",
    unit: "EACH", lowPrice: 200.0, averagePrice: 200.0,
    highPrice: 200.0, totalQuantity: 1,
  },
  {
    payItemNumber: "602-01064", description: "CONCRETE BARRIER",
    unit: "LFT", lowPrice: 55.0, averagePrice: 131.34,
    highPrice: 425.08, totalQuantity: 13392,
  },
  {
    payItemNumber: "602-06729", description: "BARRIER DELINEATOR",
    unit: "EACH", lowPrice: 10.0, averagePrice: 27.33,
    highPrice: 135.0, totalQuantity: 2196,
  },
  {
    payItemNumber: "602-11938", description: "CONCRETE BARRIER, MODIFIED SECTION",
    unit: "CYS", lowPrice: 769.0, averagePrice: 772.82,
    highPrice: 1987.3, totalQuantity: 2549,
  },
  {
    payItemNumber: "602-91266", description: "CONCRETE MEDIAN BARRIER, MODIFIED",
    unit: "LFT", lowPrice: 120.0, averagePrice: 217.0,
    highPrice: 380.0, totalQuantity: 3467,
  },
  {
    payItemNumber: "603-01159", description: "FENCE, CHAIN LINK, PVC COATED, 42 IN.",
    unit: "LFT", lowPrice: 102.0, averagePrice: 102.0,
    highPrice: 102.0, totalQuantity: 190,
  },
  {
    payItemNumber: "603-01932", description: "FENCE, CHAIN LINK, 96 IN.",
    unit: "LFT", lowPrice: 10.0, averagePrice: 38.77,
    highPrice: 65.0, totalQuantity: 819,
  },
  {
    payItemNumber: "603-02736", description: "FENCE, WOOD, RESET",
    unit: "LFT", lowPrice: 46.0, averagePrice: 111.85,
    highPrice: 566.0, totalQuantity: 363,
  },
  {
    payItemNumber: "603-02969", description: "FENCE GATE, RELOCATE",
    unit: "LS", lowPrice: 2787.0, averagePrice: 2787.0,
    highPrice: 2787.0, totalQuantity: 1,
  },
  {
    payItemNumber: "603-03398", description: "FENCE, RELOCATE",
    unit: "LFT", lowPrice: 23.25, averagePrice: 23.25,
    highPrice: 23.25, totalQuantity: 205,
  },
  {
    payItemNumber: "603-03829", description: "FENCE",
    unit: "LFT", lowPrice: 15.0, averagePrice: 64.09,
    highPrice: 500.0, totalQuantity: 5084,
  },
  {
    payItemNumber: "603-04160", description: "FENCE GATE, CHAIN LINK, 48 IN. X 32 FT",
    unit: "EACH", lowPrice: 5000.0, averagePrice: 5000.0,
    highPrice: 5000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "603-06040", description: "FENCE, FARM FIELD, 47 IN.",
    unit: "LFT", lowPrice: 9.0, averagePrice: 18.13,
    highPrice: 74.0, totalQuantity: 17849,
  },
  {
    payItemNumber: "603-06042", description: "FENCE, FARM FIELD, BARBED WIRE",
    unit: "LFT", lowPrice: 3.5, averagePrice: 11.0,
    highPrice: 60.23, totalQuantity: 1220,
  },
  {
    payItemNumber: "603-06045", description: "FENCE, CHAIN LINK, 48 IN.",
    unit: "LFT", lowPrice: 15.0, averagePrice: 33.21,
    highPrice: 87.0, totalQuantity: 3446,
  },
  {
    payItemNumber: "603-06052", description: "FENCE GATE, FARM FIELD, 47 IN. X 12 FT",
    unit: "EACH", lowPrice: 1186.0, averagePrice: 5896.42,
    highPrice: 6681.49, totalQuantity: 7,
  },
  {
    payItemNumber: "603-06060", description: "FENCE, FARM FIELD, RESET",
    unit: "LFT", lowPrice: 10.0, averagePrice: 27.82,
    highPrice: 151.0, totalQuantity: 4639,
  },
  {
    payItemNumber: "603-06065", description: "FENCE, CHAIN LINK, RESET",
    unit: "LFT", lowPrice: 14.0, averagePrice: 37.84,
    highPrice: 164.0, totalQuantity: 1776,
  },
  {
    payItemNumber: "603-11706", description: "FENCE, CHAIN LINK, PVC COATED, 60 IN.",
    unit: "LFT", lowPrice: 48.25, averagePrice: 48.25,
    highPrice: 48.25, totalQuantity: 626,
  },
  {
    payItemNumber: "603-11764", description: "FENCE POST",
    unit: "EACH", lowPrice: 18.0, averagePrice: 52.6,
    highPrice: 170.0, totalQuantity: 459,
  },
  {
    payItemNumber: "603-12963", description: "FENCE GATE, CHAIN LINK, PVC COATED, 60 IN. X 12 FT",
    unit: "EACH", lowPrice: 3000.0, averagePrice: 3000.0,
    highPrice: 3000.0, totalQuantity: 2,
  },
  {
    payItemNumber: "603-92636", description: "FENCE, CHAIN LINK, 72 IN.",
    unit: "LFT", lowPrice: 20.0, averagePrice: 21.82,
    highPrice: 40.0, totalQuantity: 1100,
  },
  {
    payItemNumber: "603-93373", description: "FENCE, PEDESTRIAN",
    unit: "LFT", lowPrice: 200.5, averagePrice: 462.6,
    highPrice: 470.0, totalQuantity: 2186,
  },
  {
    payItemNumber: "603-97461", description: "TEMPORARY FENCE",
    unit: "LFT", lowPrice: 12.0, averagePrice: 19.31,
    highPrice: 61.0, totalQuantity: 2211,
  },
  {
    payItemNumber: "603-98225", description: "FENCE, CHAIN LINK, PVC COATED, 48 IN.",
    unit: "LFT", lowPrice: 30.0, averagePrice: 30.0,
    highPrice: 30.0, totalQuantity: 944,
  },
  {
    payItemNumber: "604-01268", description: "HANDRAIL, ALUMINUM",
    unit: "LFT", lowPrice: 125.0, averagePrice: 125.0,
    highPrice: 125.0, totalQuantity: 72,
  },
  {
    payItemNumber: "604-02007", description: "SIDEWALK, CONCRETE, RECONSTRUCT",
    unit: "SYS", lowPrice: 164.0, averagePrice: 174.03,
    highPrice: 500.0, totalQuantity: 201,
  },
  {
    payItemNumber: "604-03643", description: "BRICK PAVERS",
    unit: "SYS", lowPrice: 262.5, averagePrice: 495.23,
    highPrice: 1200.0, totalQuantity: 61,
  },
  {
    payItemNumber: "604-04452", description: "LIMESTONE",
    unit: "CFT", lowPrice: 262.0, averagePrice: 262.0,
    highPrice: 262.0, totalQuantity: 565,
  },
  {
    payItemNumber: "604-04740", description: "PAVERS",
    unit: "SFT", lowPrice: 55.0, averagePrice: 55.0,
    highPrice: 55.0, totalQuantity: 389,
  },
  {
    payItemNumber: "604-05528", description: "HMA FOR SIDEWALK",
    unit: "TON", lowPrice: 90.0, averagePrice: 123.05,
    highPrice: 489.0, totalQuantity: 11920,
  },
  {
    payItemNumber: "604-06070", description: "SIDEWALK, CONCRETE",
    unit: "SYS", lowPrice: 20.36, averagePrice: 64.95,
    highPrice: 739.0, totalQuantity: 96140,
  },
  {
    payItemNumber: "604-07092", description: "BED COURSE MATERIAL",
    unit: "TON", lowPrice: 100.0, averagePrice: 354.1,
    highPrice: 600.0, totalQuantity: 24,
  },
  {
    payItemNumber: "604-07569", description: "PAVERS",
    unit: "SYS", lowPrice: 198.0, averagePrice: 294.97,
    highPrice: 500.0, totalQuantity: 437,
  },
  {
    payItemNumber: "604-07823", description: "STAMPED CONCRETE SIDEWALK",
    unit: "SYS", lowPrice: 125.0, averagePrice: 130.11,
    highPrice: 133.0, totalQuantity: 749,
  },
  {
    payItemNumber: "604-08086", description: "CURB RAMP, CONCRETE",
    unit: "SYS", lowPrice: 113.0, averagePrice: 208.47,
    highPrice: 825.0, totalQuantity: 16624,
  },
  {
    payItemNumber: "604-10013", description: "PERMEABLE UNIT PAVERS",
    unit: "SFT", lowPrice: 44.0, averagePrice: 47.72,
    highPrice: 200.0, totalQuantity: 6034,
  },
  {
    payItemNumber: "604-12083", description: "DETECTABLE WARNING SURFACES",
    unit: "SYS", lowPrice: 72.49, averagePrice: 299.89,
    highPrice: 539.98, totalQuantity: 2757,
  },
  {
    payItemNumber: "604-12084", description: "DETECTABLE WARNING SURFACES, RETROFIT",
    unit: "SYS", lowPrice: 410.0, averagePrice: 769.57,
    highPrice: 1600.0, totalQuantity: 23,
  },
  {
    payItemNumber: "604-44251", description: "STEPS, CONCRETE",
    unit: "CYS", lowPrice: 350.0, averagePrice: 609.4,
    highPrice: 7350.0, totalQuantity: 85,
  },
  {
    payItemNumber: "604-92237", description: "HANDRAIL, STEEL",
    unit: "LFT", lowPrice: 295.0, averagePrice: 402.25,
    highPrice: 504.0, totalQuantity: 292,
  },
  {
    payItemNumber: "604-95344", description: "HANDRAIL, PEDESTRIAN",
    unit: "LFT", lowPrice: 188.17, averagePrice: 237.6,
    highPrice: 345.0, totalQuantity: 1147,
  },
  {
    payItemNumber: "605-02278", description: "CURB, REMOVE",
    unit: "LFT", lowPrice: 12.0, averagePrice: 35.81,
    highPrice: 204.0, totalQuantity: 946,
  },
  {
    payItemNumber: "605-02493", description: "CURB, ISLAND CONCRETE",
    unit: "SYS", lowPrice: 44.75, averagePrice: 46.47,
    highPrice: 202.16, totalQuantity: 6781,
  },
  {
    payItemNumber: "605-05523", description: "CURB, HMA",
    unit: "LFT", lowPrice: 12.0, averagePrice: 31.52,
    highPrice: 81.0, totalQuantity: 2957,
  },
  {
    payItemNumber: "605-06090", description: "CURB, INTEGRAL CONCRETE",
    unit: "LFT", lowPrice: 27.0, averagePrice: 36.44,
    highPrice: 100.0, totalQuantity: 7704,
  },
  {
    payItemNumber: "605-06095", description: "CURB, INTEGRAL CONCRETE, TYPE B",
    unit: "LFT", lowPrice: 22.63, averagePrice: 28.77,
    highPrice: 200.0, totalQuantity: 5420,
  },
  {
    payItemNumber: "605-06100", description: "CURB, INTEGRAL CONCRETE, TYPE C",
    unit: "LFT", lowPrice: 50.0, averagePrice: 62.8,
    highPrice: 85.0, totalQuantity: 164,
  },
  {
    payItemNumber: "605-06105", description: "CURB, INTEGRAL CONCRETE, MODIFIED",
    unit: "LFT", lowPrice: 50.0, averagePrice: 73.93,
    highPrice: 350.0, totalQuantity: 949,
  },
  {
    payItemNumber: "605-06120", description: "CURB, CONCRETE",
    unit: "LFT", lowPrice: 23.5, averagePrice: 34.53,
    highPrice: 350.0, totalQuantity: 104240,
  },
  {
    payItemNumber: "605-06121", description: "CURB, CONCRETE, TYPE B",
    unit: "LFT", lowPrice: 13.61, averagePrice: 23.9,
    highPrice: 350.0, totalQuantity: 19690,
  },
  {
    payItemNumber: "605-06140", description: "CURB AND GUTTER, CONCRETE",
    unit: "LFT", lowPrice: 20.5, averagePrice: 31.62,
    highPrice: 332.0, totalQuantity: 250113,
  },
  {
    payItemNumber: "605-06145", description: "CURB AND GUTTER, CONCRETE, TYPE B",
    unit: "LFT", lowPrice: 24.05, averagePrice: 46.81,
    highPrice: 132.0, totalQuantity: 12319,
  },
  {
    payItemNumber: "605-06150", description: "CURB AND GUTTER, CONCRETE, TYPE C",
    unit: "LFT", lowPrice: 32.15, averagePrice: 50.15,
    highPrice: 250.0, totalQuantity: 1428,
  },
  {
    payItemNumber: "605-06200", description: "CENTER CURB, CONCRETE, TYPE A",
    unit: "LFT", lowPrice: 150.0, averagePrice: 189.53,
    highPrice: 1000.0, totalQuantity: 86,
  },
  {
    payItemNumber: "605-06205", description: "CENTER CURB, CONCRETE, TYPE B",
    unit: "LFT", lowPrice: 58.22, averagePrice: 68.82,
    highPrice: 225.0, totalQuantity: 834,
  },
  {
    payItemNumber: "605-06210", description: "CENTER CURB, CONCRETE, TYPE C",
    unit: "LFT", lowPrice: 90.0, averagePrice: 101.88,
    highPrice: 450.0, totalQuantity: 511,
  },
  {
    payItemNumber: "605-06215", description: "CENTER CURB, CONCRETE, TYPE D",
    unit: "LFT", lowPrice: 70.25, averagePrice: 78.41,
    highPrice: 400.0, totalQuantity: 888,
  },
  {
    payItemNumber: "605-06240", description: "CENTER CURB, CONCRETE, TYPE A",
    unit: "SYS", lowPrice: 109.0, averagePrice: 109.0,
    highPrice: 109.0, totalQuantity: 69,
  },
  {
    payItemNumber: "605-06245", description: "CENTER CURB, CONCRETE, TYPE B",
    unit: "SYS", lowPrice: 90.0, averagePrice: 183.35,
    highPrice: 264.71, totalQuantity: 1490,
  },
  {
    payItemNumber: "605-06250", description: "CENTER CURB, CONCRETE, TYPE C",
    unit: "SYS", lowPrice: 125.0, averagePrice: 125.0,
    highPrice: 125.0, totalQuantity: 281,
  },
  {
    payItemNumber: "605-06255", description: "CENTER CURB, CONCRETE, TYPE D",
    unit: "SYS", lowPrice: 115.69, averagePrice: 156.67,
    highPrice: 250.0, totalQuantity: 9405,
  },
  {
    payItemNumber: "605-97170", description: "CURB, PRECAST",
    unit: "LFT", lowPrice: 175.0, averagePrice: 175.0,
    highPrice: 175.0, totalQuantity: 451,
  },
  {
    payItemNumber: "605-97937", description: "CURB AND GUTTER, ROLLED CURB",
    unit: "LFT", lowPrice: 20.0, averagePrice: 29.86,
    highPrice: 350.0, totalQuantity: 12411,
  },
  {
    payItemNumber: "606-11064", description: "MILLED PCCP CORRUGATIONS, CONVENTIONAL",
    unit: "LFT", lowPrice: 2.01, averagePrice: 4.31,
    highPrice: 28.0, totalQuantity: 2767,
  },
  {
    payItemNumber: "606-12399", description: "MILLED HMA CORRUGATIONS, CONVENTIONAL",
    unit: "LFT", lowPrice: 0.28, averagePrice: 0.6,
    highPrice: 31.0, totalQuantity: 1253283,
  },
  {
    payItemNumber: "606-12400", description: "MILLED HMA CORRUGATIONS, SINUSOIDAL",
    unit: "LFT", lowPrice: 0.29, averagePrice: 0.63,
    highPrice: 38.88, totalQuantity: 1659342,
  },
  {
    payItemNumber: "607-06175", description: "GUTTER, CONCRETE, TYPE A",
    unit: "LFT", lowPrice: 42.0, averagePrice: 116.43,
    highPrice: 250.0, totalQuantity: 138,
  },
  {
    payItemNumber: "607-06335", description: "PAVED SIDE DITCH, TYPE A",
    unit: "LFT", lowPrice: 97.91, averagePrice: 163.17,
    highPrice: 280.0, totalQuantity: 248,
  },
  {
    payItemNumber: "607-06340", description: "PAVED SIDE DITCH, TYPE B",
    unit: "LFT", lowPrice: 133.25, averagePrice: 170.65,
    highPrice: 275.0, totalQuantity: 184,
  },
  {
    payItemNumber: "607-06360", description: "PAVED SIDE DITCH, TYPE F",
    unit: "LFT", lowPrice: 290.0, averagePrice: 341.35,
    highPrice: 500.0, totalQuantity: 111,
  },
  {
    payItemNumber: "607-06365", description: "PAVED SIDE DITCH, TYPE G",
    unit: "LFT", lowPrice: 8.5, averagePrice: 8.5,
    highPrice: 8.5, totalQuantity: 6593,
  },
  {
    payItemNumber: "607-06370", description: "PAVED SIDE DITCH, TYPE H",
    unit: "LFT", lowPrice: 445.0, averagePrice: 445.0,
    highPrice: 445.0, totalQuantity: 35,
  },
  {
    payItemNumber: "608-05741", description: "WICK DRAIN",
    unit: "LFT", lowPrice: 1.0, averagePrice: 1.0,
    highPrice: 1.0, totalQuantity: 109820,
  },
  {
    payItemNumber: "609-000135", description: "REINFORCED CONCRETE BRIDGE APPROACH, 6 IN.",
    unit: "SYS", lowPrice: 220.0, averagePrice: 220.0,
    highPrice: 220.0, totalQuantity: 18,
  },
  {
    payItemNumber: "609-06257", description: "REINFORCED CONCRETE BRIDGE APPROACH, 10 IN.",
    unit: "SYS", lowPrice: 140.0, averagePrice: 206.09,
    highPrice: 265.0, totalQuantity: 4755,
  },
  {
    payItemNumber: "609-06259", description: "REINFORCED CONCRETE BRIDGE APPROACH, 12 IN.",
    unit: "SYS", lowPrice: 125.0, averagePrice: 214.21,
    highPrice: 450.0, totalQuantity: 37525,
  },
  {
    payItemNumber: "609-06262", description: "REINFORCED CONCRETE BRIDGE APPROACH, 14 IN.",
    unit: "SYS", lowPrice: 160.0, averagePrice: 206.75,
    highPrice: 338.06, totalQuantity: 2586,
  },
  {
    payItemNumber: "609-06263", description: "REINFORCED CONCRETE BRIDGE APPROACH, 15 IN.",
    unit: "SYS", lowPrice: 165.0, averagePrice: 165.0,
    highPrice: 165.0, totalQuantity: 1095,
  },
  {
    payItemNumber: "610-07487", description: "HMA FOR APPROACHES, TYPE B",
    unit: "TON", lowPrice: 100.0, averagePrice: 150.74,
    highPrice: 425.0, totalQuantity: 37448,
  },
  {
    payItemNumber: "610-07488", description: "HMA FOR APPROACHES, TYPE C",
    unit: "TON", lowPrice: 105.0, averagePrice: 155.12,
    highPrice: 1271.0, totalQuantity: 21890,
  },
  {
    payItemNumber: "610-07713", description: "PCCP FOR APPROACHES, 8 IN.",
    unit: "SYS", lowPrice: 125.0, averagePrice: 125.0,
    highPrice: 125.0, totalQuantity: 446,
  },
  {
    payItemNumber: "610-07788", description: "HMA FOR APPROACHES, TYPE D",
    unit: "TON", lowPrice: 110.0, averagePrice: 144.89,
    highPrice: 358.0, totalQuantity: 7689,
  },
  {
    payItemNumber: "610-08446", description: "PCCP FOR APPROACHES, 6 IN.",
    unit: "SYS", lowPrice: 70.0, averagePrice: 98.49,
    highPrice: 225.0, totalQuantity: 18879,
  },
  {
    payItemNumber: "610-09108", description: "PCCP FOR APPROACHES, 9 IN.",
    unit: "SYS", lowPrice: 48.0, averagePrice: 108.64,
    highPrice: 560.0, totalQuantity: 41667,
  },
  {
    payItemNumber: "610-11747", description: "PCCP FOR APPROACHES, 10 IN.",
    unit: "SYS", lowPrice: 145.0, averagePrice: 145.0,
    highPrice: 145.0, totalQuantity: 371,
  },
  {
    payItemNumber: "611-02825", description: "MAILBOX ASSEMBLY, TRIPLE",
    unit: "EACH", lowPrice: 400.0, averagePrice: 542.86,
    highPrice: 750.0, totalQuantity: 7,
  },
  {
    payItemNumber: "611-06497", description: "MAILBOX ASSEMBLY, SINGLE",
    unit: "EACH", lowPrice: 165.0, averagePrice: 296.66,
    highPrice: 450.0, totalQuantity: 239,
  },
  {
    payItemNumber: "611-06498", description: "MAILBOX ASSEMBLY, DOUBLE",
    unit: "EACH", lowPrice: 365.0, averagePrice: 448.67,
    highPrice: 615.0, totalQuantity: 24,
  },
  {
    payItemNumber: "611-08232", description: "MAILBOX ASSEMBLY, RESET, SINGLE",
    unit: "EACH", lowPrice: 200.0, averagePrice: 372.11,
    highPrice: 1000.0, totalQuantity: 323,
  },
  {
    payItemNumber: "611-08233", description: "MAILBOX ASSEMBLY, RESET, DOUBLE",
    unit: "EACH", lowPrice: 375.0, averagePrice: 537.95,
    highPrice: 650.0, totalQuantity: 22,
  },
  {
    payItemNumber: "615-01469", description: "MONUMENT, SECTION CORNER, INSTALL",
    unit: "EACH", lowPrice: 995.0, averagePrice: 1730.0,
    highPrice: 3200.0, totalQuantity: 3,
  },
  {
    payItemNumber: "615-06490", description: "RIGHT-OF-WAY MARKER",
    unit: "EACH", lowPrice: 145.0, averagePrice: 207.83,
    highPrice: 700.0, totalQuantity: 2000,
  },
  {
    payItemNumber: "615-06495", description: "RIGHT-OF-WAY MARKER, RESET",
    unit: "EACH", lowPrice: 300.0, averagePrice: 650.0,
    highPrice: 1000.0, totalQuantity: 2,
  },
  {
    payItemNumber: "615-06500", description: "MONUMENT, TYPE A",
    unit: "EACH", lowPrice: 1003.0, averagePrice: 1079.32,
    highPrice: 1155.91, totalQuantity: 88,
  },
  {
    payItemNumber: "615-06505", description: "MONUMENT, TYPE B",
    unit: "EACH", lowPrice: 800.0, averagePrice: 1051.79,
    highPrice: 2500.0, totalQuantity: 851,
  },
  {
    payItemNumber: "615-06510", description: "MONUMENT, TYPE C",
    unit: "EACH", lowPrice: 375.0, averagePrice: 769.62,
    highPrice: 2175.0, totalQuantity: 118,
  },
  {
    payItemNumber: "615-06515", description: "MONUMENT, TYPE D",
    unit: "EACH", lowPrice: 110.0, averagePrice: 152.06,
    highPrice: 350.0, totalQuantity: 141,
  },
  {
    payItemNumber: "615-06520", description: "MONUMENT, RE-ESTABLISH",
    unit: "EACH", lowPrice: 1050.0, averagePrice: 1443.54,
    highPrice: 4500.0, totalQuantity: 140,
  },
  {
    payItemNumber: "615-06525", description: "CASTING ADJUST TO GRADE, MONUMENT",
    unit: "EACH", lowPrice: 1010.0, averagePrice: 1525.73,
    highPrice: 3000.0, totalQuantity: 144,
  },
  {
    payItemNumber: "615-06527", description: "MONUMENT, SECTION CORNER",
    unit: "EACH", lowPrice: 550.0, averagePrice: 956.43,
    highPrice: 1895.0, totalQuantity: 68,
  },
  {
    payItemNumber: "615-06530", description: "BENCHMARK POST",
    unit: "EACH", lowPrice: 600.0, averagePrice: 1011.35,
    highPrice: 2137.57, totalQuantity: 13,
  },
  {
    payItemNumber: "615-06535", description: "BENCHMARK POST, RESET",
    unit: "EACH", lowPrice: 325.0, averagePrice: 637.5,
    highPrice: 950.0, totalQuantity: 2,
  },
  {
    payItemNumber: "615-08351", description: "PLAQUE",
    unit: "EACH", lowPrice: 1000.0, averagePrice: 2250.0,
    highPrice: 5000.0, totalQuantity: 4,
  },
  {
    payItemNumber: "615-11537", description: "PARKING BARRIER, CONCRETE",
    unit: "EACH", lowPrice: 100.0, averagePrice: 157.14,
    highPrice: 300.0, totalQuantity: 105,
  },
  {
    payItemNumber: "616-01763", description: "RIPRAP, RELAID",
    unit: "SYS", lowPrice: 140.0, averagePrice: 140.0,
    highPrice: 140.0, totalQuantity: 272,
  },
  {
    payItemNumber: "616-02281", description: "GROUT FOR RIPRAP",
    unit: "CYS", lowPrice: 300.0, averagePrice: 338.87,
    highPrice: 640.0, totalQuantity: 1158,
  },
  {
    payItemNumber: "616-03096", description: "RIVER ROCK",
    unit: "TON", lowPrice: 100.0, averagePrice: 126.11,
    highPrice: 220.0, totalQuantity: 343,
  },
  {
    payItemNumber: "616-05688", description: "RIPRAP, CLASS 1",
    unit: "TON", lowPrice: 40.0, averagePrice: 94.03,
    highPrice: 400.0, totalQuantity: 55652,
  },
  {
    payItemNumber: "616-05689", description: "RIPRAP, CLASS 2",
    unit: "TON", lowPrice: 48.0, averagePrice: 117.07,
    highPrice: 400.0, totalQuantity: 21150,
  },
  {
    payItemNumber: "616-06025", description: "BORROW, COHESIVE",
    unit: "CYS", lowPrice: 132.0, averagePrice: 132.0,
    highPrice: 132.0, totalQuantity: 17,
  },
  {
    payItemNumber: "616-06396", description: "RIPRAP",
    unit: "TON", lowPrice: 71.0, averagePrice: 71.41,
    highPrice: 130.0, totalQuantity: 722,
  },
  {
    payItemNumber: "616-06401", description: "RIPRAP, DUMPED",
    unit: "TON", lowPrice: 375.0, averagePrice: 375.0,
    highPrice: 375.0, totalQuantity: 3,
  },
  {
    payItemNumber: "616-06405", description: "RIPRAP, REVETMENT",
    unit: "TON", lowPrice: 14.5, averagePrice: 67.87,
    highPrice: 1000.0, totalQuantity: 116369,
  },
  {
    payItemNumber: "616-06406", description: "RIPRAP, REVETMENT",
    unit: "SYS", lowPrice: 115.0, averagePrice: 115.0,
    highPrice: 115.0, totalQuantity: 402,
  },
  {
    payItemNumber: "616-06451", description: "RIPRAP, UNIFORM",
    unit: "TON", lowPrice: 38.0, averagePrice: 88.44,
    highPrice: 300.0, totalQuantity: 5549,
  },
  {
    payItemNumber: "616-06455", description: "SLOPEWALL",
    unit: "SYS", lowPrice: 1.0, averagePrice: 177.77,
    highPrice: 375.0, totalQuantity: 376,
  },
  {
    payItemNumber: "616-09395", description: "GEOMEMBRANE",
    unit: "SYS", lowPrice: 9.0, averagePrice: 16.44,
    highPrice: 84.0, totalQuantity: 4466,
  },
  {
    payItemNumber: "616-11736", description: "DECORATIVE STONE",
    unit: "TON", lowPrice: 160.0, averagePrice: 160.0,
    highPrice: 160.0, totalQuantity: 9,
  },
  {
    payItemNumber: "616-11928", description: "RIPRAP, GROUTED, 24 IN.",
    unit: "SYS", lowPrice: 30.0, averagePrice: 57.91,
    highPrice: 123.0, totalQuantity: 1966,
  },
  {
    payItemNumber: "616-11954", description: "RIPRAP, GROUTED, 30 IN.",
    unit: "SYS", lowPrice: 280.0, averagePrice: 280.0,
    highPrice: 280.0, totalQuantity: 292,
  },
  {
    payItemNumber: "616-12133", description: "RIPRAP, GROUTED, 36 IN.",
    unit: "SYS", lowPrice: 374.92, averagePrice: 475.39,
    highPrice: 526.42, totalQuantity: 190,
  },
  {
    payItemNumber: "616-12246", description: "GEOTEXTILE FOR RIPRAP, TYPE 1A",
    unit: "SYS", lowPrice: 0.66, averagePrice: 4.14,
    highPrice: 60.0, totalQuantity: 134257,
  },
  {
    payItemNumber: "616-12247", description: "GEOTEXTILE FOR RIPRAP, TYPE 1B",
    unit: "SYS", lowPrice: 1.4, averagePrice: 4.76,
    highPrice: 38.0, totalQuantity: 11830,
  },
  {
    payItemNumber: "616-12248", description: "GEOTEXTILE FOR RIPRAP, TYPE 2A",
    unit: "SYS", lowPrice: 2.0, averagePrice: 4.11,
    highPrice: 102.0, totalQuantity: 58624,
  },
  {
    payItemNumber: "616-12249", description: "GEOTEXTILE FOR RIPRAP, TYPE 2B",
    unit: "SYS", lowPrice: 1.7, averagePrice: 4.75,
    highPrice: 104.03, totalQuantity: 37967,
  },
  {
    payItemNumber: "616-12251", description: "GEOTEXTILE FOR RIPRAP, TYPE 3",
    unit: "SYS", lowPrice: 4.0, averagePrice: 5.4,
    highPrice: 78.67, totalQuantity: 4954,
  },
  {
    payItemNumber: "616-12496", description: "SLOPE PROTECTION",
    unit: "SYS", lowPrice: 52.0, averagePrice: 52.0,
    highPrice: 52.0, totalQuantity: 235,
  },
  {
    payItemNumber: "616-12903", description: "FABRIC FORMED CONCRETE REVETMENT",
    unit: "SYS", lowPrice: 155.0, averagePrice: 155.0,
    highPrice: 155.0, totalQuantity: 134,
  },
  {
    payItemNumber: "616-51366", description: "SLOPEWALL, CONCRETE, 5 IN.",
    unit: "SYS", lowPrice: 137.5, averagePrice: 165.58,
    highPrice: 175.0, totalQuantity: 1457,
  },
  {
    payItemNumber: "616-51367", description: "SLOPEWALL, CONCRETE, 4 IN.",
    unit: "SYS", lowPrice: 84.0, averagePrice: 191.09,
    highPrice: 850.0, totalQuantity: 4956,
  },
  {
    payItemNumber: "616-93019", description: "RIPRAP, GROUTED, 18 IN.",
    unit: "SYS", lowPrice: 30.0, averagePrice: 113.63,
    highPrice: 500.0, totalQuantity: 1664,
  },
  {
    payItemNumber: "616-93772", description: "INSPECTION HOLE",
    unit: "EACH", lowPrice: 138.0, averagePrice: 368.16,
    highPrice: 800.0, totalQuantity: 113,
  },
  {
    payItemNumber: "616-95754", description: "PAVED SIDE DITCH, BREAK",
    unit: "LFT", lowPrice: 3.8, averagePrice: 20.2,
    highPrice: 55.0, totalQuantity: 296,
  },
  {
    payItemNumber: "617-12128", description: "HIGH FRICTION SURFACE TREATMENT",
    unit: "SYS", lowPrice: 22.52, averagePrice: 25.67,
    highPrice: 45.3, totalQuantity: 20569,
  },
  {
    payItemNumber: "618-03812", description: "BENCH",
    unit: "EACH", lowPrice: 2500.0, averagePrice: 2607.69,
    highPrice: 2700.0, totalQuantity: 13,
  },
  {
    payItemNumber: "618-04181", description: "BICYCLE RACK",
    unit: "EACH", lowPrice: 1700.0, averagePrice: 1700.0,
    highPrice: 1700.0, totalQuantity: 6,
  },
  {
    payItemNumber: "618-12950", description: "PRECAST UNIT",
    unit: "EACH", lowPrice: 3978.0, averagePrice: 3978.0,
    highPrice: 3978.0, totalQuantity: 16,
  },
  {
    payItemNumber: "618-97672", description: "TRASH RECEPTACLE",
    unit: "EACH", lowPrice: 1500.0, averagePrice: 3884.62,
    highPrice: 5700.0, totalQuantity: 13,
  },
  {
    payItemNumber: "619-04981", description: "CLEAN AND COAT",
    unit: "LS", lowPrice: 35000.0, averagePrice: 35000.0,
    highPrice: 35000.0, totalQuantity: 2,
  },
  {
    payItemNumber: "619-11049", description: "CLEAN STEEL BRIDGE, PARTIAL, QP-1, BRIDGE NO.",
    unit: "LS", lowPrice: 10000.0, averagePrice: 14875.0,
    highPrice: 19750.0, totalQuantity: 2,
  },
  {
    payItemNumber: "619-11050", description: "CLEAN STEEL BRIDGE, PARTIAL, QP-2, BRIDGE NO.",
    unit: "LS", lowPrice: 10000.0, averagePrice: 31907.41,
    highPrice: 100000.0, totalQuantity: 27,
  },
  {
    payItemNumber: "619-11051", description: "CLEAN STEEL BRIDGE, QP-1, BRIDGE NO.",
    unit: "LS", lowPrice: 120000.0, averagePrice: 307000.0,
    highPrice: 494000.0, totalQuantity: 2,
  },
  {
    payItemNumber: "619-11052", description: "CLEAN STEEL BRIDGE, QP-2, BRIDGE NO.",
    unit: "LS", lowPrice: 25000.0, averagePrice: 191332.2,
    highPrice: 1170655.0, totalQuantity: 25,
  },
  {
    payItemNumber: "619-12459", description: "DISPOSAL OF CLEANING WASTE, HAZARDOUS, BRIDGE NO.",
    unit: "LS", lowPrice: 200.0, averagePrice: 3669.61,
    highPrice: 14000.0, totalQuantity: 56,
  },
  {
    payItemNumber: "619-12460", description: "DISPOSAL OF CLEANING WASTE, NON-HAZARDOUS, BRIDGE NO.",
    unit: "LS", lowPrice: 200.0, averagePrice: 1866.67,
    highPrice: 5000.0, totalQuantity: 6,
  },
  {
    payItemNumber: "619-12506", description: "CLEAN STEEL BRIDGE, TOP FLANGES, TYPE QP-2, BRIDGE NO.",
    unit: "LS", lowPrice: 1000.0, averagePrice: 12375.0,
    highPrice: 20000.0, totalQuantity: 8,
  },
  {
    payItemNumber: "619-12507", description: "CLEAN AND COAT STEEL PILING, BRIDGE NO.",
    unit: "LS", lowPrice: 21000.0, averagePrice: 54080.3,
    highPrice: 200000.0, totalQuantity: 10,
  },
  {
    payItemNumber: "619-51859", description: "COAT STEEL BRIDGE, BRIDGE NO.",
    unit: "LS", lowPrice: 5000.0, averagePrice: 57263.57,
    highPrice: 275000.0, totalQuantity: 28,
  },
  {
    payItemNumber: "619-51860", description: "COAT STEEL BRIDGE, PARTIAL, BRIDGE NO.",
    unit: "LS", lowPrice: 1000.0, averagePrice: 11838.43,
    highPrice: 27000.0, totalQuantity: 28,
  },
  {
    payItemNumber: "619-95315", description: "CLEAN AND COAT BEARING ASSEMBLIES, BRIDGE NO.",
    unit: "LS", lowPrice: 500.0, averagePrice: 13250.0,
    highPrice: 35000.0, totalQuantity: 6,
  },
  {
    payItemNumber: "619-98427", description: "CLEAN DRAINS",
    unit: "EACH", lowPrice: 1.0, averagePrice: 217.85,
    highPrice: 1000.0, totalQuantity: 88,
  },
  {
    payItemNumber: "620-01754", description: "SOUND BARRIER PANELS, GROUND MOUNTED TYPE",
    unit: "SFT", lowPrice: 41.88, averagePrice: 51.85,
    highPrice: 1000.0, totalQuantity: 33202,
  },
  {
    payItemNumber: "620-01756", description: "SOUND BARRIER ERECTION, GROUND MOUNTED TYPE",
    unit: "SFT", lowPrice: 10.01, averagePrice: 10.01,
    highPrice: 10.01, totalQuantity: 27301,
  },
  {
    payItemNumber: "621-01004", description: "MOBILIZATION AND DEMOBILIZATION FOR SEEDING",
    unit: "EACH", lowPrice: 50.0, averagePrice: 637.79,
    highPrice: 6500.0, totalQuantity: 754,
  },
  {
    payItemNumber: "621-02356", description: "SEEDING WETLAND",
    unit: "LBS", lowPrice: 250.65, averagePrice: 842.52,
    highPrice: 6000.0, totalQuantity: 31,
  },
  {
    payItemNumber: "621-02770", description: "EROSION CONTROL BLANKET",
    unit: "SYS", lowPrice: 1.25, averagePrice: 2.4,
    highPrice: 99.5, totalQuantity: 297034,
  },
  {
    payItemNumber: "621-03909", description: "SEED MIXTURE, NATIVE",
    unit: "LBS", lowPrice: 45.0, averagePrice: 84.51,
    highPrice: 1855.0, totalQuantity: 929,
  },
  {
    payItemNumber: "621-04258", description: "SEED MIXTURE",
    unit: "LBS", lowPrice: 197.0, averagePrice: 203.55,
    highPrice: 682.0, totalQuantity: 251,
  },
  {
    payItemNumber: "621-04978", description: "SEED MIXTURE",
    unit: "SYS", lowPrice: 3.5, averagePrice: 3.5,
    highPrice: 3.5, totalQuantity: 21400,
  },
  {
    payItemNumber: "621-06545", description: "FERTILIZER FOR PERMANENT SEEDING",
    unit: "TON", lowPrice: 5.0, averagePrice: 880.19,
    highPrice: 3435.0, totalQuantity: 128,
  },
  {
    payItemNumber: "621-06553", description: "SEED MIXTURE, TYPE R",
    unit: "LBS", lowPrice: 4.36, averagePrice: 9.42,
    highPrice: 115.0, totalQuantity: 18722,
  },
  {
    payItemNumber: "621-06554", description: "SEED MIXTURE, TYPE U",
    unit: "LBS", lowPrice: 3.59, averagePrice: 5.43,
    highPrice: 100.0, totalQuantity: 27705,
  },
  {
    payItemNumber: "621-06555", description: "SEED MIXTURE, TYPE P",
    unit: "LBS", lowPrice: 7.44, averagePrice: 7.44,
    highPrice: 7.44, totalQuantity: 112,
  },
  {
    payItemNumber: "621-06559", description: "MULCHED SEEDING, TYPE R",
    unit: "SYS", lowPrice: 0.5, averagePrice: 3.29,
    highPrice: 65.8, totalQuantity: 397332,
  },
  {
    payItemNumber: "621-06560", description: "MULCHED SEEDING, TYPE U",
    unit: "SYS", lowPrice: 0.5, averagePrice: 3.16,
    highPrice: 500.0, totalQuantity: 113486,
  },
  {
    payItemNumber: "621-06565", description: "MULCHING MATERIAL",
    unit: "TON", lowPrice: 225.0, averagePrice: 663.56,
    highPrice: 4268.0, totalQuantity: 459,
  },
  {
    payItemNumber: "621-06567", description: "WATER",
    unit: "kGAL", lowPrice: 0.01, averagePrice: 11.8,
    highPrice: 175.0, totalQuantity: 1427,
  },
  {
    payItemNumber: "621-06570", description: "TOPSOIL",
    unit: "CYS", lowPrice: 5.93, averagePrice: 57.8,
    highPrice: 450.0, totalQuantity: 34999,
  },
  {
    payItemNumber: "621-06574", description: "SODDING",
    unit: "SYS", lowPrice: 3.78, averagePrice: 11.8,
    highPrice: 775.0, totalQuantity: 79916,
  },
  {
    payItemNumber: "621-06575", description: "SODDING, NURSERY",
    unit: "SYS", lowPrice: 3.78, averagePrice: 6.95,
    highPrice: 140.0, totalQuantity: 190923,
  },
  {
    payItemNumber: "621-06737", description: "SEED MIXTURE, EMERGENT WETLAND",
    unit: "LBS", lowPrice: 200.0, averagePrice: 394.32,
    highPrice: 20300.0, totalQuantity: 111,
  },
  {
    payItemNumber: "621-07643", description: "TREE PROTECTION",
    unit: "EACH", lowPrice: 225.0, averagePrice: 225.0,
    highPrice: 225.0, totalQuantity: 42,
  },
  {
    payItemNumber: "621-07657", description: "FIBER MAT, COCONUT",
    unit: "SYS", lowPrice: 3.56, averagePrice: 4.08,
    highPrice: 5.17, totalQuantity: 8524,
  },
  {
    payItemNumber: "621-07762", description: "COMPOST AMENDED SOIL",
    unit: "CYS", lowPrice: 100.0, averagePrice: 108.52,
    highPrice: 316.0, totalQuantity: 2145,
  },
  {
    payItemNumber: "621-08161", description: "PERMANENT TURF REINFORCEMENT MAT",
    unit: "SYS", lowPrice: 8.89, averagePrice: 11.41,
    highPrice: 50.0, totalQuantity: 3316,
  },
  {
    payItemNumber: "621-08538", description: "MULCH",
    unit: "CYS", lowPrice: 101.0, averagePrice: 101.51,
    highPrice: 120.0, totalQuantity: 74,
  },
  {
    payItemNumber: "621-09273", description: "WEED BARRIER",
    unit: "SYS", lowPrice: 7.0, averagePrice: 7.0,
    highPrice: 7.0, totalQuantity: 40,
  },
  {
    payItemNumber: "621-09399", description: "SEED MIXTURE, WET MESIC",
    unit: "LBS", lowPrice: 550.0, averagePrice: 550.0,
    highPrice: 550.0, totalQuantity: 6,
  },
  {
    payItemNumber: "621-09815", description: "ARTICULATED CONCRETE BLOCK",
    unit: "SYS", lowPrice: 195.0, averagePrice: 253.37,
    highPrice: 950.0, totalQuantity: 2270,
  },
  {
    payItemNumber: "621-09867", description: "MULCHED SEEDING",
    unit: "SYS", lowPrice: 7.9, averagePrice: 22.19,
    highPrice: 350.0, totalQuantity: 258,
  },
  {
    payItemNumber: "621-09908", description: "SOIL",
    unit: "CYS", lowPrice: 200.0, averagePrice: 200.0,
    highPrice: 200.0, totalQuantity: 1067,
  },
  {
    payItemNumber: "621-12612", description: "SEED MIXTURE, FLOODPLAIN",
    unit: "LBS", lowPrice: 37.5, averagePrice: 163.07,
    highPrice: 1750.0, totalQuantity: 1446,
  },
  {
    payItemNumber: "621-12947", description: "GEOCELL CONFINEMENT SYSTEM FOR EROSION CONTROL",
    unit: "SYS", lowPrice: 39.0, averagePrice: 39.0,
    highPrice: 39.0, totalQuantity: 2029,
  },
  {
    payItemNumber: "621-52448", description: "SIGN, 'DO NOT SPRAY'",
    unit: "EACH", lowPrice: 72.0, averagePrice: 102.01,
    highPrice: 150.0, totalQuantity: 132,
  },
  {
    payItemNumber: "621-90853", description: "TAPPING SLEEVE WITH VALVE",
    unit: "EACH", lowPrice: 10550.56, averagePrice: 10550.56,
    highPrice: 10550.56, totalQuantity: 5,
  },
  {
    payItemNumber: "621-98038", description: "MULCH, HARDWOOD SHREDDED BARK",
    unit: "CYS", lowPrice: 85.0, averagePrice: 106.7,
    highPrice: 725.0, totalQuantity: 426,
  },
  {
    payItemNumber: "622-03672", description: "TREE PROTECTION AND TRIMMING",
    unit: "LS", lowPrice: 2000.0, averagePrice: 13500.0,
    highPrice: 25000.0, totalQuantity: 2,
  },
  {
    payItemNumber: "622-03948", description: "PLANTER",
    unit: "EACH", lowPrice: 3125.0, averagePrice: 3125.0,
    highPrice: 3125.0, totalQuantity: 33,
  },
  {
    payItemNumber: "622-04648", description: "TREE GRATE",
    unit: "EACH", lowPrice: 6500.0, averagePrice: 6500.0,
    highPrice: 6500.0, totalQuantity: 11,
  },
  {
    payItemNumber: "622-05638", description: "PLANT, DECIDUOUS SHRUB, 18 IN. OR UNDER",
    unit: "EACH", lowPrice: 56.0, averagePrice: 56.83,
    highPrice: 57.0, totalQuantity: 897,
  },
  {
    payItemNumber: "622-05639", description: "PLANT, DECIDUOUS SHRUB, 18 IN. TO 24 IN.",
    unit: "EACH", lowPrice: 35.0, averagePrice: 54.84,
    highPrice: 385.0, totalQuantity: 634,
  },
  {
    payItemNumber: "622-05640", description: "PLANT, DECIDUOUS SHRUB, 24 IN. TO 36 IN.",
    unit: "EACH", lowPrice: 115.0, averagePrice: 115.0,
    highPrice: 115.0, totalQuantity: 17,
  },
  {
    payItemNumber: "622-05641", description: "PLANT, DECIDUOUS SHRUB, 36 IN. TO 48 IN.",
    unit: "EACH", lowPrice: 58.5, averagePrice: 76.77,
    highPrice: 375.0, totalQuantity: 445,
  },
  {
    payItemNumber: "622-05645", description: "PLANT, DECIDUOUS TREE, MULTI-STEM, 72 IN. TO 96 IN.",
    unit: "EACH", lowPrice: 530.0, averagePrice: 530.0,
    highPrice: 530.0, totalQuantity: 20,
  },
  {
    payItemNumber: "622-05648", description: "PLANT, DECIDUOUS TREE, SINGLE STEM, 1.25 IN. OR UNDER",
    unit: "EACH", lowPrice: 120.0, averagePrice: 323.49,
    highPrice: 550.0, totalQuantity: 278,
  },
  {
    payItemNumber: "622-05649", description: "PLANT, DECIDUOUS TREE, SINGLE STEM, 1.25 IN. TO 2 IN.",
    unit: "EACH", lowPrice: 310.0, averagePrice: 421.5,
    highPrice: 823.55, totalQuantity: 1659,
  },
  {
    payItemNumber: "622-05650", description: "PLANT, DECIDUOUS TREE, SINGLE STEM, OVER 2 IN. TO 2.5 IN.",
    unit: "EACH", lowPrice: 400.0, averagePrice: 590.88,
    highPrice: 800.0, totalQuantity: 334,
  },
  {
    payItemNumber: "622-05651", description: "PLANT, DECIDUOUS TREE, SINGLE STEM, OVER 2.5 IN. TO 3.5 IN.",
    unit: "EACH", lowPrice: 550.0, averagePrice: 669.34,
    highPrice: 895.0, totalQuantity: 91,
  },
  {
    payItemNumber: "622-05652", description: "PLANT, DECIDUOUS TREE, SINGLE STEM, OVER 3.5 IN.",
    unit: "EACH", lowPrice: 755.0, averagePrice: 755.0,
    highPrice: 755.0, totalQuantity: 51,
  },
  {
    payItemNumber: "622-05653", description: "PLANT, GROUND COVER",
    unit: "EACH", lowPrice: 20.0, averagePrice: 24.8,
    highPrice: 60.0, totalQuantity: 937,
  },
  {
    payItemNumber: "622-05654", description: "PLANT, PERENNIAL",
    unit: "EACH", lowPrice: 15.0, averagePrice: 28.01,
    highPrice: 48.0, totalQuantity: 2889,
  },
  {
    payItemNumber: "622-07764", description: "IRRIGATION SYSTEM",
    unit: "LS", lowPrice: 20000.0, averagePrice: 22500.0,
    highPrice: 25000.0, totalQuantity: 2,
  },
  {
    payItemNumber: "622-10003", description: "LIVE PLANT STAKING",
    unit: "EACH", lowPrice: 20.0, averagePrice: 52.27,
    highPrice: 54.0, totalQuantity: 2061,
  },
  {
    payItemNumber: "622-52436", description: "SIGN, 'DO NOT MOW OR SPRAY'",
    unit: "EACH", lowPrice: 93.0, averagePrice: 107.79,
    highPrice: 150.0, totalQuantity: 41,
  },
  {
    payItemNumber: "622-91786", description: "SEEDLING",
    unit: "EACH", lowPrice: 47.0, averagePrice: 57.86,
    highPrice: 100.0, totalQuantity: 751,
  },
  {
    payItemNumber: "622-98200", description: "SIGN, 'DO NOT DISTURB'",
    unit: "EACH", lowPrice: 100.0, averagePrice: 111.37,
    highPrice: 145.0, totalQuantity: 124,
  },
  {
    payItemNumber: "623-04884", description: "MOWING, CYCLE NO. 1",
    unit: "CYCL", lowPrice: 100000.0, averagePrice: 184545.77,
    highPrice: 350000.0, totalQuantity: 13,
  },
  {
    payItemNumber: "623-04885", description: "MOWING, CYCLE NO. 2",
    unit: "CYCL", lowPrice: 99118.0, averagePrice: 172246.77,
    highPrice: 300000.0, totalQuantity: 13,
  },
  {
    payItemNumber: "623-04886", description: "MOWING, CYCLE NO. 3",
    unit: "CYCL", lowPrice: 95000.0, averagePrice: 137750.0,
    highPrice: 250000.0, totalQuantity: 4,
  },
  {
    payItemNumber: "623-04887", description: "MOWING, CYCLE NO. 4",
    unit: "CYCL", lowPrice: 105000.0, averagePrice: 152500.0,
    highPrice: 200000.0, totalQuantity: 2,
  },
  {
    payItemNumber: "623-05684", description: "MOWING, CYCLE NO. 5",
    unit: "CYCL", lowPrice: 100000.0, averagePrice: 110159.0,
    highPrice: 120318.0, totalQuantity: 2,
  },
  {
    payItemNumber: "624-92647", description: "HERBICIDE TREATMENT",
    unit: "ACRE", lowPrice: 2192.0, averagePrice: 5582.35,
    highPrice: 15000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "627-09327", description: "CABLE BARRIER SYSTEM, TYPE TL-4",
    unit: "LFT", lowPrice: 15.5, averagePrice: 15.71,
    highPrice: 32.0, totalQuantity: 135818,
  },
  {
    payItemNumber: "627-09330", description: "SAFETY TERMINAL, TYPE TL-3",
    unit: "EACH", lowPrice: 5200.0, averagePrice: 5472.84,
    highPrice: 7800.0, totalQuantity: 81,
  },
  {
    payItemNumber: "627-09910", description: "CABLE LINE POST LESS SOCKET, REPAIR",
    unit: "EACH", lowPrice: 220.0, averagePrice: 223.23,
    highPrice: 225.0, totalQuantity: 775,
  },
  {
    payItemNumber: "627-09911", description: "TERMINAL POST LESS SOCKET, REPAIR",
    unit: "EACH", lowPrice: 248.0, averagePrice: 254.0,
    highPrice: 350.0, totalQuantity: 17,
  },
  {
    payItemNumber: "627-09912", description: "CABLE RELEASE POST LESS SOCKET, REPAIR",
    unit: "EACH", lowPrice: 450.0, averagePrice: 522.5,
    highPrice: 595.0, totalQuantity: 2,
  },
  {
    payItemNumber: "627-09913", description: "CABLE SOCKET WITH CONCRETE, REPAIR",
    unit: "EACH", lowPrice: 250.0, averagePrice: 450.0,
    highPrice: 650.0, totalQuantity: 2,
  },
  {
    payItemNumber: "627-09914", description: "ANCHOR TERMINAL FITTING, REPAIR",
    unit: "EACH", lowPrice: 316.0, averagePrice: 316.0,
    highPrice: 316.0, totalQuantity: 8,
  },
  {
    payItemNumber: "627-09915", description: "CABLE SPLICE, REPAIR",
    unit: "EACH", lowPrice: 700.0, averagePrice: 712.5,
    highPrice: 725.0, totalQuantity: 2,
  },
  {
    payItemNumber: "627-09916", description: "RETENTION CABLE, REPAIR",
    unit: "EACH", lowPrice: 200.0, averagePrice: 477.78,
    highPrice: 700.0, totalQuantity: 9,
  },
  {
    payItemNumber: "627-10178", description: "CABLE BARRIER SYSTEM, TYPE TL-4, SPARE PARTS SPARE PARTS",
    unit: "LS", lowPrice: 17100.0, averagePrice: 17100.0,
    highPrice: 17100.0, totalQuantity: 1,
  },
  {
    payItemNumber: "627-11647", description: "CABLE BARRIER SYSTEM, TYPE TL-4, RESET",
    unit: "LFT", lowPrice: 15.0, averagePrice: 16.39,
    highPrice: 29.0, totalQuantity: 3216,
  },
  {
    payItemNumber: "628-09401", description: "FIELD OFFICE, TYPE A",
    unit: "MOS", lowPrice: 1000.0, averagePrice: 2965.03,
    highPrice: 4250.0, totalQuantity: 175,
  },
  {
    payItemNumber: "628-09403", description: "FIELD OFFICE, TYPE C",
    unit: "MOS", lowPrice: 100.0, averagePrice: 3249.13,
    highPrice: 8570.0, totalQuantity: 1705,
  },
  {
    payItemNumber: "628-09409", description: "MOBILE INTERNET SERVICE",
    unit: "MOS", lowPrice: 50.0, averagePrice: 385.29,
    highPrice: 1695.0, totalQuantity: 85,
  },
  {
    payItemNumber: "628-11729", description: "CELLULAR TELEPHONE, TYPE A",
    unit: "EACH", lowPrice: 100.0, averagePrice: 883.33,
    highPrice: 1500.0, totalQuantity: 9,
  },
  {
    payItemNumber: "628-11781", description: "CELLULAR TELEPHONE SERVICE, 750 MIN.",
    unit: "MOS", lowPrice: 90.0, averagePrice: 90.0,
    highPrice: 90.0, totalQuantity: 24,
  },
  {
    payItemNumber: "628-11782", description: "CELLULAR TELEPHONE SERVICE, 1000 MIN.",
    unit: "MOS", lowPrice: 100.0, averagePrice: 133.26,
    highPrice: 155.0, totalQuantity: 23,
  },
  {
    payItemNumber: "628-11976", description: "COMPUTER SYSTEM EQUIPMENT",
    unit: "EACH", lowPrice: 1.0, averagePrice: 852.34,
    highPrice: 5000.0, totalQuantity: 408,
  },
  {
    payItemNumber: "628-11977", description: "COMPUTER SYSTEM",
    unit: "EACH", lowPrice: 160.0, averagePrice: 2466.26,
    highPrice: 28500.0, totalQuantity: 26,
  },
  {
    payItemNumber: "628-12683", description: "FIELD OFFICE, TYPE D",
    unit: "MOS", lowPrice: 100.0, averagePrice: 3172.39,
    highPrice: 8621.64, totalQuantity: 1710,
  },
  {
    payItemNumber: "628-12684", description: "FIELD OFFICE, TYPE E",
    unit: "MOS", lowPrice: 2000.0, averagePrice: 12075.26,
    highPrice: 32270.0, totalQuantity: 261,
  },
  {
    payItemNumber: "628-12687", description: "TELEPHONE SERVICE, TYPE C",
    unit: "MOS", lowPrice: 500.0, averagePrice: 500.0,
    highPrice: 500.0, totalQuantity: 60,
  },
  {
    payItemNumber: "628-12923", description: "CELLULAR TELEPHONE SERVICE, UNLIMITED MINUTES",
    unit: "MOS", lowPrice: 1.0, averagePrice: 102.42,
    highPrice: 250.0, totalQuantity: 45,
  },
  {
    payItemNumber: "629-000149", description: "TOPSOIL PROCESSING AND DISTRIBUTION",
    unit: "SYS", lowPrice: 1.5, averagePrice: 6.4,
    highPrice: 23.0, totalQuantity: 165945,
  },
  {
    payItemNumber: "629-12029", description: "PLANT GROWTH LAYER",
    unit: "SYS", lowPrice: 3.09, averagePrice: 5.45,
    highPrice: 13.26, totalQuantity: 198671,
  },
  {
    payItemNumber: "701-02936", description: "PILE, STEEL H, HP 14 IN. X 89 IN.",
    unit: "LFT", lowPrice: 621.52, averagePrice: 621.52,
    highPrice: 621.52, totalQuantity: 56,
  },
  {
    payItemNumber: "701-02938", description: "CORED HOLE IN ROCK, DIAMETER 24 IN.",
    unit: "LFT", lowPrice: 394.0, averagePrice: 567.69,
    highPrice: 1116.0, totalQuantity: 350,
  },
  {
    payItemNumber: "701-05787", description: "INSTRUMENTATION INTEGRITY TESTING AND DATA COLLECTION",
    unit: "LS", lowPrice: 250000.0, averagePrice: 275000.0,
    highPrice: 300000.0, totalQuantity: 2,
  },
  {
    payItemNumber: "701-06011", description: "DYNAMIC PILE LOAD TEST",
    unit: "EACH", lowPrice: 750.0, averagePrice: 4779.7,
    highPrice: 10000.0, totalQuantity: 92,
  },
  {
    payItemNumber: "701-08122", description: "PILE, STEEL PIPE, 0.375 IN., DIAMETER 14 IN. 0.375 IN., 14 IN.",
    unit: "LFT", lowPrice: 73.0, averagePrice: 114.94,
    highPrice: 144.0, totalQuantity: 7288,
  },
  {
    payItemNumber: "701-08253", description: "PILE, SLEEVES",
    unit: "EACH", lowPrice: 985.0, averagePrice: 1281.65,
    highPrice: 1909.23, totalQuantity: 81,
  },
  {
    payItemNumber: "701-09557", description: "TEST PILE, DYNAMIC, PRODUCTION",
    unit: "LFT", lowPrice: 43.43, averagePrice: 106.93,
    highPrice: 781.0, totalQuantity: 6192,
  },
  {
    payItemNumber: "701-09558", description: "TEST PILE, INDICATOR, PRODUCTION",
    unit: "LFT", lowPrice: 50.0, averagePrice: 114.31,
    highPrice: 250.0, totalQuantity: 2893,
  },
  {
    payItemNumber: "701-09559", description: "TEST PILE, DYNAMIC, RESTRIKE",
    unit: "EACH", lowPrice: 750.0, averagePrice: 3495.82,
    highPrice: 10000.0, totalQuantity: 107,
  },
  {
    payItemNumber: "701-09560", description: "TEST PILE, INDICATOR, RESTRIKE",
    unit: "EACH", lowPrice: 598.0, averagePrice: 2613.74,
    highPrice: 5050.0, totalQuantity: 47,
  },
  {
    payItemNumber: "701-09662", description: "PILE, STEEL PIPE, 0.250 IN., DIAMETER 14 IN.",
    unit: "LFT", lowPrice: 95.0, averagePrice: 95.0,
    highPrice: 95.0, totalQuantity: 1000,
  },
  {
    payItemNumber: "701-09663", description: "PILE, STEEL PIPE, 0.312 IN., DIAMETER 14 IN.",
    unit: "LFT", lowPrice: 54.0, averagePrice: 89.7,
    highPrice: 121.38, totalQuantity: 11090,
  },
  {
    payItemNumber: "701-09665", description: "PILE, STEEL PIPE, 0.375 IN., DIAMETER 14 IN.",
    unit: "LFT", lowPrice: 70.0, averagePrice: 95.84,
    highPrice: 112.0, totalQuantity: 8191,
  },
  {
    payItemNumber: "701-09675", description: "PILE, STEEL PIPE, EPOXY COATED, 0.312 IN., DIAMETER 14 IN.",
    unit: "LFT", lowPrice: 233.0, averagePrice: 262.78,
    highPrice: 300.0, totalQuantity: 225,
  },
  {
    payItemNumber: "701-09679", description: "CONICAL PILE TIP, 14 IN.",
    unit: "EACH", lowPrice: 299.6, averagePrice: 469.32,
    highPrice: 1000.0, totalQuantity: 356,
  },
  {
    payItemNumber: "701-09682", description: "PILE SHOE, HP 12 X 63",
    unit: "EACH", lowPrice: 140.0, averagePrice: 140.0,
    highPrice: 140.0, totalQuantity: 12,
  },
  {
    payItemNumber: "701-09683", description: "PILE SHOE, HP 12 X 74",
    unit: "EACH", lowPrice: 140.0, averagePrice: 165.62,
    highPrice: 208.48, totalQuantity: 101,
  },
  {
    payItemNumber: "701-09739", description: "PILE SHOE, HP 12 X 53",
    unit: "EACH", lowPrice: 135.0, averagePrice: 192.71,
    highPrice: 300.0, totalQuantity: 170,
  },
  {
    payItemNumber: "701-09770", description: "PILE SHOE, HP 14 X 73",
    unit: "EACH", lowPrice: 153.0, averagePrice: 167.77,
    highPrice: 185.0, totalQuantity: 26,
  },
  {
    payItemNumber: "701-09824", description: "PREBORED HOLE, DIAMETER 18 IN.",
    unit: "LFT", lowPrice: 171.75, averagePrice: 171.75,
    highPrice: 171.75, totalQuantity: 26,
  },
  {
    payItemNumber: "701-09826", description: "PILE, STEEL PIPE, 0.5 IN., DIAMETER 14 IN.",
    unit: "LFT", lowPrice: 70.0, averagePrice: 98.9,
    highPrice: 117.0, totalQuantity: 4335,
  },
  {
    payItemNumber: "701-09891", description: "PILE SHOE, HP 12 X 84",
    unit: "EACH", lowPrice: 225.0, averagePrice: 225.0,
    highPrice: 225.0, totalQuantity: 26,
  },
  {
    payItemNumber: "701-11714", description: "PREBORED HOLE, DIAMETER 12 IN.",
    unit: "LFT", lowPrice: 0.01, averagePrice: 24.36,
    highPrice: 238.0, totalQuantity: 2245,
  },
  {
    payItemNumber: "701-11931", description: "PILE, HELICAL",
    unit: "LFT", lowPrice: 125.0, averagePrice: 125.0,
    highPrice: 125.0, totalQuantity: 2230,
  },
  {
    payItemNumber: "701-12304", description: "VIBRATION MONITORING",
    unit: "LS", lowPrice: 30000.0, averagePrice: 51666.67,
    highPrice: 75000.0, totalQuantity: 3,
  },
  {
    payItemNumber: "701-12361", description: "PREBORED HOLE, DIAMETER 24 IN.",
    unit: "LFT", lowPrice: 91.0, averagePrice: 91.0,
    highPrice: 91.0, totalQuantity: 458,
  },
  {
    payItemNumber: "701-12444", description: "PILE, STEEL PIPE, 0.375 IN., DIAMETER 16 IN.",
    unit: "LFT", lowPrice: 108.05, averagePrice: 108.05,
    highPrice: 108.05, totalQuantity: 3980,
  },
  {
    payItemNumber: "701-12494", description: "PILE SLEEVES",
    unit: "LFT", lowPrice: 78.0, averagePrice: 88.66,
    highPrice: 92.99, totalQuantity: 1322,
  },
  {
    payItemNumber: "701-12709", description: "REINFORCED CONCRETE ENCASEMENT FOR H PILES",
    unit: "LFT", lowPrice: 79.0, averagePrice: 197.46,
    highPrice: 350.0, totalQuantity: 773,
  },
  {
    payItemNumber: "701-12769", description: "HDPE PILE ENCASEMENT SYSTEM",
    unit: "LS", lowPrice: 85000.0, averagePrice: 85000.0,
    highPrice: 85000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "701-12836", description: "AUTOMATED PILE DRIVING DATA ACQUISITION DEVICE",
    unit: "EACH", lowPrice: 1500.0, averagePrice: 13297.22,
    highPrice: 23391.67, totalQuantity: 3,
  },
  {
    payItemNumber: "701-51195", description: "PILE, STEEL H, HP 12 X 53",
    unit: "LFT", lowPrice: 55.0, averagePrice: 89.55,
    highPrice: 170.0, totalQuantity: 12529,
  },
  {
    payItemNumber: "701-93575", description: "PILE, STEEL H, HP, 14 X 73",
    unit: "LFT", lowPrice: 123.0, averagePrice: 161.63,
    highPrice: 552.59, totalQuantity: 1404,
  },
  {
    payItemNumber: "701-93658", description: "PILE, STEEL H, HP, 12 X 63",
    unit: "LFT", lowPrice: 40.0, averagePrice: 40.0,
    highPrice: 40.0, totalQuantity: 802,
  },
  {
    payItemNumber: "701-93790", description: "CLEAN AND EPOXY COAT EXISTING PILES",
    unit: "LS", lowPrice: 31000.0, averagePrice: 114100.0,
    highPrice: 267300.0, totalQuantity: 3,
  },
  {
    payItemNumber: "701-95780", description: "PILE, STEEL H, HP 12 X 74",
    unit: "LFT", lowPrice: 82.8, averagePrice: 103.52,
    highPrice: 147.59, totalQuantity: 5206,
  },
  {
    payItemNumber: "701-95782", description: "PILE, STEEL H, HP, 12 X 84",
    unit: "LFT", lowPrice: 85.0, averagePrice: 105.53,
    highPrice: 125.0, totalQuantity: 2153,
  },
  {
    payItemNumber: "702-03607", description: "CORED HOLE IN CONCRETE",
    unit: "EACH", lowPrice: 885.0, averagePrice: 1561.18,
    highPrice: 6000.0, totalQuantity: 17,
  },
  {
    payItemNumber: "702-04325", description: "TEMPORARY SHORING",
    unit: "LS", lowPrice: 1.0, averagePrice: 64017.57,
    highPrice: 270000.0, totalQuantity: 36,
  },
  {
    payItemNumber: "702-12076", description: "GRATES, BASINS, AND FITTINGS, CAST IRON",
    unit: "EACH", lowPrice: 1000.0, averagePrice: 2603.88,
    highPrice: 6200.0, totalQuantity: 90,
  },
  {
    payItemNumber: "702-12339", description: "TEMPORARY SHORING",
    unit: "EACH", lowPrice: 8000.0, averagePrice: 8000.0,
    highPrice: 8000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "702-44240", description: "CONCRETE, A, STRUCTURES",
    unit: "CYS", lowPrice: 850.0, averagePrice: 850.0,
    highPrice: 850.0, totalQuantity: 20,
  },
  {
    payItemNumber: "702-51001", description: "CONCRETE, A, SUPERSTRUCTURE",
    unit: "CYS", lowPrice: 3600.0, averagePrice: 3600.0,
    highPrice: 3600.0, totalQuantity: 5,
  },
  {
    payItemNumber: "702-51005", description: "CONCRETE, A, SUBSTRUCTURE",
    unit: "CYS", lowPrice: 600.0, averagePrice: 1441.6,
    highPrice: 7700.0, totalQuantity: 4160,
  },
  {
    payItemNumber: "702-51010", description: "CONCRETE, B, ABOVE FOOTINGS",
    unit: "CYS", lowPrice: 1000.0, averagePrice: 1000.0,
    highPrice: 1000.0, totalQuantity: 193,
  },
  {
    payItemNumber: "702-51015", description: "CONCRETE, B, FOOTINGS",
    unit: "CYS", lowPrice: 375.0, averagePrice: 848.14,
    highPrice: 11602.65, totalQuantity: 2701,
  },
  {
    payItemNumber: "702-51046", description: "CONCRETE, FOUNDATION SEAL",
    unit: "CYS", lowPrice: 410.0, averagePrice: 432.44,
    highPrice: 575.0, totalQuantity: 191,
  },
  {
    payItemNumber: "702-51863", description: "FIELD DRILLED HOLE IN CONCRETE",
    unit: "EACH", lowPrice: 0.01, averagePrice: 25.69,
    highPrice: 500.0, totalQuantity: 24414,
  },
  {
    payItemNumber: "702-90915", description: "CONCRETE, A",
    unit: "CYS", lowPrice: 220.0, averagePrice: 865.07,
    highPrice: 6000.0, totalQuantity: 1556,
  },
  {
    payItemNumber: "702-92857", description: "CONCRETE, C, SUBSTRUCTURE",
    unit: "CYS", lowPrice: 500.0, averagePrice: 1312.77,
    highPrice: 5107.35, totalQuantity: 2024,
  },
  {
    payItemNumber: "702-93722", description: "CONCRETE, C",
    unit: "CYS", lowPrice: 536.14, averagePrice: 1100.92,
    highPrice: 2800.0, totalQuantity: 132,
  },
  {
    payItemNumber: "703-01540", description: "THREADED TIE BAR ASSEMBLY",
    unit: "EACH", lowPrice: 28.0, averagePrice: 48.19,
    highPrice: 252.11, totalQuantity: 392,
  },
  {
    payItemNumber: "703-06028", description: "REINFORCING BARS",
    unit: "LBS", lowPrice: 1.18, averagePrice: 1.63,
    highPrice: 10.0, totalQuantity: 1068834,
  },
  {
    payItemNumber: "703-06029", description: "REINFORCING BARS, EPOXY COATED",
    unit: "LBS", lowPrice: 1.1, averagePrice: 1.57,
    highPrice: 51.0, totalQuantity: 9573676,
  },
  {
    payItemNumber: "703-08247", description: "EMBEDDED GALVANIC ANODE",
    unit: "EACH", lowPrice: 13.22, averagePrice: 26.59,
    highPrice: 72.0, totalQuantity: 2667,
  },
  {
    payItemNumber: "703-96512", description: "BAR SPLICE",
    unit: "EACH", lowPrice: 51.0, averagePrice: 51.0,
    highPrice: 51.0, totalQuantity: 252,
  },
  {
    payItemNumber: "703-97936", description: "THREADED TIE BAR ASSEMBLY, EPOXY COATED",
    unit: "EACH", lowPrice: 20.0, averagePrice: 43.2,
    highPrice: 140.0, totalQuantity: 19020,
  },
  {
    payItemNumber: "704-000080", description: "INERTIAL PROFILER, BRIDGE ENCOUNTER",
    unit: "LS", lowPrice: 4000.0, averagePrice: 10356.0,
    highPrice: 24000.0, totalQuantity: 10,
  },
  {
    payItemNumber: "704-000082", description: "CORRECTIVE GRINDING, BRIDGE ENCOUNTER",
    unit: "LS", lowPrice: 10000.0, averagePrice: 22640.0,
    highPrice: 50000.0, totalQuantity: 10,
  },
  {
    payItemNumber: "704-09031", description: "ARTICULATING CONCRETE MATTRESS",
    unit: "SYS", lowPrice: 289.04, averagePrice: 289.04,
    highPrice: 289.04, totalQuantity: 156,
  },
  {
    payItemNumber: "704-51002", description: "CONCRETE, C, SUPERSTRUCTURE",
    unit: "CYS", lowPrice: 380.0, averagePrice: 1284.76,
    highPrice: 16435.0, totalQuantity: 21587,
  },
  {
    payItemNumber: "704-51106", description: "DECK DRAIN",
    unit: "EACH", lowPrice: 156.0, averagePrice: 644.63,
    highPrice: 1000.0, totalQuantity: 38,
  },
  {
    payItemNumber: "706-01515", description: "BRIDGE BRACKET A, ALUMINUM",
    unit: "EACH", lowPrice: 37.0, averagePrice: 37.0,
    highPrice: 37.0, totalQuantity: 1,
  },
  {
    payItemNumber: "706-05587", description: "BRIDGE BARRIER RAIL BRACKET, CONCRETE, INSTALL",
    unit: "EACH", lowPrice: 102.0, averagePrice: 102.0,
    highPrice: 102.0, totalQuantity: 1,
  },
  {
    payItemNumber: "706-06344", description: "RAILING, STEEL TYPE TS-1",
    unit: "LFT", lowPrice: 76.0, averagePrice: 93.54,
    highPrice: 146.0, totalQuantity: 2148,
  },
  {
    payItemNumber: "706-06347", description: "RAILING, STEEL TYPE CF-1",
    unit: "LFT", lowPrice: 130.0, averagePrice: 130.0,
    highPrice: 130.0, totalQuantity: 50,
  },
  {
    payItemNumber: "706-06351", description: "CONCRETE BRIDGE RAILING TRANSITION, TYPE TPF-1",
    unit: "EACH", lowPrice: 2060.0, averagePrice: 4839.66,
    highPrice: 16050.0, totalQuantity: 59,
  },
  {
    payItemNumber: "706-06353", description: "CONCRETE BRIDGE RAILING TRANSITION, TYPE TPS-1",
    unit: "EACH", lowPrice: 3184.06, averagePrice: 6244.05,
    highPrice: 10200.0, totalQuantity: 39,
  },
  {
    payItemNumber: "706-06372", description: "CONCRETE BRIDGE RAILING TRANSITION, TYPE TTX",
    unit: "EACH", lowPrice: 2650.0, averagePrice: 6785.79,
    highPrice: 11615.33, totalQuantity: 13,
  },
  {
    payItemNumber: "706-08496", description: "REINFORCED CONCRETE MOMENT SLAB, 12 IN.",
    unit: "SYS", lowPrice: 160.0, averagePrice: 207.19,
    highPrice: 1200.0, totalQuantity: 2654,
  },
  {
    payItemNumber: "706-08498", description: "REINFORCED CONCRETE MOMENT SLAB, 13 IN.",
    unit: "SYS", lowPrice: 350.0, averagePrice: 407.75,
    highPrice: 461.05, totalQuantity: 100,
  },
  {
    payItemNumber: "706-08500", description: "REINFORCED CONCRETE MOMENT SLAB, 14 IN.",
    unit: "SYS", lowPrice: 249.45, averagePrice: 249.45,
    highPrice: 249.45, totalQuantity: 3327,
  },
  {
    payItemNumber: "706-09959", description: "RAILING, CONCRETE TYPE FT",
    unit: "LFT", lowPrice: 20.0, averagePrice: 79.91,
    highPrice: 200.0, totalQuantity: 2904,
  },
  {
    payItemNumber: "706-09960", description: "RAILING, CONCRETE TYPE FC",
    unit: "LFT", lowPrice: 20.0, averagePrice: 137.36,
    highPrice: 1000.0, totalQuantity: 1827,
  },
  {
    payItemNumber: "706-09961", description: "RAILING, CONCRETE TYPE PS-1",
    unit: "LFT", lowPrice: 75.0, averagePrice: 166.46,
    highPrice: 270.0, totalQuantity: 1262,
  },
  {
    payItemNumber: "706-09962", description: "RAILING, CONCRETE TYPE PF-1",
    unit: "LFT", lowPrice: 75.0, averagePrice: 135.99,
    highPrice: 176.0, totalQuantity: 1731,
  },
  {
    payItemNumber: "706-09965", description: "RAILING, CONCRETE TYPE TX",
    unit: "LFT", lowPrice: 160.0, averagePrice: 198.08,
    highPrice: 400.0, totalQuantity: 320,
  },
  {
    payItemNumber: "706-11404", description: "RAILING, STEEL TYPE PF-1",
    unit: "LFT", lowPrice: 71.0, averagePrice: 104.08,
    highPrice: 159.0, totalQuantity: 6121,
  },
  {
    payItemNumber: "706-11418", description: "RAILING, STEEL TYPE PS-1",
    unit: "LFT", lowPrice: 66.0, averagePrice: 99.5,
    highPrice: 280.0, totalQuantity: 3396,
  },
  {
    payItemNumber: "706-11455", description: "BRIDGE RAILING PEDESTRIAN FENCE",
    unit: "LFT", lowPrice: 70.0, averagePrice: 109.5,
    highPrice: 180.0, totalQuantity: 3046,
  },
  {
    payItemNumber: "706-11600", description: "RAILING, CONCRETE TYPE FC",
    unit: "CYS", lowPrice: 500.0, averagePrice: 1029.35,
    highPrice: 8500.0, totalQuantity: 1105,
  },
  {
    payItemNumber: "706-11601", description: "RAILING, CONCRETE TYPE FT",
    unit: "CYS", lowPrice: 541.0, averagePrice: 1060.01,
    highPrice: 4200.0, totalQuantity: 512,
  },
  {
    payItemNumber: "706-11602", description: "RAILING, CONCRETE TYPE PF-1",
    unit: "CYS", lowPrice: 750.0, averagePrice: 1321.43,
    highPrice: 2840.18, totalQuantity: 256,
  },
  {
    payItemNumber: "706-11604", description: "RAILING, CONCRETE TYPE PS-1",
    unit: "CYS", lowPrice: 750.0, averagePrice: 1848.29,
    highPrice: 3000.0, totalQuantity: 171,
  },
  {
    payItemNumber: "706-11620", description: "CONCRETE BRIDGE RAILING TRANSITION, TYPE TFC",
    unit: "EACH", lowPrice: 975.0, averagePrice: 3296.82,
    highPrice: 9665.58, totalQuantity: 348,
  },
  {
    payItemNumber: "706-11621", description: "CONCRETE BRIDGE RAILING TRANSITION, TYPE TFT",
    unit: "EACH", lowPrice: 2250.0, averagePrice: 4410.68,
    highPrice: 8500.0, totalQuantity: 86,
  },
  {
    payItemNumber: "706-51020", description: "RAILING, CONCRETE TYPE C",
    unit: "CYS", lowPrice: 530.0, averagePrice: 1005.24,
    highPrice: 2277.59, totalQuantity: 174,
  },
  {
    payItemNumber: "706-62380", description: "BRIDGE RAILING POST, TYPE 5A",
    unit: "EACH", lowPrice: 130.0, averagePrice: 130.0,
    highPrice: 130.0, totalQuantity: 3,
  },
  {
    payItemNumber: "706-62390", description: "BRIDGE RAILING POST, TYPE 6",
    unit: "EACH", lowPrice: 130.0, averagePrice: 130.0,
    highPrice: 130.0, totalQuantity: 1,
  },
  {
    payItemNumber: "706-62400", description: "BRIDGE RAILING POST, TYPE 7",
    unit: "EACH", lowPrice: 130.0, averagePrice: 130.0,
    highPrice: 130.0, totalQuantity: 1,
  },
  {
    payItemNumber: "706-90672", description: "BRIDGE RAILING POST, ALUMINUM, TYPE 5",
    unit: "EACH", lowPrice: 130.0, averagePrice: 130.0,
    highPrice: 130.0, totalQuantity: 5,
  },
  {
    payItemNumber: "706-92612", description: "RAILING, CONCRETE TYPE C, MODIFIED",
    unit: "LFT", lowPrice: 500.0, averagePrice: 500.0,
    highPrice: 500.0, totalQuantity: 35,
  },
  {
    payItemNumber: "706-94133", description: "RAILING, TUBE, GALVANIZED STEEL",
    unit: "LFT", lowPrice: 140.0, averagePrice: 240.68,
    highPrice: 242.0, totalQuantity: 77,
  },
  {
    payItemNumber: "706-94947", description: "RAILING, CONCRETE TYPE C, MODIFIED",
    unit: "CYS", lowPrice: 911.0, averagePrice: 911.0,
    highPrice: 911.0, totalQuantity: 10,
  },
  {
    payItemNumber: "706-95431", description: "BARRIER X CONCRETE, BRIDGE RAILING, BRACKET, TYPE A",
    unit: "EACH", lowPrice: 475.0, averagePrice: 475.0,
    highPrice: 475.0, totalQuantity: 1,
  },
  {
    payItemNumber: "706-95432", description: "BARRIER X CONCRETE, BRIDGE RAILING, BRACKET, TYPE B",
    unit: "EACH", lowPrice: 475.0, averagePrice: 475.0,
    highPrice: 475.0, totalQuantity: 1,
  },
  {
    payItemNumber: "706-95433", description: "BARRIER X CONCRETE, BRIDGE RAILING, BRACKET, TYPE C",
    unit: "EACH", lowPrice: 475.0, averagePrice: 475.0,
    highPrice: 475.0, totalQuantity: 1,
  },
  {
    payItemNumber: "706-98639", description: "BRIDGE RAILING SPLICE BAR, ALUMINUM",
    unit: "EACH", lowPrice: 115.0, averagePrice: 115.0,
    highPrice: 115.0, totalQuantity: 1,
  },
  {
    payItemNumber: "707-05982", description: "STRUCTURAL MEMBER, CONCRETE, I-BEAM, 28 IN. X 12 IN. 28\" X 12\"",
    unit: "LFT", lowPrice: 470.0, averagePrice: 522.08,
    highPrice: 1125.0, totalQuantity: 566,
  },
  {
    payItemNumber: "707-05984", description: "STRUCTURAL MEMBER, CONCRETE, I-BEAM, 45 IN. X 16 IN. , 45\" X 16\"",
    unit: "LFT", lowPrice: 550.0, averagePrice: 550.0,
    highPrice: 550.0, totalQuantity: 1495,
  },
  {
    payItemNumber: "707-05985", description: "STRUCTURAL MEMBER, CONCRETE, I-BEAM, 54 IN. X 20 IN. , 54\" X 20\"",
    unit: "LFT", lowPrice: 900.0, averagePrice: 900.0,
    highPrice: 900.0, totalQuantity: 344,
  },
  {
    payItemNumber: "707-07776", description: "STRUCTURAL MEMBER, CONCRETE, BOX BEAM, 21 IN. X 36 IN. , 21\" X 36\"",
    unit: "LFT", lowPrice: 334.0, averagePrice: 363.7,
    highPrice: 380.09, totalQuantity: 1187,
  },
  {
    payItemNumber: "707-08158", description: "STRUCTURAL MEMBER, CONCRETE, BULB-T BEAM, 42 IN. X 49 IN. 42\" X 49\"",
    unit: "LFT", lowPrice: 669.45, averagePrice: 669.45,
    highPrice: 669.45, totalQuantity: 1303,
  },
  {
    payItemNumber: "707-08512", description: "STRUCTURAL MEMBER, CONCRETE, BOX BEAM, 42 IN. X 48 IN.",
    unit: "LFT", lowPrice: 508.22, averagePrice: 508.22,
    highPrice: 508.22, totalQuantity: 350,
  },
  {
    payItemNumber: "707-09029", description: "STRUCTURAL MEMBER, CONCRETE, BOX BEAM, 12 IN. X 48 IN. , 12\" X 48\"",
    unit: "LFT", lowPrice: 411.0, averagePrice: 411.0,
    highPrice: 411.0, totalQuantity: 515,
  },
  {
    payItemNumber: "707-09634", description: "STRUCTURAL MEMBER, CONCRETE, BULB-T BEAM, 48 IN. X 49 IN. 48 IN. X 49 IN.",
    unit: "LFT", lowPrice: 616.1, averagePrice: 616.1,
    highPrice: 616.1, totalQuantity: 1120,
  },
  {
    payItemNumber: "707-09862", description: "STRUCTURAL MEMBER, CONCRETE, BOX BEAM, 27 IN. X 48 IN. 27 IN. X 48 IN.",
    unit: "LFT", lowPrice: 279.9, averagePrice: 279.9,
    highPrice: 279.9, totalQuantity: 990,
  },
  {
    payItemNumber: "707-09865", description: "STRUCTURAL MEMBER, CONCRETE, BULB-T BEAM, 36 IN. X 49 IN. 36\" X 49\"",
    unit: "LFT", lowPrice: 500.0, averagePrice: 617.63,
    highPrice: 800.0, totalQuantity: 4452,
  },
  {
    payItemNumber: "707-09921", description: "STRUCTURAL MEMBER, CONCRETE, BULB-T BEAM, 54 IN. X 49 IN. 54 IN. X 49 IN.",
    unit: "LFT", lowPrice: 650.0, averagePrice: 650.0,
    highPrice: 650.0, totalQuantity: 1927,
  },
  {
    payItemNumber: "707-11047", description: "STRUCTURAL MEMBER, CONCRETE, BULB-T BEAM, 66 IN. X 49 IN. BEAM, 66 IN. X 49 IN.",
    unit: "LFT", lowPrice: 660.0, averagePrice: 698.73,
    highPrice: 750.0, totalQuantity: 5865,
  },
  {
    payItemNumber: "707-11443", description: "STRUCTURAL MEMBER, CONCRETE, BOX BEAM, 17 IN. X 36 IN. 17 IN. X 36 IN.",
    unit: "LFT", lowPrice: 425.0, averagePrice: 425.0,
    highPrice: 425.0, totalQuantity: 491,
  },
  {
    payItemNumber: "707-11494", description: "STRUCTURAL MEMBER, CONCRETE, BOX BEAM, 21 IN. X 48 IN.",
    unit: "LFT", lowPrice: 280.0, averagePrice: 319.05,
    highPrice: 520.0, totalQuantity: 2147,
  },
  {
    payItemNumber: "707-12818", description: "STRUCTURAL MEMBER, CONCRETE, NEXT BEAM TYPE E",
    unit: "LFT", lowPrice: 1175.0, averagePrice: 1175.0,
    highPrice: 1175.0, totalQuantity: 600,
  },
  {
    payItemNumber: "708-01112", description: "GROUT, NON-SHRINK",
    unit: "CYS", lowPrice: 3339.14, averagePrice: 3961.96,
    highPrice: 5000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "708-05394", description: "REPAIR",
    unit: "LS", lowPrice: 26000.0, averagePrice: 26000.0,
    highPrice: 26000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "708-51813", description: "PNEUMATICALLY PLACED MORTAR",
    unit: "SFT", lowPrice: 88.0, averagePrice: 92.53,
    highPrice: 103.0, totalQuantity: 1762,
  },
  {
    payItemNumber: "708-51814", description: "WELDED STEEL WIRE REINFORCEMENT",
    unit: "SFT", lowPrice: 9.0, averagePrice: 11.75,
    highPrice: 35.0, totalQuantity: 2672,
  },
  {
    payItemNumber: "709-04647", description: "FIBER WRAP CONCRETE CASING SYSTEM",
    unit: "LS", lowPrice: 3400.0, averagePrice: 27686.4,
    highPrice: 99000.0, totalQuantity: 14,
  },
  {
    payItemNumber: "709-07110", description: "SEAL COAT GRAFFITI RESISTANT",
    unit: "SFT", lowPrice: 3.18, averagePrice: 3.26,
    highPrice: 3.77, totalQuantity: 15156,
  },
  {
    payItemNumber: "709-12077", description: "FIBER WRAP CONCRETE CASING SYSTEM",
    unit: "SFT", lowPrice: 42.0, averagePrice: 65.34,
    highPrice: 103.0, totalQuantity: 2932,
  },
  {
    payItemNumber: "709-12574", description: "SPRAY APPLIED BRIDGE DECK MEMBRANE SYSTEM",
    unit: "SFT", lowPrice: 12.0, averagePrice: 12.0,
    highPrice: 12.0, totalQuantity: 3574,
  },
  {
    payItemNumber: "709-12600", description: "FIBER WRAP CONCRETE STRENGTHENING SYSTEM",
    unit: "LS", lowPrice: 38929.0, averagePrice: 38929.0,
    highPrice: 38929.0, totalQuantity: 1,
  },
  {
    payItemNumber: "709-51821", description: "SURFACE SEAL",
    unit: "LS", lowPrice: 0.01, averagePrice: 4447.53,
    highPrice: 25000.0, totalQuantity: 260,
  },
  {
    payItemNumber: "709-96826", description: "CONCRETE SURFACE COATING",
    unit: "LS", lowPrice: 2000.0, averagePrice: 21000.0,
    highPrice: 40000.0, totalQuantity: 2,
  },
  {
    payItemNumber: "710-09158", description: "PATCHING CONCRETE STRUCTURES",
    unit: "SFT", lowPrice: 10.0, averagePrice: 137.75,
    highPrice: 279.0, totalQuantity: 13710,
  },
  {
    payItemNumber: "710-11640", description: "MASONRY COLUMN",
    unit: "EACH", lowPrice: 125000.0, averagePrice: 125000.0,
    highPrice: 125000.0, totalQuantity: 2,
  },
  {
    payItemNumber: "711-01373", description: "BOLT",
    unit: "EACH", lowPrice: 275.0, averagePrice: 275.0,
    highPrice: 275.0, totalQuantity: 10,
  },
  {
    payItemNumber: "711-01772", description: "RETROFIT",
    unit: "EACH", lowPrice: 300.0, averagePrice: 359.13,
    highPrice: 2000.0, totalQuantity: 460,
  },
  {
    payItemNumber: "711-02707", description: "ANCHOR PLATE",
    unit: "EACH", lowPrice: 62.0, averagePrice: 111.21,
    highPrice: 225.0, totalQuantity: 54,
  },
  {
    payItemNumber: "711-04297", description: "STRUCTURAL STEEL, FIELD CUT",
    unit: "SQIN", lowPrice: 23.0, averagePrice: 36.81,
    highPrice: 90.0, totalQuantity: 2010,
  },
  {
    payItemNumber: "711-04845", description: "BRIDGE, STEEL TRUSS, PRE-ENGINEERED",
    unit: "LS", lowPrice: 161000.0, averagePrice: 246200.0,
    highPrice: 275000.0, totalQuantity: 5,
  },
  {
    payItemNumber: "711-05728", description: "REPAIR",
    unit: "EACH", lowPrice: 3637.0, averagePrice: 3637.0,
    highPrice: 3637.0, totalQuantity: 22,
  },
  {
    payItemNumber: "711-07857", description: "INCLINOMETER",
    unit: "EACH", lowPrice: 11625.0, averagePrice: 11625.0,
    highPrice: 11625.0, totalQuantity: 4,
  },
  {
    payItemNumber: "711-11599", description: "REPAIR WELD",
    unit: "IN", lowPrice: 83.0, averagePrice: 288.93,
    highPrice: 456.0, totalQuantity: 80,
  },
  {
    payItemNumber: "711-51035", description: "STRUCTURAL STEEL",
    unit: "LBS", lowPrice: 3.75, averagePrice: 4.96,
    highPrice: 62.0, totalQuantity: 306345,
  },
  {
    payItemNumber: "711-51038", description: "STRUCTURAL STEEL",
    unit: "LS", lowPrice: 2020.53, averagePrice: 578465.87,
    highPrice: 2375000.0, totalQuantity: 20,
  },
  {
    payItemNumber: "711-51820", description: "TEMPORARY SUPPORT",
    unit: "LS", lowPrice: 25000.0, averagePrice: 27500.0,
    highPrice: 30000.0, totalQuantity: 2,
  },
  {
    payItemNumber: "711-51823", description: "EXPANSION ANCHOR, 0.75 IN.",
    unit: "EACH", lowPrice: 5.5, averagePrice: 5.5,
    highPrice: 5.5, totalQuantity: 1,
  },
  {
    payItemNumber: "711-51864", description: "DRILLED HOLE",
    unit: "EACH", lowPrice: 27.0, averagePrice: 51.98,
    highPrice: 300.0, totalQuantity: 8697,
  },
  {
    payItemNumber: "711-51877", description: "JACKING AND SUPPORTING BEAMS",
    unit: "LS", lowPrice: 25000.0, averagePrice: 63236.83,
    highPrice: 99421.0, totalQuantity: 6,
  },
  {
    payItemNumber: "711-51878", description: "JACKING AND SUPPORTING GIRDERS",
    unit: "LS", lowPrice: 30900.0, averagePrice: 62842.86,
    highPrice: 100000.0, totalQuantity: 7,
  },
  {
    payItemNumber: "711-90114", description: "JACKING AND SUPPORTING SUPERSTRUCTURE",
    unit: "LS", lowPrice: 16300.0, averagePrice: 40078.57,
    highPrice: 89250.0, totalQuantity: 7,
  },
  {
    payItemNumber: "711-91047", description: "EXPANSION ANCHOR, 1 IN.",
    unit: "EACH", lowPrice: 40.0, averagePrice: 40.0,
    highPrice: 40.0, totalQuantity: 1,
  },
  {
    payItemNumber: "711-91996", description: "REPAIR EXISTING STRUCTURE",
    unit: "LS", lowPrice: 32787.0, averagePrice: 294261.67,
    highPrice: 799998.0, totalQuantity: 3,
  },
  {
    payItemNumber: "711-93035", description: "JACKING AND SUPPORTING STRUCTURAL STEEL",
    unit: "LS", lowPrice: 27500.0, averagePrice: 39667.5,
    highPrice: 60000.0, totalQuantity: 4,
  },
  {
    payItemNumber: "711-95290", description: "FIELD WELDING",
    unit: "LFT", lowPrice: 300.0, averagePrice: 300.0,
    highPrice: 300.0, totalQuantity: 1,
  },
  {
    payItemNumber: "711-95291", description: "JACKING AND SUPPORTING STEEL BEAMS",
    unit: "LS", lowPrice: 9980.0, averagePrice: 20243.33,
    highPrice: 40000.0, totalQuantity: 3,
  },
  {
    payItemNumber: "711-96479", description: "BOLT, REMOVE",
    unit: "EACH", lowPrice: 392.0, averagePrice: 392.0,
    highPrice: 392.0, totalQuantity: 168,
  },
  {
    payItemNumber: "711-96800", description: "STUD SHEAR CONNECTORS",
    unit: "EACH", lowPrice: 3.9, averagePrice: 5.0,
    highPrice: 100.0, totalQuantity: 24210,
  },
  {
    payItemNumber: "712-09730", description: "BOARDWALK",
    unit: "LFT", lowPrice: 950.0, averagePrice: 950.0,
    highPrice: 950.0, totalQuantity: 175,
  },
  {
    payItemNumber: "712-95676", description: "LUMBER AND TIMBER, TREATED",
    unit: "MFBM", lowPrice: 18000.0, averagePrice: 18000.0,
    highPrice: 18000.0, totalQuantity: 7,
  },
  {
    payItemNumber: "713-02478", description: "GUARDRAIL TRANSITION, TGB, TEMP BRIDGE APPROACHES",
    unit: "EACH", lowPrice: 1668.0, averagePrice: 1668.0,
    highPrice: 1668.0, totalQuantity: 2,
  },
  {
    payItemNumber: "713-04331", description: "TEMPORARY CAUSEWAY",
    unit: "LS", lowPrice: 12500.0, averagePrice: 303311.33,
    highPrice: 1275000.0, totalQuantity: 10,
  },
  {
    payItemNumber: "713-04509", description: "TEMPORARY PIPE",
    unit: "LS", lowPrice: 1440.43, averagePrice: 25769.48,
    highPrice: 70805.0, totalQuantity: 3,
  },
  {
    payItemNumber: "713-04643", description: "TEMPORARY ACCESS LANE",
    unit: "LS", lowPrice: 40000.0, averagePrice: 55000.0,
    highPrice: 70000.0, totalQuantity: 2,
  },
  {
    payItemNumber: "713-04858", description: "TEMPORARY BRIDGE",
    unit: "LS", lowPrice: 27110.0, averagePrice: 27110.0,
    highPrice: 27110.0, totalQuantity: 1,
  },
  {
    payItemNumber: "713-07661", description: "GUARDRAIL END TREATMENT, TYPE OS, TEMPORARY BRIDGE APPROACH",
    unit: "EACH", lowPrice: 1566.0, averagePrice: 1566.0,
    highPrice: 1566.0, totalQuantity: 2,
  },
  {
    payItemNumber: "713-51335", description: "TEMPORARY BRIDGE AND APPROACHES",
    unit: "LS", lowPrice: 800000.0, averagePrice: 826640.12,
    highPrice: 853280.24, totalQuantity: 2,
  },
  {
    payItemNumber: "713-99365", description: "GUARDRAIL, W BEAM, 6.3 FT SPACING, TEMPORARY BRIDGE APPROACH ES",
    unit: "LFT", lowPrice: 38.0, averagePrice: 38.0,
    highPrice: 38.0, totalQuantity: 425,
  },
  {
    payItemNumber: "714-000086", description: "WATERPROOFING MEMBRANE, TYPE 2",
    unit: "SFT", lowPrice: 1.55, averagePrice: 3.88,
    highPrice: 15.03, totalQuantity: 223767,
  },
  {
    payItemNumber: "714-000087", description: "WATERPROOFING MEMBRANE, TYPE 3",
    unit: "SFT", lowPrice: 2.8, averagePrice: 6.26,
    highPrice: 950.0, totalQuantity: 15531,
  },
  {
    payItemNumber: "714-000114", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 17 FT X 6 FT",
    unit: "LFT", lowPrice: 3000.0, averagePrice: 3000.0,
    highPrice: 3000.0, totalQuantity: 50,
  },
  {
    payItemNumber: "714-000125", description: "STRUCTURE, COATED REINFORCED CONCRETE, BOX SECTIONS, 7 FT X 6 FT",
    unit: "LFT", lowPrice: 2000.0, averagePrice: 2000.0,
    highPrice: 2000.0, totalQuantity: 56,
  },
  {
    payItemNumber: "714-000181", description: "STRUCTURE, COATED REINFORCED CONCRETE, BOX SECTIONS, 11 FT X  9 FT",
    unit: "LFT", lowPrice: 3100.0, averagePrice: 3100.0,
    highPrice: 3100.0, totalQuantity: 44,
  },
  {
    payItemNumber: "714-05562", description: "RETAINING WALL",
    unit: "SFT", lowPrice: 87.0, averagePrice: 122.69,
    highPrice: 180.0, totalQuantity: 2473,
  },
  {
    payItemNumber: "714-11073", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 9 FT X 6 FT 9 FT. X 6 FT.",
    unit: "LFT", lowPrice: 1120.0, averagePrice: 1266.15,
    highPrice: 1595.0, totalQuantity: 338,
  },
  {
    payItemNumber: "714-11076", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 9 FT X 8 FT 9 FT X 8 FT",
    unit: "LFT", lowPrice: 1400.0, averagePrice: 1400.0,
    highPrice: 1400.0, totalQuantity: 83,
  },
  {
    payItemNumber: "714-11078", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 11 FT X 6 FT 11 FT X 6 FT",
    unit: "LFT", lowPrice: 2100.0, averagePrice: 2308.33,
    highPrice: 2600.0, totalQuantity: 96,
  },
  {
    payItemNumber: "714-11086", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS 12 FT X 5 FT",
    unit: "LFT", lowPrice: 3950.0, averagePrice: 3950.0,
    highPrice: 3950.0, totalQuantity: 44,
  },
  {
    payItemNumber: "714-11087", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 12 FT X 5 FT 12 FT. X 5 FT.",
    unit: "LFT", lowPrice: 2198.0, averagePrice: 2360.46,
    highPrice: 2550.0, totalQuantity: 130,
  },
  {
    payItemNumber: "714-11088", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 14 FT X 10 FT .",
    unit: "LFT", lowPrice: 3500.0, averagePrice: 3500.0,
    highPrice: 3500.0, totalQuantity: 57,
  },
  {
    payItemNumber: "714-11091", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 18 FT X 4 FT 18 FT. X 4 FT.",
    unit: "LFT", lowPrice: 2500.0, averagePrice: 2500.0,
    highPrice: 2500.0, totalQuantity: 61,
  },
  {
    payItemNumber: "714-11093", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 14 FT X 8 FT 14 FT X 8 FT",
    unit: "LFT", lowPrice: 2900.0, averagePrice: 2900.0,
    highPrice: 2900.0, totalQuantity: 59,
  },
  {
    payItemNumber: "714-11094", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 9 FT X 4 FT 9 FT X 4 FT",
    unit: "LFT", lowPrice: 945.0, averagePrice: 1389.1,
    highPrice: 2187.36, totalQuantity: 221,
  },
  {
    payItemNumber: "714-11101", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 18 FT X 6 FT 18 FT. X 6 FT.",
    unit: "LFT", lowPrice: 2950.0, averagePrice: 2950.0,
    highPrice: 2950.0, totalQuantity: 65,
  },
  {
    payItemNumber: "714-11102", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 5 FT X 2 FT 5 FT. X 2 FT.",
    unit: "LFT", lowPrice: 706.74, averagePrice: 706.74,
    highPrice: 706.74, totalQuantity: 61,
  },
  {
    payItemNumber: "714-11111", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 18 FT X 7 FT 18 FT X 7 FT",
    unit: "LFT", lowPrice: 7500.0, averagePrice: 7500.0,
    highPrice: 7500.0, totalQuantity: 52,
  },
  {
    payItemNumber: "714-11128", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 18 FT X 10 FT 18 FT X 10 FT",
    unit: "LFT", lowPrice: 6250.0, averagePrice: 6250.0,
    highPrice: 6250.0, totalQuantity: 39,
  },
  {
    payItemNumber: "714-11132", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 6 FT X 2 FT 6 FT X 2 FT",
    unit: "LFT", lowPrice: 777.77, averagePrice: 777.77,
    highPrice: 777.77, totalQuantity: 448,
  },
  {
    payItemNumber: "714-11133", description: "STRUCTURE EXTENSION, REINFORCED CONCRETE, BOX SECTIONS, 3 FT  X 2 FT",
    unit: "LFT", lowPrice: 890.0, averagePrice: 890.0,
    highPrice: 890.0, totalQuantity: 44,
  },
  {
    payItemNumber: "714-11136", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 14 FT X 12 FT 14 FT X 12 FT",
    unit: "LFT", lowPrice: 2329.5, averagePrice: 2329.5,
    highPrice: 2329.5, totalQuantity: 318,
  },
  {
    payItemNumber: "714-11138", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 18 FT X 8 FT 18 FT X 8 FT",
    unit: "LFT", lowPrice: 5000.0, averagePrice: 5000.0,
    highPrice: 5000.0, totalQuantity: 62,
  },
  {
    payItemNumber: "714-11162", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 16 FT X 11 FT 16 FT X 11 FT",
    unit: "LFT", lowPrice: 6100.0, averagePrice: 6100.0,
    highPrice: 6100.0, totalQuantity: 58,
  },
  {
    payItemNumber: "714-11167", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 13 FT X 5 FT 13 FT X 5 FT",
    unit: "LFT", lowPrice: 1700.0, averagePrice: 1700.0,
    highPrice: 1700.0, totalQuantity: 92,
  },
  {
    payItemNumber: "714-11168", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 7 FT X 7 FT 7 FT X 7 FT",
    unit: "LFT", lowPrice: 1400.0, averagePrice: 1400.0,
    highPrice: 1400.0, totalQuantity: 133,
  },
  {
    payItemNumber: "714-11174", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 6 FT X 4 FT 6 FT. X 4 FT.",
    unit: "LFT", lowPrice: 1192.38, averagePrice: 1192.38,
    highPrice: 1192.38, totalQuantity: 120,
  },
  {
    payItemNumber: "714-11175", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 6 FT X 5 FT 6 FT. X 5 FT.",
    unit: "LFT", lowPrice: 834.0, averagePrice: 1450.89,
    highPrice: 1660.0, totalQuantity: 395,
  },
  {
    payItemNumber: "714-11176", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 6 FT X 6 FT 6 FT. X 6 FT.",
    unit: "LFT", lowPrice: 1227.0, averagePrice: 1227.0,
    highPrice: 1227.0, totalQuantity: 50,
  },
  {
    payItemNumber: "714-11177", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 8 FT X 4 FT 8 FT. X 4 FT.",
    unit: "LFT", lowPrice: 850.0, averagePrice: 1226.83,
    highPrice: 1941.89, totalQuantity: 178,
  },
  {
    payItemNumber: "714-11178", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 8 FT X 5 FT 8 FT. X 5 FT.",
    unit: "LFT", lowPrice: 970.0, averagePrice: 1174.93,
    highPrice: 2000.0, totalQuantity: 341,
  },
  {
    payItemNumber: "714-11179", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 8 FT X 6 FT 8 FT. X 6 FT.",
    unit: "LFT", lowPrice: 1400.0, averagePrice: 1400.0,
    highPrice: 1400.0, totalQuantity: 51,
  },
  {
    payItemNumber: "714-11180", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 8 FT X 7 FT 8 FT. X 7 FT.",
    unit: "LFT", lowPrice: 1600.0, averagePrice: 1953.63,
    highPrice: 2340.0, totalQuantity: 113,
  },
  {
    payItemNumber: "714-11181", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 8 FT X 8 FT 8 FT. X 8 FT.",
    unit: "LFT", lowPrice: 1992.74, averagePrice: 1992.74,
    highPrice: 1992.74, totalQuantity: 240,
  },
  {
    payItemNumber: "714-11182", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 10 FT X 5 FT 10 FT. X 5 FT.",
    unit: "LFT", lowPrice: 1979.0, averagePrice: 1979.0,
    highPrice: 1979.0, totalQuantity: 90,
  },
  {
    payItemNumber: "714-11183", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 10 FT X 6 FT 10 FT. X 6 FT.",
    unit: "LFT", lowPrice: 1599.0, averagePrice: 2569.0,
    highPrice: 3345.0, totalQuantity: 135,
  },
  {
    payItemNumber: "714-11186", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 12 FT X 4 FT 12 FT. X 4 FT.",
    unit: "LFT", lowPrice: 3700.0, averagePrice: 3700.0,
    highPrice: 3700.0, totalQuantity: 20,
  },
  {
    payItemNumber: "714-11187", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 12 FT X 6 FT 12 FT. X 6 FT.",
    unit: "LFT", lowPrice: 1675.0, averagePrice: 1675.0,
    highPrice: 1675.0, totalQuantity: 90,
  },
  {
    payItemNumber: "714-11188", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 12 FT X 8 FT 12 FT. X 8 FT.",
    unit: "LFT", lowPrice: 2340.59, averagePrice: 2477.5,
    highPrice: 2563.78, totalQuantity: 313,
  },
  {
    payItemNumber: "714-11189", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 12 FT X 10 FT .",
    unit: "LFT", lowPrice: 2700.0, averagePrice: 2700.0,
    highPrice: 2700.0, totalQuantity: 72,
  },
  {
    payItemNumber: "714-11190", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 5 FT X 5 FT 5 FT. X 5 FT.",
    unit: "LFT", lowPrice: 770.0, averagePrice: 770.0,
    highPrice: 770.0, totalQuantity: 112,
  },
  {
    payItemNumber: "714-11191", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 5 FT X 4 FT 5 FT. X 4 FT.",
    unit: "LFT", lowPrice: 915.0, averagePrice: 959.9,
    highPrice: 1065.0, totalQuantity: 157,
  },
  {
    payItemNumber: "714-11192", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 4 FT X 3 FT 4 FT X 3 FT",
    unit: "LFT", lowPrice: 1085.91, averagePrice: 1335.78,
    highPrice: 1700.0, totalQuantity: 145,
  },
  {
    payItemNumber: "714-11193", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 4 FT X 2 FT 4 FT. X 2 FT.",
    unit: "LFT", lowPrice: 928.5, averagePrice: 928.5,
    highPrice: 928.5, totalQuantity: 195,
  },
  {
    payItemNumber: "714-11197", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 3 FT X 2 FT 3 FT. X 2 FT.",
    unit: "LFT", lowPrice: 730.46, averagePrice: 730.46,
    highPrice: 730.46, totalQuantity: 35,
  },
  {
    payItemNumber: "714-11198", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 5 FT X 3 FT 5 FT. X 3 FT.",
    unit: "LFT", lowPrice: 700.0, averagePrice: 1153.19,
    highPrice: 4100.0, totalQuantity: 297,
  },
  {
    payItemNumber: "714-11304", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 7 FT X 4 FT 7 FT. X 4 FT.",
    unit: "LFT", lowPrice: 720.0, averagePrice: 850.33,
    highPrice: 1042.0, totalQuantity: 210,
  },
  {
    payItemNumber: "714-11308", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 7 FT X 6 FT 7 FT X 6 FT",
    unit: "LFT", lowPrice: 1066.47, averagePrice: 1168.46,
    highPrice: 1320.0, totalQuantity: 174,
  },
  {
    payItemNumber: "714-11309", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 9 FT X 5 FT 9 FT. X 5 FT.",
    unit: "LFT", lowPrice: 1300.0, averagePrice: 1300.0,
    highPrice: 1300.0, totalQuantity: 66,
  },
  {
    payItemNumber: "714-11311", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 7 FT X 5 FT 7 FT. X 5 FT.",
    unit: "LFT", lowPrice: 980.37, averagePrice: 1259.49,
    highPrice: 1995.79, totalQuantity: 227,
  },
  {
    payItemNumber: "714-11444", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 13 FT X 7 FT 13 FT. X 7 FT.",
    unit: "LFT", lowPrice: 3500.0, averagePrice: 3500.0,
    highPrice: 3500.0, totalQuantity: 52,
  },
  {
    payItemNumber: "714-11561", description: "STRUCTURE, COATED REINFORCED CONCRETE, BOX SECTIONS, 20 FT X  5 FT",
    unit: "LFT", lowPrice: 3215.0, averagePrice: 3215.0,
    highPrice: 3215.0, totalQuantity: 92,
  },
  {
    payItemNumber: "714-11580", description: "STRUCTURE, COATED REINFORCED CONCRETE, BOX SECTIONS, 10 FT X  4 FT",
    unit: "LFT", lowPrice: 2500.0, averagePrice: 2500.0,
    highPrice: 2500.0, totalQuantity: 40,
  },
  {
    payItemNumber: "714-11635", description: "STRUCTURE, COATED REINFORCED CONCRETE, BOX SECTIONS, 12 FT X  5 FT",
    unit: "LFT", lowPrice: 3100.0, averagePrice: 3100.0,
    highPrice: 3100.0, totalQuantity: 81,
  },
  {
    payItemNumber: "714-11705", description: "STRUCTURE, COATED REINFORCED CONCRETE, BOX SECTIONS, 8 FT X 4 FT",
    unit: "LFT", lowPrice: 600.0, averagePrice: 1780.54,
    highPrice: 3400.0, totalQuantity: 185,
  },
  {
    payItemNumber: "714-11725", description: "STRUCTURE, COATED REINFORCED CONCRETE, BOX SECTIONS, 16 FT X  10 FT",
    unit: "LFT", lowPrice: 3510.0, averagePrice: 3510.0,
    highPrice: 3510.0, totalQuantity: 50,
  },
  {
    payItemNumber: "714-11755", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 11 FT X 7 FT 11 FT. X 7 FT.",
    unit: "LFT", lowPrice: 1900.0, averagePrice: 1900.0,
    highPrice: 1900.0, totalQuantity: 122,
  },
  {
    payItemNumber: "714-11767", description: "STRUCTURE, COATED REINFORCED CONCRETE, BOX SECTIONS, 10 FT X  5 FT",
    unit: "LFT", lowPrice: 1400.0, averagePrice: 1400.0,
    highPrice: 1400.0, totalQuantity: 155,
  },
  {
    payItemNumber: "714-12009", description: "STRUCTURE, COATED REINFORCED CONCRETE, BOX SECTIONS, 10 FT X  3 FT",
    unit: "LFT", lowPrice: 1995.0, averagePrice: 1995.0,
    highPrice: 1995.0, totalQuantity: 101,
  },
  {
    payItemNumber: "714-12345", description: "STRUCTURE, COATED REINFORCED CONCRETE, BOX SECTIONS, 16 FT X  6 FT",
    unit: "LFT", lowPrice: 2500.0, averagePrice: 2500.0,
    highPrice: 2500.0, totalQuantity: 60,
  },
  {
    payItemNumber: "714-12438", description: "STRUCTURE, COATED REINFORCED CONCRETE, BOX SECTIONS, 4 FT X 4 FT",
    unit: "LFT", lowPrice: 1100.0, averagePrice: 1100.0,
    highPrice: 1100.0, totalQuantity: 62,
  },
  {
    payItemNumber: "714-12455", description: "STRUCTURE, COATED REINFORCED CONCRETE, BOX SECTIONS, 20 FT X  6 FT",
    unit: "LFT", lowPrice: 4350.0, averagePrice: 4350.0,
    highPrice: 4350.0, totalQuantity: 42,
  },
  {
    payItemNumber: "714-12489", description: "STRUCTURE EXTENSION, REINFORCED CONCRETE, BOX SECTIONS, 5 FT  X 3 FT",
    unit: "LFT", lowPrice: 5640.0, averagePrice: 5640.0,
    highPrice: 5640.0, totalQuantity: 23,
  },
  {
    payItemNumber: "714-12499", description: "STRUCTURE, COATED REINFORCED CONCRETE, BOX SECTIONS, 5 FT X 3 FT",
    unit: "LFT", lowPrice: 1500.0, averagePrice: 1500.0,
    highPrice: 1500.0, totalQuantity: 44,
  },
  {
    payItemNumber: "714-12516", description: "STRUCTURE, COATED REINFORCED CONCRETE, BOX SECTIONS, 3 FT X 2 FT",
    unit: "LFT", lowPrice: 1665.0, averagePrice: 1665.0,
    highPrice: 1665.0, totalQuantity: 63,
  },
  {
    payItemNumber: "714-12522", description: "STRUCTURE, COATED REINFORCED CONCRETE, BOX SECTIONS, 11 FT X  4 FT",
    unit: "LFT", lowPrice: 1800.0, averagePrice: 1800.0,
    highPrice: 1800.0, totalQuantity: 44,
  },
  {
    payItemNumber: "714-12575", description: "STRUCTURE EXTENSION, REINFORCED CONCRETE, BOX SECTIONS, 4 FT  X 3 FT",
    unit: "LFT", lowPrice: 1500.0, averagePrice: 1619.44,
    highPrice: 2575.0, totalQuantity: 45,
  },
  {
    payItemNumber: "714-12807", description: "STRUCTURE, COATED REINFORCED CONCRETE, BOX SECTIONS, 5 FT X 4 FT",
    unit: "LFT", lowPrice: 1400.0, averagePrice: 1400.0,
    highPrice: 1400.0, totalQuantity: 53,
  },
  {
    payItemNumber: "714-12886", description: "STRUCTURE EXTENSION, REINFORCED CONCRETE, BOX SECTIONS, 4 FT  X 2 FT",
    unit: "LFT", lowPrice: 850.0, averagePrice: 850.0,
    highPrice: 850.0, totalQuantity: 34,
  },
  {
    payItemNumber: "714-12898", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 11 FT X 10 FT",
    unit: "LFT", lowPrice: 2850.0, averagePrice: 2850.0,
    highPrice: 2850.0, totalQuantity: 38,
  },
  {
    payItemNumber: "714-12926", description: "STRUCTURE EXTENSION, REINFORCED CONCRETE, BOX SECTIONS, 7 FT  X 6 FT",
    unit: "LFT", lowPrice: 6245.0, averagePrice: 6245.0,
    highPrice: 6245.0, totalQuantity: 43,
  },
  {
    payItemNumber: "714-12964", description: "STRUCTURE, REINFORCED CONCRETE, BOX SECTIONS, 22 FT X 9 FT",
    unit: "LFT", lowPrice: 3600.0, averagePrice: 3600.0,
    highPrice: 3600.0, totalQuantity: 147,
  },
  {
    payItemNumber: "714-12985", description: "STRUCTURE, COATED REINFORCED CONCRETE, BOX SECTIONS, 17 FT X  10 FT",
    unit: "LFT", lowPrice: 4080.0, averagePrice: 4080.0,
    highPrice: 4080.0, totalQuantity: 120,
  },
  {
    payItemNumber: "714-96273", description: "HEADWALL RECONSTRUCT",
    unit: "LS", lowPrice: 9500.0, averagePrice: 25228.86,
    highPrice: 40000.0, totalQuantity: 5,
  },
  {
    payItemNumber: "715-000129", description: "GRATED BOX END SECTION, I, 2:1, DIAMETER 54 IN.",
    unit: "EACH", lowPrice: 24131.03, averagePrice: 29565.52,
    highPrice: 35000.0, totalQuantity: 2,
  },
  {
    payItemNumber: "715-000152", description: "GRATED BOX END SECTION, TYPE I, 2:1, DIAMETER 21 IN.",
    unit: "EACH", lowPrice: 10000.0, averagePrice: 10000.0,
    highPrice: 10000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "715-000153", description: "GRATED BOX END SECTION, TYPE I, 4:1, DIAMETER 21 IN.",
    unit: "EACH", lowPrice: 15000.0, averagePrice: 15000.0,
    highPrice: 15000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "715-000154", description: "GRATED BOX END SECTION, TYPE I, 2:1, DIAMETER 27 IN.",
    unit: "EACH", lowPrice: 11000.0, averagePrice: 11000.0,
    highPrice: 11000.0, totalQuantity: 2,
  },
  {
    payItemNumber: "715-000186", description: "PIPE END SECTION, MIN. AREA 42.4 SFT",
    unit: "EACH", lowPrice: 25000.0, averagePrice: 25000.0,
    highPrice: 25000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "715-000187", description: "PIPE, SLOTTED DRAIN, DIAMETER 4 IN.",
    unit: "LFT", lowPrice: 180.0, averagePrice: 180.0,
    highPrice: 180.0, totalQuantity: 52,
  },
  {
    payItemNumber: "715-01336", description: "GATE VALVE 12 IN.",
    unit: "EACH", lowPrice: 12950.0, averagePrice: 12950.0,
    highPrice: 12950.0, totalQuantity: 2,
  },
  {
    payItemNumber: "715-01354", description: "CLEAN EXISTING PIPE",
    unit: "LFT", lowPrice: 11.25, averagePrice: 53.26,
    highPrice: 220.0, totalQuantity: 2490,
  },
  {
    payItemNumber: "715-01384", description: "PIPE, DUCTILE IRON, DIAMETER 10 IN.",
    unit: "LFT", lowPrice: 85.0, averagePrice: 85.0,
    highPrice: 85.0, totalQuantity: 267,
  },
  {
    payItemNumber: "715-01525", description: "VALVE BOX",
    unit: "EACH", lowPrice: 40.0, averagePrice: 40.0,
    highPrice: 40.0, totalQuantity: 1,
  },
  {
    payItemNumber: "715-01662", description: "PIPE CLEANING, DIAMETER 12 IN. TO 48 IN.",
    unit: "LFT", lowPrice: 23.0, averagePrice: 134.43,
    highPrice: 175.0, totalQuantity: 790,
  },
  {
    payItemNumber: "715-01902", description: "WATER SERVICE LINE, 2 IN.",
    unit: "LFT", lowPrice: 25.0, averagePrice: 73.05,
    highPrice: 127.0, totalQuantity: 772,
  },
  {
    payItemNumber: "715-02012", description: "PIPE, DUCTILE IRON, 24 IN.",
    unit: "LFT", lowPrice: 405.0, averagePrice: 405.0,
    highPrice: 405.0, totalQuantity: 300,
  },
  {
    payItemNumber: "715-02181", description: "SANITARY SEWER SERVICE ADJUSTMENT",
    unit: "LFT", lowPrice: 35.0, averagePrice: 35.0,
    highPrice: 35.0, totalQuantity: 137,
  },
  {
    payItemNumber: "715-02246", description: "PIPE END SECTION, DIAMETER 48 IN.",
    unit: "EACH", lowPrice: 3309.98, averagePrice: 4745.71,
    highPrice: 5610.0, totalQuantity: 7,
  },
  {
    payItemNumber: "715-02388", description: "WATER MAIN",
    unit: "EACH", lowPrice: 981.0, averagePrice: 14295.75,
    highPrice: 28700.0, totalQuantity: 20,
  },
  {
    payItemNumber: "715-02397", description: "SAFETY METAL END SECTION, 4:1, DIAMETER 36 IN.",
    unit: "EACH", lowPrice: 5455.0, averagePrice: 8089.38,
    highPrice: 10435.0, totalQuantity: 8,
  },
  {
    payItemNumber: "715-02399", description: "SAFETY METAL END SECTION, 4:1, DIAMETER 42 IN.",
    unit: "EACH", lowPrice: 12000.0, averagePrice: 12000.0,
    highPrice: 12000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "715-02407", description: "SAFETY METAL END SECTION, 4:1, DIAMETER 48 IN.",
    unit: "EACH", lowPrice: 7969.6, averagePrice: 9313.07,
    highPrice: 12000.0, totalQuantity: 3,
  },
  {
    payItemNumber: "715-02433", description: "VALVE WITH BOX, RESTRAINED GATE, DUCTILE IRON, 12 IN.",
    unit: "EACH", lowPrice: 6800.0, averagePrice: 6800.0,
    highPrice: 6800.0, totalQuantity: 3,
  },
  {
    payItemNumber: "715-02531", description: "VALVE WITH BOX, RESTRAINED GATE, DUCTILE IRON, 6 IN.",
    unit: "EACH", lowPrice: 3200.0, averagePrice: 3200.0,
    highPrice: 3200.0, totalQuantity: 4,
  },
  {
    payItemNumber: "715-02532", description: "VALVE WITH BOX, RESTRAINED GATE, DUCTILE IRON, 8 IN.",
    unit: "EACH", lowPrice: 4400.0, averagePrice: 4400.0,
    highPrice: 4400.0, totalQuantity: 3,
  },
  {
    payItemNumber: "715-02574", description: "WATER SERVICE CONNECTION, 2 IN.",
    unit: "EACH", lowPrice: 3400.0, averagePrice: 3400.0,
    highPrice: 3400.0, totalQuantity: 10,
  },
  {
    payItemNumber: "715-02628", description: "SAFETY METAL END SECTION, 6:1, DIAMETER 15 IN.",
    unit: "EACH", lowPrice: 1400.0, averagePrice: 1743.18,
    highPrice: 2100.0, totalQuantity: 44,
  },
  {
    payItemNumber: "715-02629", description: "SAFETY METAL END SECTION, 6:1, DIAMETER 18 IN.",
    unit: "EACH", lowPrice: 2400.0, averagePrice: 2400.0,
    highPrice: 2400.0, totalQuantity: 1,
  },
  {
    payItemNumber: "715-02630", description: "SAFETY METAL END SECTION, 6:1, DIAMETER 24 IN.",
    unit: "EACH", lowPrice: 3000.0, averagePrice: 3000.0,
    highPrice: 3000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "715-02744", description: "GATE VALVE WITH VALVE BOX, 6 IN.",
    unit: "EACH", lowPrice: 3302.89, averagePrice: 3375.72,
    highPrice: 3400.0, totalQuantity: 4,
  },
  {
    payItemNumber: "715-02874", description: "CURB STOP AND BOX",
    unit: "EACH", lowPrice: 750.0, averagePrice: 1450.0,
    highPrice: 3200.0, totalQuantity: 21,
  },
  {
    payItemNumber: "715-03053", description: "METER PIT",
    unit: "EACH", lowPrice: 2100.0, averagePrice: 2100.0,
    highPrice: 2100.0, totalQuantity: 33,
  },
  {
    payItemNumber: "715-03321", description: "SAFETY METAL END SECTION, 6:1, DIAMETER 12 IN.",
    unit: "EACH", lowPrice: 1394.0, averagePrice: 1394.0,
    highPrice: 1394.0, totalQuantity: 1,
  },
  {
    payItemNumber: "715-03475", description: "SAFETY METAL END SECTION, 4:1, DIAMETER 15 IN.",
    unit: "EACH", lowPrice: 929.0, averagePrice: 1990.01,
    highPrice: 2700.0, totalQuantity: 66,
  },
  {
    payItemNumber: "715-03476", description: "SAFETY METAL END SECTION, 4:1, DIAMETER 24 IN.",
    unit: "EACH", lowPrice: 1900.0, averagePrice: 2666.81,
    highPrice: 3930.0, totalQuantity: 8,
  },
  {
    payItemNumber: "715-03542", description: "WATER MAIN, 6 IN., RELOCATE",
    unit: "EACH", lowPrice: 6000.0, averagePrice: 6000.0,
    highPrice: 6000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "715-03584", description: "SAFETY METAL END SECTION, 4:1, DIAMETER 18 IN.",
    unit: "EACH", lowPrice: 1350.0, averagePrice: 2222.78,
    highPrice: 3240.0, totalQuantity: 8,
  },
  {
    payItemNumber: "715-04222", description: "SAFETY METAL END SECTION, 4:1, MIN. AREA 4.7 SFT MIN AREA 4.7 SFT",
    unit: "EACH", lowPrice: 5370.0, averagePrice: 5370.0,
    highPrice: 5370.0, totalQuantity: 2,
  },
  {
    payItemNumber: "715-04482", description: "PIPE CONNECTION COLLAR AND PAD",
    unit: "EACH", lowPrice: 1807.03, averagePrice: 1807.03,
    highPrice: 1807.03, totalQuantity: 2,
  },
  {
    payItemNumber: "715-04522", description: "PIPE END SECTION, DIAMETER 42 IN.",
    unit: "EACH", lowPrice: 3000.0, averagePrice: 4497.45,
    highPrice: 5689.37, totalQuantity: 17,
  },
  {
    payItemNumber: "715-04555", description: "PIPE END SECTION, MIN. AREA 5.1 SFT",
    unit: "EACH", lowPrice: 2400.0, averagePrice: 2680.37,
    highPrice: 2820.56, totalQuantity: 6,
  },
  {
    payItemNumber: "715-04596", description: "WATER SERVICE",
    unit: "EACH", lowPrice: 300.0, averagePrice: 300.0,
    highPrice: 300.0, totalQuantity: 16,
  },
  {
    payItemNumber: "715-04611", description: "SAFETY METAL END SECTION, 4:1, DIAMETER 12 IN.",
    unit: "EACH", lowPrice: 1024.0, averagePrice: 1457.35,
    highPrice: 1731.0, totalQuantity: 12,
  },
  {
    payItemNumber: "715-04612", description: "PIPE",
    unit: "LFT", lowPrice: 70.0, averagePrice: 110.83,
    highPrice: 150.0, totalQuantity: 924,
  },
  {
    payItemNumber: "715-04750", description: "CORPORATION STOP",
    unit: "EACH", lowPrice: 2360.0, averagePrice: 2817.14,
    highPrice: 3000.0, totalQuantity: 21,
  },
  {
    payItemNumber: "715-04809", description: "PIPE, PVC, 3 IN.",
    unit: "LFT", lowPrice: 51.46, averagePrice: 51.46,
    highPrice: 51.46, totalQuantity: 10,
  },
  {
    payItemNumber: "715-04836", description: "GATE VALVE",
    unit: "EACH", lowPrice: 1800.0, averagePrice: 8046.02,
    highPrice: 35000.0, totalQuantity: 30,
  },
  {
    payItemNumber: "715-04855", description: "PIPE END SECTION, DIAMETER 42 IN.",
    unit: "EACH", lowPrice: 4500.0, averagePrice: 4500.0,
    highPrice: 4500.0, totalQuantity: 2,
  },
  {
    payItemNumber: "715-04926", description: "VALVE",
    unit: "EACH", lowPrice: 1800.0, averagePrice: 8200.0,
    highPrice: 11400.0, totalQuantity: 3,
  },
  {
    payItemNumber: "715-04964", description: "WATER MAIN",
    unit: "LFT", lowPrice: 370.0, averagePrice: 370.0,
    highPrice: 370.0, totalQuantity: 29,
  },
  {
    payItemNumber: "715-04965", description: "WATER SERVICE LINE",
    unit: "LFT", lowPrice: 70.0, averagePrice: 143.8,
    highPrice: 272.0, totalQuantity: 309,
  },
  {
    payItemNumber: "715-04994", description: "METER",
    unit: "EACH", lowPrice: 75.0, averagePrice: 754.84,
    highPrice: 1500.0, totalQuantity: 31,
  },
  {
    payItemNumber: "715-04995", description: "LINE STOP",
    unit: "EACH", lowPrice: 5500.0, averagePrice: 10571.84,
    highPrice: 16600.0, totalQuantity: 49,
  },
  {
    payItemNumber: "715-05019", description: "PIPE, TYPE 1, CIRCULAR, DIAMETER 36 IN.",
    unit: "LFT", lowPrice: 140.0, averagePrice: 272.9,
    highPrice: 1076.0, totalQuantity: 2006,
  },
  {
    payItemNumber: "715-05024", description: "PIPE, TYPE 2, CIRCULAR, DIAMETER 36 IN.",
    unit: "LFT", lowPrice: 91.68, averagePrice: 131.56,
    highPrice: 570.0, totalQuantity: 8767,
  },
  {
    payItemNumber: "715-05032", description: "PIPE, TYPE 2, CIRCULAR, DIAMETER 15 IN.",
    unit: "LFT", lowPrice: 30.0, averagePrice: 85.71,
    highPrice: 435.0, totalQuantity: 7527,
  },
  {
    payItemNumber: "715-05048", description: "PIPE, TYPE 4, CIRCULAR, DIAMETER 6 IN.",
    unit: "LFT", lowPrice: 3.66, averagePrice: 8.77,
    highPrice: 115.0, totalQuantity: 246686,
  },
  {
    payItemNumber: "715-05049", description: "PIPE, TYPE 4, CIRCULAR, DIAMETER 8 IN.",
    unit: "LFT", lowPrice: 12.0, averagePrice: 12.0,
    highPrice: 12.0, totalQuantity: 20,
  },
  {
    payItemNumber: "715-05051", description: "PIPE, TYPE 4, CIRCULAR, DIAMETER 10 IN.",
    unit: "LFT", lowPrice: 29.0, averagePrice: 29.68,
    highPrice: 30.0, totalQuantity: 62,
  },
  {
    payItemNumber: "715-05052", description: "PIPE, TYPE 4, CIRCULAR, DIAMETER 12 IN.",
    unit: "LFT", lowPrice: 17.0, averagePrice: 41.84,
    highPrice: 250.0, totalQuantity: 583,
  },
  {
    payItemNumber: "715-05053", description: "PIPE, UNDERDRAIN OUTLET, DIAMETER 6 IN.",
    unit: "LFT", lowPrice: 8.0, averagePrice: 29.73,
    highPrice: 440.0, totalQuantity: 21128,
  },
  {
    payItemNumber: "715-05061", description: "WATER SERVICE LINE, 6 IN.",
    unit: "LFT", lowPrice: 154.0, averagePrice: 154.0,
    highPrice: 154.0, totalQuantity: 110,
  },
  {
    payItemNumber: "715-05115", description: "PIPE, TYPE 1, CIRCULAR, DIAMETER 6 IN.",
    unit: "LFT", lowPrice: 39.95, averagePrice: 39.95,
    highPrice: 39.95, totalQuantity: 35,
  },
  {
    payItemNumber: "715-05118", description: "PIPE, TYPE 1, CIRCULAR, DIAMETER 12 IN.",
    unit: "LFT", lowPrice: 60.0, averagePrice: 118.08,
    highPrice: 250.0, totalQuantity: 714,
  },
  {
    payItemNumber: "715-05119", description: "PIPE, TYPE 1, CIRCULAR, DIAMETER 15 IN.",
    unit: "LFT", lowPrice: 50.0, averagePrice: 124.69,
    highPrice: 453.0, totalQuantity: 3082,
  },
  {
    payItemNumber: "715-05121", description: "PIPE, TYPE 1, CIRCULAR, DIAMETER 18 IN.",
    unit: "LFT", lowPrice: 67.0, averagePrice: 116.8,
    highPrice: 328.0, totalQuantity: 1624,
  },
  {
    payItemNumber: "715-05122", description: "PIPE, TYPE 1, CIRCULAR, DIAMETER 21 IN.",
    unit: "LFT", lowPrice: 130.0, averagePrice: 132.53,
    highPrice: 142.0, totalQuantity: 516,
  },
  {
    payItemNumber: "715-05123", description: "PIPE, TYPE 1, CIRCULAR, DIAMETER 24 IN.",
    unit: "LFT", lowPrice: 52.14, averagePrice: 139.01,
    highPrice: 450.0, totalQuantity: 2242,
  },
  {
    payItemNumber: "715-05124", description: "PIPE, TYPE 1, CIRCULAR, DIAMETER 27 IN.",
    unit: "LFT", lowPrice: 213.0, averagePrice: 213.0,
    highPrice: 213.0, totalQuantity: 143,
  },
  {
    payItemNumber: "715-05125", description: "PIPE, TYPE 1, CIRCULAR, DIAMETER 30 IN.",
    unit: "LFT", lowPrice: 102.5, averagePrice: 203.04,
    highPrice: 800.0, totalQuantity: 1856,
  },
  {
    payItemNumber: "715-05127", description: "PIPE, TYPE 1, CIRCULAR, DIAMETER 42 IN.",
    unit: "LFT", lowPrice: 170.0, averagePrice: 303.96,
    highPrice: 661.0, totalQuantity: 961,
  },
  {
    payItemNumber: "715-05128", description: "PIPE, TYPE 1, CIRCULAR, DIAMETER 48 IN.",
    unit: "LFT", lowPrice: 1.0, averagePrice: 167.18,
    highPrice: 297.0, totalQuantity: 733,
  },
  {
    payItemNumber: "715-05129", description: "PIPE, TYPE 1, CIRCULAR, DIAMETER 54 IN.",
    unit: "LFT", lowPrice: 700.0, averagePrice: 700.0,
    highPrice: 700.0, totalQuantity: 44,
  },
  {
    payItemNumber: "715-05133", description: "PIPE, TYPE 1, CIRCULAR, DIAMETER 60 IN.",
    unit: "LFT", lowPrice: 320.39, averagePrice: 750.86,
    highPrice: 1600.0, totalQuantity: 855,
  },
  {
    payItemNumber: "715-05136", description: "PIPE, TYPE 1, CIRCULAR, DIAMETER 72 IN.",
    unit: "LFT", lowPrice: 423.63, averagePrice: 664.54,
    highPrice: 970.0, totalQuantity: 373,
  },
  {
    payItemNumber: "715-05141", description: "PIPE, TYPE 1, CIRCULAR, DIAMETER 84 IN.",
    unit: "LFT", lowPrice: 1050.0, averagePrice: 1050.0,
    highPrice: 1050.0, totalQuantity: 169,
  },
  {
    payItemNumber: "715-05143", description: "PIPE, TYPE 1, CIRCULAR, DIAMETER 90 IN.",
    unit: "LFT", lowPrice: 1950.0, averagePrice: 1950.0,
    highPrice: 1950.0, totalQuantity: 192,
  },
  {
    payItemNumber: "715-05145", description: "PIPE, TYPE 1, CIRCULAR, DIAMETER 96 IN.",
    unit: "LFT", lowPrice: 1500.0, averagePrice: 1817.48,
    highPrice: 1975.0, totalQuantity: 688,
  },
  {
    payItemNumber: "715-05146", description: "PIPE, TYPE 2, CIRCULAR, DIAMETER 6 IN.",
    unit: "LFT", lowPrice: 52.0, averagePrice: 65.42,
    highPrice: 616.29, totalQuantity: 170,
  },
  {
    payItemNumber: "715-05147", description: "PIPE, TYPE 2, CIRCULAR, DIAMETER 8 IN.",
    unit: "LFT", lowPrice: 50.0, averagePrice: 207.41,
    highPrice: 479.29, totalQuantity: 326,
  },
  {
    payItemNumber: "715-05148", description: "PIPE, TYPE 2, CIRCULAR, DIAMETER 10 IN.",
    unit: "LFT", lowPrice: 65.0, averagePrice: 131.97,
    highPrice: 255.43, totalQuantity: 243,
  },
  {
    payItemNumber: "715-05149", description: "PIPE, TYPE 2, CIRCULAR, DIAMETER 12 IN.",
    unit: "LFT", lowPrice: 28.0, averagePrice: 70.77,
    highPrice: 830.0, totalQuantity: 79907,
  },
  {
    payItemNumber: "715-05151", description: "PIPE, TYPE 2, CIRCULAR, DIAMETER 15 IN.",
    unit: "LFT", lowPrice: 31.0, averagePrice: 67.16,
    highPrice: 958.52, totalQuantity: 28927,
  },
  {
    payItemNumber: "715-05152", description: "PIPE, TYPE 2, CIRCULAR, DIAMETER 18 IN.",
    unit: "LFT", lowPrice: 40.69, averagePrice: 82.16,
    highPrice: 510.04, totalQuantity: 22141,
  },
  {
    payItemNumber: "715-05153", description: "PIPE, TYPE 2, CIRCULAR, DIAMETER 21 IN.",
    unit: "LFT", lowPrice: 84.5, averagePrice: 89.97,
    highPrice: 109.11, totalQuantity: 6460,
  },
  {
    payItemNumber: "715-05154", description: "PIPE, TYPE 2, CIRCULAR, DIAMETER 24 IN.",
    unit: "LFT", lowPrice: 55.93, averagePrice: 94.85,
    highPrice: 599.0, totalQuantity: 19700,
  },
  {
    payItemNumber: "715-05155", description: "PIPE, TYPE 2, CIRCULAR, DIAMETER 27 IN.",
    unit: "LFT", lowPrice: 209.0, averagePrice: 331.5,
    highPrice: 356.0, totalQuantity: 36,
  },
  {
    payItemNumber: "715-05156", description: "PIPE, TYPE 2, CIRCULAR, DIAMETER 30 IN.",
    unit: "LFT", lowPrice: 78.57, averagePrice: 117.83,
    highPrice: 308.0, totalQuantity: 18157,
  },
  {
    payItemNumber: "715-05157", description: "PIPE, TYPE 2, CIRCULAR, DIAMETER 33 IN.",
    unit: "LFT", lowPrice: 182.0, averagePrice: 182.0,
    highPrice: 182.0, totalQuantity: 1005,
  },
  {
    payItemNumber: "715-05159", description: "PIPE, TYPE 2, CIRCULAR, DIAMETER 42 IN.",
    unit: "LFT", lowPrice: 107.21, averagePrice: 212.01,
    highPrice: 562.0, totalQuantity: 1927,
  },
  {
    payItemNumber: "715-05161", description: "PIPE, TYPE 2, CIRCULAR, DIAMETER 48 IN.",
    unit: "LFT", lowPrice: 135.4, averagePrice: 224.46,
    highPrice: 273.12, totalQuantity: 1682,
  },
  {
    payItemNumber: "715-05162", description: "PIPE, TYPE 2, CIRCULAR, DIAMETER 54 IN.",
    unit: "LFT", lowPrice: 331.0, averagePrice: 331.0,
    highPrice: 331.0, totalQuantity: 1121,
  },
  {
    payItemNumber: "715-05163", description: "PIPE, TYPE 2, CIRCULAR, DIAMETER 60 IN.",
    unit: "LFT", lowPrice: 363.0, averagePrice: 395.52,
    highPrice: 1280.0, totalQuantity: 141,
  },
  {
    payItemNumber: "715-05165", description: "PIPE, TYPE 2, CIRCULAR, DIAMETER 72 IN.",
    unit: "LFT", lowPrice: 575.41, averagePrice: 575.41,
    highPrice: 575.41, totalQuantity: 100,
  },
  {
    payItemNumber: "715-05168", description: "PIPE, TYPE 3, CIRCULAR, DIAMETER 12 IN.",
    unit: "LFT", lowPrice: 49.43, averagePrice: 77.25,
    highPrice: 125.0, totalQuantity: 1272,
  },
  {
    payItemNumber: "715-05169", description: "PIPE, TYPE 3, CIRCULAR, DIAMETER 15 IN.",
    unit: "LFT", lowPrice: 45.0, averagePrice: 74.39,
    highPrice: 314.66, totalQuantity: 6813,
  },
  {
    payItemNumber: "715-05171", description: "PIPE, TYPE 3, CIRCULAR, DIAMETER 18 IN.",
    unit: "LFT", lowPrice: 60.0, averagePrice: 103.99,
    highPrice: 170.0, totalQuantity: 1194,
  },
  {
    payItemNumber: "715-05172", description: "PIPE, TYPE 3, CIRCULAR, DIAMETER 21 IN.",
    unit: "LFT", lowPrice: 98.44, averagePrice: 98.44,
    highPrice: 98.44, totalQuantity: 84,
  },
  {
    payItemNumber: "715-05173", description: "PIPE, TYPE 3, CIRCULAR, DIAMETER 24 IN.",
    unit: "LFT", lowPrice: 85.09, averagePrice: 124.36,
    highPrice: 200.0, totalQuantity: 853,
  },
  {
    payItemNumber: "715-05175", description: "PIPE, TYPE 3, CIRCULAR, DIAMETER 30 IN.",
    unit: "LFT", lowPrice: 110.0, averagePrice: 140.13,
    highPrice: 201.0, totalQuantity: 151,
  },
  {
    payItemNumber: "715-05177", description: "PIPE, TYPE 3, CIRCULAR, DIAMETER 36 IN.",
    unit: "LFT", lowPrice: 112.67, averagePrice: 210.07,
    highPrice: 250.5, totalQuantity: 512,
  },
  {
    payItemNumber: "715-05178", description: "PIPE, TYPE 3, CIRCULAR, DIAMETER 42 IN.",
    unit: "LFT", lowPrice: 298.0, averagePrice: 298.0,
    highPrice: 298.0, totalQuantity: 78,
  },
  {
    payItemNumber: "715-05186", description: "PIPE, TYPE 3, CIRCULAR, DIAMETER 48 IN.",
    unit: "LFT", lowPrice: 244.65, averagePrice: 244.65,
    highPrice: 244.65, totalQuantity: 74,
  },
  {
    payItemNumber: "715-05203", description: "PIPE, TYPE 4, CIRCULAR, DIAMETER 4 IN.",
    unit: "LFT", lowPrice: 8.0, averagePrice: 16.8,
    highPrice: 230.0, totalQuantity: 1002,
  },
  {
    payItemNumber: "715-05208", description: "PIPE, TYPE 4, CIRCULAR, DIAMETER 15 IN.",
    unit: "LFT", lowPrice: 22.0, averagePrice: 37.57,
    highPrice: 95.0, totalQuantity: 35,
  },
  {
    payItemNumber: "715-05209", description: "PIPE, TYPE 4, CIRCULAR, DIAMETER 18 IN.",
    unit: "LFT", lowPrice: 30.0, averagePrice: 59.77,
    highPrice: 220.0, totalQuantity: 88,
  },
  {
    payItemNumber: "715-05212", description: "PIPE, TYPE 4, CIRCULAR, DIAMETER 24 IN.",
    unit: "LFT", lowPrice: 50.0, averagePrice: 50.0,
    highPrice: 50.0, totalQuantity: 20,
  },
  {
    payItemNumber: "715-05228", description: "PIPE, TYPE 1, DEFORMED, MIN. AREA 1.6 SFT",
    unit: "LFT", lowPrice: 136.0, averagePrice: 136.0,
    highPrice: 136.0, totalQuantity: 85,
  },
  {
    payItemNumber: "715-05233", description: "PIPE, TYPE 1, DEFORMED, MIN. AREA 3.3 SFT",
    unit: "LFT", lowPrice: 250.0, averagePrice: 250.0,
    highPrice: 250.0, totalQuantity: 57,
  },
  {
    payItemNumber: "715-05239", description: "PIPE, TYPE 1, DEFORMED, MIN. AREA 7.4 SFT",
    unit: "LFT", lowPrice: 80.0, averagePrice: 216.66,
    highPrice: 265.0, totalQuantity: 287,
  },
  {
    payItemNumber: "715-05247", description: "PIPE, TYPE 1, DEFORMED, MIN. AREA 15.6 SFT",
    unit: "LFT", lowPrice: 571.54, averagePrice: 571.54,
    highPrice: 571.54, totalQuantity: 88,
  },
  {
    payItemNumber: "715-05331", description: "PIPE, TYPE 2, DEFORMED, MIN. AREA 3.3 SFT",
    unit: "LFT", lowPrice: 145.4, averagePrice: 191.56,
    highPrice: 204.26, totalQuantity: 431,
  },
  {
    payItemNumber: "715-05335", description: "PIPE, TYPE 2, DEFORMED, MIN. AREA 5.1 SFT",
    unit: "LFT", lowPrice: 182.95, averagePrice: 182.95,
    highPrice: 182.95, totalQuantity: 144,
  },
  {
    payItemNumber: "715-05344", description: "PIPE, TYPE 2, DEFORMED, MIN. AREA 12.9 SFT",
    unit: "LFT", lowPrice: 1355.0, averagePrice: 1355.0,
    highPrice: 1355.0, totalQuantity: 5,
  },
  {
    payItemNumber: "715-05363", description: "PIPE, TYPE 3, DEFORMED, MIN. AREA 1.8 SFT",
    unit: "LFT", lowPrice: 211.0, averagePrice: 211.0,
    highPrice: 211.0, totalQuantity: 38,
  },
  {
    payItemNumber: "715-05372", description: "PIPE, TYPE 3, DEFORMED, MIN. AREA 7.4 SFT",
    unit: "LFT", lowPrice: 203.45, averagePrice: 203.45,
    highPrice: 203.45, totalQuantity: 48,
  },
  {
    payItemNumber: "715-05407", description: "PIPE, END BENT DRAIN, DIAMETER 6 IN.",
    unit: "LFT", lowPrice: 4.0, averagePrice: 25.0,
    highPrice: 171.0, totalQuantity: 7410,
  },
  {
    payItemNumber: "715-05408", description: "PIPE, SANITARY SEWER, DIAMETER 8 IN.",
    unit: "LFT", lowPrice: 130.0, averagePrice: 139.54,
    highPrice: 140.0, totalQuantity: 217,
  },
  {
    payItemNumber: "715-05409", description: "PIPE, SANITARY SEWER, DIAMETER 10 IN.",
    unit: "LFT", lowPrice: 427.0, averagePrice: 427.0,
    highPrice: 427.0, totalQuantity: 451,
  },
  {
    payItemNumber: "715-05415", description: "PIPE, SANITARY SEWER, DIAMETER 24 IN.",
    unit: "LFT", lowPrice: 415.0, averagePrice: 415.0,
    highPrice: 415.0, totalQuantity: 48,
  },
  {
    payItemNumber: "715-05422", description: "PIPE, SLOTTED DRAIN, DIAMETER 12 IN.",
    unit: "LFT", lowPrice: 90.0, averagePrice: 146.33,
    highPrice: 223.89, totalQuantity: 6735,
  },
  {
    payItemNumber: "715-05423", description: "PIPE, SLOTTED DRAIN, DIAMETER 15 IN.",
    unit: "LFT", lowPrice: 226.77, averagePrice: 226.77,
    highPrice: 226.77, totalQuantity: 221,
  },
  {
    payItemNumber: "715-05424", description: "PIPE, SLOTTED DRAIN, DIAMETER 18 IN.",
    unit: "LFT", lowPrice: 257.0, averagePrice: 257.0,
    highPrice: 257.0, totalQuantity: 53,
  },
  {
    payItemNumber: "715-05435", description: "PIPE, UNDERDRAIN OUTLET, DIAMETER 4 IN.",
    unit: "LFT", lowPrice: 70.0, averagePrice: 70.0,
    highPrice: 70.0, totalQuantity: 55,
  },
  {
    payItemNumber: "715-05595", description: "PIPE EXTENSION, CIRCULAR, DIAMETER 15 IN.",
    unit: "LFT", lowPrice: 148.0, averagePrice: 148.0,
    highPrice: 148.0, totalQuantity: 13,
  },
  {
    payItemNumber: "715-05596", description: "PIPE EXTENSION, CIRCULAR, DIAMETER 18 IN.",
    unit: "LFT", lowPrice: 142.78, averagePrice: 191.47,
    highPrice: 573.0, totalQuantity: 104,
  },
  {
    payItemNumber: "715-05597", description: "PIPE EXTENSION, CIRCULAR, DIAMETER 24 IN.",
    unit: "LFT", lowPrice: 158.36, averagePrice: 276.71,
    highPrice: 1200.0, totalQuantity: 80,
  },
  {
    payItemNumber: "715-05691", description: "PIPE EXTENSION, CIRCULAR, DIAMETER",
    unit: "LFT", lowPrice: 122.3, averagePrice: 122.3,
    highPrice: 122.3, totalQuantity: 25,
  },
  {
    payItemNumber: "715-05711", description: "PIPE, SANITARY SEWER, DIAMETER 6 IN.",
    unit: "LFT", lowPrice: 84.0, averagePrice: 84.0,
    highPrice: 84.0, totalQuantity: 270,
  },
  {
    payItemNumber: "715-05757", description: "PIPE EXTENSION, CIRCULAR, DIAMETER 36 IN.",
    unit: "LFT", lowPrice: 195.0, averagePrice: 195.0,
    highPrice: 195.0, totalQuantity: 26,
  },
  {
    payItemNumber: "715-05841", description: "CONCRETE ANCHOR, DIAMETER 60 IN.",
    unit: "EACH", lowPrice: 2606.0, averagePrice: 7356.44,
    highPrice: 12500.0, totalQuantity: 13,
  },
  {
    payItemNumber: "715-05842", description: "CONCRETE ANCHOR, DIAMETER 42 IN.",
    unit: "EACH", lowPrice: 5530.0, averagePrice: 7955.0,
    highPrice: 10000.0, totalQuantity: 12,
  },
  {
    payItemNumber: "715-05889", description: "PIPE EXTENSION, CIRCULAR, DIAMETER 30 IN.",
    unit: "LFT", lowPrice: 385.0, averagePrice: 385.0,
    highPrice: 385.0, totalQuantity: 15,
  },
  {
    payItemNumber: "715-06004", description: "CONCRETE ANCHOR, DIAMETER 48 IN.",
    unit: "EACH", lowPrice: 3295.0, averagePrice: 7320.1,
    highPrice: 12000.0, totalQuantity: 12,
  },
  {
    payItemNumber: "715-06039", description: "INSERTION VALVE, 6 IN.",
    unit: "EACH", lowPrice: 12900.0, averagePrice: 12900.0,
    highPrice: 12900.0, totalQuantity: 5,
  },
  {
    payItemNumber: "715-06050", description: "CAP",
    unit: "EACH", lowPrice: 400.0, averagePrice: 1731.45,
    highPrice: 3159.54, totalQuantity: 43,
  },
  {
    payItemNumber: "715-06051", description: "PIPE EXTENSION, CIRCULAR, DIAMETER 8 IN.",
    unit: "LFT", lowPrice: 50.0, averagePrice: 66.0,
    highPrice: 70.0, totalQuantity: 25,
  },
  {
    payItemNumber: "715-06077", description: "SAFETY METAL END SECTION, 6:1, DIAMETER 42 IN.",
    unit: "EACH", lowPrice: 12961.0, averagePrice: 12961.0,
    highPrice: 12961.0, totalQuantity: 1,
  },
  {
    payItemNumber: "715-06337", description: "PIPE EXTENSION, CIRCULAR, DIAMETER 48 IN.",
    unit: "LFT", lowPrice: 206.0, averagePrice: 296.46,
    highPrice: 500.0, totalQuantity: 39,
  },
  {
    payItemNumber: "715-06338", description: "PIPE EXTENSION, CIRCULAR, DIAMETER 66 IN.",
    unit: "LFT", lowPrice: 2550.0, averagePrice: 2550.0,
    highPrice: 2550.0, totalQuantity: 10,
  },
  {
    payItemNumber: "715-06357", description: "CONCRETE ANCHOR, DIAMETER 72 IN.",
    unit: "EACH", lowPrice: 8000.0, averagePrice: 9715.97,
    highPrice: 12700.0, totalQuantity: 7,
  },
  {
    payItemNumber: "715-06471", description: "PIPE END SECTION, MIN. AREA 3.3 SFT",
    unit: "EACH", lowPrice: 2469.62, averagePrice: 2692.95,
    highPrice: 3000.0, totalQuantity: 6,
  },
  {
    payItemNumber: "715-06492", description: "CONCRETE ANCHOR, DIAMETER 54 IN.",
    unit: "EACH", lowPrice: 4500.0, averagePrice: 7500.0,
    highPrice: 14000.0, totalQuantity: 4,
  },
  {
    payItemNumber: "715-06501", description: "CONCRETE ANCHOR, MIN. AREA 8.9 SFT",
    unit: "EACH", lowPrice: 8000.0, averagePrice: 8000.0,
    highPrice: 8000.0, totalQuantity: 2,
  },
  {
    payItemNumber: "715-06561", description: "PIPE EXTENSION, CIRCULAR, DIAMETER 4 IN.",
    unit: "LFT", lowPrice: 50.0, averagePrice: 93.08,
    highPrice: 120.0, totalQuantity: 13,
  },
  {
    payItemNumber: "715-06566", description: "PIPE EXTENSION, CIRCULAR, DIAMETER 6 IN.",
    unit: "LFT", lowPrice: 20.0, averagePrice: 71.13,
    highPrice: 435.0, totalQuantity: 174,
  },
  {
    payItemNumber: "715-06568", description: "PIPE EXTENSION, CIRCULAR, DIAMETER 10 IN.",
    unit: "LFT", lowPrice: 70.0, averagePrice: 70.0,
    highPrice: 70.0, totalQuantity: 18,
  },
  {
    payItemNumber: "715-06629", description: "PIPE END SECTION, MIN. AREA 10.2 SFT",
    unit: "EACH", lowPrice: 3498.11, averagePrice: 3498.11,
    highPrice: 3498.11, totalQuantity: 4,
  },
  {
    payItemNumber: "715-06691", description: "CONCRETE ANCHOR, DIAMETER 96 IN.",
    unit: "EACH", lowPrice: 6000.0, averagePrice: 9956.67,
    highPrice: 14970.0, totalQuantity: 6,
  },
  {
    payItemNumber: "715-06923", description: "PIPE, TYPE 2, CIRCULAR, DIAMETER 84 IN.",
    unit: "LFT", lowPrice: 923.86, averagePrice: 923.86,
    highPrice: 923.86, totalQuantity: 588,
  },
  {
    payItemNumber: "715-06939", description: "CONCRETE ANCHOR, MIN. AREA 29.5 SFT",
    unit: "EACH", lowPrice: 18534.94, averagePrice: 18534.94,
    highPrice: 18534.94, totalQuantity: 2,
  },
  {
    payItemNumber: "715-07029", description: "SAFETY METAL END SECTION, 4:1, MIN. AREA 3.3 SFT MIN AREA 3.3 SFT",
    unit: "EACH", lowPrice: 4489.15, averagePrice: 4489.15,
    highPrice: 4489.15, totalQuantity: 2,
  },
  {
    payItemNumber: "715-07150", description: "CONCRETE ANCHOR, DIAMETER 84 IN.",
    unit: "EACH", lowPrice: 6700.0, averagePrice: 7233.33,
    highPrice: 7500.0, totalQuantity: 3,
  },
  {
    payItemNumber: "715-07303", description: "CONCRETE ANCHOR, MIN. AREA 16.7 SFT",
    unit: "EACH", lowPrice: 3414.06, averagePrice: 3414.06,
    highPrice: 3414.06, totalQuantity: 2,
  },
  {
    payItemNumber: "715-07317", description: "CHECK VALVE",
    unit: "EACH", lowPrice: 8500.0, averagePrice: 8500.0,
    highPrice: 8500.0, totalQuantity: 1,
  },
  {
    payItemNumber: "715-07536", description: "CONCRETE ANCHOR, MIN. AREA 12.9 SFT",
    unit: "EACH", lowPrice: 2410.0, averagePrice: 2410.0,
    highPrice: 2410.0, totalQuantity: 2,
  },
  {
    payItemNumber: "715-07625", description: "PIPE, TYPE 1, CIRCULAR, DIAMETER 66 IN.",
    unit: "LFT", lowPrice: 513.0, averagePrice: 543.42,
    highPrice: 569.0, totalQuantity: 208,
  },
  {
    payItemNumber: "715-07626", description: "CONCRETE ANCHOR, DIAMETER 66 IN.",
    unit: "EACH", lowPrice: 5490.0, averagePrice: 9234.87,
    highPrice: 12690.0, totalQuantity: 6,
  },
  {
    payItemNumber: "715-07668", description: "SAFETY METAL END SECTION, 4:1, MIN. AREA 2.0 SFT MIN AREA 2.0 SFT",
    unit: "EACH", lowPrice: 2215.0, averagePrice: 2215.0,
    highPrice: 2215.0, totalQuantity: 2,
  },
  {
    payItemNumber: "715-07673", description: "CONCRETE ANCHOR, DIAMETER 90 IN.",
    unit: "EACH", lowPrice: 8250.0, averagePrice: 8250.0,
    highPrice: 8250.0, totalQuantity: 2,
  },
  {
    payItemNumber: "715-07674", description: "CONCRETE ANCHOR, DIAMETER 114 IN.",
    unit: "EACH", lowPrice: 16004.51, averagePrice: 16004.51,
    highPrice: 16004.51, totalQuantity: 1,
  },
  {
    payItemNumber: "715-07794", description: "WATER MAIN CONNECTIONS",
    unit: "EACH", lowPrice: 3250.0, averagePrice: 5427.4,
    highPrice: 8480.0, totalQuantity: 44,
  },
  {
    payItemNumber: "715-07806", description: "PIPE, STEEL CASING",
    unit: "LFT", lowPrice: 300.0, averagePrice: 623.22,
    highPrice: 1400.0, totalQuantity: 315,
  },
  {
    payItemNumber: "715-08048", description: "STORMWATER TREATMENT SYSTEM",
    unit: "EACH", lowPrice: 67000.0, averagePrice: 75666.67,
    highPrice: 80000.0, totalQuantity: 3,
  },
  {
    payItemNumber: "715-08162", description: "PIPE, TYPE 1, DEFORMED, MIN. AREA 8.8 SFT",
    unit: "LFT", lowPrice: 103.22, averagePrice: 103.22,
    highPrice: 103.22, totalQuantity: 29,
  },
  {
    payItemNumber: "715-08171", description: "PIPE, TYPE 1, DEFORMED, MIN. AREA 12.9 SFT",
    unit: "LFT", lowPrice: 450.0, averagePrice: 450.0,
    highPrice: 450.0, totalQuantity: 122,
  },
  {
    payItemNumber: "715-08177", description: "PIPE, TYPE 1, DEFORMED, MIN. AREA 10.2 SFT",
    unit: "LFT", lowPrice: 348.0, averagePrice: 411.75,
    highPrice: 459.19, totalQuantity: 225,
  },
  {
    payItemNumber: "715-08179", description: "CONCRETE ANCHOR, MIN. AREA 10.2 SFT",
    unit: "EACH", lowPrice: 3850.0, averagePrice: 6879.62,
    highPrice: 9909.25, totalQuantity: 4,
  },
  {
    payItemNumber: "715-08243", description: "PIPE, TYPE 3, DEFORMED, MIN. AREA 3.3 SFT",
    unit: "LFT", lowPrice: 147.0, averagePrice: 147.0,
    highPrice: 147.0, totalQuantity: 95,
  },
  {
    payItemNumber: "715-08250", description: "PIPE, DUCTILE IRON, 12 IN.",
    unit: "LFT", lowPrice: 90.0, averagePrice: 90.0,
    highPrice: 90.0, totalQuantity: 62,
  },
  {
    payItemNumber: "715-08255", description: "PIPE, TYPE 1, CIRCULAR, DIAMETER 78 IN.",
    unit: "LFT", lowPrice: 2430.0, averagePrice: 2430.0,
    highPrice: 2430.0, totalQuantity: 78,
  },
  {
    payItemNumber: "715-08283", description: "PCCP FOR STRUCTURE INSTALLATION",
    unit: "SYS", lowPrice: 135.02, averagePrice: 138.38,
    highPrice: 203.41, totalQuantity: 1627,
  },
  {
    payItemNumber: "715-08305", description: "HMA FOR STRUCTURE INSTALLATION, TYPE B",
    unit: "TON", lowPrice: 115.0, averagePrice: 149.33,
    highPrice: 533.86, totalQuantity: 2035,
  },
  {
    payItemNumber: "715-08306", description: "HMA FOR STRUCTURE INSTALLATION, TYPE C",
    unit: "TON", lowPrice: 50.0, averagePrice: 151.79,
    highPrice: 1725.0, totalQuantity: 4520,
  },
  {
    payItemNumber: "715-08307", description: "HMA FOR STRUCTURE INSTALLATION, TYPE D",
    unit: "TON", lowPrice: 106.41, averagePrice: 140.97,
    highPrice: 755.0, totalQuantity: 8957,
  },
  {
    payItemNumber: "715-08448", description: "PIPE, TYPE 2, DEFORMED, MIN. AREA 10.2 SFT",
    unit: "LFT", lowPrice: 260.03, averagePrice: 260.03,
    highPrice: 260.03, totalQuantity: 87,
  },
  {
    payItemNumber: "715-08627", description: "PIPE, TYPE 2, CIRCULAR, DIAMETER 4 IN.",
    unit: "LFT", lowPrice: 60.0, averagePrice: 82.33,
    highPrice: 279.04, totalQuantity: 99,
  },
  {
    payItemNumber: "715-09064", description: "VIDEO INSPECTION FOR PIPE",
    unit: "LFT", lowPrice: 1.0, averagePrice: 2.35,
    highPrice: 110.0, totalQuantity: 145411,
  },
  {
    payItemNumber: "715-09370", description: "PIPE EXTENSION, CIRCULAR, DIAMETER 72 IN.",
    unit: "LFT", lowPrice: 2607.0, averagePrice: 2607.0,
    highPrice: 2607.0, totalQuantity: 10,
  },
  {
    payItemNumber: "715-09475", description: "STORMWATER QUALITY STRUCTURE",
    unit: "EACH", lowPrice: 18119.21, averagePrice: 31023.84,
    highPrice: 35000.0, totalQuantity: 5,
  },
  {
    payItemNumber: "715-09762", description: "GRATED BOX END SECTION, I, 4:1, MIN. AREA 14.14 SFT",
    unit: "EACH", lowPrice: 24869.91, averagePrice: 24869.91,
    highPrice: 24869.91, totalQuantity: 2,
  },
  {
    payItemNumber: "715-09769", description: "PIPE, TYPE 3, DEFORMED, MIN. AREA 5.1 SFT",
    unit: "LFT", lowPrice: 199.69, averagePrice: 242.17,
    highPrice: 275.0, totalQuantity: 78,
  },
  {
    payItemNumber: "715-09843", description: "BYPASS PUMPING",
    unit: "LS", lowPrice: 19000.0, averagePrice: 22000.0,
    highPrice: 27000.0, totalQuantity: 3,
  },
  {
    payItemNumber: "715-09938", description: "PIPE, BRIDGE DECK DRAIN SYSTEM",
    unit: "LS", lowPrice: 15000.0, averagePrice: 24060.0,
    highPrice: 40000.0, totalQuantity: 4,
  },
  {
    payItemNumber: "715-09951", description: "PIPE, TYPE 1, DEFORMED, MIN. AREA 42.4 SFT",
    unit: "LFT", lowPrice: 1200.0, averagePrice: 1200.0,
    highPrice: 1200.0, totalQuantity: 57,
  },
  {
    payItemNumber: "715-09977", description: "PUMP",
    unit: "EACH", lowPrice: 1.0, averagePrice: 1.0,
    highPrice: 1.0, totalQuantity: 1,
  },
  {
    payItemNumber: "715-09987", description: "PIPE, TYPE 1, CIRCULAR, DIAMETER 9 IN.",
    unit: "LFT", lowPrice: 250.0, averagePrice: 250.0,
    highPrice: 250.0, totalQuantity: 6,
  },
  {
    payItemNumber: "715-10116", description: "PIPE, DRAINAGE THROUGH CONCRETE MASONRY",
    unit: "LS", lowPrice: 2500.0, averagePrice: 2500.0,
    highPrice: 2500.0, totalQuantity: 1,
  },
  {
    payItemNumber: "715-10126", description: "PIPE EXTENSION, DEFORMED, MIN. AREA 26.0 SFT",
    unit: "LFT", lowPrice: 552.5, averagePrice: 552.5,
    highPrice: 552.5, totalQuantity: 51,
  },
  {
    payItemNumber: "715-10136", description: "PIPE, TYPE 3, DEFORMED, MIN. AREA 10.2 SFT",
    unit: "LFT", lowPrice: 255.59, averagePrice: 255.59,
    highPrice: 255.59, totalQuantity: 71,
  },
  {
    payItemNumber: "715-10238", description: "PIPE, ROADWAY DRAIN CASTING EXTENSION",
    unit: "EACH", lowPrice: 123.74, averagePrice: 802.44,
    highPrice: 2000.0, totalQuantity: 152,
  },
  {
    payItemNumber: "715-11360", description: "INSERTION VALVE 12 IN.",
    unit: "EACH", lowPrice: 12000.0, averagePrice: 19150.0,
    highPrice: 21100.0, totalQuantity: 14,
  },
  {
    payItemNumber: "715-11529", description: "PIPE END SECTION, MIN. AREA 6.3 SFT",
    unit: "EACH", lowPrice: 3500.0, averagePrice: 3539.76,
    highPrice: 3698.81, totalQuantity: 5,
  },
  {
    payItemNumber: "715-11571", description: "WATER MAIN, DUCTILE IRON, 8 IN.",
    unit: "LFT", lowPrice: 212.0, averagePrice: 227.07,
    highPrice: 246.0, totalQuantity: 361,
  },
  {
    payItemNumber: "715-11668", description: "CONCRETE ANCHOR, MIN. AREA 7.4 SFT",
    unit: "EACH", lowPrice: 2310.0, averagePrice: 4678.62,
    highPrice: 9415.86, totalQuantity: 6,
  },
  {
    payItemNumber: "715-11719", description: "METAL FABRICATED DOWNSPOUT BOOT",
    unit: "EACH", lowPrice: 4500.0, averagePrice: 4500.0,
    highPrice: 4500.0, totalQuantity: 1,
  },
  {
    payItemNumber: "715-11774", description: "PIPE, TYPE 1, DEFORMED, MIN. AREA 6.3 SFT",
    unit: "LFT", lowPrice: 325.0, averagePrice: 325.0,
    highPrice: 325.0, totalQuantity: 120,
  },
  {
    payItemNumber: "715-11853", description: "PIPE, TYPE 2, DEFORMED, MIN. AREA 6.3 SFT",
    unit: "LFT", lowPrice: 335.77, averagePrice: 335.77,
    highPrice: 335.77, totalQuantity: 296,
  },
  {
    payItemNumber: "715-11879", description: "SEWER, SANITARY LATERAL, CONNECTIONS",
    unit: "LFT", lowPrice: 62.0, averagePrice: 132.79,
    highPrice: 511.56, totalQuantity: 957,
  },
  {
    payItemNumber: "715-11896", description: "WATER SERVICE CONNECTION",
    unit: "EACH", lowPrice: 1465.0, averagePrice: 2812.55,
    highPrice: 6875.0, totalQuantity: 61,
  },
  {
    payItemNumber: "715-12322", description: "CONCRETE ANCHOR, MIN. AREA 42.4 SFT",
    unit: "EACH", lowPrice: 10000.0, averagePrice: 10000.0,
    highPrice: 10000.0, totalQuantity: 2,
  },
  {
    payItemNumber: "715-12405", description: "PIPE, TYPE 3, CIRCULAR, DIAMETER 6 IN.",
    unit: "LFT", lowPrice: 30.0, averagePrice: 30.0,
    highPrice: 30.0, totalQuantity: 101,
  },
  {
    payItemNumber: "715-12406", description: "VALVE WITH BOX, TAPPING SLEEVE",
    unit: "EACH", lowPrice: 15657.75, averagePrice: 15657.75,
    highPrice: 15657.75, totalQuantity: 3,
  },
  {
    payItemNumber: "715-12492", description: "PIPE END SECTION, DIAMETER 66 IN.",
    unit: "EACH", lowPrice: 7500.0, averagePrice: 7500.0,
    highPrice: 7500.0, totalQuantity: 2,
  },
  {
    payItemNumber: "715-12674", description: "GATE VALVE AND VALVE BOX, 12 IN.",
    unit: "EACH", lowPrice: 6111.77, averagePrice: 6752.73,
    highPrice: 7615.69, totalQuantity: 18,
  },
  {
    payItemNumber: "715-12871", description: "GEOTEXTILE FOR PIPE, TYPE 2A",
    unit: "SYS", lowPrice: 5.4, averagePrice: 5.4,
    highPrice: 5.4, totalQuantity: 1347,
  },
  {
    payItemNumber: "715-12872", description: "GEOTEXTILE FOR PIPE, TYPE 2B",
    unit: "SYS", lowPrice: 3.5, averagePrice: 8.35,
    highPrice: 75.0, totalQuantity: 837,
  },
  {
    payItemNumber: "715-12906", description: "SAFETY METAL END SECTION, 3:1, DIAMETER 36 IN.",
    unit: "EACH", lowPrice: 6905.0, averagePrice: 6905.0,
    highPrice: 6905.0, totalQuantity: 6,
  },
  {
    payItemNumber: "715-12909", description: "WATER SUPPLY, TEMPORARY",
    unit: "LS", lowPrice: 25000.0, averagePrice: 25000.0,
    highPrice: 25000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "715-26776", description: "GRATED BOX END SECTION, TYPE I, 2:1, DIAMETER 36 IN.",
    unit: "EACH", lowPrice: 18712.43, averagePrice: 18712.43,
    highPrice: 18712.43, totalQuantity: 1,
  },
  {
    payItemNumber: "715-26779", description: "GRATED BOX END SECTION, TYPE I, 2:1, DIAMETER 48 IN.",
    unit: "EACH", lowPrice: 26000.0, averagePrice: 26000.0,
    highPrice: 26000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "715-26785", description: "GRATED BOX END SECTION, TYPE I, 4:1, DIAMETER 54 IN.",
    unit: "EACH", lowPrice: 28634.43, averagePrice: 28634.43,
    highPrice: 28634.43, totalQuantity: 1,
  },
  {
    payItemNumber: "715-46000", description: "PIPE END SECTION, DIAMETER 12 IN.",
    unit: "EACH", lowPrice: 245.0, averagePrice: 1092.2,
    highPrice: 3500.0, totalQuantity: 372,
  },
  {
    payItemNumber: "715-46005", description: "PIPE END SECTION, DIAMETER 15 IN.",
    unit: "EACH", lowPrice: 375.0, averagePrice: 1235.26,
    highPrice: 4000.0, totalQuantity: 385,
  },
  {
    payItemNumber: "715-46010", description: "PIPE END SECTION, DIAMETER 18 IN.",
    unit: "EACH", lowPrice: 483.04, averagePrice: 1317.46,
    highPrice: 4500.0, totalQuantity: 142,
  },
  {
    payItemNumber: "715-46015", description: "PIPE END SECTION, DIAMETER 21 IN.",
    unit: "EACH", lowPrice: 900.0, averagePrice: 1479.03,
    highPrice: 2011.55, totalQuantity: 25,
  },
  {
    payItemNumber: "715-46020", description: "PIPE END SECTION, DIAMETER 24 IN.",
    unit: "EACH", lowPrice: 200.0, averagePrice: 1786.14,
    highPrice: 6000.0, totalQuantity: 118,
  },
  {
    payItemNumber: "715-46030", description: "PIPE END SECTION, DIAMETER 30 IN.",
    unit: "EACH", lowPrice: 1040.84, averagePrice: 2104.99,
    highPrice: 3800.0, totalQuantity: 41,
  },
  {
    payItemNumber: "715-46035", description: "PIPE END SECTION, DIAMETER 33 IN.",
    unit: "EACH", lowPrice: 2700.0, averagePrice: 2700.0,
    highPrice: 2700.0, totalQuantity: 1,
  },
  {
    payItemNumber: "715-46040", description: "PIPE END SECTION, DIAMETER 36 IN.",
    unit: "EACH", lowPrice: 1664.0, averagePrice: 2678.14,
    highPrice: 3900.0, totalQuantity: 80,
  },
  {
    payItemNumber: "715-46055", description: "PIPE END SECTION, MIN. AREA 1.8 SFT",
    unit: "EACH", lowPrice: 1280.0, averagePrice: 1280.0,
    highPrice: 1280.0, totalQuantity: 2,
  },
  {
    payItemNumber: "715-90325", description: "PIPE END SECTION, DIAMETER 10 IN.",
    unit: "EACH", lowPrice: 2858.93, averagePrice: 2858.93,
    highPrice: 2858.93, totalQuantity: 1,
  },
  {
    payItemNumber: "715-90573", description: "VALVE, WITH BOX, RESTRAINED GATE, DUCTILE IRON, 4 IN. IRON, 4 IN",
    unit: "EACH", lowPrice: 1900.0, averagePrice: 1900.0,
    highPrice: 1900.0, totalQuantity: 1,
  },
  {
    payItemNumber: "715-90853", description: "TAPPING SLEEVE WITH VALVE",
    unit: "EACH", lowPrice: 7000.0, averagePrice: 10583.75,
    highPrice: 13500.0, totalQuantity: 20,
  },
  {
    payItemNumber: "715-92037", description: "PIPE PVC, 4 IN.",
    unit: "LFT", lowPrice: 95.0, averagePrice: 95.0,
    highPrice: 95.0, totalQuantity: 106,
  },
  {
    payItemNumber: "715-92253", description: "SEWER SANITARY LATERAL RECONNECT",
    unit: "EACH", lowPrice: 1040.0, averagePrice: 1040.0,
    highPrice: 1040.0, totalQuantity: 8,
  },
  {
    payItemNumber: "715-92544", description: "WATER MAIN, DUCTILE IRON, 12 IN.",
    unit: "LFT", lowPrice: 229.0, averagePrice: 229.92,
    highPrice: 235.0, totalQuantity: 921,
  },
  {
    payItemNumber: "715-92874", description: "PIPE ENCASEMENT",
    unit: "LFT", lowPrice: 295.0, averagePrice: 295.0,
    highPrice: 295.0, totalQuantity: 108,
  },
  {
    payItemNumber: "715-93911", description: "WATER MAIN, 4 IN.",
    unit: "LFT", lowPrice: 3983.29, averagePrice: 3983.29,
    highPrice: 3983.29, totalQuantity: 3,
  },
  {
    payItemNumber: "715-93912", description: "WATER MAIN, 6 IN.",
    unit: "LFT", lowPrice: 64.0, averagePrice: 137.58,
    highPrice: 342.1, totalQuantity: 1858,
  },
  {
    payItemNumber: "715-93913", description: "WATER MAIN, 8 IN.",
    unit: "LFT", lowPrice: 175.0, averagePrice: 283.36,
    highPrice: 292.99, totalQuantity: 833,
  },
  {
    payItemNumber: "715-93919", description: "WATER MAIN, 14 IN.",
    unit: "LFT", lowPrice: 145.0, averagePrice: 145.0,
    highPrice: 145.0, totalQuantity: 1232,
  },
  {
    payItemNumber: "715-94530", description: "ADJUST WATER VALVE TO GRADE",
    unit: "EACH", lowPrice: 800.0, averagePrice: 2896.09,
    highPrice: 3195.53, totalQuantity: 8,
  },
  {
    payItemNumber: "715-94780", description: "WATER MAIN, DUCTILE IRON, 6 IN.",
    unit: "LFT", lowPrice: 275.0, averagePrice: 282.45,
    highPrice: 300.0, totalQuantity: 104,
  },
  {
    payItemNumber: "715-95325", description: "INVERT, CONCRETE PAVED",
    unit: "LFT", lowPrice: 200.0, averagePrice: 253.19,
    highPrice: 458.46, totalQuantity: 1798,
  },
  {
    payItemNumber: "715-96629", description: "WATER SERVICE LINE, 1 IN.",
    unit: "LFT", lowPrice: 25.0, averagePrice: 65.19,
    highPrice: 206.0, totalQuantity: 1905,
  },
  {
    payItemNumber: "715-96669", description: "WATER MAIN, DUCTILE IRON, 16 IN.",
    unit: "LFT", lowPrice: 188.0, averagePrice: 188.0,
    highPrice: 188.0, totalQuantity: 2060,
  },
  {
    payItemNumber: "715-96881", description: "PIPE END SECTION, DIAMETER 54 IN.",
    unit: "EACH", lowPrice: 8500.0, averagePrice: 8500.0,
    highPrice: 8500.0, totalQuantity: 1,
  },
  {
    payItemNumber: "715-96948", description: "GATE VALVE, 8 IN.",
    unit: "EACH", lowPrice: 3300.0, averagePrice: 3300.0,
    highPrice: 3300.0, totalQuantity: 1,
  },
  {
    payItemNumber: "715-97404", description: "GRATED BOX END SECTION, TYPE I, 3:1, DIAMETER 15 IN.",
    unit: "EACH", lowPrice: 9650.0, averagePrice: 9650.0,
    highPrice: 9650.0, totalQuantity: 1,
  },
  {
    payItemNumber: "715-97544", description: "PIPE DUCTILE IRON, 8 IN.",
    unit: "LFT", lowPrice: 75.0, averagePrice: 75.0,
    highPrice: 75.0, totalQuantity: 85,
  },
  {
    payItemNumber: "715-97557", description: "GRATED BOX END SECTION, TYPE I, 6:1, DIAMETER 18 IN.",
    unit: "EACH", lowPrice: 7765.45, averagePrice: 7765.45,
    highPrice: 7765.45, totalQuantity: 1,
  },
  {
    payItemNumber: "715-97686", description: "GRATED BOX END SECTION, TYPE II, 10:1, DIAMETER 15 IN.",
    unit: "EACH", lowPrice: 30000.0, averagePrice: 30000.0,
    highPrice: 30000.0, totalQuantity: 2,
  },
  {
    payItemNumber: "715-97691", description: "GRATED BOX END SECTION, TYPE I, 3:1, DIAMETER 36 IN.",
    unit: "EACH", lowPrice: 22039.93, averagePrice: 22039.93,
    highPrice: 22039.93, totalQuantity: 1,
  },
  {
    payItemNumber: "715-97692", description: "GRATED BOX END SECTION, TYPE I, 4:1, DIAMETER 36 IN.",
    unit: "EACH", lowPrice: 28500.0, averagePrice: 28500.0,
    highPrice: 28500.0, totalQuantity: 2,
  },
  {
    payItemNumber: "715-97804", description: "PIPE END SECTION, MIN. AREA 7.4 SFT",
    unit: "EACH", lowPrice: 1000.0, averagePrice: 3159.48,
    highPrice: 4249.47, totalQuantity: 5,
  },
  {
    payItemNumber: "715-98165", description: "WATER MAIN, 12 IN.",
    unit: "LFT", lowPrice: 120.0, averagePrice: 244.11,
    highPrice: 368.38, totalQuantity: 4428,
  },
  {
    payItemNumber: "715-98265", description: "WATER MAIN, DUCTILE IRON, 4 IN.",
    unit: "LFT", lowPrice: 144.0, averagePrice: 230.63,
    highPrice: 380.0, totalQuantity: 79,
  },
  {
    payItemNumber: "715-98961", description: "FORCE MAIN",
    unit: "LFT", lowPrice: 24.0, averagePrice: 223.53,
    highPrice: 471.93, totalQuantity: 4994,
  },
  {
    payItemNumber: "715-99044", description: "GRATED BOX END SECTION, TYPE II, 6:1, DIAMETER 18 IN.",
    unit: "EACH", lowPrice: 8900.0, averagePrice: 8900.0,
    highPrice: 8900.0, totalQuantity: 1,
  },
  {
    payItemNumber: "716-01382", description: "AIR RELEASE VALVE",
    unit: "EACH", lowPrice: 10864.71, averagePrice: 11002.33,
    highPrice: 11036.73, totalQuantity: 5,
  },
  {
    payItemNumber: "716-07630", description: "PIPE INSTALLATION, TRENCHLESS, 12 IN.",
    unit: "LFT", lowPrice: 298.18, averagePrice: 452.97,
    highPrice: 707.0, totalQuantity: 739,
  },
  {
    payItemNumber: "716-07631", description: "PIPE INSTALLATION, TRENCHLESS, 15 IN.",
    unit: "LFT", lowPrice: 320.9, averagePrice: 539.84,
    highPrice: 832.0, totalQuantity: 1627,
  },
  {
    payItemNumber: "716-07632", description: "PIPE INSTALLATION, TRENCHLESS, 18 IN.",
    unit: "LFT", lowPrice: 363.82, averagePrice: 858.34,
    highPrice: 1977.97, totalQuantity: 2330,
  },
  {
    payItemNumber: "716-07633", description: "PIPE INSTALLATION, TRENCHLESS, 24 IN.",
    unit: "LFT", lowPrice: 680.0, averagePrice: 902.47,
    highPrice: 1470.0, totalQuantity: 197,
  },
  {
    payItemNumber: "716-07634", description: "PIPE INSTALLATION, TRENCHLESS, 30 IN.",
    unit: "LFT", lowPrice: 779.68, averagePrice: 1556.56,
    highPrice: 2428.91, totalQuantity: 229,
  },
  {
    payItemNumber: "716-07635", description: "PIPE INSTALLATION, TRENCHLESS, 36 IN.",
    unit: "LFT", lowPrice: 965.0, averagePrice: 1146.77,
    highPrice: 1327.0, totalQuantity: 2409,
  },
  {
    payItemNumber: "716-07636", description: "PIPE INSTALLATION, TRENCHLESS, 42 IN.",
    unit: "LFT", lowPrice: 920.0, averagePrice: 1091.44,
    highPrice: 1300.0, totalQuantity: 1135,
  },
  {
    payItemNumber: "716-07637", description: "PIPE INSTALLATION, TRENCHLESS, 48 IN.",
    unit: "LFT", lowPrice: 1275.0, averagePrice: 1696.11,
    highPrice: 2155.0, totalQuantity: 1430,
  },
  {
    payItemNumber: "716-07726", description: "PIPE INSTALLATION, TRENCHLESS, 54 IN.",
    unit: "LFT", lowPrice: 1492.01, averagePrice: 1818.62,
    highPrice: 1973.0, totalQuantity: 539,
  },
  {
    payItemNumber: "716-07727", description: "PIPE INSTALLATION, TRENCHLESS, 60 IN.",
    unit: "LFT", lowPrice: 2303.0, averagePrice: 2303.0,
    highPrice: 2303.0, totalQuantity: 349,
  },
  {
    payItemNumber: "716-09128", description: "PIPE INSTALLATION, TRENCHLESS, 16 IN.",
    unit: "LFT", lowPrice: 1085.0, averagePrice: 1085.0,
    highPrice: 1085.0, totalQuantity: 305,
  },
  {
    payItemNumber: "716-09129", description: "PIPE INSTALLATION, TRENCHLESS, 8 IN.",
    unit: "LFT", lowPrice: 257.0, averagePrice: 257.0,
    highPrice: 257.0, totalQuantity: 83,
  },
  {
    payItemNumber: "716-09139", description: "PIPE INSTALLATION, TRENCHLESS, 10 IN.",
    unit: "LFT", lowPrice: 265.0, averagePrice: 265.0,
    highPrice: 265.0, totalQuantity: 233,
  },
  {
    payItemNumber: "716-09396", description: "PIPE INSTALLATION, TRENCHLESS, 2 IN.",
    unit: "LFT", lowPrice: 5.0, averagePrice: 26.27,
    highPrice: 62.48, totalQuantity: 1289,
  },
  {
    payItemNumber: "716-09631", description: "PIPE INSTALLATION, TRENCHLESS, 21 IN.",
    unit: "LFT", lowPrice: 1100.0, averagePrice: 1100.0,
    highPrice: 1100.0, totalQuantity: 86,
  },
  {
    payItemNumber: "716-09822", description: "PIPE INSTALLATION, TRENCHLESS, 66 IN.",
    unit: "LFT", lowPrice: 4018.48, averagePrice: 4018.48,
    highPrice: 4018.48, totalQuantity: 105,
  },
  {
    payItemNumber: "716-11630", description: "PIPE INSTALLATION, TRENCHLESS, 14 IN.",
    unit: "LFT", lowPrice: 284.0, averagePrice: 284.0,
    highPrice: 284.0, totalQuantity: 393,
  },
  {
    payItemNumber: "718-04986", description: "CLEANOUT",
    unit: "EACH", lowPrice: 1200.0, averagePrice: 1200.0,
    highPrice: 1200.0, totalQuantity: 4,
  },
  {
    payItemNumber: "718-06526", description: "HMA FOR UNDERDRAINS",
    unit: "TON", lowPrice: 427.0, averagePrice: 427.0,
    highPrice: 427.0, totalQuantity: 30,
  },
  {
    payItemNumber: "718-06528", description: "OUTLET PROTECTOR, TYPE 1",
    unit: "EACH", lowPrice: 500.0, averagePrice: 2237.85,
    highPrice: 3427.61, totalQuantity: 262,
  },
  {
    payItemNumber: "718-06529", description: "OUTLET PROTECTOR, TYPE 2",
    unit: "EACH", lowPrice: 400.0, averagePrice: 982.73,
    highPrice: 4430.0, totalQuantity: 88,
  },
  {
    payItemNumber: "718-06531", description: "OUTLET PROTECTOR, TYPE 3",
    unit: "EACH", lowPrice: 90.0, averagePrice: 1352.65,
    highPrice: 3800.0, totalQuantity: 70,
  },
  {
    payItemNumber: "718-06532", description: "VIDEO INSPECTION FOR UNDERDRAIN",
    unit: "LFT", lowPrice: 1.0, averagePrice: 1.22,
    highPrice: 5.0, totalQuantity: 106799,
  },
  {
    payItemNumber: "718-08308", description: "UNDERDRAIN, PATCHING",
    unit: "LFT", lowPrice: 6.0, averagePrice: 55.32,
    highPrice: 83.0, totalQuantity: 5648,
  },
  {
    payItemNumber: "718-09979", description: "UNDERDRAIN OUTLET CLEANING",
    unit: "EACH", lowPrice: 1500.0, averagePrice: 1500.0,
    highPrice: 1500.0, totalQuantity: 8,
  },
  {
    payItemNumber: "718-12305", description: "GEOTEXTILE FOR UNDERDRAINS, TYPE 1A",
    unit: "SYS", lowPrice: 0.5, averagePrice: 2.76,
    highPrice: 12.91, totalQuantity: 110487,
  },
  {
    payItemNumber: "718-12306", description: "GEOTEXTILE FOR UNDERDRAINS, TYPE 1B",
    unit: "SYS", lowPrice: 3.0, averagePrice: 3.92,
    highPrice: 16.96, totalQuantity: 30502,
  },
  {
    payItemNumber: "718-12307", description: "GEOTEXTILE FOR UNDERDRAINS, TYPE 2A",
    unit: "SYS", lowPrice: 1.0, averagePrice: 4.32,
    highPrice: 21.0, totalQuantity: 21307,
  },
  {
    payItemNumber: "718-12308", description: "GEOTEXTILE FOR UNDERDRAINS, TYPE 2B",
    unit: "SYS", lowPrice: 3.0, averagePrice: 4.75,
    highPrice: 25.0, totalQuantity: 51388,
  },
  {
    payItemNumber: "718-12309", description: "GEOTEXTILE FOR UNDERDRAINS, TYPE 3",
    unit: "SYS", lowPrice: 0.01, averagePrice: 0.64,
    highPrice: 9.0, totalQuantity: 3109,
  },
  {
    payItemNumber: "718-52610", description: "AGGREGATE FOR UNDERDRAINS",
    unit: "CYS", lowPrice: 50.0, averagePrice: 72.65,
    highPrice: 365.0, totalQuantity: 22114,
  },
  {
    payItemNumber: "719-05438", description: "PIPE, DRAIN TILE TERMINAL SECTION, DIAMETER 4 IN.",
    unit: "LFT", lowPrice: 25.0, averagePrice: 25.0,
    highPrice: 25.0, totalQuantity: 15,
  },
  {
    payItemNumber: "719-05439", description: "PIPE, DRAIN TILE TERMINAL SECTION, DIAMETER 6 IN.",
    unit: "LFT", lowPrice: 15.85, averagePrice: 16.17,
    highPrice: 80.0, totalQuantity: 3025,
  },
  {
    payItemNumber: "719-05443", description: "PIPE, DRAIN TILE TERMINAL SECTION, DIAMETER 12 IN.",
    unit: "LFT", lowPrice: 80.0, averagePrice: 80.0,
    highPrice: 80.0, totalQuantity: 30,
  },
  {
    payItemNumber: "719-09447", description: "PIPE, DRAIN TILE TERMINAL SECTION, DIAMETER 24 IN.",
    unit: "LFT", lowPrice: 90.0, averagePrice: 90.0,
    highPrice: 90.0, totalQuantity: 10,
  },
  {
    payItemNumber: "719-09505", description: "TILE INTERCEPT TRENCH EXCAVATION AND LOCATION",
    unit: "LFT", lowPrice: 1.08, averagePrice: 1.08,
    highPrice: 1.08, totalQuantity: 3010,
  },
  {
    payItemNumber: "720-000104", description: "INLET, TYPE P12, MODIFIED",
    unit: "EACH", lowPrice: 5335.0, averagePrice: 6820.0,
    highPrice: 8800.0, totalQuantity: 7,
  },
  {
    payItemNumber: "720-01092", description: "MANHOLE, TYPE J15, MODIFIED",
    unit: "EACH", lowPrice: 7000.0, averagePrice: 7941.16,
    highPrice: 11000.0, totalQuantity: 33,
  },
  {
    payItemNumber: "720-01888", description: "ADJUST MONITORING WELL TO GRADE",
    unit: "EACH", lowPrice: 700.0, averagePrice: 1366.67,
    highPrice: 2700.0, totalQuantity: 6,
  },
  {
    payItemNumber: "720-01894", description: "CASTING, FURNISH AND ADJUST TO GRADE",
    unit: "EACH", lowPrice: 1050.0, averagePrice: 1199.47,
    highPrice: 2000.0, totalQuantity: 10,
  },
  {
    payItemNumber: "720-02367", description: "MANHOLE, TYPE J10",
    unit: "EACH", lowPrice: 4465.0, averagePrice: 4465.0,
    highPrice: 4465.0, totalQuantity: 2,
  },
  {
    payItemNumber: "720-02442", description: "PIPE, PLUG EXISTING",
    unit: "EACH", lowPrice: 350.0, averagePrice: 1778.06,
    highPrice: 2500.93, totalQuantity: 157,
  },
  {
    payItemNumber: "720-03194", description: "MANHOLE",
    unit: "EACH", lowPrice: 2800.0, averagePrice: 7712.5,
    highPrice: 9700.0, totalQuantity: 32,
  },
  {
    payItemNumber: "720-03757", description: "MANHOLE, TYPE C15",
    unit: "EACH", lowPrice: 4800.0, averagePrice: 4842.77,
    highPrice: 5114.33, totalQuantity: 16,
  },
  {
    payItemNumber: "720-04666", description: "CATCH BASIN, TYPE",
    unit: "EACH", lowPrice: 2000.0, averagePrice: 2000.0,
    highPrice: 2000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "720-04721", description: "MANHOLE, TYPE K",
    unit: "EACH", lowPrice: 40000.0, averagePrice: 40000.0,
    highPrice: 40000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "720-07300", description: "INLET, TYPE H, WITH SLOTTED DRAIN",
    unit: "EACH", lowPrice: 17698.51, averagePrice: 17698.51,
    highPrice: 17698.51, totalQuantity: 12,
  },
  {
    payItemNumber: "720-07302", description: "INLET, TYPE HA, WITH SLOTTED DRAIN",
    unit: "EACH", lowPrice: 11178.08, averagePrice: 11178.08,
    highPrice: 11178.08, totalQuantity: 58,
  },
  {
    payItemNumber: "720-07309", description: "TRENCH DRAIN",
    unit: "LFT", lowPrice: 337.44, averagePrice: 554.15,
    highPrice: 2211.64, totalQuantity: 605,
  },
  {
    payItemNumber: "720-08239", description: "MANHOLE, TYPE J7, MODIFIED",
    unit: "EACH", lowPrice: 3300.0, averagePrice: 6740.0,
    highPrice: 10000.0, totalQuantity: 5,
  },
  {
    payItemNumber: "720-08241", description: "MANHOLE, TYPE K15, MODIFIED",
    unit: "EACH", lowPrice: 6400.0, averagePrice: 7037.47,
    highPrice: 14000.0, totalQuantity: 14,
  },
  {
    payItemNumber: "720-08658", description: "MANHOLE, TYPE J5",
    unit: "EACH", lowPrice: 11419.29, averagePrice: 11419.29,
    highPrice: 11419.29, totalQuantity: 4,
  },
  {
    payItemNumber: "720-08659", description: "MANHOLE, TYPE C5",
    unit: "EACH", lowPrice: 5900.0, averagePrice: 6960.82,
    highPrice: 7226.02, totalQuantity: 10,
  },
  {
    payItemNumber: "720-08660", description: "MANHOLE, TYPE J5, MODIFIED",
    unit: "EACH", lowPrice: 5173.84, averagePrice: 5760.84,
    highPrice: 7000.0, totalQuantity: 11,
  },
  {
    payItemNumber: "720-08661", description: "MANHOLE, TYPE K5, MODIFIED",
    unit: "EACH", lowPrice: 6810.25, averagePrice: 6810.25,
    highPrice: 6810.25, totalQuantity: 3,
  },
  {
    payItemNumber: "720-09079", description: "INLET, TYPE HA5, MODIFIED",
    unit: "EACH", lowPrice: 3600.0, averagePrice: 8774.93,
    highPrice: 13477.14, totalQuantity: 50,
  },
  {
    payItemNumber: "720-10138", description: "MANHOLE, TYPE L7",
    unit: "EACH", lowPrice: 18000.0, averagePrice: 18000.0,
    highPrice: 18000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "720-12659", description: "MANHOLE, TYPE G2, MODIFIED",
    unit: "EACH", lowPrice: 72340.0, averagePrice: 72340.0,
    highPrice: 72340.0, totalQuantity: 1,
  },
  {
    payItemNumber: "720-12796", description: "CASTING, CATCH BASIN, ADJUST TO GRADE",
    unit: "EACH", lowPrice: 454.0, averagePrice: 718.23,
    highPrice: 916.23, totalQuantity: 21,
  },
  {
    payItemNumber: "720-12797", description: "CASTING, INLET, ADJUST TO GRADE",
    unit: "EACH", lowPrice: 50.0, averagePrice: 684.71,
    highPrice: 3185.0, totalQuantity: 607,
  },
  {
    payItemNumber: "720-12798", description: "CASTING, MANHOLE, ADJUST TO GRADE",
    unit: "EACH", lowPrice: 50.0, averagePrice: 881.07,
    highPrice: 3000.0, totalQuantity: 531,
  },
  {
    payItemNumber: "720-12811", description: "MANHOLE, TYPE K7",
    unit: "EACH", lowPrice: 10000.0, averagePrice: 10000.0,
    highPrice: 10000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "720-44015", description: "CASTING, TYPE 2, FURNISH AND ADJUST TO GRADE",
    unit: "EACH", lowPrice: 1129.74, averagePrice: 1846.78,
    highPrice: 2771.63, totalQuantity: 15,
  },
  {
    payItemNumber: "720-44025", description: "CASTING, TYPE 4, FURNISH AND ADJUST TO GRADE",
    unit: "EACH", lowPrice: 550.0, averagePrice: 1607.73,
    highPrice: 3200.0, totalQuantity: 11,
  },
  {
    payItemNumber: "720-44030", description: "CASTING, TYPE 5, FURNISH AND ADJUST TO GRADE",
    unit: "EACH", lowPrice: 2000.0, averagePrice: 2000.0,
    highPrice: 2000.0, totalQuantity: 4,
  },
  {
    payItemNumber: "720-44040", description: "CASTING, TYPE 7, FURNISH AND ADJUST TO GRADE",
    unit: "EACH", lowPrice: 589.69, averagePrice: 1763.23,
    highPrice: 3200.0, totalQuantity: 3,
  },
  {
    payItemNumber: "720-44045", description: "CASTING, TYPE 8, FURNISH AND ADJUST TO GRADE",
    unit: "EACH", lowPrice: 1200.0, averagePrice: 2243.61,
    highPrice: 3200.0, totalQuantity: 24,
  },
  {
    payItemNumber: "720-44055", description: "CASTING, TYPE 10, FURNISH AND ADJUST TO GRADE",
    unit: "EACH", lowPrice: 1150.0, averagePrice: 1981.22,
    highPrice: 2100.0, totalQuantity: 84,
  },
  {
    payItemNumber: "720-44080", description: "CASTING, TYPE 15, FURNISH AND ADJUST TO GRADE",
    unit: "EACH", lowPrice: 1370.0, averagePrice: 2296.25,
    highPrice: 3250.0, totalQuantity: 8,
  },
  {
    payItemNumber: "720-44296", description: "INLET, CAP",
    unit: "EACH", lowPrice: 500.0, averagePrice: 1392.2,
    highPrice: 3000.0, totalQuantity: 20,
  },
  {
    payItemNumber: "720-45005", description: "INLET, TYPE A2",
    unit: "EACH", lowPrice: 3259.3, averagePrice: 3707.42,
    highPrice: 5000.0, totalQuantity: 13,
  },
  {
    payItemNumber: "720-45010", description: "INLET, TYPE A3",
    unit: "EACH", lowPrice: 8000.0, averagePrice: 8000.0,
    highPrice: 8000.0, totalQuantity: 3,
  },
  {
    payItemNumber: "720-45015", description: "INLET, TYPE A8",
    unit: "EACH", lowPrice: 2900.0, averagePrice: 3700.0,
    highPrice: 4500.0, totalQuantity: 2,
  },
  {
    payItemNumber: "720-45025", description: "INLET, TYPE D6",
    unit: "EACH", lowPrice: 2000.0, averagePrice: 2750.14,
    highPrice: 4250.41, totalQuantity: 3,
  },
  {
    payItemNumber: "720-45030", description: "INLET, TYPE E7",
    unit: "EACH", lowPrice: 1850.0, averagePrice: 3620.49,
    highPrice: 9000.0, totalQuantity: 136,
  },
  {
    payItemNumber: "720-45035", description: "INLET, TYPE F7",
    unit: "EACH", lowPrice: 1450.0, averagePrice: 3522.41,
    highPrice: 9000.0, totalQuantity: 78,
  },
  {
    payItemNumber: "720-45040", description: "INLET, TYPE G7",
    unit: "EACH", lowPrice: 2144.39, averagePrice: 2144.39,
    highPrice: 2144.39, totalQuantity: 6,
  },
  {
    payItemNumber: "720-45041", description: "INLET, TYPE H5",
    unit: "EACH", lowPrice: 5115.0, averagePrice: 7033.59,
    highPrice: 7556.84, totalQuantity: 28,
  },
  {
    payItemNumber: "720-45042", description: "INLET, TYPE HA5",
    unit: "EACH", lowPrice: 3010.0, averagePrice: 4896.09,
    highPrice: 6425.0, totalQuantity: 151,
  },
  {
    payItemNumber: "720-45045", description: "INLET, TYPE J10",
    unit: "EACH", lowPrice: 2300.0, averagePrice: 3185.76,
    highPrice: 5000.0, totalQuantity: 72,
  },
  {
    payItemNumber: "720-45055", description: "INLET, TYPE M10",
    unit: "EACH", lowPrice: 2700.0, averagePrice: 3445.0,
    highPrice: 6855.0, totalQuantity: 48,
  },
  {
    payItemNumber: "720-45065", description: "INLET, TYPE N12",
    unit: "EACH", lowPrice: 4100.0, averagePrice: 8002.86,
    highPrice: 13000.0, totalQuantity: 58,
  },
  {
    payItemNumber: "720-45066", description: "INLET, TYPE N12, MODIFIED",
    unit: "EACH", lowPrice: 6685.0, averagePrice: 6979.29,
    highPrice: 7200.0, totalQuantity: 7,
  },
  {
    payItemNumber: "720-45069", description: "INLET, TYPE P12",
    unit: "EACH", lowPrice: 3900.0, averagePrice: 4625.72,
    highPrice: 10075.21, totalQuantity: 98,
  },
  {
    payItemNumber: "720-45070", description: "INLET, TYPE P12A",
    unit: "EACH", lowPrice: 3800.49, averagePrice: 4977.21,
    highPrice: 22500.0, totalQuantity: 56,
  },
  {
    payItemNumber: "720-45075", description: "INLET, TYPE R13",
    unit: "EACH", lowPrice: 2600.0, averagePrice: 4812.85,
    highPrice: 10000.0, totalQuantity: 22,
  },
  {
    payItemNumber: "720-45105", description: "INLET, TYPE A2, MODIFIED",
    unit: "EACH", lowPrice: 5800.0, averagePrice: 5800.0,
    highPrice: 5800.0, totalQuantity: 4,
  },
  {
    payItemNumber: "720-45130", description: "INLET, TYPE E7, MODIFIED",
    unit: "EACH", lowPrice: 3100.0, averagePrice: 3100.0,
    highPrice: 3100.0, totalQuantity: 2,
  },
  {
    payItemNumber: "720-45135", description: "INLET, TYPE F7, MODIFIED",
    unit: "EACH", lowPrice: 3100.0, averagePrice: 3733.33,
    highPrice: 5000.0, totalQuantity: 3,
  },
  {
    payItemNumber: "720-45141", description: "INLET, TYPE H5, MODIFIED",
    unit: "EACH", lowPrice: 4200.0, averagePrice: 16326.38,
    highPrice: 17539.02, totalQuantity: 22,
  },
  {
    payItemNumber: "720-45145", description: "INLET, TYPE J10, MODIFIED",
    unit: "EACH", lowPrice: 3700.0, averagePrice: 3700.0,
    highPrice: 3700.0, totalQuantity: 1,
  },
  {
    payItemNumber: "720-45155", description: "INLET, TYPE M10, MODIFIED",
    unit: "EACH", lowPrice: 3800.0, averagePrice: 3841.67,
    highPrice: 3900.0, totalQuantity: 12,
  },
  {
    payItemNumber: "720-45235", description: "CATCH BASIN, TYPE E7",
    unit: "EACH", lowPrice: 2367.0, averagePrice: 3641.66,
    highPrice: 5441.16, totalQuantity: 29,
  },
  {
    payItemNumber: "720-45240", description: "CATCH BASIN, TYPE J10",
    unit: "EACH", lowPrice: 3020.0, averagePrice: 4957.65,
    highPrice: 8690.0, totalQuantity: 17,
  },
  {
    payItemNumber: "720-45250", description: "CATCH BASIN, TYPE K10",
    unit: "EACH", lowPrice: 5720.0, averagePrice: 6146.64,
    highPrice: 6402.63, totalQuantity: 8,
  },
  {
    payItemNumber: "720-45265", description: "PIPE CATCH BASIN, 15 IN.",
    unit: "EACH", lowPrice: 2500.0, averagePrice: 2900.0,
    highPrice: 3000.0, totalQuantity: 5,
  },
  {
    payItemNumber: "720-45270", description: "PIPE CATCH BASIN, 18 IN.",
    unit: "EACH", lowPrice: 1663.08, averagePrice: 2574.52,
    highPrice: 6100.0, totalQuantity: 13,
  },
  {
    payItemNumber: "720-45275", description: "PIPE CATCH BASIN, 24 IN.",
    unit: "EACH", lowPrice: 1778.09, averagePrice: 1778.09,
    highPrice: 1778.09, totalQuantity: 1,
  },
  {
    payItemNumber: "720-45335", description: "CATCH BASIN, TYPE E7, MODIFIED",
    unit: "EACH", lowPrice: 5070.41, averagePrice: 5070.41,
    highPrice: 5070.41, totalQuantity: 2,
  },
  {
    payItemNumber: "720-45410", description: "MANHOLE, TYPE C4",
    unit: "EACH", lowPrice: 2500.0, averagePrice: 5141.3,
    highPrice: 10200.0, totalQuantity: 354,
  },
  {
    payItemNumber: "720-45415", description: "MANHOLE, TYPE D4",
    unit: "EACH", lowPrice: 4500.0, averagePrice: 7790.38,
    highPrice: 10365.0, totalQuantity: 39,
  },
  {
    payItemNumber: "720-45416", description: "MANHOLE, TYPE E4",
    unit: "EACH", lowPrice: 7900.0, averagePrice: 7900.0,
    highPrice: 7900.0, totalQuantity: 1,
  },
  {
    payItemNumber: "720-45510", description: "MANHOLE, TYPE C4, MODIFIED",
    unit: "EACH", lowPrice: 3105.91, averagePrice: 6769.2,
    highPrice: 13703.23, totalQuantity: 13,
  },
  {
    payItemNumber: "720-45515", description: "MANHOLE, TYPE D4, MODIFIED",
    unit: "EACH", lowPrice: 5600.0, averagePrice: 5600.0,
    highPrice: 5600.0, totalQuantity: 1,
  },
  {
    payItemNumber: "720-45520", description: "MANHOLE, TYPE E4, MODIFIED",
    unit: "EACH", lowPrice: 7879.66, averagePrice: 7879.66,
    highPrice: 7879.66, totalQuantity: 1,
  },
  {
    payItemNumber: "720-45605", description: "STRUCTURE, MANHOLE, RECONSTRUCTED",
    unit: "LFT", lowPrice: 1200.0, averagePrice: 1579.49,
    highPrice: 3878.06, totalQuantity: 153,
  },
  {
    payItemNumber: "720-45610", description: "STRUCTURE, CATCH BASIN, RECONSTRUCTED",
    unit: "LFT", lowPrice: 1500.0, averagePrice: 1500.0,
    highPrice: 1500.0, totalQuantity: 3,
  },
  {
    payItemNumber: "720-45615", description: "STRUCTURE, INLET, RECONSTRUCTED",
    unit: "LFT", lowPrice: 750.0, averagePrice: 1612.59,
    highPrice: 5500.0, totalQuantity: 47,
  },
  {
    payItemNumber: "720-90129", description: "MANHOLE, TYPE J2",
    unit: "EACH", lowPrice: 7850.0, averagePrice: 7850.0,
    highPrice: 7850.0, totalQuantity: 5,
  },
  {
    payItemNumber: "720-90349", description: "MANHOLE, TYPE C8",
    unit: "EACH", lowPrice: 6200.0, averagePrice: 6520.6,
    highPrice: 6841.19, totalQuantity: 6,
  },
  {
    payItemNumber: "720-90984", description: "MANHOLE, TYPE C2",
    unit: "EACH", lowPrice: 3110.58, averagePrice: 5075.78,
    highPrice: 7500.0, totalQuantity: 18,
  },
  {
    payItemNumber: "720-91050", description: "MANHOLE, TYPE K7, MODIFIED",
    unit: "EACH", lowPrice: 6422.41, averagePrice: 6422.41,
    highPrice: 6422.41, totalQuantity: 1,
  },
  {
    payItemNumber: "720-91110", description: "MANHOLE, TYPE N4",
    unit: "EACH", lowPrice: 12750.0, averagePrice: 24345.3,
    highPrice: 30000.0, totalQuantity: 9,
  },
  {
    payItemNumber: "720-91246", description: "INLET, TYPE N12A",
    unit: "EACH", lowPrice: 6600.0, averagePrice: 6785.0,
    highPrice: 6970.0, totalQuantity: 2,
  },
  {
    payItemNumber: "720-91352", description: "CATCH BASIN, TYPE F7",
    unit: "EACH", lowPrice: 2367.0, averagePrice: 3243.2,
    highPrice: 5871.81, totalQuantity: 4,
  },
  {
    payItemNumber: "720-91742", description: "FIRE HYDRANT",
    unit: "EACH", lowPrice: 8500.0, averagePrice: 8500.0,
    highPrice: 8500.0, totalQuantity: 1,
  },
  {
    payItemNumber: "720-91973", description: "MANHOLE, TYPE H4",
    unit: "EACH", lowPrice: 7000.0, averagePrice: 7000.0,
    highPrice: 7000.0, totalQuantity: 2,
  },
  {
    payItemNumber: "720-92025", description: "MANHOLE, TYPE D2",
    unit: "EACH", lowPrice: 8456.06, averagePrice: 8456.06,
    highPrice: 8456.06, totalQuantity: 1,
  },
  {
    payItemNumber: "720-92240", description: "CATCH BASIN, TYPE W4",
    unit: "EACH", lowPrice: 4400.0, averagePrice: 4400.0,
    highPrice: 4400.0, totalQuantity: 1,
  },
  {
    payItemNumber: "720-92883", description: "MANHOLE, TYPE M4, MODIFIED",
    unit: "EACH", lowPrice: 9410.16, averagePrice: 15073.36,
    highPrice: 20736.55, totalQuantity: 2,
  },
  {
    payItemNumber: "720-92884", description: "MANHOLE, TYPE K4, MODIFIED",
    unit: "EACH", lowPrice: 6900.0, averagePrice: 7959.06,
    highPrice: 8431.38, totalQuantity: 8,
  },
  {
    payItemNumber: "720-93409", description: "INLET, TYPE B15, MODIFIED",
    unit: "EACH", lowPrice: 4149.87, averagePrice: 5373.97,
    highPrice: 9000.0, totalQuantity: 38,
  },
  {
    payItemNumber: "720-93411", description: "INLET, TYPE C15, MODIFIED",
    unit: "EACH", lowPrice: 4143.16, averagePrice: 5088.26,
    highPrice: 9000.0, totalQuantity: 32,
  },
  {
    payItemNumber: "720-93501", description: "MANHOLE, TYPE L4",
    unit: "EACH", lowPrice: 10266.33, averagePrice: 12197.07,
    highPrice: 19000.0, totalQuantity: 14,
  },
  {
    payItemNumber: "720-94157", description: "MANHOLE, TYPE C",
    unit: "EACH", lowPrice: 6285.0, averagePrice: 6285.0,
    highPrice: 6285.0, totalQuantity: 17,
  },
  {
    payItemNumber: "720-94432", description: "MANHOLE, TYPE C7",
    unit: "EACH", lowPrice: 2400.0, averagePrice: 5024.85,
    highPrice: 5985.72, totalQuantity: 23,
  },
  {
    payItemNumber: "720-94602", description: "MANHOLE, TYPE K4, DROP",
    unit: "EACH", lowPrice: 16900.0, averagePrice: 16900.0,
    highPrice: 16900.0, totalQuantity: 2,
  },
  {
    payItemNumber: "720-94612", description: "MANHOLE, TYPE K4",
    unit: "EACH", lowPrice: 5520.0, averagePrice: 8139.05,
    highPrice: 62000.0, totalQuantity: 65,
  },
  {
    payItemNumber: "720-94840", description: "CASTING, WATER VALVE, ADJUST TO GRADE",
    unit: "EACH", lowPrice: 108.46, averagePrice: 413.23,
    highPrice: 1900.0, totalQuantity: 174,
  },
  {
    payItemNumber: "720-94841", description: "CASTING, WATER METER, ADJUST TO GRADE",
    unit: "EACH", lowPrice: 328.37, averagePrice: 411.48,
    highPrice: 550.0, totalQuantity: 40,
  },
  {
    payItemNumber: "720-94847", description: "INLET, TYPE R13, MODIFIED",
    unit: "EACH", lowPrice: 2600.0, averagePrice: 3608.46,
    highPrice: 5570.0, totalQuantity: 13,
  },
  {
    payItemNumber: "720-95310", description: "INLET, TYPE P12A, MODIFIED",
    unit: "EACH", lowPrice: 4400.0, averagePrice: 5504.37,
    highPrice: 7215.0, totalQuantity: 13,
  },
  {
    payItemNumber: "720-95335", description: "MANHOLE, TYPE M4",
    unit: "EACH", lowPrice: 13688.93, averagePrice: 18916.19,
    highPrice: 28642.0, totalQuantity: 5,
  },
  {
    payItemNumber: "720-95409", description: "MANHOLE, TYPE J4, MODIFIED",
    unit: "EACH", lowPrice: 5384.23, averagePrice: 6534.63,
    highPrice: 7000.0, totalQuantity: 7,
  },
  {
    payItemNumber: "720-95422", description: "MANHOLE, TYPE J4",
    unit: "EACH", lowPrice: 4300.0, averagePrice: 5819.14,
    highPrice: 11000.0, totalQuantity: 124,
  },
  {
    payItemNumber: "720-95555", description: "MANHOLE, TYPE M2",
    unit: "EACH", lowPrice: 17000.0, averagePrice: 17000.0,
    highPrice: 17000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "720-96125", description: "INLET, TYPE E",
    unit: "EACH", lowPrice: 3200.0, averagePrice: 3200.0,
    highPrice: 3200.0, totalQuantity: 1,
  },
  {
    payItemNumber: "720-96554", description: "INLET, TYPE M13, MODIFIED",
    unit: "EACH", lowPrice: 4662.02, averagePrice: 4662.02,
    highPrice: 4662.02, totalQuantity: 1,
  },
  {
    payItemNumber: "720-96851", description: "INLET, TYPE J13",
    unit: "EACH", lowPrice: 3250.0, averagePrice: 3250.0,
    highPrice: 3250.0, totalQuantity: 5,
  },
  {
    payItemNumber: "720-96995", description: "CLEAN INLET",
    unit: "EACH", lowPrice: 275.0, averagePrice: 450.24,
    highPrice: 850.0, totalQuantity: 37,
  },
  {
    payItemNumber: "720-96999", description: "FIRE HYDRANT ASSEMBLY",
    unit: "EACH", lowPrice: 600.0, averagePrice: 9476.86,
    highPrice: 11091.01, totalQuantity: 31,
  },
  {
    payItemNumber: "720-97008", description: "FIRE HYDRANT ASSEMBLY, RELOCATE",
    unit: "EACH", lowPrice: 3160.65, averagePrice: 4119.46,
    highPrice: 6000.0, totalQuantity: 7,
  },
  {
    payItemNumber: "720-97317", description: "INLET, TYPE F",
    unit: "EACH", lowPrice: 3520.87, averagePrice: 3736.87,
    highPrice: 3808.87, totalQuantity: 4,
  },
  {
    payItemNumber: "720-97896", description: "INLET, TYPE A4",
    unit: "EACH", lowPrice: 3400.0, averagePrice: 3400.0,
    highPrice: 3400.0, totalQuantity: 1,
  },
  {
    payItemNumber: "720-97958", description: "MANHOLE, TYPE K2",
    unit: "EACH", lowPrice: 7400.0, averagePrice: 8475.0,
    highPrice: 11700.0, totalQuantity: 4,
  },
  {
    payItemNumber: "720-98006", description: "MANHOLE, TYPE J8",
    unit: "EACH", lowPrice: 7784.66, averagePrice: 7928.22,
    highPrice: 8000.0, totalQuantity: 3,
  },
  {
    payItemNumber: "720-98174", description: "INLET, TYPE B15",
    unit: "EACH", lowPrice: 1300.0, averagePrice: 4113.45,
    highPrice: 7900.0, totalQuantity: 679,
  },
  {
    payItemNumber: "720-98555", description: "INLET, TYPE C15",
    unit: "EACH", lowPrice: 2058.42, averagePrice: 4238.18,
    highPrice: 7900.0, totalQuantity: 630,
  },
  {
    payItemNumber: "720-98625", description: "MANHOLE, TYPE C4, DROP",
    unit: "EACH", lowPrice: 6200.0, averagePrice: 11640.0,
    highPrice: 13000.0, totalQuantity: 5,
  },
  {
    payItemNumber: "720-98869", description: "MANHOLE, TYPE L4, MODIFIED",
    unit: "EACH", lowPrice: 15000.0, averagePrice: 15000.0,
    highPrice: 15000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "720-99315", description: "CATCH BASIN, CLEAN EXISTING",
    unit: "EACH", lowPrice: 300.0, averagePrice: 300.0,
    highPrice: 300.0, totalQuantity: 5,
  },
  {
    payItemNumber: "720-99416", description: "CATCH BASIN, TYPE B15",
    unit: "EACH", lowPrice: 2366.99, averagePrice: 4204.68,
    highPrice: 9000.0, totalQuantity: 88,
  },
  {
    payItemNumber: "720-99417", description: "CATCH BASIN, TYPE C15",
    unit: "EACH", lowPrice: 2428.97, averagePrice: 3496.17,
    highPrice: 9000.0, totalQuantity: 115,
  },
  {
    payItemNumber: "721-09548", description: "AUTOMATIC DRAINAGE GATE",
    unit: "EACH", lowPrice: 35507.23, averagePrice: 35507.23,
    highPrice: 35507.23, totalQuantity: 1,
  },
  {
    payItemNumber: "721-43000", description: "AUTOMATIC DRAINAGE GATE, DIAMETER 12 IN.",
    unit: "EACH", lowPrice: 4250.0, averagePrice: 4250.0,
    highPrice: 4250.0, totalQuantity: 1,
  },
  {
    payItemNumber: "721-43010", description: "AUTOMATIC DRAINAGE GATE, DIAMETER 18 IN.",
    unit: "EACH", lowPrice: 2500.0, averagePrice: 2500.0,
    highPrice: 2500.0, totalQuantity: 1,
  },
  {
    payItemNumber: "721-43020", description: "AUTOMATIC DRAINAGE GATE, DIAMETER 24 IN.",
    unit: "EACH", lowPrice: 9000.0, averagePrice: 9000.0,
    highPrice: 9000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "721-43030", description: "AUTOMATIC DRAINAGE GATE, DIAMETER 30 IN.",
    unit: "EACH", lowPrice: 15000.0, averagePrice: 15000.0,
    highPrice: 15000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "721-43105", description: "AUTOMATIC DRAINAGE GATE, 24 IN. X 24 IN.",
    unit: "EACH", lowPrice: 15000.0, averagePrice: 15000.0,
    highPrice: 15000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "721-43115", description: "AUTOMATIC DRAINAGE GATE, 30 IN. X 30 IN.",
    unit: "EACH", lowPrice: 21000.0, averagePrice: 21000.0,
    highPrice: 21000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "721-43125", description: "AUTOMATIC DRAINAGE GATE, 36 IN. X 36 IN.",
    unit: "EACH", lowPrice: 25000.0, averagePrice: 25000.0,
    highPrice: 25000.0, totalQuantity: 2,
  },
  {
    payItemNumber: "722-000134", description: "BRIDGE DECK OVERLAY, RIGID",
    unit: "SYS", lowPrice: 60.0, averagePrice: 104.88,
    highPrice: 265.0, totalQuantity: 36174,
  },
  {
    payItemNumber: "722-000146", description: "BRIDGE DECK, REMOVE POLYMER OVERLAY AND SURFACE",
    unit: "SYS", lowPrice: 13.0, averagePrice: 17.55,
    highPrice: 35.0, totalQuantity: 1053,
  },
  {
    payItemNumber: "722-000183", description: "BRIDGE DECK, REMOVE CONCRETE OVERLAY AND SURFACE",
    unit: "SYS", lowPrice: 7.0, averagePrice: 11.45,
    highPrice: 30.0, totalQuantity: 11715,
  },
  {
    payItemNumber: "722-01061", description: "BRIDGE DECK OVERLAY, SILICA FUME MODIFIED",
    unit: "SYS", lowPrice: 68.0, averagePrice: 103.53,
    highPrice: 280.0, totalQuantity: 42353,
  },
  {
    payItemNumber: "722-01066", description: "HYDRODEMOLITION",
    unit: "SYS", lowPrice: 50.0, averagePrice: 77.09,
    highPrice: 245.0, totalQuantity: 114507,
  },
  {
    payItemNumber: "722-12381", description: "BRIDGE DECK OVERLAY, LMC-VE",
    unit: "SYS", lowPrice: 205.0, averagePrice: 205.99,
    highPrice: 210.0, totalQuantity: 1105,
  },
  {
    payItemNumber: "722-12463", description: "BRIDGE DECK, REMOVE CONCRETE OVERLAY",
    unit: "SYS", lowPrice: 5.02, averagePrice: 11.9,
    highPrice: 50.0, totalQuantity: 15469,
  },
  {
    payItemNumber: "722-12464", description: "BRIDGE DECK, REMOVE CONCRETE SURFACE",
    unit: "SYS", lowPrice: 4.5, averagePrice: 10.88,
    highPrice: 63.0, totalQuantity: 84504,
  },
  {
    payItemNumber: "722-12732", description: "LONGITUDINAL GROOVING",
    unit: "SYS", lowPrice: 1.0, averagePrice: 6.32,
    highPrice: 44.65, totalQuantity: 195949,
  },
  {
    payItemNumber: "722-12899", description: "BRIDGE DECK OVERLAY",
    unit: "SYS", lowPrice: 36.0, averagePrice: 36.0,
    highPrice: 36.0, totalQuantity: 2900,
  },
  {
    payItemNumber: "722-51401", description: "BRIDGE DECK PATCHING, FULL DEPTH",
    unit: "SFT", lowPrice: 1.0, averagePrice: 48.18,
    highPrice: 273.47, totalQuantity: 23544,
  },
  {
    payItemNumber: "722-51842", description: "BRIDGE DECK OVERLAY, LATEX MODIFIED",
    unit: "SYS", lowPrice: 65.0, averagePrice: 131.63,
    highPrice: 505.0, totalQuantity: 39119,
  },
  {
    payItemNumber: "722-51852", description: "BRIDGE DECK PATCHING, PARTIAL DEPTH",
    unit: "SFT", lowPrice: 0.01, averagePrice: 10.0,
    highPrice: 110.0, totalQuantity: 13560,
  },
  {
    payItemNumber: "722-51874", description: "OVERLAY DAM",
    unit: "SFT", lowPrice: 20.0, averagePrice: 65.19,
    highPrice: 150.0, totalQuantity: 5091,
  },
  {
    payItemNumber: "722-97116", description: "BRIDGE DECK OVERLAY, PATCHING",
    unit: "SFT", lowPrice: 55.0, averagePrice: 55.0,
    highPrice: 55.0, totalQuantity: 268,
  },
  {
    payItemNumber: "723-000077", description: "STRUCTURE, COATED REINFORCED CONCRETE, THREE-SIDED SECTIONS,  216 IN. X 39 IN.",
    unit: "LFT", lowPrice: 3290.0, averagePrice: 3290.0,
    highPrice: 3290.0, totalQuantity: 55,
  },
  {
    payItemNumber: "723-000096", description: "STRUCTURE, COATED REINFORCED CONCRETE, THREE-SIDED SECTIONS,  432 IN. X 118 IN.",
    unit: "LFT", lowPrice: 12000.0, averagePrice: 12000.0,
    highPrice: 12000.0, totalQuantity: 50,
  },
  {
    payItemNumber: "723-000101", description: "STRUCTURE, COATED REINFORCED CONCRETE, THREE-SIDED SECTIONS,  384 IN. X 152 IN.",
    unit: "LFT", lowPrice: 12580.0, averagePrice: 12580.0,
    highPrice: 12580.0, totalQuantity: 42,
  },
  {
    payItemNumber: "723-000139", description: "STRUCTURE, COATED REINFORCED CONCRETE, THREE-SIDED SECTIONS,  240 IN. X 84 IN.",
    unit: "LFT", lowPrice: 7000.0, averagePrice: 7000.0,
    highPrice: 7000.0, totalQuantity: 90,
  },
  {
    payItemNumber: "723-000155", description: "STRUCTURE, REINFORCED CONCRETE, THREE-SIDED SECTIONS, 432 IN . X 132 IN.",
    unit: "LFT", lowPrice: 15000.0, averagePrice: 15000.0,
    highPrice: 15000.0, totalQuantity: 188,
  },
  {
    payItemNumber: "723-10171", description: "STRUCTURE, REINFORCED CONCRETE, THREE-SIDED SECTIONS, 384 IN . X 140 IN.",
    unit: "LFT", lowPrice: 9000.0, averagePrice: 10127.78,
    highPrice: 11450.0, totalQuantity: 126,
  },
  {
    payItemNumber: "723-11203", description: "STRUCTURE, REINFORCED CONCRETE, THREE-SIDED SECTIONS",
    unit: "LFT", lowPrice: 4437.51, averagePrice: 4437.51,
    highPrice: 4437.51, totalQuantity: 192,
  },
  {
    payItemNumber: "723-11208", description: "STRUCTURE, REINFORCED CONCRETE, THREE-SIDED SECTIONS, 384 IN . X 120 IN.",
    unit: "LFT", lowPrice: 11100.0, averagePrice: 11100.0,
    highPrice: 11100.0, totalQuantity: 47,
  },
  {
    payItemNumber: "723-11211", description: "STRUCTURE, REINFORCED CONCRETE, THREE-SIDED SECTIONS, 240 IN . X 120 IN.",
    unit: "LFT", lowPrice: 3900.0, averagePrice: 3900.0,
    highPrice: 3900.0, totalQuantity: 184,
  },
  {
    payItemNumber: "723-11236", description: "STRUCTURE, REINFORCED CONCRETE, THREE-SIDED SECTIONS, 144 IN . X 84 IN.",
    unit: "LFT", lowPrice: 2450.0, averagePrice: 2450.0,
    highPrice: 2450.0, totalQuantity: 72,
  },
  {
    payItemNumber: "723-11270", description: "STRUCTURE, REINFORCED CONCRETE, THREE-SIDED SECTIONS, 312 IN . X 144 IN.",
    unit: "LFT", lowPrice: 8100.0, averagePrice: 8100.0,
    highPrice: 8100.0, totalQuantity: 60,
  },
  {
    payItemNumber: "723-12337", description: "STRUCTURE, COATED REINFORCED CONCRETE, THREE-SIDED SECTIONS,  432 IN. X 144 IN.",
    unit: "LFT", lowPrice: 8990.0, averagePrice: 8990.0,
    highPrice: 8990.0, totalQuantity: 44,
  },
  {
    payItemNumber: "723-12599", description: "STRUCTURE, COATED REINFORCED CONCRETE, THREE-SIDED SECTIONS,  504 IN. X 120 IN.",
    unit: "LFT", lowPrice: 6015.58, averagePrice: 6015.58,
    highPrice: 6015.58, totalQuantity: 44,
  },
  {
    payItemNumber: "723-12868", description: "STRUCTURE, REINFORCED CONCRETE, THREE-SIDED SECTIONS, 288 IN . X 195 IN.",
    unit: "LFT", lowPrice: 11100.0, averagePrice: 11100.0,
    highPrice: 11100.0, totalQuantity: 148,
  },
  {
    payItemNumber: "723-12895", description: "STRUCTURE EXTENSION, REINFORCED CONCRETE, THREE-SIDED SECTIO NS, 240 IN. X 120 IN.",
    unit: "LFT", lowPrice: 57105.0, averagePrice: 57105.0,
    highPrice: 57105.0, totalQuantity: 24,
  },
  {
    payItemNumber: "723-12919", description: "STRUCTURE EXTENSION, REINFORCED CONCRETE, THREE-SIDED SECTIO NS, 120 IN. X 96 IN.",
    unit: "LFT", lowPrice: 17800.0, averagePrice: 17800.0,
    highPrice: 17800.0, totalQuantity: 20,
  },
  {
    payItemNumber: "723-12943", description: "STRUCTURE, REINFORCED CONCRETE, THREE-SIDED SECTIONS, 408 IN . X 148 IN.",
    unit: "LFT", lowPrice: 9810.0, averagePrice: 9810.0,
    highPrice: 9810.0, totalQuantity: 46,
  },
  {
    payItemNumber: "723-12965", description: "STRUCTURE, REINFORCED CONCRETE THREE-SIDED SECTIONS, 576 IN.  X 144 IN.",
    unit: "LFT", lowPrice: 16220.0, averagePrice: 16220.0,
    highPrice: 16220.0, totalQuantity: 42,
  },
  {
    payItemNumber: "724-03855", description: "EXPANSION JOINT SLIDING PLATE",
    unit: "LFT", lowPrice: 385.41, averagePrice: 543.49,
    highPrice: 1000.0, totalQuantity: 104,
  },
  {
    payItemNumber: "724-12420", description: "BRIDGE JOINT NOSING",
    unit: "SFT", lowPrice: 480.0, averagePrice: 480.0,
    highPrice: 480.0, totalQuantity: 11,
  },
  {
    payItemNumber: "724-12461", description: "CONCRETE FOR PATCHING BRIDGE EXPANSION JOINT",
    unit: "SFT", lowPrice: 15.0, averagePrice: 40.96,
    highPrice: 1000.0, totalQuantity: 903,
  },
  {
    payItemNumber: "724-12771", description: "BRIDGE EXPANSION JOINT, TYPE SS",
    unit: "LFT", lowPrice: 700.0, averagePrice: 700.0,
    highPrice: 700.0, totalQuantity: 81,
  },
  {
    payItemNumber: "724-12773", description: "BRIDGE EXPANSION JOINT, TYPE PCF",
    unit: "LFT", lowPrice: 40.0, averagePrice: 98.31,
    highPrice: 400.0, totalQuantity: 1959,
  },
  {
    payItemNumber: "724-12774", description: "BRIDGE EXPANSION JOINT, TYPE SS, REPLACE",
    unit: "LFT", lowPrice: 400.0, averagePrice: 632.01,
    highPrice: 1000.0, totalQuantity: 417,
  },
  {
    payItemNumber: "724-12775", description: "BRIDGE EXPANSION JOINT, TYPE M, REPLACE",
    unit: "LFT", lowPrice: 2600.0, averagePrice: 3076.19,
    highPrice: 3300.0, totalQuantity: 294,
  },
  {
    payItemNumber: "724-12776", description: "BRIDGE EXPANSION JOINT, TYPE PCF, REPLACE",
    unit: "LFT", lowPrice: 75.0, averagePrice: 89.11,
    highPrice: 100.0, totalQuantity: 280,
  },
  {
    payItemNumber: "724-12779", description: "BRIDGE EXPANSION JOINT SEAL, TYPE PCF, REPLACE",
    unit: "LFT", lowPrice: 76.0, averagePrice: 102.75,
    highPrice: 120.0, totalQuantity: 568,
  },
  {
    payItemNumber: "725-000178", description: "LINER PIPE, STEEL, CIRCULAR, 50.1-50.4 SFT",
    unit: "LFT", lowPrice: 1500.0, averagePrice: 1500.0,
    highPrice: 1500.0, totalQuantity: 238,
  },
  {
    payItemNumber: "725-08291", description: "PIPE LINER, CURED-IN-PLACE, 24 IN.",
    unit: "LFT", lowPrice: 338.89, averagePrice: 338.89,
    highPrice: 338.89, totalQuantity: 197,
  },
  {
    payItemNumber: "725-08292", description: "PIPE LINER, CURED-IN-PLACE, 30 IN.",
    unit: "LFT", lowPrice: 584.0, averagePrice: 618.4,
    highPrice: 735.0, totalQuantity: 483,
  },
  {
    payItemNumber: "725-08293", description: "PIPE LINER, CURED-IN-PLACE, 36 IN.",
    unit: "LFT", lowPrice: 410.0, averagePrice: 410.0,
    highPrice: 410.0, totalQuantity: 1603,
  },
  {
    payItemNumber: "725-08294", description: "PIPE LINER, CURED-IN-PLACE, 42 IN.",
    unit: "LFT", lowPrice: 450.0, averagePrice: 562.03,
    highPrice: 850.5, totalQuantity: 1042,
  },
  {
    payItemNumber: "725-08296", description: "PIPE LINER, CURED-IN-PLACE, 48 IN.",
    unit: "LFT", lowPrice: 545.86, averagePrice: 719.15,
    highPrice: 1695.0, totalQuantity: 1179,
  },
  {
    payItemNumber: "725-08298", description: "PIPE LINER, CURED-IN-PLACE, 15 IN.",
    unit: "LFT", lowPrice: 166.44, averagePrice: 166.44,
    highPrice: 166.44, totalQuantity: 138,
  },
  {
    payItemNumber: "725-10014", description: "PIPE LINER, CURED-IN-PLACE, MIN. AREA 8.8 SFT",
    unit: "LFT", lowPrice: 721.84, averagePrice: 721.84,
    highPrice: 721.84, totalQuantity: 216,
  },
  {
    payItemNumber: "725-10019", description: "LINER PIPE, THERMOPLASTIC, CIRCULAR, 4.9-5.0 SFT",
    unit: "LFT", lowPrice: 569.0, averagePrice: 569.0,
    highPrice: 569.0, totalQuantity: 400,
  },
  {
    payItemNumber: "725-10198", description: "LINER PIPE, THERMOPLASTIC, DEFORMED, 26.6-28.3 SFT 26.6 - 28.3 SFT.",
    unit: "LFT", lowPrice: 2400.0, averagePrice: 2400.0,
    highPrice: 2400.0, totalQuantity: 82,
  },
  {
    payItemNumber: "725-10203", description: "PIPE LINER, CURED-IN-PLACE, 72 IN.",
    unit: "LFT", lowPrice: 1087.0, averagePrice: 1908.97,
    highPrice: 9000.0, totalQuantity: 972,
  },
  {
    payItemNumber: "725-10206", description: "PIPE LINER, CURED-IN-PLACE, 96 IN.",
    unit: "LFT", lowPrice: 2181.0, averagePrice: 2181.0,
    highPrice: 2181.0, totalQuantity: 165,
  },
  {
    payItemNumber: "725-10245", description: "PERPETUATION, EXISTING PIPE",
    unit: "EACH", lowPrice: 350.0, averagePrice: 622.22,
    highPrice: 2000.0, totalQuantity: 9,
  },
  {
    payItemNumber: "725-11013", description: "LINER PIPE, THERMOPLASTIC, DEFORMED, 4.7-5.0 SFT 4.7-5.0 SFT.",
    unit: "LFT", lowPrice: 875.0, averagePrice: 875.0,
    highPrice: 875.0, totalQuantity: 216,
  },
  {
    payItemNumber: "725-11037", description: "LINER PIPE, THERMOPLASTIC, CIRCULAR, 12.5-12.6 SFT 12.5-12.6 SFT.",
    unit: "LFT", lowPrice: 686.0, averagePrice: 686.0,
    highPrice: 686.0, totalQuantity: 240,
  },
  {
    payItemNumber: "725-11042", description: "LINER PIPE, THERMOPLASTIC, CIRCULAR, 27.7-28.3 SFT 27.7-28.3 SFT.",
    unit: "LFT", lowPrice: 1400.0, averagePrice: 1400.0,
    highPrice: 1400.0, totalQuantity: 258,
  },
  {
    payItemNumber: "725-11275", description: "PIPE LINER, CURED-IN-PLACE, 12 IN.",
    unit: "LFT", lowPrice: 215.6, averagePrice: 226.41,
    highPrice: 232.4, totalQuantity: 213,
  },
  {
    payItemNumber: "725-11288", description: "PIPE LINER, CURED-IN-PLACE, 60 IN.",
    unit: "LFT", lowPrice: 1000.0, averagePrice: 1111.18,
    highPrice: 1381.0, totalQuantity: 305,
  },
  {
    payItemNumber: "725-11289", description: "LINER PIPE, THERMOPLASTIC, CIRCULAR, 23.2-23.8 SFT",
    unit: "LFT", lowPrice: 1300.0, averagePrice: 1300.0,
    highPrice: 1300.0, totalQuantity: 398,
  },
  {
    payItemNumber: "725-11294", description: "PIPE LINER, CURED-IN-PLACE, MIN. AREA 6.5 SFT",
    unit: "LFT", lowPrice: 489.71, averagePrice: 595.52,
    highPrice: 714.11, totalQuantity: 386,
  },
  {
    payItemNumber: "725-11295", description: "PIPE LINER, CURED-IN-PLACE, 54 IN.",
    unit: "LFT", lowPrice: 1900.0, averagePrice: 2140.16,
    highPrice: 2510.0, totalQuantity: 127,
  },
  {
    payItemNumber: "725-11299", description: "PIPE LINER, CURED-IN-PLACE, 66 IN.",
    unit: "LFT", lowPrice: 988.0, averagePrice: 988.0,
    highPrice: 988.0, totalQuantity: 141,
  },
  {
    payItemNumber: "725-11300", description: "PIPE LINER, CURED-IN-PLACE, MIN. AREA 8.9 SFT",
    unit: "LFT", lowPrice: 1100.0, averagePrice: 1100.0,
    highPrice: 1100.0, totalQuantity: 100,
  },
  {
    payItemNumber: "725-11399", description: "PIPE LINER, CURED-IN-PLACE, 84 IN.",
    unit: "LFT", lowPrice: 2280.0, averagePrice: 2280.0,
    highPrice: 2280.0, totalQuantity: 89,
  },
  {
    payItemNumber: "725-11421", description: "PIPE LINER, CURED-IN-PLACE, 51 IN.",
    unit: "LFT", lowPrice: 1800.0, averagePrice: 1800.0,
    highPrice: 1800.0, totalQuantity: 84,
  },
  {
    payItemNumber: "725-11513", description: "PIPE LINER, CURED-IN-PLACE, 80 IN.",
    unit: "LFT", lowPrice: 1805.0, averagePrice: 1917.83,
    highPrice: 2305.47, totalQuantity: 275,
  },
  {
    payItemNumber: "725-11709", description: "PIPE LINER, CURED-IN-PLACE, MIN. AREA 12.5 SFT",
    unit: "LFT", lowPrice: 719.75, averagePrice: 719.75,
    highPrice: 719.75, totalQuantity: 367,
  },
  {
    payItemNumber: "725-11741", description: "PIPE LINER, CURED-IN-PLACE, MIN. AREA 21.9 SFT",
    unit: "LFT", lowPrice: 1220.0, averagePrice: 1220.0,
    highPrice: 1220.0, totalQuantity: 152,
  },
  {
    payItemNumber: "725-11762", description: "LINER PIPE, THERMOPLASTIC, DEFORMED, 36.4-38.5 SFT",
    unit: "LFT", lowPrice: 2100.0, averagePrice: 2100.0,
    highPrice: 2100.0, totalQuantity: 230,
  },
  {
    payItemNumber: "725-12011", description: "LINER PIPE, INFRASTEEL",
    unit: "LFT", lowPrice: 4088.0, averagePrice: 4088.0,
    highPrice: 4088.0, totalQuantity: 430,
  },
  {
    payItemNumber: "725-12052", description: "PIPE LINER, CURED-IN-PLACE, MIN. AREA 26.8 SFT",
    unit: "LFT", lowPrice: 890.0, averagePrice: 890.0,
    highPrice: 890.0, totalQuantity: 352,
  },
  {
    payItemNumber: "725-12054", description: "PIPE LINER, CURED-IN-PLACE, MIN. AREA 30.1 SFT",
    unit: "LFT", lowPrice: 1690.0, averagePrice: 1690.0,
    highPrice: 1690.0, totalQuantity: 221,
  },
  {
    payItemNumber: "725-12146", description: "LINER PIPE, THERMOPLASTIC, CIRCULAR, 10.9-12.4 SFT",
    unit: "LFT", lowPrice: 840.0, averagePrice: 840.0,
    highPrice: 840.0, totalQuantity: 150,
  },
  {
    payItemNumber: "725-12216", description: "PIPE LINER, CURED-IN-PLACE, 78 IN",
    unit: "LFT", lowPrice: 1100.0, averagePrice: 1100.0,
    highPrice: 1100.0, totalQuantity: 210,
  },
  {
    payItemNumber: "725-12358", description: "PIPE LINER, CURED-IN-PLACE, MIN. AREA 34.2 SFT",
    unit: "LFT", lowPrice: 2110.0, averagePrice: 2110.0,
    highPrice: 2110.0, totalQuantity: 80,
  },
  {
    payItemNumber: "725-12452", description: "PIPE LINER, CURED-IN-PLACE, 69 IN.",
    unit: "LFT", lowPrice: 1500.0, averagePrice: 1627.69,
    highPrice: 2000.0, totalQuantity: 372,
  },
  {
    payItemNumber: "725-12453", description: "PIPE LINER, CURED-IN-PLACE, 18 IN.",
    unit: "LFT", lowPrice: 180.86, averagePrice: 212.67,
    highPrice: 284.17, totalQuantity: 458,
  },
  {
    payItemNumber: "725-12511", description: "LINER PIPE, THERMOPLASTIC, DEFORMED, 8.9-9.1 SFT",
    unit: "LFT", lowPrice: 1591.11, averagePrice: 1591.11,
    highPrice: 1591.11, totalQuantity: 70,
  },
  {
    payItemNumber: "725-12827", description: "PIPE LINER, CURED-IN-PLACE, MIN. AREA 7.3 SFT",
    unit: "LFT", lowPrice: 456.3, averagePrice: 456.3,
    highPrice: 456.3, totalQuantity: 267,
  },
  {
    payItemNumber: "726-11451", description: "BEARING ASSEMBLY, FIXED, TYPE 1",
    unit: "EACH", lowPrice: 5500.0, averagePrice: 5500.0,
    highPrice: 5500.0, totalQuantity: 6,
  },
  {
    payItemNumber: "726-12766", description: "BEARING ASSEMBLY, SHIM EXISTING",
    unit: "EACH", lowPrice: 1582.33, averagePrice: 1760.82,
    highPrice: 1975.0, totalQuantity: 22,
  },
  {
    payItemNumber: "726-92406", description: "BEARING ASSEMBLY, ELASTOMERIC",
    unit: "EACH", lowPrice: 100.0, averagePrice: 1798.29,
    highPrice: 5000.0, totalQuantity: 962,
  },
  {
    payItemNumber: "726-95870", description: "BEARING ASSEMBLY, PTFE",
    unit: "EACH", lowPrice: 3910.98, averagePrice: 3910.98,
    highPrice: 3910.98, totalQuantity: 22,
  },
  {
    payItemNumber: "727-000188", description: "EPOXY INJECTION, EPOXY INJECTION ADHESIVE",
    unit: "GAL", lowPrice: 1.0, averagePrice: 17.13,
    highPrice: 200.0, totalQuantity: 191,
  },
  {
    payItemNumber: "727-90308", description: "EPOXY INJECTION, CRACK PREPARATION",
    unit: "LFT", lowPrice: 2.5, averagePrice: 54.87,
    highPrice: 500.0, totalQuantity: 3473,
  },
  {
    payItemNumber: "727-90309", description: "EPOXY INJECTION, EPOXY MATERIAL",
    unit: "GAL", lowPrice: 10.0, averagePrice: 66.19,
    highPrice: 1000.0, totalQuantity: 134,
  },
  {
    payItemNumber: "727-93560", description: "EPOXY INJECTION, FURNISHING EQUIPMENT",
    unit: "LS", lowPrice: 100.0, averagePrice: 1245.86,
    highPrice: 3500.0, totalQuantity: 29,
  },
  {
    payItemNumber: "728-11672", description: "DRILLED SHAFT, EXPLORATORY CORE",
    unit: "LFT", lowPrice: 76.53, averagePrice: 109.53,
    highPrice: 175.0, totalQuantity: 1806,
  },
  {
    payItemNumber: "728-11673", description: "DRILLED SHAFT, PERMANENT CASING",
    unit: "LFT", lowPrice: 231.0, averagePrice: 549.44,
    highPrice: 718.0, totalQuantity: 1174,
  },
  {
    payItemNumber: "728-11674", description: "DRILLED SHAFT, DIAMETER 48 IN.",
    unit: "LFT", lowPrice: 675.0, averagePrice: 826.23,
    highPrice: 1400.0, totalQuantity: 652,
  },
  {
    payItemNumber: "728-11713", description: "DRILLED SHAFT, DIAMETER 36 IN.",
    unit: "LFT", lowPrice: 600.0, averagePrice: 755.88,
    highPrice: 1483.33, totalQuantity: 238,
  },
  {
    payItemNumber: "728-11789", description: "DRILLED SHAFT, DIAMETER 42 IN.",
    unit: "LFT", lowPrice: 693.15, averagePrice: 699.76,
    highPrice: 730.0, totalQuantity: 446,
  },
  {
    payItemNumber: "728-12209", description: "DRILLED SHAFT, DIAMETER 30 IN.",
    unit: "LFT", lowPrice: 1500.0, averagePrice: 1500.0,
    highPrice: 1500.0, totalQuantity: 80,
  },
  {
    payItemNumber: "729-11819", description: "STRAIGHTEN STEEL MEMBER",
    unit: "LS", lowPrice: 26674.46, averagePrice: 127918.62,
    highPrice: 210000.0, totalQuantity: 4,
  },
  {
    payItemNumber: "731-03133", description: "CONCRETE FACING",
    unit: "SFT", lowPrice: 50.0, averagePrice: 62.5,
    highPrice: 90.0, totalQuantity: 3010,
  },
  {
    payItemNumber: "731-06223", description: "SOIL NAILED WALL",
    unit: "SYS", lowPrice: 403.0, averagePrice: 640.92,
    highPrice: 1375.0, totalQuantity: 3005,
  },
  {
    payItemNumber: "731-12679", description: "MSE PANEL JOINT SEALING",
    unit: "LFT", lowPrice: 16.0, averagePrice: 16.0,
    highPrice: 16.0, totalQuantity: 136,
  },
  {
    payItemNumber: "731-93945", description: "FACE PANELS, CONCRETE",
    unit: "SFT", lowPrice: 40.22, averagePrice: 45.92,
    highPrice: 73.34, totalQuantity: 87122,
  },
  {
    payItemNumber: "731-93946", description: "WALL ERECTION",
    unit: "SFT", lowPrice: 15.0, averagePrice: 20.85,
    highPrice: 35.41, totalQuantity: 87122,
  },
  {
    payItemNumber: "731-93947", description: "LEVELING PAD, CONCRETE",
    unit: "LFT", lowPrice: 29.48, averagePrice: 44.43,
    highPrice: 93.04, totalQuantity: 5182,
  },
  {
    payItemNumber: "732-11770", description: "AGGREGATE FOR DRAINAGE FILL",
    unit: "CYS", lowPrice: 45.0, averagePrice: 81.79,
    highPrice: 119.0, totalQuantity: 61,
  },
  {
    payItemNumber: "732-11810", description: "MODULAR BLOCK WALL",
    unit: "SFT", lowPrice: 15.0, averagePrice: 24.0,
    highPrice: 28.0, totalQuantity: 1083,
  },
  {
    payItemNumber: "732-11811", description: "MODULAR BLOCK WALL ERECTION",
    unit: "SFT", lowPrice: 20.0, averagePrice: 31.95,
    highPrice: 43.5, totalQuantity: 2621,
  },
  {
    payItemNumber: "732-11812", description: "MODULAR BLOCK WALL WITH GROUND REINFORCEMENT",
    unit: "SFT", lowPrice: 24.97, averagePrice: 31.97,
    highPrice: 47.0, totalQuantity: 1538,
  },
  {
    payItemNumber: "734-10240", description: "CUT-WALL, NO.",
    unit: "SFT", lowPrice: 175.0, averagePrice: 196.95,
    highPrice: 500.0, totalQuantity: 3110,
  },
  {
    payItemNumber: "734-11760", description: "PLAN SUBMITTAL",
    unit: "EACH", lowPrice: 3000.0, averagePrice: 13875.0,
    highPrice: 46000.0, totalQuantity: 4,
  },
  {
    payItemNumber: "735-10241", description: "TEMPORARY WIRE-FACING",
    unit: "SFT", lowPrice: 40.0, averagePrice: 40.0,
    highPrice: 40.0, totalQuantity: 3376,
  },
  {
    payItemNumber: "735-10242", description: "TEMPORARY WALL ERECTION",
    unit: "SFT", lowPrice: 12.0, averagePrice: 12.0,
    highPrice: 12.0, totalQuantity: 3376,
  },
  {
    payItemNumber: "738-12855", description: "WARRANTED POLYMER OVERLAY, BRIDGE DECK",
    unit: "SYS", lowPrice: 36.7, averagePrice: 46.66,
    highPrice: 105.04, totalQuantity: 65233,
  },
  {
    payItemNumber: "738-12856", description: "POLYMER OVERLAY, OTHER CONCRETE SURFACE",
    unit: "SYS", lowPrice: 23.0, averagePrice: 42.3,
    highPrice: 83.2, totalQuantity: 4835,
  },
  {
    payItemNumber: "738-12917", description: "BRIDGE DECK, REMOVE EXISTING POLYMER OVERLAY SYSTEM",
    unit: "SYS", lowPrice: 1.05, averagePrice: 3.57,
    highPrice: 13.5, totalQuantity: 10852,
  },
  {
    payItemNumber: "801-000137", description: "TEMPORARY PAVEMENT MESSAGE MARKING, REMOVABLE",
    unit: "EACH", lowPrice: 85.0, averagePrice: 792.5,
    highPrice: 1500.0, totalQuantity: 30,
  },
  {
    payItemNumber: "801-000138", description: "SMART ARROW BOARD",
    unit: "DAY", lowPrice: 35.0, averagePrice: 35.0,
    highPrice: 35.0, totalQuantity: 840,
  },
  {
    payItemNumber: "801-000190", description: "TEMPORARY PAVEMENT MARKING, REMOVABLE, 36 IN.",
    unit: "LFT", lowPrice: 28.91, averagePrice: 28.91,
    highPrice: 28.91, totalQuantity: 80,
  },
  {
    payItemNumber: "801-000209", description: "CONNECTED WORK ZONE LOCATION MARKERS",
    unit: "EACH", lowPrice: 32.5, averagePrice: 63.84,
    highPrice: 11345.0, totalQuantity: 722,
  },
  {
    payItemNumber: "801-01504", description: "TEMPORARY PAVEMENT MESSAGE MARKING, LANE INDICATION ARROW",
    unit: "EACH", lowPrice: 75.0, averagePrice: 141.25,
    highPrice: 500.0, totalQuantity: 502,
  },
  {
    payItemNumber: "801-01505", description: "TEMPORARY PAVEMENT MESSAGE MARKING, 'ONLY'",
    unit: "EACH", lowPrice: 125.0, averagePrice: 162.0,
    highPrice: 210.0, totalQuantity: 9,
  },
  {
    payItemNumber: "801-01506", description: "TEMPORARY PAVEMENT MESSAGE MARKING, 'R X R'",
    unit: "EACH", lowPrice: 500.0, averagePrice: 588.6,
    highPrice: 681.0, totalQuantity: 5,
  },
  {
    payItemNumber: "801-02595", description: "CONTROLLER, RESET TIMING",
    unit: "EACH", lowPrice: 100.0, averagePrice: 442.3,
    highPrice: 1049.12, totalQuantity: 17,
  },
  {
    payItemNumber: "801-03290", description: "CONSTRUCTION SIGN, TYPE C",
    unit: "EACH", lowPrice: 56.0, averagePrice: 238.86,
    highPrice: 600.0, totalQuantity: 268,
  },
  {
    payItemNumber: "801-03291", description: "CONSTRUCTION SIGN, TYPE D",
    unit: "EACH", lowPrice: 85.0, averagePrice: 189.82,
    highPrice: 600.0, totalQuantity: 179,
  },
  {
    payItemNumber: "801-03621", description: "TEMPORARY ILLUMINATION",
    unit: "LS", lowPrice: 3500.0, averagePrice: 3500.0,
    highPrice: 3500.0, totalQuantity: 1,
  },
  {
    payItemNumber: "801-04308", description: "ROAD CLOSURE SIGN ASSEMBLY",
    unit: "EACH", lowPrice: 81.0, averagePrice: 277.23,
    highPrice: 750.0, totalQuantity: 1925,
  },
  {
    payItemNumber: "801-06196", description: "DETOUR ROUTE MARKER ASSEMBLY, MULTIPLE ROUTES",
    unit: "EACH", lowPrice: 95.0, averagePrice: 190.88,
    highPrice: 368.0, totalQuantity: 153,
  },
  {
    payItemNumber: "801-06198", description: "PATROLLER",
    unit: "DAY", lowPrice: 1.0, averagePrice: 1305.51,
    highPrice: 2485.0, totalQuantity: 2065,
  },
  {
    payItemNumber: "801-06201", description: "TEMPORARY PANEL SIGNS",
    unit: "SFT", lowPrice: 74.1, averagePrice: 74.15,
    highPrice: 75.0, totalQuantity: 2347,
  },
  {
    payItemNumber: "801-06202", description: "TEMPORARY PANEL SIGN SUPPORTS",
    unit: "LFT", lowPrice: 50.0, averagePrice: 81.53,
    highPrice: 83.0, totalQuantity: 1345,
  },
  {
    payItemNumber: "801-06203", description: "TEMPORARY PAVEMENT MARKING, 4 IN.",
    unit: "LFT", lowPrice: 0.08, averagePrice: 0.3,
    highPrice: 12.0, totalQuantity: 843835,
  },
  {
    payItemNumber: "801-06204", description: "TEMPORARY PAVEMENT MARKING, 5 IN.",
    unit: "LFT", lowPrice: 0.1, averagePrice: 0.22,
    highPrice: 0.6, totalQuantity: 6880,
  },
  {
    payItemNumber: "801-06206", description: "TEMPORARY PAVEMENT MARKING, 6 IN.",
    unit: "LFT", lowPrice: 0.01, averagePrice: 0.29,
    highPrice: 2.5, totalQuantity: 5078315,
  },
  {
    payItemNumber: "801-06207", description: "TEMPORARY PAVEMENT MARKING, REMOVABLE, 4 IN.",
    unit: "LFT", lowPrice: 0.1, averagePrice: 1.02,
    highPrice: 5.0, totalQuantity: 1401609,
  },
  {
    payItemNumber: "801-06208", description: "TEMPORARY PAVEMENT MARKING, REMOVABLE, 5 IN.",
    unit: "LFT", lowPrice: 1.0, averagePrice: 2.0,
    highPrice: 2.55, totalQuantity: 20696,
  },
  {
    payItemNumber: "801-06209", description: "TEMPORARY PAVEMENT MARKING, REMOVABLE, 6 IN.",
    unit: "LFT", lowPrice: 0.1, averagePrice: 1.4,
    highPrice: 6.0, totalQuantity: 5282061,
  },
  {
    payItemNumber: "801-06211", description: "TEMPORARY PAVEMENT MESSAGE MARKING, REMOVABLE, LANE INDICATI ON ARROW",
    unit: "EACH", lowPrice: 5.65, averagePrice: 121.62,
    highPrice: 220.0, totalQuantity: 1114,
  },
  {
    payItemNumber: "801-06212", description: "TEMPORARY PAVEMENT MESSAGE MARKING, REMOVABLE, (ONLY)",
    unit: "EACH", lowPrice: 168.0, averagePrice: 206.94,
    highPrice: 250.0, totalQuantity: 18,
  },
  {
    payItemNumber: "801-06213", description: "TEMPORARY PAVEMENT MESSAGE MARKING, REMOVABLE, (RXR)",
    unit: "EACH", lowPrice: 200.0, averagePrice: 857.44,
    highPrice: 1341.0, totalQuantity: 16,
  },
  {
    payItemNumber: "801-06214", description: "TEMPORARY TRANSVERSE PAVEMENT MARKING, 6 IN.",
    unit: "LFT", lowPrice: 0.65, averagePrice: 3.42,
    highPrice: 7.0, totalQuantity: 17718,
  },
  {
    payItemNumber: "801-06216", description: "TEMPORARY TRANSVERSE PAVEMENT MARKING, 24 IN.",
    unit: "LFT", lowPrice: 3.6, averagePrice: 8.3,
    highPrice: 20.0, totalQuantity: 9362,
  },
  {
    payItemNumber: "801-06217", description: "TEMPORARY TRANSVERSE PAVEMENT MARKING, REMOVABLE, 6 IN.",
    unit: "LFT", lowPrice: 0.1, averagePrice: 2.21,
    highPrice: 6.0, totalQuantity: 9280,
  },
  {
    payItemNumber: "801-06218", description: "TEMPORARY TRANSVERSE PAVEMENT MARKING, REMOVABLE, 24 IN.",
    unit: "LFT", lowPrice: 0.1, averagePrice: 12.16,
    highPrice: 25.0, totalQuantity: 20861,
  },
  {
    payItemNumber: "801-06469", description: "TEMPORARY PAVEMENT MARKING, REMOVABLE, 8 IN.",
    unit: "LFT", lowPrice: 1.75, averagePrice: 2.84,
    highPrice: 5.12, totalQuantity: 67665,
  },
  {
    payItemNumber: "801-06539", description: "TEMPORARY TRAFFIC SIGNAL INSTALLATION, MAINTAIN",
    unit: "LS", lowPrice: 175.0, averagePrice: 24601.82,
    highPrice: 92000.0, totalQuantity: 10,
  },
  {
    payItemNumber: "801-06577", description: "TEMPORARY PAVEMENT MARKING, REMOVABLE, 24 IN. , REMOVABLE, 24\"",
    unit: "LFT", lowPrice: 5.0, averagePrice: 9.28,
    highPrice: 20.0, totalQuantity: 1858,
  },
  {
    payItemNumber: "801-06586", description: "TEMPORARY PAVEMENT MARKING, 8 IN.",
    unit: "LFT", lowPrice: 0.4, averagePrice: 1.05,
    highPrice: 1.61, totalQuantity: 63559,
  },
  {
    payItemNumber: "801-06625", description: "DETOUR ROUTE MARKER ASSEMBLY",
    unit: "EACH", lowPrice: 65.0, averagePrice: 137.13,
    highPrice: 275.0, totalQuantity: 9703,
  },
  {
    payItemNumber: "801-06640", description: "CONSTRUCTION SIGN, TYPE A",
    unit: "EACH", lowPrice: 1.0, averagePrice: 216.69,
    highPrice: 1000.0, totalQuantity: 15834,
  },
  {
    payItemNumber: "801-06645", description: "CONSTRUCTION SIGN, TYPE B",
    unit: "EACH", lowPrice: 2.0, averagePrice: 112.27,
    highPrice: 950.0, totalQuantity: 4287,
  },
  {
    payItemNumber: "801-06649", description: "TEMPORARY RAISED PAVEMENT MARKER, GRADE 1",
    unit: "EACH", lowPrice: 3.85, averagePrice: 11.69,
    highPrice: 26.0, totalQuantity: 6301,
  },
  {
    payItemNumber: "801-06650", description: "TEMPORARY RAISED PAVEMENT MARKER, GRADE 2",
    unit: "EACH", lowPrice: 9.85, averagePrice: 10.09,
    highPrice: 25.33, totalQuantity: 6225,
  },
  {
    payItemNumber: "801-06710", description: "FLASHING ARROW SIGN",
    unit: "DAY", lowPrice: 1.0, averagePrice: 17.23,
    highPrice: 200.0, totalQuantity: 28511,
  },
  {
    payItemNumber: "801-06735", description: "TUBULAR MARKER, PERMANENT",
    unit: "EACH", lowPrice: 135.0, averagePrice: 229.58,
    highPrice: 575.0, totalQuantity: 107,
  },
  {
    payItemNumber: "801-06775", description: "MAINTAINING TRAFFIC",
    unit: "LS", lowPrice: 168.6, averagePrice: 133518.76,
    highPrice: 4000000.0, totalQuantity: 367,
  },
  {
    payItemNumber: "801-07023", description: "ENERGY ABSORBING TERMINAL, CZ, TL-2",
    unit: "EACH", lowPrice: 2500.0, averagePrice: 6787.58,
    highPrice: 16175.0, totalQuantity: 216,
  },
  {
    payItemNumber: "801-07024", description: "ENERGY ABSORBING TERMINAL, CZ, TL-3",
    unit: "EACH", lowPrice: 2000.0, averagePrice: 7572.51,
    highPrice: 23500.0, totalQuantity: 285,
  },
  {
    payItemNumber: "801-07118", description: "BARRICADE, TYPE III-A",
    unit: "LFT", lowPrice: 5.0, averagePrice: 16.4,
    highPrice: 40.0, totalQuantity: 38833,
  },
  {
    payItemNumber: "801-07119", description: "BARRICADE, TYPE III-B",
    unit: "LFT", lowPrice: 6.0, averagePrice: 16.22,
    highPrice: 40.0, totalQuantity: 34438,
  },
  {
    payItemNumber: "801-07606", description: "TEMPORARY CROSSOVER DRAINAGE PIPE",
    unit: "LFT", lowPrice: 67.7, averagePrice: 120.13,
    highPrice: 235.0, totalQuantity: 725,
  },
  {
    payItemNumber: "801-07612", description: "TEMPORARY PAVEMENT MARKING, 24 IN.",
    unit: "LFT", lowPrice: 9.1, averagePrice: 11.3,
    highPrice: 13.0, totalQuantity: 987,
  },
  {
    payItemNumber: "801-08400", description: "TEMPORARY TRAFFIC BARRIER, TYPE 1",
    unit: "LFT", lowPrice: 10.0, averagePrice: 32.76,
    highPrice: 52.0, totalQuantity: 60821,
  },
  {
    payItemNumber: "801-08401", description: "TEMPORARY TRAFFIC BARRIER, TYPE 2",
    unit: "LFT", lowPrice: 1.11, averagePrice: 41.33,
    highPrice: 126.0, totalQuantity: 244425,
  },
  {
    payItemNumber: "801-08403", description: "TEMPORARY TRAFFIC BARRIER, TYPE 4",
    unit: "LFT", lowPrice: 0.01, averagePrice: 7.21,
    highPrice: 25.0, totalQuantity: 2576,
  },
  {
    payItemNumber: "801-08507", description: "TEMPORARY TRAFFIC BARRIER, ANCHORED, TYPE 1",
    unit: "LFT", lowPrice: 10.0, averagePrice: 20.43,
    highPrice: 90.0, totalQuantity: 460,
  },
  {
    payItemNumber: "801-08508", description: "TEMPORARY TRAFFIC BARRIER, ANCHORED, TYPE 2",
    unit: "LFT", lowPrice: 10.0, averagePrice: 45.02,
    highPrice: 137.0, totalQuantity: 90292,
  },
  {
    payItemNumber: "801-08509", description: "TEMPORARY TRAFFIC BARRIER, ANCHORED, TYPE 3",
    unit: "LFT", lowPrice: 94.34, averagePrice: 94.34,
    highPrice: 94.34, totalQuantity: 210,
  },
  {
    payItemNumber: "801-09087", description: "TEMPORARY PAVEMENT MARKING, REMOVABLE, 12 IN.",
    unit: "LFT", lowPrice: 4.0, averagePrice: 4.0,
    highPrice: 4.0, totalQuantity: 628,
  },
  {
    payItemNumber: "801-11642", description: "PORTABLE CHANGEABLE MESSAGE SIGN",
    unit: "EACH", lowPrice: 850.0, averagePrice: 4664.06,
    highPrice: 21515.0, totalQuantity: 551,
  },
  {
    payItemNumber: "801-11661", description: "TEMPORARY TRANSVERSE PAVEMENT MARKING, 8 IN.",
    unit: "LFT", lowPrice: 1.0, averagePrice: 1.0,
    highPrice: 1.0, totalQuantity: 400,
  },
  {
    payItemNumber: "801-11662", description: "TEMPORARY TRANSVERSE PAVEMENT MARKING, REMOVEABLE, 12 IN.",
    unit: "LFT", lowPrice: 1.5, averagePrice: 3.09,
    highPrice: 3.48, totalQuantity: 226,
  },
  {
    payItemNumber: "801-11692", description: "TEMPORARY PAVEMENT MARKING, 12 IN.",
    unit: "LFT", lowPrice: 3.44, averagePrice: 3.44,
    highPrice: 3.44, totalQuantity: 496,
  },
  {
    payItemNumber: "801-11880", description: "VEHICLES FOR ADVANCED SLOWDOWN",
    unit: "DAY", lowPrice: 1619.31, averagePrice: 2434.66,
    highPrice: 3250.0, totalQuantity: 16,
  },
  {
    payItemNumber: "801-11990", description: "TEMPORARY CURB RAMP",
    unit: "EACH", lowPrice: 373.48, averagePrice: 2047.5,
    highPrice: 7500.0, totalQuantity: 249,
  },
  {
    payItemNumber: "801-12031", description: "TEMPORARY PORTABLE RUMBLE STRIPS",
    unit: "DAY", lowPrice: 10.0, averagePrice: 20.0,
    highPrice: 22.5, totalQuantity: 1800,
  },
  {
    payItemNumber: "801-12042", description: "TRUCK MOUNTED ATTENUATOR",
    unit: "DAY", lowPrice: 1.0, averagePrice: 289.75,
    highPrice: 5000.0, totalQuantity: 7387,
  },
  {
    payItemNumber: "801-12081", description: "PORTABLE SIGNAL",
    unit: "LS", lowPrice: 5000.0, averagePrice: 27648.26,
    highPrice: 95000.0, totalQuantity: 42,
  },
  {
    payItemNumber: "801-12082", description: "FIXED TEMPORARY SIGNAL",
    unit: "LS", lowPrice: 34640.36, averagePrice: 60537.59,
    highPrice: 83510.0, totalQuantity: 4,
  },
  {
    payItemNumber: "801-12324", description: "LAW ENFORCEMENT OFFICER",
    unit: "HRS", lowPrice: 60.0, averagePrice: 60.0,
    highPrice: 60.0, totalQuantity: 29938,
  },
  {
    payItemNumber: "801-12388", description: "TEMPORARY PAVEMENT MARKING, REMOVABLE, 9 IN.",
    unit: "LFT", lowPrice: 4.25, averagePrice: 4.25,
    highPrice: 4.25, totalQuantity: 32540,
  },
  {
    payItemNumber: "801-12389", description: "TEMPORARY PAVEMENT MARKING, REMOVABLE, 25 IN.",
    unit: "LFT", lowPrice: 13.34, averagePrice: 13.34,
    highPrice: 13.34, totalQuantity: 2,
  },
  {
    payItemNumber: "801-12390", description: "TEMPORARY PAVEMENT MARKING, REMOVABLE, 7 IN.",
    unit: "LFT", lowPrice: 2.19, averagePrice: 2.78,
    highPrice: 3.88, totalQuantity: 23553,
  },
  {
    payItemNumber: "801-12391", description: "TEMPORARY PAVEMENT MARKING, REMOVABLE, 13 IN.",
    unit: "LFT", lowPrice: 4.45, averagePrice: 4.71,
    highPrice: 12.88, totalQuantity: 1635,
  },
  {
    payItemNumber: "801-12392", description: "TEMPORARY PAVEMENT MARKING, REMOVABLE, 28 IN.",
    unit: "LFT", lowPrice: 8.9, averagePrice: 10.2,
    highPrice: 16.55, totalQuantity: 512,
  },
  {
    payItemNumber: "801-12393", description: "TEMPORARY PAVEMENT MARKING, REMOVABLE, 37 IN.",
    unit: "LFT", lowPrice: 31.25, averagePrice: 31.25,
    highPrice: 31.25, totalQuantity: 16,
  },
  {
    payItemNumber: "801-12421", description: "AUTOMATED WORK ZONE INFORMATION SYSTEM",
    unit: "LS", lowPrice: 85000.0, averagePrice: 85000.0,
    highPrice: 85000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "801-12482", description: "DRIVEWAY ASSISTANCE DEVICE",
    unit: "EACH", lowPrice: 1200.0, averagePrice: 4872.97,
    highPrice: 15000.0, totalQuantity: 56,
  },
  {
    payItemNumber: "801-12503", description: "TEMPORARY TRAFFIC BARRIER, RELOCATE",
    unit: "LFT", lowPrice: 45.6, averagePrice: 45.6,
    highPrice: 45.6, totalQuantity: 8140,
  },
  {
    payItemNumber: "801-12544", description: "AUTOMATED WORK ZONE INFORMATION SYSTEM",
    unit: "EACH", lowPrice: 100.0, averagePrice: 5350.81,
    highPrice: 74251.0, totalQuantity: 118,
  },
  {
    payItemNumber: "801-12594", description: "DIGITAL SPEED LIMIT SIGN ASSEMBLY",
    unit: "EACH", lowPrice: 1042.0, averagePrice: 1160.29,
    highPrice: 1249.0, totalQuantity: 14,
  },
  {
    payItemNumber: "801-12641", description: "TEMPORARY ACCESSIBLE PEDESTRIAN PATH",
    unit: "SYS", lowPrice: 15.0, averagePrice: 74.03,
    highPrice: 435.0, totalQuantity: 1888,
  },
  {
    payItemNumber: "801-12652", description: "QUEUE TRUCK",
    unit: "DAY", lowPrice: 1075.0, averagePrice: 1249.92,
    highPrice: 4000.0, totalQuantity: 996,
  },
  {
    payItemNumber: "801-12832", description: "TEMPORARY SPEED FEEDBACK ASSEMBLY",
    unit: "EACH", lowPrice: 250.0, averagePrice: 1359.77,
    highPrice: 4000.0, totalQuantity: 86,
  },
  {
    payItemNumber: "801-12862", description: "TEMPORARY PEDESTRIAN CHANNELIZER",
    unit: "LFT", lowPrice: 3.0, averagePrice: 25.08,
    highPrice: 148.68, totalQuantity: 24402,
  },
  {
    payItemNumber: "801-12863", description: "AUDIBLE INFORMATION DEVICE",
    unit: "EACH", lowPrice: 200.0, averagePrice: 332.48,
    highPrice: 1002.11, totalQuantity: 34,
  },
  {
    payItemNumber: "801-12883", description: "TEMPORARY WORKSITE SPEED LIMIT SIGN ASSEMBLY, CONTINUOUS",
    unit: "EACH", lowPrice: 10.0, averagePrice: 814.03,
    highPrice: 3988.0, totalQuantity: 676,
  },
  {
    payItemNumber: "801-12930", description: "TEMPORARY WORKSITE SPEED LIMIT SIGN ASSEMBLY, INTERMITTENT",
    unit: "EACH", lowPrice: 50.0, averagePrice: 1056.28,
    highPrice: 3000.0, totalQuantity: 176,
  },
  {
    payItemNumber: "801-12955", description: "TEMPORARY PAVEMENT MARKING, 10 IN.",
    unit: "LFT", lowPrice: 0.5, averagePrice: 1.3,
    highPrice: 1.64, totalQuantity: 80079,
  },
  {
    payItemNumber: "801-12956", description: "TEMPORARY PAVEMENT MARKING, REMOVABLE, 10 IN.",
    unit: "LFT", lowPrice: 2.73, averagePrice: 3.5,
    highPrice: 5.58, totalQuantity: 56180,
  },
  {
    payItemNumber: "801-52817", description: "TEMPORARY CROSSOVER, TYPE B",
    unit: "EACH", lowPrice: 4500.0, averagePrice: 119313.1,
    highPrice: 230000.0, totalQuantity: 13,
  },
  {
    payItemNumber: "801-92448", description: "CONSTRUCTION SIGNS MOBILE",
    unit: "DAY", lowPrice: 1.0, averagePrice: 5.47,
    highPrice: 250.0, totalQuantity: 6598,
  },
  {
    payItemNumber: "801-94295", description: "SIGNAL HEAD RELOCATE",
    unit: "EACH", lowPrice: 418.8, averagePrice: 652.21,
    highPrice: 2500.0, totalQuantity: 262,
  },
  {
    payItemNumber: "801-97643", description: "TEMPORARY BUZZ STRIPS",
    unit: "LFT", lowPrice: 1.0, averagePrice: 16.95,
    highPrice: 29.55, totalQuantity: 53332,
  },
  {
    payItemNumber: "802-01946", description: "SIGN POST, TIMBER, 6 IN. X 8 IN.",
    unit: "LFT", lowPrice: 94.1, averagePrice: 94.1,
    highPrice: 94.1, totalQuantity: 126,
  },
  {
    payItemNumber: "802-02158", description: "SIGN, PANEL, REMOVE AND REINSTALL",
    unit: "EACH", lowPrice: 2000.0, averagePrice: 2000.0,
    highPrice: 2000.0, totalQuantity: 2,
  },
  {
    payItemNumber: "802-02475", description: "SIGN, PANEL, RELOCATE",
    unit: "EACH", lowPrice: 200.0, averagePrice: 1747.04,
    highPrice: 3735.0, totalQuantity: 24,
  },
  {
    payItemNumber: "802-03126", description: "SIGN, OVERHEAD, RELOCATE",
    unit: "EACH", lowPrice: 503.0, averagePrice: 591.62,
    highPrice: 1500.0, totalQuantity: 45,
  },
  {
    payItemNumber: "802-03776", description: "SIGN POST, TIMBER, 6 IN. X 6 IN.",
    unit: "LFT", lowPrice: 45.0, averagePrice: 56.92,
    highPrice: 84.9, totalQuantity: 221,
  },
  {
    payItemNumber: "802-03783", description: "SIGN, PANEL, REMOVE",
    unit: "EACH", lowPrice: 2248.0, averagePrice: 2248.0,
    highPrice: 2248.0, totalQuantity: 8,
  },
  {
    payItemNumber: "802-03821", description: "SIGN, SHEET, WITH LEGEND",
    unit: "EACH", lowPrice: 30.0, averagePrice: 259.82,
    highPrice: 400.0, totalQuantity: 11,
  },
  {
    payItemNumber: "802-03896", description: "BOLLARD",
    unit: "EACH", lowPrice: 1609.38, averagePrice: 3590.41,
    highPrice: 5358.36, totalQuantity: 350,
  },
  {
    payItemNumber: "802-04089", description: "SIGN, SHEET, REMOVE",
    unit: "EACH", lowPrice: 25.0, averagePrice: 108.97,
    highPrice: 350.0, totalQuantity: 346,
  },
  {
    payItemNumber: "802-04314", description: "SIGN",
    unit: "EACH", lowPrice: 6500.0, averagePrice: 12968.75,
    highPrice: 45000.0, totalQuantity: 16,
  },
  {
    payItemNumber: "802-04893", description: "REFERENCE POST",
    unit: "EACH", lowPrice: 150.0, averagePrice: 691.1,
    highPrice: 2000.0, totalQuantity: 232,
  },
  {
    payItemNumber: "802-05701", description: "SIGN POST, SQUARE, TYPE 1, REINFORCED ANCHOR BASE",
    unit: "LFT", lowPrice: 14.0, averagePrice: 32.53,
    highPrice: 145.0, totalQuantity: 26564,
  },
  {
    payItemNumber: "802-05702", description: "SIGN POST, SQUARE, TYPE 2, REINFORCED ANCHOR BASE",
    unit: "LFT", lowPrice: 17.0, averagePrice: 31.2,
    highPrice: 50.0, totalQuantity: 4107,
  },
  {
    payItemNumber: "802-05703", description: "SIGN POST, SQUARE, TYPE 3, REINFORCED ANCHOR BASE",
    unit: "LFT", lowPrice: 32.96, averagePrice: 41.66,
    highPrice: 47.8, totalQuantity: 399,
  },
  {
    payItemNumber: "802-05704", description: "SIGN POST, SQUARE, TYPE 1, UNREINFORCED ANCHOR BASE",
    unit: "LFT", lowPrice: 18.75, averagePrice: 29.7,
    highPrice: 105.0, totalQuantity: 6984,
  },
  {
    payItemNumber: "802-05705", description: "SIGN POST, SQUARE, TYPE 2, UNREINFORCED ANCHOR BASE",
    unit: "LFT", lowPrice: 17.0, averagePrice: 28.76,
    highPrice: 55.0, totalQuantity: 1570,
  },
  {
    payItemNumber: "802-05706", description: "SIGN POST, SQUARE, TYPE 3, UNREINFORCED ANCHOR BASE",
    unit: "LFT", lowPrice: 27.0, averagePrice: 35.28,
    highPrice: 115.0, totalQuantity: 694,
  },
  {
    payItemNumber: "802-06402", description: "DYNAMIC MESSAGE SIGN",
    unit: "EACH", lowPrice: 110000.0, averagePrice: 110000.0,
    highPrice: 110000.0, totalQuantity: 7,
  },
  {
    payItemNumber: "802-07057", description: "SIGN, PANEL, WITH LEGEND",
    unit: "SFT", lowPrice: 34.45, averagePrice: 44.65,
    highPrice: 115.0, totalQuantity: 11401,
  },
  {
    payItemNumber: "802-07058", description: "SIGN, SHEET ASSEMBLY, RELOCATE",
    unit: "EACH", lowPrice: 150.0, averagePrice: 574.12,
    highPrice: 723.0, totalQuantity: 34,
  },
  {
    payItemNumber: "802-07059", description: "SIGN, SHEET, AND SUPPORTS, REMOVE",
    unit: "EACH", lowPrice: 35.0, averagePrice: 98.33,
    highPrice: 631.0, totalQuantity: 1256,
  },
  {
    payItemNumber: "802-07060", description: "SIGN, SHEET, RELOCATE",
    unit: "EACH", lowPrice: 75.0, averagePrice: 266.41,
    highPrice: 774.0, totalQuantity: 421,
  },
  {
    payItemNumber: "802-07061", description: "OVERHEAD SIGN STRUCTURE, BOX TRUSS, DMS",
    unit: "EACH", lowPrice: 159669.0, averagePrice: 159669.0,
    highPrice: 159669.0, totalQuantity: 2,
  },
  {
    payItemNumber: "802-09221", description: "OVERHEAD SIGN STRUCTURE, BOX TRUSS, TYPE A",
    unit: "EACH", lowPrice: 132692.0, averagePrice: 132692.0,
    highPrice: 132692.0, totalQuantity: 3,
  },
  {
    payItemNumber: "802-09222", description: "OVERHEAD SIGN STRUCTURE, BOX TRUSS, TYPE B",
    unit: "EACH", lowPrice: 153337.0, averagePrice: 153337.0,
    highPrice: 153337.0, totalQuantity: 4,
  },
  {
    payItemNumber: "802-09224", description: "OVERHEAD SIGN STRUCTURE, BOX TRUSS, TYPE D",
    unit: "EACH", lowPrice: 169066.0, averagePrice: 169066.0,
    highPrice: 169066.0, totalQuantity: 2,
  },
  {
    payItemNumber: "802-09536", description: "BOX TRUSS SIGN STRUCTURE FOUNDATION, 45 IN. CONCRETE BARRIER  WALL",
    unit: "EACH", lowPrice: 51670.2, averagePrice: 54994.86,
    highPrice: 59427.75, totalQuantity: 7,
  },
  {
    payItemNumber: "802-09537", description: "BOX TRUSS SIGN STRUCTURE FOUNDATION, 36 IN. MEDIAN OR SHOULD ER",
    unit: "EACH", lowPrice: 50125.0, averagePrice: 50206.82,
    highPrice: 50215.0, totalQuantity: 11,
  },
  {
    payItemNumber: "802-09577", description: "OVERHEAD SIGN STRUCTURE, CANTILEVER, TYPE E",
    unit: "EACH", lowPrice: 90000.0, averagePrice: 90000.0,
    highPrice: 90000.0, totalQuantity: 4,
  },
  {
    payItemNumber: "802-09578", description: "OVERHEAD SIGN STRUCTURE, CANTILEVER, TYPE F",
    unit: "EACH", lowPrice: 62038.0, averagePrice: 62038.0,
    highPrice: 62038.0, totalQuantity: 8,
  },
  {
    payItemNumber: "802-09581", description: "CANTILEVER SIGN SUPPORT FOUNDATION, DRILLED SHAFT 36 IN. DRILLED SHAFT, 36 IN",
    unit: "EACH", lowPrice: 20000.0, averagePrice: 30180.67,
    highPrice: 35271.0, totalQuantity: 12,
  },
  {
    payItemNumber: "802-09837", description: "SIGN, DOUBLE-FACED, SHEET, WITH LEGEND, 0.080 IN. THICKNESS THICKNESS",
    unit: "SFT", lowPrice: 30.0, averagePrice: 62.52,
    highPrice: 75.0, totalQuantity: 52,
  },
  {
    payItemNumber: "802-09838", description: "SIGN, SHEET, WITH LEGEND, 0.080 IN. THICKNESS THICKNESS",
    unit: "SFT", lowPrice: 15.0, averagePrice: 33.77,
    highPrice: 225.0, totalQuantity: 14580,
  },
  {
    payItemNumber: "802-09839", description: "SIGN, DOUBLE-FACED, SHEET, WITH LEGEND, 0.100 IN. THICKNESS THICKNESS",
    unit: "SFT", lowPrice: 25.0, averagePrice: 36.46,
    highPrice: 53.0, totalQuantity: 111,
  },
  {
    payItemNumber: "802-09840", description: "SIGN, SHEET, WITH LEGEND, 0.100 IN. THICKNESS THICKNESS",
    unit: "SFT", lowPrice: 18.0, averagePrice: 33.1,
    highPrice: 69.87, totalQuantity: 15953,
  },
  {
    payItemNumber: "802-09841", description: "SIGN, DOUBLE-FACED, SHEET, WITH LEGEND, 0.125 IN. THICKNESS THICKNESS",
    unit: "SFT", lowPrice: 42.0, averagePrice: 42.0,
    highPrice: 42.0, totalQuantity: 349,
  },
  {
    payItemNumber: "802-09842", description: "SIGN, SHEET, WITH LEGEND, 0.125 IN. THICKNESS THICKNESS",
    unit: "SFT", lowPrice: 28.4, averagePrice: 38.47,
    highPrice: 55.0, totalQuantity: 3584,
  },
  {
    payItemNumber: "802-09860", description: "OVERHEAD SIGN STRUCTURE, CANTILEVER, TYPE H",
    unit: "EACH", lowPrice: 79040.0, averagePrice: 79040.0,
    highPrice: 79040.0, totalQuantity: 1,
  },
  {
    payItemNumber: "802-09897", description: "BOX TRUSS SIGN STRUCTURE FOUNDATION, DMS 45 IN. HEIGHT",
    unit: "EACH", lowPrice: 51670.2, averagePrice: 51670.2,
    highPrice: 51670.2, totalQuantity: 2,
  },
  {
    payItemNumber: "802-09898", description: "BOX TRUSS SIGN STRUCTURE FOUNDATION, DMS 36 IN. HEIGHT",
    unit: "EACH", lowPrice: 50215.0, averagePrice: 50215.0,
    highPrice: 50215.0, totalQuantity: 2,
  },
  {
    payItemNumber: "802-10181", description: "OVERHEAD SIGN STRUCTURE, TRI-CHORD, TYPE A",
    unit: "EACH", lowPrice: 93658.25, averagePrice: 93658.25,
    highPrice: 93658.25, totalQuantity: 1,
  },
  {
    payItemNumber: "802-10183", description: "OVERHEAD SIGN STRUCTURE, TRI-CHORD, TYPE C",
    unit: "EACH", lowPrice: 113902.93, averagePrice: 113902.93,
    highPrice: 113902.93, totalQuantity: 1,
  },
  {
    payItemNumber: "802-10194", description: "TRI-CHORD SIGN STRUCTURE FOUNDATION, DRILLED SHAFT",
    unit: "EACH", lowPrice: 18215.81, averagePrice: 18215.81,
    highPrice: 18215.81, totalQuantity: 4,
  },
  {
    payItemNumber: "802-11649", description: "SIGN FOUNDATION",
    unit: "EACH", lowPrice: 4295.0, averagePrice: 5120.16,
    highPrice: 5945.31, totalQuantity: 2,
  },
  {
    payItemNumber: "802-11843", description: "RADAR SPEED DISPLAY SIGN ASSEMBLY",
    unit: "EACH", lowPrice: 16250.0, averagePrice: 16250.0,
    highPrice: 16250.0, totalQuantity: 1,
  },
  {
    payItemNumber: "802-11886", description: "CANTILEVER SIGN SUPPORT FOUNDATION, DRILLED SHAFT 48 IN. DRILLED SHAFT, 48 IN",
    unit: "EACH", lowPrice: 16630.0, averagePrice: 22843.67,
    highPrice: 35271.0, totalQuantity: 3,
  },
  {
    payItemNumber: "802-12222", description: "WIDE FLANGE SIGN POST SUPPORT FOUNDATION, TYPE A",
    unit: "EACH", lowPrice: 1526.57, averagePrice: 2120.7,
    highPrice: 5000.0, totalQuantity: 66,
  },
  {
    payItemNumber: "802-12223", description: "WIDE FLANGE SIGN POST SUPPORT FOUNDATION, TYPE B",
    unit: "EACH", lowPrice: 1998.09, averagePrice: 3318.89,
    highPrice: 4750.0, totalQuantity: 54,
  },
  {
    payItemNumber: "802-12224", description: "WIDE FLANGE SIGN POST SUPPORT FOUNDATION, TYPE C",
    unit: "EACH", lowPrice: 5000.0, averagePrice: 5000.0,
    highPrice: 5000.0, totalQuantity: 2,
  },
  {
    payItemNumber: "802-12548", description: "OVERHEAD SIGN STRUCTURE, BOX TRUSS, TYPE F",
    unit: "EACH", lowPrice: 185355.0, averagePrice: 185355.0,
    highPrice: 185355.0, totalQuantity: 1,
  },
  {
    payItemNumber: "802-12581", description: "BOX TRUSS SIGN STRUCTURE FOUNDATION, 36 IN. MEDIAN OR SHOULD ER, FGH",
    unit: "EACH", lowPrice: 52579.0, averagePrice: 52579.0,
    highPrice: 52579.0, totalQuantity: 1,
  },
  {
    payItemNumber: "802-12582", description: "BOX TRUSS SIGN STRUCTURE FOUNDATION, 45 IN. CONCRETE BARRIER  WALL, FGH",
    unit: "EACH", lowPrice: 52822.16, averagePrice: 52822.16,
    highPrice: 52822.16, totalQuantity: 1,
  },
  {
    payItemNumber: "802-12648", description: "ITS ROADSIDE BALANCED CANTILEVER STRUCTURE",
    unit: "EACH", lowPrice: 104000.0, averagePrice: 185000.0,
    highPrice: 212000.0, totalQuantity: 4,
  },
  {
    payItemNumber: "802-12649", description: "ITS ROADSIDE BALANCED CANTILEVER STRUCTURE FOUNDATION CONCRE TE WITH GROUNDING",
    unit: "EACH", lowPrice: 28000.0, averagePrice: 54250.0,
    highPrice: 63000.0, totalQuantity: 4,
  },
  {
    payItemNumber: "802-74040", description: "SIGN AND SUPPORTS, WIDE FLANGE, REMOVE",
    unit: "EACH", lowPrice: 900.0, averagePrice: 998.0,
    highPrice: 1012.0, totalQuantity: 16,
  },
  {
    payItemNumber: "802-74050", description: "SIGN, OVERHEAD, REMOVE",
    unit: "EACH", lowPrice: 31.61, averagePrice: 176.67,
    highPrice: 2248.0, totalQuantity: 147,
  },
  {
    payItemNumber: "802-74055", description: "OVERHEAD SIGN STRUCTURE, BOX TRUSS, REMOVE",
    unit: "EACH", lowPrice: 8500.0, averagePrice: 16833.82,
    highPrice: 22389.7, totalQuantity: 5,
  },
  {
    payItemNumber: "802-74070", description: "OVERHEAD SIGN STRUCTURE, CABLE SPAN, REMOVE",
    unit: "EACH", lowPrice: 3000.0, averagePrice: 3000.0,
    highPrice: 3000.0, totalQuantity: 8,
  },
  {
    payItemNumber: "802-74080", description: "OVERHEAD SIGN STRUCTURE, CANTILEVER, REMOVE",
    unit: "EACH", lowPrice: 3800.0, averagePrice: 3800.0,
    highPrice: 3800.0, totalQuantity: 1,
  },
  {
    payItemNumber: "802-76055", description: "SIGN POST, TYPE A",
    unit: "LFT", lowPrice: 10.05, averagePrice: 20.65,
    highPrice: 38.0, totalQuantity: 58,
  },
  {
    payItemNumber: "802-76065", description: "SIGN POST, TYPE B",
    unit: "LFT", lowPrice: 8.25, averagePrice: 8.25,
    highPrice: 8.25, totalQuantity: 149,
  },
  {
    payItemNumber: "802-76095", description: "STRUCTURAL STEEL, BREAKAWAY",
    unit: "LBS", lowPrice: 6.87, averagePrice: 11.71,
    highPrice: 20.0, totalQuantity: 25787,
  },
  {
    payItemNumber: "802-76100", description: "OVERHEAD SIGN STRUCTURE, MONOTUBE",
    unit: "EACH", lowPrice: 70000.0, averagePrice: 70000.0,
    highPrice: 70000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "802-76160", description: "OVERHEAD SIGN STRUCTURE, BRIDGE BRACKET ASSEMBLY",
    unit: "EACH", lowPrice: 6050.0, averagePrice: 8215.0,
    highPrice: 10380.0, totalQuantity: 4,
  },
  {
    payItemNumber: "802-91122", description: "SIGN, GROUND MOUNTED, RESET",
    unit: "EACH", lowPrice: 101.0, averagePrice: 329.22,
    highPrice: 2525.0, totalQuantity: 251,
  },
  {
    payItemNumber: "802-93388", description: "BARRIER WALL SIGN BRACKET ASSEMBLY MEDIAN",
    unit: "EACH", lowPrice: 4991.0, averagePrice: 4991.0,
    highPrice: 4991.0, totalQuantity: 2,
  },
  {
    payItemNumber: "802-94495", description: "OVERHEAD SIGN AND STRUCTURE, RELOCATE",
    unit: "EACH", lowPrice: 14059.0, averagePrice: 14059.0,
    highPrice: 14059.0, totalQuantity: 2,
  },
  {
    payItemNumber: "802-96994", description: "SIGN POST, TIMBER, 4 IN. X 6 IN.",
    unit: "LFT", lowPrice: 50.0, averagePrice: 50.0,
    highPrice: 50.0, totalQuantity: 42,
  },
  {
    payItemNumber: "802-97428", description: "SIGN POST, TUBULAR",
    unit: "LFT", lowPrice: 45.0, averagePrice: 45.0,
    highPrice: 45.0, totalQuantity: 36,
  },
  {
    payItemNumber: "802-97573", description: "ANGLE POST",
    unit: "EACH", lowPrice: 143.0, averagePrice: 143.0,
    highPrice: 143.0, totalQuantity: 1,
  },
  {
    payItemNumber: "802-99058", description: "SIGN SHEET, INSTALL",
    unit: "EACH", lowPrice: 180.34, averagePrice: 180.34,
    highPrice: 180.34, totalQuantity: 7,
  },
  {
    payItemNumber: "803-61430", description: "BRIDGE BRACKET A GALVANIZED",
    unit: "EACH", lowPrice: 76.0, averagePrice: 78.0,
    highPrice: 80.0, totalQuantity: 2,
  },
  {
    payItemNumber: "803-61440", description: "BRIDGE BRACKET B GALVANIZED",
    unit: "EACH", lowPrice: 76.0, averagePrice: 76.0,
    highPrice: 76.0, totalQuantity: 1,
  },
  {
    payItemNumber: "804-06725", description: "DELINEATOR WITH POST, TYPE D1",
    unit: "EACH", lowPrice: 350.0, averagePrice: 350.0,
    highPrice: 350.0, totalQuantity: 2,
  },
  {
    payItemNumber: "804-06740", description: "DELINEATOR WITH POST, TYPE D2",
    unit: "EACH", lowPrice: 222.22, averagePrice: 222.22,
    highPrice: 222.22, totalQuantity: 68,
  },
  {
    payItemNumber: "804-06770", description: "DELINEATOR POST",
    unit: "EACH", lowPrice: 31.0, averagePrice: 237.96,
    highPrice: 400.0, totalQuantity: 126,
  },
  {
    payItemNumber: "804-11353", description: "LANE SEPARATOR",
    unit: "LFT", lowPrice: 57.5, averagePrice: 105.75,
    highPrice: 445.0, totalQuantity: 858,
  },
  {
    payItemNumber: "804-11920", description: "DELINEATOR POST, FLEXIBLE, TYPE I",
    unit: "EACH", lowPrice: 25.34, averagePrice: 122.45,
    highPrice: 1500.0, totalQuantity: 383,
  },
  {
    payItemNumber: "804-11921", description: "DELINEATOR POST, FLEXIBLE, TYPE II",
    unit: "EACH", lowPrice: 25.43, averagePrice: 54.72,
    highPrice: 84.01, totalQuantity: 12,
  },
  {
    payItemNumber: "804-97955", description: "DELINEATOR POST, FLEXIBLE, RESET",
    unit: "EACH", lowPrice: 46.0, averagePrice: 79.52,
    highPrice: 110.0, totalQuantity: 21,
  },
  {
    payItemNumber: "805-01300", description: "TRAFFIC SIGNAL EQUIPMENT, REMOVE",
    unit: "EACH", lowPrice: 247.02, averagePrice: 2251.94,
    highPrice: 17860.4, totalQuantity: 249,
  },
  {
    payItemNumber: "805-01439", description: "MICROWAVE DETECTOR",
    unit: "EACH", lowPrice: 7600.0, averagePrice: 7933.33,
    highPrice: 8600.0, totalQuantity: 6,
  },
  {
    payItemNumber: "805-01479", description: "CONTROLLER CABINET FOUNDATION, TYPE P1, MODIFIED",
    unit: "EACH", lowPrice: 3200.0, averagePrice: 3242.86,
    highPrice: 3500.0, totalQuantity: 7,
  },
  {
    payItemNumber: "805-01579", description: "MISCELLANEOUS EQUIPMENT FOR TRAFFIC SIGNALS",
    unit: "LS", lowPrice: 2500.0, averagePrice: 9809.1,
    highPrice: 38000.0, totalQuantity: 12,
  },
  {
    payItemNumber: "805-01815", description: "SIGNAL POLE FOUNDATION, 36 IN. X 144 IN.",
    unit: "EACH", lowPrice: 3000.0, averagePrice: 4929.44,
    highPrice: 8500.0, totalQuantity: 216,
  },
  {
    payItemNumber: "805-01816", description: "SIGNAL SUPPORT FOUNDATION, 36 IN. X 36 IN. X 96 IN.",
    unit: "EACH", lowPrice: 4500.0, averagePrice: 4500.0,
    highPrice: 4500.0, totalQuantity: 2,
  },
  {
    payItemNumber: "805-01824", description: "SPAN, CATENARY, AND TETHER, TIGHTEN",
    unit: "EACH", lowPrice: 1976.14, averagePrice: 1976.14,
    highPrice: 1976.14, totalQuantity: 4,
  },
  {
    payItemNumber: "805-01828", description: "TRAFFIC SIGNAL HEAD, REALIGN",
    unit: "EACH", lowPrice: 498.48, averagePrice: 935.87,
    highPrice: 1500.0, totalQuantity: 106,
  },
  {
    payItemNumber: "805-01830", description: "CONFLICT MONITOR CHANGEOUT",
    unit: "EACH", lowPrice: 1550.0, averagePrice: 1550.0,
    highPrice: 1550.0, totalQuantity: 5,
  },
  {
    payItemNumber: "805-01842", description: "HANDHOLE, SIGNAL, TYPE 1",
    unit: "EACH", lowPrice: 1665.57, averagePrice: 2432.55,
    highPrice: 5000.0, totalQuantity: 276,
  },
  {
    payItemNumber: "805-01843", description: "HANDHOLE, SIGNAL, ADJUST TO GRADE",
    unit: "EACH", lowPrice: 455.23, averagePrice: 698.25,
    highPrice: 1900.0, totalQuantity: 91,
  },
  {
    payItemNumber: "805-01844", description: "CONDUIT, STEEL, GALVANIZED, 2 IN.",
    unit: "LFT", lowPrice: 32.5, averagePrice: 42.27,
    highPrice: 120.0, totalQuantity: 25063,
  },
  {
    payItemNumber: "805-02087", description: "TRANSPORTATION OF SALVAGEABLE SIGNAL EQUIPMENT",
    unit: "LS", lowPrice: 500.0, averagePrice: 2388.14,
    highPrice: 5900.0, totalQuantity: 15,
  },
  {
    payItemNumber: "805-02150", description: "PEDESTRIAN SIGNAL HEAD, COUNTDOWN, 18 IN.",
    unit: "EACH", lowPrice: 620.0, averagePrice: 1073.27,
    highPrice: 2000.0, totalQuantity: 479,
  },
  {
    payItemNumber: "805-02202", description: "SIGNAL DETECTOR HOUSING, DOUBLE",
    unit: "EACH", lowPrice: 2900.0, averagePrice: 2925.0,
    highPrice: 3000.0, totalQuantity: 8,
  },
  {
    payItemNumber: "805-02383", description: "CONDUIT, STEEL, GALVANIZED, 2.5 IN.",
    unit: "LFT", lowPrice: 134.55, averagePrice: 134.55,
    highPrice: 134.55, totalQuantity: 28,
  },
  {
    payItemNumber: "805-02389", description: "SIGNAL CABLE, LOOP DETECTOR LEAD-IN, COPPER, 2C/14 GAUGE",
    unit: "LFT", lowPrice: 3.3, averagePrice: 3.3,
    highPrice: 3.3, totalQuantity: 72,
  },
  {
    payItemNumber: "805-02445", description: "CONTROLLER AND CABINET, TYPE P1",
    unit: "EACH", lowPrice: 19000.0, averagePrice: 23003.36,
    highPrice: 35000.0, totalQuantity: 60,
  },
  {
    payItemNumber: "805-02645", description: "SIGNAL POLE FOUNDATION, 24 IN. X 24 IN. X 36 IN.",
    unit: "EACH", lowPrice: 1083.09, averagePrice: 1891.62,
    highPrice: 4500.0, totalQuantity: 430,
  },
  {
    payItemNumber: "805-02658", description: "CABLE COAXIAL",
    unit: "LFT", lowPrice: 8.96, averagePrice: 9.79,
    highPrice: 20.0, totalQuantity: 56,
  },
  {
    payItemNumber: "805-03174", description: "SYSTEM MASTER AND RELATED EQUIPMENT",
    unit: "LS", lowPrice: 2000.0, averagePrice: 2000.0,
    highPrice: 2000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "805-03372", description: "TETHER FOR SIGNAL",
    unit: "EACH", lowPrice: 1523.43, averagePrice: 1523.43,
    highPrice: 1523.43, totalQuantity: 117,
  },
  {
    payItemNumber: "805-03965", description: "CONDUIT, PVC, 2.50 IN. SCHEDULE 80",
    unit: "LFT", lowPrice: 24.0, averagePrice: 24.0,
    highPrice: 24.0, totalQuantity: 506,
  },
  {
    payItemNumber: "805-03979", description: "EMERGENCY VEHICLE PREEMPTION DETECTOR, TWO CHANNEL, TWO DIRE CTION",
    unit: "EACH", lowPrice: 6991.01, averagePrice: 6991.01,
    highPrice: 6991.01, totalQuantity: 1,
  },
  {
    payItemNumber: "805-03980", description: "EMERGENCY VEHICLE CONFIRMATION LIGHT KIT",
    unit: "EACH", lowPrice: 716.0, averagePrice: 852.54,
    highPrice: 1091.0, totalQuantity: 50,
  },
  {
    payItemNumber: "805-03983", description: "PHASE SELECTORS",
    unit: "EACH", lowPrice: 343.0, averagePrice: 2949.11,
    highPrice: 4765.03, totalQuantity: 27,
  },
  {
    payItemNumber: "805-04133", description: "SIGNAL POLE, PEDESTAL, 12 FT",
    unit: "EACH", lowPrice: 991.69, averagePrice: 1301.36,
    highPrice: 3000.0, totalQuantity: 150,
  },
  {
    payItemNumber: "805-04148", description: "STRAIN POLE, RELOCATE",
    unit: "EACH", lowPrice: 1082.9, averagePrice: 1082.9,
    highPrice: 1082.9, totalQuantity: 1,
  },
  {
    payItemNumber: "805-04602", description: "CONTROLLER, REWIRE",
    unit: "EACH", lowPrice: 650.0, averagePrice: 971.83,
    highPrice: 2098.25, totalQuantity: 9,
  },
  {
    payItemNumber: "805-04736", description: "SIGNAL CABLE, COPPER, 4C/18 GAUGE",
    unit: "LFT", lowPrice: 3.5, averagePrice: 3.5,
    highPrice: 3.5, totalQuantity: 1680,
  },
  {
    payItemNumber: "805-04782", description: "VIDEO VEHICLE DETECTOR SYSTEM",
    unit: "EACH", lowPrice: 35000.0, averagePrice: 35000.0,
    highPrice: 35000.0, totalQuantity: 2,
  },
  {
    payItemNumber: "805-04952", description: "CONTROLLER AND CABINET",
    unit: "EACH", lowPrice: 20000.0, averagePrice: 21750.0,
    highPrice: 23500.0, totalQuantity: 4,
  },
  {
    payItemNumber: "805-04973", description: "CONDUIT",
    unit: "LFT", lowPrice: 1.6, averagePrice: 32.95,
    highPrice: 157.0, totalQuantity: 99959,
  },
  {
    payItemNumber: "805-05405", description: "SIGNAL POLE, PEDESTAL, 4 FT",
    unit: "EACH", lowPrice: 675.0, averagePrice: 863.19,
    highPrice: 2000.0, totalQuantity: 79,
  },
  {
    payItemNumber: "805-06483", description: "CONTROLLER",
    unit: "EACH", lowPrice: 7000.0, averagePrice: 7000.0,
    highPrice: 7000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "805-06595", description: "CONDUIT, PVC, 2 IN.",
    unit: "LFT", lowPrice: 10.11, averagePrice: 15.44,
    highPrice: 55.0, totalQuantity: 11655,
  },
  {
    payItemNumber: "805-06600", description: "CONDUIT, PVC, 3 IN.",
    unit: "LFT", lowPrice: 40.0, averagePrice: 44.1,
    highPrice: 65.98, totalQuantity: 122,
  },
  {
    payItemNumber: "805-06742", description: "SOLAR POWERED FLASHING BEACON ASSEMBLY",
    unit: "EACH", lowPrice: 6000.0, averagePrice: 9625.0,
    highPrice: 15000.0, totalQuantity: 8,
  },
  {
    payItemNumber: "805-06997", description: "CAMERA",
    unit: "EACH", lowPrice: 6500.0, averagePrice: 7000.0,
    highPrice: 8000.0, totalQuantity: 6,
  },
  {
    payItemNumber: "805-07190", description: "TRAFFIC SIGNAL HEAD, NO. 1 SECTION, 12 IN. AMBER ARROW",
    unit: "EACH", lowPrice: 700.0, averagePrice: 700.0,
    highPrice: 700.0, totalQuantity: 8,
  },
  {
    payItemNumber: "805-07212", description: "SPLICE KIT",
    unit: "EACH", lowPrice: 80.0, averagePrice: 120.0,
    highPrice: 200.0, totalQuantity: 6,
  },
  {
    payItemNumber: "805-07767", description: "SIGNAL CABLE, CONTROL, COPPER, 12C/14 GAUGE",
    unit: "LFT", lowPrice: 6.0, averagePrice: 6.0,
    highPrice: 6.0, totalQuantity: 3803,
  },
  {
    payItemNumber: "805-07801", description: "CABINET",
    unit: "EACH", lowPrice: 13500.0, averagePrice: 13500.0,
    highPrice: 13500.0, totalQuantity: 2,
  },
  {
    payItemNumber: "805-07842", description: "VEHICLE DETECTION SYSTEM",
    unit: "EACH", lowPrice: 14632.0, averagePrice: 14632.0,
    highPrice: 14632.0, totalQuantity: 4,
  },
  {
    payItemNumber: "805-08126", description: "TRAFFIC SIGNAL HEAD, NO. SECTION, RETROFIT",
    unit: "EACH", lowPrice: 115.06, averagePrice: 115.06,
    highPrice: 115.06, totalQuantity: 780,
  },
  {
    payItemNumber: "805-08214", description: "CONDUIT, PVC, 2 IN. SCHEDULE 40",
    unit: "LFT", lowPrice: 11.47, averagePrice: 18.37,
    highPrice: 58.0, totalQuantity: 4927,
  },
  {
    payItemNumber: "805-08244", description: "CELLULAR MODEM KIT",
    unit: "EACH", lowPrice: 2150.0, averagePrice: 2383.96,
    highPrice: 3200.0, totalQuantity: 53,
  },
  {
    payItemNumber: "805-08464", description: "RADIO, INTERCONNECT",
    unit: "EACH", lowPrice: 2400.0, averagePrice: 2517.17,
    highPrice: 3454.57, totalQuantity: 9,
  },
  {
    payItemNumber: "805-08487", description: "BACKPLATE, SIGNAL",
    unit: "EACH", lowPrice: 706.31, averagePrice: 785.31,
    highPrice: 1140.81, totalQuantity: 33,
  },
  {
    payItemNumber: "805-08493", description: "RADIO, INTERCONNECTION SYSTEM TESTING",
    unit: "LS", lowPrice: 1.0, averagePrice: 667.0,
    highPrice: 1500.0, totalQuantity: 3,
  },
  {
    payItemNumber: "805-09089", description: "RADIO, YAGI ANTENNA",
    unit: "EACH", lowPrice: 700.0, averagePrice: 1188.89,
    highPrice: 1500.0, totalQuantity: 9,
  },
  {
    payItemNumber: "805-09451", description: "SIGNAL POLE, PEDESTAL, 15 FT",
    unit: "EACH", lowPrice: 1600.0, averagePrice: 1675.0,
    highPrice: 1900.0, totalQuantity: 16,
  },
  {
    payItemNumber: "805-09539", description: "LOOP DETECTOR DELAY AMPLIFIER, COUNTING, NO. 2 CHANNEL",
    unit: "EACH", lowPrice: 361.0, averagePrice: 566.3,
    highPrice: 700.0, totalQuantity: 322,
  },
  {
    payItemNumber: "805-09540", description: "LOOP DETECTOR RACK",
    unit: "EACH", lowPrice: 1087.76, averagePrice: 2128.78,
    highPrice: 2500.0, totalQuantity: 10,
  },
  {
    payItemNumber: "805-09845", description: "CONTACT CLOSURE CARD",
    unit: "EACH", lowPrice: 1500.0, averagePrice: 2280.0,
    highPrice: 9500.0, totalQuantity: 60,
  },
  {
    payItemNumber: "805-09846", description: "RECEIVER PROCESSOR",
    unit: "EACH", lowPrice: 750.0, averagePrice: 838.33,
    highPrice: 1700.0, totalQuantity: 60,
  },
  {
    payItemNumber: "805-10107", description: "WIRELESS MAGNETOMETER DETECTOR",
    unit: "EACH", lowPrice: 500.0, averagePrice: 731.16,
    highPrice: 1750.0, totalQuantity: 69,
  },
  {
    payItemNumber: "805-10108", description: "WIRELESS REPEATER",
    unit: "EACH", lowPrice: 1000.0, averagePrice: 1162.0,
    highPrice: 2700.0, totalQuantity: 60,
  },
  {
    payItemNumber: "805-11373", description: "SIGNAL CANTILEVER STRUCTURE, SINGLE ARM 15 FT ARM 15 FT.",
    unit: "EACH", lowPrice: 18500.0, averagePrice: 18500.0,
    highPrice: 18500.0, totalQuantity: 1,
  },
  {
    payItemNumber: "805-11374", description: "SIGNAL CANTILEVER STRUCTURE, SINGLE ARM 20 FT ARM 20 FT",
    unit: "EACH", lowPrice: 19000.0, averagePrice: 25333.33,
    highPrice: 28500.0, totalQuantity: 3,
  },
  {
    payItemNumber: "805-11375", description: "SIGNAL CANTILEVER STRUCTURE, SINGLE ARM 25 FT ARM 25 FT.",
    unit: "EACH", lowPrice: 20000.0, averagePrice: 23600.0,
    highPrice: 29000.0, totalQuantity: 5,
  },
  {
    payItemNumber: "805-11376", description: "SIGNAL CANTILEVER STRUCTURE, SINGLE ARM 30 FT ARM 30 FT.",
    unit: "EACH", lowPrice: 17115.0, averagePrice: 21538.86,
    highPrice: 29000.0, totalQuantity: 12,
  },
  {
    payItemNumber: "805-11377", description: "SIGNAL CANTILEVER STRUCTURE, SINGLE ARM 35 FT ARM 35 FT.",
    unit: "EACH", lowPrice: 22000.0, averagePrice: 24000.0,
    highPrice: 30000.0, totalQuantity: 4,
  },
  {
    payItemNumber: "805-11378", description: "SIGNAL CANTILEVER STRUCTURE, SINGLE ARM 40 FT ARM, 40 FT.",
    unit: "EACH", lowPrice: 24078.0, averagePrice: 27539.0,
    highPrice: 31000.0, totalQuantity: 2,
  },
  {
    payItemNumber: "805-11379", description: "SIGNAL CANTILEVER STRUCTURE, SINGLE ARM 45 FT ARM 45 FT.",
    unit: "EACH", lowPrice: 26576.0, averagePrice: 26576.0,
    highPrice: 26576.0, totalQuantity: 1,
  },
  {
    payItemNumber: "805-11380", description: "SIGNAL CANTILEVER STRUCTURE, SINGLE ARM 50 FT ARM 50 FT.",
    unit: "EACH", lowPrice: 34000.0, averagePrice: 34000.0,
    highPrice: 34000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "805-11383", description: "SIGNAL CANTILEVER STRUCTURE, DRILLED SHAFT FOUNDATION, TYPE A",
    unit: "EACH", lowPrice: 4061.0, averagePrice: 10558.35,
    highPrice: 16244.67, totalQuantity: 18,
  },
  {
    payItemNumber: "805-11384", description: "SIGNAL CANTILEVER STRUCTURE, DRILLED SHAFT FOUNDATION, TYPE B",
    unit: "EACH", lowPrice: 7211.0, averagePrice: 7855.5,
    highPrice: 8500.0, totalQuantity: 4,
  },
  {
    payItemNumber: "805-11385", description: "SIGNAL CANTILEVER STRUCTURE, DRILLED SHAFT FOUNDATION, TYPE E",
    unit: "EACH", lowPrice: 10000.0, averagePrice: 10000.0,
    highPrice: 10000.0, totalQuantity: 4,
  },
  {
    payItemNumber: "805-11392", description: "SIGNAL CANTILEVER STRUCTURE, DUAL ARM 30 FT",
    unit: "EACH", lowPrice: 32000.0, averagePrice: 32500.0,
    highPrice: 33000.0, totalQuantity: 2,
  },
  {
    payItemNumber: "805-11393", description: "SIGNAL CANTILEVER STRUCTURE, DUAL ARM 35 FT",
    unit: "EACH", lowPrice: 31000.0, averagePrice: 32500.0,
    highPrice: 34000.0, totalQuantity: 2,
  },
  {
    payItemNumber: "805-11496", description: "PEDESTRIAN HYBRID BEACON",
    unit: "EACH", lowPrice: 1900.0, averagePrice: 1900.0,
    highPrice: 1900.0, totalQuantity: 4,
  },
  {
    payItemNumber: "805-11539", description: "AUXILIARY BIU PANEL",
    unit: "EACH", lowPrice: 500.0, averagePrice: 1566.67,
    highPrice: 2100.0, totalQuantity: 6,
  },
  {
    payItemNumber: "805-11540", description: "MICROLOOP DETECTOR PROBE",
    unit: "EACH", lowPrice: 250.0, averagePrice: 2460.0,
    highPrice: 4400.0, totalQuantity: 10,
  },
  {
    payItemNumber: "805-11569", description: "RADIO SPLITTER",
    unit: "EACH", lowPrice: 750.0, averagePrice: 820.89,
    highPrice: 946.22, totalQuantity: 7,
  },
  {
    payItemNumber: "805-11570", description: "RADIO ANTENNA",
    unit: "EACH", lowPrice: 1.0, averagePrice: 207.68,
    highPrice: 1034.38, totalQuantity: 5,
  },
  {
    payItemNumber: "805-11744", description: "HANDHOLE, SIGNAL, TYPE 2",
    unit: "EACH", lowPrice: 1477.0, averagePrice: 1819.02,
    highPrice: 3250.0, totalQuantity: 287,
  },
  {
    payItemNumber: "805-11759", description: "GPS MAST MOUNT RADIO UNIT",
    unit: "EACH", lowPrice: 955.0, averagePrice: 5243.0,
    highPrice: 7387.0, totalQuantity: 27,
  },
  {
    payItemNumber: "805-11771", description: "SIGNAL POLE, PEDESTAL, 16 FT",
    unit: "EACH", lowPrice: 1959.49, averagePrice: 1959.49,
    highPrice: 1959.49, totalQuantity: 2,
  },
  {
    payItemNumber: "805-11799", description: "RECTANGULAR RAPID FLASHING BEACON",
    unit: "EACH", lowPrice: 3200.0, averagePrice: 6262.08,
    highPrice: 7929.0, totalQuantity: 8,
  },
  {
    payItemNumber: "805-11813", description: "CONDUIT, PVC, 2 IN. SCHEDULE 80",
    unit: "LFT", lowPrice: 26.5, averagePrice: 49.81,
    highPrice: 100.0, totalQuantity: 2212,
  },
  {
    payItemNumber: "805-11814", description: "CONDUIT, HDPE, 2 IN. SCHEDULE 40",
    unit: "LFT", lowPrice: 17.82, averagePrice: 26.82,
    highPrice: 65.0, totalQuantity: 10325,
  },
  {
    payItemNumber: "805-11815", description: "CONDUIT, HDPE, 2 IN. SCHEDULE 80",
    unit: "LFT", lowPrice: 12.0, averagePrice: 31.27,
    highPrice: 65.0, totalQuantity: 99725,
  },
  {
    payItemNumber: "805-11817", description: "PEDESTRIAN PUSH BUTTON, APS",
    unit: "EACH", lowPrice: 1000.0, averagePrice: 1406.0,
    highPrice: 2200.0, totalQuantity: 549,
  },
  {
    payItemNumber: "805-11842", description: "CONDUIT, HDPE, 3 IN. SCHEDULE 40",
    unit: "LFT", lowPrice: 10.0, averagePrice: 10.0,
    highPrice: 10.0, totalQuantity: 30,
  },
  {
    payItemNumber: "805-11965", description: "SOLAR POWERED FLASHING LED SIGN ASSEMBLY",
    unit: "EACH", lowPrice: 2600.0, averagePrice: 2760.0,
    highPrice: 2900.0, totalQuantity: 15,
  },
  {
    payItemNumber: "805-12016", description: "UNINTERRUPTIBLE POWER SUPPLY",
    unit: "EACH", lowPrice: 8000.0, averagePrice: 9470.63,
    highPrice: 12500.0, totalQuantity: 13,
  },
  {
    payItemNumber: "805-12325", description: "TRAFFIC SIGNAL HEAD, OPTICALLY PROGRAMED",
    unit: "EACH", lowPrice: 7000.0, averagePrice: 7000.0,
    highPrice: 7000.0, totalQuantity: 2,
  },
  {
    payItemNumber: "805-12474", description: "CONDUIT, HDPE, 1 IN. SCHEDULE 40",
    unit: "LFT", lowPrice: 10.0, averagePrice: 10.0,
    highPrice: 10.0, totalQuantity: 100,
  },
  {
    payItemNumber: "805-12650", description: "SIGNAL POLE, PEDESTAL, 5 FT",
    unit: "EACH", lowPrice: 900.0, averagePrice: 1343.48,
    highPrice: 1800.0, totalQuantity: 23,
  },
  {
    payItemNumber: "805-12830", description: "LOOP DETECTOR DELAY AMPLIFIER, COUNTING, NO. 4 CHANNEL",
    unit: "EACH", lowPrice: 450.0, averagePrice: 450.0,
    highPrice: 450.0, totalQuantity: 10,
  },
  {
    payItemNumber: "805-78010", description: "CONTROLLER AND CABINET, FLASHER SOLID STATE",
    unit: "EACH", lowPrice: 2500.0, averagePrice: 2500.0,
    highPrice: 2500.0, totalQuantity: 1,
  },
  {
    payItemNumber: "805-78109", description: "CONTROLLER AND CABINET, SECONDARY MENU DRIVEN, 8 PHASE",
    unit: "EACH", lowPrice: 18000.0, averagePrice: 23022.77,
    highPrice: 30000.0, totalQuantity: 7,
  },
  {
    payItemNumber: "805-78205", description: "TRAFFIC SIGNAL HEAD, NO. 3 SECTION, 12 IN. RED, AMBER, GREEN",
    unit: "EACH", lowPrice: 907.0, averagePrice: 1087.13,
    highPrice: 1722.33, totalQuantity: 756,
  },
  {
    payItemNumber: "805-78225", description: "TRAFFIC SIGNAL HEAD, NO. 4 SECTION, 12 IN. , AMBER, GREEN, GREEN ARROW",
    unit: "EACH", lowPrice: 1136.58, averagePrice: 1285.96,
    highPrice: 2000.0, totalQuantity: 130,
  },
  {
    payItemNumber: "805-78230", description: "TRAFFIC SIGNAL HEAD, NO. 5 SECTION, 12 IN. RED, AMBER, GREEN, AMBER ARROW, GREEN ARROW",
    unit: "EACH", lowPrice: 1514.5, averagePrice: 1578.58,
    highPrice: 2100.0, totalQuantity: 44,
  },
  {
    payItemNumber: "805-78245", description: "TRAFFIC SIGNAL HEAD, OPTICALLY PROGRAMMED, 3 SECTION, 12 IN.  3 SECTION, 12 IN",
    unit: "EACH", lowPrice: 7500.0, averagePrice: 7876.73,
    highPrice: 8092.0, totalQuantity: 11,
  },
  {
    payItemNumber: "805-78370", description: "PEDESTRIAN PUSH BUTTON, NON-APS",
    unit: "EACH", lowPrice: 457.0, averagePrice: 457.0,
    highPrice: 457.0, totalQuantity: 4,
  },
  {
    payItemNumber: "805-78412", description: "SIGNAL POLE, PEDESTAL, 9 FT",
    unit: "EACH", lowPrice: 1281.0, averagePrice: 1281.0,
    highPrice: 1281.0, totalQuantity: 57,
  },
  {
    payItemNumber: "805-78415", description: "SPAN, CATENARY, AND TETHER",
    unit: "EACH", lowPrice: 3000.0, averagePrice: 4431.55,
    highPrice: 7500.0, totalQuantity: 254,
  },
  {
    payItemNumber: "805-78420", description: "DISCONNECT HANGER",
    unit: "EACH", lowPrice: 470.0, averagePrice: 597.43,
    highPrice: 1000.0, totalQuantity: 335,
  },
  {
    payItemNumber: "805-78445", description: "SIGNAL SERVICE",
    unit: "EACH", lowPrice: 1750.0, averagePrice: 2685.19,
    highPrice: 5596.97, totalQuantity: 79,
  },
  {
    payItemNumber: "805-78467", description: "SIGNAL CABLE, SERVICE, COPPER, 3C/8 GAUGE",
    unit: "LFT", lowPrice: 4.0, averagePrice: 5.28,
    highPrice: 20.0, totalQuantity: 5453,
  },
  {
    payItemNumber: "805-78470", description: "SIGNAL CABLE, ROADWAY LOOP, COPPER, 1C/14 GAUGE",
    unit: "LFT", lowPrice: 0.22, averagePrice: 1.2,
    highPrice: 10.0, totalQuantity: 533622,
  },
  {
    payItemNumber: "805-78480", description: "SIGNAL CABLE, CONTROL, COPPER, 3C/14 GAUGE",
    unit: "LFT", lowPrice: 3.0, averagePrice: 4.36,
    highPrice: 7.0, totalQuantity: 81417,
  },
  {
    payItemNumber: "805-78485", description: "SIGNAL CABLE, CONTROL, COPPER, 5C/14 GAUGE",
    unit: "LFT", lowPrice: 2.47, averagePrice: 4.73,
    highPrice: 8.0, totalQuantity: 80751,
  },
  {
    payItemNumber: "805-78490", description: "SIGNAL CABLE, CONTROL, COPPER, 7C/14 GAUGE",
    unit: "LFT", lowPrice: 2.0, averagePrice: 4.22,
    highPrice: 9.0, totalQuantity: 52593,
  },
  {
    payItemNumber: "805-78495", description: "SIGNAL CABLE, CONTROL, COPPER, 9C/14 GAUGE",
    unit: "LFT", lowPrice: 2.8, averagePrice: 5.37,
    highPrice: 11.1, totalQuantity: 61519,
  },
  {
    payItemNumber: "805-78500", description: "SIGNAL CABLE, CONTROL, COPPER, 11C/14 GAUGE",
    unit: "LFT", lowPrice: 6.5, averagePrice: 6.5,
    highPrice: 6.5, totalQuantity: 18,
  },
  {
    payItemNumber: "805-78510", description: "SIGNAL CABLE, DETECTOR LEAD-IN, COPPER, 2C/16 GAUGE",
    unit: "LFT", lowPrice: 1.21, averagePrice: 2.74,
    highPrice: 8.5, totalQuantity: 245876,
  },
  {
    payItemNumber: "805-78785", description: "SIGNAL DETECTOR HOUSING",
    unit: "EACH", lowPrice: 751.5, averagePrice: 2249.35,
    highPrice: 5000.0, totalQuantity: 1223,
  },
  {
    payItemNumber: "805-78795", description: "SAW CUT FOR ROADWAY LOOP DETECTOR AND SEALANT",
    unit: "LFT", lowPrice: 10.0, averagePrice: 16.49,
    highPrice: 50.0, totalQuantity: 168230,
  },
  {
    payItemNumber: "805-78925", description: "CONTROLLER CABINET FOUNDATION, TYPE P1",
    unit: "EACH", lowPrice: 900.0, averagePrice: 3314.79,
    highPrice: 4575.0, totalQuantity: 74,
  },
  {
    payItemNumber: "805-78930", description: "CONTROLLER CABINET FOUNDATION, TYPE M",
    unit: "EACH", lowPrice: 3510.0, averagePrice: 3510.0,
    highPrice: 3510.0, totalQuantity: 4,
  },
  {
    payItemNumber: "805-79040", description: "TRAFFIC SIGNAL INSTALLATION, MODERNIZED, LOCATION NO.",
    unit: "LS", lowPrice: 3160.0, averagePrice: 4080.0,
    highPrice: 5000.0, totalQuantity: 2,
  },
  {
    payItemNumber: "805-81032", description: "SIGNAL POLE, STEEL STRAIN, 30 FT",
    unit: "EACH", lowPrice: 8318.0, averagePrice: 8921.46,
    highPrice: 13500.0, totalQuantity: 127,
  },
  {
    payItemNumber: "805-81060", description: "SIGNAL POLE, STEEL STRAIN, 36 FT",
    unit: "EACH", lowPrice: 10125.0, averagePrice: 11304.78,
    highPrice: 13000.0, totalQuantity: 80,
  },
  {
    payItemNumber: "805-86898", description: "CONDUIT, STEEL, GALVANIZED, 0.75 IN.",
    unit: "LFT", lowPrice: 10.0, averagePrice: 47.2,
    highPrice: 823.0, totalQuantity: 942,
  },
  {
    payItemNumber: "805-87715", description: "GROUND ROD WITH CONNECTOR",
    unit: "EACH", lowPrice: 45.0, averagePrice: 45.0,
    highPrice: 45.0, totalQuantity: 1,
  },
  {
    payItemNumber: "805-87780", description: "CIRCUIT BREAKER",
    unit: "EACH", lowPrice: 100.0, averagePrice: 100.0,
    highPrice: 100.0, totalQuantity: 5,
  },
  {
    payItemNumber: "805-90005", description: "SIGNAL POLE, PEDESTAL, 10 FT",
    unit: "EACH", lowPrice: 1040.0, averagePrice: 1496.44,
    highPrice: 1600.0, totalQuantity: 45,
  },
  {
    payItemNumber: "805-90267", description: "CONDUIT, STEEL, GALVANIZED, 3 IN.",
    unit: "LFT", lowPrice: 44.8, averagePrice: 44.8,
    highPrice: 44.8, totalQuantity: 941,
  },
  {
    payItemNumber: "805-91703", description: "CONDUIT, STEEL, GALVANIZED, 1.5 IN.",
    unit: "LFT", lowPrice: 10.0, averagePrice: 10.0,
    highPrice: 10.0, totalQuantity: 10,
  },
  {
    payItemNumber: "805-91706", description: "ANCHOR BOLT REPAIR",
    unit: "EACH", lowPrice: 500.0, averagePrice: 555.83,
    highPrice: 680.0, totalQuantity: 12,
  },
  {
    payItemNumber: "805-91711", description: "EXPANSION FITTING, 1.5 IN.",
    unit: "EACH", lowPrice: 10.0, averagePrice: 10.0,
    highPrice: 10.0, totalQuantity: 1,
  },
  {
    payItemNumber: "805-92504", description: "LOOP DETECTOR DELAY AMPLIFIER, NONCOUNTING 2 CHANNEL",
    unit: "EACH", lowPrice: 292.0, averagePrice: 425.73,
    highPrice: 732.25, totalQuantity: 99,
  },
  {
    payItemNumber: "805-92951", description: "SIGNAL DETECTOR HOUSING ADJUST TO GRADE",
    unit: "EACH", lowPrice: 7.0, averagePrice: 683.44,
    highPrice: 1350.0, totalQuantity: 21,
  },
  {
    payItemNumber: "805-93067", description: "CONTROLLER CABINET, TYPE P",
    unit: "EACH", lowPrice: 21500.0, averagePrice: 21833.33,
    highPrice: 22000.0, totalQuantity: 6,
  },
  {
    payItemNumber: "805-95518", description: "CONDUIT, FLEXIBLE, 2 IN.",
    unit: "LFT", lowPrice: 10.0, averagePrice: 10.0,
    highPrice: 10.0, totalQuantity: 120,
  },
  {
    payItemNumber: "805-95520", description: "EXPANSION FITTING, 2.0 IN.",
    unit: "EACH", lowPrice: 10.0, averagePrice: 10.0,
    highPrice: 10.0, totalQuantity: 1,
  },
  {
    payItemNumber: "805-95521", description: "EXPANSION FITTING, 0.75 IN.",
    unit: "EACH", lowPrice: 10.0, averagePrice: 10.0,
    highPrice: 10.0, totalQuantity: 2,
  },
  {
    payItemNumber: "805-95568", description: "CONDUIT, PVC, 4 IN.",
    unit: "LFT", lowPrice: 27.04, averagePrice: 27.04,
    highPrice: 27.04, totalQuantity: 95,
  },
  {
    payItemNumber: "805-99162", description: "SIGNAL POLE, PEDESTAL, 11 FT",
    unit: "EACH", lowPrice: 1120.0, averagePrice: 1187.78,
    highPrice: 1300.0, totalQuantity: 54,
  },
  {
    payItemNumber: "807-01562", description: "POWER DISCONNECT PLUG FOR HIGH MAST TOWER",
    unit: "EACH", lowPrice: 350.0, averagePrice: 350.0,
    highPrice: 350.0, totalQuantity: 5,
  },
  {
    payItemNumber: "807-01563", description: "HIGH MAST TOWER, LOCATING PIN, STAINLESS STEEL",
    unit: "EACH", lowPrice: 50.0, averagePrice: 50.0,
    highPrice: 50.0, totalQuantity: 1,
  },
  {
    payItemNumber: "807-01617", description: "HANDHOLE, COVER AND RING",
    unit: "EACH", lowPrice: 650.0, averagePrice: 814.29,
    highPrice: 1200.0, totalQuantity: 7,
  },
  {
    payItemNumber: "807-01653", description: "WIRE, NO. 4 COPPER, IN CONDUIT, BRIDGE 1/C",
    unit: "LFT", lowPrice: 4.5, averagePrice: 5.13,
    highPrice: 18.0, totalQuantity: 16365,
  },
  {
    payItemNumber: "807-02105", description: "ROUTINE MAINTENANCE, LUMINAIRE, HIGH PRESSURE SODIUM, 150 WA TT",
    unit: "MOS", lowPrice: 11.0, averagePrice: 11.0,
    highPrice: 11.0, totalQuantity: 576,
  },
  {
    payItemNumber: "807-02191", description: "HANDHOLE, LIGHTING",
    unit: "EACH", lowPrice: 1260.0, averagePrice: 1623.52,
    highPrice: 3556.92, totalQuantity: 601,
  },
  {
    payItemNumber: "807-02194", description: "SERVICE POINT, II, MODIFIED",
    unit: "EACH", lowPrice: 10173.0, averagePrice: 10173.0,
    highPrice: 10173.0, totalQuantity: 27,
  },
  {
    payItemNumber: "807-02352", description: "WIRE, XHHW, NO. 4 COPPER, IN PLASTIC DUCT, 4 1/C",
    unit: "LFT", lowPrice: 22.29, averagePrice: 22.29,
    highPrice: 22.29, totalQuantity: 983,
  },
  {
    payItemNumber: "807-02370", description: "LIGHT STRUCTURE, REMOVE AND RESET",
    unit: "EACH", lowPrice: 1582.0, averagePrice: 2943.56,
    highPrice: 5000.0, totalQuantity: 22,
  },
  {
    payItemNumber: "807-02394", description: "CONTROLLER, LIGHTING",
    unit: "EACH", lowPrice: 150.0, averagePrice: 161.83,
    highPrice: 8300.53, totalQuantity: 1378,
  },
  {
    payItemNumber: "807-02426", description: "WIRE, THW, NO. 4 COPPER, IN PLASTIC DUCT, 4 1/C",
    unit: "LFT", lowPrice: 13.9, averagePrice: 20.95,
    highPrice: 58.11, totalQuantity: 2449,
  },
  {
    payItemNumber: "807-02560", description: "ELECTRICAL WORK",
    unit: "LS", lowPrice: 8800.0, averagePrice: 8800.0,
    highPrice: 8800.0, totalQuantity: 1,
  },
  {
    payItemNumber: "807-02579", description: "MAST ARM, 15 FT",
    unit: "EACH", lowPrice: 700.0, averagePrice: 2138.46,
    highPrice: 2400.0, totalQuantity: 13,
  },
  {
    payItemNumber: "807-02603", description: "LIGHT STANDARD, RELOCATE",
    unit: "EACH", lowPrice: 1582.0, averagePrice: 4527.33,
    highPrice: 6000.0, totalQuantity: 3,
  },
  {
    payItemNumber: "807-02618", description: "WIRE, NO. 2 COPPER, 3 1/C",
    unit: "LFT", lowPrice: 12.5, averagePrice: 18.43,
    highPrice: 30.0, totalQuantity: 1733,
  },
  {
    payItemNumber: "807-02778", description: "LUMINAIRE, MAST ARM, 5 FT",
    unit: "EACH", lowPrice: 875.0, averagePrice: 875.0,
    highPrice: 875.0, totalQuantity: 2,
  },
  {
    payItemNumber: "807-02780", description: "LUMINAIRE, MAST ARM, 8 FT",
    unit: "EACH", lowPrice: 950.0, averagePrice: 1090.96,
    highPrice: 1231.92, totalQuantity: 4,
  },
  {
    payItemNumber: "807-02781", description: "LUMINAIRE, MAST ARM, 10 FT",
    unit: "EACH", lowPrice: 1150.0, averagePrice: 1361.67,
    highPrice: 1785.0, totalQuantity: 3,
  },
  {
    payItemNumber: "807-02782", description: "LUMINAIRE, MAST ARM, 12 FT",
    unit: "EACH", lowPrice: 1300.0, averagePrice: 1300.0,
    highPrice: 1300.0, totalQuantity: 5,
  },
  {
    payItemNumber: "807-02783", description: "LUMINAIRE, MAST ARM, 15 FT",
    unit: "EACH", lowPrice: 1500.0, averagePrice: 1668.18,
    highPrice: 2000.0, totalQuantity: 11,
  },
  {
    payItemNumber: "807-02784", description: "LUMINAIRE, MAST ARM, 20 FT",
    unit: "EACH", lowPrice: 1700.0, averagePrice: 1700.0,
    highPrice: 1700.0, totalQuantity: 2,
  },
  {
    payItemNumber: "807-02785", description: "LUMINAIRE, MAST ARM, 25 FT",
    unit: "EACH", lowPrice: 1900.0, averagePrice: 1900.0,
    highPrice: 1900.0, totalQuantity: 2,
  },
  {
    payItemNumber: "807-03758", description: "LIGHTING FOUNDATION, CONCRETE, WITH GROUNDING, 24 IN. X 24 I N. X 96 IN.",
    unit: "EACH", lowPrice: 1475.04, averagePrice: 2252.45,
    highPrice: 2600.0, totalQuantity: 154,
  },
  {
    payItemNumber: "807-03934", description: "LIGHT STRUCTURE, REMOVE",
    unit: "EACH", lowPrice: 500.0, averagePrice: 888.99,
    highPrice: 1055.0, totalQuantity: 139,
  },
  {
    payItemNumber: "807-03950", description: "LUMINAIRE, ORNAMENTAL",
    unit: "EACH", lowPrice: 341.0, averagePrice: 2339.56,
    highPrice: 4500.0, totalQuantity: 166,
  },
  {
    payItemNumber: "807-03951", description: "LIGHT POLE, ORNAMENTAL",
    unit: "EACH", lowPrice: 1220.0, averagePrice: 6097.32,
    highPrice: 12500.0, totalQuantity: 136,
  },
  {
    payItemNumber: "807-04428", description: "CABLE DUCT",
    unit: "LFT", lowPrice: 22.0, averagePrice: 22.0,
    highPrice: 22.0, totalQuantity: 6500,
  },
  {
    payItemNumber: "807-04507", description: "TRANSFORMER",
    unit: "EACH", lowPrice: 2800.0, averagePrice: 2800.0,
    highPrice: 2800.0, totalQuantity: 2,
  },
  {
    payItemNumber: "807-04651", description: "WIRE 1/C",
    unit: "LFT", lowPrice: 0.46, averagePrice: 4.99,
    highPrice: 35.0, totalQuantity: 26536,
  },
  {
    payItemNumber: "807-04653", description: "LIGHTING FOUNDATION",
    unit: "EACH", lowPrice: 1106.0, averagePrice: 1402.98,
    highPrice: 3500.0, totalQuantity: 485,
  },
  {
    payItemNumber: "807-04654", description: "LIGHT POLE",
    unit: "EACH", lowPrice: 2118.63, averagePrice: 5055.79,
    highPrice: 6553.0, totalQuantity: 159,
  },
  {
    payItemNumber: "807-04866", description: "LUMINAIRE",
    unit: "EACH", lowPrice: 572.0, averagePrice: 906.42,
    highPrice: 1000.0, totalQuantity: 64,
  },
  {
    payItemNumber: "807-04940", description: "MAST ARM",
    unit: "EACH", lowPrice: 700.0, averagePrice: 700.0,
    highPrice: 700.0, totalQuantity: 10,
  },
  {
    payItemNumber: "807-04967", description: "CABLE",
    unit: "LFT", lowPrice: 1.5, averagePrice: 1.5,
    highPrice: 1.5, totalQuantity: 200,
  },
  {
    payItemNumber: "807-05073", description: "JUNCTION BOX",
    unit: "EACH", lowPrice: 500.0, averagePrice: 500.0,
    highPrice: 500.0, totalQuantity: 1,
  },
  {
    payItemNumber: "807-05695", description: "WIRE, NO. 4 COPPER, IN PLASTIC DUCT, 3 1/C",
    unit: "LFT", lowPrice: 25.0, averagePrice: 25.0,
    highPrice: 25.0, totalQuantity: 250,
  },
  {
    payItemNumber: "807-05815", description: "LIGHTING",
    unit: "EACH", lowPrice: 5.0, averagePrice: 5.0,
    highPrice: 5.0, totalQuantity: 1,
  },
  {
    payItemNumber: "807-06592", description: "CONDUIT, STEEL, GALVANIZED, 2 IN.",
    unit: "LFT", lowPrice: 10.0, averagePrice: 37.81,
    highPrice: 100.0, totalQuantity: 42647,
  },
  {
    payItemNumber: "807-06796", description: "ELECTRIC",
    unit: "EACH", lowPrice: 300.0, averagePrice: 300.0,
    highPrice: 300.0, totalQuantity: 1,
  },
  {
    payItemNumber: "807-07580", description: "WIRE, NO. 4 COPPER, IN PLASTIC DUCT, IN TRENCH, 4 1/C",
    unit: "LFT", lowPrice: 13.0, averagePrice: 15.12,
    highPrice: 30.0, totalQuantity: 359954,
  },
  {
    payItemNumber: "807-07703", description: "HIGH MAST TOWER",
    unit: "EACH", lowPrice: 500.0, averagePrice: 500.0,
    highPrice: 500.0, totalQuantity: 2,
  },
  {
    payItemNumber: "807-08612", description: "HANDHOLE, RECTANGULAR",
    unit: "EACH", lowPrice: 3000.0, averagePrice: 3000.0,
    highPrice: 3000.0, totalQuantity: 4,
  },
  {
    payItemNumber: "807-09637", description: "WIRE, NO. 6 COPPER, IN PLASTIC DUCT, 4 1/C",
    unit: "LFT", lowPrice: 25.0, averagePrice: 25.73,
    highPrice: 30.0, totalQuantity: 3777,
  },
  {
    payItemNumber: "807-09638", description: "WIRE, NO. 6 COPPER, IN PLASTIC DUCT, IN TRENCH, 4 1/C IN TRENCH, 4 1/C",
    unit: "LFT", lowPrice: 30.0, averagePrice: 30.0,
    highPrice: 30.0, totalQuantity: 2529,
  },
  {
    payItemNumber: "807-09787", description: "LIGHT POLE, 40 FT E.M.H. 25 FT MAST ARM, BREAKAWAY BASE BREAKAWAY BASE",
    unit: "EACH", lowPrice: 5500.0, averagePrice: 6100.0,
    highPrice: 6700.0, totalQuantity: 4,
  },
  {
    payItemNumber: "807-11367", description: "ASSIGNED MAINTENANCE, NAVIGATION LIGHT",
    unit: "EACH", lowPrice: 97.0, averagePrice: 98.83,
    highPrice: 102.0, totalQuantity: 720,
  },
  {
    payItemNumber: "807-11593", description: "CABLE, POLE CIRCUIT, XHHW, NO. 6 COPPER, STRANDED, 2 1/C",
    unit: "LFT", lowPrice: 5.8, averagePrice: 6.25,
    highPrice: 16.5, totalQuantity: 13032,
  },
  {
    payItemNumber: "807-11679", description: "LIGHT POLE, 38 FT E.M.H., 15 FT MAST ARM, ANCHOR BASE",
    unit: "EACH", lowPrice: 3481.0, averagePrice: 3481.0,
    highPrice: 3481.0, totalQuantity: 1,
  },
  {
    payItemNumber: "807-11712", description: "WIRE, NO. 6 COPPER, 1/C",
    unit: "LFT", lowPrice: 1.3, averagePrice: 2.73,
    highPrice: 5.9, totalQuantity: 3427,
  },
  {
    payItemNumber: "807-11772", description: "LUMINAIRE, DIAGNOSIS AND REPAIR",
    unit: "EACH", lowPrice: 825.0, averagePrice: 825.0,
    highPrice: 825.0, totalQuantity: 200,
  },
  {
    payItemNumber: "807-12184", description: "LIGHTING FOUNDATION, CONCRETE, WITH GROUNDING, 24 IN. DIAMET ER X 72 IN.",
    unit: "EACH", lowPrice: 3800.0, averagePrice: 3800.0,
    highPrice: 3800.0, totalQuantity: 13,
  },
  {
    payItemNumber: "807-12199", description: "LUMINAIRE, HIGH LUMEN ROADWAY",
    unit: "EACH", lowPrice: 289.0, averagePrice: 385.0,
    highPrice: 960.43, totalQuantity: 856,
  },
  {
    payItemNumber: "807-12201", description: "LUMINAIRE, HIGH MAST",
    unit: "EACH", lowPrice: 924.0, averagePrice: 1094.95,
    highPrice: 2625.0, totalQuantity: 244,
  },
  {
    payItemNumber: "807-12202", description: "LUMINAIRE, LOW LUMEN ROADWAY",
    unit: "EACH", lowPrice: 207.0, averagePrice: 509.81,
    highPrice: 1500.0, totalQuantity: 872,
  },
  {
    payItemNumber: "807-12206", description: "LUMINAIRE, UNDERPASS",
    unit: "EACH", lowPrice: 850.0, averagePrice: 1095.21,
    highPrice: 6000.0, totalQuantity: 102,
  },
  {
    payItemNumber: "807-12266", description: "ROUTINE MAINTENANCE, LUMINAIRE, LED, 250 WATT",
    unit: "MOS", lowPrice: 11.0, averagePrice: 11.0,
    highPrice: 11.0, totalQuantity: 2880,
  },
  {
    payItemNumber: "807-12343", description: "CABLE, POLE CIRCUIT, XHHW, NO. 10 COPPER, STRANDED, 1/C",
    unit: "LFT", lowPrice: 1.1, averagePrice: 1.1,
    highPrice: 1.1, totalQuantity: 13470,
  },
  {
    payItemNumber: "807-12354", description: "METERED SERVICE POINT",
    unit: "EACH", lowPrice: 2500.0, averagePrice: 2500.0,
    highPrice: 2500.0, totalQuantity: 4,
  },
  {
    payItemNumber: "807-12398", description: "LIGHT POLE, 40 FT E.M.H., 15 FT MAST ARM, ANCHOR BASE",
    unit: "EACH", lowPrice: 4100.0, averagePrice: 4100.0,
    highPrice: 4100.0, totalQuantity: 4,
  },
  {
    payItemNumber: "807-12458", description: "LIGHT POLE, 25 FT E.M.H., 5 FT MAST ARM, ANCHOR BASE",
    unit: "EACH", lowPrice: 2261.52, averagePrice: 2261.52,
    highPrice: 2261.52, totalQuantity: 9,
  },
  {
    payItemNumber: "807-12555", description: "HIGH MAST TOWER, 90 FT E.M.H.",
    unit: "EACH", lowPrice: 50445.0, averagePrice: 50445.0,
    highPrice: 50445.0, totalQuantity: 1,
  },
  {
    payItemNumber: "807-12556", description: "HIGH MAST TOWER, 100 FT E.M.H.",
    unit: "EACH", lowPrice: 54088.0, averagePrice: 54088.0,
    highPrice: 54088.0, totalQuantity: 2,
  },
  {
    payItemNumber: "807-12558", description: "HIGH MAST TOWER, 110 FT E.M.H.",
    unit: "EACH", lowPrice: 57732.0, averagePrice: 57732.0,
    highPrice: 57732.0, totalQuantity: 1,
  },
  {
    payItemNumber: "807-12560", description: "HIGH MAST TOWER, 165 FT E.M.H.",
    unit: "EACH", lowPrice: 89252.0, averagePrice: 89252.0,
    highPrice: 89252.0, totalQuantity: 1,
  },
  {
    payItemNumber: "807-12663", description: "LIGHT POLE, 40 FT E.M.H., 20 FT MAST ARM, ANCHOR BASE",
    unit: "EACH", lowPrice: 3921.0, averagePrice: 3921.0,
    highPrice: 3921.0, totalQuantity: 112,
  },
  {
    payItemNumber: "807-12733", description: "HANDHOLE, ATMS",
    unit: "EACH", lowPrice: 2610.0, averagePrice: 4104.94,
    highPrice: 6966.0, totalQuantity: 53,
  },
  {
    payItemNumber: "807-12760", description: "ROUTINE MAINTENANCE, HIGH MAST",
    unit: "MOS", lowPrice: 12.0, averagePrice: 12.0,
    highPrice: 12.0, totalQuantity: 912,
  },
  {
    payItemNumber: "807-12791", description: "LIGHTING FOUNDATION, CONVENTIONAL POLE, CONCRETE, WITH GROUN DING",
    unit: "EACH", lowPrice: 1627.64, averagePrice: 1930.3,
    highPrice: 3500.0, totalQuantity: 784,
  },
  {
    payItemNumber: "807-12792", description: "LIGHTING FOUNDATION, HIGH MAST TOWER, CONCRETE, WITH GROUNDI NG",
    unit: "EACH", lowPrice: 40000.0, averagePrice: 49308.97,
    highPrice: 50741.12, totalQuantity: 15,
  },
  {
    payItemNumber: "807-12794", description: "LIGHTING FOUNDATION, 45 IN. BARRIER WALL, CONCRETE WITH GROU ND",
    unit: "EACH", lowPrice: 6414.85, averagePrice: 6414.85,
    highPrice: 6414.85, totalQuantity: 2,
  },
  {
    payItemNumber: "807-12907", description: "GROUND MOUNTED ELECTRICAL UNIT, RELOCATE",
    unit: "EACH", lowPrice: 1093.2, averagePrice: 1093.2,
    highPrice: 1093.2, totalQuantity: 3,
  },
  {
    payItemNumber: "807-12962", description: "LED DRIVER REPLACEMENT",
    unit: "EACH", lowPrice: 300.0, averagePrice: 300.0,
    highPrice: 300.0, totalQuantity: 20,
  },
  {
    payItemNumber: "807-78590", description: "HANDHOLE",
    unit: "EACH", lowPrice: 2000.0, averagePrice: 2401.03,
    highPrice: 3358.37, totalQuantity: 94,
  },
  {
    payItemNumber: "807-82051", description: "CIRCUIT INSTALLATION, UNDERPASS, 1 LUMINAIRES",
    unit: "EACH", lowPrice: 2451.8, averagePrice: 2451.8,
    highPrice: 2451.8, totalQuantity: 1,
  },
  {
    payItemNumber: "807-82053", description: "CIRCUIT INSTALLATION, UNDERPASS, 3 LUMINAIRES",
    unit: "EACH", lowPrice: 9036.0, averagePrice: 9036.0,
    highPrice: 9036.0, totalQuantity: 2,
  },
  {
    payItemNumber: "807-82054", description: "CIRCUIT INSTALLATION, UNDERPASS, 4 LUMINAIRES",
    unit: "EACH", lowPrice: 11283.0, averagePrice: 11283.0,
    highPrice: 11283.0, totalQuantity: 1,
  },
  {
    payItemNumber: "807-82160", description: "HIGH MAST TOWER, 95 FT E.M.H.",
    unit: "EACH", lowPrice: 52055.0, averagePrice: 52055.0,
    highPrice: 52055.0, totalQuantity: 5,
  },
  {
    payItemNumber: "807-82520", description: "HIGH MAST TOWER, 140 FT E.M.H.",
    unit: "EACH", lowPrice: 73812.0, averagePrice: 124604.0,
    highPrice: 150000.0, totalQuantity: 3,
  },
  {
    payItemNumber: "807-82600", description: "HIGH MAST TOWER, 150 FT E.M.H.",
    unit: "EACH", lowPrice: 81676.0, averagePrice: 81676.0,
    highPrice: 81676.0, totalQuantity: 2,
  },
  {
    payItemNumber: "807-83752", description: "LIGHT POLE, 40 FT E.M.H., 10 FT MAST ARM, ANCHOR BASE",
    unit: "EACH", lowPrice: 4000.0, averagePrice: 4000.0,
    highPrice: 4000.0, totalQuantity: 10,
  },
  {
    payItemNumber: "807-85480", description: "LIGHT POLE, 30 FT E.M.H., 5 FT MAST ARM, BREAKAWAY BASE",
    unit: "EACH", lowPrice: 2772.39, averagePrice: 10407.16,
    highPrice: 14000.0, totalQuantity: 50,
  },
  {
    payItemNumber: "807-85488", description: "LIGHT POLE, 30 FT E.M.H., 8 FT MAST ARM, BREAKAWAY BASE",
    unit: "EACH", lowPrice: 3735.0, averagePrice: 3735.0,
    highPrice: 3735.0, totalQuantity: 12,
  },
  {
    payItemNumber: "807-85502", description: "LIGHT POLE, 30 FT E.M.H., 15 FT MAST ARM, BREAKAWAY BASE",
    unit: "EACH", lowPrice: 4115.0, averagePrice: 4115.0,
    highPrice: 4115.0, totalQuantity: 9,
  },
  {
    payItemNumber: "807-85740", description: "LIGHT POLE, 40 FT E.M.H., 5 FT MAST ARM, BREAKAWAY BASE",
    unit: "EACH", lowPrice: 3611.17, averagePrice: 3611.17,
    highPrice: 3611.17, totalQuantity: 6,
  },
  {
    payItemNumber: "807-85752", description: "LIGHT POLE, 40 FT E.M.H., 10 FT MAST ARM, BREAKAWAY BASE",
    unit: "EACH", lowPrice: 3800.0, averagePrice: 5797.07,
    highPrice: 6000.0, totalQuantity: 54,
  },
  {
    payItemNumber: "807-85756", description: "LIGHT POLE, 40 FT E.M.H., 12 FT MAST ARM, BREAKAWAY BASE",
    unit: "EACH", lowPrice: 3800.0, averagePrice: 3800.0,
    highPrice: 3800.0, totalQuantity: 9,
  },
  {
    payItemNumber: "807-85762", description: "LIGHT POLE, 40 FT E.M.H., 15 FT MAST ARM, BREAKAWAY BASE",
    unit: "EACH", lowPrice: 3500.0, averagePrice: 3559.3,
    highPrice: 4200.0, totalQuantity: 640,
  },
  {
    payItemNumber: "807-86605", description: "LUMINAIRE, ROADWAY, HIGH PRESSURE SODIUM, 150 WATT",
    unit: "EACH", lowPrice: 1.0, averagePrice: 1.0,
    highPrice: 1.0, totalQuantity: 1,
  },
  {
    payItemNumber: "807-86615", description: "LUMINAIRE, ROADWAY, HIGH PRESSURE SODIUM, 250 WATT",
    unit: "EACH", lowPrice: 1.0, averagePrice: 909.18,
    highPrice: 1000.0, totalQuantity: 11,
  },
  {
    payItemNumber: "807-86620", description: "LUMINAIRE, ROADWAY, HIGH PRESSURE SODIUM, 400 WATT SODIUM, 400 WATT",
    unit: "EACH", lowPrice: 1.0, averagePrice: 980.41,
    highPrice: 1000.0, totalQuantity: 51,
  },
  {
    payItemNumber: "807-86665", description: "LUMINAIRE, HIGH MAST, HIGH PRESSURE SODIUM, 1000 WATT",
    unit: "EACH", lowPrice: 1.0, averagePrice: 1.0,
    highPrice: 1.0, totalQuantity: 1,
  },
  {
    payItemNumber: "807-86805", description: "SERVICE POINT, TYPE  I",
    unit: "EACH", lowPrice: 3000.0, averagePrice: 8621.87,
    highPrice: 14000.0, totalQuantity: 34,
  },
  {
    payItemNumber: "807-86810", description: "SERVICE POINT, TYPE II",
    unit: "EACH", lowPrice: 2521.85, averagePrice: 7675.23,
    highPrice: 15000.0, totalQuantity: 84,
  },
  {
    payItemNumber: "807-86843", description: "WIRE, NO. 4 COPPER, 1/C",
    unit: "LFT", lowPrice: 2.8, averagePrice: 5.09,
    highPrice: 6.6, totalQuantity: 24838,
  },
  {
    payItemNumber: "807-86889", description: "CABLE, POLE CIRCUIT, THWN, NO. 10 COPPER, STRANDED 1/C COPPER",
    unit: "LFT", lowPrice: 0.8, averagePrice: 1.23,
    highPrice: 5.0, totalQuantity: 123913,
  },
  {
    payItemNumber: "807-86910", description: "CONNECTOR KIT, UNFUSED",
    unit: "EACH", lowPrice: 20.0, averagePrice: 61.25,
    highPrice: 200.0, totalQuantity: 482,
  },
  {
    payItemNumber: "807-86915", description: "CONNECTOR KIT, FUSED",
    unit: "EACH", lowPrice: 20.0, averagePrice: 63.43,
    highPrice: 200.0, totalQuantity: 697,
  },
  {
    payItemNumber: "807-86920", description: "MULTIPLE COMPRESSION FITTING, NON-WATERPROOFED",
    unit: "EACH", lowPrice: 20.0, averagePrice: 31.87,
    highPrice: 155.0, totalQuantity: 1121,
  },
  {
    payItemNumber: "807-86925", description: "MULTIPLE COMPRESSION FITTING, WATERPROOFED",
    unit: "EACH", lowPrice: 20.0, averagePrice: 57.01,
    highPrice: 155.0, totalQuantity: 387,
  },
  {
    payItemNumber: "807-86930", description: "INSULATION LINK, NON-WATERPROOFED",
    unit: "EACH", lowPrice: 13.1, averagePrice: 23.84,
    highPrice: 75.0, totalQuantity: 1063,
  },
  {
    payItemNumber: "807-86935", description: "INSULATION LINK, WATERPROOFED",
    unit: "EACH", lowPrice: 15.9, averagePrice: 38.92,
    highPrice: 80.0, totalQuantity: 715,
  },
  {
    payItemNumber: "807-86950", description: "SIGN, UNDERPASS, AND ROADWAY LIGHTING, LOCATION IDENTIFICATI ON",
    unit: "EACH", lowPrice: 10.0, averagePrice: 82.15,
    highPrice: 100.0, totalQuantity: 314,
  },
  {
    payItemNumber: "807-86955", description: "CABLE-DUCT MARKER",
    unit: "EACH", lowPrice: 50.0, averagePrice: 359.65,
    highPrice: 750.0, totalQuantity: 265,
  },
  {
    payItemNumber: "807-87022", description: "ROUTINE MAINTENANCE, LUMINAIRE, HIGH PRESSURE SODIUM, 400 WA TT",
    unit: "MOS", lowPrice: 10.0, averagePrice: 10.0,
    highPrice: 10.0, totalQuantity: 7764,
  },
  {
    payItemNumber: "807-87028", description: "ROUTINE MAINTENANCE, LUMINAIRE, HIGH PRESSURE SODIUM, 1000 W ATT",
    unit: "MOS", lowPrice: 16.0, averagePrice: 16.0,
    highPrice: 16.0, totalQuantity: 2232,
  },
  {
    payItemNumber: "807-87042", description: "ROUTINE MAINTENANCE, LUMINAIRE, HIGH PRESSURE SODIUM, UNDERP ASS, 150 WATT",
    unit: "MOS", lowPrice: 11.0, averagePrice: 11.0,
    highPrice: 11.0, totalQuantity: 300,
  },
  {
    payItemNumber: "807-87085", description: "ELECTRICIAN",
    unit: "HRS", lowPrice: 360.0, averagePrice: 383.02,
    highPrice: 475.0, totalQuantity: 116,
  },
  {
    payItemNumber: "807-87098", description: "CALLOUT REPAIR",
    unit: "EACH", lowPrice: 425.0, averagePrice: 450.0,
    highPrice: 500.0, totalQuantity: 15,
  },
  {
    payItemNumber: "807-87556", description: "WIRE, TW/THW, NO. 10 COPPER, STRANDED",
    unit: "LFT", lowPrice: 2.0, averagePrice: 2.6,
    highPrice: 3.0, totalQuantity: 2808,
  },
  {
    payItemNumber: "807-87595", description: "REPLACEMENT OF CABLE CLAMPS ON HIGH MAST TOWER LUMINAIRE, RI N",
    unit: "EACH", lowPrice: 40.0, averagePrice: 40.0,
    highPrice: 40.0, totalQuantity: 2,
  },
  {
    payItemNumber: "807-87635", description: "MAST ARM, INSTALL",
    unit: "EACH", lowPrice: 700.0, averagePrice: 700.0,
    highPrice: 700.0, totalQuantity: 5,
  },
  {
    payItemNumber: "807-87640", description: "BREAKAWAY COUPLING",
    unit: "SET", lowPrice: 650.0, averagePrice: 650.0,
    highPrice: 650.0, totalQuantity: 5,
  },
  {
    payItemNumber: "807-87650", description: "TRANSFORMER BASE, INSTALL",
    unit: "EACH", lowPrice: 1022.0, averagePrice: 1022.0,
    highPrice: 1022.0, totalQuantity: 1,
  },
  {
    payItemNumber: "807-87800", description: "CABLE DUCT, INSTALL",
    unit: "LFT", lowPrice: 5.5, averagePrice: 5.5,
    highPrice: 5.5, totalQuantity: 1000,
  },
  {
    payItemNumber: "807-91082", description: "LUMINAIRE, REMOVE AND RELOCATE",
    unit: "EACH", lowPrice: 5000.0, averagePrice: 5000.0,
    highPrice: 5000.0, totalQuantity: 2,
  },
  {
    payItemNumber: "807-91694", description: "NAVIGATION LIGHT, PIER",
    unit: "EACH", lowPrice: 675.0, averagePrice: 4135.0,
    highPrice: 5000.0, totalQuantity: 5,
  },
  {
    payItemNumber: "807-91696", description: "NAVIGATION LIGHT, CENTER CHANNEL",
    unit: "EACH", lowPrice: 675.0, averagePrice: 6935.0,
    highPrice: 8500.0, totalQuantity: 10,
  },
  {
    payItemNumber: "807-91698", description: "NAVIGATION LIGHT, FRESNEL LENS, 180 DEGREE SECTION DEGREE SECTION",
    unit: "EACH", lowPrice: 6500.0, averagePrice: 6500.0,
    highPrice: 6500.0, totalQuantity: 6,
  },
  {
    payItemNumber: "807-91699", description: "NAVIGATION LIGHT, FRESNEL LENS, 360 DEGREE SECTION DEGREE SECTION",
    unit: "EACH", lowPrice: 4000.0, averagePrice: 4625.0,
    highPrice: 6500.0, totalQuantity: 8,
  },
  {
    payItemNumber: "807-91704", description: "LIGHT POLE, HANDHOLE COVER",
    unit: "EACH", lowPrice: 35.0, averagePrice: 453.57,
    highPrice: 1500.0, totalQuantity: 7,
  },
  {
    payItemNumber: "807-91705", description: "CONDUIT, POLYETHYLENE REPAIR",
    unit: "EACH", lowPrice: 150.0, averagePrice: 150.0,
    highPrice: 150.0, totalQuantity: 2,
  },
  {
    payItemNumber: "807-92523", description: "SKIRTING, EXPANDED ALUMINUM",
    unit: "EACH", lowPrice: 200.0, averagePrice: 200.0,
    highPrice: 200.0, totalQuantity: 1,
  },
  {
    payItemNumber: "807-92870", description: "TRANSFORMER BASE, HANDHOLE",
    unit: "EACH", lowPrice: 200.0, averagePrice: 200.0,
    highPrice: 200.0, totalQuantity: 2,
  },
  {
    payItemNumber: "807-93647", description: "LUMINAIRE, POST TOP, HIGH PRESSURE SODIUM, 150 WATT",
    unit: "EACH", lowPrice: 1.0, averagePrice: 1.0,
    highPrice: 1.0, totalQuantity: 1,
  },
  {
    payItemNumber: "807-93649", description: "SHAFT FOR POST TOP LUMINAIRE, 16 FT M.H.",
    unit: "EACH", lowPrice: 1850.0, averagePrice: 1850.0,
    highPrice: 1850.0, totalQuantity: 1,
  },
  {
    payItemNumber: "807-93650", description: "FOUNDATION, ANCHOR BOLTS AND REINFORCING STEEL, FOR ROADWAY LIGHT",
    unit: "SET", lowPrice: 700.0, averagePrice: 700.0,
    highPrice: 700.0, totalQuantity: 2,
  },
  {
    payItemNumber: "807-93746", description: "TOWER RING, LIFT CABLE, 0.375",
    unit: "LFT", lowPrice: 4.0, averagePrice: 4.0,
    highPrice: 4.0, totalQuantity: 150,
  },
  {
    payItemNumber: "807-94480", description: "LIGHT STANDARD, INSTALL",
    unit: "EACH", lowPrice: 1600.0, averagePrice: 1600.0,
    highPrice: 1600.0, totalQuantity: 20,
  },
  {
    payItemNumber: "807-95078", description: "TRANSFORMER BASE",
    unit: "EACH", lowPrice: 1105.0, averagePrice: 1334.69,
    highPrice: 1350.0, totalQuantity: 16,
  },
  {
    payItemNumber: "807-95488", description: "NEMA 4/5 UNDERPASS OR SIGN CIRCUIT BREAKER, ENCLOSURE",
    unit: "EACH", lowPrice: 945.0, averagePrice: 963.33,
    highPrice: 1000.0, totalQuantity: 3,
  },
  {
    payItemNumber: "807-95492", description: "SERVICE POINT, II, BREAKER ENCLOSURE",
    unit: "EACH", lowPrice: 1000.0, averagePrice: 1000.0,
    highPrice: 1000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "807-95509", description: "GLARE SHIELD",
    unit: "EACH", lowPrice: 500.0, averagePrice: 500.0,
    highPrice: 500.0, totalQuantity: 1,
  },
  {
    payItemNumber: "807-95513", description: "SERVICE POINT, MAIN BREAKER",
    unit: "EACH", lowPrice: 550.0, averagePrice: 560.0,
    highPrice: 600.0, totalQuantity: 5,
  },
  {
    payItemNumber: "807-95514", description: "SERVICE POINT, RISER",
    unit: "EACH", lowPrice: 500.0, averagePrice: 500.0,
    highPrice: 500.0, totalQuantity: 1,
  },
  {
    payItemNumber: "807-95515", description: "SERVICE POINT, WEATHERHEAD",
    unit: "EACH", lowPrice: 20.0, averagePrice: 20.0,
    highPrice: 20.0, totalQuantity: 1,
  },
  {
    payItemNumber: "807-95516", description: "RELAY SWITCH",
    unit: "EACH", lowPrice: 600.0, averagePrice: 657.14,
    highPrice: 800.0, totalQuantity: 7,
  },
  {
    payItemNumber: "807-95522", description: "PIPE STRAP",
    unit: "EACH", lowPrice: 50.0, averagePrice: 50.0,
    highPrice: 50.0, totalQuantity: 10,
  },
  {
    payItemNumber: "807-95523", description: "WATERPROOFING OF ELECTRICAL CONNECTOR",
    unit: "EACH", lowPrice: 100.0, averagePrice: 100.0,
    highPrice: 100.0, totalQuantity: 25,
  },
  {
    payItemNumber: "807-95525", description: "LIGHTING SUPPORT",
    unit: "EACH", lowPrice: 100.0, averagePrice: 132.0,
    highPrice: 155.0, totalQuantity: 5,
  },
  {
    payItemNumber: "807-95705", description: "BREAKAWAY ALUMINUM TRANSFORMER BASE",
    unit: "EACH", lowPrice: 1350.0, averagePrice: 1350.0,
    highPrice: 1350.0, totalQuantity: 20,
  },
  {
    payItemNumber: "807-95709", description: "PHOTOCELLS",
    unit: "EACH", lowPrice: 5.0, averagePrice: 77.5,
    highPrice: 150.0, totalQuantity: 2,
  },
  {
    payItemNumber: "807-95889", description: "WIRE, NO. 10 COPPER, 1/C",
    unit: "LFT", lowPrice: 1.0, averagePrice: 1.93,
    highPrice: 3.0, totalQuantity: 7440,
  },
  {
    payItemNumber: "807-96183", description: "SHAFT FOR 30 FT M.H., TWIN 10 FT MAST ARM",
    unit: "EACH", lowPrice: 3225.0, averagePrice: 3225.0,
    highPrice: 3225.0, totalQuantity: 1,
  },
  {
    payItemNumber: "807-96184", description: "SHAFT FOR 30 FT M.H., TWIN 12 FT MAST ARM",
    unit: "EACH", lowPrice: 3225.0, averagePrice: 3225.0,
    highPrice: 3225.0, totalQuantity: 1,
  },
  {
    payItemNumber: "807-96194", description: "ROUTINE MAINTENANCE, LUMINAIRE, HIGH PRESSURE SODIUM, 250 WA TT",
    unit: "MOS", lowPrice: 10.0, averagePrice: 10.0,
    highPrice: 10.0, totalQuantity: 588,
  },
  {
    payItemNumber: "807-96203", description: "LIGHT POLE, HIGH MAST, TOWER SUSPENSION CABLE",
    unit: "EACH", lowPrice: 2000.0, averagePrice: 2000.0,
    highPrice: 2000.0, totalQuantity: 3,
  },
  {
    payItemNumber: "807-96204", description: "LOWERING AND RAISING OF TOWER",
    unit: "EACH", lowPrice: 9000.0, averagePrice: 9000.0,
    highPrice: 9000.0, totalQuantity: 2,
  },
  {
    payItemNumber: "807-96236", description: "LIGHT POLE, HIGH MAST TOWER, POWER CABLE",
    unit: "EACH", lowPrice: 2000.0, averagePrice: 2000.0,
    highPrice: 2000.0, totalQuantity: 2,
  },
  {
    payItemNumber: "807-96868", description: "LUMINAIRE, INSTALL",
    unit: "EACH", lowPrice: 155.0, averagePrice: 158.29,
    highPrice: 600.0, totalQuantity: 676,
  },
  {
    payItemNumber: "807-97237", description: "WIRE, NO. 4 COPPER, IN PLASTIC DUCT, 4 1/C CONDUIT, 4 1/C",
    unit: "LFT", lowPrice: 15.95, averagePrice: 19.66,
    highPrice: 25.0, totalQuantity: 83070,
  },
  {
    payItemNumber: "807-97619", description: "HIGH MAST TOWER, RETROFIT",
    unit: "EACH", lowPrice: 4500.0, averagePrice: 4500.0,
    highPrice: 4500.0, totalQuantity: 5,
  },
  {
    payItemNumber: "807-98690", description: "HANDHOLE, ADJUST TO GRADE",
    unit: "EACH", lowPrice: 1500.0, averagePrice: 1500.0,
    highPrice: 1500.0, totalQuantity: 1,
  },
  {
    payItemNumber: "807-98716", description: "KELLUM GRIP STAINLESS STEEL",
    unit: "EACH", lowPrice: 100.0, averagePrice: 100.0,
    highPrice: 100.0, totalQuantity: 1,
  },
  {
    payItemNumber: "807-99338", description: "WIRE, NO. 6 COPPER, GROUND, 1/C",
    unit: "LFT", lowPrice: 2.86, averagePrice: 2.86,
    highPrice: 2.86, totalQuantity: 500,
  },
  {
    payItemNumber: "808-01226", description: "SNOWPLOWABLE RAISED PAVEMENT MARKER CASTING INSTALL",
    unit: "EACH", lowPrice: 1000.0, averagePrice: 1000.0,
    highPrice: 1000.0, totalQuantity: 2,
  },
  {
    payItemNumber: "808-01329", description: "PAVEMENT MESSAGE MARKING, THERMOPLASTIC, WRONG WAY RAMP ARRO W",
    unit: "EACH", lowPrice: 344.0, averagePrice: 344.0,
    highPrice: 344.0, totalQuantity: 6,
  },
  {
    payItemNumber: "808-01428", description: "TEMPORARY TRANSVERSE MARKINGS WHITE STOP LINE 24 IN.",
    unit: "LFT", lowPrice: 10.09, averagePrice: 16.2,
    highPrice: 18.0, totalQuantity: 992,
  },
  {
    payItemNumber: "808-02066", description: "TRANSVERSE MARKING, THERMOPLASTIC, CROSSHATCH LINE, WHITE, 6  IN.",
    unit: "LFT", lowPrice: 1.95, averagePrice: 2.83,
    highPrice: 6.0, totalQuantity: 277,
  },
  {
    payItemNumber: "808-02977", description: "PAVEMENT MESSAGE MARKING, THERMOPLASTIC, BIKE SYMBOL",
    unit: "EACH", lowPrice: 402.0, averagePrice: 466.43,
    highPrice: 525.0, totalQuantity: 63,
  },
  {
    payItemNumber: "808-03179", description: "PAVEMENT MESSAGE MARKING, PREFORMED PLASTIC, WORD ONLY",
    unit: "EACH", lowPrice: 195.0, averagePrice: 195.0,
    highPrice: 195.0, totalQuantity: 3,
  },
  {
    payItemNumber: "808-03439", description: "TRANSVERSE MARKING, THERMOPLASTIC, CROSSWALK LINE, WHITE, 24  IN.",
    unit: "LFT", lowPrice: 4.0, averagePrice: 10.66,
    highPrice: 17.0, totalQuantity: 20288,
  },
  {
    payItemNumber: "808-04723", description: "LINE, THERMOPLASTIC, FOR BUZZ STRIPS, 4 IN.",
    unit: "LFT", lowPrice: 10.0, averagePrice: 10.0,
    highPrice: 10.0, totalQuantity: 288,
  },
  {
    payItemNumber: "808-05866", description: "PAVEMENT MESSAGE MARKING, REMOVE",
    unit: "SYS", lowPrice: 17.95, averagePrice: 54.09,
    highPrice: 195.0, totalQuantity: 1112,
  },
  {
    payItemNumber: "808-05929", description: "TRANSVERSE MARKING, THERMOPLASTIC, CROSSWALK LINE, WHITE, 8 IN.",
    unit: "LFT", lowPrice: 4.5, averagePrice: 4.5,
    highPrice: 4.5, totalQuantity: 1475,
  },
  {
    payItemNumber: "808-06368", description: "TRANSVERSE MARKING, REMOVE",
    unit: "LFT", lowPrice: 3.55, averagePrice: 5.41,
    highPrice: 38.82, totalQuantity: 14880,
  },
  {
    payItemNumber: "808-06540", description: "TRANSVERSE MARKING, PREFORMED PLASTIC, CROSSWALK LINE, WHITE , 12 IN.",
    unit: "LFT", lowPrice: 11.85, averagePrice: 11.92,
    highPrice: 12.0, totalQuantity: 424,
  },
  {
    payItemNumber: "808-06609", description: "PAVEMENT MESSAGE MARKING",
    unit: "EACH", lowPrice: 320.0, averagePrice: 1203.19,
    highPrice: 1647.0, totalQuantity: 69,
  },
  {
    payItemNumber: "808-06694", description: "LINE, PAINT, SOLID, YELLOW, 8 IN.",
    unit: "LFT", lowPrice: 0.87, averagePrice: 0.87,
    highPrice: 0.87, totalQuantity: 176,
  },
  {
    payItemNumber: "808-06701", description: "LINE, THERMOPLASTIC, BROKEN, WHITE, 4 IN.",
    unit: "LFT", lowPrice: 1.0, averagePrice: 1.3,
    highPrice: 4.11, totalQuantity: 1105,
  },
  {
    payItemNumber: "808-06703", description: "LINE, THERMOPLASTIC, SOLID, WHITE, 4 IN.",
    unit: "LFT", lowPrice: 0.65, averagePrice: 0.73,
    highPrice: 6.0, totalQuantity: 1065611,
  },
  {
    payItemNumber: "808-06705", description: "LINE, THERMOPLASTIC, SOLID, WHITE, 8 IN.",
    unit: "LFT", lowPrice: 1.28, averagePrice: 1.65,
    highPrice: 3.01, totalQuantity: 3140,
  },
  {
    payItemNumber: "808-06706", description: "LINE, THERMOPLASTIC, SOLID, WHITE, 24 IN.",
    unit: "LFT", lowPrice: 8.0, averagePrice: 8.0,
    highPrice: 8.0, totalQuantity: 344,
  },
  {
    payItemNumber: "808-06711", description: "LINE, PAINT, BROKEN, WHITE, 4 IN.",
    unit: "LFT", lowPrice: 1.0, averagePrice: 1.0,
    highPrice: 1.0, totalQuantity: 455,
  },
  {
    payItemNumber: "808-06712", description: "LINE, PAINT, BROKEN, YELLOW, 4 IN.",
    unit: "LFT", lowPrice: 1.0, averagePrice: 1.48,
    highPrice: 57.5, totalQuantity: 2119,
  },
  {
    payItemNumber: "808-06713", description: "LINE, PAINT, SOLID, WHITE, 4 IN.",
    unit: "LFT", lowPrice: 0.5, averagePrice: 0.98,
    highPrice: 29.0, totalQuantity: 48134,
  },
  {
    payItemNumber: "808-06714", description: "LINE, PAINT, SOLID, YELLOW, 4 IN.",
    unit: "LFT", lowPrice: 0.39, averagePrice: 0.89,
    highPrice: 29.0, totalQuantity: 45863,
  },
  {
    payItemNumber: "808-06716", description: "LINE, REMOVE",
    unit: "LFT", lowPrice: 0.3, averagePrice: 0.5,
    highPrice: 10.54, totalQuantity: 3846032,
  },
  {
    payItemNumber: "808-06723", description: "PAVEMENT MESSAGE MARKING, PAINT, LANE INDICATION ARROW",
    unit: "EACH", lowPrice: 97.0, averagePrice: 145.42,
    highPrice: 221.0, totalQuantity: 19,
  },
  {
    payItemNumber: "808-06724", description: "PAVEMENT MESSAGE MARKING, PAINT, ONLY",
    unit: "EACH", lowPrice: 122.0, averagePrice: 192.14,
    highPrice: 332.0, totalQuantity: 7,
  },
  {
    payItemNumber: "808-06726", description: "TRANSVERSE MARKING, PAINT, STOP LINE, WHITE, 24 IN. STOP LINE, 24\"",
    unit: "LFT", lowPrice: 3.6, averagePrice: 6.27,
    highPrice: 15.11, totalQuantity: 610,
  },
  {
    payItemNumber: "808-09314", description: "LINE, PAINT, SOLID, BLUE, 4 IN.",
    unit: "LFT", lowPrice: 1.25, averagePrice: 5.29,
    highPrice: 7.5, totalQuantity: 426,
  },
  {
    payItemNumber: "808-09381", description: "RETRO-REFLECTIVITY TESTING",
    unit: "LS", lowPrice: 1.0, averagePrice: 4063.1,
    highPrice: 22580.0, totalQuantity: 92,
  },
  {
    payItemNumber: "808-09968", description: "PAVEMENT MARKING",
    unit: "SFT", lowPrice: 10.0, averagePrice: 12.51,
    highPrice: 36.75, totalQuantity: 7374,
  },
  {
    payItemNumber: "808-10031", description: "LINE, MULTI-COMPONENT, BROKEN, WHITE, 4 IN.",
    unit: "LFT", lowPrice: 1.21, averagePrice: 1.74,
    highPrice: 2.47, totalQuantity: 4161,
  },
  {
    payItemNumber: "808-10032", description: "LINE, MULTI-COMPONENT, DOTTED, WHITE, 8 IN.",
    unit: "LFT", lowPrice: 2.1, averagePrice: 2.45,
    highPrice: 6.95, totalQuantity: 1763,
  },
  {
    payItemNumber: "808-10033", description: "LINE, MULTI-COMPONENT, SOLID, WHITE, 4 IN.",
    unit: "LFT", lowPrice: 0.55, averagePrice: 0.78,
    highPrice: 5.5, totalQuantity: 109227,
  },
  {
    payItemNumber: "808-10034", description: "LINE, MULTI-COMPONENT, SOLID, YELLOW, 4 IN.",
    unit: "LFT", lowPrice: 0.55, averagePrice: 0.8,
    highPrice: 5.5, totalQuantity: 107794,
  },
  {
    payItemNumber: "808-10036", description: "LINE, MULTI-COMPONENT, BROKEN, YELLOW, 4 IN.",
    unit: "LFT", lowPrice: 0.6, averagePrice: 0.95,
    highPrice: 4.61, totalQuantity: 2746,
  },
  {
    payItemNumber: "808-10037", description: "LINE, MULTI-COMPONENT, SOLID, WHITE, 8 IN.",
    unit: "LFT", lowPrice: 1.95, averagePrice: 2.17,
    highPrice: 4.09, totalQuantity: 1458,
  },
  {
    payItemNumber: "808-10038", description: "TRANSVERSE MARKING, MULTI-COMPONENT, CROSSHATCH LINE, WHITE,  24 IN.",
    unit: "LFT", lowPrice: 13.22, averagePrice: 15.81,
    highPrice: 20.0, totalQuantity: 3318,
  },
  {
    payItemNumber: "808-10039", description: "LINE, MULTI-COMPONENT, SOLID, WHITE, 12 IN.",
    unit: "LFT", lowPrice: 4.97, averagePrice: 4.97,
    highPrice: 4.97, totalQuantity: 82,
  },
  {
    payItemNumber: "808-10042", description: "TRANSVERSE MARKING, MULTI-COMPONENT, CROSSHATCH LINE, YELLOW , 12 IN.",
    unit: "LFT", lowPrice: 6.0, averagePrice: 7.31,
    highPrice: 9.01, totalQuantity: 1849,
  },
  {
    payItemNumber: "808-10043", description: "LINE, MULTI-COMPONENT, SOLID, WHITE, 24 IN.",
    unit: "LFT", lowPrice: 6.48, averagePrice: 10.09,
    highPrice: 15.0, totalQuantity: 295,
  },
  {
    payItemNumber: "808-10047", description: "TRANSVERSE MARKING, MULTI-COMPONENT, CROSSHATCH LINE, WHITE,  12 IN.",
    unit: "LFT", lowPrice: 6.0, averagePrice: 7.73,
    highPrice: 12.0, totalQuantity: 3748,
  },
  {
    payItemNumber: "808-10049", description: "LINE, MULTI-COMPONENT, SOLID, WHITE, 6 IN.",
    unit: "LFT", lowPrice: 0.5, averagePrice: 0.95,
    highPrice: 16.0, totalQuantity: 2213048,
  },
  {
    payItemNumber: "808-10051", description: "TRANSVERSE MARKING, MULTI-COMPONENT, STOP LINE, WHITE, 24 IN .",
    unit: "LFT", lowPrice: 5.95, averagePrice: 12.49,
    highPrice: 20.0, totalQuantity: 7016,
  },
  {
    payItemNumber: "808-10052", description: "PAVEMENT MESSAGE MARKING, MULTI-COMPONENT, ONLY",
    unit: "EACH", lowPrice: 175.0, averagePrice: 329.62,
    highPrice: 455.0, totalQuantity: 8,
  },
  {
    payItemNumber: "808-10053", description: "PAVEMENT MESSAGE MARKING, MULTI-COMPONENT, RXR (R X R)",
    unit: "EACH", lowPrice: 190.0, averagePrice: 607.29,
    highPrice: 1500.0, totalQuantity: 17,
  },
  {
    payItemNumber: "808-10056", description: "TRANSVERSE MARKING, MULTI-COMPONENT, CROSSWALK LINE, WHITE, 6 IN.",
    unit: "LFT", lowPrice: 1.48, averagePrice: 4.14,
    highPrice: 6.0, totalQuantity: 5024,
  },
  {
    payItemNumber: "808-10057", description: "LINE, MULTI-COMPONENT, SOLID, YELLOW, 6 IN.",
    unit: "LFT", lowPrice: 0.69, averagePrice: 0.97,
    highPrice: 10.0, totalQuantity: 1565958,
  },
  {
    payItemNumber: "808-10058", description: "LINE, MULTI-COMPONENT, SOLID, YELLOW, 8 IN.",
    unit: "LFT", lowPrice: 1.77, averagePrice: 1.91,
    highPrice: 4.81, totalQuantity: 2753,
  },
  {
    payItemNumber: "808-10059", description: "LINE, MULTI-COMPONENT, SOLID, YELLOW, 12 IN.",
    unit: "LFT", lowPrice: 7.44, averagePrice: 7.44,
    highPrice: 7.44, totalQuantity: 15,
  },
  {
    payItemNumber: "808-10063", description: "LINE, MULTI-COMPONENT, DOTTED, YELLOW, 6 IN.",
    unit: "LFT", lowPrice: 1.0, averagePrice: 2.1,
    highPrice: 5.25, totalQuantity: 537,
  },
  {
    payItemNumber: "808-10064", description: "PAVEMENT MESSAGE MARKING, MULTI-COMPONENT, ADA ACCESIBLE SYM BOL",
    unit: "EACH", lowPrice: 700.0, averagePrice: 700.0,
    highPrice: 700.0, totalQuantity: 18,
  },
  {
    payItemNumber: "808-10071", description: "LINE, MULTI-COMPONENT, BROKEN, WHITE, 6 IN. WHITE, 6 IN",
    unit: "LFT", lowPrice: 0.79, averagePrice: 1.16,
    highPrice: 50.0, totalQuantity: 214773,
  },
  {
    payItemNumber: "808-10074", description: "TRANSVERSE MARKING, MULTI-COMPONENT, CROSSWALK LINE, WHITE, 8 IN.",
    unit: "LFT", lowPrice: 5.0, averagePrice: 5.0,
    highPrice: 5.0, totalQuantity: 62,
  },
  {
    payItemNumber: "808-10077", description: "PAVEMENT MESSAGE MARKING, MULTI-COMPONENT, LANE INDICATION A RROW",
    unit: "EACH", lowPrice: 115.0, averagePrice: 189.22,
    highPrice: 450.0, totalQuantity: 408,
  },
  {
    payItemNumber: "808-10097", description: "TRANSVERSE MARKING, MULTI-COMPONENT, YIELD LINE, WHITE, 27 I N.",
    unit: "LFT", lowPrice: 27.06, averagePrice: 27.06,
    highPrice: 27.06, totalQuantity: 64,
  },
  {
    payItemNumber: "808-10099", description: "TRANSVERSE MARKING, MULTI-COMPONENT, CROSSWALK LINE, WHITE, 24 IN.",
    unit: "LFT", lowPrice: 9.95, averagePrice: 12.55,
    highPrice: 15.0, totalQuantity: 3275,
  },
  {
    payItemNumber: "808-10101", description: "TRANSVERSE MARKING, MULTI-COMPONENT, CROSSHATCH LINE, WHITE,  8 IN.",
    unit: "LFT", lowPrice: 4.97, averagePrice: 4.97,
    highPrice: 4.97, totalQuantity: 180,
  },
  {
    payItemNumber: "808-10118", description: "TRANSVERSE MARKING, THERMOPLASTIC, YIELD LINE, WHITE, 24 IN. 24 IN.",
    unit: "LFT", lowPrice: 10.0, averagePrice: 12.09,
    highPrice: 48.84, totalQuantity: 1371,
  },
  {
    payItemNumber: "808-10119", description: "TRANSVERSE MARKING, MULTI-COMPONENT, CROSSHATCH LINE, YELLOW , 24 IN.",
    unit: "LFT", lowPrice: 9.95, averagePrice: 12.74,
    highPrice: 20.0, totalQuantity: 6307,
  },
  {
    payItemNumber: "808-10192", description: "PAVEMENT MESSAGE MARKING, MULTI-COMPONENT, BIKE SYMBOL BIKE SYMBOL",
    unit: "EACH", lowPrice: 185.0, averagePrice: 229.92,
    highPrice: 331.0, totalQuantity: 26,
  },
  {
    payItemNumber: "808-11401", description: "TRANSVERSE MARKING, PREFORMED PLASTIC, YIELD LINE, WHITE, 24  IN.",
    unit: "LFT", lowPrice: 26.0, averagePrice: 26.0,
    highPrice: 26.0, totalQuantity: 15,
  },
  {
    payItemNumber: "808-11481", description: "LINE, MULTI-COMPONENT, DOTTED, WHITE, 4 IN.",
    unit: "LFT", lowPrice: 4.22, averagePrice: 4.22,
    highPrice: 4.22, totalQuantity: 325,
  },
  {
    payItemNumber: "808-11482", description: "LINE, THERMOPLASTIC, DOTTED, WHITE, 4 IN.",
    unit: "LFT", lowPrice: 0.99, averagePrice: 1.68,
    highPrice: 6.94, totalQuantity: 409,
  },
  {
    payItemNumber: "808-11548", description: "LINE, MULTI-COMPONENT, DOTTED, YELLOW, 4 IN.",
    unit: "LFT", lowPrice: 3.22, averagePrice: 3.22,
    highPrice: 3.22, totalQuantity: 126,
  },
  {
    payItemNumber: "808-11650", description: "LINE, THERMOPLASTIC, DOTTED, WHITE, 6 IN.",
    unit: "LFT", lowPrice: 1.0, averagePrice: 2.31,
    highPrice: 19.95, totalQuantity: 7934,
  },
  {
    payItemNumber: "808-11691", description: "LINE, THERMOPLASTIC, DOTTED, WHITE, 12 IN.",
    unit: "LFT", lowPrice: 2.84, averagePrice: 5.6,
    highPrice: 8.86, totalQuantity: 465,
  },
  {
    payItemNumber: "808-11698", description: "TRANSVERSE MARKING, THERMOPLASTIC, YIELD LINE, WHITE, 27 IN. YIELD, WHITE, 27 IN.",
    unit: "LFT", lowPrice: 10.5, averagePrice: 20.91,
    highPrice: 52.5, totalQuantity: 728,
  },
  {
    payItemNumber: "808-11723", description: "STAMPED ASPHALT",
    unit: "SFT", lowPrice: 24.0, averagePrice: 24.0,
    highPrice: 24.0, totalQuantity: 3798,
  },
  {
    payItemNumber: "808-11727", description: "PAVEMENT MESSAGE MARKING, MULTI-COMPONENT, SHARED LANE SHARED LANE",
    unit: "EACH", lowPrice: 345.0, averagePrice: 406.94,
    highPrice: 425.0, totalQuantity: 62,
  },
  {
    payItemNumber: "808-11776", description: "TRANSVERSE MARKING, MULTI-COMPONENT, YIELD LINE, WHITE, 24 I N.",
    unit: "LFT", lowPrice: 12.0, averagePrice: 17.89,
    highPrice: 29.21, totalQuantity: 132,
  },
  {
    payItemNumber: "808-11953", description: "TRANSVERSE MARKING, THERMOPLASTIC, YIELD LINE, WHITE, 18 IN. 18 IN.",
    unit: "LFT", lowPrice: 15.6, averagePrice: 15.6,
    highPrice: 15.6, totalQuantity: 30,
  },
  {
    payItemNumber: "808-11959", description: "LINE, PAINT, DOTTED, WHITE, 8 IN.",
    unit: "LFT", lowPrice: 1.25, averagePrice: 1.25,
    highPrice: 1.25, totalQuantity: 4100,
  },
  {
    payItemNumber: "808-11960", description: "TRANSVERSE MARKING, PAINT, CROSSWALK LINE, WHITE, 24 IN. 24 IN.",
    unit: "LFT", lowPrice: 3.6, averagePrice: 3.6,
    highPrice: 3.6, totalQuantity: 1144,
  },
  {
    payItemNumber: "808-12032", description: "GROOVING FOR PAVEMENT MARKINGS",
    unit: "LFT", lowPrice: 0.1, averagePrice: 0.56,
    highPrice: 10.0, totalQuantity: 6798134,
  },
  {
    payItemNumber: "808-12134", description: "LINE, PREFORMED PLASTIC, DOTTED, WHITE, 4 IN.",
    unit: "LFT", lowPrice: 6.5, averagePrice: 6.5,
    highPrice: 6.5, totalQuantity: 48,
  },
  {
    payItemNumber: "808-12148", description: "TRANSVERSE MARKING, THERMOPLASTIC, YIELD LINE, WHITE, 36 IN.",
    unit: "LFT", lowPrice: 17.28, averagePrice: 20.46,
    highPrice: 36.0, totalQuantity: 458,
  },
  {
    payItemNumber: "808-12273", description: "TRANSVERSE MARKING, THERMOPLASTIC, PARKING LINE, WHITE, 4 IN .",
    unit: "LFT", lowPrice: 2.34, averagePrice: 4.61,
    highPrice: 14.0, totalQuantity: 5350,
  },
  {
    payItemNumber: "808-12274", description: "TRANSVERSE MARKING, THERMOPLASTIC, PARKING LINE, BLUE 4 IN.",
    unit: "LFT", lowPrice: 4.5, averagePrice: 6.78,
    highPrice: 20.4, totalQuantity: 3391,
  },
  {
    payItemNumber: "808-12349", description: "TRANSVERSE MARKING, MULTI-COMPONENT, YIELD LINE, WHITE, 36 I N.",
    unit: "LFT", lowPrice: 22.61, averagePrice: 22.61,
    highPrice: 22.61, totalQuantity: 80,
  },
  {
    payItemNumber: "808-12353", description: "LINE, MULTI-COMPONENT, DOTTED, WHITE, 6 IN.",
    unit: "LFT", lowPrice: 0.94, averagePrice: 1.44,
    highPrice: 5.25, totalQuantity: 12909,
  },
  {
    payItemNumber: "808-12448", description: "CURB PAINTING",
    unit: "LFT", lowPrice: 4.0, averagePrice: 4.0,
    highPrice: 4.11, totalQuantity: 741,
  },
  {
    payItemNumber: "808-12454", description: "LINE, PREFORMED PLASTIC, DOTTED, WHITE, 8 IN.",
    unit: "LFT", lowPrice: 11.45, averagePrice: 11.45,
    highPrice: 11.45, totalQuantity: 149,
  },
  {
    payItemNumber: "808-12567", description: "LINE, PREFORMED PLASTIC, SOLID, WHITE WITH BLACK TRIM, 6 IN.",
    unit: "LFT", lowPrice: 7.37, averagePrice: 7.73,
    highPrice: 8.29, totalQuantity: 33274,
  },
  {
    payItemNumber: "808-12568", description: "LINE, PREFORMED PLASTIC, SOLID, YELLOW WITH BLACK TRIM, 6 IN .",
    unit: "LFT", lowPrice: 7.37, averagePrice: 7.73,
    highPrice: 8.29, totalQuantity: 32236,
  },
  {
    payItemNumber: "808-12633", description: "TRANSVERSE MARKING, PREFORMED PLASTIC, CROSSHATCH LINE, YELL OW, 24 IN.",
    unit: "LFT", lowPrice: 26.0, averagePrice: 26.0,
    highPrice: 26.0, totalQuantity: 772,
  },
  {
    payItemNumber: "808-12666", description: "LINE, PREFORMED PLASTIC, SOLID, WHITE, 10 IN.",
    unit: "LFT", lowPrice: 8.85, averagePrice: 8.94,
    highPrice: 9.95, totalQuantity: 12751,
  },
  {
    payItemNumber: "808-12667", description: "LINE, THERMOPLASTIC, SOLID, WHITE, 10 IN.",
    unit: "LFT", lowPrice: 1.95, averagePrice: 2.74,
    highPrice: 5.74, totalQuantity: 24659,
  },
  {
    payItemNumber: "808-12700", description: "LINE, MULTI-COMPONENT, DOTTED, WHITE, 12 IN.",
    unit: "LFT", lowPrice: 4.88, averagePrice: 4.88,
    highPrice: 4.88, totalQuantity: 72,
  },
  {
    payItemNumber: "808-12753", description: "TRANSVERSE MARKING, MULTI-COMPONENT, PARKING LINE, WHITE, 4 IN.",
    unit: "LFT", lowPrice: 10.0, averagePrice: 10.0,
    highPrice: 10.0, totalQuantity: 88,
  },
  {
    payItemNumber: "808-12764", description: "LINE, PAINT, BROKEN, YELLOW, 6 IN.",
    unit: "LFT", lowPrice: 0.38, averagePrice: 0.74,
    highPrice: 9.95, totalQuantity: 28618,
  },
  {
    payItemNumber: "808-12781", description: "LINE, MULTI-COMPONENT, SOLID, WHITE, 10 IN.",
    unit: "LFT", lowPrice: 1.5, averagePrice: 2.05,
    highPrice: 7.55, totalQuantity: 65563,
  },
  {
    payItemNumber: "808-12782", description: "LINE, PREFORMED PLASTIC, DOTTED, WHITE, 6 IN.",
    unit: "LFT", lowPrice: 5.32, averagePrice: 6.4,
    highPrice: 11.0, totalQuantity: 6718,
  },
  {
    payItemNumber: "808-12783", description: "LINE, PREFORMED PLASTIC, BROKEN, BLACK, 6 IN.",
    unit: "LFT", lowPrice: 5.5, averagePrice: 5.91,
    highPrice: 10.55, totalQuantity: 29345,
  },
  {
    payItemNumber: "808-12784", description: "LINE, PREFORMED PLASTIC, DOTTED, BLACK, 6 IN.",
    unit: "LFT", lowPrice: 9.22, averagePrice: 9.94,
    highPrice: 11.0, totalQuantity: 745,
  },
  {
    payItemNumber: "808-12841", description: "LINE, MULTI-COMPONENT, BROKEN, YELLOW, 6 IN.",
    unit: "LFT", lowPrice: 0.26, averagePrice: 1.16,
    highPrice: 50.0, totalQuantity: 140372,
  },
  {
    payItemNumber: "808-12845", description: "LINE, PREFORMED PLASTIC, BROKEN, YELLOW, 6 IN.",
    unit: "LFT", lowPrice: 6.25, averagePrice: 6.58,
    highPrice: 13.64, totalQuantity: 19074,
  },
  {
    payItemNumber: "808-12846", description: "LINE, PREFORMED PLASTIC, DOTTED, YELLOW, 6 IN.",
    unit: "LFT", lowPrice: 7.5, averagePrice: 7.63,
    highPrice: 7.75, totalQuantity: 600,
  },
  {
    payItemNumber: "808-12848", description: "LINE, PREFORMED PLASTIC, DOTTED, WHITE, 10 IN.",
    unit: "LFT", lowPrice: 8.95, averagePrice: 11.29,
    highPrice: 15.14, totalQuantity: 9423,
  },
  {
    payItemNumber: "808-12849", description: "LINE, THERMOPLASTIC, DOTTED, YELLOW, 6 IN.",
    unit: "LFT", lowPrice: 1.67, averagePrice: 1.71,
    highPrice: 1.85, totalQuantity: 309,
  },
  {
    payItemNumber: "808-12850", description: "LINE, THERMOPLASTIC, DOTTED, WHITE, 10 IN.",
    unit: "LFT", lowPrice: 5.13, averagePrice: 5.49,
    highPrice: 5.81, totalQuantity: 552,
  },
  {
    payItemNumber: "808-12851", description: "LINE, MULTI-COMPONENT, DOTTED, WHITE, 10 IN.",
    unit: "LFT", lowPrice: 2.48, averagePrice: 3.17,
    highPrice: 5.25, totalQuantity: 839,
  },
  {
    payItemNumber: "808-12858", description: "LINE, THERMOPLASTIC, SOLID, YELLOW, 10 IN.",
    unit: "LFT", lowPrice: 2.2, averagePrice: 2.64,
    highPrice: 4.28, totalQuantity: 6132,
  },
  {
    payItemNumber: "808-12859", description: "LINE, MULTI-COMPONENT, SOLID, YELLOW, 10 IN.",
    unit: "LFT", lowPrice: 1.9, averagePrice: 2.69,
    highPrice: 7.55, totalQuantity: 7250,
  },
  {
    payItemNumber: "808-12866", description: "LINE, PREFORMED PLASTIC, DOTTED, BLACK, 10 IN.",
    unit: "LFT", lowPrice: 9.35, averagePrice: 12.76,
    highPrice: 15.61, totalQuantity: 1903,
  },
  {
    payItemNumber: "808-12921", description: "LINE, PREFORMED PLASTIC, SOLID, WHITE WITH BLACK TRIM, 10 IN .",
    unit: "LFT", lowPrice: 9.59, averagePrice: 9.6,
    highPrice: 9.81, totalQuantity: 3304,
  },
  {
    payItemNumber: "808-12949", description: "LINE, MULTI-COMPONENT, BROKEN, BLACK, 6 IN.",
    unit: "LFT", lowPrice: 1.31, averagePrice: 1.5,
    highPrice: 2.01, totalQuantity: 57824,
  },
  {
    payItemNumber: "808-12951", description: "LINE, MULTI-COMPONENT, DOTTED, BLACK, 6 IN.",
    unit: "LFT", lowPrice: 2.21, averagePrice: 2.31,
    highPrice: 2.44, totalQuantity: 5999,
  },
  {
    payItemNumber: "808-12952", description: "LINE, MULTI-COMPONENT, DOTTED, BLACK, 10 IN.",
    unit: "LFT", lowPrice: 2.17, averagePrice: 2.17,
    highPrice: 2.17, totalQuantity: 400,
  },
  {
    payItemNumber: "808-12953", description: "LINE, THERMOPLASTIC, SOLID, WHITE, 10 IN.",
    unit: "LFT", lowPrice: 2.19, averagePrice: 3.41,
    highPrice: 5.99, totalQuantity: 12020,
  },
  {
    payItemNumber: "808-74812", description: "TRANSVERSE MARKING, PREFORMED PLASTIC, CROSSHATCH LINE, YELL OW, 12 IN.",
    unit: "LFT", lowPrice: 11.5, averagePrice: 14.14,
    highPrice: 16.48, totalQuantity: 714,
  },
  {
    payItemNumber: "808-74815", description: "TRANSVERSE MARKING, THERMOPLASTIC, CROSSWALK LINE, WHITE, 12  IN.",
    unit: "LFT", lowPrice: 3.45, averagePrice: 4.56,
    highPrice: 5.19, totalQuantity: 3125,
  },
  {
    payItemNumber: "808-75002", description: "LINE, PAINT, BROKEN, WHITE, 6 IN.",
    unit: "LFT", lowPrice: 0.4, averagePrice: 0.97,
    highPrice: 3.94, totalQuantity: 19724,
  },
  {
    payItemNumber: "808-75007", description: "LINE, PAINT, SOLID, WHITE, 6 IN.",
    unit: "LFT", lowPrice: 0.3, averagePrice: 0.66,
    highPrice: 2.94, totalQuantity: 228652,
  },
  {
    payItemNumber: "808-75008", description: "LINE, PAINT, SOLID, WHITE, 8 IN.",
    unit: "LFT", lowPrice: 1.25, averagePrice: 1.25,
    highPrice: 1.25, totalQuantity: 80,
  },
  {
    payItemNumber: "808-75015", description: "LINE, PAINT, SOLID, WHITE, 12 IN.",
    unit: "LFT", lowPrice: 3.88, averagePrice: 7.01,
    highPrice: 22.75, totalQuantity: 241,
  },
  {
    payItemNumber: "808-75043", description: "LINE, THERMOPLASTIC, SOLID, WHITE, 6 IN.",
    unit: "LFT", lowPrice: 0.82, averagePrice: 1.05,
    highPrice: 17.01, totalQuantity: 983133,
  },
  {
    payItemNumber: "808-75047", description: "LINE, PAINT, SOLID, YELLOW, 6 IN.",
    unit: "LFT", lowPrice: 0.16, averagePrice: 0.48,
    highPrice: 5.56, totalQuantity: 287020,
  },
  {
    payItemNumber: "808-75051", description: "LINE, PREFORMED PLASTIC, SOLID, WHITE, 4 IN.",
    unit: "LFT", lowPrice: 6.5, averagePrice: 6.5,
    highPrice: 6.5, totalQuantity: 4488,
  },
  {
    payItemNumber: "808-75052", description: "LINE, PREFORMED PLASTIC, SOLID, WHITE, 6 IN.",
    unit: "LFT", lowPrice: 4.62, averagePrice: 6.23,
    highPrice: 7.75, totalQuantity: 391369,
  },
  {
    payItemNumber: "808-75053", description: "LINE, PREFORMED PLASTIC, SOLID, WHITE, 8 IN.",
    unit: "LFT", lowPrice: 8.35, averagePrice: 8.35,
    highPrice: 8.35, totalQuantity: 248,
  },
  {
    payItemNumber: "808-75054", description: "LINE, PREFORMED PLASTIC, SOLID, YELLOW, 4 IN.",
    unit: "LFT", lowPrice: 6.5, averagePrice: 6.5,
    highPrice: 6.5, totalQuantity: 1670,
  },
  {
    payItemNumber: "808-75055", description: "LINE, PREFORMED PLASTIC, BROKEN, WHITE, 6 IN.",
    unit: "LFT", lowPrice: 5.32, averagePrice: 6.48,
    highPrice: 10.55, totalQuantity: 279100,
  },
  {
    payItemNumber: "808-75057", description: "LINE, PREFORMED PLASTIC, SOLID, YELLOW, 6 IN.",
    unit: "LFT", lowPrice: 5.31, averagePrice: 6.19,
    highPrice: 7.75, totalQuantity: 421399,
  },
  {
    payItemNumber: "808-75059", description: "LINE, PREFORMED PLASTIC, BROKEN, WHITE, 4 IN.",
    unit: "LFT", lowPrice: 6.0, averagePrice: 6.4,
    highPrice: 6.5, totalQuantity: 390,
  },
  {
    payItemNumber: "808-75060", description: "TRANSVERSE MARKING, PAINT, CROSSHATCH LINE, WHITE, 12 IN. CROSSHATCH LINE, WHITE, 12\"",
    unit: "LFT", lowPrice: 1.35, averagePrice: 1.35,
    highPrice: 1.35, totalQuantity: 60,
  },
  {
    payItemNumber: "808-75063", description: "LINE, PREFORMED PLASTIC, BROKEN, YELLOW, 4 IN.",
    unit: "LFT", lowPrice: 6.5, averagePrice: 6.5,
    highPrice: 6.5, totalQuantity: 130,
  },
  {
    payItemNumber: "808-75067", description: "TRANSVERSE MARKING, PREFORMED PLASTIC, STOP LINE, WHITE, 24 IN.",
    unit: "LFT", lowPrice: 21.5, averagePrice: 24.42,
    highPrice: 35.33, totalQuantity: 1876,
  },
  {
    payItemNumber: "808-75069", description: "TRANSVERSE MARKING, PREFORMED PLASTIC, CROSSWALK LINE, WHITE , 6 IN.",
    unit: "LFT", lowPrice: 8.8, averagePrice: 8.8,
    highPrice: 8.8, totalQuantity: 225,
  },
  {
    payItemNumber: "808-75071", description: "PAVEMENT MESSAGE MARKING, PREFORMED PLASTIC, LANE INDICATION  ARROW",
    unit: "EACH", lowPrice: 169.0, averagePrice: 416.54,
    highPrice: 550.0, totalQuantity: 228,
  },
  {
    payItemNumber: "808-75072", description: "TRANSVERSE MARKING, PAINT, CROSSHATCH LINE, WHITE, 24 IN. CROSSHATCH LINE, WHITE, 24\"",
    unit: "LFT", lowPrice: 27.5, averagePrice: 27.5,
    highPrice: 27.5, totalQuantity: 16,
  },
  {
    payItemNumber: "808-75073", description: "PAVEMENT MESSAGE MARKING, PREFORMED PLASTIC, ONLY (ONLY)",
    unit: "EACH", lowPrice: 195.0, averagePrice: 709.43,
    highPrice: 749.0, totalQuantity: 98,
  },
  {
    payItemNumber: "808-75074", description: "TRANSVERSE MARKING, PAINT, CROSSHATCH LINE, YELLOW, 8 IN. CROSSHATCH LINE, YELLOW 8\"",
    unit: "LFT", lowPrice: 2.4, averagePrice: 2.4,
    highPrice: 2.4, totalQuantity: 63,
  },
  {
    payItemNumber: "808-75078", description: "TRANSVERSE MARKING, PAINT, CROSSHATCH LINE, YELLOW, 12 IN. CROSSHATCH LINE, YELLOW 12\"",
    unit: "LFT", lowPrice: 5.71, averagePrice: 5.71,
    highPrice: 5.71, totalQuantity: 68,
  },
  {
    payItemNumber: "808-75100", description: "TRANSVERSE MARKING, PAINT, CROSSWALK LINE, WHITE, 6 IN. CROSSWALK LINE, 6\"",
    unit: "LFT", lowPrice: 1.5, averagePrice: 2.6,
    highPrice: 10.0, totalQuantity: 2092,
  },
  {
    payItemNumber: "808-75140", description: "PAVEMENT MESSAGE MARKING, PAINT, RXR",
    unit: "EACH", lowPrice: 500.0, averagePrice: 500.0,
    highPrice: 500.0, totalQuantity: 2,
  },
  {
    payItemNumber: "808-75215", description: "LINE, THERMOPLASTIC, SOLID, WHITE, 12 IN.",
    unit: "LFT", lowPrice: 2.95, averagePrice: 2.95,
    highPrice: 2.95, totalQuantity: 328,
  },
  {
    payItemNumber: "808-75240", description: "LINE, THERMOPLASTIC, BROKEN, YELLOW, 4 IN.",
    unit: "LFT", lowPrice: 0.65, averagePrice: 1.16,
    highPrice: 6.0, totalQuantity: 91252,
  },
  {
    payItemNumber: "808-75245", description: "LINE, THERMOPLASTIC, SOLID, YELLOW, 4 IN.",
    unit: "LFT", lowPrice: 0.65, averagePrice: 0.76,
    highPrice: 3.89, totalQuantity: 566109,
  },
  {
    payItemNumber: "808-75247", description: "LINE, THERMOPLASTIC, SOLID, YELLOW, 6 IN.",
    unit: "LFT", lowPrice: 0.82, averagePrice: 1.08,
    highPrice: 4.0, totalQuantity: 741295,
  },
  {
    payItemNumber: "808-75256", description: "TRANSVERSE MARKING, THERMOPLASTIC, CROSSHATCH LINE, WHITE, 8  IN.",
    unit: "LFT", lowPrice: 4.5, averagePrice: 4.63,
    highPrice: 5.35, totalQuantity: 266,
  },
  {
    payItemNumber: "808-75260", description: "TRANSVERSE MARKING, THERMOPLASTIC, CROSSHATCH LINE, WHITE, 1 2 IN.",
    unit: "LFT", lowPrice: 2.95, averagePrice: 6.58,
    highPrice: 33.63, totalQuantity: 3549,
  },
  {
    payItemNumber: "808-75272", description: "TRANSVERSE MARKING, THERMOPLASTIC, CROSSHATCH LINE, WHITE, 2 4 IN.",
    unit: "LFT", lowPrice: 4.95, averagePrice: 9.74,
    highPrice: 14.78, totalQuantity: 11722,
  },
  {
    payItemNumber: "808-75274", description: "TRANSVERSE MARKING, THERMOPLASTIC, CROSSHATCH LINE, YELLOW, 8 IN.",
    unit: "LFT", lowPrice: 3.48, averagePrice: 6.23,
    highPrice: 10.3, totalQuantity: 384,
  },
  {
    payItemNumber: "808-75278", description: "TRANSVERSE MARKING, THERMOPLASTIC, CROSSHATCH LINE, YELLOW, 12 IN.",
    unit: "LFT", lowPrice: 2.95, averagePrice: 5.52,
    highPrice: 12.0, totalQuantity: 14333,
  },
  {
    payItemNumber: "808-75290", description: "TRANSVERSE MARKING, THERMOPLASTIC, CROSSHATCH LINE, YELLOW, 24 IN.",
    unit: "LFT", lowPrice: 5.95, averagePrice: 9.93,
    highPrice: 13.88, totalQuantity: 2463,
  },
  {
    payItemNumber: "808-75297", description: "TRANSVERSE MARKING, THERMOPLASTIC, STOP LINE, WHITE, 24 IN. STOP LINE, 24 IN",
    unit: "LFT", lowPrice: 4.0, averagePrice: 10.77,
    highPrice: 50.0, totalQuantity: 26815,
  },
  {
    payItemNumber: "808-75300", description: "TRANSVERSE MARKING, THERMOPLASTIC, CROSSWALK LINE, WHITE, 6 IN.",
    unit: "LFT", lowPrice: 1.73, averagePrice: 3.08,
    highPrice: 71.0, totalQuantity: 32786,
  },
  {
    payItemNumber: "808-75320", description: "PAVEMENT MESSAGE MARKING, THERMOPLASTIC, LANE INDICATION ARR OW",
    unit: "EACH", lowPrice: 89.0, averagePrice: 184.25,
    highPrice: 461.0, totalQuantity: 1934,
  },
  {
    payItemNumber: "808-75325", description: "PAVEMENT MESSAGE MARKING, THERMOPLASTIC, 'ONLY' ONLY",
    unit: "EACH", lowPrice: 175.0, averagePrice: 258.7,
    highPrice: 525.0, totalQuantity: 123,
  },
  {
    payItemNumber: "808-75340", description: "PAVEMENT MESSAGE MARKING, THERMOPLASTIC, RXR R X R",
    unit: "EACH", lowPrice: 495.0, averagePrice: 955.48,
    highPrice: 2365.0, totalQuantity: 33,
  },
  {
    payItemNumber: "808-75350", description: "PAVEMENT MESSAGE MARKING, THERMOPLASTIC, SCHOOL SCHOOL",
    unit: "EACH", lowPrice: 595.0, averagePrice: 595.0,
    highPrice: 595.0, totalQuantity: 4,
  },
  {
    payItemNumber: "808-75510", description: "TRANSVERSE MARKING, PREFORMED PLASTIC, CROSSHATCH LINE, WHIT E, 24 IN.",
    unit: "LFT", lowPrice: 21.5, averagePrice: 21.55,
    highPrice: 30.59, totalQuantity: 1295,
  },
  {
    payItemNumber: "808-75994", description: "PRISMATIC REFLECTOR",
    unit: "EACH", lowPrice: 5.75, averagePrice: 7.06,
    highPrice: 40.0, totalQuantity: 165518,
  },
  {
    payItemNumber: "808-75996", description: "SNOWPLOWABLE RAISED PAVEMENT MARKER, REMOVE",
    unit: "EACH", lowPrice: 1.0, averagePrice: 13.43,
    highPrice: 400.0, totalQuantity: 56644,
  },
  {
    payItemNumber: "808-75998", description: "SNOWPLOWABLE RAISED PAVEMENT MARKER",
    unit: "EACH", lowPrice: 22.0, averagePrice: 32.06,
    highPrice: 2000.0, totalQuantity: 88483,
  },
  {
    payItemNumber: "808-91662", description: "TRANSVERSE MARKING, PREFORMED PLASTIC, CROSSHATCH LINE, WHIT E, 12 IN.",
    unit: "LFT", lowPrice: 11.5, averagePrice: 11.5,
    highPrice: 11.5, totalQuantity: 610,
  },
  {
    payItemNumber: "808-92027", description: "LINE, THERMOPLASTIC, SOLID, YELLOW, 8 IN.",
    unit: "LFT", lowPrice: 1.37, averagePrice: 2.04,
    highPrice: 3.11, totalQuantity: 14025,
  },
  {
    payItemNumber: "808-95638", description: "CENTER CURB PAINTING",
    unit: "SFT", lowPrice: 3.0, averagePrice: 3.0,
    highPrice: 3.0, totalQuantity: 600,
  },
  {
    payItemNumber: "808-95933", description: "CURB, PAINTING, YELLOW",
    unit: "LFT", lowPrice: 2.11, averagePrice: 2.11,
    highPrice: 2.11, totalQuantity: 325,
  },
  {
    payItemNumber: "808-96075", description: "LINE, THERMOPLASTIC, BROKEN, WHITE, 6 IN.",
    unit: "LFT", lowPrice: 1.25, averagePrice: 1.62,
    highPrice: 4.55, totalQuantity: 63196,
  },
  {
    payItemNumber: "808-96078", description: "LINE, THERMOPLASTIC, BROKEN, YELLOW, 6 IN.",
    unit: "LFT", lowPrice: 1.0, averagePrice: 1.4,
    highPrice: 5.59, totalQuantity: 59545,
  },
  {
    payItemNumber: "808-97222", description: "PAVEMENT MESSAGE MARKING, PAINT, ADA ACCESSIBLE SYMBOL HANDICAP SYMBOL",
    unit: "EACH", lowPrice: 190.0, averagePrice: 302.75,
    highPrice: 436.0, totalQuantity: 8,
  },
  {
    payItemNumber: "808-97323", description: "LINE, THERMOPLASTIC, FOR BUZZ STRIPS, 8 IN.",
    unit: "LFT", lowPrice: 16.46, averagePrice: 18.72,
    highPrice: 20.0, totalQuantity: 672,
  },
  {
    payItemNumber: "808-97664", description: "PAVEMENT MESSAGE MARKING, THERMOPLASTIC, ADA ACCESSIBLE SYMB OL",
    unit: "EACH", lowPrice: 300.0, averagePrice: 576.62,
    highPrice: 915.0, totalQuantity: 8,
  },
  {
    payItemNumber: "808-98875", description: "TRANSVERSE MARKING, THERMOPLASTIC, CROSSHATCH LINE, YELLOW, 6 IN.",
    unit: "LFT", lowPrice: 5.44, averagePrice: 5.44,
    highPrice: 5.44, totalQuantity: 74,
  },
  {
    payItemNumber: "809-000105", description: "SFP TRANSCEIVER, SM SFP+",
    unit: "EACH", lowPrice: 391.5, averagePrice: 391.5,
    highPrice: 391.5, totalQuantity: 2,
  },
  {
    payItemNumber: "809-000106", description: "SFP TRANSCEIVER, SM MEDIUM RANGE",
    unit: "EACH", lowPrice: 2470.0, averagePrice: 2470.0,
    highPrice: 2470.0, totalQuantity: 8,
  },
  {
    payItemNumber: "809-000107", description: "SFP TRANSCEIVER, SM LONG RANGE",
    unit: "EACH", lowPrice: 442.5, averagePrice: 664.69,
    highPrice: 2470.0, totalQuantity: 73,
  },
  {
    payItemNumber: "809-000108", description: "FUSION SPLICE",
    unit: "EACH", lowPrice: 25.9, averagePrice: 46.53,
    highPrice: 110.0, totalQuantity: 9102,
  },
  {
    payItemNumber: "809-000109", description: "ITS LOCATOR POST",
    unit: "EACH", lowPrice: 433.0, averagePrice: 652.63,
    highPrice: 1300.0, totalQuantity: 77,
  },
  {
    payItemNumber: "809-000110", description: "ITS POLE STRUCTURE",
    unit: "EACH", lowPrice: 42810.0, averagePrice: 57209.0,
    highPrice: 71608.0, totalQuantity: 2,
  },
  {
    payItemNumber: "809-000111", description: "TORSION-ASSISTED ITS VAULT",
    unit: "EACH", lowPrice: 9000.0, averagePrice: 11710.86,
    highPrice: 13690.0, totalQuantity: 14,
  },
  {
    payItemNumber: "809-000112", description: "ITS CORE SWITCH",
    unit: "EACH", lowPrice: 36863.0, averagePrice: 42507.25,
    highPrice: 51103.0, totalQuantity: 8,
  },
  {
    payItemNumber: "809-000113", description: "ITS VAULT",
    unit: "EACH", lowPrice: 2700.0, averagePrice: 7383.33,
    highPrice: 13200.0, totalQuantity: 12,
  },
  {
    payItemNumber: "809-000115", description: "SERVICE POINT, DISCONNECT ONLY",
    unit: "EACH", lowPrice: 4508.0, averagePrice: 4508.0,
    highPrice: 4508.0, totalQuantity: 1,
  },
  {
    payItemNumber: "809-000116", description: "DROP CABLE, 12 FIBER, SM",
    unit: "EACH", lowPrice: 309.0, averagePrice: 4536.33,
    highPrice: 23333.0, totalQuantity: 36,
  },
  {
    payItemNumber: "809-000117", description: "PATCH CABLE, SM, LC-SC",
    unit: "EACH", lowPrice: 42.2, averagePrice: 71.05,
    highPrice: 250.0, totalQuantity: 263,
  },
  {
    payItemNumber: "809-000118", description: "CABLE-DUCT MARKER, FLEXIBLE",
    unit: "EACH", lowPrice: 321.0, averagePrice: 321.0,
    highPrice: 321.0, totalQuantity: 66,
  },
  {
    payItemNumber: "809-000119", description: "REMOTE POWER SWITCH",
    unit: "EACH", lowPrice: 745.0, averagePrice: 745.0,
    highPrice: 745.0, totalQuantity: 8,
  },
  {
    payItemNumber: "809-000141", description: "PATCH CABLE, MM, LC-LC",
    unit: "EACH", lowPrice: 128.0, averagePrice: 128.0,
    highPrice: 128.0, totalQuantity: 4,
  },
  {
    payItemNumber: "809-000142", description: "PATCH PANEL ASSEMBLY, 96 PORT",
    unit: "EACH", lowPrice: 498.0, averagePrice: 2039.83,
    highPrice: 3529.0, totalQuantity: 24,
  },
  {
    payItemNumber: "809-04652", description: "SERVICE POINT ATMS",
    unit: "EACH", lowPrice: 100.0, averagePrice: 6723.7,
    highPrice: 15460.0, totalQuantity: 82,
  },
  {
    payItemNumber: "809-04956", description: "PATCH PANEL ASSEMBLY, 12 PORT, 1U",
    unit: "EACH", lowPrice: 600.0, averagePrice: 1186.12,
    highPrice: 3500.0, totalQuantity: 17,
  },
  {
    payItemNumber: "809-04969", description: "SPLICE ENCLOSURE",
    unit: "EACH", lowPrice: 450.0, averagePrice: 2277.05,
    highPrice: 3200.0, totalQuantity: 39,
  },
  {
    payItemNumber: "809-04982", description: "CABLE",
    unit: "LFT", lowPrice: 1.1, averagePrice: 2.29,
    highPrice: 30.0, totalQuantity: 5271,
  },
  {
    payItemNumber: "809-05906", description: "ATR STATION, 2 LANE",
    unit: "EACH", lowPrice: 44000.0, averagePrice: 44000.0,
    highPrice: 44000.0, totalQuantity: 1,
  },
  {
    payItemNumber: "809-06101", description: "ITS POLE STRUCTURE FOUNDATION",
    unit: "EACH", lowPrice: 16000.0, averagePrice: 19141.43,
    highPrice: 32390.0, totalQuantity: 7,
  },
  {
    payItemNumber: "809-06114", description: "ITS ANTENNA",
    unit: "EACH", lowPrice: 1600.0, averagePrice: 3033.33,
    highPrice: 5900.0, totalQuantity: 6,
  },
  {
    payItemNumber: "809-06128", description: "CCTV ASSEMBLY",
    unit: "EACH", lowPrice: 10000.0, averagePrice: 17269.23,
    highPrice: 20000.0, totalQuantity: 13,
  },
  {
    payItemNumber: "809-08372", description: "ROADWAY WEATHER INFORMATION SYSTEM",
    unit: "EACH", lowPrice: 12490.0, averagePrice: 26927.62,
    highPrice: 72000.0, totalQuantity: 6,
  },
  {
    payItemNumber: "809-08398", description: "ITS CONTROLLER CABINET",
    unit: "EACH", lowPrice: 12500.0, averagePrice: 14675.54,
    highPrice: 17720.0, totalQuantity: 35,
  },
  {
    payItemNumber: "809-08399", description: "ITS CONTROLLER CABINET FOUNDATION",
    unit: "EACH", lowPrice: 2700.0, averagePrice: 4531.72,
    highPrice: 6100.0, totalQuantity: 18,
  },
  {
    payItemNumber: "809-09343", description: "ITS",
    unit: "EACH", lowPrice: 25.4, averagePrice: 4572.79,
    highPrice: 32000.0, totalQuantity: 197,
  },
  {
    payItemNumber: "809-09483", description: "DMS",
    unit: "EACH", lowPrice: 105184.0, averagePrice: 105184.0,
    highPrice: 105184.0, totalQuantity: 2,
  },
  {
    payItemNumber: "809-09871", description: "ATR STATION, REMOVE",
    unit: "EACH", lowPrice: 4219.0, averagePrice: 4219.0,
    highPrice: 4219.0, totalQuantity: 1,
  },
  {
    payItemNumber: "809-11707", description: "ITS FIELD SWITCH",
    unit: "EACH", lowPrice: 550.0, averagePrice: 3852.21,
    highPrice: 5116.0, totalQuantity: 48,
  },
  {
    payItemNumber: "809-11763", description: "WEIGH-IN-MOTION STATION, REBUILD",
    unit: "LS", lowPrice: 221920.84, averagePrice: 495551.99,
    highPrice: 854185.0, totalQuantity: 4,
  },
  {
    payItemNumber: "809-12472", description: "ATR STATION, 10 LANE",
    unit: "EACH", lowPrice: 273643.0, averagePrice: 273643.0,
    highPrice: 273643.0, totalQuantity: 1,
  },
  {
    payItemNumber: "809-94971", description: "FIBER OPTIC CABLE",
    unit: "LFT", lowPrice: 1.1, averagePrice: 4.77,
    highPrice: 3900.0, totalQuantity: 223664,
  },
];

/** INDOT CY2025 benchmark for an exact pay-item number, or undefined. */
export function getIndot2025UnitPriceBenchmark(payItemNumber: string): IndotUnitPriceBenchmark | undefined {
  return INDOT_2025_UNIT_PRICE_BENCHMARKS.find((item) => item.payItemNumber === payItemNumber);
}

/** Case-insensitive keyword search over pay-item descriptions. */
export function searchIndot2025UnitPrices(keyword: string): IndotUnitPriceBenchmark[] {
  const q = keyword.toLowerCase();
  return INDOT_2025_UNIT_PRICE_BENCHMARKS.filter((item) => item.description.toLowerCase().includes(q));
}
