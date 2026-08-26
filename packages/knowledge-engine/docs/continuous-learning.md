# TradeOS Knowledge Engine - Continuous Learning Specification

This document details the feedback loop that aggregates real-world project completions to improve estimating accuracy without corrupting production knowledge.

---

## 1. Continuous Learning Data Loop

```
               ┌───────────────────────┐
               │  Production Costbook  │
               └──────────┬────────────┘
                          │ (Retrieval context)
                          ▼
               ┌───────────────────────┐
               │    AI Estimation      │
               └──────────┬────────────┘
                          │
                          ▼
               ┌───────────────────────┐
               │ Contractor Override   │ ◄─── (Log adjustments)
               └──────────┬────────────┘
                          │
                          ▼
               ┌───────────────────────┐
               │  Final Job Invoice    │
               └──────────┬────────────┘
                          │
                          ▼
               ┌───────────────────────┐
               │ Actual Production Cost│ ◄─── (Real crew timesheets)
               └──────────┬────────────┘
                          │
                          ▼
               ┌───────────────────────┐
               │   Staging Sandbox     │ ◄─── (Isolate updates)
               └──────────┬────────────┘
                          │ (Verify quality score & taxonomy)
                          ▼
               ┌───────────────────────┐
               │     Human Audit       │ ◄─── (Merge back to main)
               └───────────────────────┘
```

---

## 2. Ingestion Isolation & Safety
To prevent hallucinated feedback, biased contractor markups, or raw pricing outliers from corrupting the master database, we enforce three safety rules:
1. **Double-Blind Sandbox Staging**: All feedback data points are written to `imports/feedback_logs.json` inside a sandbox. They never write directly to `knowledge/`.
2. **Aggregated Truncated Averages**: If a cost item has multiple contractor overrides, the system computes the median override value. If the median deviates by $> 15\%$ over 30 days, the `PricingSanityAgent` flags the item for baseline rate review.
3. **Outlier Filtering**: Exclude any invoices or invoices with extreme variance ($> 2.0x$ or $< 0.5x$ standard deviations) from learning datasets to filter out unique custom commissions.
