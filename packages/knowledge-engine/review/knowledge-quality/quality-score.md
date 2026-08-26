# TradeOS Knowledge Quality Scoring Algorithm

This document defines the mathematical formula for computing the Overall Quality Score ($OQ$) of a generated batch or asset.

---

## 1. Quality Scoring Formula
The Overall Quality ($OQ$) score ranges from $0.0$ to $1.0$ and is calculated as a weighted average of individual scores:

\[OQ = w_v \cdot S_{val} + w_c \cdot S_{comp} + w_p \cdot S_{price} + w_a \cdot S_{assy} - w_d \cdot Risk_{dup}\]

Where the components and weights are defined as follows:

| Component | Weight | Description |
|-----------|--------|-------------|
| **$S_{val}$** | $0.30$ | Schema Validation Score ($1.0$ or $0.0$). If $0.0$, $OQ$ is forced to $0.0$. |
| **$S_{comp}$** | $0.25$ | Completeness (ratio of filled properties). |
| **$S_{price}$** | $0.20$ | Pricing Confidence (conformance to unit cost floors). |
| **$S_{assy}$** | $0.15$ | Assembly / Crew Recipe integrity (valid UUID links). |
| **$Risk_{dup}$** | $0.10$ | Deduplication Risk. Subtracted from the total to penalize duplicate records. |

---

## 2. Quality Thresholds
* **$OQ \ge 0.85$**: **High Quality**. Approved for automatic merging to production.
* **$0.70 \le OQ < 0.85$**: **Medium Quality**. Requires human review (staged in `review/pending/`).
* **$OQ < 0.70$**: **Low Quality**. Rejected immediately. Job is logged and scheduled for re-generation.
