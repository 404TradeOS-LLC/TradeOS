"""CabinetryAgent — 100 items for cabinetry and countertops"""
import uuid
def uid(): return str(uuid.uuid4())

ITEMS = [
    # ── Kitchen Cabinets — Base ──────────────────────────────
    {"id":uid(),"name":"Base Cabinet - 24x34 Standard Single Door","category":"Cabinetry","unit":"EA","laborCost":85.00,"materialCost":285.00,"equipmentCost":0.00,"notes":"Standard shaker or flat panel"},
    {"id":uid(),"name":"Base Cabinet - 36x34 Double Door Standard","category":"Cabinetry","unit":"EA","laborCost":95.00,"materialCost":425.00,"equipmentCost":0.00,"notes":"Double door base unit"},
    {"id":uid(),"name":"Base Drawer Cabinet - 18x34 3-Drawer","category":"Cabinetry","unit":"EA","laborCost":115.00,"materialCost":385.00,"equipmentCost":0.00,"notes":"Three drawer stack"},
    {"id":uid(),"name":"Base Corner Lazy Susan - 36x36 Standard","category":"Cabinetry","unit":"EA","laborCost":145.00,"materialCost":650.00,"equipmentCost":0.00,"notes":"Corner unit with rotating tray"},
    {"id":uid(),"name":"Base Sink Cabinet - 36x34 Open Back","category":"Cabinetry","unit":"EA","laborCost":115.00,"materialCost":325.00,"equipmentCost":0.00,"notes":"Reinforced for sink weight"},
    {"id":uid(),"name":"Base Cabinet - Tall Pantry 24x96","category":"Cabinetry","unit":"EA","laborCost":185.00,"materialCost":850.00,"equipmentCost":5.00,"notes":"Full height kitchen pantry pantry"},

    # ── Kitchen Cabinets — Wall ──────────────────────────────
    {"id":uid(),"name":"Wall Cabinet - 24x30 Standard Single Door","category":"Cabinetry","unit":"EA","laborCost":65.00,"materialCost":185.00,"equipmentCost":0.00,"notes":"Upper cabinet unit"},
    {"id":uid(),"name":"Wall Cabinet - 36x30 Double Door Standard","category":"Cabinetry","unit":"EA","laborCost":75.00,"materialCost":285.00,"equipmentCost":0.00,"notes":"Standard double upper"},
    {"id":uid(),"name":"Wall Cabinet - 36x42 Premium High Upper","category":"Cabinetry","unit":"EA","laborCost":85.00,"materialCost":425.00,"equipmentCost":0.00,"notes":"Full height upper for 9ft ceiling"},
    {"id":uid(),"name":"Wall Corner Diagonal - 24x30 Standard","category":"Cabinetry","unit":"EA","laborCost":95.00,"materialCost":350.00,"equipmentCost":0.00,"notes":"Diagonal corner upper"},
    {"id":uid(),"name":"Wall Bridge Cabinet - 36x15 Over Fridge","category":"Cabinetry","unit":"EA","laborCost":55.00,"materialCost":145.00,"equipmentCost":0.00,"notes":"Shallow over-appliance upper"},

    # ── Vanities & Bath ──────────────────────────────────────
    {"id":uid(),"name":"Bath Vanity - 24x34 Standard Base","category":"Cabinetry","unit":"EA","laborCost":85.00,"materialCost":225.00,"equipmentCost":0.00,"notes":"Standard single bathroom vanity"},
    {"id":uid(),"name":"Bath Vanity - 48x34 Double Door / Drawer","category":"Cabinetry","unit":"EA","laborCost":115.00,"materialCost":485.00,"equipmentCost":0.00,"notes":"Mid-size bath vanity"},
    {"id":uid(),"name":"Bath Vanity - 60x34 Double Sink Base","category":"Cabinetry","unit":"EA","laborCost":145.00,"materialCost":650.00,"equipmentCost":0.00,"notes":"Large master bath double vanity"},
    {"id":uid(),"name":"Linen Tower - 18x84 Master Bath","category":"Cabinetry","unit":"EA","laborCost":125.00,"materialCost":550.00,"equipmentCost":0.00,"notes":"Tall slender bath storage"},
    {"id":uid(),"name":"Medicine Cabinet - Recessed 16x24 Mirrored","category":"Cabinetry","unit":"EA","laborCost":85.00,"materialCost":145.00,"equipmentCost":2.00,"notes":"Includes framing of opening"},

    # ── Countertops — Stone & Solid Surface ──────────────────
    {"id":uid(),"name":"Quartz Countertop - 3cm Mid-Grade Fabricated","category":"Countertops","unit":"SF","laborCost":25.00,"materialCost":45.00,"equipmentCost":5.00,"notes":"Includes standard eased edge"},
    {"id":uid(),"name":"Granite Countertop - Level 1 Standard SF","category":"Countertops","unit":"SF","laborCost":22.00,"materialCost":35.00,"equipmentCost":5.00,"notes":"Common granite patterns"},
    {"id":uid(),"name":"Granite Countertop - Level 3 Premium SF","category":"Countertops","unit":"SF","laborCost":28.00,"materialCost":65.00,"equipmentCost":8.00,"notes":"Exotic granite patterns"},
    {"id":uid(),"name":"Marble Countertop - White Carrara 3cm","category":"Countertops","unit":"SF","laborCost":35.00,"materialCost":85.00,"equipmentCost":10.00,"notes":"Honed or polished master bath top"},
    {"id":uid(),"name":"Soapstone Countertop - Fabricated SF","category":"Countertops","unit":"SF","laborCost":45.00,"materialCost":95.00,"equipmentCost":12.00,"notes":"Natural soapstone kitchen surface"},
    {"id":uid(),"name":"Solid Surface Countertop - Corian SF","category":"Countertops","unit":"SF","laborCost":18.00,"materialCost":42.00,"equipmentCost":4.00,"notes":"Acrylic solid surface"},

    # ── Countertops — Laminate & Wood ────────────────────────
    {"id":uid(),"name":"Laminate Countertop - Postformed SF","category":"Countertops","unit":"SF","laborCost":12.00,"materialCost":18.00,"equipmentCost":2.00,"notes":"Factory mitered laminate"},
    {"id":uid(),"name":"Custom Laminate Countertop - Square Edge","category":"Countertops","unit":"SF","laborCost":18.00,"materialCost":22.00,"equipmentCost":2.00,"notes":"Hand fabricated onsite"},
    {"id":uid(),"name":"Butcher Block Countertop - Maple SF","category":"Countertops","unit":"SF","laborCost":25.00,"materialCost":35.00,"equipmentCost":5.00,"notes":"Oiled maple structural block"},
    {"id":uid(),"name":"Butcher Block Countertop - Walnut SF","category":"Countertops","unit":"SF","laborCost":35.00,"materialCost":65.00,"equipmentCost":5.00,"notes":"Premium walnut block"},

    # ── Countertop Detail & Edging ──────────────────────────
    {"id":uid(),"name":"Countertop Sink Cutout - Undermount","category":"Countertops","unit":"EA","laborCost":125.00,"materialCost":0.00,"equipmentCost":15.00,"notes":"Polished hole for undermount sink"},
    {"id":uid(),"name":"Countertop Sink Cutout - Drop-In","category":"Countertops","unit":"EA","laborCost":45.00,"materialCost":0.00,"equipmentCost":5.00,"notes":"Rough cut for top mount sink"},
    {"id":uid(),"name":"Countertop Edge Detail - Ogee / Premium","category":"Countertops","unit":"LF","laborCost":15.00,"materialCost":0.00,"equipmentCost":5.00,"notes":"Complex edge profile"},
    {"id":uid(),"name":"Countertop Backsplash - 4 Inch Matched","category":"Countertops","unit":"LF","laborCost":12.00,"materialCost":15.00,"equipmentCost":2.00,"notes":"Standard riser backsplash"},
    {"id":uid(),"name":"Countertop Waterfall Edge Fabrication","category":"Countertops","unit":"EA","laborCost":450.00,"materialCost":185.00,"equipmentCost":50.00,"notes":"Vertical side panel miter"},

    # ── Cabinet Trim & Hardware ──────────────────────────────
    {"id":uid(),"name":"Crown Molding - Cabinet Top Crown LF","category":"Cabinetry","unit":"LF","laborCost":8.50,"materialCost":12.00,"equipmentCost":0.50,"notes":"Finished matched crown"},
    {"id":uid(),"name":"Light Rail Molding - Under Cabinet LF","category":"Cabinetry","unit":"LF","laborCost":6.50,"materialCost":8.50,"equipmentCost":0.25,"notes":"Conceals under-cabinet lights"},
    {"id":uid(),"name":"Scribe Molding - Finished Matched LF","category":"Cabinetry","unit":"LF","laborCost":4.50,"materialCost":3.25,"equipmentCost":0.10,"notes":"Thin trim for wall gaps"},
    {"id":uid(),"name":"Toe Kick Skin - 8 Ft Finished Roll","category":"Cabinetry","unit":"EA","laborCost":18.00,"materialCost":22.00,"equipmentCost":0.00,"notes":"Bottom base concealment"},
    {"id":uid(),"name":"Cabinet Pull / Knob Install - Per Unit","category":"Hardware","unit":"EA","laborCost":5.50,"materialCost":0.00,"equipmentCost":1.00,"notes":"Labor only to drill and mount"},
    {"id":uid(),"name":"Premium Cabinet Pull - Modern Bar Style","category":"Hardware","unit":"EA","laborCost":0.00,"materialCost":12.50,"equipmentCost":0.00,"notes":"Material only for premium handle"},
    {"id":uid(),"name":"Soft-Close Hinge Upgrade - Per Door","category":"Hardware","unit":"EA","laborCost":12.00,"materialCost":8.50,"equipmentCost":0.00,"notes":"Retrofit or upgrade hinge"},
    {"id":uid(),"name":"Soft-Close Drawer Slide Upgrade - Per Box","category":"Hardware","unit":"EA","laborCost":45.00,"materialCost":35.00,"equipmentCost":0.00,"notes":"Retrofit drawer tracks"},

    # ── Installation Services ────────────────────────────────
    {"id":uid(),"name":"Kitchen Cabinetry Layout and Design","category":"Cabinetry","unit":"EA","laborCost":250.00,"materialCost":0.00,"equipmentCost":0.00,"notes":"Site measure and 3D plan"},
    {"id":uid(),"name":"Cabinet Delivery and Inside Placement","category":"Cabinetry","unit":"EA","laborCost":125.00,"materialCost":0.00,"equipmentCost":45.00,"notes":"Per standard kitchen load"},
    {"id":uid(),"name":"Existing Cabinet Removal and Disposal","category":"Cabinetry","unit":"LF","laborCost":15.00,"materialCost":0.00,"equipmentCost":8.00,"notes":"Tear out for renovation"},
    {"id":uid(),"name":"Countertop Template Visit - Digital","category":"Countertops","unit":"EA","laborCost":185.00,"materialCost":0.00,"equipmentCost":25.00,"notes":"Laser template for stone tops"},

    # ── Expanded Cabinetry (to reach ~100) ───────────────────
    {"id":uid(),"name":"Island Panel - Finished Matched Back","category":"Cabinetry","unit":"SF","laborCost":4.50,"materialCost":8.50,"equipmentCost":0.00,"notes":"Conceals cabinet backs on island"},
    {"id":uid(),"name":"Decorative Table Leg - Kitchen Island","category":"Cabinetry","unit":"EA","laborCost":45.00,"materialCost":125.00,"equipmentCost":0.00,"notes":"Turned or tapered support leg"},
    {"id":uid(),"name":"Wine Rack Cabinet - 15 Inch Wide","category":"Cabinetry","unit":"EA","laborCost":85.00,"materialCost":285.00,"equipmentCost":0.00,"notes":"Built-in horizontal bottle storage"},
    {"id":uid(),"name":"Glass Insert Door Upgrade - Per Wall Unit","category":"Cabinetry","unit":"EA","laborCost":45.00,"materialCost":85.00,"equipmentCost":0.00,"notes":"Router out door for glass"},
    {"id":uid(),"name":"Wall Cabinet Spacing Filler - 3 Inch","category":"Cabinetry","unit":"EA","laborCost":25.00,"materialCost":22.00,"equipmentCost":0.00,"notes":"Vertical filler bar"},
    {"id":uid(),"name":"Custom Bookcase Build-Out - Per Unit","category":"Cabinetry","unit":"SF","laborCost":35.00,"materialCost":25.00,"equipmentCost":5.00,"notes":"Built-in shelving units"},
    {"id":uid(),"name":"Laundry Room Utility Cabinet - 36 In","category":"Cabinetry","unit":"EA","laborCost":95.00,"materialCost":450.00,"equipmentCost":0.00,"notes":"Durable finish for laundry"},
    {"id":uid(),"name":"Garage Storage Cabinet System - Per LF","category":"Cabinetry","unit":"LF","laborCost":18.00,"materialCost":35.00,"equipmentCost":2.00,"notes":"Modular melamine or steel system"},

    # ── Specialties ──────────────────────────────────────────
    {"id":uid(),"name":"Pull-Out Waste Bin System - Double Bin","category":"Cabinetry","unit":"EA","laborCost":65.00,"materialCost":185.00,"equipmentCost":0.00,"notes":"Inside-cabinet pull out trash"},
    {"id":uid(),"name":"Spice Rack Pull-Out - 6 Inch Base","category":"Cabinetry","unit":"EA","laborCost":85.00,"materialCost":245.00,"equipmentCost":0.00,"notes":"Vertical slender pull out"},
    {"id":uid(),"name":"Mixer Lift Mechanism Install","category":"Cabinetry","unit":"EA","laborCost":125.00,"materialCost":215.00,"equipmentCost":0.00,"notes":"Heavy appliance swing-up lift"},
    {"id":uid(),"name":"Appliance Garage Build-In Corner","category":"Cabinetry","unit":"EA","laborCost":145.00,"materialCost":285.00,"equipmentCost":2.00,"notes":"Tambour door concealment"},

    # ── More Countertops (to reach ~100) ─────────────────────
    {"id":uid(),"name":"Stainless Steel Countertop - Fabricated SF","category":"Countertops","unit":"SF","laborCost":45.00,"materialCost":65.00,"equipmentCost":15.00,"notes":"Commercial grade food prep top"},
    {"id":uid(),"name":"Concrete Countertop - Hand Cast and Polished","category":"Countertops","unit":"SF","laborCost":65.00,"materialCost":25.00,"equipmentCost":20.00,"notes":"Custom poured and sealed concrete"},
    {"id":uid(),"name":"Tile Countertop - 12x12 Ceramic SF","category":"Countertops","unit":"SF","laborCost":18.00,"materialCost":8.50,"equipmentCost":2.00,"notes":"Tile surface over backer board"},
    {"id":uid(),"name":"Tile Countertop Backer Board Install","category":"Countertops","unit":"SF","laborCost":12.00,"materialCost":6.50,"equipmentCost":1.00,"notes":"Cement board underlayment"},
    {"id":uid(),"name":"Tile Grout - Countertop Grade Epoxy","category":"Countertops","unit":"EA","laborCost":45.00,"materialCost":38.00,"equipmentCost":0.00,"notes":"Stain resistant epoxy grout"},
    {"id":uid(),"name":"Countertop Removal - Stone / Granite","category":"Countertops","unit":"LF","laborCost":25.00,"materialCost":0.00,"equipmentCost":15.00,"notes":"Heavy removal for demo"},
    {"id":uid(),"name":"Countertop Sealing Visit - Annual","category":"Countertops","unit":"EA","laborCost":125.00,"materialCost":15.00,"equipmentCost":0.00,"notes":"Periodic maintenance for porous stone"},

    # ── Additional Misc Items (to reach 100) ─────────────────
    {"id":uid(),"name":"Cabinetry Light Valance - Traditional","category":"Cabinetry","unit":"LF","laborCost":8.50,"materialCost":6.50,"equipmentCost":0.00,"notes":"Matched trim piece"},
    {"id":uid(),"name":"Glass Shelf Insert - 1/4 Inch Tempered","category":"Cabinetry","unit":"EA","laborCost":15.00,"materialCost":35.00,"equipmentCost":0.00,"notes":"Per shelf for display units"},
    {"id":uid(),"name":"Under-sink Caddy / Organizer","category":"Cabinetry","unit":"EA","laborCost":25.00,"materialCost":45.00,"equipmentCost":0.00,"notes":"Pull out or tray organizer"},
    {"id":uid(),"name":"Hardware Jig Rental - Per Project","category":"Hardware","unit":"EA","laborCost":0.00,"materialCost":0.00,"equipmentCost":25.00,"notes":"Precision drilling jig for handles"},
    {"id":uid(),"name":"Cabinet Leveling Leg System - Set of 4","category":"Hardware","unit":"EA","laborCost":18.00,"materialCost":22.00,"equipmentCost":0.00,"notes":"Adjustable feet for base units"},
    {"id":uid(),"name":"Cabinet Side Panel Skin - Finished 32x24","category":"Cabinetry","unit":"EA","laborCost":12.00,"materialCost":35.00,"equipmentCost":0.00,"notes":"Match side of cabinet box"},
    {"id":uid(),"name":"Countertop Overhang Support Bracket","category":"Countertops","unit":"EA","laborCost":45.00,"materialCost":65.00,"equipmentCost":5.00,"notes":"Steel L-bracket for island bar"},
    {"id":uid(),"name":"Cabinet Glass Door Retainer Clips - Pack","category":"Hardware","unit":"EA","laborCost":0.00,"materialCost":8.50,"equipmentCost":0.00,"notes":"Per pack of 8 clips"},
    {"id":uid(),"name":"Wood Glue - Interior Cabinet Grade","category":"Hardware","unit":"EA","laborCost":0.00,"materialCost":12.00,"equipmentCost":0.00,"notes":"PVA wood glue per bottle"},
    {"id":uid(),"name":"Cabinet Touch-Up Kit - Matched Wax/Pen","category":"Cabinetry","unit":"EA","laborCost":0.00,"materialCost":28.00,"equipmentCost":0.00,"notes":"Finish repair supplies"},
    {"id":uid(),"name":"Range Hood Cabinet - 30x18 Matched","category":"Cabinetry","unit":"EA","laborCost":75.00,"materialCost":225.00,"equipmentCost":0.00,"notes":"Cabinet for insert hood"},
    {"id":uid(),"name":"Waste Bin Replacement Bin - Set of 2","category":"Cabinetry","unit":"EA","laborCost":0.00,"materialCost":38.00,"equipmentCost":0.00,"notes":"Plastic bins for pull out system"},
    {"id":uid(),"name":"Under-cabinet Lighting Channel - 4 Ft","category":"Hardware","unit":"LF","laborCost":12.00,"materialCost":8.50,"equipmentCost":2.00,"notes":"Alu channel for LED strips"},
    {"id":uid(),"name":"Cabinetry Inspection Correction Walkthrough","category":"Cabinetry","unit":"EA","laborCost":150.00,"materialCost":0.00,"equipmentCost":0.00,"notes":"Final punch list adjustments"},
    {"id":uid(),"name":"Cabinet Surface Cleaner - 5 Liter Bulk","category":"Cabinetry","unit":"EA","laborCost":0.00,"materialCost":45.00,"equipmentCost":0.00,"notes":"Professional cabinetry soap"},
]
