// Legacy one-off wireframe document generator. It predates the RC1
// source-of-truth docs under docs/*.md and is not current implementation truth.
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat,
  TableOfContents, HeadingLevel, BorderStyle, WidthType, ShadingType,
  VerticalAlign, PageNumber, PageBreak,
} = require("docx");

const PAGE_W = 12240, PAGE_H = 15840, MARGIN = 1440;
const CONTENT_W = PAGE_W - MARGIN * 2;

const COLOR_PRIMARY = "1F3B57";
const COLOR_ACCENT = "2E75B6";
const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const cellBorders = { top: border, bottom: border, left: border, right: border };

function h1(text) { return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] }); }
function h2(text) { return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] }); }
function h3(text) { return new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(text)] }); }
function p(text, opts = {}) { return new Paragraph({ children: [new TextRun({ text, ...opts })], spacing: { after: 160 } }); }
function bullet(text, level = 0) {
  return new Paragraph({ numbering: { reference: "bullets", level }, children: [new TextRun(text)], spacing: { after: 60 } });
}
function numbered(text, level = 0) {
  return new Paragraph({ numbering: { reference: "numbers", level }, children: [new TextRun(text)], spacing: { after: 60 } });
}
function code(text) {
  return new Paragraph({
    children: [new TextRun({ text, font: "Courier New", size: 18 })],
    spacing: { after: 0 },
  });
}
function codeBlock(lines, opts = {}) {
  return new Paragraph({
    children: lines.flatMap((line, i) => i === 0 ? [new TextRun({ text: line, font: "Courier New", size: opts.size || 18 })] : [new TextRun({ text: line, font: "Courier New", size: opts.size || 18, break: 1 })]),
    spacing: { before: 120, after: 200 },
    border: { left: { style: BorderStyle.SINGLE, size: 12, color: COLOR_ACCENT, space: 8 } },
    indent: { left: 200 },
    shading: { fill: "F7F9FB", type: ShadingType.CLEAR },
  });
}
function pageBreak() { return new Paragraph({ children: [new PageBreak()] }); }

