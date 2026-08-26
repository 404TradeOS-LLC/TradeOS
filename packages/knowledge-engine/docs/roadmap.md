# TradeOS Costbook Lab Roadmap

This document outlines the short-term and long-term plans for the Construction Knowledge Engine.

## Phase 1: Structure & Cleanup (Complete)
- [x] Create archive directories and relocate legacy SwiftUI and UI Studio files.
- [x] Set up modular knowledge-lab folders (`knowledge/`, `exports/`, `pipelines/`, `prompts/`).
- [x] Update imports and output paths in `pipelines/master_pipeline.py`.
- [x] Document core validation, normalization, pricing-sanity, and deduplication rules.

## Phase 2: Agentic Costbook Batches (In Progress)
- [/] Generate the first Tree Service assembly batch (10 items) with comprehensive metadata and ANSI specifications.
- [ ] Connect the generation pipeline to LLM agents using the templates in `prompts/agents/`.
- [ ] Standardize subcategories and keywords for all 24 registered trades.

## Phase 3: Regional Pricing & Live Indexing (Q3 2026)
- [ ] Connect the pipeline to live RSMeans or contractor price scrapers.
- [ ] Implement regional cost multipliers (converting Midwest baseline prices into national averages and localized city indexes).
- [ ] Tie material costs (concrete, lumber, steel) to commodity price indexes.

## Phase 4: Production Sync (Q4 2026)
- [ ] Configure GitHub Actions to run the pipeline automatically on merge to `main`.
- [ ] Integrate `.env` secrets for Supabase and deploy the generated `exports/sql/sync_final.sql` directly to live staging/production database instances.
- [ ] Build automated rollback hooks if post-deployment pricing sanity checks flag >5% anomalies.
