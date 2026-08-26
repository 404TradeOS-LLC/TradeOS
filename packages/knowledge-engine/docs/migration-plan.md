# Migration Plan: Costbook Editor to Knowledge Lab

> **Historical document (2026-07-16):** this describes the original migration plan and does not
> reflect the current tree. Two path details below no longer match reality: the `knowledge/`
> folder referenced in Phase 2/3 is actually `knowledge/knowledge/` on disk (e.g. the real path is
> `knowledge/knowledge/cost-items/costbook.json`, not `knowledge/cost-items/costbook.json`), and
> the `archive/` folder referenced in Phase 1 is actually `legacy-archive/archive/`. See
> [`packages/knowledge-engine/README.md`](../README.md) for the current canonical structure. This
> file is preserved as history and must not be used as current implementation guidance.

This document outlines the transition of the legacy desktop/mobile SwiftUI Costbook Editor into a dedicated local Construction Knowledge Engine.

## Objectives
1. **Remove UI Clutter**: Clean out SwiftUI components, app lifecycles, and desktop window states.
2. **Preserve Rules & Data**: Retain all contractor price points, validation logic, sync pipelines, and databases.
3. **Transition to Script-First Architecture**: Focus on code-driven generation and CI/CD ready database exports.

## Phase 1: Archive and Cleanup
Rather than permanently deleting experimental desktop code, we move them to the `archive/` folder:
- **macOS Swift App**: Move `CostBookEditor/` to `archive/legacy-swift-app/CostBookEditor`.
- **UI Studio**: Move `tools/ui_studio/` to `archive/legacy-ui-studio/ui_studio`.
- **Legacy Pipelines & Publishers**: Move older pipeline scripts (`pipeline.py`, `publish.py`, `generate_all.py`) to `archive/legacy-sync-experiments/`.

## Phase 2: Relocate Active Assets
We transition from the flat structure to a clean modular directory layout:
1. Move the database schema file `database/schema.sql` to `exports/sql/schema.sql`.
2. Move the master orchestrator `tools/master_pipeline.py` to `pipelines/master_pipeline.py`.
3. Move `tools/sync_manager.py` and `tools/publish_to_supabase.py` to `pipelines/export/`.
4. Move the Python trade agents from `tools/agents/` to `pipelines/generation/agents/`.
5. Extract rules (validation, normalization, deduplication, sanity) from python code and write them as human-readable Markdown SOPs in the `knowledge/` folder.

## Phase 3: Update Import/Export Paths
We update python file paths and imports:
- Configure `sys.path` in `pipelines/master_pipeline.py` to correctly resolve `pipelines/generation/agents/` and `pipelines/export/`.
- Update output directories so that finalized SQLite or JSON payloads write directly to `exports/json/costbook.json` and SQL migrations write to `exports/sql/sync_final.sql`.
- Copy master costbook drafts to `knowledge/cost-items/costbook.json`.

## Phase 4: Verification
Verify migration success by executing:
```bash
python3 pipelines/master_pipeline.py
```
This test run should succeed, validate 1,936 items, and successfully generate the export payloads in the new paths without errors.