function makeTable(headerRow, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  const scale = CONTENT_W / total;
  const colW = widths.map((w) => Math.round(w * scale));
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

const children = [];

// ============================================================
// TITLE PAGE
// ============================================================
children.push(
  new Paragraph({ spacing: { before: 2000 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "TradeOS Cost Book", bold: true, size: 64, color: COLOR_PRIMARY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 200 }, children: [new TextRun({ text: "Wireframe (Wiretree) & Module Specification", size: 32, color: COLOR_ACCENT })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 600 }, children: [new TextRun({ text: "UI/UX Sitemap, User Flows & Systems Architecture Blueprint for the MVP", size: 24, italics: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1200 }, children: [new TextRun({ text: "v1.0 — Pre-Development Specification", size: 22 })] }),
  pageBreak(),
  h1("Table of Contents"),
  new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }),
  pageBreak()
);

children.push(
  h1("Introduction"),
  p("This document is the pre-development blueprint for the TradeOS Cost Book MVP, companion to the Architecture & Planning Document (TradeOS-CostBook-Architecture.docx). It defines two things before any code is written:"),
  numbered("A wiretree (sitemap) of every major page/view in the MVP, the user flows that connect them, and per-page annotations of purpose, key UI elements, and critical actions."),
  numbered("A detailed module specification — purpose, inputs/outputs, data model, key functions/APIs, and dependencies — for each core system module, including the eight required modules and four proposed additions (Region & Pricing Adjustments, Supplier Integrations, Change Orders, Reporting & Analytics)."),
  p("All data model references map to the SQL schema already defined at db/migrations/0001_init_schema.sql in this repository.")
);

// ============================================================
// DELIVERABLE 1 — WIREFRAME / WIRETREE
// ============================================================
children.push(pageBreak(), h1("Deliverable 1 — Wireframe (Wiretree) Specification"));

children.push(
  h2("Site Tree"),
  p("Top-level sections and their sub-pages for the MVP. Indentation indicates parent/child navigation depth."),
  codeBlock([
    "Login / Onboarding",
    "├─ Sign In",
    "├─ Sign Up / Create Organization",
    "└─ Onboarding Wizard (company profile, region, default overhead/profit)",
    "",
    "Dashboard (home after login)",
    "├─ Active Estimates summary",
    "├─ Recent Proposals (sent/approved/rejected)",
    "└─ Quick Actions (New Estimate, New Customer, New Project)",
    "",
    "Cost Book",
    "├─ Divisions (e.g. Sitework, Concrete, Framing...)",
    "│   └─ Categories (e.g. Excavation)",
    "│       └─ Subcategories (e.g. Residential Excavation)",
    "│           └─ Cost Items (e.g. Excavation Per Cubic Yard)",
    "│               └─ Cost Item Detail/Edit",
    "├─ Assemblies",
    "│   └─ Assembly Detail/Editor (composed cost items)",
    "├─ Materials",
    "│   └─ Material Detail/Edit",
    "├─ Labor Rates",
    "│   └─ Labor Rate Detail/Edit",
    "├─ Equipment",
    "│   └─ Equipment Detail/Edit",
    "└─ Subcontractors",
    "    └─ Subcontractor Detail/Edit",
    "",
    "Customers & Projects",
    "├─ Customers List",
    "│   └─ Customer Detail (contact info, project history)",
    "└─ Projects List",
    "    └─ Project Detail",
    "        └─ Estimates (versions) for this project",
    "",
    "Estimate Builder",
    "├─ Estimate Detail / Line Item Editor",
    "├─ Cost Item / Assembly Picker (modal, browses Cost Book)",
    "├─ Overhead & Profit Panel (markup % or target margin %)",
    "└─ Estimate Summary (subtotal, overhead, profit, total)",
    "",
    "Proposal",
    "├─ Proposal Preview (customer-facing rendering)",
    "├─ Proposal Send (email / link / e-signature)",
    "└─ Proposal Status Tracking (sent, viewed, signed)",
    "",
    "Settings / Admin",
    "├─ Company Profile (branding, default overhead %, default profit %)",
    "├─ Users & Permissions",
    "├─ Regions & Pricing Adjustments",
    "├─ Supplier Integrations",
    "└─ Billing / Subscription",
  ]),
);

children.push(
  h2("Primary User Flows"),
  h3("Flow A — Create and Send an Estimate (core MVP loop)"),
  numbered("Dashboard → “New Estimate” → select or create Customer → select or create Project."),
  numbered("Estimate Builder opens empty → Cost Item / Assembly Picker modal → browse Cost Book by Division → Category → Subcategory, or search by name/code."),
  numbered("Select a cost item or assembly → enter Quantity → line item is added with computed unit_cost and line_cost."),
  numbered("Repeat for all scope items; line items accumulate in the Estimate Summary panel."),
  numbered("Open Overhead & Profit Panel → choose Markup mode or Target Margin mode → enter percentage → Estimate Summary recalculates subtotal, overhead, profit, and total."),
  numbered("Click “Preview Proposal” → Proposal Preview renders the customer-facing version (line-item detail collapsed by default, per Closing recommendations in the Architecture doc)."),
  numbered("Click “Send” → choose delivery method (email link, PDF attachment, or e-signature request) → Proposal Status moves to “Sent” and is tracked on the Project Detail page."),

  h3("Flow B — Browse and Edit the Cost Book (Admin)"),
  numbered("Settings/Admin or Cost Book nav → Divisions list."),
  numbered("Drill into a Division → Categories → Subcategories → Cost Items list for that subcategory."),
  numbered("Select a Cost Item → Detail/Edit view → adjust production_rate, or change which labor_rate_id / material_id / equipment_id it references."),
  numbered("Save → change is immediately reflected in any future estimate; existing sent estimates are unaffected (unit_cost snapshot)."),

  h3("Flow C — Build an Assembly"),
  numbered("Cost Book → Assemblies → “New Assembly” → enter code, name, unit_of_measure."),
  numbered("Add Assembly Items: search and add existing Cost Items (or nested Assemblies) with a quantity_per_unit for each."),
  numbered("Save → Assembly now appears in the Cost Item / Assembly Picker for use in any Estimate."),

  h3("Flow D — Onboarding a New Organization"),
  numbered("Sign Up → create Organization (name, default region)."),
  numbered("Onboarding Wizard: set default overhead % and profit %, confirm or adjust regional labor/material indices."),
  numbered("Wizard offers to seed the org's Cost Book from the V1 category starter content (Deliverable 5 of the Architecture doc) for the trades the contractor selects."),
  numbered("Land on Dashboard with a pre-populated, editable Cost Book ready for the first estimate.")
);

const pageAnnotations = [
  ["Login / Sign In", "Authenticate an existing user into their organization.", "Email/password or SSO fields, “Forgot password” link", "Submit credentials → redirect to Dashboard"],
  ["Sign Up / Create Organization", "Create a new tenant (organization) and first admin user.", "Org name field, admin email/password, region selector", "Create org → trigger Onboarding Wizard"],
  ["Onboarding Wizard", "Capture company defaults and seed starter Cost Book content.", "Stepper UI: company profile, region, default overhead/profit %, trade selection checklist", "Finish → seed Cost Book → land on Dashboard"],
  ["Dashboard", "At-a-glance view of active work and fast entry points.", "Summary cards (active estimates, recent proposals), quick-action buttons", "New Estimate / New Customer / New Project buttons"],
  ["Cost Book — Divisions/Categories/Subcategories", "Browse the priced hierarchy.", "Nested list/tree view, breadcrumb navigation, search bar", "Drill into a node; “Add Cost Item” at the Subcategory level"],
  ["Cost Item Detail/Edit", "View or edit a single priced line item.", "Form: code, name, unit_of_measure, production_rate, linked labor/material/equipment/subcontractor pickers, is_active toggle", "Save, Deactivate, Delete (soft, if unused)"],
  ["Assemblies List / Assembly Editor", "Manage composed, reusable bundles of cost items.", "List with search; editor has a table of assembly_items rows (cost item or nested assembly, quantity_per_unit)", "Add/remove assembly item rows, reorder, Save"],
  ["Materials List / Material Detail", "Manage raw material pricing.", "Table list (sku, name, unit_cost, supplier); detail form for edit", "Bulk import button, Save, mark last_price_update"],
  ["Labor Rates List / Detail", "Manage trade labor pricing.", "Table list (trade, base_hourly_rate, burden_pct, region); detail form", "Save; region override picker"],
  ["Equipment List / Detail", "Manage equipment ownership/operating cost models.", "Table list; detail form with ownership_cost_per_hour, operating_cost_per_hour, daily_rate", "Save"],
  ["Customers List / Customer Detail", "Manage client records and see their project history.", "Searchable table; detail view with contact info and linked Projects list", "New Customer, Edit, view linked Projects"],
  ["Projects List / Project Detail", "Manage jobs/opportunities and their estimate versions.", "Table list with status filter; detail view listing all Estimate versions for the project", "New Project, status change, New Estimate (creates next version)"],
  ["Estimate Builder", "The core estimating workspace: add line items, see running totals.", "Line item table, “Add Cost Item/Assembly” button (opens Picker modal), Overhead & Profit panel, running Estimate Summary", "Add/remove/edit line item, change pricing mode, Save Draft, Preview Proposal"],
  ["Cost Item / Assembly Picker (modal)", "Fast search/browse to add scope to an estimate.", "Search bar, Division/Category filter tabs, results list with unit and current computed cost shown", "Select → enter quantity inline → Add to Estimate"],
  ["Proposal Preview", "Customer-facing rendering of the finalized estimate.", "Branded header, line items (collapsed/lump-sum by default, expandable detail), total price, terms section", "Toggle detail view, Edit (back to Estimate Builder), Send"],
  ["Proposal Send", "Choose delivery method and dispatch the proposal.", "Delivery method radio (email link / PDF / e-signature), recipient email field, message box", "Send → status updates to Sent on Project Detail"],
  ["Settings — Company Profile", "Org-wide defaults and branding.", "Logo upload, default overhead %/profit % fields, default region", "Save"],
  ["Settings — Users & Permissions", "Manage team access (Phase 2 multi-user).", "User table with role dropdown (Admin/Estimator/Viewer), invite button", "Invite user, change role, deactivate user"],
  ["Settings — Regions & Pricing Adjustments", "Manage regional labor/material index multipliers.", "Table of regions with labor_index, material_index fields", "Add region, edit index values"],
  ["Settings — Supplier Integrations", "Configure material price feed sources (Phase 2+).", "Supplier list, connection status, api_integration_key field (masked)", "Connect supplier, trigger manual sync, review pending price deltas"],
];
children.push(
  h2("Page-by-Page Annotations"),
  makeTable(["Page / View", "Primary Purpose", "Key UI Elements", "Critical Actions"], pageAnnotations, [1900, 2200, 2700, 2560])
);

// ============================================================
// DELIVERABLE 2 — MODULE SPECIFICATION
// ============================================================
children.push(pageBreak(), h1("Deliverable 2 — Module Specification"));
children.push(
  p("Each module below specifies purpose, inputs/outputs, data model (mapped to db/migrations/0001_init_schema.sql), key functions/APIs, and dependencies. The eight required modules are followed by four proposed additions that the MVP and Phase 2 roadmap already assume exist as first-class concerns.")
);

function moduleSection(title, purpose, io, dataModel, functions, deps) {
  children.push(
    h2(title),
    h3("Purpose & Responsibilities"),
    ...(Array.isArray(purpose) ? purpose.map((t) => bullet(t)) : [p(purpose)]),
    h3("Inputs & Outputs"),
    p("Inputs: " + io.inputs),
    p("Outputs: " + io.outputs),
    h3("Data Model"),
    p("Primary table(s): " + dataModel.tables),
    p("Key fields: " + dataModel.fields),
    p("Relationships: " + dataModel.relationships),
    h3("Key Functions / APIs"),
    ...functions.map((f) => bullet(f)),
    h3("Dependencies"),
    ...deps.map((d) => bullet(d))
  );
}

moduleSection(
  "1. Cost Database",
  [
    "Owns the Division → Category → Subcategory → Cost Item hierarchy that every other pricing module ultimately rolls up into.",
    "Stores the atomic priced cost_item record, which references at most one of labor_rate_id / material_id / equipment_id / subcontractor_id directly (composite pricing happens through Assemblies, not by stacking multiple references on one cost item).",
    "Surfaces search and browse access to the cost book for the Estimate Builder and Admin Dashboard.",
  ],
  { inputs: "Division/Category/Subcategory definitions; raw labor/material/equipment/subcontractor records to link against", outputs: "Queryable, versioned cost items with a computed unit cost on demand" },
  { tables: "divisions, categories, subcategories, cost_items", fields: "code, name, sort_order (hierarchy); unit_of_measure, production_rate, is_active, FK references (cost_items)", relationships: "cost_items.subcategory_id → subcategories → categories → divisions; cost_items references labor_rates/materials/equipment/subcontractors" },
  [
    "createCostItem(subcategoryId, fields) / updateCostItem(id, fields) / deactivateCostItem(id)",
    "getCostItemUnitCost(id, regionId?) — computes current unit cost via the Formula Engine using whichever of labor/material/equipment it references",
    "searchCostItems(query, filters) — powers the Cost Item / Assembly Picker",
    "listHierarchy(divisionId?) — powers Cost Book browse pages",
  ],
  ["Labor Database, Material Database, Equipment Database (cost items reference these)", "Region & Pricing Adjustments (for regionally adjusted unit cost)", "Consumed by: Assemblies Database, Estimate Engine, Admin Dashboard"]
);

moduleSection(
  "2. Labor Database",
  [
    "Stores trade labor classifications (e.g. Carpenter, Laborer, Operator) with base hourly rate and burden percentage.",
    "Applies regional modifiers via Region & Pricing Adjustments to produce a burdened, region-adjusted labor rate.",
  ],
  { inputs: "Base hourly rate per trade, burden % (taxes/insurance/benefits), optional region link", outputs: "Burdened Labor Rate = Base Hourly Rate × (1 + Burden %), optionally × region labor_index" },
  { tables: "labor_rates", fields: "trade, base_hourly_rate, burden_pct, region_id", relationships: "labor_rates.region_id → regions; referenced by cost_items.labor_rate_id" },
  [
    "createLaborRate(fields) / updateLaborRate(id, fields)",
    "getBurdenedRate(laborRateId, regionId?) — core formula function used by the Estimate Engine",
    "listLaborRatesByTrade(trade)",
  ],
  ["Region & Pricing Adjustments (regional index)", "Consumed by: Cost Database, Estimate Engine, Admin Dashboard"]
);

moduleSection(
  "3. Material Database",
  [
    "Tracks raw material pricing: SKU, unit cost, unit of measure, waste factor, and the supplier it was sourced from.",
    "Maintains last_price_update for staleness tracking, feeding the Pricing Update Strategy cadence (monthly/quarterly/annual review).",
  ],
  { inputs: "SKU, unit_cost, waste_factor_pct, supplier_id, manual or supplier-feed price updates", outputs: "Adjusted Material Cost = Quantity × Unit Cost × (1 + Waste Factor %)" },
  { tables: "materials, suppliers", fields: "sku, name, unit_of_measure, unit_cost, waste_factor_pct, supplier_id, last_price_update", relationships: "materials.supplier_id → suppliers; referenced by cost_items.material_id" },
  [
    "createMaterial(fields) / updateMaterial(id, fields)",
    "getAdjustedMaterialCost(materialId, quantity) — core formula function",
    "flagStalePrices(staleSinceDays) — supports the monthly/quarterly pricing review process",
    "bulkImportMaterials(csv) / exportMaterials()",
  ],
  ["Supplier Integrations (price source)", "Consumed by: Cost Database, Estimate Engine, Admin Dashboard"]
);

moduleSection(
  "4. Equipment Database",
  [
    "Models equipment cost as ownership cost (depreciation, insurance, storage) plus operating cost (fuel, maintenance, consumables), or a flat negotiated daily_rate for rented equipment.",
  ],
  { inputs: "Purchase price, salvage value, useful life hours, insurance/storage cost, fuel/maintenance cost, optional flat daily_rate", outputs: "Hourly Cost = Ownership Cost/hr + Operating Cost/hr; Daily Cost = Hourly Cost × Billable Hours/day (or daily_rate)" },
  { tables: "equipment", fields: "name, ownership_cost_per_hour, operating_cost_per_hour, daily_rate", relationships: "referenced by cost_items.equipment_id" },
  [
    "createEquipment(fields) / updateEquipment(id, fields)",
    "getHourlyCost(equipmentId) / getDailyCost(equipmentId)",
  ],
  ["Consumed by: Cost Database, Estimate Engine, Admin Dashboard"]
);

moduleSection(
  "5. Assemblies Database",
  [
    "Composes multiple cost items (and, recursively, other assemblies) into a single sellable unit (e.g. “Composite Deck, 12x16”), so pricing is never duplicated — only referenced and rolled up.",
    "Supports nested assemblies via assembly_items.child_assembly_id, guarded by the schema's check constraint that each assembly_item references exactly one of a cost_item or a child_assembly.",
  ],
  { inputs: "Cost item / child assembly references with quantity_per_unit", outputs: "Rolled-up assembly unit cost = Σ(child unit cost × quantity_per_unit), recursively resolved" },
  { tables: "assemblies, assembly_items", fields: "code, name, unit_of_measure (assemblies); quantity_per_unit, sort_order (assembly_items)", relationships: "assembly_items.assembly_id → assemblies; assembly_items references cost_items OR a child assembly (never both)" },
  [
    "createAssembly(fields) / addAssemblyItem(assemblyId, costItemId|childAssemblyId, quantityPerUnit)",
    "getAssemblyUnitCost(assemblyId, regionId?) — recursive roll-up, must guard against circular references",
    "searchAssemblies(query)",
  ],
  ["Cost Database (assembly_items reference cost_items)", "Consumed by: Estimate Engine, Admin Dashboard"]
);

moduleSection(
  "6. Estimate Engine",
  [
    "Applies contractor-entered quantities to selected cost items/assemblies, then sequences Labor → Material → Equipment → Overhead → Profit calculations to produce a final sell price.",
    "Supports two profit modes: markup-driven and target-margin-driven, per the Architecture doc's Deliverable 3 formulas.",
  ],
  { inputs: "Selected cost_item_id/assembly_id rows with quantities; overhead_pct; profit_pct or target_margin_pct", outputs: "estimate_line_items (quantity, snapshot unit_cost, line_cost); estimates.subtotal_cost and total_price" },
  { tables: "estimates, estimate_line_items", fields: "version, status, overhead_pct, profit_pct, target_margin_pct, subtotal_cost, total_price (estimates); quantity, unit_cost, line_cost (estimate_line_items)", relationships: "estimates.project_id → projects; estimate_line_items.estimate_id → estimates; each line item references exactly one of cost_item_id or assembly_id" },
  [
    "addLineItem(estimateId, costItemId|assemblyId, quantity) — snapshots unit_cost at add time",
    "recalculateEstimate(estimateId) — re-sums line items, applies overhead and profit per the formula sequence",
    "setPricingMode(estimateId, 'markup'|'targetMargin', value)",
    "finalizeEstimate(estimateId) — locks the unit_cost snapshots so a sent proposal never silently reprices",
  ],
  ["Cost Database, Assemblies Database (source of unit costs)", "Labor/Material/Equipment Databases (transitively, via Cost Database)", "Consumed by: Proposal Generator"]
);

moduleSection(
  "7. Proposal Generator",
  [
    "Converts a finalized estimate into a branded, customer-facing document — lump-sum by default with optional expandable line-item detail, per the Closing recommendation in the Architecture doc.",
    "Supports multiple output formats (PDF, web link) and delivery methods (email, e-signature request).",
  ],
  { inputs: "Finalized estimate, company branding/template, customer/project info, chosen detail level", outputs: "Rendered PDF/web proposal; e-signature-ready document; delivery status events" },
  { tables: "estimates (read), customers, projects (read); a proposal_deliveries audit table is recommended (not yet in 0001_init_schema.sql) to track sent/viewed/signed status", fields: "template choice, detail-level flag, delivery method, status timestamps", relationships: "reads estimates and estimate_line_items; writes delivery/status records" },
  [
    "generateProposal(estimateId, templateOptions) — returns a renderable document",
    "sendProposal(proposalId, method, recipient) — email link, PDF attachment, or e-signature request",
    "getProposalStatus(proposalId) — sent / viewed / signed / rejected",
  ],
  ["Estimate Engine (source data)", "Admin Dashboard (branding/template configuration)", "External e-signature API (Phase 2)"]
);

moduleSection(
  "8. Admin Dashboard",
  [
    "Control plane for managing all pricing data, users, regions, and company-wide overhead/profit defaults.",
    "The only module with write access to every other module's underlying tables — all bulk edits, imports, and configuration changes flow through here.",
  ],
  { inputs: "User edits via UI forms, bulk CSV imports, supplier feed configuration, role/permission changes", outputs: "Updated records across Cost/Labor/Material/Equipment/Assemblies Databases; audit trail of changes" },
  { tables: "organizations (company profile/defaults); cross-cutting writes to all other modules' tables", fields: "name, region_code (organizations); role/permission fields (Phase 2 users table, not yet in 0001_init_schema.sql)", relationships: "organizations.id is the org_id scoping column present on nearly every other table in the schema" },
  [
    "updateOrgDefaults(orgId, { overhead_pct, profit_pct, region_id })",
    "inviteUser(orgId, email, role) / updateUserRole(userId, role) — Phase 2",
    "bulkImport(entityType, csv) / bulkExport(entityType)",
    "configureSupplierFeed(supplierId, apiIntegrationKey)",
  ],
  ["Writes to: Cost, Labor, Material, Equipment, Assemblies Databases, Supplier Integrations, Region & Pricing Adjustments"]
);

children.push(h2("Proposed Additional Modules"));

moduleSection(
  "9. Region & Pricing Adjustments",
  [
    "Maintains regional labor_index and material_index multipliers so a single base cost book can be priced correctly across different geographic markets.",
    "Critical as soon as a contractor operates in more than one region, or as soon as cross-org benchmarking (Phase 5) requires regional normalization.",
  ],
  { inputs: "Regional labor/material index values, sourced from manual entry initially and later from aggregated cross-org data (Phase 5)", outputs: "Multipliers applied to base labor/material costs during Estimate Engine calculation" },
  { tables: "regions", fields: "code, name, labor_index, material_index", relationships: "regions referenced by labor_rates.region_id and projects.region_id" },
  [
    "createRegion(fields) / updateRegionIndices(regionId, laborIndex, materialIndex)",
    "getRegionalAdjustedRate(baseRate, regionId, indexType)",
  ],
  ["Consumed by: Labor Database, Material Database, Estimate Engine, Admin Dashboard"]
);

moduleSection(
  "10. Supplier Integrations",
  [
    "Manages connections to material suppliers for pull-based price feeds (Phase 2+), reducing the manual material price-review burden described in the Architecture doc's Pricing Update Strategy.",
    "MVP ships with this module as configuration-only (manual entry); live feed ingestion is explicitly Phase 2, per the Closing section's challenged assumption that supplier integrations are not a Phase 1 must-have.",
  ],
  { inputs: "Supplier contact info, api_integration_key, feed schedule", outputs: "Proposed material price deltas queued for review (not auto-applied)" },
  { tables: "suppliers", fields: "name, contact_email, contact_phone, website, api_integration_key", relationships: "suppliers referenced by materials.supplier_id" },
  [
    "createSupplier(fields) / configureFeed(supplierId, apiIntegrationKey, schedule)",
    "syncSupplierPrices(supplierId) — queues proposed deltas, does not auto-apply",
    "reviewPriceDeltas(supplierId) — admin approves/rejects queued changes",
  ],
  ["Consumed by: Material Database", "Depends on: external supplier APIs (Phase 2)"]
);

moduleSection(
  "11. Change Orders",
  [
    "Tracks post-contract scope changes against a project, each composed of its own line items, separate from but linked to the originating estimate.",
  ],
  { inputs: "Project reference, originating estimate (optional), description, line items with quantities", outputs: "change_orders record with computed amount; updated project scope/total" },
  { tables: "change_orders, change_order_line_items", fields: "co_number, description, status, amount (change_orders); cost_item_id, quantity, unit_cost, line_cost (line items)", relationships: "change_orders.project_id → projects; change_orders.estimate_id → estimates (optional); unique(project_id, co_number)" },
  [
    "createChangeOrder(projectId, description) / addChangeOrderLineItem(changeOrderId, costItemId, quantity)",
    "approveChangeOrder(changeOrderId) — updates status and locks amount",
  ],
  ["Cost Database (line item pricing)", "Consumed by: Project Detail page, Reporting & Analytics"]
);

moduleSection(
  "12. Reporting & Analytics",
  [
    "Surfaces usage and performance analytics across estimates, cost items, and proposals — win/loss rates, most-used cost items, margin trends — feeding the Phase 3 cost-item usage analysis and the Phase 6+ benchmarking dataset.",
    "Not required for the core MVP loop (select → estimate → propose), but is assumed by the Implementation Roadmap as early as Phase 3 (“usage analytics to find unused or missing cost items”).",
  ],
  { inputs: "Read-only aggregation over estimates, estimate_line_items, projects, change_orders", outputs: "Dashboards/reports: cost item usage frequency, estimate-to-win conversion rate, margin trend over time" },
  { tables: "No new write tables required for MVP; reads across estimates, estimate_line_items, projects, cost_items", fields: "Aggregates only — no new persisted fields required initially", relationships: "Cross-cutting read access; future benchmark_aggregates table (Phase 5) is a materialized extension of this module" },
  [
    "getCostItemUsageReport(orgId, dateRange)",
    "getEstimateConversionReport(orgId, dateRange)",
    "getMarginTrendReport(orgId, dateRange)",
  ],
  ["Reads from: Estimate Engine, Cost Database, Change Orders"]
);

// ============================================================
// CLOSING
// ============================================================
children.push(
  pageBreak(),
  h1("Summary"),
  p("The wiretree above defines 9 top-level sections and roughly 20 distinct page/view types for the MVP — enough to support the four primary user flows (estimate creation, cost book administration, assembly building, and org onboarding) without overbuilding screens the MVP doesn't need yet (e.g. full reporting dashboards, change order UI, or supplier feed management are deferred to Phase 2+ per the page list, even though their modules are specified now)."),
  p("The module specification deliberately keeps the eight required modules' dependency direction one-way wherever possible — Labor/Material/Equipment → Cost Database → Assemblies → Estimate Engine → Proposal Generator — with the Admin Dashboard as the only module permitted to write across all of them. The four proposed additions (Region & Pricing Adjustments, Supplier Integrations, Change Orders, Reporting & Analytics) slot into this same dependency graph without requiring any of the eight core modules to change their public functions/APIs.")
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
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
          { level: 1, format: LevelFormat.BULLET, text: "–", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 360 } } } },
        ] },
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
      default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "TradeOS Cost Book — Wireframe & Module Specification", size: 16, color: "808080" })] })] }),
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
  fs.writeFileSync(__dirname + "/TradeOS-CostBook-Wireframe-Module-Spec.docx", buffer);
  console.log("Document written.");
});
