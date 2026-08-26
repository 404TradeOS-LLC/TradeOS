# TradeOS Runtime - Human Review Staging

> **HISTORICAL / SUPERSEDED (marked 2026-07-16).** The "Approve" action below describes an
> estimate being autonomously "locked, signed, and the PDF is generated." This conflicts with
> current TradeOS doctrine: AI behavior is **review-first, contractor-controlled, and
> service-bound** — no autonomous AI database writes, and no generated text is treated as
> authority. See [`docs/bible/VOLUME_3_ENGINEERING.md`](../../../../docs/bible/VOLUME_3_ENGINEERING.md)
> and [`docs/bible/VOLUME_7_KNOWLEDGE_RUNTIME.md`](../../../../docs/bible/VOLUME_7_KNOWLEDGE_RUNTIME.md).
> The actual shipped `app/modules/knowledge-runtime` is file-based and read-only; see
> [`app/modules/knowledge-runtime/README.md`](../../../../app/modules/knowledge-runtime/README.md).
> **This document must not be used as current implementation guidance.** It is preserved as
> historical design material — see [`packages/knowledge-engine/README.md`](../../README.md).

This directory holds estimate drafts that scored in the medium-confidence range ($0.60 \le CS < 0.85$), awaiting contractor verification before release.

---

## 1. Review Actions

### Approve
* **Action**: Reviewer clicks "Confirm". The estimate is locked, signed, and the PDF is generated.

### Reject
* **Action**: Reviewer clicks "Reject". The session is flagged, and the intake data is re-sent to the classifier.

### Replace & Override
* **Action**: The reviewer overrides a quantity (e.g. changing 100 LF to 120 LF) or substitutes a cost item (replacing red cedar with pressure-treated pine).
* **Logging**: Every override is logged dynamically:
  ```json
  {
    "action": "OVERRIDE",
    "field": "lineItem.quantity",
    "original": 100,
    "current": 120,
    "userId": "uuid",
    "reason": "Corrected site dimension manually"
  }
  ```

### Annotate & Retrain
* **Action**: Reviewers add inline notes (e.g. "Power line proximity adds 10% rigging time").
* **Feedback Hook**: If an override is repeated across three estimates in the same area, a notification is sent to the `ReviewAgent` to update baseline rules in `knowledge/reasoning/matching-engine.md`.
