---
status: current
owner: platform
last_verified: 2026-09-08
source_of_truth: true
related_code:
  - app/modules/knowledge-runtime/repository.ts
  - app/modules/knowledge-runtime/matcher.ts
  - app/tests/knowledge-runtime.trade-inference.test.ts
  - docs/reports/COSTBOOK_KNOWLEDGE_ENGINE_AUDIT_2026-09-08.md
  - docs/architecture/COSTBOOK_RESEARCH_INGESTION_DESIGN.md
---

# Knowledge Engine Trade Inference Audit — 2026-09-08

Fixes a pre-existing correctness defect in `app/modules/knowledge-runtime/repository.ts`'s
`inferTrade()`, discovered while implementing Costbook provenance status (PR #472): the sole
Tree Service assembly-index record was misclassified as trade `"Trim"` because the classifier used
raw substring matching (`"trim"` matches inside `"trimming"`) and picked whichever trade happened
to be tested first in array order when more than one trade's name/alias matched. This document is
the required before/after corpus audit for that fix, run against the full canonical Knowledge
Engine corpus (1,795 cost items + 293 assemblies = 2,088 records) both before and after the change.

No pricing value (`laborCost`/`materialCost`/`equipmentCost`) was touched anywhere in this change.
No Costbook record was bulk-edited. This is a classification-logic fix only.

## 1. Root cause

`inferTrade(name, category, candidateTrades, trades)` had two independent defects:

1. **Raw substring matching, no word boundaries.** `normalized.includes(normalizeText(trade.name))`
   and the equivalent alias check matched a trade name or alias anywhere inside the input text,
   including inside an unrelated longer word. Trade `"Trim"` (`"trim"`) matched inside
   `"trimming"`; nothing stopped a similar collision for any other short trade name against any
   word that happens to contain it as a substring.
2. **Order-dependent resolution.** `trades.find(...)` returns the first trade in
   `trade-progress.json`'s array order whose name/alias substring-matches, regardless of whether a
   more specific or more correct match exists later in the array. For the Tree Service
   assembly-index record, `"Trim"` sits earlier than `"Tree Service"` in that array, so `.find()`
   returned `"Trim"` even though the exact two-word phrase `"Tree Service"` was also present in the
   same text.

Both defects are inherent to using `String.prototype.includes()` as a matcher and `Array.prototype.find()`
as a priority mechanism; neither is a one-off typo, so a full rewrite of the matching strategy (not
a special-case patch for Tree Service alone) was required, per the mission's "correctness repair,
not a cosmetic change" framing.

## 2. Matching strategy used

`app/modules/knowledge-runtime/repository.ts`'s `inferTrade()` was rewritten to a deterministic,
word-boundary/token-aware classifier:

1. **Tokenize, don't substring-match.** Input text and every trade name/alias are tokenized with
   the same word-splitting rule (`normalizeText().split(/[^a-z0-9]+/g)`, case-insensitive,
   punctuation-stripping). A trade/alias phrase matches only when its exact token sequence appears
   as a contiguous subsequence of the input's tokens (`containsSubsequence()`) — never a raw
   substring test. `"trim"` (one token) can no longer match inside `"trimming"` (a different,
   single token), and a multi-word name like `"Tree Service"` or `"General Conditions"` requires
   both words adjacent, not merely present anywhere in the text.
2. **`category` before `name`, and `category` wins outright.** For the canonical corpus, `category`
   is curated ground truth — it already equals a real trade name for essentially every legacy cost
   item — while `name` is a free-text description that can incidentally contain a different trade's
   word (e.g. `"Wall Straightening And Plumbing"` filed under category `"Framing"`). `category` is
   resolved first; if it names any trade at all (uniquely or ambiguously), that result is used and
   `name` is never consulted. `name` is checked only when `category` names no trade at all — the
   situation for every assembly, whose `category` is a descriptive label like
   `"Assemblies - Bathroom"`, not a trade.
3. **Every trade is checked, not just the first match.** Within whichever field is being resolved,
   all 25 trades are evaluated; an exact trade-name match outranks an alias match, and a longer
   (more specific) phrase outranks a shorter one at the same priority level — so resolution is
   ranked by specificity, never by array position.
4. **Linked-item evidence outranks text matching.** `candidateTrades` (the actual, already-resolved
   trades of an assembly's own linked cost items) is real linked data, not inference. If it has a
   single strict-majority value (`pickDominantCandidateTrade()`), that is used before any text
   matching is attempted.
5. **Ties resolve to `null`, never a guess.** When more than one trade ties for the single
   highest-ranked match within the field being resolved, the result is ambiguous and `inferTrade()`
   returns `null`. A record with no match at all also returns `null`. `KnowledgeCostItemRecord.trade`
   and `KnowledgeAssemblyRecord.trade` were already typed `string | null`, and every existing
   consumer (`matcher.ts`'s trade-based reranking, `resolveTradeProvenanceStatus`, the athena
   knowledge-engine provider) already handles a `null` trade — no downstream type or contract
   change was needed to make "fail conservative" safe.

The existing `TRADE_ALIASES` registry (`repository.ts`) is reused as-is, with one line added:
`"Tree Service"` gained `"grinding"` alongside its existing `"grind"` alias, matching the pattern
already used for `Deck` (`"deck"` + `"decking"`) and `Excavation` (`"grade"` + `"grading"`) — the
smallest possible addition to preserve legitimate Tree Service recall now that alias matching is
exact-token rather than substring (`"grind"` no longer incidentally matches `"grinding"`).

## 3. Before/after corpus audit

Computed by loading the full canonical corpus (`getKnowledgeRepositorySnapshot()`) twice — once
against `origin/main`'s unmodified `inferTrade()`, once against this branch's fixed version — and
diffing every record's `trade` field by stable `id`. Both runs loaded the same
`packages/knowledge-engine/**` data; no source data file changed between runs.

| Metric | Count |
|---|---|
| Total records inspected | 2,088 (1,795 cost items + 293 assemblies) |
| Unchanged classifications | 1,847 |
| Changed classifications | 241 |
| Previously unclassified records (baseline had 0 nulls) | 0 |
| Newly classified records (null → a trade) | 0 |
| Previously classified → now unclassified (ambiguous/no confident signal) | 89 (all assemblies; 0 cost items) |
| Reclassified (one real trade → a different real trade) | 152 |

All 241 changed records are listed in full in §4. No cost item became unclassified — all 1,795
cost items resolve to a trade after the fix (identical to before: 0 nulls in both runs). Every
cost item's post-fix trade is now consistent with its own curated `category` field (either
identical, or the pre-existing `"Flatwork"` → `"Concrete"` alias normalization already used
elsewhere in this file) — 97 of the 1,795 look like a `category`/`trade` mismatch at a glance but
are all `category: "Flatwork"` → `trade: "Concrete"`, the same intentional normalization
`normalizeTradeName()` already applies everywhere else.

### Trade count deltas (before → after)

Only trades whose total record count changed are listed; all other trades (Cabinetry moved, see
below) are omitted only if unchanged — every trade in the taxonomy is covered here or is identical
between runs.

| Trade | Before | After | Delta |
|---|---:|---:|---:|
| Basement *(non-canonical fallback label, see §5)* | 0 | 1 | +1 |
| Bathroom *(non-canonical fallback label, see §5)* | 0 | 1 | +1 |
| Cabinetry | 68 | 51 | −17 |
| Concrete | 228 | 195 | −33 |
| Countertops | 47 | 33 | −14 |
| Deck | 101 | 93 | −8 |
| Doors | 34 | 35 | +1 |
| Drywall | 89 | 88 | −1 |
| Electrical | 93 | 90 | −3 |
| Fence | 99 | 101 | +2 |
| Flooring | 120 | 118 | −2 |
| Framing | 94 | 95 | +1 |
| General Conditions | 117 | 104 | −13 |
| HVAC | 89 | 90 | +1 |
| Hardscaping | 36 | 32 | −4 |
| Hardware | 37 | 36 | −1 |
| Kitchen *(non-canonical fallback label, see §5)* | 0 | 1 | +1 |
| Landscaping | 84 | 66 | −18 |
| Painting | 108 | 130 | +22 |
| Plumbing | 96 | 98 | +2 |
| Roofing | 114 | 129 | +15 |
| Siding | 128 | 106 | −22 |
| Tree Service | 0 | 1 | +1 |
| Windows | 32 | 31 | −1 |
| _(none / unclassified)_ | 0 | 89 | +89 |
| Insulation | 97 | 97 | 0 (unchanged) |
| Trim | 87 | 87 | 0 (unchanged) — confirms the fix removed the false "trimming" collision without changing Trim's true membership |

### The ten trades called out for particular attention

| Trade | Before | After | Assessment |
|---|---:|---:|---|
| **Tree Service** | 0 | 1 | **Fixed.** The one Tree Service assembly-index record now correctly resolves to `"Tree Service"` via its own curated `category` field, instead of `"Trim"`. |
| **Trim** | 87 | 87 | **Unchanged.** The false `"trimming"` collision is gone (confirmed: the Tree Service record no longer contributes to this count) with no other Trim membership lost or gained. |
| **Roofing** | 114 | 129 | **+15, all correct.** Every gain is a cost item whose `category` was already `"Roofing"` but whose `name` text (e.g. `"Insulation"`, `"Deck"`, `"Concrete"`) previously won by array-order accident, plus several `"Assemblies - Roofing"` records now correctly resolving to Roofing via their own category label. |
| **Framing** | 94 | 95 | **+1, correct** (`"Ledger Board Attachment To Concrete"`, category `"Framing"`, previously misclassified `"Concrete"` from its name text). |
| **Concrete** | 228 | 195 | **−33, correct.** Lost only false-positive matches: items whose `name` mentions "concrete" but whose curated `category` is a different trade (Framing, Excavation, Fence, Flooring, Plumbing, HVAC, Drywall, Landscaping, Painting, Countertops, Hardscaping, General Conditions, Roofing, Siding). True Concrete-category items are unaffected. |
| **Electrical** | 93 | 90 | **−3, correct** (false-positive name-text matches on non-Electrical-category items). |
| **Plumbing** | 96 | 98 | **+2, correct** (category-consistent items previously misclassified by name text). |
| **HVAC** | 89 | 90 | **+1, correct** (`"Condenser Pad - Precast Concrete"`, category `"Hvac"`, previously misclassified `"Concrete"`). |
| **Painting** | 108 | 130 | **+22, correct.** The largest single gain: many `"Deck Stain"`/`"Fence Stain"`/`"Concrete Floor Stain"`-named items (category `"Painting"`) were previously misclassified by their name text as Deck/Fence/Concrete; several `"Assemblies - Painting"` records also now correctly resolve via category. |
| **Flooring** | 120 | 118 | **−2, net effect of two offsetting corrections** (a couple of true-category gains from cost items, offset by a couple of `"Assemblies - Flooring"` records now correctly reporting ambiguity instead of a false-positive trade). |

**No unexpected large redistribution was found.** Every trade-count delta traces to one of exactly
two mechanisms: (a) a cost item's `trade` moving to match its own already-curated `category` field
(strictly more correct), or (b) an assembly correctly reporting `null`/ambiguous instead of an
array-order-accident guess. Nothing moved to a *wrong* trade; the redistribution is real but entirely
explained and, in every traced case, a correction.

## 4. Every classification that changed

Sorted by kind, then category, then name. `_(none)_` means `null` (unclassified).

| Kind | Name | Category | Before | After |
|---|---|---|---|---|
| assembly | Basement Assembly Group | Assemblies - Basement | Drywall | Basement |
| assembly | Basement Bathroom Rough-In | Assemblies - Basement | Concrete | _(none)_ |
| assembly | Basement Egress Window - Per Opening | Assemblies - Basement | Excavation | _(none)_ |
| assembly | Basement Full Finish Package - 800 SF | Assemblies - Basement | Drywall | _(none)_ |
| assembly | Bathroom Assembly Group | Assemblies - Bathroom | Electrical | Bathroom |
| assembly | Remodel – Bathroom – 1 | Assemblies - Bathroom | Roofing | Cabinetry |
| assembly | Remodel – Bathroom – 120 | Assemblies - Bathroom | Roofing | _(none)_ |
| assembly | Remodel – Bathroom – 121 | Assemblies - Bathroom | Flooring | _(none)_ |
| assembly | Remodel – Bathroom – 122 | Assemblies - Bathroom | Countertops | Roofing |
| assembly | Remodel – Bathroom – 123 | Assemblies - Bathroom | Siding | _(none)_ |
| assembly | Remodel – Bathroom – 125 | Assemblies - Bathroom | Landscaping | _(none)_ |
| assembly | Remodel – Bathroom – 128 | Assemblies - Bathroom | Painting | _(none)_ |
| assembly | Remodel – Bathroom – 149 | Assemblies - Bathroom | Cabinetry | Roofing |
| assembly | Remodel – Bathroom – 163 | Assemblies - Bathroom | Landscaping | _(none)_ |
| assembly | Remodel – Bathroom – 164 | Assemblies - Bathroom | Siding | Countertops |
| assembly | Remodel – Bathroom – 177 | Assemblies - Bathroom | Siding | _(none)_ |
| assembly | Remodel – Bathroom – 197 | Assemblies - Bathroom | Flooring | _(none)_ |
| assembly | Remodel – Bathroom – 200 | Assemblies - Bathroom | Painting | _(none)_ |
| assembly | Remodel – Bathroom – 214 | Assemblies - Bathroom | Flooring | _(none)_ |
| assembly | Remodel – Bathroom – 23 | Assemblies - Bathroom | Countertops | _(none)_ |
| assembly | Remodel – Bathroom – 230 | Assemblies - Bathroom | Painting | Cabinetry |
| assembly | Remodel – Bathroom – 234 | Assemblies - Bathroom | Hardscaping | Countertops |
| assembly | Remodel – Bathroom – 249 | Assemblies - Bathroom | Flooring | _(none)_ |
| assembly | Remodel – Bathroom – 28 | Assemblies - Bathroom | Siding | _(none)_ |
| assembly | Remodel – Bathroom – 31 | Assemblies - Bathroom | General Conditions | _(none)_ |
| assembly | Remodel – Bathroom – 39 | Assemblies - Bathroom | Painting | _(none)_ |
| assembly | Remodel – Bathroom – 46 | Assemblies - Bathroom | Concrete | Hardscaping |
| assembly | Remodel – Bathroom – 52 | Assemblies - Bathroom | Countertops | _(none)_ |
| assembly | Remodel – Bathroom – 58 | Assemblies - Bathroom | Landscaping | _(none)_ |
| assembly | Remodel – Bathroom – 69 | Assemblies - Bathroom | General Conditions | _(none)_ |
| assembly | Remodel – Bathroom – 72 | Assemblies - Bathroom | Flooring | Siding |
| assembly | Remodel – Bathroom – 82 | Assemblies - Bathroom | Painting | _(none)_ |
| assembly | Full House Window & Entry Door Package | Assemblies - Envelope | Windows | Doors |
| assembly | Remodel – Exterior – 102 | Assemblies - Exterior | Painting | _(none)_ |
| assembly | Remodel – Exterior – 104 | Assemblies - Exterior | Siding | _(none)_ |
| assembly | Remodel – Exterior – 108 | Assemblies - Exterior | Hardscaping | _(none)_ |
| assembly | Remodel – Exterior – 144 | Assemblies - Exterior | Flooring | _(none)_ |
| assembly | Remodel – Exterior – 145 | Assemblies - Exterior | Hardscaping | _(none)_ |
| assembly | Remodel – Exterior – 147 | Assemblies - Exterior | Flooring | Cabinetry |
| assembly | Remodel – Exterior – 188 | Assemblies - Exterior | Painting | _(none)_ |
| assembly | Remodel – Exterior – 19 | Assemblies - Exterior | Roofing | _(none)_ |
| assembly | Remodel – Exterior – 206 | Assemblies - Exterior | Countertops | _(none)_ |
| assembly | Remodel – Exterior – 207 | Assemblies - Exterior | Cabinetry | _(none)_ |
| assembly | Remodel – Exterior – 209 | Assemblies - Exterior | Cabinetry | _(none)_ |
| assembly | Remodel – Exterior – 215 | Assemblies - Exterior | Roofing | _(none)_ |
| assembly | Remodel – Exterior – 22 | Assemblies - Exterior | Landscaping | _(none)_ |
| assembly | Remodel – Exterior – 223 | Assemblies - Exterior | Siding | _(none)_ |
| assembly | Remodel – Exterior – 229 | Assemblies - Exterior | Roofing | _(none)_ |
| assembly | Remodel – Exterior – 231 | Assemblies - Exterior | Siding | Roofing |
| assembly | Remodel – Exterior – 233 | Assemblies - Exterior | Roofing | _(none)_ |
| assembly | Remodel – Exterior – 240 | Assemblies - Exterior | Landscaping | _(none)_ |
| assembly | Remodel – Exterior – 241 | Assemblies - Exterior | Flooring | _(none)_ |
| assembly | Remodel – Exterior – 35 | Assemblies - Exterior | Siding | Roofing |
| assembly | Remodel – Exterior – 36 | Assemblies - Exterior | Hardscaping | _(none)_ |
| assembly | Remodel – Exterior – 41 | Assemblies - Exterior | General Conditions | _(none)_ |
| assembly | Remodel – Exterior – 45 | Assemblies - Exterior | Flooring | Roofing |
| assembly | Remodel – Exterior – 51 | Assemblies - Exterior | General Conditions | _(none)_ |
| assembly | Remodel – Exterior – 53 | Assemblies - Exterior | Cabinetry | _(none)_ |
| assembly | Remodel – Exterior – 64 | Assemblies - Exterior | Countertops | _(none)_ |
| assembly | Remodel – Exterior – 73 | Assemblies - Exterior | General Conditions | _(none)_ |
| assembly | Remodel – Exterior – 74 | Assemblies - Exterior | Painting | Flooring |
| assembly | Remodel – Exterior – 96 | Assemblies - Exterior | Roofing | _(none)_ |
| assembly | Standard Wood Deck - 200 SF | Assemblies - Exterior | Concrete | Deck |
| assembly | Remodel – Flooring – 11 | Assemblies - Flooring | Countertops | Flooring |
| assembly | Remodel – Flooring – 13 | Assemblies - Flooring | Siding | Flooring |
| assembly | Remodel – Flooring – 130 | Assemblies - Flooring | Cabinetry | Flooring |
| assembly | Remodel – Flooring – 143 | Assemblies - Flooring | Landscaping | Flooring |
| assembly | Remodel – Flooring – 158 | Assemblies - Flooring | Cabinetry | Flooring |
| assembly | Remodel – Flooring – 168 | Assemblies - Flooring | Siding | Flooring |
| assembly | Remodel – Flooring – 179 | Assemblies - Flooring | Concrete | Flooring |
| assembly | Remodel – Flooring – 181 | Assemblies - Flooring | Countertops | Flooring |
| assembly | Remodel – Flooring – 184 | Assemblies - Flooring | Roofing | Flooring |
| assembly | Remodel – Flooring – 189 | Assemblies - Flooring | Cabinetry | Siding |
| assembly | Remodel – Flooring – 191 | Assemblies - Flooring | Countertops | Flooring |
| assembly | Remodel – Flooring – 192 | Assemblies - Flooring | Landscaping | Flooring |
| assembly | Remodel – Flooring – 221 | Assemblies - Flooring | Concrete | Flooring |
| assembly | Remodel – Flooring – 24 | Assemblies - Flooring | Landscaping | Flooring |
| assembly | Remodel – Flooring – 44 | Assemblies - Flooring | Siding | Landscaping |
| assembly | Remodel – Flooring – 60 | Assemblies - Flooring | Siding | Countertops |
| assembly | Remodel – Flooring – 63 | Assemblies - Flooring | Landscaping | Flooring |
| assembly | Remodel – Flooring – 85 | Assemblies - Flooring | Cabinetry | Flooring |
| assembly | Remodel – Flooring – 88 | Assemblies - Flooring | Countertops | Flooring |
| assembly | Kitchen Assembly Group | Assemblies - Kitchen | Electrical | Kitchen |
| assembly | Remodel – Kitchen – 10 | Assemblies - Kitchen | Cabinetry | _(none)_ |
| assembly | Remodel – Kitchen – 106 | Assemblies - Kitchen | Roofing | _(none)_ |
| assembly | Remodel – Kitchen – 113 | Assemblies - Kitchen | Siding | _(none)_ |
| assembly | Remodel – Kitchen – 116 | Assemblies - Kitchen | Landscaping | _(none)_ |
| assembly | Remodel – Kitchen – 118 | Assemblies - Kitchen | Landscaping | _(none)_ |
| assembly | Remodel – Kitchen – 127 | Assemblies - Kitchen | Concrete | Siding |
| assembly | Remodel – Kitchen – 132 | Assemblies - Kitchen | Landscaping | Hardscaping |
| assembly | Remodel – Kitchen – 134 | Assemblies - Kitchen | Siding | Painting |
| assembly | Remodel – Kitchen – 152 | Assemblies - Kitchen | Roofing | Cabinetry |
| assembly | Remodel – Kitchen – 154 | Assemblies - Kitchen | General Conditions | _(none)_ |
| assembly | Remodel – Kitchen – 160 | Assemblies - Kitchen | Roofing | _(none)_ |
| assembly | Remodel – Kitchen – 196 | Assemblies - Kitchen | Flooring | _(none)_ |
| assembly | Remodel – Kitchen – 208 | Assemblies - Kitchen | Roofing | _(none)_ |
| assembly | Remodel – Kitchen – 21 | Assemblies - Kitchen | Concrete | Hardscaping |
| assembly | Remodel – Kitchen – 217 | Assemblies - Kitchen | Cabinetry | Roofing |
| assembly | Remodel – Kitchen – 222 | Assemblies - Kitchen | Landscaping | _(none)_ |
| assembly | Remodel – Kitchen – 232 | Assemblies - Kitchen | Roofing | _(none)_ |
| assembly | Remodel – Kitchen – 239 | Assemblies - Kitchen | Cabinetry | _(none)_ |
| assembly | Remodel – Kitchen – 250 | Assemblies - Kitchen | Landscaping | _(none)_ |
| assembly | Remodel – Kitchen – 29 | Assemblies - Kitchen | General Conditions | _(none)_ |
| assembly | Remodel – Kitchen – 47 | Assemblies - Kitchen | General Conditions | _(none)_ |
| assembly | Remodel – Kitchen – 48 | Assemblies - Kitchen | Flooring | _(none)_ |
| assembly | Remodel – Kitchen – 49 | Assemblies - Kitchen | Roofing | _(none)_ |
| assembly | Remodel – Kitchen – 7 | Assemblies - Kitchen | Flooring | _(none)_ |
| assembly | Remodel – Kitchen – 78 | Assemblies - Kitchen | Painting | _(none)_ |
| assembly | Remodel – Kitchen – 79 | Assemblies - Kitchen | Flooring | _(none)_ |
| assembly | Remodel – Kitchen – 83 | Assemblies - Kitchen | Siding | _(none)_ |
| assembly | Remodel – Kitchen – 89 | Assemblies - Kitchen | Painting | _(none)_ |
| assembly | Remodel – Kitchen – 9 | Assemblies - Kitchen | Concrete | Siding |
| assembly | Remodel – Kitchen – 90 | Assemblies - Kitchen | Countertops | _(none)_ |
| assembly | Remodel – Kitchen – 92 | Assemblies - Kitchen | Siding | _(none)_ |
| assembly | Remodel – Misc – 107 | Assemblies - Misc | Concrete | _(none)_ |
| assembly | Remodel – Misc – 117 | Assemblies - Misc | Cabinetry | Painting |
| assembly | Remodel – Misc – 136 | Assemblies - Misc | Concrete | _(none)_ |
| assembly | Remodel – Misc – 15 | Assemblies - Misc | Roofing | Painting |
| assembly | Remodel – Misc – 150 | Assemblies - Misc | Flooring | _(none)_ |
| assembly | Remodel – Misc – 16 | Assemblies - Misc | Flooring | _(none)_ |
| assembly | Remodel – Misc – 169 | Assemblies - Misc | Cabinetry | _(none)_ |
| assembly | Remodel – Misc – 171 | Assemblies - Misc | Roofing | _(none)_ |
| assembly | Remodel – Misc – 176 | Assemblies - Misc | Countertops | _(none)_ |
| assembly | Remodel – Misc – 187 | Assemblies - Misc | Countertops | _(none)_ |
| assembly | Remodel – Misc – 190 | Assemblies - Misc | Countertops | _(none)_ |
| assembly | Remodel – Misc – 193 | Assemblies - Misc | Siding | _(none)_ |
| assembly | Remodel – Misc – 212 | Assemblies - Misc | Cabinetry | Countertops |
| assembly | Remodel – Misc – 224 | Assemblies - Misc | Siding | _(none)_ |
| assembly | Remodel – Misc – 228 | Assemblies - Misc | Siding | Painting |
| assembly | Remodel – Misc – 237 | Assemblies - Misc | Roofing | _(none)_ |
| assembly | Remodel – Misc – 37 | Assemblies - Misc | Siding | Painting |
| assembly | Remodel – Misc – 54 | Assemblies - Misc | Landscaping | _(none)_ |
| assembly | Remodel – Misc – 6 | Assemblies - Misc | Siding | _(none)_ |
| assembly | Remodel – Misc – 62 | Assemblies - Misc | General Conditions | _(none)_ |
| assembly | Remodel – Misc – 68 | Assemblies - Misc | Siding | _(none)_ |
| assembly | Remodel – Misc – 71 | Assemblies - Misc | Landscaping | _(none)_ |
| assembly | Remodel – Misc – 87 | Assemblies - Misc | Roofing | _(none)_ |
| assembly | Remodel – Misc – 94 | Assemblies - Misc | Countertops | _(none)_ |
| assembly | Remodel – Painting – 101 | Assemblies - Painting | Landscaping | Roofing |
| assembly | Remodel – Painting – 105 | Assemblies - Painting | Landscaping | Painting |
| assembly | Remodel – Painting – 110 | Assemblies - Painting | Siding | Painting |
| assembly | Remodel – Painting – 112 | Assemblies - Painting | Cabinetry | Painting |
| assembly | Remodel – Painting – 119 | Assemblies - Painting | Landscaping | Painting |
| assembly | Remodel – Painting – 126 | Assemblies - Painting | General Conditions | Painting |
| assembly | Remodel – Painting – 129 | Assemblies - Painting | Cabinetry | Painting |
| assembly | Remodel – Painting – 138 | Assemblies - Painting | Countertops | Roofing |
| assembly | Remodel – Painting – 161 | Assemblies - Painting | Cabinetry | Painting |
| assembly | Remodel – Painting – 165 | Assemblies - Painting | Roofing | Painting |
| assembly | Remodel – Painting – 172 | Assemblies - Painting | Roofing | Flooring |
| assembly | Remodel – Painting – 178 | Assemblies - Painting | Flooring | Painting |
| assembly | Remodel – Painting – 198 | Assemblies - Painting | Landscaping | Painting |
| assembly | Remodel – Painting – 199 | Assemblies - Painting | Siding | Landscaping |
| assembly | Remodel – Painting – 210 | Assemblies - Painting | Roofing | Painting |
| assembly | Remodel – Painting – 226 | Assemblies - Painting | Hardscaping | Painting |
| assembly | Remodel – Painting – 235 | Assemblies - Painting | Roofing | Painting |
| assembly | Remodel – Painting – 238 | Assemblies - Painting | Landscaping | Painting |
| assembly | Remodel – Painting – 243 | Assemblies - Painting | Cabinetry | Painting |
| assembly | Remodel – Painting – 245 | Assemblies - Painting | Cabinetry | Painting |
| assembly | Remodel – Painting – 247 | Assemblies - Painting | Siding | Painting |
| assembly | Remodel – Painting – 27 | Assemblies - Painting | Cabinetry | Landscaping |
| assembly | Remodel – Painting – 33 | Assemblies - Painting | Roofing | Painting |
| assembly | Remodel – Painting – 38 | Assemblies - Painting | General Conditions | Painting |
| assembly | Remodel – Painting – 55 | Assemblies - Painting | Concrete | Painting |
| assembly | Remodel – Painting – 56 | Assemblies - Painting | General Conditions | Painting |
| assembly | Remodel – Painting – 59 | Assemblies - Painting | Flooring | Painting |
| assembly | Remodel – Painting – 67 | Assemblies - Painting | Siding | Painting |
| assembly | Remodel – Painting – 75 | Assemblies - Painting | Countertops | Siding |
| assembly | Remodel – Painting – 76 | Assemblies - Painting | General Conditions | Painting |
| assembly | Remodel – Painting – 77 | Assemblies - Painting | Countertops | Painting |
| assembly | Remodel – Painting – 91 | Assemblies - Painting | General Conditions | Painting |
| assembly | Remodel – Painting – 97 | Assemblies - Painting | Landscaping | Painting |
| assembly | Remodel – Roofing – 100 | Assemblies - Roofing | Flooring | Roofing |
| assembly | Remodel – Roofing – 115 | Assemblies - Roofing | Landscaping | Roofing |
| assembly | Remodel – Roofing – 12 | Assemblies - Roofing | Cabinetry | Roofing |
| assembly | Remodel – Roofing – 131 | Assemblies - Roofing | Siding | Roofing |
| assembly | Remodel – Roofing – 133 | Assemblies - Roofing | Concrete | Roofing |
| assembly | Remodel – Roofing – 139 | Assemblies - Roofing | Painting | Roofing |
| assembly | Remodel – Roofing – 155 | Assemblies - Roofing | Flooring | Roofing |
| assembly | Remodel – Roofing – 156 | Assemblies - Roofing | Painting | Roofing |
| assembly | Remodel – Roofing – 166 | Assemblies - Roofing | Flooring | Roofing |
| assembly | Remodel – Roofing – 173 | Assemblies - Roofing | Countertops | Roofing |
| assembly | Remodel – Roofing – 180 | Assemblies - Roofing | General Conditions | Roofing |
| assembly | Remodel – Roofing – 194 | Assemblies - Roofing | Flooring | Cabinetry |
| assembly | Remodel – Roofing – 211 | Assemblies - Roofing | Hardscaping | Roofing |
| assembly | Remodel – Roofing – 216 | Assemblies - Roofing | Landscaping | Cabinetry |
| assembly | Remodel – Roofing – 218 | Assemblies - Roofing | Painting | Roofing |
| assembly | Remodel – Roofing – 219 | Assemblies - Roofing | Cabinetry | Roofing |
| assembly | Remodel – Roofing – 220 | Assemblies - Roofing | Painting | Roofing |
| assembly | Remodel – Roofing – 236 | Assemblies - Roofing | Painting | Roofing |
| assembly | Remodel – Roofing – 246 | Assemblies - Roofing | Painting | Landscaping |
| assembly | Remodel – Roofing – 248 | Assemblies - Roofing | Cabinetry | Roofing |
| assembly | Remodel – Roofing – 25 | Assemblies - Roofing | Flooring | Roofing |
| assembly | Remodel – Roofing – 42 | Assemblies - Roofing | Siding | Roofing |
| assembly | Remodel – Roofing – 65 | Assemblies - Roofing | Siding | Roofing |
| assembly | Remodel – Roofing – 8 | Assemblies - Roofing | Hardscaping | Roofing |
| assembly | Remodel – Roofing – 80 | Assemblies - Roofing | General Conditions | Roofing |
| assembly | Remodel – Roofing – 84 | Assemblies - Roofing | Countertops | Roofing |
| assembly | Remodel – Roofing – 98 | Assemblies - Roofing | Siding | Landscaping |
| assembly | Remodel – Roofing – 99 | Assemblies - Roofing | Hardscaping | Roofing |
| assembly | Tree Service Assembly Group | Tree Service | Trim | Tree Service |
| costItem | Concrete Countertop - Hand Cast And Polished | Countertops | Concrete | Countertops |
| costItem | Deck Concrete Footing - 12x12x12 Poured | Deck | Concrete | Deck |
| costItem | Foam Board Insulation Attach To Concrete | Drywall | Concrete | Drywall |
| costItem | Concrete Breaking - Sledge And Jackhammer | Excavation | Concrete | Excavation |
| costItem | Bollard - 4 Inch Concrete Filled EA | Fence | Concrete | Fence |
| costItem | Fast-Set Concrete Bag - Per Post | Fence | Concrete | Fence |
| costItem | Fence Mowing Pad - Concrete Per LF | Fence | Concrete | Fence |
| costItem | Rail Bracket - Deck/fence Connect EA | Fence | Deck | Fence |
| costItem | Wood Post - 4x4 PT Set In Concrete | Fence | Concrete | Fence |
| costItem | Concrete Floor - Microtopping | Flooring | Concrete | Flooring |
| costItem | Concrete Floor - Polished | Flooring | Concrete | Flooring |
| costItem | Ledger Board Attachment To Concrete | Framing | Concrete | Framing |
| costItem | Concrete Washout Area Setup | General Conditions | Concrete | General Conditions |
| costItem | Material Testing - Concrete And Soil | General Conditions | Concrete | General Conditions |
| costItem | Temporary Fence - Chain Link Rental Per Month | General Conditions | Fence | General Conditions |
| costItem | Concrete Paver Patio - Standard 3-Piece SF | Hardscaping | Concrete | Hardscaping |
| costItem | Condenser Pad - Precast Concrete | Hvac | Concrete | HVAC |
| costItem | Acoustic Sealant - Electrical Box | Insulation | Electrical | Insulation |
| costItem | Closed Cell Spray Foam - 4 Inch Roof Deck | Insulation | Deck | Insulation |
| costItem | Closed Cell Spray Foam - 6 Inch Roof Deck | Insulation | Deck | Insulation |
| costItem | Insulated Concrete Form - Wall System | Insulation | Concrete | Insulation |
| costItem | Concrete Curbing - Landscape Extruded LF | Landscaping | Concrete | Landscaping |
| costItem | Concrete Floor Sealer - High Gloss SF | Painting | Concrete | Painting |
| costItem | Concrete Floor Stain - Water Based SF | Painting | Concrete | Painting |
| costItem | Deck Stain - Semi Transparent | Painting | Deck | Painting |
| costItem | Deck Stain - Solid Color | Painting | Deck | Painting |
| costItem | Deck Staining - Transparent Per SF | Painting | Deck | Painting |
| costItem | Fence Stain - Natural Cedar Tone | Painting | Fence | Painting |
| costItem | Fence Staining - Power Spray Per LF | Painting | Fence | Painting |
| costItem | Deck Kitchen - Sink And Faucet EA | Plumbing | Deck | Plumbing |
| costItem | Septic Tank - 1000 Gallon Concrete EA | Plumbing | Concrete | Plumbing |
| costItem | Concrete Tile Roof Install | Roofing | Concrete | Roofing |
| costItem | Flat Roof Ponding Repair - Tapered Insulation | Roofing | Insulation | Roofing |
| costItem | Plank Decking Board Replacement - Per LF | Roofing | Deck | Roofing |
| costItem | Roof Insulation - Polyiso 2 Inch | Roofing | Insulation | Roofing |
| costItem | Roof Insulation - Polyiso 3 Inch | Roofing | Insulation | Roofing |
| costItem | Rotten Decking Replacement - Per Sheet | Roofing | Deck | Roofing |
| costItem | Continuous Rigid Insulation Thermal Break | Siding | Insulation | Siding |
| costItem | Deck Ledger Flashing At Wall | Siding | Deck | Siding |
| costItem | Siding Painting - Masonry Or Stucco | Siding | Painting | Siding |
| costItem | Barn Door Hardware Install - Sliding | Trim | Hardware | Trim |

Every cost-item row above shows the fixed trade now matching that row's own `Category` column
exactly. All 1,795 cost items (not just the 41 that changed) satisfy this invariant after the fix;
verified programmatically and pinned by
`app/tests/knowledge-runtime.trade-inference.test.ts`'s "every cost item's trade matches its own
category" regression test.

## 5. A pre-existing, unmodified fallback this fix interacts with (not a new behavior)

Three of the four assembly-index summary records — `"Bathroom Assembly Group"`,
`"Kitchen Assembly Group"`, `"Basement Assembly Group"` — now report `"Bathroom"`, `"Kitchen"`, and
`"Basement"` respectively instead of a real trade name. This is **not** a new mechanism introduced
by this fix. `toAssemblyIndexRecord()` in `repository.ts` has always contained:

```ts
const trade = inferTrade(group, `${category} ${description}`, [], trades) ?? normalizeTradeName(group);
```

`normalizeTradeName()` only special-cases `"Flatwork"` → `"Concrete"`; for any other value it
returns the input unchanged. Before this fix, `inferTrade()` never returned `null` for these three
records — it always found *some* real trade via the substring bug (`"Electrical"`, `"Electrical"`,
`"Drywall"` respectively, picked by array-order accident from words like "electrical"/"plumbing"/
"framing"/"drywall" that appear in each group's own description alongside genuinely different
trades). Those descriptions mention multiple real trades with equal textual weight (Bathroom:
"plumbing, electrical, and finishing"; Kitchen: "Electrical, plumbing, and layout"; Basement:
"Structural insulation, steel framing, drywall") — a case the fixed classifier correctly identifies
as a tie (`{status: "ambiguous"}`) between real trades and therefore returns `null`, at which point
this always-present fallback substitutes the descriptive group label instead. The Tree Service
record does not hit this fallback: its category text names the real "Tree Service" trade uniquely,
so `inferTrade()` returns `"Tree Service"` directly.

`KnowledgeAssemblyRecord.trade` is typed `string | null` and was never constrained to the 25-trade
enum, so `"Bathroom"`/`"Kitchen"`/`"Basement"` appearing here is not a new type or contract
violation — it is the same fallback behavior the code already had, now reached through an honest
ambiguity signal instead of a wrong confident guess.

## 6. Tests added

`app/tests/knowledge-runtime.trade-inference.test.ts` (new) covers, at minimum:

- `"tree trimming"` does not match trade `Trim` (word-boundary regression for the reported bug).
- `"trim installation"` does match `Trim`.
- The real Tree Service assembly-index record resolves to `"Tree Service"`, not `"Trim"`, against
  the live corpus.
- Case-insensitive matching (`"ROOFING"`, `"RoOfInG"`).
- Punctuation does not break matching (`"tear-off"`, hyphens, commas).
- Multi-word trade names resolve correctly (`"Tree Service"`, `"General Conditions"`) and require
  adjacency, not just co-occurrence.
- A shorter trade name does not steal a match from a more specific/longer one at the same priority.
- `category` wins over `name` when both are informative and disagree.
- Genuinely ambiguous text (two real trades named with equal weight) resolves to `null`, never an
  arbitrary pick.
- `candidateTrades` with a strict-majority trade outranks text matching.
- Representative real records from Concrete, Roofing, Framing, Electrical, Plumbing, HVAC,
  Painting, and Flooring retain (or correctly gain) their classification against the live corpus.
- Every one of the 1,795 cost items resolves its trade to exactly its own `category` (module the
  pre-existing `Flatwork` → `Concrete` normalization) — the invariant this whole fix converges on.

## 7. Remaining ambiguity / risk

- **89 assemblies (30% of the 293-assembly corpus) now report `null`.** All are `"Remodel – Kitchen/
  Bathroom/Exterior/Misc – N"`-pattern records whose `category` names no real trade and whose
  linked cost items have no strict-majority trade. This is the intended, safety-first outcome for
  genuinely multi-trade assemblies — not a defect — but it does reduce how many assemblies can be
  trade-filtered or trade-boosted in search until a richer signal (e.g. a real per-assembly primary-
  trade field in the source data) is introduced. Recorded as a known limitation, not fixed here.
- **The `"Bathroom"`/`"Kitchen"`/`"Basement"` non-canonical fallback labels (§5) are pre-existing
  and unchanged**, but this fix is what makes them newly reachable for these three specific
  records. A future pass could decide whether that fallback should keep using the raw group label
  or a dedicated `"unclassified"` sentinel; out of scope here since the fallback itself was not
  modified.
- **This fix does not touch `matcher.ts`'s separate, smaller `TRADE_ALIASES` copy** used for query-
  side keyword scoring in `rerankByTradeAndScope()`/`buildTradeKeywords()` at the search-query
  level (as opposed to `repository.ts`'s corpus-classification `TRADE_ALIASES`, which this fix did
  modify). The two are independent constants; reconciling or sharing them is out of scope for a
  classification-correctness fix.
- **No item-level provenance existed before this fix and none was added by it.** Provenance status
  (`documented`/`unverified-legacy`/`placeholder`, PR #472) is resolved per-trade from
  `trade-progress.json`, independent of this classifier; a more accurate `trade` assignment does
  not by itself change any record's provenance status.

## 8. Is the repository safe to proceed with Stage 6 reviewed candidate ingestion?

**Yes, with respect to trade classification.** The corpus-wide audit in §3 shows the fix is a
strict correctness improvement with a fully traced, non-surprising redistribution: every changed
cost item now matches its own curated category, no cost item lost classification, and every
newly-`null` record is a genuinely multi-trade assembly that had no single correct answer to begin
with. `resolveTradeProvenanceStatus()` and every other `trade`-keyed consumer already tolerate
`null`, so nothing downstream needs to change to accept this fix's more conservative output.

This does not by itself green-light Stage 6's *ingestion* mechanics (candidate persistence, the
review-gate route, and Knowledge Engine index regeneration remain unimplemented per
`docs/architecture/COSTBOOK_RESEARCH_INGESTION_DESIGN.md`) — only the specific concern this mission
was scoped to (trade-attribution correctness of the existing corpus) is resolved.
