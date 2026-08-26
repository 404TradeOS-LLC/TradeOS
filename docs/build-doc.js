// Legacy one-off document generator. It predates the RC1 source-of-truth docs
// under docs/*.md and should not be used for current implementation claims.
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat,
  TableOfContents, HeadingLevel, BorderStyle, WidthType, ShadingType,
  VerticalAlign, PageNumber, PageBreak,
} = require("docx");

const PAGE_W = 12240, PAGE_H = 15840, MARGIN = 1440;
const CONTENT_W = PAGE_W - MARGIN * 2; // 9360

const COLOR_PRIMARY = "1F3B57";
const COLOR_ACCENT = "2E75B6";
const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const cellBorders = { top: border, bottom: border, left: border, right: border };

function h1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
}
function h2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
}
function h3(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(text)] });
}
function p(text, opts = {}) {
  return new Paragraph({ children: [new TextRun({ text, ...opts })], spacing: { after: 160 } });
}
function bullet(text) {
  return new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun(text)], spacing: { after: 60 } });
}
function numbered(text) {
  return new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun(text)], spacing: { after: 60 } });
}
function formula(text) {
  return new Paragraph({
    children: [new TextRun({ text, font: "Courier New", bold: true, color: COLOR_PRIMARY })],
    spacing: { before: 120, after: 120 },
    border: { left: { style: BorderStyle.SINGLE, size: 12, color: COLOR_ACCENT, space: 8 } },
    indent: { left: 200 },
  });
}
function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}
function rule(text) {
  return new Paragraph({
    children: [new TextRun({ text: "  " })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR_ACCENT, space: 1 } },
    spacing: { after: 200 },
  });
}

function makeTable(headerRow, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  const scale = CONTENT_W / total;
  const colW = widths.map((w) => Math.round(w * scale));
  // fix rounding to sum exactly
  const diff = CONTENT_W - colW.reduce((a, b) => a + b, 0);
  colW[colW.length - 1] += diff;

  const headerCells = headerRow.map((text, i) =>
    new TableCell({
      borders: cellBorders,
      width: { size: colW[i], type: WidthType.DXA },
      shading: { fill: COLOR_PRIMARY, type: ShadingType.CLEAR },
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 20 })] })],
    })
  );

  const bodyRows = rows.map((row, ri) =>
    new TableRow({
      children: row.map((text, i) =>
        new TableCell({
          borders: cellBorders,
          width: { size: colW[i], type: WidthType.DXA },
          shading: { fill: ri % 2 === 0 ? "FFFFFF" : "F2F6FA", type: ShadingType.CLEAR },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: String(text), size: 20 })] })],
        })
      ),
    })
  );

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: colW,
    rows: [new TableRow({ children: headerCells, tableHeader: true }), ...bodyRows],
  });
}

// ============================================================
// CONTENT
// ============================================================

const children = [];

// ---- TITLE PAGE ----
children.push(
  new Paragraph({ spacing: { before: 2000 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "TradeOS Cost Book", bold: true, size: 64, color: COLOR_PRIMARY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 200 }, children: [new TextRun({ text: "Product Architecture, Cost Book Design & Implementation Roadmap", size: 32, color: COLOR_ACCENT })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 600 }, children: [new TextRun({ text: "Estimating & Pricing Platform for Trade Contractors", size: 24, italics: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1200 }, children: [new TextRun({ text: "v1.0 — Planning Document", size: 22 })] }),
  pageBreak(),
  h1("Table of Contents"),
  new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }),
  pageBreak()
);

// ---- EXECUTIVE SUMMARY ----
children.push(
  h1("Executive Summary & Vision"),
  p("TradeOS Cost Book is a cloud-based estimating and pricing platform built for small-to-medium trade contractors. The product lets a contractor select a service, enter project quantities, and receive a consistent, profitable, customer-facing proposal in minutes — built on accurate, auditable labor, material, equipment, subcontractor, overhead, and profit data rather than gut-feel pricing."),
  p("The long-term vision is to become the system of record for trade pricing data across General Contractors, Remodeling, Decks, Roofing, Concrete, Excavation, Landscaping, Fencing, Plumbing, HVAC, and Electrical — effectively the “QuickBooks of Trade Estimating”: a category-defining, data-network-effect platform rather than a static cost book PDF."),
  h2("Strategic Pillars"),
  bullet("Speed: an estimate that used to take hours of manual takeoff and spreadsheet math should take minutes."),
  bullet("Accuracy: every dollar in a proposal should be traceable to a labor rate, a material price, an equipment cost, or a markup decision — never a guess."),
  bullet("Consistency: the same job, estimated by two different people on two different days, should produce the same price."),
  bullet("Compounding data: the more contractors use it, the better the underlying cost data and production rates get for everyone (with appropriate anonymization/regional aggregation)."),
  p("This document defines the MVP scope, the full data architecture, the formula engine, V1 content for nine priority trade categories, a pricing-maintenance strategy, a 5-phase roadmap, and a competitive read on the incumbents (RSMeans, Craftsman Book Company, Jobber, Housecall Pro, Buildertrend). It is intentionally a planning artifact — no application code is implied as built by this document.")
);

// ============================================================
// DELIVERABLE 1 — PRODUCT ARCHITECTURE
// ============================================================
children.push(
  pageBreak(),
  h1("Deliverable 1 — Product Architecture"),
  p("The system is organized into eight core modules. Each module owns a distinct concern, exposes a narrow interface to the others, and can be developed, tested, and scaled independently."),
  h2("Module Relationship Overview"),
  p("Data flows from the four pricing databases (Labor, Material, Equipment) and the Assemblies layer, through the Estimate Engine, into the Proposal Generator. The Admin Dashboard is the control plane that manages all underlying data and configuration. The Cost Database is the umbrella schema connecting cost items to the hierarchy described in Deliverable 2.", { italics: true }),
  formula(
    "Labor DB  ┐\n" +
    "Material DB├─▶ Cost Database ─▶ Assemblies ─▶ Estimate Engine ─▶ Proposal Generator\n" +
    "Equipment DB┘                                   ▲\n" +
    "                                Admin Dashboard ───────────────────┘  (manages all of the above)"
  )
);

