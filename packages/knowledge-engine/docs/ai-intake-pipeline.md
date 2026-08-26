# TradeOS Estimating App - AI Intake Pipeline

This document defines how the TradeOS AI Intake Layer ingests and normalizes various raw inputs into a unified **Scope of Work (SoW)** parameters payload.

---

## 1. Intake Source Adapters

### Voice Input (Transcripts)
* **Processor**: Whisper-based Speech-to-Text (STT) adapter.
* **Extraction Rule**: Identify numeric sequences adjacent to measurement keywords (e.g. "three-inch", "fifty-five square feet"). Filter out verbal hesitation (e.g. "uh", "um").

### Typed Scope of Work
* **Processor**: Named Entity Recognition (NER) pipeline.
* **Extraction Rule**: Match terms against the trade taxonomy index. Map slang (e.g. "mudding") to standard terms ("taping").

### Site Photos
* **Processor**: Vision-LLM (e.g. Claude 3.5 Sonnet / GPT-4o Vision).
* **Extraction Rule**: Classify damage level, identify objects (e.g., fence, shingles, tree trunk), and estimate dimension benchmarks (e.g., comparing tree width to nearby fence post).

### PDF Plans & Blueprints
* **Processor**: OCR + CAD coordinate parser.
* **Extraction Rule**: Read title block for project scope. Extract area measurements from layout legends.

### Handwritten Notes
* **Processor**: Handwriting OCR.
* **Extraction Rule**: Parse scribbled measurements and material tags. Map keywords to item candidate lists.

---

## 2. Ingestion to Normalized Scope Flow

No matter the input channel, the intake pipeline must map outputs to a single standard JSON schema:

```
[Raw Voice/Photo/PDF]
         │
         ▼
[Ingestion Adapter] ──► Parse text/labels
         │
         ▼
[Entity Extractor] ──► Extract dimensions, materials, location
         │
         ▼
[Normalizer Agent] ──► Format text case & map units to SF/LF/EA
         │
         ▼
[Scope Payload] ──► Conforms to Standard SoW Parameters
```
