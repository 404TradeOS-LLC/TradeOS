import { IntakeProposalDraft, Trade } from "./types";

interface DraftConfig {
  assumptions: string[];
  exclusions: string[];
  timeline: string;
}

const DRAFT_CONFIG: Record<Trade, DraftConfig> = {
  "Deck": {
    assumptions: [
      "Framing will be built to local code standards and setback requirements.",
      "Material selections will be finalized with the owner prior to order.",
      "Existing ledger attachment points or foundation are in sound condition.",
    ],
    exclusions: ["Permit fees unless specifically listed", "Landscaping restoration around the deck perimeter", "Electrical, gas, or plumbing unless specifically listed"],
    timeline: "Most deck projects are scheduled across 1 to 3 weeks depending on size, complexity, and permit timing.",
  },
  "Roofing": {
    assumptions: [
      "Tear-off and disposal of existing material is included unless noted otherwise.",
      "Decking replacement will be quoted per sheet as discovered during tear-off.",
      "Flashings, ice-and-water shield, and underlayment will be replaced.",
    ],
    exclusions: ["Structural deck replacement beyond isolated spot repairs unless specifically listed", "Chimney rebuilding or skylight installation unless specifically listed"],
    timeline: "Roofing of this scope is typically scheduled as a 2 to 5 day field operation once materials are confirmed.",
  },
  "Bathroom Remodel": {
    assumptions: [
      "Existing rough-in locations will be maintained unless a layout change is approved.",
      "Tile selection, fixture models, and vanity specs will be confirmed before ordering.",
      "Wet areas will use cement board or equivalent moisture-resistant backing.",
    ],
    exclusions: ["Permit fees unless specifically listed", "Fixture supply unless specifically listed", "Mold remediation or structural repairs discovered after demo unless specifically listed"],
    timeline: "A bathroom remodel of this scope is typically planned across 2 to 4 weeks including demo, rough-in, tile, and fixture installation.",
  },
  "Kitchen Remodel": {
    assumptions: [
      "Cabinet layout and appliance placement will be finalized before ordering.",
      "Countertop template and fabrication will occur after cabinet installation is complete.",
      "Electrical and plumbing work will comply with current code.",
    ],
    exclusions: ["Appliances unless specifically listed", "Flooring outside the kitchen area", "Permit fees unless specifically listed"],
    timeline: "Kitchen remodels of this scope are typically planned across 3 to 6 weeks depending on cabinet lead time and material selections.",
  },
  "Whole Home Remodel": {
    assumptions: [
      "Work will be sequenced trade by trade with the owner informed of the schedule in advance.",
      "Structural, electrical, and plumbing scope will be finalized with drawings before demo begins.",
      "Room-by-room selections will be confirmed before ordering materials for that area.",
    ],
    exclusions: ["Architectural or engineering design fees unless specifically listed", "Furniture, decor, or staging", "Temporary housing during construction"],
    timeline: "A whole home remodel of this scope is typically planned across 2 to 6 months depending on square footage and structural scope.",
  },
  "Fence": {
    assumptions: [
      "Post spacing and depth will meet local building code and load requirements.",
      "Property line location will be owner-verified before installation begins.",
      "Gates will be plumb, level, and hardware-complete at final walkthrough.",
    ],
    exclusions: ["Survey or property line marking unless specifically listed", "Removal of existing fence unless specifically listed", "Permit fees unless specifically listed"],
    timeline: "Fence installation is typically scheduled across 2 to 5 working days depending on linear footage and site conditions.",
  },
  "Concrete": {
    assumptions: [
      "Subgrade will be prepared, compacted, and base material placed before the pour.",
      "Reinforcement (rebar or wire mesh) is included unless noted as optional.",
      "Curing and sealing will be performed per manufacturer guidelines.",
    ],
    exclusions: ["Demolition of existing flatwork unless specifically listed", "Grading or drainage work beyond the immediate pour area unless specifically listed", "Permit fees unless specifically listed"],
    timeline: "Concrete flatwork is typically placed in 1 to 3 days with a full cure period before heavy use.",
  },
  "Tree Service": {
    assumptions: [
      "All felled trees and limbs will be sectioned and removed from the property.",
      "Stump grinding will produce chips left on-site unless haul-off is listed.",
      "The crew will leave the site clean and clear of debris.",
    ],
    exclusions: ["Landscaping restoration or seeding over removed stumps unless specifically listed", "Aerial lift or crane work unless specifically listed"],
    timeline: "Tree removal and stump grinding of this scope is typically completed within 1 to 3 days depending on access and tree count.",
  },
  "Excavation": {
    assumptions: [
      "Utility locates will be completed before digging begins.",
      "Excavated material will be assumed suitable for on-site spreading unless haul-off is listed.",
      "Grading will meet the finish elevations agreed with the owner.",
    ],
    exclusions: ["Rock removal or blasting unless specifically listed", "Permit fees unless specifically listed", "Erosion control beyond the immediate work area unless specifically listed"],
    timeline: "Excavation of this scope is typically completed within 1 to 4 days depending on soil conditions and access.",
  },
  "Landscaping": {
    assumptions: [
      "Existing irrigation and drainage will be assumed functional unless noted otherwise.",
      "Plant and material selections will be confirmed with the owner before ordering.",
      "Seasonal planting windows may affect the installation date.",
    ],
    exclusions: ["Ongoing lawn maintenance unless specifically listed", "Tree removal unless specifically listed", "Permit fees unless specifically listed"],
    timeline: "Landscaping installation is typically scheduled across 2 to 7 working days depending on scope and plant availability.",
  },
  "Flooring": {
    assumptions: [
      "Subfloor will be inspected and any soft spots or squeaks addressed before installation.",
      "Material will acclimate to the space per manufacturer recommendations.",
      "Transitions, thresholds, and base trim are included unless noted otherwise.",
    ],
    exclusions: ["Removal and disposal of existing flooring unless specifically listed", "Subfloor replacement beyond minor repairs unless specifically listed", "Furniture moving unless specifically listed"],
    timeline: "Flooring installation is typically scheduled across 2 to 5 working days depending on material and square footage.",
  },
  "Painting": {
    assumptions: [
      "All surfaces will be cleaned, patched, and primed before finish coats.",
      "Two finish coats will be applied unless otherwise specified.",
      "Furniture and fixtures will be masked or moved as needed.",
    ],
    exclusions: ["Color changes beyond the listed system unless specifically listed", "Wallpaper removal unless specifically listed", "Window and door hardware reinstallation unless specifically listed"],
    timeline: "Painting of this scope is typically scheduled across 2 to 6 working days depending on room count and surface prep.",
  },
  "Drywall": {
    assumptions: [
      "All panels will be hung plumb, taped, and finished to a Level 4 standard unless otherwise specified.",
      "Corner bead and trim will be installed at all exposed edges.",
      "The finished surface will be primed and ready for paint.",
    ],
    exclusions: ["Paint or texture beyond primer unless specifically listed", "Insulation or vapor barrier unless specifically listed", "Electrical or mechanical rough-in unless specifically listed"],
    timeline: "Drywall installation and finish work is typically scheduled across 3 to 7 working days including drying time between coats.",
  },
  "Electrical": {
    assumptions: [
      "All work will comply with current electrical code and local inspection requirements.",
      "Existing panel capacity is assumed adequate unless an upgrade is specifically listed.",
      "Fixture and device selections will be confirmed before rough-in.",
    ],
    exclusions: ["Panel upgrades unless specifically listed", "Permit and inspection fees unless specifically listed", "Fixture supply unless specifically listed"],
    timeline: "Electrical work of this scope is typically scheduled across 1 to 3 days depending on circuit count and inspection scheduling.",
  },
  "HVAC": {
    assumptions: [
      "Existing ductwork is assumed compatible unless modification is specifically listed.",
      "Equipment will be sized to the square footage and climate zone.",
      "Manufacturer warranty registration will be completed after install.",
    ],
    exclusions: ["Ductwork replacement unless specifically listed", "Permit fees unless specifically listed", "Electrical service upgrades required to support new equipment unless specifically listed"],
    timeline: "HVAC installation of this scope is typically scheduled across 1 to 2 days once equipment is on-site.",
  },
  "Plumbing": {
    assumptions: [
      "All work will comply with current plumbing code and local inspection requirements.",
      "Existing shut-off valves are assumed functional unless replacement is specifically listed.",
      "Fixture selections will be confirmed before rough-in.",
    ],
    exclusions: ["Fixture supply unless specifically listed", "Wall or ceiling repair after access unless specifically listed", "Permit and inspection fees unless specifically listed"],
    timeline: "Plumbing work of this scope is typically scheduled across 1 to 3 days depending on scope and inspection scheduling.",
  },
  "Siding": {
    assumptions: [
      "Existing siding and weather barrier will be removed and disposed of.",
      "New house wrap will be installed before cladding.",
      "Soffit, fascia, and trim will be included unless noted otherwise.",
    ],
    exclusions: ["Window or door replacement unless specifically listed", "Structural sheathing replacement beyond isolated rot repairs unless specifically listed", "Permit fees unless specifically listed"],
    timeline: "Siding installation is typically scheduled across 4 to 10 working days depending on material selection and facade size.",
  },
  "Windows": {
    assumptions: [
      "Rough opening sizes will be verified on-site before ordering.",
      "Installation will be flashed, sealed, and trimmed to a weathertight standard.",
      "Units will be adjusted and hardware-complete at final walkthrough.",
    ],
    exclusions: ["Interior or exterior trim painting unless specifically listed", "Structural header modifications unless specifically listed", "Permit fees unless specifically listed"],
    timeline: "Window replacement is typically scheduled across 1 to 3 days once units are on-site.",
  },
  "Doors": {
    assumptions: [
      "Rough opening sizes will be verified on-site before ordering.",
      "Installation will be flashed, sealed, and trimmed to a weathertight standard.",
      "Units will be adjusted and hardware-complete at final walkthrough.",
    ],
    exclusions: ["Interior or exterior trim painting unless specifically listed", "Structural header modifications unless specifically listed", "Permit fees unless specifically listed"],
    timeline: "Door replacement is typically scheduled across 1 to 2 days once units are on-site.",
  },
  "Garage": {
    assumptions: [
      "Foundation and framing will be built to local code and load requirements.",
      "Roofing and siding will match the finish level agreed with the owner.",
      "Overhead door openers will be installed and tested at completion.",
    ],
    exclusions: ["Permit fees unless specifically listed", "Interior finishing (drywall, flooring) unless specifically listed", "Electrical or plumbing utilities unless specifically listed"],
    timeline: "Garage construction of this scope is typically scheduled across 2 to 5 weeks depending on size and foundation type.",
  },
  "Pole Barn": {
    assumptions: [
      "Post spacing and truss design will meet local code and snow/wind load requirements.",
      "Floor type will be confirmed with the owner before the foundation is poured or prepared.",
      "Siding and roofing will match the finish level agreed with the owner.",
    ],
    exclusions: ["Permit fees unless specifically listed", "Electrical or plumbing utilities unless specifically listed", "Interior finishing unless specifically listed"],
    timeline: "Pole barn construction of this scope is typically scheduled across 2 to 6 weeks depending on size and site conditions.",
  },
  "Addition": {
    assumptions: [
      "Foundation type will match the existing home for a proper structural tie-in.",
      "Framing, roofing, and exterior finishes will match the existing home unless otherwise specified.",
      "Stamped engineering drawings will be obtained before permitting, if required.",
    ],
    exclusions: ["Architectural or engineering design fees unless specifically listed", "Interior finish selections beyond a standard allowance unless specifically listed", "Permit fees unless specifically listed"],
    timeline: "A home addition of this scope is typically scheduled across 2 to 4 months depending on square footage and permitting.",
  },
  "Demolition": {
    assumptions: [
      "All debris will be loaded and hauled off-site as part of the base scope.",
      "Utility disconnections and capping will be coordinated before demo begins.",
      "The site will be left clean, broom-swept, and ready for the next trade.",
    ],
    exclusions: ["Hazardous material abatement (asbestos, lead) unless specifically listed", "Grading or earthwork beyond the demo footprint unless specifically listed"],
    timeline: "Selective demolition of this scope is typically completed within 1 to 5 working days depending on materials and access.",
  },
};

