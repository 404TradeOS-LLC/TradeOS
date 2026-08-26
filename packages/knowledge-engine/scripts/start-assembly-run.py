#!/usr/bin/env python3
"""
start-assembly-run.py

Entry point for a controlled assembly-generation run. Requires a prior
`audit-assemblies.py --trade <trade>` run so the batches it schedules are
grounded in real coverage gaps rather than guesses.

Usage:
    python3 scripts/start-assembly-run.py --trade roofing --target 50 --batch-size 10
"""

import argparse
import sys

from assembly_pipeline_common import (
    ACTIVE_RUN_PATH,
    DEFAULT_BATCH_SIZE,
    DEFAULT_TARGET,
    PROJECT_ROOT,
    load_active_run,
    now_iso,
    require_audit,
    save_active_run,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Start a controlled assembly generation run.")
    parser.add_argument("--trade", required=True, help="Trade/domain focus, e.g. 'roofing'")
    parser.add_argument("--target", type=int, default=DEFAULT_TARGET, help="Total assemblies targeted for this run")
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE, help="Assemblies per batch (default 10)")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    trade = args.trade.lower()

    if args.batch_size <= 0:
        print("[ERROR] --batch-size must be a positive integer.", file=sys.stderr)
        sys.exit(1)
    if args.target <= 0:
        print("[ERROR] --target must be a positive integer.", file=sys.stderr)
        sys.exit(1)

    audit = require_audit(trade)

    existing = load_active_run()
    if existing and existing.get("status") == "active":
        print(
            f"Warning: An active assembly run for '{existing.get('trade')}' "
            f"(batch {existing.get('currentBatch')}) is already in progress."
        )
        confirm = input("Overwrite it and start a new run? (y/N): ").strip().lower()
        if confirm != "y":
            print("Aborted.")
            sys.exit(0)

    active_run = {
        "trade": trade,
        "target": args.target,
        "batchSize": args.batch_size,
        "currentBatch": 1,
        "completedCount": 0,
        "status": "active",
        "startedAt": now_iso(),
        # Names/slugs already produced across approved batches in this run,
        # merged with the audit's existing_assemblies to build the
        # "assemblies to avoid" list each new batch prompt gets.
        "generatedNames": [],
        "batches": [],
    }
    save_active_run(active_run)

    missing_categories = audit.get("missing_high_value_categories", [])
    print(f"\nAssembly run started for '{trade}'.")
    print(f"  Target: {args.target} assemblies ({args.batch_size} per batch)")
    print(f"  Existing assemblies on file: {audit.get('existing_assembly_count', 0)}")
    print(f"  Missing high-value categories: {', '.join(missing_categories) or 'none identified'}")
    print(f"  State written to: {ACTIVE_RUN_PATH.relative_to(PROJECT_ROOT)}")
    print("\nNext step: python3 scripts/next-assembly-batch.py")


if __name__ == "__main__":
    main()
