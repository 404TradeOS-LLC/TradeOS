import {
  PRICED_ASSEMBLY_COMPONENTS,
  type PricedAssemblyComponent,
} from "./pricedAssemblies";

export type LegacyAssemblyMatchConflict =
  | "NOMINAL_DIMENSION"
  | "PRODUCT_TYPE"
  | "MATERIAL_SPEC";

export interface LegacyAssemblyMatchRejection {
  assemblyId: string;
  componentKey: string;
  productNameIncludes: string;
  conflict: LegacyAssemblyMatchConflict;
  reason: string;
}

export interface LegacyAssemblyMatchAuditFinding extends LegacyAssemblyMatchRejection {
  component: PricedAssemblyComponent;
}

/**
 * High-confidence false positives in the historical generated assembly-price
 * snapshot. This list is intentionally conservative: a row belongs here only
 * when the checked-in component requirement and supplier product contradict on
 * an identity-defining dimension, product type, or material/use specification.
 *
 * This registry is an audit boundary, not a substitute matcher. It never
 * invents a replacement product or price.
 */
export const HIGH_CONFIDENCE_LEGACY_ASSEMBLY_MATCH_REJECTIONS:
  readonly LegacyAssemblyMatchRejection[] = [
  {
    assemblyId: "conc-pier-sonotube-12x48",
    componentKey: "mat_anchor_jbolt_half_x_twelve",
    productNameIncludes: "1/2 in. x 10 in. Galvanized Anchor Bolt",
    conflict: "NOMINAL_DIMENSION",
    reason: "12 in. anchor-bolt requirement was matched to a 10 in. anchor bolt.",
  },
  {
    assemblyId: "framing-floor-joist-2x10-16oc",
    componentKey: "mat_joists_2x10_spf",
    productNameIncludes: "2 in. x 4 in. x 8 ft.",
    conflict: "NOMINAL_DIMENSION",
    reason: "2x10 joist/rim lumber was matched to 2x4 dimensional lumber.",
  },
  {
    assemblyId: "framing-floor-joist-2x10-16oc",
    componentKey: "mat_joist_hangers_simpson",
    productNameIncludes: "Joist Hanger for 2x6",
    conflict: "NOMINAL_DIMENSION",
    reason: "LUS210/2x10 joist-hanger requirement was matched to a 2x6 hanger.",
  },
  {
    assemblyId: "framing-roof-rafter-2x8-16oc",
    componentKey: "mat_rafters_2x8_spf",
    productNameIncludes: "2 in. x 4 in. x 8 ft.",
    conflict: "NOMINAL_DIMENSION",
    reason: "2x8 rafter lumber was matched to 2x4 dimensional lumber.",
  },
  {
    assemblyId: "framing-roof-rafter-2x8-16oc",
    componentKey: "mat_ridge_board_2x10",
    productNameIncludes: "2 in. x 4 in. x 8 ft.",
    conflict: "NOMINAL_DIMENSION",
    reason: "2x10 ridge-board lumber was matched to 2x4 dimensional lumber.",
  },
  {
    assemblyId: "deck-framing-pt-joist-beam",
    componentKey: "mat_deck_joists_2x8_pt",
    productNameIncludes: "5/4-in x 6-in",
    conflict: "NOMINAL_DIMENSION",
    reason: "2x8 pressure-treated joists were matched to 5/4x6 decking.",
  },
  {
    assemblyId: "deck-framing-pt-joist-beam",
    componentKey: "mat_deck_beams_2x10_pt",
    productNameIncludes: "2 in. x 8 in. x 8 ft.",
    conflict: "NOMINAL_DIMENSION",
    reason: "Double 2x10 beam lumber was matched to 2x8 lumber.",
  },
  {
    assemblyId: "deck-guardrail-wood-4in-baluster",
    componentKey: "mat_guard_posts_4x4_pt",
    productNameIncludes: "2 in. x 8 in. x 8 ft.",
    conflict: "NOMINAL_DIMENSION",
    reason: "4x4 guard posts were matched to 2x8 lumber.",
  },
  {
    assemblyId: "deck-guardrail-wood-4in-baluster",
    componentKey: "mat_rails_2x4_pt",
    productNameIncludes: "2 in. x 8 in. x 8 ft.",
    conflict: "NOMINAL_DIMENSION",
    reason: "2x4 guard rails were matched to 2x8 lumber.",
  },
  {
    assemblyId: "paint-ceiling-interior-flat-2coat",
    componentKey: "mat_roller_sleeve_half_nap",
    productNameIncludes: "Firebrick Split",
    conflict: "PRODUCT_TYPE",
    reason: "Paint roller sleeve allocation was matched to firebrick.",
  },
  {
    assemblyId: "flooring-carpet-pad-stretch",
    componentKey: "mat_tack_strip_wood_residential",
    productNameIncludes: "Furring Strip",
    conflict: "PRODUCT_TYPE",
    reason: "Carpet tack strip was matched to general-purpose furring lumber.",
  },
  {
    assemblyId: "tile-floor-porcelain-12x24",
    componentKey: "mat_mortar_thinset_modified_50lb",
    productNameIncludes: "Tamms Thin Patch",
    conflict: "PRODUCT_TYPE",
    reason: "ANSI tile thinset mortar was matched to concrete patching material.",
  },
  {
    assemblyId: "tile-underlayment-cement-board-half",
    componentKey: "mat_mortar_thinset_bed_cbu",
    productNameIncludes: "Tamms Thin Patch",
    conflict: "PRODUCT_TYPE",
    reason: "Cement-board bedding thinset was matched to concrete patching material.",
  },
  {
    assemblyId: "cabinet-base-kitchen-prehab",
    componentKey: "fast_face_frame_screws_trim",
    productNameIncludes: "Galvanized Hex Lag Screws",
    conflict: "PRODUCT_TYPE",
    reason: "Trim-head face-frame screws were matched to 1/2 in. hex lag screws.",
  },
  {
    assemblyId: "framing-beam-lvl-2ply-1178",
    componentKey: "fast_structural_screws_lvl_sdws",
    productNameIncludes: "#9 x 1-1/2 in. Structural Connector Screws",
    conflict: "NOMINAL_DIMENSION",
    reason: "3-1/2 in. multi-ply LVL screws were matched to 1-1/2 in. connector screws.",
  },
  {
    assemblyId: "framing-beam-lvl-2ply-1178",
    componentKey: "fast_column_cap_connectors",
    productNameIncludes: "Adjustable Standoff Post Base",
    conflict: "PRODUCT_TYPE",
    reason: "Column/post-cap requirement was matched to a post base.",
  },
  {
    assemblyId: "deck-stairs-wood-stringer-step",
    componentKey: "mat_stringer_lumber_2x12_pt",
    productNameIncludes: "2 in. x 8 in. x 8 ft.",
    conflict: "NOMINAL_DIMENSION",
    reason: "2x12 stair-stringer lumber was matched to 2x8 lumber.",
  },
  {
    assemblyId: "deck-stairs-wood-stringer-step",
    componentKey: "fast_stringer_hangers_lscz",
    productNameIncludes: "#9 x 1-1/2 in. Structural Connector Screws",
    conflict: "PRODUCT_TYPE",
    reason: "LSCZ stringer hangers were matched to connector screws only.",
  },
  {
    assemblyId: "deck-ledger-attachment-flashing",
    componentKey: "mat_ledger_board_2x10_pt",
    productNameIncludes: "2 in. x 8 in. x 8 ft.",
    conflict: "NOMINAL_DIMENSION",
    reason: "2x10 ledger-board requirement was matched to 2x8 lumber.",
  },
  {
    assemblyId: "found-pier-helical-steel",
    componentKey: "mat_helical_pile_extension",
    productNameIncludes: "Concrete Brick",
    conflict: "PRODUCT_TYPE",
    reason: "Galvanized helical-pile extension shaft was matched to concrete brick.",
  },
  {
    assemblyId: "insul-rigidfoam-xps-2in-foundation",
    componentKey: "fast_masonry_insulation_anchors",
    productNameIncludes: "Hex-Washer-Head Concrete Screws",
    conflict: "PRODUCT_TYPE",
    reason: "Plastic-washer insulation anchors were matched to concrete screws.",
  },
  {
    assemblyId: "fence-wood-privacy-6ft-pt",
    componentKey: "mat_fence_posts_4x4x8_pt",
    productNameIncludes: "2 in. x 4 in. x 8 ft. #2 Pressure-Treated Fence Rail",
    conflict: "NOMINAL_DIMENSION",
    reason: "4x4 fence posts were matched to 2x4 fence rails.",
  },
  {
    assemblyId: "fence-chainlink-galvanized-4ft",
    componentKey: "mat_top_rail_138_galv",
    productNameIncludes: "Drywall Corner Bead",
    conflict: "PRODUCT_TYPE",
    reason: "Chain-link fence top rail was matched to drywall corner bead.",
  },
  {
    assemblyId: "paint-drywall-new-primer-2coat",
    componentKey: "mat_paint_interior_latex_gal",
    productNameIncludes: "Exterior Paint & Primer",
    conflict: "MATERIAL_SPEC",
    reason: "Interior acrylic finish-paint requirement was matched to exterior paint.",
  },
  {
    assemblyId: "elec-circuit-dedicated-20a-50ft",
    componentKey: "equip_breaker_20a_single_pole",
    productNameIncludes: "15 Amp Single-Pole Circuit Breaker",
    conflict: "MATERIAL_SPEC",
    reason: "20A dedicated-circuit requirement was matched to a 15A breaker.",
  },
  {
    assemblyId: "masonry-brick-veneer-residential",
    componentKey: "mat_brick_modular_clay_facing",
    productNameIncludes: "Concrete Brick",
    conflict: "MATERIAL_SPEC",
    reason: "ASTM C216 clay facing-brick requirement was matched to concrete brick.",
  },
  {
    assemblyId: "conc-slab-4in-ongrade",
    componentKey: "mat_aggregate_subbase_crushed_stone",
    productNameIncludes: "#73 Limestone",
    conflict: "MATERIAL_SPEC",
    reason: "INDOT #53 dense-graded subbase was matched to #73 limestone.",
  },
  {
    assemblyId: "subbase-aggregate-granular-compaction",
    componentKey: "mat_aggregate_crushed_stone_ton",
    productNameIncludes: "#73 Limestone",
    conflict: "MATERIAL_SPEC",
    reason: "INDOT #53 dense-base aggregate was matched to #73 limestone.",
  },
  {
    assemblyId: "conc-pier-sonotube-12x48",
    componentKey: "mat_concrete_3500_pier",
    productNameIncludes: "Quikrete 80 lb. Concrete Mix",
    conflict: "PRODUCT_TYPE",
    reason: "Delivered 3500 PSI ready-mix requirement was matched to bagged concrete mix without a governed unit conversion.",
  },
  {
    assemblyId: "conc-footing-continuous-16x8",
    componentKey: "mat_rebar_chairs_dobies",
    productNameIncludes: "Support Chairs 2 in.",
    conflict: "NOMINAL_DIMENSION",
    reason: "3 in. rebar support-chair requirement was matched to 2 in. chairs.",
  },
  {
    assemblyId: "hvac-furnace-gas-replacement",
    componentKey: "mat_condensate_drain_tubing_kit",
    productNameIncludes: "Condensate 90",
    conflict: "PRODUCT_TYPE",
    reason: "Condensate trap/drain-line kit with neutralizer was matched to a single PVC elbow.",
  },
  {
    assemblyId: "deck-framing-pt-joist-beam",
    componentKey: "fast_deck_hardware_hangers",
    productNameIncludes: "H2.5A 18-Gauge ZMAX Hurricane Tie",
    conflict: "PRODUCT_TYPE",
    reason: "Joist-hanger/tie/screw hardware allocation was matched to a single hurricane tie.",
  },
  {
    assemblyId: "plumb-waterheater-electric-50gal",
    componentKey: "mat_flex_connectors_34_stainless",
    productNameIncludes: "Push-to-Connect Coupling",
    conflict: "PRODUCT_TYPE",
    reason: "18 in. stainless flexible water-heater connectors were matched to a coupling.",
  },
  {
    assemblyId: "trim-casing-door-paintgrade",
    componentKey: "fast_casing_nails_finish",
    productNameIncludes: "15-Gauge DA Angled Finish Nails",
    conflict: "MATERIAL_SPEC",
    reason: "16-gauge finish / 18-gauge brad nail requirement was matched to 15-gauge nails.",
  },
  {
    assemblyId: "tile-underlayment-cement-board-half",
    componentKey: "mat_tape_cbu_alkali_mesh",
    productNameIncludes: "Drywall Mesh Tape",
    conflict: "MATERIAL_SPEC",
    reason: "Alkali-resistant cement-board mesh tape was matched to drywall mesh tape.",
  },
  {
    assemblyId: "hvac-furnace-gas-replacement",
    componentKey: "mat_vent_pipe_pvc_sch40_kit",
    productNameIncludes: "Schedule 40 PVC Socket Tee",
    conflict: "PRODUCT_TYPE",
    reason: "PVC vent pipe/fitting kit was matched to a single socket tee.",
  },
  {
    assemblyId: "moisture-barrier-wrb-housewrap",
    componentKey: "fast_cap_staples_stinger",
    productNameIncludes: "Nails 1-1/4 in.",
    conflict: "NOMINAL_DIMENSION",
    reason: "1 in. cap-fastener requirement was matched to 1-1/4 in. cap nails.",
  },
  {
    assemblyId: "roofing-underlayment-synthetic",
    componentKey: "fast_plastic_cap_nails_1in",
    productNameIncludes: "Nails 1-1/4 in.",
    conflict: "NOMINAL_DIMENSION",
    reason: "1 in. plastic-cap nail requirement was matched to 1-1/4 in. nails.",
  },
  {
    assemblyId: "roofing-flashing-chimney-step-counter",
    componentKey: "mat_step_flashing_aluminum_cards",
    productNameIncludes: "4 in. x 4 in. x 8 in. Aluminum Step Flashing",
    conflict: "NOMINAL_DIMENSION",
    reason: "7 x 4 x 4 in. step-flashing requirement was matched to 4 x 4 x 8 in. flashing.",
  },
  {
    assemblyId: "sheathing-roof-plywood-cdx-1-2",
    componentKey: "mat_plywood_cdx_12_4x8",
    productNameIncludes: "3-Ply CDX Pine Plywood",
    conflict: "MATERIAL_SPEC",
    reason: "4-ply / 5-ply structural plywood requirement was matched to 3-ply plywood.",
  },
] as const;

