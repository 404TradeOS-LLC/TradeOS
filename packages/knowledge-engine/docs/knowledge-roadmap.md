# TradeOS Knowledge Engine - Roadmap Specification

This document lays out the expansion timeline and future feature integrations for the Construction Knowledge Engine.

---

## 1. Trade Coverage Expansion Plan
* **Trades Remaining**: 1 (Tree Service - Items generation)
* **Expected Completion**: Q3 2026
* **Target Count**: Add exactly 100 Tree Service items to match baseline standards.
* **Assemblies Remaining**: 10 (Electrical Fixtures, Plumbing Fixtures, Exterior Landscaping enhancements)

---

## 2. Identified Knowledge Gaps
* **Regional Pricing Multipliers**: Currently baseline prices reflect Midwest averages; we need localized city multiplier indexes ($F_{city}$) for all 50 states.
* **Commodity Price Feeds**: Connect lumber and steel raw costs directly to live market pricing indices to auto-adjust material costs.
* **Regulatory Exclusions**: Add detailed regional code differences (e.g. California Title 24, hurricane framing regulations for Florida) to the reasoning guidelines.

---

## 3. Future AI Modules & Integrations

### AI Estimator intake (Voice/Photo)
- Build an image classification worker that maps photos of site damage to emergency tree removal assemblies.
- Integrate Whisper-based transcription processing to feed voice estimates.

### Supabase pgvector RAG
- Build automatic embedding updates into database triggers.
- Feed proposal templates directly to the TradeOS intake portal for automated bid proposal generation.
