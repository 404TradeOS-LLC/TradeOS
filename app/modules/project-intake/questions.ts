import { ImportanceLevel, MissingInformationItem, Trade } from "./types";

interface FieldCheck {
  field: string;
  question: string;
  reason: string;
  importance: ImportanceLevel;
  isAnswered: (scope: string) => boolean;
}

// ── Shared deterministic detectors ──────────────────────────────────────────
// Every detector runs against the already-lowercased scope string.

const mentions = (scope: string, ...terms: string[]): boolean => terms.some((term) => scope.includes(term));

const hasDimensionPair = (scope: string): boolean =>
  /\d+\s*['x]\s*\d+/i.test(scope) || /\d+\s*(sq\.?\s*ft|square\s*feet|sf)\b/i.test(scope);

const hasLinearFootage = (scope: string): boolean => /\d+\s*(linear\s*(feet|ft)|lf|feet|ft)\b/i.test(scope);

const hasSquaresCount = (scope: string): boolean => /\d+\s*square/i.test(scope);

const hasUnitCount = (scope: string, unit: string): boolean =>
  new RegExp(`\\d+[^.]*\\b${unit}`, "i").test(scope) ||
  new RegExp(`\\b(one|two|three|four|five|six|seven|eight|nine|ten)\\b[^.]*\\b${unit}`, "i").test(scope);

// ── Per-trade field definitions ─────────────────────────────────────────────

const TRADE_FIELDS: Record<Trade, FieldCheck[]> = {
  "Deck": [
    { field: "dimensions", question: "What are the overall deck dimensions (length and width)?", reason: "Needed to calculate deck area, framing layout, and material quantities.", importance: "Critical", isAnswered: hasDimensionPair },
    { field: "decking material", question: "What decking material should the proposal assume — pressure-treated lumber, composite, or cedar?", reason: "Material choice drives fastener selection, framing spacing, and finish work.", importance: "Critical", isAnswered: (s) => mentions(s, "treated", "pt deck", "pressure treated", "composite", "cedar", "trex") },
    { field: "stairs", question: "Are stairs included, and if so how many steps and what width?", reason: "Stairs require their own footings, stringers, and code-compliant rise/run.", importance: "Recommended", isAnswered: (s) => mentions(s, "stair", "stairs", "step") },
    { field: "guard rails", question: "Should the proposal include guard rails, and if so what style (wood, metal, cable)?", reason: "Guard rails are code-required above a certain height above grade and affect material cost.", importance: "Recommended", isAnswered: (s) => mentions(s, "rail", "railing", "guard rail") },
    { field: "ledger attachment", question: "Will the deck attach to the house with a ledger board, and is the rim joist in sound condition?", reason: "Ledger attachment method affects structural design and waterproofing detail.", importance: "Recommended", isAnswered: (s) => mentions(s, "ledger") },
    { field: "height above grade", question: "How high will the deck surface sit above grade?", reason: "Height above grade determines whether guard rails and stair rise are code-required.", importance: "Recommended", isAnswered: (s) => mentions(s, "above grade", "off the ground", "grade level", "elevated") },
    { field: "permit", question: "Is a building permit required by the local municipality for this project?", reason: "Permit requirements affect scheduling and whether permit fees are included in the proposal.", importance: "Recommended", isAnswered: (s) => mentions(s, "permit") },
    { field: "footing depth", question: "What footing depth is required by local frost-line code?", reason: "Footing depth is a structural and code requirement that varies by jurisdiction.", importance: "Optional", isAnswered: (s) => mentions(s, "footing", "footer", "frost depth", "frost line") },
    { field: "joist spacing", question: "What joist spacing should the proposal assume for the decking material chosen?", reason: "Joist spacing depends on decking material and span tables.", importance: "Optional", isAnswered: (s) => mentions(s, "joist") },
    { field: "county", question: "What county or municipality is the project located in?", reason: "Permit rules, setback requirements, and inspection timelines vary by county.", importance: "Optional", isAnswered: (s) => mentions(s, "county") },
  ],
  "Roofing": [
    { field: "squares", question: "How many squares of roof area is being replaced?", reason: "Roof area in squares is the base unit for material and labor quantities.", importance: "Critical", isAnswered: hasSquaresCount },
    { field: "tear-off", question: "Will tear-off and disposal of the existing roof be included in the base scope?", reason: "Tear-off scope determines dumpster needs, labor hours, and disposal cost.", importance: "Critical", isAnswered: (s) => mentions(s, "tear off", "tear-off", "reroof", "re-roof", "resheet", "re-sheet", "replace") },
    { field: "layers", question: "How many layers of existing roofing are currently on the structure?", reason: "Multiple layers require full tear-off and affect disposal weight and cost.", importance: "Recommended", isAnswered: (s) => mentions(s, "layer") },
    { field: "pitch", question: "What is the roof pitch?", reason: "Steep-slope pitch affects labor difficulty, safety requirements, and material choice.", importance: "Recommended", isAnswered: (s) => mentions(s, "pitch", "slope") },
    { field: "flashing", question: "Should flashing around penetrations and edges be replaced as part of this scope?", reason: "Flashing condition is a common source of leaks if not addressed during a reroof.", importance: "Recommended", isAnswered: (s) => mentions(s, "flashing") },
    { field: "sheathing condition", question: "Is the roof sheathing/decking in known good condition, or should replacement be assumed?", reason: "Rotten or soft sheathing found during tear-off is a common source of change orders.", importance: "Optional", isAnswered: (s) => mentions(s, "sheathing", "resheet", "re-sheet", "decking condition") },
    { field: "chimneys", question: "Are there any chimneys that need flashing or cricket work?", reason: "Chimneys require custom flashing and crickets that add labor and material.", importance: "Optional", isAnswered: (s) => mentions(s, "chimney") },
    { field: "valleys", question: "How many roof valleys are present, and should they be woven or open metal?", reason: "Valley count and style affect underlayment and flashing material quantities.", importance: "Optional", isAnswered: (s) => mentions(s, "valley") },
    { field: "ridge vent", question: "Should a ridge vent be installed or replaced for attic ventilation?", reason: "Ventilation upgrades affect material scope and may be needed for warranty compliance.", importance: "Optional", isAnswered: (s) => mentions(s, "ridge vent") },
    { field: "permit", question: "Is a roofing permit required by the local municipality?", reason: "Permit requirements affect scheduling and whether permit fees are included.", importance: "Recommended", isAnswered: (s) => mentions(s, "permit") },
  ],
  "Bathroom Remodel": [
    { field: "remodel scope level", question: "Is this a full gut-to-studs remodel or a surface-level update?", reason: "Scope level determines whether plumbing/electrical rough-in is disturbed.", importance: "Critical", isAnswered: (s) => mentions(s, "full", "gut", "complete", "surface", "partial", "refresh") },
    { field: "square footage", question: "What is the approximate square footage of the bathroom?", reason: "Square footage drives tile, flooring, and labor quantities.", importance: "Recommended", isAnswered: hasDimensionPair },
    { field: "plumbing changes", question: "Should the proposal include plumbing rough-in changes or fixture relocations?", reason: "Moving plumbing fixtures significantly changes labor and permitting scope.", importance: "Recommended", isAnswered: (s) => mentions(s, "move plumbing", "relocate", "rough-in", "reroute plumbing") },
    { field: "tile/flooring material", question: "What tile or flooring material should the draft assume?", reason: "Material selection affects installation method and finish schedule.", importance: "Optional", isAnswered: (s) => mentions(s, "tile", "porcelain", "marble", "lvp") },
    { field: "vanity/fixture sourcing", question: "Will the vanity and fixtures be owner-supplied or contractor-supplied?", reason: "Sourcing responsibility affects lead time and proposal exclusions.", importance: "Optional", isAnswered: (s) => mentions(s, "vanity", "fixture") },
    { field: "permit", question: "Is a permit required for this bathroom remodel?", reason: "Plumbing and electrical work in a bathroom often triggers a permit requirement.", importance: "Recommended", isAnswered: (s) => mentions(s, "permit") },
  ],
  "Kitchen Remodel": [
    { field: "cabinet scope", question: "Are new cabinets included, or is this a refinish or reface?", reason: "Cabinet scope is the single largest cost and schedule driver in a kitchen remodel.", importance: "Critical", isAnswered: (s) => mentions(s, "cabinet", "reface", "refinish") },
    { field: "countertop material", question: "Should the proposal include countertop fabrication, and what material should it assume?", reason: "Countertop material and fabrication lead time affect scheduling and cost.", importance: "Recommended", isAnswered: (s) => mentions(s, "countertop", "quartz", "granite", "butcher block") },
    { field: "appliance scope", question: "Will appliance removal and installation be part of the scope?", reason: "Appliance scope affects electrical/gas hookups and delivery coordination.", importance: "Recommended", isAnswered: (s) => mentions(s, "appliance") },
    { field: "layout changes", question: "Are there layout changes that require moving plumbing or electrical?", reason: "Moving plumbing or electrical for a new layout significantly changes scope.", importance: "Recommended", isAnswered: (s) => mentions(s, "layout", "move plumbing", "move electrical", "relocate") },
    { field: "square footage", question: "What is the approximate square footage of the kitchen?", reason: "Square footage drives flooring, cabinet run length, and labor quantities.", importance: "Optional", isAnswered: hasDimensionPair },
    { field: "permit", question: "Is a permit required for this kitchen remodel?", reason: "Electrical, plumbing, or structural changes often trigger a permit requirement.", importance: "Optional", isAnswered: (s) => mentions(s, "permit") },
  ],
  "Whole Home Remodel": [
    { field: "total square footage", question: "What is the total square footage of the home being remodeled?", reason: "Total square footage is the primary driver of scope and duration for a whole-home remodel.", importance: "Critical", isAnswered: (s) => hasDimensionPair(s) || /\d+\s*(sq\.?\s*ft|square\s*feet)/i.test(s) },
    { field: "rooms/areas affected", question: "Which rooms or areas of the home are included in this remodel?", reason: "Room-by-room scope is needed to sequence trades and estimate accurately.", importance: "Critical", isAnswered: (s) => mentions(s, "kitchen", "bathroom", "bedroom", "living room", "whole house", "entire home", "all rooms") },
    { field: "structural changes", question: "Are any structural changes planned, such as removing load-bearing walls or adding square footage?", reason: "Structural work requires engineering review and affects permitting timeline.", importance: "Recommended", isAnswered: (s) => mentions(s, "structural", "load bearing", "load-bearing", "addition", "foundation") },
    { field: "permit/engineering", question: "Has an architect or engineer been engaged, and is a permit already in process?", reason: "A whole-home remodel almost always requires permits and may require stamped drawings.", importance: "Recommended", isAnswered: (s) => mentions(s, "permit", "engineer", "architect") },
    { field: "occupancy during construction", question: "Will the home be occupied during construction, or will it be vacant?", reason: "Occupancy affects phasing, containment, and daily work-hour restrictions.", importance: "Optional", isAnswered: (s) => mentions(s, "occupied", "vacant", "living there", "move out") },
  ],
  "Fence": [
    { field: "linear footage", question: "What is the total linear footage of fence being installed?", reason: "Linear footage is the base unit for post count, panel count, and material quantities.", importance: "Critical", isAnswered: hasLinearFootage },
    { field: "material", question: "What material should the proposal assume — wood, vinyl, chain link, or composite?", reason: "Material choice drives post spacing, hardware, and finish requirements.", importance: "Critical", isAnswered: (s) => mentions(s, "wood", "vinyl", "chain link", "composite", "privacy fence", "aluminum", "wrought iron", "picket") },
    { field: "height", question: "What height should the fence be?", reason: "Height affects material quantity and may be restricted by local code.", importance: "Recommended", isAnswered: (s) => /\d+\s*(ft|foot|feet)\s*(tall|high)/i.test(s) },
    { field: "existing fence removal", question: "Does the existing fence need to be removed and disposed of first?", reason: "Removal of an existing fence adds labor and disposal cost not covered by new install pricing.", importance: "Recommended", isAnswered: (s) => mentions(s, "remove existing", "tear out", "demo") },
    { field: "gates", question: "Are gates included, and if so how many and what width?", reason: "Gates require additional hardware and framing beyond standard fence panels.", importance: "Optional", isAnswered: (s) => mentions(s, "gate") },
    { field: "permit", question: "Is a permit required for this fence installation?", reason: "Fence height and location relative to property lines can trigger permit requirements.", importance: "Optional", isAnswered: (s) => mentions(s, "permit") },
  ],
  "Concrete": [
    { field: "dimensions/area", question: "What are the approximate dimensions or square footage of the pour area?", reason: "Area determines concrete volume, forming, and finishing labor.", importance: "Critical", isAnswered: hasDimensionPair },
    { field: "excavation/grading", question: "Is excavation, grading, and sub-base prep included in the scope?", reason: "Sub-base prep affects slab performance and is often the largest hidden cost variable.", importance: "Recommended", isAnswered: (s) => mentions(s, "excavate", "grade", "grading", "sub-base", "subgrade") },
    { field: "finish type", question: "What finish should the proposal assume — broom finish, exposed aggregate, or stamped?", reason: "Finish type significantly affects labor cost and cure-time handling.", importance: "Recommended", isAnswered: (s) => mentions(s, "broom finish", "stamped", "exposed aggregate", "polished") },
    { field: "reinforcement", question: "Should reinforcement (rebar or wire mesh) be included in the pour?", reason: "Reinforcement affects load capacity and is often code-required for driveways.", importance: "Optional", isAnswered: (s) => mentions(s, "rebar", "wire mesh", "fiber mesh") },
    { field: "existing demo", question: "Is demolition of existing flatwork required before the new pour?", reason: "Demo of existing concrete adds disposal and labor cost not covered by new-pour pricing.", importance: "Optional", isAnswered: (s) => mentions(s, "demo", "remove existing", "tear out") },
    { field: "permit", question: "Is a permit required for this concrete work?", reason: "Driveway and flatwork permits vary by municipality.", importance: "Optional", isAnswered: (s) => mentions(s, "permit") },
  ],
  "Tree Service": [
    { field: "tree count", question: "How many trees are being removed or trimmed?", reason: "Tree count is the base unit for crew time and equipment scheduling.", importance: "Critical", isAnswered: (s) => hasUnitCount(s, "trees?") },
    { field: "stump grinding scope", question: "Should stump grinding be included for each removal?", reason: "Stump grinding is a separate operation with its own equipment and cost.", importance: "Recommended", isAnswered: (s) => mentions(s, "stump", "grind") },
    { field: "tree species", question: "What species are the trees being removed or trimmed?", reason: "Species affects wood density, canopy size, and removal difficulty.", importance: "Recommended", isAnswered: (s) => mentions(s, "maple", "oak", "pine", "ash", "elm", "birch", "willow", "spruce") },
    { field: "haul-off", question: "Is full debris haul-off and site cleanup included in the scope?", reason: "Haul-off scope determines dump fees and labor beyond the cutting itself.", importance: "Optional", isAnswered: (s) => mentions(s, "haul", "debris", "cleanup", "clean up") },
    { field: "access/clearance", question: "Are there access or clearance challenges near structures, fences, or power lines?", reason: "Obstacles near the drop zone affect whether a crane or rigging is required.", importance: "Optional", isAnswered: (s) => mentions(s, "power line", "structure", "clearance", "access", "fence") },
  ],
  "Excavation": [
    { field: "area/volume", question: "What is the approximate area or volume of material to be excavated?", reason: "Volume determines equipment size, truck count, and disposal cost.", importance: "Critical", isAnswered: (s) => hasDimensionPair(s) || mentions(s, "cubic yard", "yard of dirt") },
    { field: "grading scope", question: "Is site grading or clearing included as part of the scope?", reason: "Grading and clearing are commonly bundled with excavation but priced separately.", importance: "Recommended", isAnswered: (s) => mentions(s, "grade", "grading", "brush hog", "clear the lot") },
    { field: "utility locates", question: "Have utility locates (811) been requested for the dig area?", reason: "Utility locates are required before excavation to avoid striking buried lines.", importance: "Recommended", isAnswered: (s) => mentions(s, "utility", "811", "locate") },
    { field: "soil conditions", question: "Are the soil conditions known — rock, clay, or sandy soil?", reason: "Soil type affects equipment selection and excavation productivity.", importance: "Optional", isAnswered: (s) => mentions(s, "rock", "clay", "sandy soil") },
    { field: "spoil removal", question: "Will excess spoil be hauled off-site or spread on the property?", reason: "Spoil disposal method affects truck count and dump fees.", importance: "Optional", isAnswered: (s) => mentions(s, "haul", "spoil", "dirt removal") },
  ],
  "Landscaping": [
    { field: "area", question: "What is the approximate area of the landscaping project?", reason: "Area drives plant, sod, and mulch quantities.", importance: "Critical", isAnswered: hasDimensionPair },
    { field: "scope type", question: "What type of work is included — planting, sod, hardscape, or irrigation?", reason: "Scope type determines the trade mix and equipment needed.", importance: "Critical", isAnswered: (s) => mentions(s, "planting", "sod", "mulch", "hardscape", "paver", "irrigation", "retaining wall") },
    { field: "drainage", question: "Are there known drainage issues that should be addressed?", reason: "Drainage problems often require grading or a French drain in addition to planting.", importance: "Recommended", isAnswered: (s) => mentions(s, "drain", "french drain") },
    { field: "plant/material selection", question: "What plant, sod, or hardscape material selections should the draft assume?", reason: "Material selection affects cost and seasonal availability.", importance: "Optional", isAnswered: (s) => mentions(s, "plant", "sod", "mulch", "shrub") },
    { field: "maintenance plan", question: "Should an ongoing maintenance plan be included, or is this a one-time installation?", reason: "Ongoing maintenance is a separate recurring line item from installation.", importance: "Optional", isAnswered: (s) => mentions(s, "maintenance", "ongoing") },
  ],
  "Flooring": [
    { field: "material", question: "What material should the proposal assume — LVP, hardwood, tile, or carpet?", reason: "Material choice drives underlayment, transitions, and installation method.", importance: "Critical", isAnswered: (s) => mentions(s, "lvp", "hardwood", "tile", "carpet", "laminate", "vinyl plank") },
    { field: "square footage", question: "What is the approximate square footage of the floor area?", reason: "Square footage is the base unit for material and labor quantities.", importance: "Critical", isAnswered: hasDimensionPair },
    { field: "existing floor removal", question: "Does the existing flooring need to be removed and disposed of first?", reason: "Removal and disposal of existing flooring adds labor not covered by new-install pricing.", importance: "Recommended", isAnswered: (s) => mentions(s, "remove", "tear out", "demo") },
    { field: "subfloor condition", question: "Is the subfloor in known good condition, or should repairs be assumed?", reason: "Subfloor issues discovered during tear-out are a common source of change orders.", importance: "Optional", isAnswered: (s) => mentions(s, "subfloor") },
    { field: "transitions", question: "Are transitions, thresholds, or stair nosings included?", reason: "Transition pieces are a separate material and labor line from field flooring.", importance: "Optional", isAnswered: (s) => mentions(s, "transition", "threshold") },
  ],
  "Painting": [
    { field: "interior or exterior", question: "Is this interior, exterior, or both?", reason: "Interior and exterior painting require different prep, materials, and weather windows.", importance: "Critical", isAnswered: (s) => mentions(s, "interior", "exterior") },
    { field: "room/surface count", question: "How many rooms or surfaces are included in the scope?", reason: "Room count is the base unit for paint and labor quantities.", importance: "Recommended", isAnswered: (s) => hasUnitCount(s, "rooms?") },
    { field: "prep scope", question: "Should the proposal include full surface prep, patching, and primer or only finish coats?", reason: "Prep scope significantly affects labor hours and finish quality.", importance: "Recommended", isAnswered: (s) => mentions(s, "prep", "patch", "primer", "sand") },
    { field: "sheen", question: "What sheen level should the draft assume (flat, eggshell, semi-gloss)?", reason: "Sheen affects paint cost and is typically specified per room type.", importance: "Optional", isAnswered: (s) => mentions(s, "flat", "eggshell", "satin", "semi-gloss", "gloss") },
    { field: "color selection", question: "Have color selections been made, or should the draft assume they're pending?", reason: "Pending color selection can delay ordering and scheduling.", importance: "Optional", isAnswered: (s) => mentions(s, "color") },
  ],
  "Drywall": [
    { field: "scope type", question: "Is this new drywall installation or repairs to existing?", reason: "New installation and repair work require different crews and material quantities.", importance: "Critical", isAnswered: (s) => mentions(s, "new", "repair", "patch") },
    { field: "square footage", question: "What is the approximate square footage of wall or ceiling area?", reason: "Square footage is the base unit for board and mud/tape quantities.", importance: "Recommended", isAnswered: hasDimensionPair },
    { field: "texture", question: "What texture should the proposal assume — smooth, orange peel, or knockdown?", reason: "Texture affects finish labor and tool requirements.", importance: "Recommended", isAnswered: (s) => mentions(s, "smooth", "orange peel", "knockdown", "texture") },
    { field: "finish level", question: "Should the scope include priming and a paint-ready finish, or drywall board only?", reason: "Finish level determines whether the scope ends at taping or continues through primer.", importance: "Optional", isAnswered: (s) => mentions(s, "level 4", "level 5", "paint-ready", "primed") },
  ],
  "Electrical": [
    { field: "scope type", question: "What electrical work is needed — panel upgrade, rewiring, or fixture/outlet installation?", reason: "Scope type determines whether the work requires a full permit and inspection.", importance: "Critical", isAnswered: (s) => mentions(s, "panel", "wiring", "rewire", "circuit", "outlet", "lighting", "fixture") },
    { field: "amperage", question: "What amperage service is currently installed, and is an upgrade needed?", reason: "Amperage determines whether the existing panel can support the added load.", importance: "Recommended", isAnswered: (s) => /\d+\s*amp/i.test(s) },
    { field: "circuit count", question: "How many circuits are involved in this scope?", reason: "Circuit count is the base unit for wiring and breaker material quantities.", importance: "Optional", isAnswered: (s) => /\d+\s*circuit/i.test(s) },
    { field: "permit/inspection", question: "Will this work require a permit and inspection?", reason: "Most electrical work beyond fixture swaps requires a permit and inspection.", importance: "Recommended", isAnswered: (s) => mentions(s, "permit", "inspection") },
  ],
  "HVAC": [
    { field: "system type", question: "What system type should the proposal assume — furnace, heat pump, mini split, or central air?", reason: "System type determines equipment cost and installation method.", importance: "Critical", isAnswered: (s) => mentions(s, "furnace", "heat pump", "mini split", "split system", "air conditioner", "ac unit", "boiler") },
    { field: "tonnage/capacity", question: "What tonnage or BTU capacity is needed for the space?", reason: "Capacity must be sized to the square footage and climate zone.", importance: "Recommended", isAnswered: (s) => /\d+\s*ton/i.test(s) || /\d+\s*btu/i.test(s) },
    { field: "ductwork scope", question: "Is new or modified ductwork included in this scope?", reason: "Ductwork changes significantly affect labor and material beyond the equipment itself.", importance: "Recommended", isAnswered: (s) => mentions(s, "duct", "ductwork") },
    { field: "permit", question: "Will this HVAC work require a permit?", reason: "Most HVAC equipment replacement requires a mechanical permit.", importance: "Optional", isAnswered: (s) => mentions(s, "permit") },
  ],
  "Plumbing": [
    { field: "scope type", question: "What plumbing work is needed — fixture replacement, repipe, water heater, or drain/sewer work?", reason: "Scope type determines whether walls need to be opened and whether a permit is required.", importance: "Critical", isAnswered: (s) => mentions(s, "water heater", "repipe", "fixture", "drain", "supply line", "sewer") },
    { field: "fixture count", question: "How many fixtures are involved in this scope?", reason: "Fixture count is the base unit for supply and drain material quantities.", importance: "Recommended", isAnswered: (s) => /\d+\s*(fixture|toilet|sink)/i.test(s) },
    { field: "pipe material", question: "What pipe material should the proposal assume — PEX, copper, or PVC?", reason: "Pipe material affects cost and compatibility with existing plumbing.", importance: "Optional", isAnswered: (s) => mentions(s, "pex", "copper", "cpvc", "pvc") },
    { field: "permit", question: "Will this plumbing work require a permit?", reason: "Repipe and drain/sewer work typically require a permit and inspection.", importance: "Optional", isAnswered: (s) => mentions(s, "permit") },
  ],
  "Siding": [
    { field: "material", question: "What siding material should the proposal assume — vinyl, Hardie, wood, or metal?", reason: "Material choice drives fastener, house-wrap, and trim requirements.", importance: "Critical", isAnswered: (s) => mentions(s, "vinyl siding", "hardie", "lp smartside", "fiber cement", "wood siding", "metal siding") },
    { field: "square footage", question: "What is the approximate square footage of the siding area?", reason: "Square footage is the base unit for panel and house-wrap quantities.", importance: "Recommended", isAnswered: hasDimensionPair },
    { field: "existing siding removal", question: "Is the existing siding being removed and disposed of first?", reason: "Tear-off scope affects labor and disposal cost not covered by overlay pricing.", importance: "Recommended", isAnswered: (s) => mentions(s, "remove", "tear off", "strip") },
    { field: "trim scope", question: "Should soffit, fascia, and trim work be included in the scope?", reason: "Trim work is commonly bundled with siding but priced as a separate line.", importance: "Optional", isAnswered: (s) => mentions(s, "soffit", "fascia", "trim") },
  ],
  "Windows": [
    { field: "unit count", question: "How many windows are being replaced?", reason: "Unit count is the base unit for material and installation labor.", importance: "Critical", isAnswered: (s) => hasUnitCount(s, "windows?") },
    { field: "replacement type", question: "Is this a full-frame replacement, insert, or retrofit?", reason: "Replacement type affects labor, trim work, and whether siding is disturbed.", importance: "Recommended", isAnswered: (s) => mentions(s, "full frame", "full-frame", "insert", "retrofit", "new construction") },
    { field: "material", question: "What window material should the proposal assume — vinyl, wood, or fiberglass?", reason: "Material affects unit cost and energy performance.", importance: "Optional", isAnswered: (s) => mentions(s, "vinyl", "wood window", "fiberglass", "aluminum window") },
    { field: "sourcing", question: "Will the window units be owner-supplied or contractor-supplied?", reason: "Sourcing responsibility affects lead time and proposal exclusions.", importance: "Optional", isAnswered: (s) => mentions(s, "owner supplied", "owner-supplied", "contractor supplied") },
  ],
  "Doors": [
    { field: "unit count", question: "How many doors are being replaced?", reason: "Unit count is the base unit for material and installation labor.", importance: "Critical", isAnswered: (s) => hasUnitCount(s, "doors?") },
    { field: "door type", question: "What type of door is this — entry, interior, sliding, or French?", reason: "Door type determines hardware, framing, and weatherproofing requirements.", importance: "Recommended", isAnswered: (s) => mentions(s, "entry door", "interior door", "sliding door", "french door", "garage door") },
    { field: "material", question: "What door material should the proposal assume — steel, fiberglass, or wood?", reason: "Material affects unit cost and durability expectations.", importance: "Optional", isAnswered: (s) => mentions(s, "steel", "fiberglass", "wood door") },
    { field: "hardware", question: "Should new hardware (locksets, hinges) be included in the scope?", reason: "Hardware is commonly a separate line item from the door slab and frame.", importance: "Optional", isAnswered: (s) => mentions(s, "hardware", "lockset", "hinge") },
  ],
  "Garage": [
    { field: "dimensions", question: "What are the overall garage dimensions?", reason: "Dimensions drive slab size, framing quantity, and roofing area.", importance: "Critical", isAnswered: hasDimensionPair },
    { field: "attached or detached", question: "Will the garage be attached or detached from the home?", reason: "Attached garages require a structural tie-in and shared roofline; detached garages need their own foundation and utilities plan.", importance: "Critical", isAnswered: (s) => mentions(s, "attached", "detached") },
    { field: "door count", question: "How many garage bays or overhead doors are needed?", reason: "Bay count drives door, opener, and header framing quantities.", importance: "Recommended", isAnswered: (s) => hasUnitCount(s, "(car|bay|door)") },
    { field: "foundation type", question: "What foundation type should the proposal assume — slab, crawl space, or frost footings?", reason: "Foundation type affects excavation scope and cost.", importance: "Optional", isAnswered: (s) => mentions(s, "slab", "foundation", "footing") },
    { field: "permit", question: "Is a permit required for this garage construction?", reason: "New garage construction almost always requires a building permit.", importance: "Recommended", isAnswered: (s) => mentions(s, "permit") },
  ],
  "Pole Barn": [
    { field: "dimensions", question: "What are the overall pole barn dimensions?", reason: "Dimensions drive post count, truss spans, and roofing/siding area.", importance: "Critical", isAnswered: hasDimensionPair },
    { field: "intended use", question: "What is the intended use of the pole barn — storage, shop, or livestock?", reason: "Intended use affects insulation, electrical, and door requirements.", importance: "Recommended", isAnswered: (s) => mentions(s, "storage", "workshop", "livestock", "hobby shop", "equipment shed", "for hay", "man cave") },
    { field: "foundation type", question: "Should the proposal assume a concrete floor, gravel base, or dirt floor?", reason: "Floor type is a major cost driver that varies widely by intended use.", importance: "Optional", isAnswered: (s) => mentions(s, "concrete floor", "gravel", "dirt floor", "slab") },
    { field: "utilities", question: "Should electrical or plumbing utilities be included in the scope?", reason: "Utility rough-in is commonly excluded from base pole barn pricing.", importance: "Optional", isAnswered: (s) => mentions(s, "electrical", "plumbing", "power", "water") },
    { field: "permit", question: "Is a permit required for this pole barn construction?", reason: "Accessory structure permits vary by size and jurisdiction.", importance: "Recommended", isAnswered: (s) => mentions(s, "permit") },
  ],
  "Addition": [
    { field: "square footage", question: "What is the approximate square footage of the addition?", reason: "Square footage is the primary driver of foundation, framing, and roofing scope.", importance: "Critical", isAnswered: hasDimensionPair },
    { field: "use of space", question: "What will the new space be used for — bedroom, bathroom, office, or living area?", reason: "Intended use determines whether plumbing or additional electrical circuits are needed.", importance: "Recommended", isAnswered: (s) => mentions(s, "bedroom", "bathroom", "office", "family room", "in-law suite", "living area") },
    { field: "structural tie-in", question: "How will the addition tie into the existing roofline and structure?", reason: "Tie-in method affects framing complexity and waterproofing detail.", importance: "Recommended", isAnswered: (s) => mentions(s, "tie-in", "tie in", "roofline", "load bearing", "load-bearing") },
    { field: "foundation type", question: "What foundation type should the proposal assume — slab, crawl space, or basement?", reason: "Foundation type must match the existing home's foundation for a proper tie-in.", importance: "Optional", isAnswered: (s) => mentions(s, "slab", "crawl space", "basement") },
    { field: "permit/engineering", question: "Has an architect or engineer been engaged for this addition?", reason: "Additions typically require stamped drawings and a full building permit.", importance: "Recommended", isAnswered: (s) => mentions(s, "permit", "engineer", "architect") },
  ],
  "Demolition": [
    { field: "structures/materials", question: "What specific structures or materials are being removed?", reason: "The specific structure being demolished determines equipment, labor, and disposal method.", importance: "Critical", isAnswered: (s) => mentions(s, "house", "garage", "shed", "deck", "interior", "wall", "structure", "building") },
    { field: "haul-off scope", question: "Is debris haul-off and disposal included in the scope?", reason: "Haul-off scope determines dumpster count and disposal fees.", importance: "Recommended", isAnswered: (s) => mentions(s, "haul", "debris", "dispose") },
    { field: "hazardous materials", question: "Are there hazardous materials such as asbestos or lead paint that may require abatement?", reason: "Hazardous materials require licensed abatement before demolition can proceed.", importance: "Recommended", isAnswered: (s) => mentions(s, "asbestos", "lead paint", "hazmat") },
    { field: "post-demo grading", question: "Will the site need grading or prep after demo for the next trade?", reason: "Post-demo site condition affects whether grading is needed before follow-on work.", importance: "Optional", isAnswered: (s) => mentions(s, "grade", "grading", "prep") },
  ],
};

const UNRECOGNIZED_TRADE_FIELD: FieldCheck = {
  field: "project type",
  question: "What type of project is this (e.g. deck, roofing, remodel, fence)?",
  reason: "The scope did not contain enough information to determine a trade, which is required before any other question can be scoped.",
  importance: "Critical",
  isAnswered: () => false,
};

function resolveFields(trade: Trade | null): FieldCheck[] {
  return trade ? TRADE_FIELDS[trade] : [UNRECOGNIZED_TRADE_FIELD];
}

export function getMissingInformation(scope: string, trade: Trade | null): MissingInformationItem[] {
  const normalized = scope.toLowerCase();
  return resolveFields(trade)
    .filter((check) => !check.isAnswered(normalized))
    .map(({ field, reason, importance }) => ({ field, reason, importance }));
}

export function getFollowUpQuestions(scope: string, trade: Trade | null): string[] {
  const normalized = scope.toLowerCase();
  return resolveFields(trade)
    .filter((check) => !check.isAnswered(normalized))
    .map((check) => check.question);
}
