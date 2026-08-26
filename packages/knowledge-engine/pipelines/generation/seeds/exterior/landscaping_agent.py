"""LandscapingAgent — 100 items for landscaping and hardscaping"""
import uuid
def uid(): return str(uuid.uuid4())

ITEMS = [
    # ── Softscaping — Ground Cover ───────────────────────────
    {"id":uid(),"name":"Kentucky Bluegrass Sod - Laid SF","category":"Landscaping","unit":"SF","laborCost":0.35,"materialCost":0.65,"equipmentCost":0.10,"notes":"Includes rolling and initial watering"},
    {"id":uid(),"name":"Lawn Seeding - Premium Mix Per 1000 SF","category":"Landscaping","unit":"EA","laborCost":85.00,"materialCost":45.00,"equipmentCost":15.00,"notes":"Broadcast seed and straw cover"},
    {"id":uid(),"name":"Hydroseeding Application - Standard SF","category":"Landscaping","unit":"SF","laborCost":0.08,"materialCost":0.12,"equipmentCost":0.05,"notes":"Slurry mix wood fiber mulch"},
    {"id":uid(),"name":"Shredded Cedar Mulch - Laid per Cubic Yard","category":"Landscaping","unit":"CY","laborCost":35.00,"materialCost":28.00,"equipmentCost":5.00,"notes":"3 inch depth coverage"},
    {"id":uid(),"name":"Hardwood Bark Mulch - Dark Brown CY","category":"Landscaping","unit":"CY","laborCost":35.00,"materialCost":24.00,"equipmentCost":5.00,"notes":"Premium dyed mulch"},
    {"id":uid(),"name":"River Rock Groundcover - 1-3 Inch CY","category":"Landscaping","unit":"CY","laborCost":45.00,"materialCost":65.00,"equipmentCost":12.00,"notes":"Decorative river stone"},
    {"id":uid(),"name":"Pea Gravel Groundcover - 3/8 Inch CY","category":"Landscaping","unit":"CY","laborCost":35.00,"materialCost":45.00,"equipmentCost":8.00,"notes":"Small smooth gravel"},

    # ── Softscaping — Trees & Shrubs ─────────────────────────
    {"id":uid(),"name":"Deciduous Tree - 2 Inch Caliper Maples","category":"Landscaping","unit":"EA","laborCost":125.00,"materialCost":285.00,"equipmentCost":35.00,"notes":"Ball and burlap install"},
    {"id":uid(),"name":"Evergreen Tree - 6-8 Ft Spruce/Pine","category":"Landscaping","unit":"EA","laborCost":150.00,"materialCost":350.00,"equipmentCost":45.00,"notes":"Standard privacy screening tree"},
    {"id":uid(),"name":"Ornamental Tree - Dogwood / Cherry EA","category":"Landscaping","unit":"EA","laborCost":85.00,"materialCost":185.00,"equipmentCost":15.00,"notes":"Flowering accent tree"},
    {"id":uid(),"name":"Small Shrub - 3 Gallon Container","category":"Landscaping","unit":"EA","laborCost":25.00,"materialCost":35.00,"equipmentCost":2.00,"notes":"Standard foundation planting"},
    {"id":uid(),"name":"Medium Shrub - 5 Gallon Container","category":"Landscaping","unit":"EA","laborCost":35.00,"materialCost":55.00,"equipmentCost":2.00,"notes":"Larger accent shrub"},
    {"id":uid(),"name":"Large Shrub - 10 Gallon Container","category":"Landscaping","unit":"EA","laborCost":55.00,"materialCost":125.00,"equipmentCost":5.00,"notes":"Specimen shrub"},
    {"id":uid(),"name":"Perennial Plant - 1 Gallon Container","category":"Landscaping","unit":"EA","laborCost":12.00,"materialCost":15.00,"equipmentCost":0.00,"notes":"Flowers and groundcover plants"},

    # ── Hardscaping — Pavers ──────────────────────────────────
    {"id":uid(),"name":"Concrete Paver Patio - Standard 3-Piece SF","category":"Hardscaping","unit":"SF","laborCost":8.50,"materialCost":4.50,"equipmentCost":2.50,"notes":"Includes base prep and sand"},
    {"id":uid(),"name":"Premium Large Format Paver Patio SF","category":"Hardscaping","unit":"SF","laborCost":10.50,"materialCost":8.50,"equipmentCost":3.50,"notes":"Premium slab pavers"},
    {"id":uid(),"name":"Brick Paver Driveway - Heavy Duty SF","category":"Hardscaping","unit":"SF","laborCost":12.00,"materialCost":10.00,"equipmentCost":5.00,"notes":"Interlocking driveway pavers"},
    {"id":uid(),"name":"Permeable Paver System - Per SF","category":"Hardscaping","unit":"SF","laborCost":14.00,"materialCost":12.50,"equipmentCost":4.50,"notes":"Open graded base drainage pavers"},
    {"id":uid(),"name":"Natural Stone Flagstone Patio - Mortar Set","category":"Hardscaping","unit":"SF","laborCost":22.00,"materialCost":18.50,"equipmentCost":5.00,"notes":"Irregular blue or flagstone"},
    {"id":uid(),"name":"Natural Stone Stepping Stone Path EA","category":"Hardscaping","unit":"EA","laborCost":25.00,"materialCost":35.00,"equipmentCost":5.00,"notes":"Single stone set in turf/mulch"},

    # ── Hardscaping — Walls & Steps ───────────────────────────
    {"id":uid(),"name":"Retaining Wall - Segmental Block SF","category":"Hardscaping","unit":"SF","laborCost":15.00,"materialCost":12.50,"equipmentCost":4.50,"notes":"Modular block with gravel backfill"},
    {"id":uid(),"name":"Retaining Wall - Natural Boulder LF","category":"Hardscaping","unit":"LF","laborCost":45.00,"materialCost":65.00,"equipmentCost":85.00,"notes":"Machine set limestone/granite boulders"},
    {"id":uid(),"name":"Retaining Wall - Timber 6x6 PT LF","category":"Hardscaping","unit":"LF","laborCost":18.00,"materialCost":14.00,"equipmentCost":5.00,"notes":"Classic wood tie wall"},
    {"id":uid(),"name":"Hardscape Steps - Precast 4 Ft Unit EA","category":"Hardscaping","unit":"EA","laborCost":125.00,"materialCost":285.00,"equipmentCost":45.00,"notes":"Solid block steps"},
    {"id":uid(),"name":"Hardscape Steps - Natural Stone Slab EA","category":"Hardscaping","unit":"EA","laborCost":185.00,"materialCost":350.00,"equipmentCost":85.00,"notes":"Large stone stair tread"},

    # ── Site Work & Base ──────────────────────────────────────
    {"id":uid(),"name":"Base Gravel - Grade 2 CA-6 CY","category":"Hardscaping","unit":"CY","laborCost":12.00,"materialCost":28.00,"equipmentCost":18.00,"notes":"Crushed stone base for pavers"},
    {"id":uid(),"name":"Landscape Fabric - Heavy Duty SF","category":"Landscaping","unit":"SF","laborCost":0.05,"materialCost":0.08,"equipmentCost":0.01,"notes":"Weed barrier under mulch/rock"},
    {"id":uid(),"name":"Plastic Edge Restraint - Paver LF","category":"Hardscaping","unit":"LF","laborCost":1.25,"materialCost":2.50,"equipmentCost":0.10,"notes":"Low profile paver edging"},
    {"id":uid(),"name":"Aluminum Landscape Edging - 4 Inch LF","category":"Landscaping","unit":"LF","laborCost":2.50,"materialCost":5.50,"equipmentCost":0.20,"notes":"Premium garden bed edging"},
    {"id":uid(),"name":"Finishing Sand - Polymeric SF","category":"Hardscaping","unit":"SF","laborCost":0.25,"materialCost":0.85,"equipmentCost":0.05,"notes":"Joint sand for pavers"},

    # ── Irrigation & Drainage ────────────────────────────────
    {"id":uid(),"name":"Irrigation System - Per Zone (8 Heads)","category":"Landscaping","unit":"EA","laborCost":450.00,"materialCost":350.00,"equipmentCost":150.00,"notes":"Full zone install with piping"},
    {"id":uid(),"name":"Irrigation Controller - Wi-Fi 8 Zone","category":"Landscaping","unit":"EA","laborCost":125.00,"materialCost":285.00,"equipmentCost":0.00,"notes":"Smart controller setup"},
    {"id":uid(),"name":"Drip Irrigation Line - Per 100 LF","category":"Landscaping","unit":"EA","laborCost":85.00,"materialCost":115.00,"equipmentCost":5.00,"notes":"Drip tube for garden beds"},
    {"id":uid(),"name":"French Drain System - 4 Inch Per LF","category":"Landscaping","unit":"LF","laborCost":12.50,"materialCost":6.50,"equipmentCost":18.00,"notes":"Perv pipe, gravel and sleeve"},
    {"id":uid(),"name":"Surface Catch Basin - 12 Inch EA","category":"Landscaping","unit":"EA","laborCost":145.00,"materialCost":65.00,"equipmentCost":35.00,"notes":"Grated inlet for lawn drainage"},

    # ── Lighting & Decor ─────────────────────────────────────
    {"id":uid(),"name":"Low Voltage Pathway Light - LED EA","category":"Hardscaping","unit":"EA","laborCost":45.00,"materialCost":85.00,"equipmentCost":5.00,"notes":"Standard accent light"},
    {"id":uid(),"name":"Low Voltage Uplight - Specimen Tree EA","category":"Hardscaping","unit":"EA","laborCost":55.00,"materialCost":125.00,"equipmentCost":5.00,"notes":"Directional spotlight"},
    {"id":uid(),"name":"Lighting Transformer - 300W Digital","category":"Hardscaping","unit":"EA","laborCost":85.00,"materialCost":245.00,"equipmentCost":0.00,"notes":"Low voltage power supply"},
    {"id":uid(),"name":"Decorative Planter Box - Cedar 3x2 EA","category":"Landscaping","unit":"EA","laborCost":65.00,"materialCost":145.00,"equipmentCost":2.00,"notes":"Raised garden bed garden"},

    # ── Expanded Items (to reach ~100) ───────────────────────
    {"id":uid(),"name":"Tree Disposal - 12 Inch Trunk EA","category":"Landscaping","unit":"EA","laborCost":450.00,"materialCost":0.00,"equipmentCost":350.00,"notes":"Take down and haul away"},
    {"id":uid(),"name":"Stump Grinding - Up to 24 Inch EA","category":"Landscaping","unit":"EA","laborCost":85.00,"materialCost":0.00,"equipmentCost":125.00,"notes":"Machine grind below grade"},
    {"id":uid(),"name":"Fine Grading - Lawn Prep Per SF","category":"Landscaping","unit":"SF","laborCost":0.05,"materialCost":0.02,"equipmentCost":0.08,"notes":"Harley rake or hand finish"},
    {"id":uid(),"name":"Topsoil Delivery and Spread - CY","category":"Landscaping","unit":"CY","laborCost":25.00,"materialCost":35.00,"equipmentCost":15.00,"notes":"Screened pulverized soil"},
    {"id":uid(),"name":"Peat Moss Amendment - 3.8 CF Bale EA","category":"Landscaping","unit":"EA","laborCost":12.00,"materialCost":22.00,"equipmentCost":0.00,"notes":"Soil conditioner for beds"},
    {"id":uid(),"name":"Pulverized Black Dirt - Per CY","category":"Landscaping","unit":"CY","laborCost":12.00,"materialCost":32.00,"equipmentCost":5.00,"notes":"Premium planting soil"},
    {"id":uid(),"name":"Grass Plug Planting - Per 100 Plugs","category":"Landscaping","unit":"EA","laborCost":45.00,"materialCost":32.00,"equipmentCost":0.00,"notes":"For slow-spread grass types"},
    {"id":uid(),"name":"Lawn Rolling - Per 1000 SF","category":"Landscaping","unit":"EA","laborCost":45.00,"materialCost":0.00,"equipmentCost":25.00,"notes":"Compaction to level lawn"},

    # ── More Hardscaping (to reach ~100) ──────────────────────
    {"id":uid(),"name":"Fire Pit Kit - Steel Ring and Block EA","category":"Hardscaping","unit":"EA","laborCost":250.00,"materialCost":450.00,"equipmentCost":45.00,"notes":"Circular modular fire pit"},
    {"id":uid(),"name":"Seat Wall - Double Sided Block LF","category":"Hardscaping","unit":"LF","laborCost":25.00,"materialCost":35.00,"equipmentCost":5.00,"notes":"Decorative sitting wall"},
    {"id":uid(),"name":"Wall Cap Stone - Bullnose LF","category":"Hardscaping","unit":"LF","laborCost":12.00,"materialCost":18.00,"equipmentCost":2.00,"notes":"Finishing stone for walls"},
    {"id":uid(),"name":"Cobblestone Edging - Belgian Block LF","category":"Hardscaping","unit":"LF","laborCost":8.50,"materialCost":6.50,"equipmentCost":2.50,"notes":"Natural stone border"},
    {"id":uid(),"name":"Gravel Pathway - Crushed Limestone SF","category":"Hardscaping","unit":"SF","laborCost":1.25,"materialCost":1.85,"equipmentCost":0.45,"notes":"Compacted walkway material"},
    {"id":uid(),"name":"Decomposed Granite Pathway - SF","category":"Hardscaping","unit":"SF","laborCost":1.55,"materialCost":2.25,"equipmentCost":0.65,"notes":"Decorative fine path material"},
    {"id":uid(),"name":"Concrete Curbing - Landscape Extruded LF","category":"Landscaping","unit":"LF","laborCost":4.50,"materialCost":3.25,"equipmentCost":1.25,"notes":"Continuous poured border"},

    # ── More Maintenance & Logistics (to reach 100) ──────────
    {"id":uid(),"name":"Lawn Mowing - Standard Residential Visit","category":"Landscaping","unit":"EA","laborCost":45.00,"materialCost":0.00,"equipmentCost":15.00,"notes":"Mow, trim, and blow"},
    {"id":uid(),"name":"Spring Cleanup - Debris Removal HR","category":"Landscaping","unit":"HR","laborCost":65.00,"materialCost":0.00,"equipmentCost":10.00,"notes":"First of season site prep"},
    {"id":uid(),"name":"Tree Trimming - Basic Canopy Thinning EA","category":"Landscaping","unit":"EA","laborCost":125.00,"materialCost":0.00,"equipmentCost":45.00,"notes":"Minor branch removal"},
    {"id":uid(),"name":"Fertilizer Application - Per 1000 SF","category":"Landscaping","unit":"EA","laborCost":15.00,"materialCost":22.00,"equipmentCost":5.00,"notes":"Granular lawn food"},
    {"id":uid(),"name":"Weed Treatment - Spot Herbicide EA","category":"Landscaping","unit":"EA","laborCost":35.00,"materialCost":15.00,"equipmentCost":5.00,"notes":"Targeted weed control spray"},
    {"id":uid(),"name":"Skid Steer Rental - Landscape Prep Day","category":"Landscaping","unit":"EA","laborCost":0.00,"materialCost":0.00,"equipmentCost":425.00,"notes":"Machine plus diesel and delivery"},
    {"id":uid(),"name":"Dump Truck Delivery - Large Load EA","category":"Landscaping","unit":"EA","laborCost":0.00,"materialCost":0.00,"equipmentCost":185.00,"notes":"Standard 10-yard delivery fee"},
    {"id":uid(),"name":"Brush Pile Burndown / Disposal EA","category":"Landscaping","unit":"EA","laborCost":150.00,"materialCost":0.00,"equipmentCost":85.00,"notes":"Cleanup of yard waste"},
    {"id":uid(),"name":"Landscape Design - Master Plan Rendering","category":"Landscaping","unit":"EA","laborCost":850.00,"materialCost":0.00,"equipmentCost":0.00,"notes":"Professional blueprint and vision"},
    {"id":uid(),"name":"Drainage Consultation and Load Calc","category":"Landscaping","unit":"EA","laborCost":250.00,"materialCost":0.00,"equipmentCost":0.00,"notes":"Engineering check for site runoff"},
    {"id":uid(),"name":"Retaining Wall Engineering Review","category":"Hardscaping","unit":"EA","laborCost":450.00,"materialCost":0.00,"equipmentCost":0.00,"notes":"Sealed plans for wall > 3ft"},
    {"id":uid(),"name":"HOA Application Review - Landscaping","category":"Landscaping","unit":"EA","laborCost":95.00,"materialCost":0.00,"equipmentCost":0.00,"notes":"Prepare and submit doc to board"},

    # ── Final Items to hit 100 ──────────────────────────────
    {"id":uid(),"name":"Artificial Turf Install - Premium SF","category":"Landscaping","unit":"SF","laborCost":4.50,"materialCost":8.50,"equipmentCost":1.50,"notes":"Synthetic grass system"},
    {"id":uid(),"name":"Pond Kit - 8x11 Waterfall EA","category":"Landscaping","unit":"EA","laborCost":1250.00,"materialCost":1850.00,"equipmentCost":450.00,"notes":"Includes liner, pump and rock"},
    {"id":uid(),"name":"Landscape Boulder - Specimen Placement EA","category":"Landscaping","unit":"EA","laborCost":85.00,"materialCost":185.00,"equipmentCost":125.00,"notes":"Machine set single large rock"},
    {"id":uid(),"name":"Wood Arched Garden Bridge - 6 Ft EA","category":"Landscaping","unit":"EA","laborCost":125.00,"materialCost":285.00,"equipmentCost":0.00,"notes":"Accent bridge over path"},
    {"id":uid(),"name":"Deer Protection Spray - Monthly Visit EA","category":"Landscaping","unit":"EA","laborCost":45.00,"materialCost":15.00,"equipmentCost":2.00,"notes":"Repellent application"},
    {"id":uid(),"name":"Trellis Install - 4x8 Panel EA","category":"Landscaping","unit":"EA","laborCost":65.00,"materialCost":85.00,"equipmentCost":2.00,"notes":"Vertical climbing plant support"},
    {"id":uid(),"name":"Vegetable Garden Bed Setup - Raised SF","category":"Landscaping","unit":"SF","laborCost":8.50,"materialCost":12.00,"equipmentCost":2.00,"notes":"Cedar framing and soil fill"},
    {"id":uid(),"name":"Outdoor Kitchen Base - CMU or Kit LF","category":"Hardscaping","unit":"LF","laborCost":45.00,"materialCost":85.00,"equipmentCost":15.00,"notes":"Structural shell for appliances"},
    {"id":uid(),"name":"Granite Countertop for Outdoor Kitchen SF","category":"Hardscaping","unit":"SF","laborCost":35.00,"materialCost":65.00,"equipmentCost":5.00,"notes":"Exterior grade stone install"},
    {"id":uid(),"name":"Paver Sealing - Per 500 SF Visit","category":"Hardscaping","unit":"EA","laborCost":185.00,"materialCost":125.00,"equipmentCost":25.00,"notes":"Clean and seal paver patio"},
    {"id":uid(),"name":"Holiday Lighting - Professional Install EA","category":"Landscaping","unit":"EA","laborCost":450.00,"materialCost":150.00,"equipmentCost":50.00,"notes":"Standard roofline and 2 trees"},
    {"id":uid(),"name":"Snow Plowing - Standard Driveway Visit","category":"Landscaping","unit":"EA","laborCost":45.00,"materialCost":0.00,"equipmentCost":35.00,"notes":"Per visit winter service"},
    {"id":uid(),"name":"Snow Shoveling - Walkway and Entry EA","category":"Landscaping","unit":"EA","laborCost":25.00,"materialCost":0.00,"equipmentCost":5.00,"notes":"Hand labor winter service"},
    {"id":uid(),"name":"Salt / Ice Melt Application Visit","category":"Landscaping","unit":"EA","laborCost":15.00,"materialCost":22.00,"equipmentCost":5.00,"notes":"Calcium chloride spread"},
    {"id":uid(),"name":"Landscape Maintenance - Bi-Weekly Visit","category":"Landscaping","unit":"EA","laborCost":125.00,"materialCost":0.00,"equipmentCost":25.00,"notes":"Pruning, weeding, and cleanup"},
]
