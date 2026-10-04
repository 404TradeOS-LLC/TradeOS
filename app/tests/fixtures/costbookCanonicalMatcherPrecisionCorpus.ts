import type { SupplierProductForMatching } from "../../modules/costbook/canonicalProductMatcher";

export interface LabeledCanonicalMatchCase {
  label: string;
  input: SupplierProductForMatching;
  expectedCanonicalMaterialKey: string | null;
}

/**
 * Hand-labeled precision corpus for the 12-item Terre Haute Costbook pilot.
 *
 * The corpus intentionally includes:
 * - supplier-title variation;
 * - abbreviated dimensions and units;
 * - incomplete-but-related descriptions;
 * - nearby products that must not auto-link;
 * - subtype conflicts such as fittings and insulation board;
 * - package/UOM conflicts.
 *
 * The precision gate is about automatic links only: false negatives are
 * acceptable during the pilot because they fall back to review. False
 * positives are not.
 */
export const COSTBOOK_MATCHER_PRECISION_CORPUS: readonly LabeledCanonicalMatchCase[] = [
  ...positive("LUMBER.SPF.2X4.8FT.STUD", [
    ["2x4 x 8 ft SPF stud", "EA"], ["2 x 4 x 8' SPF lumber stud", "each"],
    ["SPF 2x4 96 in stud", "EA"], ["2x4x8 spruce pine fir stud", "EACH"],
    ["8 ft 2x4 SPF framing stud", "ea"], ["2x4 8ft SPF lumber", "each"],
    ["SPF stud 2 x 4 x 8 ft", "EA"], ["2x4x96in SPF stud", "EACH"],
    ["construction stud SPF 2x4 8 ft", "EA"], ["2x4 x 8ft stud lumber SPF", "each"],
    ["SPF framing lumber 2x4 8ft stud", "EA"], ["stud grade SPF 2 x 4 8 ft", "EACH"],
  ]),
  ...positive("SHEATHING.OSB.7_16IN.4X8.SHEET", [
    ["7/16 OSB 4x8 sheet", "sheet"], ["4 x 8 7/16 OSB sheathing", "SHEET"],
    ["OSB sheathing 7/16 4x8", "sheet"], ["7/16 in oriented strand board 4x8 OSB", "SHEET"],
    ["4x8 OSB panel 7/16", "sheet"], ["7/16 OSB panel 4 x 8", "SHEET"],
    ["OSB 4x8 7/16 sheathing sheet", "sheet"], ["7/16 OSB wall sheathing 4x8", "SHEET"],
    ["4 by 8 OSB 7/16 sheet", "sheet"], ["OSB structural panel 7/16 4x8", "SHEET"],
    ["7/16 OSB board 4x8 sheet", "sheet"], ["sheathing OSB 4x8 7/16", "SHEET"],
  ]),
  ...positive("DRYWALL.REG.0_5IN.4X8.SHEET", [
    ["1/2 drywall 4x8 sheet", "sheet"], ["4x8 1/2 gypsum drywall", "SHEET"],
    ["1/2 in gypsum board 4x8 drywall", "sheet"], ["drywall panel 1/2 4 x 8", "SHEET"],
    ["standard drywall 1/2 4x8 gypsum", "sheet"], ["4x8 gypsum sheet 1/2 drywall", "SHEET"],
    ["1/2 drywall gypsum panel 4x8", "sheet"], ["regular gypsum drywall 4x8 1/2", "SHEET"],
    ["drywall 4 x 8 x 1/2 gypsum", "sheet"], ["1/2 wallboard drywall 4x8 gypsum", "SHEET"],
    ["gypsum drywall 1/2in 4x8", "sheet"], ["4x8 drywall panel 1/2 gypsum", "SHEET"],
  ]),
  ...positive("DRYWALL.TYPE_X.0_625IN.4X8.SHEET", [
    ["5/8 Type X drywall 4x8", "sheet"], ["4x8 5/8 type-x gypsum drywall", "SHEET"],
    ["Type X gypsum board 5/8 4x8 drywall", "sheet"], ["5/8 fire rated Type X drywall 4 x 8", "SHEET"],
    ["drywall Type X 4x8 5/8", "sheet"], ["4x8 gypsum Type X 5/8 drywall", "SHEET"],
    ["5/8in Type-X drywall gypsum panel 4x8", "sheet"], ["Type X drywall panel 5/8 4x8", "SHEET"],
    ["gypsum drywall 5/8 type x 4x8", "sheet"], ["4 x 8 type-x drywall 5/8", "SHEET"],
    ["firecode Type X drywall 5/8 4x8 gypsum", "sheet"], ["5/8 Type X wallboard drywall 4x8", "SHEET"],
  ]),
  ...positive("CONCRETE.MIX.80LB.BAG", [
    ["80 lb concrete mix bag", "bag"], ["concrete mix 80-lb", "BAG"],
    ["80lb bag concrete mix", "bag"], ["general purpose concrete 80 lb mix", "BAG"],
    ["concrete 80lb mix", "bag"], ["80 lb ready mix concrete bag", "BAG"],
    ["bagged concrete mix 80 lb", "bag"], ["80-lb concrete construction mix", "BAG"],
    ["concrete mix eighty 80 lb bag", "bag"], ["80lb concrete mix general purpose", "BAG"],
    ["construction concrete 80 lb mix bag", "bag"], ["80 lb bag of concrete mix", "BAG"],
  ]),
  ...positive("ELECTRICAL.NMB.12_2.ROLL", [
    ["12/2 NM-B wire roll", "roll"], ["12-2 NMB cable roll", "ROLL"],
    ["Romex 12/2 NM-B", "roll"], ["12/2 nmb electrical cable roll", "ROLL"],
    ["12-2 Romex wire NM B roll", "roll"], ["NM-B 12/2 copper cable roll", "ROLL"],
    ["12/2 residential wire nmb roll", "roll"], ["12-2 NM B branch cable roll", "ROLL"],
    ["electrical wire 12/2 romex roll", "roll"], ["12/2 NMB building wire roll", "ROLL"],
    ["Romex brand 12-2 NM-B roll", "roll"], ["12/2 NM-B cable electrical roll", "ROLL"],
  ]),
  ...positive("PLUMBING.PEX.0_5IN.COIL", [
    ["1/2 PEX coil", "coil"], ["PEX tubing 1/2 coil", "COIL"],
    ["1/2 in PEX pipe coil", "coil"], ["PEX 0.5 in tubing coil", "COIL"],
    ["1/2 PEX water line coil", "coil"], ["PEX tubing coil 1/2", "COIL"],
    ["1/2in PEX plumbing coil", "coil"], ["PEX pipe 1/2 in coil", "COIL"],
    ["plumbing PEX 1/2 coil", "coil"], ["1/2 PEX tube coil", "COIL"],
    ["PEX potable tubing 1/2 coil", "coil"], ["1/2 inch PEX tubing coil", "COIL"],
  ]),
  ...positive("PLUMBING.PVC.DWV.3IN.STICK", [
    ["3 in PVC DWV stick", "stick"], ["PVC DWV 3in pipe", "STICK"],
    ["3 inch DWV PVC pipe stick", "stick"], ["PVC pipe 3 in DWV", "STICK"],
    ["3in PVC drain waste vent pipe", "stick"], ["DWV PVC 3 inch pipe stick", "STICK"],
    ["3 in PVC DWV plumbing pipe", "stick"], ["PVC DWV pipe 3in stick", "STICK"],
    ["3inch DWV PVC drain pipe", "stick"], ["plumbing PVC 3 in DWV stick", "STICK"],
    ["PVC DWV 3 in drain pipe stick", "stick"], ["3 in drain waste vent PVC pipe", "STICK"],
  ]),
  ...positive("INSULATION.FIBERGLASS.R13.BATT", [
    ["R-13 fiberglass insulation batt", "sq ft"], ["fiberglass batt insulation R13", "SQ_FT"],
    ["R13 insulation fiberglass batts", "sq ft"], ["R-13 batt fiberglass wall insulation", "SQ_FT"],
    ["fiberglass insulation R13 batt", "sq ft"], ["R13 fiberglass batt wall insulation", "SQ_FT"],
    ["R-13 fiberglass batt insulation", "sq ft"], ["batt insulation fiberglass R13", "SQ_FT"],
    ["fiberglass R13 wall batt insulation", "sq ft"], ["R13 batt insulation fiberglass", "SQ_FT"],
    ["R-13 fiberglass batts insulation", "sq ft"], ["wall insulation R13 fiberglass batt", "SQ_FT"],
  ]),
  ...positive("ROOFING.SHINGLE.ARCHITECTURAL.BUNDLE", [
    ["architectural shingles bundle", "bundle"], ["architectural shingle roofing bundle", "BUNDLE"],
    ["roofing architectural shingles bundle", "bundle"], ["laminated architectural shingle bundle", "BUNDLE"],
    ["architectural roof shingles bundle", "bundle"], ["shingles architectural roofing bundle", "BUNDLE"],
    ["architectural asphalt shingles bundle", "bundle"], ["bundle architectural roof shingle", "BUNDLE"],
    ["architectural shingle bundle roofing", "bundle"], ["roof shingles architectural bundle", "BUNDLE"],
    ["architectural laminated shingles bundle", "bundle"], ["bundle of architectural shingles", "BUNDLE"],
  ]),
  ...positive("PAINT.INTERIOR.WALL.GALLON", [
    ["interior wall paint gallon", "gallon"], ["interior paint wall gallon", "GAL"],
    ["gallon interior wall paint", "gallon"], ["interior latex wall paint gallon", "GAL"],
    ["wall paint interior gallon", "gallon"], ["interior wall coating paint gallon", "GAL"],
    ["interior house wall paint gallon", "gallon"], ["paint interior wall 1 gallon", "GAL"],
    ["interior wall paint gal", "gallon"], ["gallon wall paint interior", "GAL"],
    ["interior acrylic wall paint gallon", "gallon"], ["interior wall finish paint gallon", "GAL"],
  ]),
  ...positive("ADHESIVE.CONSTRUCTION.TUBE", [
    ["construction adhesive tube", "tube"], ["tube construction adhesive", "TUBE"],
    ["construction grade adhesive tube", "tube"], ["adhesive construction tube", "TUBE"],
    ["heavy duty construction adhesive tube", "tube"], ["construction adhesive cartridge tube", "TUBE"],
    ["all purpose construction adhesive tube", "tube"], ["tube of construction adhesive", "TUBE"],
    ["construction adhesive caulk tube", "tube"], ["pro construction adhesive tube", "TUBE"],
    ["construction bonding adhesive tube", "tube"], ["adhesive tube construction grade", "TUBE"],
  ]),
  ...negative([
    ["2x6 x 8 ft SPF stud", "EA"], ["2x4 x 10 ft SPF stud", "EA"],
    ["7/16 plywood 4x8 sheet", "SHEET"], ["1/2 OSB 4x8 sheet", "SHEET"],
    ["5/8 regular drywall 4x8", "SHEET"], ["1/2 Type X drywall 4x8", "SHEET"],
    ["60 lb concrete mix bag", "BAG"], ["80 lb mortar mix bag", "BAG"],
    ["14/2 NM-B cable roll", "ROLL"], ["12/3 NM-B cable roll", "ROLL"],
    ["1/2 PEX coupling", "BOX"], ["1/2 PEX elbow", "EACH"],
    ["3 in PVC DWV coupling", "EACH"], ["3 in PVC DWV tee", "EACH"],
    ["R-13 rigid board insulation", "SQ_FT"], ["R-13 foam insulation board", "SQ_FT"],
    ["3-tab shingles bundle", "BUNDLE"], ["architectural siding panel", "EACH"],
    ["exterior wall paint gallon", "GAL"], ["interior primer gallon", "GAL"],
    ["wood glue tube", "TUBE"], ["silicone sealant tube", "TUBE"],
    ["2x4 hanger hardware", "EACH"], ["OSB screw box", "BOX"],
    ["drywall screw box", "BOX"], ["concrete anchor box", "BOX"],
    ["12 gauge THHN wire spool", "ROLL"], ["PEX crimp ring box", "BOX"],
    ["PVC primer gallon", "GAL"], ["R-30 fiberglass batt insulation", "SQ_FT"],
    ["roofing underlayment roll", "ROLL"], ["interior wall paint 5 gallon", "PAIL"],
    ["construction adhesive case", "CASE"], ["3 in PVC pressure pipe", "STICK"],
    ["1/2 CPVC pipe coil", "COIL"], ["12/2 low-voltage cable roll", "ROLL"],
    ["gypsum joint compound bucket", "EACH"], ["4x8 cement board sheet", "SHEET"],
    ["80 lb sand mix bag", "BAG"], ["2x4x8 pressure treated SYP lumber", "EA"],
    ["R13 cellulose insulation bag", "BAG"], ["architectural shingle ridge cap bundle", "BUNDLE"],
    ["interior ceiling paint gallon", "GAL"], ["panel adhesive bucket", "EACH"],
    ["3 in ABS DWV pipe stick", "STICK"], ["1/2 PEX valve", "EACH"],
    ["7/16 OSB 4x9 sheet", "SHEET"], ["1/2 drywall 4x12 sheet", "SHEET"],
    ["5/8 Type X drywall 4x12", "SHEET"], ["100 lb concrete mix bag", "BAG"],
    ["10/2 NM-B cable roll", "ROLL"], ["3/4 PEX coil", "COIL"],
    ["4 in PVC DWV pipe stick", "STICK"], ["R-19 fiberglass batt insulation", "SQ_FT"],
    ["architectural shingles square", "SQ_FT"], ["interior wall stain gallon", "GAL"],
    ["construction adhesive bucket", "EACH"], ["2x4x8 cedar board", "EA"],
    ["7/16 MDF 4x8 sheet", "SHEET"], ["1/2 backer board 4x8", "SHEET"],
    ["5/8 fire-rated cement board 4x8", "SHEET"], ["80 lb stucco base coat bag", "BAG"],
    ["12/2 MC cable roll", "ROLL"], ["1/2 PEX tee", "EACH"],
    ["3 in PVC sewer coupling", "EACH"], ["R13 spray foam kit", "EACH"],
    ["architectural metal roofing panel", "EACH"], ["interior wall wallpaper roll", "ROLL"],
    ["construction epoxy cartridge", "TUBE"], ["2x4x8 steel stud", "EA"],
  ]),
] as const;

function positive(
  expectedCanonicalMaterialKey: string,
  rows: ReadonlyArray<readonly [string, string]>
): LabeledCanonicalMatchCase[] {
  return rows.map(([name, purchaseUnit], index) => ({
    label: `positive-${expectedCanonicalMaterialKey}-${index + 1}`,
    input: { name, purchaseUnit },
    expectedCanonicalMaterialKey,
  }));
}

function negative(rows: ReadonlyArray<readonly [string, string]>): LabeledCanonicalMatchCase[] {
  return rows.map(([name, purchaseUnit], index) => ({
    label: `negative-${index + 1}`,
    input: { name, purchaseUnit },
    expectedCanonicalMaterialKey: null,
  }));
}
