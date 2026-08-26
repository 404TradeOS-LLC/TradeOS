# TradeOS AI Reasoning Engine - Matching Pipeline Specification

This document defines how TradeOS AI agents process various intake modalities (text, transcripts, photos, structural inputs) and map them to costbook entries.

---

## 1. Intake Modalities & Processing Rules

### Text Scopes of Work
* **Rule**: Extract key entities: quantity, location, material name, and trade category.
* **Agent Flow**: Parse noun phrases $\rightarrow$ Map to taxonomy category $\rightarrow$ Query assemblies.

### Customer Natural Language
* **Rule**: Filter out non-technical fluff. Translate casual requests into technical specifications.
* **Example**: *"I want that neat clean texture on my bedroom walls"* $\rightarrow$ Map to `Spray Texture - Orange Peel` or `Tape and Finish - Level 5`.

### Voice Transcripts
* **Rule**: Account for verbal errors and filler words. Prioritize dimensions spoken in immediate succession (e.g. "it's ten by twelve... uh... so 120 square feet").
* **Agent Flow**: Run text segmentation $\rightarrow$ Extract dimensions $\rightarrow$ Bind area values.

### Site Photos
* **Rule**: Detect object boundaries, density, and degradation (e.g. tree health, wall cracking).
* **Agent Flow**: Image classification (e.g., "fallen tree") $\rightarrow$ Estimate DBH category $\rightarrow$ Query emergency storm hazard assemblies.

---

## 2. Confidence Scoring Methodology
The matching engine calculates a unified confidence score ($CS$) to determine estimation risk:

\[CS = w_t \cdot S_{trade} + w_d \cdot S_{dim} + w_s \cdot S_{site}\]

Where:
* **$S_{trade}$** (Weight $w_t = 0.40$): Trade classification certainty. $1.0$ if standard category (e.g. Concrete) is successfully matched.
* **$S_{dim}$** (Weight $w_d = 0.40$): Dimension specifications certainty. $1.0$ if exact quantity and unit are parsed. $0.5$ if dimensions are assumed based on averages.
* **$S_{site}$** (Weight $w_s = 0.20$): Access and site obstruction clarity. $1.0$ if photo confirms truck access. $0.0$ if access is completely unspecified.

*Confidence Action Rules*:
* **$CS \ge 0.85$**: **Automated Bind**. The system binds the assembly and locks the price.
* **$0.60 \le CS < 0.85$**: **Staged for Approval**. The system recommends the assembly but requests contractor confirmation.
* **$CS < 0.60$**: **Human Review Required**. The system flags the intake file and pauses estimation, requesting site photos or manual arborist measurement inputs.