const modules = [
  ["Cost Database", "Central registry of priced cost items, organized by the Division → Category → Subcategory → Cost Item hierarchy (Deliverable 2).", "Division/Category/Subcategory definitions; raw labor/material/equipment costs", "Versioned, queryable cost items with computed unit costs", "Feeds Estimate Engine directly and via Assemblies"],
  ["Labor Database", "Stores trade labor rates, burden percentages, and regional adjustments.", "Base hourly rates, burden %, region index", "Burdened labor rate per trade per region", "Feeds Cost Database and Estimate Engine"],
  ["Material Database", "Stores material unit costs, waste factors, and supplier linkage.", "SKU, unit cost, waste factor, supplier", "Adjusted material cost per unit", "Feeds Cost Database; pricing updates flow in from Suppliers (Deliverable 6)"],
  ["Equipment Database", "Stores ownership and operating costs per piece of equipment.", "Depreciation, insurance, fuel, maintenance inputs", "Hourly/daily equipment cost", "Feeds Cost Database and Estimate Engine"],
  ["Assemblies Database", "Composes multiple cost items (and nested assemblies) into a single sellable unit, e.g. “Composite Deck, 12x16.”", "Cost item quantities per assembly unit", "Rolled-up assembly unit cost", "Feeds Estimate Engine; avoids duplicating pricing data"],
  ["Estimate Engine", "Applies quantities entered by the contractor to cost items/assemblies, then applies overhead and profit per the Formula Engine (Deliverable 3).", "Selected cost items/assemblies, quantities, overhead %, profit %/margin target", "Line-item costs, estimate subtotal, total sell price", "Feeds Proposal Generator; reads from Cost Database & Assemblies"],
  ["Proposal Generator", "Converts an approved estimate into a branded, customer-facing document with optional line-item detail or lump-sum presentation.", "Finalized estimate, company branding, customer/project info", "PDF/web proposal, e-signature-ready document", "Reads from Estimate Engine output"],
  ["Admin Dashboard", "Control plane for managing all pricing data, users, regions, and company overhead/profit defaults.", "User edits, bulk imports, supplier feed configuration", "Updated records across all other modules", "Writes to every other module's underlying tables"],
];
children.push(
  h2("Module Detail"),
  makeTable(["Module", "Purpose", "Inputs", "Outputs", "Relationships"], modules, [1300, 2200, 1700, 1700, 1700])
);

// ============================================================
// DELIVERABLE 2 — COST BOOK STRUCTURE
// ============================================================
children.push(
  pageBreak(),
  h1("Deliverable 2 — Cost Book Structure"),
  p("The cost book uses a four-level hierarchy. Each level has a stable, human-readable code so contractors can navigate the book the way they would a printed RSMeans-style reference, while the underlying system uses UUID primary keys for referential integrity."),
  h2("Hierarchy"),
  numbered("Division — e.g. “02 – Sitework”"),
  numbered("Category — e.g. “02-200 – Excavation”"),
  numbered("Subcategory — e.g. “02-200-10 – Residential Excavation”"),
  numbered("Cost Item — e.g. “02-200-10-001 – Excavation Per Cubic Yard”"),
  h2("Field Definitions Per Level")
);

const hierarchyFields = [
  ["Division", "id (uuid), code, name", "sort_order", "code is org-scoped and stable (e.g. CSI-style 2-digit numbering); name is editable"],
  ["Category", "id (uuid), division_id, code, name", "sort_order", "code is unique within its division"],
  ["Subcategory", "id (uuid), category_id, code, name", "sort_order", "code is unique within its category"],
  ["Cost Item", "id (uuid), subcategory_id, code, name, unit_of_measure", "production_rate, labor_rate_id, material_id, equipment_id, subcontractor_id, notes, is_active", "code is unique within org; a cost item references at most one of labor/material/equipment/subcontractor directly, or is itself composed via an Assembly"],
];
children.push(
  makeTable(["Level", "Required Fields", "Optional Fields", "Notes"], hierarchyFields, [1200, 2700, 2700, 2760]),
  h2("Unique ID Scheme"),
  p("Two ID systems run in parallel and serve different purposes:"),
  bullet("Internal primary key: UUID, generated at insert time, never shown to users, used for all foreign keys."),
  bullet("Display code: human-readable, hierarchical string (e.g. 02-200-10-001) shown in the UI and on proposals. Regenerable/re-sortable without breaking foreign key relationships, since it is not the primary key."),
  p("This separation lets the team re-number or re-organize the visible cost book (e.g. renumbering categories) without a destructive database migration, since all relationships are keyed on the UUID, not the code.")
);

// ============================================================
// DELIVERABLE 3 — ESTIMATING FORMULA ENGINE
// ============================================================
children.push(
  pageBreak(),
  h1("Deliverable 3 — Estimating Formula Engine"),
  p("The formula engine computes a sell price from raw cost inputs in five stages: Labor, Materials, Equipment, Overhead, and Profit. Each stage is deterministic and auditable — every number on a proposal can be traced back through these formulas to its source data."),

  h2("Labor"),
  formula("Labor Hours = Quantity ÷ Production Rate"),
  p("Production Rate is units of work completed per labor-hour for a given trade (e.g. 8 SF/hr drywall hang). Use when the cost item has a measurable per-unit labor component (most field work)."),
  formula("Burdened Labor Rate = Base Hourly Rate × (1 + Burden %)"),
  p("Burden % covers payroll taxes, workers' comp, benefits, and other employer costs layered on top of the base wage. Always burden labor before pricing — never quote raw wage rates."),
  formula("Labor Cost = Labor Hours × Burdened Labor Rate"),

  h2("Materials"),
  formula("Material Cost = Quantity × Unit Cost"),
  formula("Adjusted Material Cost = Material Cost × (1 + Waste Factor %)"),
  p("Waste Factor accounts for cut-offs, breakage, and overage (e.g. 10% on decking boards, 5% on concrete). Use a higher waste factor for irregular geometries or materials with fixed-length stock."),

  h2("Equipment"),
  formula("Hourly Cost = Ownership Cost per Hour + Operating Cost per Hour"),
  formula("Ownership Cost per Hour = (Purchase Price − Salvage Value) ÷ Useful Life Hours  +  Insurance/Storage per Hour"),
  formula("Operating Cost per Hour = Fuel + Maintenance + Consumables, per Hour"),
  formula("Daily Cost = Hourly Cost × Billable Hours per Day  (or a negotiated flat daily_rate)"),
  p("Use the daily_rate field when equipment is rented (the rental house's day rate already bundles ownership and operating cost); use hourly ownership/operating cost when equipment is owned."),

  h2("Overhead"),
  formula("Direct Overhead = Job-specific indirect costs (permits, dumpster, temp fencing, project supervision)"),
  formula("Indirect Overhead = Company Overhead × Allocation %"),
  formula("Company Overhead Allocation % = Annual Overhead ÷ Annual Direct Cost of Sales (revised annually)"),
  p("Direct overhead is entered per-job. Indirect (company) overhead is a percentage applied to every job's direct cost subtotal, representing the contractor's office rent, admin salaries, insurance, etc. spread across all jobs in a year."),

  h2("Profit"),
  formula("Markup % = (Sell Price − Cost) ÷ Cost"),
  formula("Margin % = (Sell Price − Cost) ÷ Sell Price"),
  formula("Sell Price (Markup mode) = Cost × (1 + Markup %)"),
  formula("Sell Price (Target Margin mode) = Cost ÷ (1 − Target Margin %)"),
  p("Markup and margin are not the same number for the same job — a 25% markup is only a 20% margin. The Estimate Engine must let the contractor choose which mode they are pricing in (markup-driven or target-margin-driven) and display both so they are never surprised by the difference."),

  h2("Full Roll-Up"),
  formula(
    "Job Cost = Σ(Labor Cost) + Σ(Adjusted Material Cost) + Σ(Equipment Cost) + Σ(Subcontractor Cost) + Direct Overhead\n" +
    "Total Cost = Job Cost + Indirect Overhead\n" +
    "Sell Price = Total Cost priced via Markup % or Target Margin %"
  )
);