const DEFAULT_PAYMENT_SCHEDULE = [
  { label: "Deposit", amountPercent: 30, notes: "Due at scheduling to secure labor and materials." },
  { label: "Progress payment", amountPercent: 40, notes: "Due once the main field work is underway." },
  { label: "Final payment", amountPercent: 30, notes: "Due at substantial completion and walkthrough." },
];

export function buildProposalDraft(scope: string, trade: Trade | null): IntakeProposalDraft {
  if (!trade) {
    return {
      scopeOfWork: scope.trim() || "Scope to be confirmed after a follow-up conversation.",
      assumptions: ["This draft is based solely on the currently documented scope."],
      exclusions: ["Permit fees unless specifically listed", "Engineering or design services unless specifically listed"],
      timeline: "Scheduling will be confirmed once the project type and scope are identified.",
      paymentSchedule: DEFAULT_PAYMENT_SCHEDULE,
    };
  }

  const config = DRAFT_CONFIG[trade];

  return {
    scopeOfWork: buildScopeStatement(scope, trade),
    assumptions: config.assumptions,
    exclusions: config.exclusions,
    timeline: config.timeline,
    paymentSchedule: DEFAULT_PAYMENT_SCHEDULE,
  };
}

function buildScopeStatement(scope: string, trade: Trade): string {
  const trimmed = scope.trim();
  if (!trimmed) {
    return `${trade} work as described. Final scope will be confirmed after a follow-up conversation and measurement review.`;
  }
  return `${trimmed} Final specifications, material selections, and quantities will be confirmed at or before the pre-construction walkthrough.`;
}
