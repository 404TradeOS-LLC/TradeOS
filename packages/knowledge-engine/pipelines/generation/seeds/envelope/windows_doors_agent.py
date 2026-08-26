"""WindowsDoorsAgent — 100 items for windows, doors, and hardware"""
import uuid
def uid(): return str(uuid.uuid4())

ITEMS = [
    # ── Windows — Vinyl ──────────────────────────────────────
    {"id":uid(),"name":"Vinyl Single Hung Window - 3x5 Standard","category":"Windows","unit":"EA","laborCost":125.00,"materialCost":285.00,"equipmentCost":0.00,"notes":"Standard grade vinyl window"},
    {"id":uid(),"name":"Vinyl Double Hung Window - 3x5 Premium","category":"Windows","unit":"EA","laborCost":145.00,"materialCost":425.00,"equipmentCost":0.00,"notes":"Premium vinyl with low-e glass"},
    {"id":uid(),"name":"Vinyl Slider Window - 4x4 Standard","category":"Windows","unit":"EA","laborCost":135.00,"materialCost":315.00,"equipmentCost":0.00,"notes":"Horizontal sliding window"},
    {"id":uid(),"name":"Vinyl Casement Window - 2x4 Hand Crank","category":"Windows","unit":"EA","laborCost":165.00,"materialCost":485.00,"equipmentCost":0.00,"notes":"Outswing casement window"},
    {"id":uid(),"name":"Vinyl Awning Window - 2x2 Accent","category":"Windows","unit":"EA","laborCost":115.00,"materialCost":245.00,"equipmentCost":0.00,"notes":"Top hinged awning window"},
    {"id":uid(),"name":"Vinyl Picture Window - 5x5 Large Fixed","category":"Windows","unit":"EA","laborCost":185.00,"materialCost":550.00,"equipmentCost":15.00,"notes":"Fixed non-operable large window"},
    {"id":uid(),"name":"Vinyl Bay Window System - 3 Lite Standard","category":"Windows","unit":"EA","laborCost":450.00,"materialCost":1250.00,"equipmentCost":25.00,"notes":"Complete bay window unit"},
    {"id":uid(),"name":"Vinyl Bow Window System - 4 Lite Premium","category":"Windows","unit":"EA","laborCost":550.00,"materialCost":1850.00,"equipmentCost":35.00,"notes":"Curved bow window unit"},

    # ── Windows — Wood / Clad ────────────────────────────────
    {"id":uid(),"name":"Wood Double Hung Window - Standard Pine","category":"Windows","unit":"EA","laborCost":185.00,"materialCost":650.00,"equipmentCost":0.00,"notes":"Unfinished wood interior"},
    {"id":uid(),"name":"Aluminum Clad Wood Window - Double Hung","category":"Windows","unit":"EA","laborCost":195.00,"materialCost":850.00,"equipmentCost":0.00,"notes":"Maintenance free exterior clad"},
    {"id":uid(),"name":"Aluminum Clad Wood Window - Casement","category":"Windows","unit":"EA","laborCost":215.00,"materialCost":950.00,"equipmentCost":0.00,"notes":"Premium clad wood casement"},
    {"id":uid(),"name":"Custom Wood Arch Top Window","category":"Windows","unit":"EA","laborCost":350.00,"materialCost":1450.00,"equipmentCost":0.00,"notes":"Radius top custom wood window"},

    # ── Windows — Performance & Specialty ────────────────────
    {"id":uid(),"name":"Impact Resistant Window - Vinyl Single Hung","category":"Windows","unit":"EA","laborCost":175.00,"materialCost":685.00,"equipmentCost":0.00,"notes":"Hurricane rated glass"},
    {"id":uid(),"name":"Sound Control Window - STC 40 Rated","category":"Windows","unit":"EA","laborCost":225.00,"materialCost":1150.00,"equipmentCost":0.00,"notes":"Acoustic glass for noise reduction"},
    {"id":uid(),"name":"Tempered Glass Upgrade - Per Window","category":"Windows","unit":"EA","laborCost":0.00,"materialCost":85.00,"equipmentCost":0.00,"notes":"Safety glass for hazardous areas"},
    {"id":uid(),"name":"Obscure / Frosted Glass Upgrade","category":"Windows","unit":"EA","laborCost":0.00,"materialCost":65.00,"equipmentCost":0.00,"notes":"Privacy glass for bathrooms"},

    # ── Exterior Doors ───────────────────────────────────────
    {"id":uid(),"name":"Fiberglass Entry Door - 3-0 Standard Pre-Hung","category":"Doors","unit":"EA","laborCost":225.00,"materialCost":450.00,"equipmentCost":0.00,"notes":"Single entry fiberglass door"},
    {"id":uid(),"name":"Steel Fire Door - 3-0 90 Minute Rated","category":"Doors","unit":"EA","laborCost":250.00,"materialCost":550.00,"equipmentCost":0.00,"notes":"Rated door for garage-house entry"},
    {"id":uid(),"name":"Solid Wood Mahogany Entry - 3-6 Oversize","category":"Doors","unit":"EA","laborCost":450.00,"materialCost":2850.00,"equipmentCost":0.00,"notes":"Premium wood entry door"},
    {"id":uid(),"name":"Side-Lite System - Fixed Fiberglass","category":"Doors","unit":"EA","laborCost":185.00,"materialCost":350.00,"equipmentCost":0.00,"notes":"Matched side-lite for entry"},
    {"id":uid(),"name":"Transom Window Frame - Rectangular","category":"Doors","unit":"EA","laborCost":125.00,"materialCost":225.00,"equipmentCost":0.00,"notes":"Over-door transom window"},

    # ── Sliding & Patio Doors ────────────────────────────────
    {"id":uid(),"name":"Vinyl Sliding Patio Door - 6-0 Standard","category":"Doors","unit":"EA","laborCost":350.00,"materialCost":850.00,"equipmentCost":0.00,"notes":"Includes screen and hardware"},
    {"id":uid(),"name":"Aluminum Clad Sliding Door - 8-0 Premium","category":"Doors","unit":"EA","laborCost":450.00,"materialCost":2450.00,"equipmentCost":15.00,"notes":"Multi-slide premium door"},
    {"id":uid(),"name":"French Door System - 6-0 Inswing Clad Wood","category":"Doors","unit":"EA","laborCost":450.00,"materialCost":3250.00,"equipmentCost":0.00,"notes":"Double door inswing system"},
    {"id":uid(),"name":"Folding / Bifold Patio Door System - 12-0","category":"Doors","unit":"EA","laborCost":1250.00,"materialCost":8500.00,"equipmentCost":45.00,"notes":"Folding glass wall system"},

    # ── Interior Doors ───────────────────────────────────────
    {"id":uid(),"name":"6-Panel Molded Interior Door - 2-8 Pre-Hung","category":"Doors","unit":"EA","laborCost":85.00,"materialCost":165.00,"equipmentCost":0.00,"notes":"Standard hollow core door"},
    {"id":uid(),"name":"Shaker Style 2-Panel Door - 2-8 Pre-Hung","category":"Doors","unit":"EA","laborCost":85.00,"materialCost":215.00,"equipmentCost":0.00,"notes":"Premium solid core interior door"},
    {"id":uid(),"name":"Solid Oak Interior Door - 3-0 Pre-Hung","category":"Doors","unit":"EA","laborCost":125.00,"materialCost":650.00,"equipmentCost":0.00,"notes":"Solid hardwood interior door"},
    {"id":uid(),"name":"Bifold Closet Door - 6-0 Double Set","category":"Doors","unit":"EA","laborCost":115.00,"materialCost":285.00,"equipmentCost":0.00,"notes":"Track and two bifold panels"},
    {"id":uid(),"name":"Pocket Door Frame and Panel Install","category":"Doors","unit":"EA","laborCost":250.00,"materialCost":350.00,"equipmentCost":0.00,"notes":"Includes frame and standard door"},
    {"id":uid(),"name":"Barn Door Kit with Track and Panel","category":"Doors","unit":"EA","laborCost":185.00,"materialCost":450.00,"equipmentCost":0.00,"notes":"Surface mount sliding door"},
    {"id":uid(),"name":"Double Interior Door - 5-0 French Style","category":"Doors","unit":"EA","laborCost":175.00,"materialCost":650.00,"equipmentCost":0.00,"notes":"Double door interior system"},

    # ── Doors — Specialty ────────────────────────────────────
    {"id":uid(),"name":"Garage Door - 9x7 Raised Panel Steel","category":"Doors","unit":"EA","laborCost":350.00,"materialCost":850.00,"equipmentCost":25.00,"notes":"Single garage door with tracks"},
    {"id":uid(),"name":"Garage Door - 16x7 Double Steel Insulated","category":"Doors","unit":"EA","laborCost":550.00,"materialCost":1650.00,"equipmentCost":35.00,"notes":"Double insulated garage door"},
    {"id":uid(),"name":"Garage Door Opener - Belt Drive Wi-Fi","category":"Doors","unit":"EA","laborCost":125.00,"materialCost":325.00,"equipmentCost":0.00,"notes":"Includes 2 remotes and sensor"},
    {"id":uid(),"name":"Storm Door - Full View Aluminum","category":"Doors","unit":"EA","laborCost":145.00,"materialCost":285.00,"equipmentCost":0.00,"notes":"Self-storing or interchangeable"},
    {"id":uid(),"name":"Pet Door Insert - Large Through Wall","category":"Doors","unit":"EA","laborCost":185.00,"materialCost":225.00,"equipmentCost":5.00,"notes":"In-wall pet door install"},

    # ── Hardware ─────────────────────────────────────────────
    {"id":uid(),"name":"Entry Lockset - Deadbolt and Knob Combi","category":"Hardware","unit":"EA","laborCost":45.00,"materialCost":85.00,"equipmentCost":0.00,"notes":"Standard security combo"},
    {"id":uid(),"name":"Interior Door Knob - Passage Standard","category":"Hardware","unit":"EA","laborCost":15.00,"materialCost":22.00,"equipmentCost":0.00,"notes":"Simple passage knob"},
    {"id":uid(),"name":"Interior Door Knob - Privacy Bath/Bed","category":"Hardware","unit":"EA","laborCost":15.00,"materialCost":28.00,"equipmentCost":0.00,"notes":"Privacy locking knob"},
    {"id":uid(),"name":"Dummy Knob - Per Set","category":"Hardware","unit":"EA","laborCost":12.00,"materialCost":15.00,"equipmentCost":0.00,"notes":"Single side non-operable"},
    {"id":uid(),"name":"Smart Deadbolt - Keyless Entry Wi-Fi","category":"Hardware","unit":"EA","laborCost":65.00,"materialCost":245.00,"equipmentCost":0.00,"notes":"Electronic keypad or app control"},
    {"id":uid(),"name":"Hinges - 3.5 Inch Round Corner - Set of 3","category":"Hardware","unit":"EA","laborCost":15.00,"materialCost":12.00,"equipmentCost":0.00,"notes":"Per door hinge set"},
    {"id":uid(),"name":"Door Closer - Commercial Grade Grade 1","category":"Hardware","unit":"EA","laborCost":85.00,"materialCost":185.00,"equipmentCost":0.00,"notes":"Hydraulic automatic closer"},
    {"id":uid(),"name":"Panic Bar / Exit Device - Standard","category":"Hardware","unit":"EA","laborCost":125.00,"materialCost":350.00,"equipmentCost":0.00,"notes":"Push bar exit hardware"},
    {"id":uid(),"name":"Door Stop - Spring Baseboard Mount","category":"Hardware","unit":"EA","laborCost":5.00,"materialCost":2.50,"equipmentCost":0.00,"notes":"Simple spring stop"},
    {"id":uid(),"name":"Door Sweep - 36 Inch Aluminum/Vinyl","category":"Hardware","unit":"EA","laborCost":18.00,"materialCost":12.00,"equipmentCost":0.00,"notes":"Bottom moisture seal"},

    # ── Installation Accessories ─────────────────────────────
    {"id":uid(),"name":"Window Flashing Tape - 4 Inch Per Roll","category":"Hardware","unit":"EA","laborCost":0.00,"materialCost":28.00,"equipmentCost":0.00,"notes":"Butyl flashing tape"},
    {"id":uid(),"name":"Extruded Aluminum Window Trim - 10 Ft","category":"Hardware","unit":"LF","laborCost":1.25,"materialCost":2.50,"equipmentCost":0.00,"notes":"Exterior trim detail"},
    {"id":uid(),"name":"Low Expansion Spray Foam - Per Can","category":"Hardware","unit":"EA","laborCost":0.00,"materialCost":14.00,"equipmentCost":0.00,"notes":"Door and window insulating foam"},
    {"id":uid(),"name":"Cedar Shim Pack - Per Bundle","category":"Hardware","unit":"EA","laborCost":0.00,"materialCost":6.50,"equipmentCost":0.00,"notes":"For leveling doors and windows"},
    {"id":uid(),"name":"Sill Pan Flash Install - Per Window","category":"Hardware","unit":"EA","laborCost":25.00,"materialCost":35.00,"equipmentCost":0.00,"notes":"Structured sill drainage pan"},

    # ── Labor Only ───────────────────────────────────────────
    {"id":uid(),"name":"Window Screen Repair - Per Unit","category":"Windows","unit":"EA","laborCost":35.00,"materialCost":0.00,"equipmentCost":0.00,"notes":"Rescreen with fiberglass mesh"},
    {"id":uid(),"name":"Door Plane and Adjust - Binding Issue","category":"Doors","unit":"EA","laborCost":75.00,"materialCost":0.00,"equipmentCost":5.00,"notes":"Correct fitment after settlement"},
    {"id":uid(),"name":"Glass Replacement - Double Pane Unit","category":"Windows","unit":"SF","laborCost":15.00,"materialCost":25.00,"equipmentCost":5.00,"notes":"Labor plus IGU glass cost"},
    {"id":uid(),"name":"Casing Trim Install - Per Opening","category":"Hardware","unit":"EA","laborCost":65.00,"materialCost":0.00,"equipmentCost":0.00,"notes":"Labor only to cut and nail trim"},

    # ── Expanded Windows (to reach ~100) ─────────────────────
    {"id":uid(),"name":"Garden Window Unit - 3x2 Kitchen Accent","category":"Windows","unit":"EA","laborCost":250.00,"materialCost":850.00,"equipmentCost":0.00,"notes":"Projecting greenhouse window"},
    {"id":uid(),"name":"Basement Egress Window Well System","category":"Windows","unit":"EA","laborCost":1250.00,"materialCost":1850.00,"equipmentCost":450.00,"notes":"Includes excavation, well, and window"},
    {"id":uid(),"name":"Skylight Install - 2x4 Fixed Curb Mount","category":"Windows","unit":"EA","laborCost":450.00,"materialCost":650.00,"equipmentCost":25.00,"notes":"Curb mount roof window"},
    {"id":uid(),"name":"Skylight Install - 2x4 Solar Powered Operable","category":"Windows","unit":"EA","laborCost":650.00,"materialCost":1650.00,"equipmentCost":25.00,"notes":"Includes remote and rain sensor"},
    {"id":uid(),"name":"Glass Block Window - Pre-Assembled 32x16","category":"Windows","unit":"EA","laborCost":125.00,"materialCost":145.00,"equipmentCost":5.00,"notes":"Basement safety window"},
    {"id":uid(),"name":"Bronze Anodized Aluminum Storefront Window","category":"Windows","unit":"SF","laborCost":18.00,"materialCost":32.00,"equipmentCost":12.00,"notes":"Commercial glazing system"},
    {"id":uid(),"name":"Steel Casement Window - Industrial Style","category":"Windows","unit":"EA","laborCost":250.00,"materialCost":1250.00,"equipmentCost":10.00,"notes":"Slim profile steel frame"},
    {"id":uid(),"name":"Round Window - 24 Inch Diameter Ocular","category":"Windows","unit":"EA","laborCost":185.00,"materialCost":450.00,"equipmentCost":0.00,"notes":"Fixed round window"},
    {"id":uid(),"name":"Transom - Fan Light Shape Wood","category":"Windows","unit":"EA","laborCost":225.00,"materialCost":650.00,"equipmentCost":0.00,"notes":"Decorative half-round transom"},

    # ── Expanded Doors (to reach ~100) ───────────────────────
    {"id":uid(),"name":"Storm Door - Security Mesh Type","category":"Doors","unit":"EA","laborCost":185.00,"materialCost":650.00,"equipmentCost":0.00,"notes":"Heavy duty steel security door"},
    {"id":uid(),"name":"French Door Inswing - Double Lite Grids","category":"Doors","unit":"EA","laborCost":350.00,"materialCost":1250.00,"equipmentCost":0.00,"notes":"Standard steel or fiberglass French door"},
    {"id":uid(),"name":"Screen Door - Simple Wood Frame","category":"Doors","unit":"EA","laborCost":65.00,"materialCost":85.00,"equipmentCost":0.00,"notes":"Old style wood screen door"},
    {"id":uid(),"name":"Accordion Folding Door - Vinyl Partition","category":"Doors","unit":"LF","laborCost":25.00,"materialCost":45.00,"equipmentCost":0.00,"notes":"Light partition wall"},
    {"id":uid(),"name":"Bulkhead Cellar Door - Steel Bilco Type","category":"Doors","unit":"EA","laborCost":450.00,"materialCost":850.00,"equipmentCost":25.00,"notes":"Sloped basement exterior door"},
    {"id":uid(),"name":"Dutch Door - Solid Core Wood","category":"Doors","unit":"EA","laborCost":350.00,"materialCost":1150.00,"equipmentCost":0.00,"notes":"Split operating half door"},
    {"id":uid(),"name":"Saloon Style Cafe Doors - Louvered","category":"Doors","unit":"EA","laborCost":125.00,"materialCost":185.00,"equipmentCost":0.00,"notes":"Swing-action half doors"},
    {"id":uid(),"name":"Louvre Bifold - Full Wood Ventilated","category":"Doors","unit":"EA","laborCost":115.00,"materialCost":245.00,"equipmentCost":0.00,"notes":"Closet bifold with venting"},
    {"id":uid(),"name":"Mirrored Bifold Door - Metal Frame","category":"Doors","unit":"EA","laborCost":145.00,"materialCost":325.00,"equipmentCost":0.00,"notes":"Full length mirror closet doors"},

    # ── Expanded Hardware (to reach ~100) ────────────────────
    {"id":uid(),"name":"Lever Handle Set - Oil Rubbed Bronze","category":"Hardware","unit":"EA","laborCost":18.00,"materialCost":42.00,"equipmentCost":0.00,"notes":"Modern lever style hardware"},
    {"id":uid(),"name":"Kick Plate - Polished Brass 36 Inch","category":"Hardware","unit":"EA","laborCost":15.00,"materialCost":35.00,"equipmentCost":0.00,"notes":"Surface protection plate"},
    {"id":uid(),"name":"Door Viewer / Peephole - 180 Degree","category":"Hardware","unit":"EA","laborCost":25.00,"materialCost":12.00,"equipmentCost":2.00,"notes":"Wide angle viewer"},
    {"id":uid(),"name":"Door Knocker - Decorative Brass","category":"Hardware","unit":"EA","laborCost":25.00,"materialCost":45.00,"equipmentCost":0.00,"notes":"Surface mount knocker"},
    {"id":uid(),"name":"Mail Slot Install - Through Door","category":"Hardware","unit":"EA","laborCost":65.00,"materialCost":55.00,"equipmentCost":5.00,"notes":"Cut and install metal mail slot"},
    {"id":uid(),"name":"Treshold - Adjustable Oak/Aluminum","category":"Hardware","unit":"EA","laborCost":45.00,"materialCost":35.00,"equipmentCost":0.00,"notes":"Replacement threshold"},
    {"id":uid(),"name":"Weatherstripping Replacement - Per Door","category":"Hardware","unit":"EA","laborCost":65.00,"materialCost":18.00,"equipmentCost":0.00,"notes":"Compression or v-strip seal"},
    {"id":uid(),"name":"Magnetic Door Catch - Cabinet Style","category":"Hardware","unit":"EA","laborCost":15.00,"materialCost":8.50,"equipmentCost":0.00,"notes":"Small closure catch"},
    {"id":uid(),"name":"Automatic Bottom Seal - Surface Mounted","category":"Hardware","unit":"EA","laborCost":45.00,"materialCost":65.00,"equipmentCost":0.00,"notes":"Drops down when door closes"},

    # ── Logistics & Services ─────────────────────────────────
    {"id":uid(),"name":"Window Delivery - Flat Rate Under 10 Units","category":"Windows","unit":"EA","laborCost":0.00,"materialCost":0.00,"equipmentCost":75.00,"notes":"Local delivery charge"},
    {"id":uid(),"name":"Large Door Delivery - Box Truck Required","category":"Doors","unit":"EA","laborCost":0.00,"materialCost":0.00,"equipmentCost":125.00,"notes":"Delivery of patio or entry systems"},
    {"id":uid(),"name":"Window Disposal - Per Sash","category":"Windows","unit":"EA","laborCost":8.50,"materialCost":0.00,"equipmentCost":12.00,"notes":"Haul away fee per sash"},
    {"id":uid(),"name":"Door Disposal - Per Panel","category":"Doors","unit":"EA","laborCost":12.00,"materialCost":0.00,"equipmentCost":18.00,"notes":"Haul away fee per door"},
    {"id":uid(),"name":"Hardware Re-Keying - Per Cylinder","category":"Hardware","unit":"EA","laborCost":25.00,"materialCost":5.00,"equipmentCost":0.00,"notes":"Reset tumblers for new key"},

    # ── Add-ons ──────────────────────────────────────────────
    {"id":uid(),"name":"Mullion Install - Window Tight Join","category":"Windows","unit":"EA","laborCost":45.00,"materialCost":25.00,"equipmentCost":0.00,"notes":"Joining two windows together"},
    {"id":uid(),"name":"Grille Upgrade - Internal Between Glass","category":"Windows","unit":"EA","laborCost":0.00,"materialCost":35.00,"equipmentCost":0.00,"notes":"Divided lite look upgrade"},
    {"id":uid(),"name":"Full Surround Trim Set - Composite","category":"Doors","unit":"EA","laborCost":125.00,"materialCost":185.00,"equipmentCost":0.00,"notes":"Exterior trim kit for door"},
    {"id":uid(),"name":"Keypad Battery Replacement - Annual","category":"Hardware","unit":"EA","laborCost":25.00,"materialCost":12.00,"equipmentCost":0.00,"notes":"Maintenance visit for smart locks"},
    {"id":uid(),"name":"Window Load Calculation - Structural Egress","category":"Windows","unit":"EA","laborCost":150.00,"materialCost":0.00,"equipmentCost":0.00,"notes":"Engineering check for header size"},
]