// ============================================================
// DELIVERABLE 4 — DATABASE DESIGN
// ============================================================
children.push(
  pageBreak(),
  h1("Deliverable 4 — Database Design"),
  p("Full SQL DDL (Postgres / Supabase conventions: UUID primary keys, timestamptz audit columns) is provided as a runnable migration at db/migrations/0001_init_schema.sql in this repository. The table below summarizes each entity, its key fields, relationships, and indexing strategy; refer to the SQL file for exact column types and constraints."),
);

const dbTables = [
  ["organizations", "id, name, region_code", "root tenant scope (RLS boundary in Phase 2)", "—"],
  ["divisions / categories / subcategories", "id, code, name, sort_order, parent FK", "cost book hierarchy (Deliverable 2)", "unique(parent_id, code)"],
  ["regions", "id, code, labor_index, material_index", "regional pricing multipliers", "unique(org_id, code)"],
  ["suppliers", "id, name, contact info, api_integration_key", "source of material pricing; Phase 2+ live feeds", "—"],
  ["materials", "id, sku, unit_cost, waste_factor_pct, supplier_id", "raw material pricing", "idx on org_id, supplier_id"],
  ["labor_rates", "id, trade, base_hourly_rate, burden_pct, region_id", "raw labor pricing", "idx on org_id"],
  ["equipment", "id, name, ownership_cost_per_hour, operating_cost_per_hour, daily_rate", "raw equipment pricing", "idx on org_id"],
  ["subcontractors", "id, name, trade, default_markup_pct", "subcontracted scope pricing", "—"],
  ["cost_items", "id, subcategory_id, code, unit_of_measure, production_rate, FKs to labor/material/equipment/subcontractor", "the atomic priced line item", "unique(org_id, code); idx on subcategory_id"],
  ["assemblies / assembly_items", "id, code, unit_of_measure / assembly_id, cost_item_id or child_assembly_id, quantity_per_unit", "composed, reusable bundles of cost items (supports nesting)", "idx on assembly_id; check constraint enforces exactly one of cost_item/child_assembly"],
  ["customers", "id, name, email, phone, billing_address", "client records", "—"],
  ["projects", "id, customer_id, region_id, status", "a job/opportunity", "idx on org_id, customer_id"],
  ["estimates", "id, project_id, version, status, overhead_pct, profit_pct, target_margin_pct, subtotal_cost, total_price", "a priced version of a project", "idx on project_id"],
  ["estimate_line_items", "id, estimate_id, cost_item_id or assembly_id, quantity, unit_cost, line_cost", "the priced breakdown shown on a proposal", "idx on estimate_id; check constraint enforces exactly one of cost_item/assembly"],
  ["change_orders / change_order_line_items", "id, project_id, co_number, amount / line items", "post-contract scope changes", "unique(project_id, co_number)"],
];
children.push(
  makeTable(["Table(s)", "Key Fields", "Purpose", "Relationships / Indexes"], dbTables, [1700, 2400, 2400, 2860]),
  h2("Design Notes"),
  bullet("UUID primary keys throughout, so records can be created client-side (offline-first estimating) and merged without ID collisions."),
  bullet("Assemblies reference cost_items by relationship, not by copying their price — a price update to a single material or labor rate propagates to every assembly and estimate that uses it on next recalculation, with historical estimates preserved via the unit_cost snapshot stored on estimate_line_items."),
  bullet("estimate_line_items.unit_cost is a point-in-time snapshot — estimates must never silently reprice after being sent to a customer."),
  bullet("Every pricing table (materials, labor_rates, equipment) is scoped by org_id so each contractor can override base cost-book data with their own actual costs."),
  bullet("Full RLS policy design (row-level security per organization) is deferred to Phase 2 once the auth model is finalized; the schema's org_id columns are designed to make that addition non-breaking.")
);

// ============================================================
// DELIVERABLE 5 — V1 CATEGORIES
// ============================================================
children.push(pageBreak(), h1("Deliverable 5 — Initial TradeOS Cost Book Categories (V1)"));

