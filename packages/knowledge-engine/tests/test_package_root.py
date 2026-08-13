"""Focused tests for pipelines/package_root.py -- the Phase B canonical path resolver.

Run with: python3 -m unittest discover packages/knowledge-engine/tests
(stdlib only, no new dependency; mirrors the existing repo pattern of using built-in test
runners -- see scripts/__tests__/docs-check.test.mjs's use of node:test.)

These tests read only real, already-committed repository files (existence checks and directory
walks); none of them write, move, or delete anything, and none of them import or execute the
pipeline scripts that perform real I/O (master_pipeline.py, sync_manager.py,
publish_to_supabase.py) -- only the pure path-resolution helper they now depend on.
"""
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "pipelines"))

from package_root import (  # noqa: E402
    PackageRootResolutionError,
    REPO_MARKERS,
    resolve_export_root,
    resolve_package_root,
    resolve_repo_root,
)

REPO_ROOT = Path(__file__).resolve().parents[3]
PACKAGE_ROOT = REPO_ROOT / "packages" / "knowledge-engine"
DUPLICATE_ROOT = PACKAGE_ROOT / "knowledge-engine"


class ResolveRepoRootTests(unittest.TestCase):
    def test_default_start_resolves_to_the_real_repo_root(self):
        self.assertEqual(resolve_repo_root(), REPO_ROOT)

    def test_resolution_is_independent_of_which_real_subdirectory_it_starts_from(self):
        # Deterministic regardless of "cwd" in spirit: starting the walk from several different
        # real, unrelated locations inside the repo must converge on the identical root.
        starts = [
            REPO_ROOT,
            PACKAGE_ROOT,
            PACKAGE_ROOT / "pipelines" / "export",
            PACKAGE_ROOT / "scripts",
        ]
        results = {resolve_repo_root(start=start) for start in starts}
        self.assertEqual(results, {REPO_ROOT})

    def test_starting_from_inside_the_duplicate_tree_still_resolves_to_the_real_root(self):
        # The discriminating case: packages/knowledge-engine/knowledge-engine/ mirrors this
        # package's own directory names one level down. A naive __file__-relative resolver
        # would silently treat it as home. This must not.
        self.assertTrue(DUPLICATE_ROOT.is_dir(), "expected the nested duplicate tree to exist")
        dup_start = DUPLICATE_ROOT / "pipelines" / "export"
        result = resolve_repo_root(start=dup_start)
        self.assertEqual(result, REPO_ROOT)
        self.assertNotIn("knowledge-engine/knowledge-engine", str(result))

    def test_missing_markers_raises_a_clear_actionable_error(self):
        with tempfile.TemporaryDirectory() as outside_repo:
            with self.assertRaises(PackageRootResolutionError) as ctx:
                resolve_repo_root(start=Path(outside_repo))
            message = str(ctx.exception)
            self.assertIn(str(REPO_MARKERS[0]), message)
            self.assertIn(str(REPO_MARKERS[1]), message)

    def test_resolution_does_not_depend_on_generated_export_output_existing(self):
        # Regression test: the markers must be stable, committed source content, never
        # pipeline-generated output. If exports/json/costbook.json were a marker, an operator
        # deliberately clearing exports/ to force a clean rebuild could never resolve a root
        # to regenerate it into. Simulate that exact bootstrap scenario on a synthetic tree.
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp).resolve()
            (root / "app").mkdir()
            (root / "app" / "package.json").write_text("{}")
            (root / "packages" / "knowledge-engine").mkdir(parents=True)
            (root / "packages" / "knowledge-engine" / "README.md").write_text("# stub")
            # Deliberately no exports/json/costbook.json anywhere -- the bootstrap case.
            self.assertEqual(resolve_repo_root(start=root), root)


class ResolvePackageAndExportRootTests(unittest.TestCase):
    def test_resolve_package_root_matches_the_real_canonical_package_directory(self):
        self.assertEqual(resolve_package_root(), PACKAGE_ROOT)

    def test_resolve_export_root_defaults_to_the_canonical_exports_directory(self):
        self.assertEqual(resolve_export_root(), PACKAGE_ROOT / "exports")

    def test_resolve_export_root_never_defaults_to_the_deprecated_pipelines_exports_path(self):
        result = resolve_export_root()
        self.assertNotEqual(result, PACKAGE_ROOT / "pipelines" / "exports")

    def test_resolve_export_root_honors_an_explicit_override_and_warns(self):
        canonical = PACKAGE_ROOT / "exports"
        with tempfile.TemporaryDirectory() as override_dir:
            old_value = os.environ.get("KNOWLEDGE_ENGINE_EXPORT_ROOT")
            os.environ["KNOWLEDGE_ENGINE_EXPORT_ROOT"] = override_dir
            try:
                result = resolve_export_root()
            finally:
                if old_value is None:
                    os.environ.pop("KNOWLEDGE_ENGINE_EXPORT_ROOT", None)
                else:
                    os.environ["KNOWLEDGE_ENGINE_EXPORT_ROOT"] = old_value
            self.assertEqual(result, Path(override_dir).resolve())
            self.assertNotEqual(result, canonical)

    def test_resolve_export_root_with_override_matching_canonical_is_a_no_op(self):
        canonical = PACKAGE_ROOT / "exports"
        old_value = os.environ.get("KNOWLEDGE_ENGINE_EXPORT_ROOT")
        os.environ["KNOWLEDGE_ENGINE_EXPORT_ROOT"] = str(canonical)
        try:
            result = resolve_export_root()
        finally:
            if old_value is None:
                os.environ.pop("KNOWLEDGE_ENGINE_EXPORT_ROOT", None)
            else:
                os.environ["KNOWLEDGE_ENGINE_EXPORT_ROOT"] = old_value
        self.assertEqual(result.resolve(), canonical.resolve())


class RuntimeCriticalAssetsResolveTests(unittest.TestCase):
    """Proves the canonical shallow (doubled knowledge/knowledge) path actually resolves to
    real, on-disk files -- without importing app/modules/knowledge-runtime/loader.ts (out of
    scope for this phase; see PATHS.md for why TypeScript-side tests were not added here)."""

    def test_canonical_costbook_json_exists_under_the_canonical_export_root(self):
        costbook = resolve_export_root() / "json" / "costbook.json"
        self.assertTrue(costbook.is_file())

    def test_canonical_assembly_index_exists_under_the_doubled_knowledge_path(self):
        assembly_index = resolve_package_root() / "knowledge" / "knowledge" / "assembly-index.json"
        self.assertTrue(assembly_index.is_file())

    def test_shallow_knowledge_path_does_not_contain_the_runtime_critical_files(self):
        # Locks in the documented contract: the shallow packages/knowledge-engine/knowledge/
        # directory is NOT itself a data root -- only knowledge/knowledge/ is. If this ever
        # starts passing (i.e. the shallow path gains an assembly-index.json), PATHS.md's
        # canonical-path claim needs to be revisited, not silently left stale.
        shallow_assembly_index = resolve_package_root() / "knowledge" / "assembly-index.json"
        self.assertFalse(shallow_assembly_index.is_file())


if __name__ == "__main__":
    unittest.main()