function rejectionFor(
  component: PricedAssemblyComponent
): LegacyAssemblyMatchRejection | undefined {
  return HIGH_CONFIDENCE_LEGACY_ASSEMBLY_MATCH_REJECTIONS.find(
    (rejection) =>
      rejection.componentKey === component.componentKey &&
      component.productName.includes(rejection.productNameIncludes)
  );
}

export function auditLegacyAssemblyPriceMatches(
  components: readonly PricedAssemblyComponent[] = PRICED_ASSEMBLY_COMPONENTS
): LegacyAssemblyMatchAuditFinding[] {
  return components.flatMap((component) => {
    const rejection = rejectionFor(component);
    return rejection ? [{ ...rejection, component }] : [];
  });
}

/**
 * Conservative read view for legacy generated assembly-price evidence.
 * Rejected rows simply disappear; this helper never selects a replacement
 * supplier row and never mutates Costbook or Estimate state.
 */
export function filterAuditedLegacyAssemblyPriceMatches(
  components: readonly PricedAssemblyComponent[] = PRICED_ASSEMBLY_COMPONENTS
): PricedAssemblyComponent[] {
  return components.filter((component) => !rejectionFor(component));
}

export const AUDIT_FILTERED_LEGACY_PRICED_ASSEMBLY_COMPONENTS =
  filterAuditedLegacyAssemblyPriceMatches();