const trades = [
  {
    name: "General Construction",
    items: [
      ["Project Supervision", "Day", "1 day = 1 unit", "Direct overhead line item, not a production-rate cost item"],
      ["Mobilization / Demobilization", "EA", "Flat per job", "Equipment + labor flat cost"],
      ["Temporary Fencing", "LF", "150 LF/hr install", "Rental equipment + labor"],
      ["Dumpster / Debris Haul", "EA (pull)", "Flat per pull", "Subcontracted or owned equipment"],
      ["Final Clean", "SF", "2,000 SF/hr", "Labor only"],
      ["Permit Acquisition", "EA", "Flat per permit", "Direct overhead; material cost item for the permit fee"],
      ["Site Survey / Layout", "EA", "Flat per job (or subcontracted)", "Labor or subcontractor flat cost"],
      ["Portable Toilet Rental", "Month", "Flat monthly rate", "Equipment rental, recurring line item"],
      ["Temporary Power Hookup", "EA", "Flat per job", "Subcontractor (electrician) or equipment"],
      ["Erosion Control / Silt Fence", "LF", "100 LF/hr install", "Labor + material"],
      ["Punch List Completion", "Hr", "1 hr = 1 unit", "Labor only, billed at close-out"],
      ["Insurance / Bonding Allocation", "% of job", "N/A (overhead allocation)", "Direct overhead line item, computed not measured"],
    ],
  },
  {
    name: "Excavation",
    items: [
      ["Excavation, Machine", "CY", "20 CY/hr (mini excavator + operator)", "Labor + equipment blend"],
      ["Hand Excavation", "CY", "1 CY/hr", "Labor only"],
      ["Backfill & Compaction", "CY", "15 CY/hr", "Labor + equipment"],
      ["Grading, Fine", "SF", "500 SF/hr", "Labor + equipment"],
      ["Grading, Rough", "SF", "1,200 SF/hr", "Labor + equipment"],
      ["Haul-Off, Spoils", "CY", "Flat per truck load (10 CY)", "Equipment (truck) + disposal fee material cost"],
      ["Trenching, Utility", "LF", "30 LF/hr", "Labor + equipment"],
      ["Demolition, Slab/Driveway", "SF", "200 SF/hr", "Labor + equipment"],
      ["Tree/Stump Removal", "EA", "1 EA/hr", "Labor + equipment"],
      ["Gravel Base, Install", "CY", "10 CY/hr", "Labor + material + equipment"],
      ["Erosion/Drainage Swale", "LF", "40 LF/hr", "Labor + equipment"],
      ["Soil Testing / Geotech", "EA", "Flat per test", "Subcontracted"],
    ],
  },
  {
    name: "Concrete",
    items: [
      ["Footing, Poured", "LF", "20 LF/hr (crew of 3)", "Labor + material (concrete by CY)"],
      ["Slab on Grade, 4″", "SF", "60 SF/hr", "Labor + material + equipment (screed/vibrator)"],
      ["Flatwork Finishing", "SF", "100 SF/hr", "Labor only"],
      ["Rebar, Placed", "LB", "150 LB/hr", "Labor + material"],
      ["Concrete, Ready-Mix", "CY", "N/A (material only)", "Material cost item, no production rate"],
      ["Formwork, Set & Strip", "SF (contact)", "30 SF/hr", "Labor + material"],
      ["Sidewalk, Poured", "SF", "50 SF/hr", "Labor + material"],
      ["Driveway, Poured", "SF", "45 SF/hr", "Labor + material + equipment"],
      ["Curb & Gutter", "LF", "25 LF/hr", "Labor + material + equipment"],
      ["Stamped/Decorative Finish", "SF", "40 SF/hr", "Labor + material upcharge"],
      ["Vapor Barrier, Install", "SF", "300 SF/hr", "Labor + material"],
      ["Concrete Saw Cutting", "LF", "20 LF/hr", "Labor + equipment"],
    ],
  },
  {
    name: "Framing",
    items: [
      ["Wall Framing, Exterior", "LF", "8 LF/hr (crew of 2)", "Labor + material"],
      ["Wall Framing, Interior", "LF", "10 LF/hr", "Labor + material"],
      ["Floor Joist, Install", "SF", "25 SF/hr", "Labor + material"],
      ["Roof Truss, Set", "EA", "4 EA/hr (with crane)", "Labor + equipment + material"],
      ["Rafter, Stick-Framed", "LF", "6 LF/hr", "Labor + material"],
      ["Sheathing, Wall/Roof", "SF", "80 SF/hr", "Labor + material"],
      ["Header, Install", "EA", "3 EA/hr", "Labor + material"],
      ["Subfloor, Install", "SF", "100 SF/hr", "Labor + material"],
      ["Beam/Post, Structural", "EA", "1.5 EA/hr", "Labor + material + equipment"],
      ["Blocking/Bridging", "EA", "12 EA/hr", "Labor + material"],
      ["Stair Framing", "EA (flight)", "0.5 flight/hr", "Labor + material"],
      ["Hardware (hangers, straps), Install", "EA", "20 EA/hr", "Labor + material"],
    ],
  },
  {
    name: "Roofing",
    items: [
      ["Tear-Off, Asphalt Shingle", "SQ (100 SF)", "1.5 SQ/hr", "Labor + equipment (dumpster)"],
      ["Underlayment, Install", "SQ", "4 SQ/hr", "Labor + material"],
      ["Asphalt Shingle, Install", "SQ", "2 SQ/hr", "Labor + material"],
      ["Architectural Shingle, Install", "SQ", "1.7 SQ/hr", "Labor + material"],
      ["Flashing, Install", "LF", "10 LF/hr", "Labor + material"],
      ["Ridge Vent, Install", "LF", "12 LF/hr", "Labor + material"],
      ["Drip Edge, Install", "LF", "25 LF/hr", "Labor + material"],
      ["Decking Repair/Replace", "SF", "20 SF/hr", "Labor + material"],
      ["Skylight, Install", "EA", "0.75 EA/hr", "Labor + material"],
      ["Gutter, Install", "LF", "15 LF/hr", "Labor + material"],
      ["Metal Roofing, Install", "SQ", "1.2 SQ/hr", "Labor + material"],
      ["Roof Inspection / Warranty Cert.", "EA", "Flat per job", "Labor or subcontracted"],
    ],
  },
  {
    name: "Siding",
    items: [
      ["Siding Removal", "SF", "60 SF/hr", "Labor only"],
      ["House Wrap, Install", "SF", "150 SF/hr", "Labor + material"],
      ["Vinyl Siding, Install", "SF", "40 SF/hr", "Labor + material"],
      ["Fiber Cement Siding, Install", "SF", "25 SF/hr", "Labor + material"],
      ["Wood/Engineered Lap Siding, Install", "SF", "30 SF/hr", "Labor + material"],
      ["Trim, J-Channel/Corner", "LF", "30 LF/hr", "Labor + material"],
      ["Soffit & Fascia, Install", "LF", "20 LF/hr", "Labor + material"],
      ["Caulking & Sealant", "LF", "60 LF/hr", "Labor + material"],
      ["Shutters, Install", "EA", "2 EA/hr", "Labor + material"],
      ["Siding Repair, Spot", "SF", "15 SF/hr", "Labor + material"],
      ["Insulated Sheathing, Install", "SF", "90 SF/hr", "Labor + material"],
      ["Painting/Staining, Siding", "SF", "120 SF/hr", "Labor + material (or subcontracted)"],
    ],
  },
  {
    name: "Decks",
    items: [
      ["Footing, Deck Post", "EA", "1.5 EA/hr", "Labor + material + equipment (auger)"],
      ["Deck Framing", "SF", "15 SF/hr", "Labor + material"],
      ["Ledger Board, Install", "LF", "8 LF/hr", "Labor + material"],
      ["Decking, Composite Install", "SF", "20 SF/hr", "Labor + material"],
      ["Decking, Wood Install", "SF", "25 SF/hr", "Labor + material"],
      ["Railing, Install", "LF", "6 LF/hr", "Labor + material"],
      ["Post Caps & Lighting, Install", "EA", "6 EA/hr", "Labor + material"],
      ["Stairs, Deck", "EA (step)", "1 step/hr", "Labor + material"],
      ["Skirting/Under-Deck Enclosure", "LF", "12 LF/hr", "Labor + material"],
      ["Pergola/Roof Cover, Add-On", "SF", "5 SF/hr", "Labor + material"],
      ["Fastener Hardware (hidden fastening), Install", "SF", "30 SF/hr", "Labor + material"],
      ["Deck Demo & Haul-Off", "SF", "100 SF/hr", "Labor + equipment"],
    ],
  },
  {
    name: "Fencing",
    items: [
      ["Post Hole, Auger", "EA", "8 EA/hr", "Labor + equipment"],
      ["Post, Set in Concrete", "EA", "5 EA/hr", "Labor + material"],
      ["Wood Privacy Fence, Install", "LF", "10 LF/hr", "Labor + material"],
      ["Chain Link Fence, Install", "LF", "15 LF/hr", "Labor + material"],
      ["Vinyl/Composite Fence, Install", "LF", "9 LF/hr", "Labor + material"],
      ["Ornamental/Aluminum Fence, Install", "LF", "8 LF/hr", "Labor + material"],
      ["Gate, Install (walk)", "EA", "1.5 EA/hr", "Labor + material"],
      ["Gate, Install (drive/automatic)", "EA", "0.5 EA/hr", "Labor + material + equipment"],
      ["Fence Removal & Haul", "LF", "30 LF/hr", "Labor + equipment"],
      ["Fence Staining/Sealing", "LF", "50 LF/hr", "Labor + material"],
      ["Retaining Cap/Trim, Install", "LF", "20 LF/hr", "Labor + material"],
      ["Property Line Survey/Staking", "EA", "Flat per job", "Subcontracted"],
    ],
  },
  {
    name: "Landscaping",
    items: [
      ["Sod, Install", "SF", "150 SF/hr", "Labor + material"],
      ["Seeding & Straw, Install", "SF", "400 SF/hr", "Labor + material"],
      ["Mulch, Install", "CY", "3 CY/hr", "Labor + material"],
      ["Topsoil, Install/Spread", "CY", "5 CY/hr", "Labor + material + equipment"],
      ["Irrigation, Trench & Install", "LF", "20 LF/hr", "Labor + material + equipment"],
      ["Irrigation Controller/Zone, Install", "EA", "1 EA/hr", "Labor + material"],
      ["Retaining Wall, Block", "SF (face)", "8 SF/hr", "Labor + material + equipment"],
      ["Paver Patio, Install", "SF", "12 SF/hr", "Labor + material + equipment"],
      ["Planting Bed, Prep & Edge", "LF", "15 LF/hr", "Labor + material"],
      ["Tree, Install (B&B, <15 gal)", "EA", "1 EA/hr", "Labor + material"],
      ["Shrub/Perennial, Install", "EA", "6 EA/hr", "Labor + material"],
      ["Landscape Lighting, Install", "EA (fixture)", "2 EA/hr", "Labor + material"],
    ],
  },
];

