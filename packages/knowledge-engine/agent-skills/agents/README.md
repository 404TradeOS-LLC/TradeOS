# TradeOS Knowledge Engine - Worker Agents Catalog

This document defines the roles, prompts, inputs, outputs, Definitions of Done (DoD), and failure conditions for the 19 specialized worker agents operating in the Autonomous Knowledge Factory.

---

## 1. Core Generation Workers

### CostbookArchitect
* **Purpose**: Research contractor pricing and write new cost items.
* **Prompt**: Match prompts in `prompts/agents/agent-costbook-architect.md`.
* **Inputs**: Trade taxonomy, regional baseline files.
* **Outputs**: Raw costbook item array.
* **DoD**: Exactly 10 items conforming to `cost-item.schema.json`.
* **Failure Condition**: Missing cost columns, non-TitleCase names.

### AssemblyArchitect
* **Purpose**: Construct complex grouped assemblies linking cost items.
* **Prompt**: Match prompts in `prompts/agents/agent-assembly-builder.md`.
* **Inputs**: Deduplicated cost item database.
* **Outputs**: Assembly templates with scaled quantities and waste.
* **DoD**: Exactly 10 assemblies conforming to `assembly.schema.json`.
* **Failure Condition**: Orphan item references, missing waste adjustments.

### MaterialArchitect
* **Purpose**: Spec structural materials, sizes, and waste factors.
* **Inputs**: Raw scopes, manufacturer catalogs.
* **Outputs**: Material mapping files in `knowledge/materials/`.
* **DoD**: Validated size ranges and standard commercial units.
* **Failure Condition**: Standardizing non-commercial measurements.

### LaborArchitect
* **Purpose**: Map contractor labor trades and hourly rates.
* **Inputs**: Local prevailing wage indices, union agreements.
* **Outputs**: Wage scale JSON files in `knowledge/labor/`.
* **DoD**: Labor rate entries matching standard categories.
* **Failure Condition**: Underestimating crew base rates below local floors.

### EquipmentArchitect
* **Purpose**: Manage equipment catalogs, operating costs, and sizes.
* **Inputs**: Rental yard price sheets, operating specs.
* **Outputs**: Equipment rates in `knowledge/equipment/`.
* **DoD**: Rates matching hour/day/week terms with clear sizes.
* **Failure Condition**: Not specifying access width constraints.

### ProductionRateArchitect
* **Purpose**: Establish installation productivity outputs.
* **Inputs**: Historical project timesheets, estimator surveys.
* **Outputs**: Productivity maps in `knowledge/production-rates/`.
* **DoD**: Rates mapped by easy/standard/difficult multipliers.
* **Failure Condition**: Production speed exceeding physical capacity.

### CrewRecipeArchitect
* **Purpose**: Standardize crew combinations and equipment attachments.
* **Inputs**: Labor classifications, typical project scales.
* **Outputs**: Crew JSON files in `knowledge/crew-recipes/`.
* **DoD**: Roles and equipment lists paired for typical assemblies.
* **Failure Condition**: Invalid crew role references.

### SupplierMappingArchitect
* **Purpose**: Bind cost items to supplier products and SKUs.
* **Inputs**: Supplier API catalogs, public product pages.
* **Outputs**: Supplier mappings in `knowledge/supplier-mapping/`.
* **DoD**: Accurate mapping of internal item UUID to supplier SKU.
* **Failure Condition**: Broken product URLs, outdated prices.

### ProposalLanguageArchitect
* **Purpose**: Generate scope descriptions, exclusions, and warranty clauses.
* **Inputs**: Selected assemblies, contractor templates.
* **Outputs**: Proposal blocks in `knowledge/proposal-language/`.
* **DoD**: Template scopes and clear whitelisted exclusions.
* **Failure Condition**: Omit critical exclusions like post-work repairs.

---

## 2. Pipeline Processing Workers

### ValidationAgent
* **Purpose**: Execute JSON schema compliance checks.
* **Outputs**: Schema validation reports.
* **DoD**: All files validated against canonical schemas.

### NormalizationAgent
* **Purpose**: Enforce text casing, trailing whitespace, and unit maps.
* **DoD**: Clean item text and precise two-decimal numbers.

### PricingSanityAgent
* **Purpose**: Audit pricing against floors and suspicious ratios.
* **DoD**: Flagged warnings and recommended adjustments logged.

### DeduplicationAgent
* **Purpose**: Remove duplicate items using SequenceMatcher and numeric guards.
* **DoD**: Unique item catalog compiled with merge logs.

### TaxonomyAgent
* **Purpose**: Verify trade and subcategory routing compliance.
* **DoD**: All items mapped to standard categories.

---

## 3. Operations & Audit Workers

### MigrationAgent
* **Purpose**: Ingest legacy Excel/CSV datasets into staging.
* **DoD**: Raw logs mapped to raw items schemas.

### AuditAgent
* **Purpose**: Review historical evolution logs and verify checkpoints.
* **DoD**: Complete logs of approved commits.

### ReviewAgent
* **Purpose**: Execute peer evaluations and arborist QA checks.
* **DoD**: Approval state logged with comments.

### CoverageAgent
* **Purpose**: Measure taxonomy fill rates and compile coverage reports.
* **DoD**: Output compiled to docs/coverage-dashboard.md.

### ExportAgent
* **Purpose**: Package final JSON and transactional SQL migrations.
* **DoD**: Outputs written to exports/ folder.
