"""Canonical, marker-validated repo/package-root resolver for the knowledge-engine pipeline.

Phase B path-canonicalization helper. See packages/knowledge-engine/PATHS.md for the full
path contract this implements. Mirrors the dual-marker safety property of
app/modules/knowledge-runtime/loader.ts's resolveKnowledgeEnginePaths(), generalized to a
bounded upward directory walk so it converges on the true repo root from anywhere inside
the tree, including a deep nested package/data directory that cannot itself satisfy both
repository markers unless it is the actual repository root.

This module's own file location (not the caller's) anchors the search, so every consumer
gets the same trustworthy starting point regardless of how it was invoked.
"""
import os
from pathlib import Path
from typing import Optional

_MAX_WALK_DEPTH = 8

# Both markers must be stable, hand-authored/committed files -- never pipeline-generated
# output. packages/knowledge-engine/exports/json/costbook.json was tried first, but that is
# exactly the file master_pipeline.py regenerates; requiring it to already exist broke the
# bootstrap case (an operator deliberately clears exports/ to force a clean rebuild, then
# can't resolve a root to rebuild it into). README.md is committed source content, present
# since Phase A, and not touched by any pipeline write path.
REPO_MARKERS = (
    Path("packages") / "knowledge-engine" / "README.md",
    Path("app") / "package.json",
)

EXPORT_ROOT_OVERRIDE_ENV_VAR = "KNOWLEDGE_ENGINE_EXPORT_ROOT"


class PackageRootResolutionError(RuntimeError):
    """Raised when no ancestor directory satisfies both REPO_MARKERS."""


def _has_repo_markers(candidate: Path) -> bool:
    return all((candidate / marker).is_file() for marker in REPO_MARKERS)


def resolve_repo_root(start: Optional[Path] = None) -> Path:
    """Walk upward from `start` (default: this module's own file location) looking for a
    directory that contains both REPO_MARKERS. Never trusts a single __file__-relative
    offset alone -- that is what protects callers from silently resolving into a non-canonical
    package/data directory.
    """
    candidate = (start or Path(__file__).resolve()).resolve()
    for _ in range(_MAX_WALK_DEPTH):
        if _has_repo_markers(candidate):
            return candidate
        parent = candidate.parent
        if parent == candidate:
            break
        candidate = parent
    raise PackageRootResolutionError(
        "Unable to locate the TradeOS repository root by walking up from "
        f"{start or Path(__file__).resolve()}. Expected an ancestor directory containing "
        f"both {REPO_MARKERS[0]} and {REPO_MARKERS[1]}. See packages/knowledge-engine/PATHS.md."
    )


def resolve_package_root(start: Optional[Path] = None) -> Path:
    """Canonical packages/knowledge-engine/ root."""
    return resolve_repo_root(start) / "packages" / "knowledge-engine"


def resolve_export_root(start: Optional[Path] = None) -> Path:
    """Canonical exports/ root, honoring an explicit KNOWLEDGE_ENGINE_EXPORT_ROOT override.

    Default (no override) always resolves to packages/knowledge-engine/exports -- this is
    what makes future pipeline output deterministic regardless of invocation cwd. If the
    override is set to anything other than that canonical path, a warning is printed so a
    noncanonical output root is loud, not silent.
    """
    canonical = resolve_package_root(start) / "exports"
    override = os.environ.get(EXPORT_ROOT_OVERRIDE_ENV_VAR)
    if not override:
        return canonical
    override_path = Path(override).resolve()
    if override_path != canonical.resolve():
        print(
            f"WARNING: {EXPORT_ROOT_OVERRIDE_ENV_VAR}={override_path} overrides the "
            f"canonical export root {canonical}. This is a noncanonical output location -- "
            "see packages/knowledge-engine/PATHS.md."
        )
    return override_path