for (const trade of trades) {
  children.push(
    h2(trade.name),
    makeTable(
      ["Cost Item", "Unit", "Suggested Production Rate", "Suggested Data Structure"],
      trade.items,
      [2200, 1200, 2800, 3160]
    ),
    new Paragraph({ spacing: { after: 200 }, children: [] })
  );
}
children.push(
  p("Every row above maps directly to a cost_items record: unit_of_measure and production_rate populate those columns, and the “Suggested Data Structure” column indicates which of labor_rate_id / material_id / equipment_id should be populated (a cost item may reference more than one — e.g. labor + material — in which case the Estimate Engine sums both components per unit).")
);

// ============================================================
// DELIVERABLE 6 — PRICING UPDATE STRATEGY
// ============================================================
children.push(
  pageBreak(),
  h1("Deliverable 6 — Pricing Update Strategy"),
  p("Stale pricing is the fastest way to lose contractor trust in the product. The update strategy is cadence-based, with manual review gates at every cadence until automated supplier integrations (Phase 2+) reduce the manual burden."),
  h2("Monthly Process"),
  bullet("Material prices: re-check high-volatility categories (lumber, steel-based fasteners, asphalt/petroleum-based roofing products) against at least one major supplier price list; flag >5% deltas for review."),
  bullet("Regional adjustments: no change expected monthly; monitor for emergency adjustments only (e.g. post-disaster material spikes in a specific region)."),
  h2("Quarterly Process"),
  bullet("Labor rates: review prevailing wage and market-rate data per trade per region; adjust base_hourly_rate and burden_pct as needed."),
  bullet("Material prices: full review of all categories, not just high-volatility ones."),
  bullet("Production rates: spot-check a sample of cost items against actual job performance data (once enough estimates have closed-loop actuals) and adjust production_rate where there's a consistent variance."),
  h2("Annual Process"),
  bullet("Regional indices: recompute labor_index and material_index per region from aggregated, anonymized cross-contractor data once there is sufficient volume."),
  bullet("Company overhead allocation %: each org should recompute Company Overhead Allocation % (Deliverable 3) from their prior fiscal year's actual overhead and direct cost of sales."),
  bullet("Full cost book audit: review category structure, retire dead cost items, add new ones based on usage analytics."),
  h2("Supplier Integrations (Phase 2+)"),
  p("Phase 1 (MVP) ships with manually-maintained pricing only. Phase 2 introduces the suppliers.api_integration_key field already present in the schema (Deliverable 4) to support pull-based price feeds from major suppliers (e.g. building material distributors with public or partner APIs), with the monthly/quarterly manual review becoming an exception-based review of automated deltas rather than a full manual re-check.")
);

