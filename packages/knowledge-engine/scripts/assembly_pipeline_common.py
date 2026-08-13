#!/usr/bin/env python3
"""
assembly_pipeline_common.py

Shared helpers for the assembly-specific generation pipeline:
  audit-assemblies.py -> start-assembly-run.py -> next-assembly-batch.py
  -> (Gemini generates review/pending/batchN.json)
  -> validate-assembly-batch.py -> approve-assembly-batch.py | reject-assembly-batch.py

This module exists to remove the copy-pasted load_json/save_json/path
plumbing that used to live independently in each of the scripts above, and
to give every stage of the pipeline one shared definition of "what counts as
a valid assembly" so validation can't quietly drift out of sync with what
the audit or the approval gate actually check.

Deliberately NOT shared with the generic cost-item/assembly batch runner
(start-trade-run.py, next-batch.py, approve-batch.py, reject-batch.py) or
the general task queue (run-next-task.py, complete-task.py, fail-task.py) --
those also drive cost-item generation, which this pipeline must not touch.
"""

import json
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

try:
    from jsonschema import Draft7Validator
except ImportError:
    Draft7Validator = None

PROJECT_ROOT = Path(__file__).resolve().parents[1]
KNOWLEDGE_DIR = PROJECT_ROOT / "knowledge"
RUNTIME_DIR = PROJECT_ROOT / "runtime"
DOCS_DIR = PROJECT_ROOT / "docs"
REVIEW_DIR = PROJECT_ROOT / "review"
PENDING_DIR = REVIEW_DIR / "pending"
APPROVED_DIR = REVIEW_DIR / "approved"
REJECTED_DIR = REVIEW_DIR / "rejected"
SCHEMA_PATH = PROJECT_ROOT / "schemas" / "assembly.schema.json"

ACTIVE_RUN_PATH = RUNTIME_DIR / "active-assembly-run.json"
CURRENT_TASK_PATH = RUNTIME_DIR / "current-task.md"

DEFAULT_BATCH_SIZE = 10
DEFAULT_TARGET = 100

# Fields the assembly quality standard (docs/assembly-quality-standard.md)
# treats as mandatory "content" fields, distinct from bare JSON-schema
# presence. A record can be schema-valid (these are all optional in
# schemas/assembly.schema.json) and still be useless to an estimator if
# it's missing them.
REQUIRED_CONTENT_FIELDS = {
    "description": "description",
    "requiredInputs": "inputs",
    "proposalScopeOfWork": "proposal language (scope of work)",
    "proposalAssumptions": "assumptions",
    "proposalExclusions": "exclusions",
    "safetyRequirements": "safety",
}

PLACEHOLDER_ID_PATTERNS = (
    "uuid-string",
    "tbd",
    "placeholder",
    "todo",
    "xxx",
    "changeme",
    "example",
    "test-id",
    "string",
)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_json(path: Path, default=None):
    path = Path(path)
    if not path.is_file():
        return default
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def fail(message: str, code: int = 1):
    print(f"[ERROR] {message}", file=sys.stderr)
    sys.exit(code)


def warn(message: str) -> None:
    print(f"[WARN] {message}", file=sys.stderr)


# ---------------------------------------------------------------------------
# Active run state
# ---------------------------------------------------------------------------

def load_active_run():
    return load_json(ACTIVE_RUN_PATH, None)


def save_active_run(data: dict) -> None:
    save_json(ACTIVE_RUN_PATH, data)


def require_active_run() -> dict:
    active = load_active_run()
    if active is None:
        fail(
            f"No active assembly run found at {ACTIVE_RUN_PATH.relative_to(PROJECT_ROOT)}. "
            "Run `python3 scripts/start-assembly-run.py --trade <trade>` first."
        )
    if active.get("status") != "active":
        fail(
            f"Active assembly run for '{active.get('trade')}' has status "
            f"'{active.get('status')}', not 'active'. Start a new run with "
            "`python3 scripts/start-assembly-run.py --trade <trade>`."
        )
    return active


def batch_output_path(batch_number: int) -> Path:
    return PENDING_DIR / f"batch{batch_number}.json"


def find_batch_entry(active: dict, batch_number: int):
    for b in active.get("batches", []):
        if b.get("batchNumber") == batch_number:
            return b
    return None


# ---------------------------------------------------------------------------
# Audit access
# ---------------------------------------------------------------------------

def audit_path_for_trade(trade: str) -> Path:
    return RUNTIME_DIR / f"assembly-audit-{trade.lower()}.json"


def require_audit(trade: str) -> dict:
    path = audit_path_for_trade(trade)
    audit = load_json(path, None)
    if audit is None:
        fail(
            f"No audit found for trade '{trade}' at {path.relative_to(PROJECT_ROOT)}. "
            f"Run `python3 scripts/audit-assemblies.py --trade {trade}` first."
        )
    return audit


# ---------------------------------------------------------------------------
# Assembly identity / placeholder helpers
# ---------------------------------------------------------------------------

def normalize_name(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().lower())


def is_valid_uuid(id_str) -> bool:
    if not isinstance(id_str, str):
        return False
    try:
        uuid.UUID(id_str)
        return True
    except (ValueError, AttributeError, TypeError):
        return False


def is_placeholder_id(id_str) -> bool:
    if not id_str or not isinstance(id_str, str):
        return True
    lowered = id_str.strip().lower()
    if not lowered:
        return True
    return any(pattern in lowered for pattern in PLACEHOLDER_ID_PATTERNS)


