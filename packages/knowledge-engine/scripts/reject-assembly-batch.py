#!/usr/bin/env python3
"""
reject-assembly-batch.py

Rejects the active assembly run's current pending batch: moves the batch
JSON to review/rejected/, writes a rejection_log.txt sidecar explaining why
(per review/review-checklist.md), and leaves the batch number unchanged so
next-assembly-batch.py regenerates the same batch on the next run.

Usage:
    python3 scripts/reject-assembly-batch.py [reason text]
"""

import sys

from assembly_pipeline_common import (
    PROJECT_ROOT,
    REJECTED_DIR,
    batch_output_path,
    find_batch_entry,
    now_iso,
    require_active_run,
    save_active_run,
)

DEFAULT_REASON = "Quality issues / schema deviation"


def main() -> None:
    active = require_active_run()
    batch_number = active["currentBatch"]
    batch_path = batch_output_path(batch_number)
    entry = find_batch_entry(active, batch_number)

    if entry is None or entry.get("status") != "in_progress":
        print(
            f"[ERROR] Batch {batch_number} is not awaiting review "
            f"(status: {entry.get('status') if entry else 'not started'}). "
            "Run next-assembly-batch.py first.",
            file=sys.stderr,
        )
        sys.exit(1)

    if not batch_path.is_file():
        print(f"[ERROR] Batch file not found: {batch_path.relative_to(PROJECT_ROOT)}", file=sys.stderr)
        sys.exit(1)

    reason = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else DEFAULT_REASON

    REJECTED_DIR.mkdir(parents=True, exist_ok=True)
    rejected_path = REJECTED_DIR / batch_path.name
    batch_path.rename(rejected_path)

    log_path = rejected_path.with_suffix(".rejection_log.txt")
    log_path.write_text(
        f"Batch: {batch_number}\n"
        f"Trade: {active['trade']}\n"
        f"Rejected at: {now_iso()}\n"
        f"Reason: {reason}\n",
        encoding="utf-8",
    )

    print(f"Batch moved to rejected: {rejected_path.relative_to(PROJECT_ROOT)}")
    print(f"Rejection log written to: {log_path.relative_to(PROJECT_ROOT)}")
    print(f"Reason: {reason}")

    entry["status"] = "rejected"
    entry["rejectedAt"] = now_iso()
    entry["rejectionReason"] = reason
    save_active_run(active)

    print(f"\nBatch {batch_number} marked REJECTED. Batch number was not advanced.")
    print("Run `python3 scripts/next-assembly-batch.py` to regenerate the prompt for this batch.")


if __name__ == "__main__":
    main()