// ============================================================
// DELIVERABLE 7 — IMPLEMENTATION ROADMAP
// ============================================================
children.push(pageBreak(), h1("Deliverable 7 — Implementation Roadmap"));

const phases = [
  {
    title: "Phase 1 — MVP",
    goals: "Prove the core loop: select service → enter quantities → generate cost → apply overhead/profit → produce proposal.",
    features: ["Single-org cost book (no multi-tenant RLS yet)", "Manual cost item / material / labor / equipment entry via Admin Dashboard", "Estimate Engine with markup-mode pricing only", "Basic PDF proposal generation", "V1 categories for the 9 priority trades (Deliverable 5)"],
    dbs: "organizations, divisions/categories/subcategories, materials, labor_rates, equipment, cost_items, customers, projects, estimates, estimate_line_items",
    apis: "Internal REST/RPC only (Supabase auto-generated API); no external integrations",
    effort: "6–9 weeks, 1–2 engineers",
    risks: ["Cost data for the 9 V1 trades is estimator-judgment-based, not yet validated against real job costing — pilot contractors may distrust default production rates until they can override them.", "Single-org assumption means no real multi-company pilot is possible yet; validate with one design partner at a time.", "Scope creep risk: pressure to add assemblies or change orders before the core loop is proven — resist until Phase 2."],
    metrics: ["Time from “select service” to “proposal sent” under 15 minutes for a typical single-trade job.", "At least 3 pilot contractors complete a real customer-facing proposal through the system.", "Zero instances of a sent proposal total not matching the sum of its line items (data-integrity bar, not a UX nicety)."],
  },
  {
    title: "Phase 2 — Professional Estimating System",
    goals: "Make the system trustworthy for daily professional use across a full company, not just a single estimator.",
    features: ["Multi-user orgs with RLS", "Assemblies (composed cost items)", "Target-margin pricing mode", "Change orders", "Regional pricing adjustments", "Supplier price-feed integration (read-only pull)"],
    dbs: "regions, suppliers, subcontractors, assemblies/assembly_items, change_orders/change_order_line_items",
    apis: "Supplier price-feed APIs (per-supplier, read-only); e-signature API for proposal sign-off",
    effort: "8–12 weeks, 2–3 engineers",
    risks: ["RLS retrofit onto Phase 1 data must be a non-breaking migration — validated by the org_id-scoped schema design in Deliverable 4, but still needs a careful rollout (e.g. backfill org_id before enabling RLS policies, not after).", "Assemblies introduce nested-composition complexity (assembly referencing assembly); recursive cost roll-up must guard against circular references.", "Supplier feed quality varies wildly — a bad feed could silently corrupt material pricing; require a staged review queue, not auto-apply."],
    metrics: ["At least 2 contractor companies running multiple estimators concurrently without data leakage across orgs.", "Assemblies account for >50% of line items in estimates created (proxy for adoption over raw cost items).", "Supplier feed deltas reviewed and approved/rejected within 48 hours of ingestion."],
  },
  {
    title: "Phase 3 — Multi-Trade Cost Database",
    goals: "Expand cost book depth and breadth so the product is credible across all 11 target trades, not just the 9 V1 categories, with a scale of cost items comparable to RSMeans.",
    features: ["Full category buildout for Plumbing, HVAC, Electrical (beyond V1)", "Cost item versioning / history", "Usage analytics to find unused or missing cost items", "Bulk import/export tooling for cost data"],
    dbs: "cost_item_versions (append-only history) or temporal table pattern on cost_items",
    apis: "Bulk import API (CSV/Excel), export API",
    effort: "10–14 weeks, 2–3 engineers + 1 estimating SME for content QA",
    risks: ["Plumbing/HVAC/Electrical have licensing and code-compliance nuance (permit triggers, inspection sequencing) that General Construction trades don't — content QA needs trade-specific SME review, not just engineering effort.", "Cost item sprawl: without usage analytics gating new additions, the book can bloat with low-value items that hurt searchability.", "Versioning history adds query complexity (always join to the active version) — must be transparent to the Estimate Engine, not leak into every other module's logic."],
    metrics: ["Cost item count per new trade reaches parity with the 9 V1 trades' average depth (~10–12 items per subcategory).", "Bulk import success rate >95% on first attempt for a well-formed CSV (validates the import tooling's error messaging, not just happy path).", "No regression in Estimate Engine query latency as cost_items table grows 3–5x."],
  },
  {
    title: "Phase 4 — AI-Assisted Estimating",
    goals: "Reduce estimator time-to-proposal further by using AI to suggest cost items/assemblies from a plain-language project description or an uploaded plan/photo, and to flag anomalous pricing before it goes out the door.",
    features: ["Natural-language project intake → suggested cost items/assemblies", "Takeoff-from-photo/plan assistance (computer vision, longer-term)", "Anomaly detection on outlier line-item pricing before send", "AI-drafted proposal narrative/cover letter"],
    dbs: "No new core schema; adds an estimate_suggestions or ai_interactions audit table",
    apis: "LLM provider API (e.g. via Vercel AI Gateway / AI SDK), vision model API for plan/photo intake",
    effort: "10–16 weeks, 2–3 engineers + 1 ML/AI specialist",
    risks: ["Garbage-in-garbage-out: AI suggestions inherit any gaps or errors in the Phase 3 cost book — sequencing AI before data depth is the single biggest risk to product credibility (see Closing section).", "Photo/plan takeoff is a much harder computer-vision problem than text suggestion — treat as a stretch feature within the phase, not a launch blocker.", "Anomaly detection false positives could erode trust faster than they prevent mistakes — tune for high precision over high recall at launch."],
    metrics: ["AI-suggested cost items/assemblies accepted without modification >60% of the time on common job types.", "Average estimator time-to-first-draft drops by at least 30% versus Phase 3 baseline.", "Anomaly flags have a false-positive rate low enough that estimators don't start ignoring them (track flag-dismissal rate as a leading indicator)."],
  },
  {
    title: "Phase 5 — National Cost Book Platform",
    goals: "Become the default shared cost-data layer for the industry: aggregated, anonymized regional/national pricing benchmarks that any contractor can subscribe to, with the option for contractors to keep fully private cost books.",
    features: ["Cross-org anonymized benchmarking dataset", "National/regional published cost book subscription tier", "Marketplace for trade-specific assembly templates between contractors", "Public API for partners (accounting, CRM, project management integrations)"],
    dbs: "benchmark_aggregates (materialized, refreshed periodically from anonymized org data)",
    apis: "Public partner API with OAuth; webhook system for integrations",
    effort: "12–20 weeks, 3–4 engineers + data/legal review for anonymization compliance",
    risks: ["Anonymization must be legally and technically robust before any cross-org aggregation ships — a re-identification incident here would be an existential trust failure for the whole platform, not just a feature bug.", "Marketplace for assembly templates introduces a two-sided trust problem (quality control on shared templates) that the product hasn't needed to solve before.", "Public partner API expands the attack surface and support burden significantly — needs dedicated platform/security ownership, not a side project for the core team."],
    metrics: ["Sufficient org volume and geographic spread per region before publishing any benchmark (define and enforce a minimum-n threshold per region/trade to avoid de-anonymization).", "At least one signed partner integration live on the public API within two quarters of GA.", "Net-positive opt-in rate to the benchmarking dataset among existing customers (a proxy for whether contractors trust the anonymization)."],
  },
];