def _coerce_assembly_list(data) -> list:
    """Assembly files on disk show up in at least three shapes across this
    knowledge base: a bare list, a single object, or an object wrapping the
    list under "assemblies" or "items". Normalize all of them to a list."""
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("assemblies", "items"):
            if isinstance(data.get(key), list):
                return data[key]
        if "id" in data or "name" in data:
            return [data]
    return []


def load_existing_assemblies(trade: str) -> list:
    """Every assembly already on disk for a trade, across every layout this
    knowledge base actually uses:
      - individual/batch files under knowledge/assemblies/<trade>/*.json
      - a flat per-trade file knowledge/assemblies/<trade>_assemblies.json
        (e.g. framing_assemblies.json), wrapped in {"assemblies": [...]}
      - the legacy combined knowledge/assemblies.json, a list with a
        "trade" field per entry
    """
    assemblies = []
    trade_slug = trade.lower().replace(" ", "-")
    trade_slug_underscore = trade.lower().replace(" ", "_")

    individual_dir = KNOWLEDGE_DIR / "assemblies" / trade_slug
    if individual_dir.is_dir():
        for f in sorted(individual_dir.glob("*.json")):
            try:
                data = load_json(f, [])
            except (json.JSONDecodeError, OSError) as e:
                warn(f"Could not read assembly file {f}: {e}")
                continue
            assemblies.extend(_coerce_assembly_list(data))

    if KNOWLEDGE_DIR.joinpath("assemblies").is_dir():
        for f in sorted(KNOWLEDGE_DIR.joinpath("assemblies").glob("*.json")):
            stem = f.stem.lower()
            if stem in (f"{trade_slug}_assemblies", f"{trade_slug_underscore}_assemblies"):
                try:
                    data = load_json(f, [])
                except (json.JSONDecodeError, OSError) as e:
                    warn(f"Could not read assembly file {f}: {e}")
                    continue
                assemblies.extend(_coerce_assembly_list(data))

    legacy_file = KNOWLEDGE_DIR / "assemblies.json"
    if legacy_file.is_file():
        try:
            data = load_json(legacy_file, [])
        except (json.JSONDecodeError, OSError) as e:
            warn(f"Could not read legacy assemblies.json: {e}")
            data = []
        if isinstance(data, list):
            assemblies.extend(
                a for a in data if (a.get("trade") or "").lower() == trade.lower()
            )
    return assemblies


def existing_name_and_slug_sets(trade: str):
    existing = load_existing_assemblies(trade)
    names = {normalize_name(a.get("name", "")) for a in existing if a.get("name")}
    slugs = {normalize_name(a.get("slug", "")) for a in existing if a.get("slug")}
    return names, slugs


# ---------------------------------------------------------------------------
# Schema validation
# ---------------------------------------------------------------------------

def load_schema():
    schema = load_json(SCHEMA_PATH, None)
    if schema is None:
        warn(f"Assembly schema not found at {SCHEMA_PATH}. Schema checks skipped.")
    return schema


def validate_schema(assembly: dict, schema) -> list:
    if Draft7Validator is None:
        return []
    if not schema:
        return []
    validator = Draft7Validator(schema=schema)
    return [err.message for err in sorted(validator.iter_errors(assembly), key=str)]


# ---------------------------------------------------------------------------
# Content / quality checks (docs/assembly-quality-standard.md)
# ---------------------------------------------------------------------------

def missing_required_content_fields(assembly: dict) -> list:
    missing = []
    for field, label in REQUIRED_CONTENT_FIELDS.items():
        value = assembly.get(field)
        if isinstance(value, str):
            empty = not value.strip()
        elif isinstance(value, list):
            empty = len(value) == 0
        else:
            empty = value is None
        if empty:
            missing.append(label)
    return missing


def compute_quality_score(assembly: dict, schema_errors: list) -> dict:
    """Implements the QS formula from docs/assembly-quality-standard.md."""
    s_schema = 1.0 if not schema_errors else 0.0

    description = assembly.get("description") or ""
    contractor_notes = assembly.get("contractorNotes") or ""
    s_length = 1.0 if (len(description) > 100 and len(contractor_notes) > 50) else 0.0

    clause_fields = [
        "proposalScopeOfWork",
        "proposalAssumptions",
        "proposalExclusions",
        "warrantyLanguage",
    ]
    clauses_present = sum(1 for f in clause_fields if str(assembly.get(f) or "").strip())
    s_clauses = clauses_present / len(clause_fields)

    required_inputs = assembly.get("requiredInputs") or []
    s_inputs = 1.0 if len(required_inputs) >= 2 else (0.5 if len(required_inputs) == 1 else 0.0)

    line_items = assembly.get("lineItems") or []
    valid_line_items = sum(
        1 for li in line_items
        if is_valid_uuid(li.get("costBookItemId")) and not is_placeholder_id(li.get("costBookItemId"))
    )
    s_items = 1.0 if valid_line_items >= 2 else (0.5 if valid_line_items == 1 else 0.0)

    weights = {
        "schema": 0.30,
        "length": 0.15,
        "clauses": 0.20,
        "inputs": 0.15,
        "items": 0.20,
    }
    score = (
        weights["schema"] * s_schema
        + weights["length"] * s_length
        + weights["clauses"] * s_clauses
        + weights["inputs"] * s_inputs
        + weights["items"] * s_items
    )

    if score >= 0.90:
        gate = "auto-approve"
    elif score >= 0.80:
        gate = "human-review"
    else:
        gate = "auto-reject"

    return {
        "score": round(score, 4),
        "gate": gate,
        "components": {
            "schema": s_schema,
            "length": s_length,
            "clauses": s_clauses,
            "inputs": s_inputs,
            "items": s_items,
        },
    }
