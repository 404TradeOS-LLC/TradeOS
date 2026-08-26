# TradeOS Estimating App - Confidence Engine Specification

This document details the scoring indices, mathematical weightings, and routing thresholds used by the Confidence Engine to determine estimation safety.

---

## 1. Multi-Dimensional Confidence Scores

The Confidence Engine calculates an overall score ($CS$) out of $1.0$ by evaluating five categories:

### Trade Confidence ($C_{trade}$)
* **Measurement**: Certainty of taxonomy classification.
* **Score**: $1.0$ if the request contains explicit trade keywords. $0.5$ if ambiguous (e.g. "cleanup").

### Assembly Confidence ($C_{assy}$)
* **Measurement**: Match accuracy to assembly scope descriptions.
* **Score**: Based on cosine similarity of vectors ($0.0$ to $1.0$).

### Item Confidence ($C_{item}$)
* **Measurement**: Ratio of exact matched line items to near/fallback substitutions.
* **Score**: Drops by $0.20$ for each fallback item used.

### Pricing Confidence ($C_{price}$)
* **Measurement**: Proximity of total cost to historical trade averages.
* **Score**: Drops if calculated rates deviate by $> 25\%$ from historical regional bounds.

### Proposal Confidence ($C_{prop}$)
* **Measurement**: Completion of required exclusions, assumptions, and warranties.
* **Score**: $1.0$ if all template sections are filled. $0.0$ if primary sections are blank.

---

## 2. Overall Confidence Scoring Formula
\[CS = 0.25 \cdot C_{trade} + 0.25 \cdot C_{assy} + 0.20 \cdot C_{item} + 0.15 \cdot C_{price} + 0.15 \cdot C_{prop}\]

---

## 3. Threshold Routing Rules
* **$CS \ge 0.85$**: **Automatic Approval Gate**. The system commits the estimate, locks the pricing, generates the PDF proposal, and queues it for transmission.
* **$0.60 \le CS < 0.85$**: **Staged Human Review Gate**. Staged in `review/runtime/`. The contractor is notified via mobile app to verify line items and click "Accept".
* **$CS < 0.60$**: **Manual Estimate Flag**. Pauses AI processing. A notification is sent to the estimator to perform a manual takeoff.
