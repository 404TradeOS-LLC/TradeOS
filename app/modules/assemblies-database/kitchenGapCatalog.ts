/**
 * Two price-neutral kitchen gap recipes. These are scope templates, not
 * published labor production benchmarks or authoritative supplier quotations.
 * The estimator must select tenant-owned Cost Items normalized to the native
 * output units and review site conditions, product instructions and exclusions.
 */
import type { ResearchAssemblyCatalogTemplate } from "./tradeosCatalogAdapter";

export const KITCHEN_GAP_CATALOG: readonly ResearchAssemblyCatalogTemplate[] = [
  {
    id: "kitchen:wall-cabinet-prefab",
    code: "12 35 30-TOS-001",
    name: "Prefabricated Kitchen Wall Cabinet Installation",
    description: "Set and secure one prefabricated kitchen wall cabinet with the manufacturer-specified anchorage, leveling and alignment. Cabinet model, size and finish must be chosen as separate tenant-owned Cost Items.",
    unitOfMeasure: "EA",
    csiDivision: "12",
    csiTitle: "Furnishings",
    nahbGroup: "Finishing Trades",
    nahbPhase: "5000",
    trade: "Finish Carpentry",
    measurementBasis: "Each individual finished wall cabinet, not linear feet of a cabinet run. Verify each model, width, height, depth, wall substrate and fastener requirements before pricing.",
    wasteGuidance: "Zero preset cabinet waste. Confirm load-bearing stud/blocking attachment and manufacturer-compatible cabinet mounting screws, shims, wall condition, and helper access. Excludes demolition, electrical/lighting, additional framing/blocking, crown molding, fillers and decorative panels; price them as separate Cost Items or assemblies. Source SRC-0069 describes general hanging practices, not a product-specific structural certification.",
    version: 1,
    review: {
      status: "research",
      source: "TradeOS-authored scope recipe using installation guidance",
      reviewedOn: "",
      regionalBasis: "No production rate, regional price or code-compliance certification. Estimator must review actual wall and chosen cabinet manufacturer's installation instructions.",
    },
    evidenceRefs: ["SRC-0069"],
    blockingReasons: [],
    components: [
      {
        key: "wall-cabinet-unit",
        label: "Prefabricated wall cabinet (specified model)",
        quantityPerUnit: 1,
        compatibleUnits: ["EA"],
        allowedCostItemKinds: ["material", "composite"],
        help: "Exactly 1 chosen wall cabinet per EA output. Map an EA Cost Item for the required model, size, door/finish and hardware inclusions; never substitute a generic cabinet price for different dimensions.",
      },
      {
        key: "wall-cabinet-fastening-kit",
        label: "Cabinet mounting hardware and shims (per cabinet)",
        quantityPerUnit: 1,
        compatibleUnits: ["EA"],
        allowedCostItemKinds: ["material", "composite"],
        help: "1 contractor-reviewed EA hardware-and-shim allowance per cabinet. Use specified anchoring hardware based on wall framing and cabinet instructions. Exclude from this slot if included in the separate priced cabinet item by using an explicit reviewed zero-cost EA item; do not double-count.",
      },
      {
        key: "wall-cabinet-setting",
        label: "Wall cabinet set, align and fasten labor",
        quantityPerUnit: 1,
        compatibleUnits: ["EA"],
        allowedCostItemKinds: ["labor", "subcontractor", "composite"],
        help: "1 installed-cabinet EA labor Cost Item, including supporting/lifting, leveling, shimming and fastening to the permitted wall structure. Actual crew time must be calibrated in tenant labor rates.",
      },
    ],
  },
  {
    id: "kitchen:laminate-countertop-straight",
    code: "12 36 23-TOS-001",
    name: "Prefabricated Laminate Countertop — Straight Run",
    description: "Supply, fit and secure a prefabricated plastic-laminate kitchen countertop along a simple straight base-cabinet run. Material must be priced per linear foot of the specified depth and selected profile.",
    unitOfMeasure: "LF",
    csiDivision: "12",
    csiTitle: "Furnishings",
    nahbGroup: "Finishing Trades",
    nahbPhase: "5000",
    trade: "Finish Carpentry",
    measurementBasis: "Linear foot of installed, straight countertop along the front edge at the specific product's fixed depth and profile. Corner returns, islands, variable-depth pieces and seams require separate measurements and scope.",
    wasteGuidance: "Zero preset waste: verify actual piece lengths, cut-off waste and finish-end counts. Material Cost Item must be normalized to LF for the chosen countertop profile; never equate an EA 8-ft slab to 1 LF. Excludes sink/cooktop cutouts, fabrication of seams and miters, exposed end-cap kits, separate backsplash, plumbing disconnect/reconnect, structural support repair and removal of old tops. Scope and price separately. Source SRC-0070 documents laminate cutout considerations, not an all-purpose installation design.",
    version: 1,
    review: {
      status: "research",
      source: "TradeOS-authored scope recipe using laminate manufacturer guidance",
      reviewedOn: "",
      regionalBasis: "Straight-run scope baseline only; requires specific finished counter, dimensions, substrate and any cutouts to be reviewed. No embedded supplier price or labor productivity estimate.",
    },
    evidenceRefs: ["SRC-0070"],
    blockingReasons: [],
    components: [
      {
        key: "laminate-countertop-material",
        label: "Prefabricated laminate countertop, selected profile",
        quantityPerUnit: 1,
        compatibleUnits: ["LF"],
        allowedCostItemKinds: ["material", "composite"],
        help: "1 LF of the exact finished countertop profile per 1 LF output. Map only a verified LF-normalized material Cost Item; convert piece-priced retailer lengths upstream with actual yield and waste before mapping.",
      },
      {
        key: "laminate-countertop-install",
        label: "Straight-run countertop fit and installation labor",
        quantityPerUnit: 1,
        compatibleUnits: ["LF"],
        allowedCostItemKinds: ["labor", "subcontractor", "composite"],
        help: "1 LF-installed labor Cost Item for measure, dry-fit, scribe, secure and finish the straight run. Excludes sink or range cutouts, miter fabrication, cabinetry repair, seam work and additional backsplash.",
      },
    ],
  },
];