for (const ph of phases) {
  children.push(
    h2(ph.title),
    p(ph.goals, { italics: true }),
    h3("Features"),
    ...ph.features.map(bullet),
    h3("Required Databases"),
    p(ph.dbs),
    h3("Required APIs"),
    p(ph.apis),
    h3("Estimated Effort"),
    p(ph.effort),
    h3("Key Risks"),
    ...ph.risks.map(bullet),
    h3("Success Metrics"),
    ...ph.metrics.map(bullet)
  );
}

// ============================================================
// DELIVERABLE 8 — COMPETITIVE ANALYSIS
// ============================================================
children.push(pageBreak(), h1("Deliverable 8 — Competitive Analysis"));

const competitors = [
  ["RSMeans", "The industry-standard cost data reference; deep, credible, regionally-adjusted unit cost data trusted by estimators for decades.", "Static reference data, not an estimating workflow tool; expensive subscription; no proposal generation, no assemblies tailored to a specific contractor's actual costs; steep learning curve for small contractors.", "Be the workflow layer RSMeans never built — use credible default cost data as a starting point, but let contractors override with their own actuals and go straight to a sellable proposal."],
  ["Craftsman Book Company (National Estimator)", "Long-established, trade-specific cost books (decks, remodeling, etc.) with detailed line items; respected by veteran estimators.", "Desktop/print-era UX, minimal cloud collaboration, no modern proposal or e-signature flow, slow update cadence.", "Modernize the same trade-specific depth into a cloud-native, always-current, mobile-friendly product."],
  ["Jobber", "Excellent field-service scheduling, dispatch, and invoicing for service trades; strong mobile app; good for recurring/service work.", "Estimating is generic and shallow — not built around true unit-cost/production-rate estimating; not designed for project-based construction bidding.", "Win the estimating depth Jobber doesn't have, and consider a future integration/partnership rather than competing on scheduling."],
  ["Housecall Pro", "Strong service-trade CRM, scheduling, and payments; good SMB sales motion and onboarding.", "Same gap as Jobber — thin estimating for project-based trades (decks, remodels, roofing) versus recurring service calls.", "Position as the estimating engine of record that's deeper than what all-in-one service platforms offer, with potential to be the API behind their estimate module."],
  ["Buildertrend", "Full project management suite (scheduling, budgets, client portal) used by remodelers/builders; strong brand recognition.", "Estimating module is a generic line-item budget tool, not a true cost-book-driven unit-cost engine; heavier, more expensive, more setup overhead — overkill for smaller contractors who just need fast, accurate estimates.", "Win the small-to-medium contractor who finds Buildertrend too heavy; be the focused, fast estimating-and-proposal tool, with project management as a later expansion rather than the wedge."],
];
children.push(
  makeTable(["Competitor", "Strengths", "Weaknesses", "Opportunity for TradeOS"], competitors, [1600, 2400, 2960, 2400]),
  h2("Detailed Competitor Profiles")
);

