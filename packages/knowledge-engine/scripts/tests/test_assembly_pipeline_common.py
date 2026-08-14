#!/usr/bin/env python3

import importlib.util
import unittest
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parents[1]
MODULE_PATH = SCRIPT_DIR / "assembly_pipeline_common.py"

spec = importlib.util.spec_from_file_location("assembly_pipeline_common", MODULE_PATH)
module = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(module)


class AssemblyPipelineCommonPathTests(unittest.TestCase):
    def test_knowledge_dir_points_to_canonical_runtime_corpus(self):
        expected = module.PROJECT_ROOT / "knowledge" / "knowledge"
        self.assertEqual(module.KNOWLEDGE_DIR, expected)
        self.assertTrue((module.KNOWLEDGE_DIR / "assemblies").is_dir())

    def test_roofing_audit_sees_existing_assemblies(self):
        assemblies = module.load_existing_assemblies("roofing")
        self.assertGreater(len(assemblies), 0)
        self.assertTrue(any(assembly.get("name") for assembly in assemblies))


if __name__ == "__main__":
    unittest.main()
