#!/usr/bin/env python3
"""
run_generation_batch.py

Usage: python3 scripts/run_generation_batch.py <prompt_file_path>

This script reads a prompt file (plain text) that describes a batch of 25 missing cost items to be generated.
It prints the prompt path and its content, then instructs the user to paste the prompt into Antigravity/Gemini.
The user should generate a JSON array of items and save it to:
    review/pending/<batch_id>.json
where <batch_id> is the prompt filename without its extension.
The script does **not** perform any automatic generation – it is a human‑in‑the‑loop helper.
"""
import sys
from pathlib import Path

def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python3 run_generation_batch.py <prompt_file_path>")
        sys.exit(1)

    prompt_path = Path(sys.argv[1])
    if not prompt_path.is_file():
        print(f"[ERROR] Prompt file not found: {prompt_path}")
        sys.exit(1)

    # Read and display the prompt
    prompt_text = prompt_path.read_text(encoding="utf-8")
    print("--- Prompt File ---")
    print(prompt_path)
    print("--- Content ---")
    print(prompt_text)
    print("--- End of Prompt ---\n")

    # Derive a batch identifier from the file name (without extension)
    batch_id = prompt_path.stem
    pending_path = Path("review/pending") / f"{batch_id}.json"
    print("Next steps (manual):")
    print(f"1. Open Antigravity/Gemini and paste the above prompt.")
    print(f"2. Generate exactly 25 cost‑book items in JSON format adhering to the schema.")
    print(f"3. Save the resulting JSON to: {pending_path}")
    print("4. Once the file exists, run `validate_batch.py` to validate and stage the items.")
    print("\nNote: This script does not modify any project files.")

if __name__ == "__main__":
    main()