const profiles = [
  {
    name: "RSMeans (Gordian)",
    segment: "Commercial GCs, architects/engineers, government and institutional estimators; less penetration in small residential trades.",
    pricing: "Annual subscription, tiered by data package (e.g. Building Construction Costs, Residential Costs); historically $400–$1,500+/year per seat depending on package — priced for firms, not solo contractors.",
    verdict: "RSMeans wins on credibility of raw cost data and decades of trust, but a small deck or fencing contractor will never adopt a $1,000+/year reference book with no proposal output. TradeOS doesn't need to out-data RSMeans on day one — it needs to be \"good enough and actionable\" where RSMeans is \"authoritative but inert.\"",
  },
  {
    name: "Craftsman Book Company (National Estimator / CostBook)",
    segment: "Residential remodelers and specialty trade contractors who want trade-specific books (e.g. \"Remodeling Estimator,\" \"Decks & Patios Estimator\") rather than a generalist commercial reference.",
    pricing: "One-time book/software purchase or modest annual update subscription (historically far cheaper than RSMeans, often $100–$300/year), reflecting its smaller-contractor target market.",
    verdict: "Closest philosophical competitor to TradeOS's V1 trade categories (Deliverable 5) — same target customer, same idea of trade-specific unit costs. The gap is entirely in software modernity: no cloud sync, no team collaboration, no proposal/e-sign flow. TradeOS should treat this as the bar to clear on content credibility while leapfrogging on product.",
  },
  {
    name: "Jobber",
    segment: "Home/field service businesses broadly — cleaning, lawn care, HVAC service calls, handyman — skewed toward recurring or short-cycle service work rather than multi-week construction projects.",
    pricing: "SaaS subscription, per-user tiers (historically roughly $50–$300+/month depending on plan and team size) — priced as an operations platform, with estimating as one of many bundled features, not the core product.",
    verdict: "Jobber's estimating exists to support scheduling/invoicing, not to win complex bids — it has no real concept of production rates, burdened labor, or assemblies. A roofing or deck contractor doing $15–80K jobs will outgrow Jobber's estimate module quickly. TradeOS should not try to replace Jobber's scheduling/dispatch strength; the wedge is purely the depth of the estimate itself.",
  },
  {
    name: "Housecall Pro",
    segment: "Very similar to Jobber — home service SMBs (HVAC, plumbing, electrical service, cleaning) with a strong consumer-facing booking/payments experience.",
    pricing: "SaaS subscription, per-user tiers (historically roughly $50–$300+/month) — similar positioning to Jobber, bundling estimating into a broader operations suite.",
    verdict: "Same structural gap as Jobber: estimating is a thin module bolted onto a service-operations platform, not a unit-cost engine. Both Housecall Pro and Jobber are plausible distribution partners more than head-to-head competitors if TradeOS's estimating engine becomes credible enough to be the \"estimate API\" behind a service platform's UI.",
  },
  {
    name: "Buildertrend",
    segment: "Custom home builders and larger remodeling companies running multi-month projects with client portals, change order tracking, and subcontractor coordination needs.",
    pricing: "SaaS subscription, historically in the few-hundred-dollars-per-month range (e.g. $200–$600+/month depending on tier) — priced for project management value, not estimating depth, and often requires an annual commitment.",
    verdict: "Buildertrend is the closest thing to a \"too big\" competitor: powerful, but its estimating module is a generic budget/line-item tool layered under a project management suite, not a unit-cost/production-rate engine. Small-to-medium single-trade contractors (the initial TradeOS target) often find Buildertrend's setup overhead and price point disproportionate to a deck or fencing business's needs.",
  },
];
for (const c of profiles) {
  children.push(
    h3(c.name),
    p("Target segment: " + c.segment, { italics: true }),
    p("Pricing model: " + c.pricing),
    p("Verdict: " + c.verdict)
  );
}

children.push(
  h2("Positioning Summary"),
  p("No incumbent combines (a) credible, granular, production-rate-driven unit cost data, (b) a fast modern estimating workflow, and (c) a polished customer-facing proposal output, in a single product priced for small-to-medium trade contractors. RSMeans and Craftsman own data depth but not workflow or proposal UX. Jobber, Housecall Pro, and Buildertrend own workflow and UX but not estimating depth. TradeOS Cost Book's wedge is to be the only product that takes a contractor from “what am I pricing” to “here's a profitable proposal” in one motion, with the cost-data credibility of the legacy players and the UX of the modern SaaS players."),
  h2("Pricing Implication for TradeOS"),
  p("The competitive pricing landscape suggests a viable SaaS band between Craftsman's low-cost reference-book pricing and Jobber/Housecall Pro's per-user operations-platform pricing — roughly a per-user or per-org monthly subscription in the same general range as the service-platform incumbents, justified by estimating depth rather than scheduling/dispatch breadth. This avoids competing on RSMeans's enterprise price point (not credible at launch) while still pricing above a static reference book, since TradeOS delivers a workflow outcome (a sent proposal), not just a data lookup.")
);

// ============================================================
// CLOSING
// ============================================================
children.push(
  pageBreak(),
  h1("Closing: Recommendations & Assumptions Challenged"),
  h2("Architectural Recommendations"),
  bullet("Build on Postgres/Supabase from day one (UUID PKs, RLS-ready schema) — the schema in Deliverable 4 is designed to add multi-tenant RLS in Phase 2 without a breaking migration."),
  bullet("Model Assemblies as compositions referencing Cost Items, never as duplicated flat prices — this is the single most important data-integrity decision in the whole system, since it's what lets a single material price update ripple correctly through every assembly and every future estimate."),
  bullet("Snapshot pricing on estimate_line_items at the moment an estimate is finalized — a sent proposal must never silently reprice itself."),
  bullet("Separate the human-readable cost book code from the UUID primary key so the visible cost book hierarchy can be reorganized without breaking data."),
  h2("Assumptions Challenged"),
  bullet("“Contractors want a true a la carte line-item cost book like RSMeans” — challenged: most small-to-medium contractors want speed and a defensible price, not a 500-line cost breakdown. The Estimate Engine should default to assembly-level pricing in the proposal UI, with line-item detail available but collapsed by default."),
  bullet("“AI-assisted estimating (Phase 4) should come early to differentiate” — challenged: AI suggestions are only as good as the underlying cost data; sequencing AI before Phase 3's multi-trade data depth risks shipping a flashy feature on top of a thin, untrustworthy cost book. Data depth must precede AI assistance."),
  bullet("“Supplier integrations are a Phase 1 must-have” — challenged: manual monthly/quarterly price review (Deliverable 6) is sufficient to launch credibly; live supplier feeds add real integration complexity and vendor-relationship overhead that isn't justified until there's a customer base to demand it."),
  h2("Immediate Next Step"),
  p("Build Phase 1 (MVP) against the schema and V1 category content in this document: a single-org cost book, manual data entry through an Admin Dashboard, markup-mode Estimate Engine, and PDF proposal generation for the 9 priority trades. Validate the core loop with a handful of pilot contractors before investing in Phase 2's multi-tenant and assemblies work.")
);

// ============================================================
// BUILD DOCUMENT
// ============================================================

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: COLOR_PRIMARY },
        paragraph: { spacing: { before: 360, after: 240 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: COLOR_ACCENT },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: "404040" },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: "bullets",
        levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ],
  },
  sections: [{
    properties: {
      page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } },
    },
    headers: {
      default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "TradeOS Cost Book — Planning Document", size: 16, color: "808080" })] })] }),
    },
    footers: {
      default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
        new TextRun({ text: "Page ", size: 16, color: "808080" }),
        new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "808080" }),
      ] })] }),
    },
    children,
  }],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(__dirname + "/TradeOS-CostBook-Architecture.docx", buffer);
  console.log("Document written.");
});
