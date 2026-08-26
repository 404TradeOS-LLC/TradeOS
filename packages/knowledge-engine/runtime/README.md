# TradeOS Estimating App - Runtime Modules Catalog

> **HISTORICAL / SUPERSEDED (marked 2026-07-16).** None of the "engines" cataloged below exist as
> subdirectories or services under this package. The equivalent, currently-shipped concepts are
> implemented in `app/modules/knowledge-runtime/{loader,repository,matcher}.ts`, which is
> file-based, read-only, and does not write to Prisma/Supabase or call external AI APIs — see
> [`app/modules/knowledge-runtime/README.md`](../../../app/modules/knowledge-runtime/README.md).
> Current TradeOS AI behavior is **review-first, contractor-controlled, and service-bound**: no
> autonomous AI database writes, and no generated text is treated as authority. See
> [`docs/bible/VOLUME_3_ENGINEERING.md`](../../../docs/bible/VOLUME_3_ENGINEERING.md) and
> [`docs/bible/VOLUME_7_KNOWLEDGE_RUNTIME.md`](../../../docs/bible/VOLUME_7_KNOWLEDGE_RUNTIME.md).
> **This document must not be used as current implementation guidance.** It is preserved as
> historical design material. It also uses a shallow `knowledge/` path in its dependency lists;
> the real, on-disk path is `knowledge/knowledge/` — see
> [`packages/knowledge-engine/README.md`](../README.md).

This document defines the purpose, inputs, outputs, dependencies, failure conditions, and Definitions of Done (DoD) for the 10 real-time execution engines in the runtime integration layer.

---

## 1. Catalog of Runtime Modules

### trade-classifier/
* **Purpose**: Identify the primary construction trade and subcategory of a request.
* **Inputs**: Unstructured text, transcript, or image label.
* **Outputs**: Trade category (string) and confidence score.
* **Dependencies**: `knowledge/trade-taxonomy/taxonomy.md`.
* **Failure Condition**: Unidentified trade or confidence score below $0.50$.
* **DoD**: Correctly route incoming inputs to one of the 24 registered categories.

### scope-parser/
* **Purpose**: Parse raw input to extract dimensions, quantities, and material specs.
* **Inputs**: Normalized text string.
* **Outputs**: Structured parameters JSON (dimensions, materials, site constraints).
* **Dependencies**: `knowledge/normalization-rules/rules.md`.
* **Failure Condition**: Missing essential dimensions for estimation.
* **DoD**: Output conforms to parameters schema.

### assembly-matcher/
* **Purpose**: Query and match the scope parameters to the best assembly candidate.
* **Inputs**: Structured scope parameters.
* **Outputs**: Matched Assembly UUID.
* **Dependencies**: `knowledge/assemblies/` and `knowledge/reasoning/assembly-ranking.md`.
* **Failure Condition**: Low matching score ($<0.60$) or missing assembly files.
* **DoD**: Outputs valid UUID reference.

### cost-item-matcher/
* **Purpose**: Fetch and bind individual cost items to populate assemblies or fill loose requests.
* **Inputs**: Required material/labor specifications.
* **Outputs**: Matched Cost Item UUIDs.
* **Dependencies**: `knowledge/cost-items/` and `knowledge/reasoning/cost-item-ranking.md`.
* **Failure Condition**: Referencing deprecated or non-existent items.
* **DoD**: Binds items with correct priority (Exact $\rightarrow$ Near $\rightarrow$ Fallback).

### reasoning-engine/
* **Purpose**: Process logic rules, exclusions, assumptions, and regional constraints.
* **Inputs**: Matched assembly, site constraints.
* **Outputs**: Exclusions list, assumptions list, and warning flags.
* **Dependencies**: `knowledge/reasoning/reasoning.md`.
* **Failure Condition**: Violating safety or code constraints.
* **DoD**: Outputs clean structured contractual rules.

### proposal-engine/
* **Purpose**: Compile plain language proposal scope text templates.
* **Inputs**: Assembly ID, assumptions, exclusions.
* **Outputs**: Standardized scope document.
* **Dependencies**: `knowledge/proposal-language/`.
* **Failure Condition**: Missing warranty or primary scope descriptors.
* **DoD**: Conforms to `proposal-language.schema.json`.

### estimate-engine/
* **Purpose**: Calculate final pricing sums and scale line items based on quantities.
* **Inputs**: Assembly ID, user dimensions.
* **Outputs**: Total project cost.
* **Dependencies**: `pricing-engine` and `validation-engine`.
* **Failure Condition**: Mathematical rounding errors or calculation overflows.
* **DoD**: Formats final prices to two decimal places.

### pricing-engine/
* **Purpose**: Apply city multipliers and markup pricing algorithms.
* **Inputs**: Raw item costs, project zip code, markup percentages.
* **Outputs**: Adjusted contractor unit rates.
* **Dependencies**: Regional multiplier indexes.
* **Failure Condition**: Applying incorrect regional multipliers.
* **DoD**: Output rate reflects the adjusted local pricing.

### validation-engine/
* **Purpose**: Run runtime schema compliance and pricing sanity checks.
* **Inputs**: Output estimate and proposal draft.
* **Outputs**: Validation status (`PASSED | FLAGGED`).
* **Dependencies**: `knowledge/validation-rules/` and `knowledge/pricing-sanity/`.
* **Failure Condition**: Allowing invalid schema data to bypass checking.
* **DoD**: Verify that output matches schemas.

### confidence-engine/
* **Purpose**: Calculate the Overall Estimate Confidence score.
* **Inputs**: Confidence ratings of trade, assembly, and item matches.
* **Outputs**: Unified confidence score ($CS$).
* **Dependencies**: Confidence rules.
* **Failure Condition**: Returning confidence of 1.0 on unverified inputs.
* **DoD**: Score determines execution routing (Auto-approve $\rightarrow$ Stage Review $\rightarrow$ Reject).
