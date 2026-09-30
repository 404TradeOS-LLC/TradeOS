#!/usr/bin/env python3
"""Focused tests for scripts/approve-batch.py's Costbook item-level provenance gate.

Run with: python3 -m unittest discover packages/knowledge-engine/scripts/tests
(stdlib only; mirrors test_assembly_pipeline_common.py's importlib.util pattern for
loading a hyphenated script filename as a module, and test_package_root.py's use of
unittest.)

Only find_provenance_errors()/is_iso_datetime() are exercised directly -- approve_batch()
itself performs real file I/O, mutates runtime/active-run.json, and shells out to
publish_to_supabase.py, so it is intentionally not invoked here.
"""
import importlib.util
import unittest
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parents[1]
MODULE_PATH = SCRIPT_DIR / "approve-batch.py"

spec = importlib.util.spec_from_file_location("approve_batch", MODULE_PATH)
module = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(module)


def valid_item(**overrides):
    item = {
        "id": "11111111-1111-1111-1111-111111111111",
        "name": "Test Item",
        "category": "Concrete",
        "unit": "SF",
        "laborCost": "1.00",
        "materialCost": "1.00",
        "equipmentCost": "0.00",
        "provenanceStatus": "documented",
        "sourceName": "Example Authoritative Source",
        "sourceDate": "2026-01-15",
        "retrievedAt": "2026-09-10T00:00:00Z",
        "confidence": "high",
    }
    item.update(overrides)
    return item


class FindProvenanceErrorsTests(unittest.TestCase):
    def test_fully_populated_item_has_no_errors(self):
        self.assertEqual(module.find_provenance_errors([valid_item()]), [])

    def test_missing_required_field_is_reported(self):
        item = valid_item()
        del item["sourceName"]
        errors = module.find_provenance_errors([item])
        self.assertEqual(len(errors), 1)
        self.assertTrue(any("sourceName" in e for e in errors[0]["errors"]))

    def test_blank_string_field_counts_as_missing(self):
        item = valid_item(sourceName="   ")
        errors = module.find_provenance_errors([item])
        self.assertEqual(len(errors), 1)
        self.assertTrue(any("sourceName" in e for e in errors[0]["errors"]))

    def test_invalid_provenance_status_is_reported(self):
        item = valid_item(provenanceStatus="verified")
        errors = module.find_provenance_errors([item])
        self.assertTrue(any("Invalid provenanceStatus" in e for e in errors[0]["errors"]))

    def test_invalid_confidence_is_reported(self):
        item = valid_item(confidence="certain")
        errors = module.find_provenance_errors([item])
        self.assertTrue(any("Invalid confidence" in e for e in errors[0]["errors"]))

    def test_malformed_source_date_is_reported(self):
        item = valid_item(sourceDate="01/15/2026")
        errors = module.find_provenance_errors([item])
        self.assertTrue(any("sourceDate not in YYYY-MM-DD format" in e for e in errors[0]["errors"]))

    def test_malformed_retrieved_at_is_reported(self):
        item = valid_item(retrievedAt="not-a-timestamp")
        errors = module.find_provenance_errors([item])
        self.assertTrue(any("retrievedAt not a valid ISO 8601 timestamp" in e for e in errors[0]["errors"]))

    def test_multiple_items_report_independent_errors_by_index(self):
        items = [valid_item(), valid_item(sourceName=""), valid_item()]
        errors = module.find_provenance_errors(items)
        self.assertEqual([e["index"] for e in errors], [1])

    def test_empty_batch_has_no_errors(self):
        self.assertEqual(module.find_provenance_errors([]), [])


class IsIsoDatetimeTests(unittest.TestCase):
    def test_accepts_z_suffixed_utc_timestamp(self):
        self.assertTrue(module.is_iso_datetime("2026-09-10T00:00:00Z"))

    def test_accepts_offset_timestamp(self):
        self.assertTrue(module.is_iso_datetime("2026-09-10T00:00:00+00:00"))

    def test_rejects_garbage(self):
        self.assertFalse(module.is_iso_datetime("not-a-timestamp"))


if __name__ == "__main__":
    unittest.main()
