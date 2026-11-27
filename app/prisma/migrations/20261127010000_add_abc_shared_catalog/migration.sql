-- ABC shared-catalog importer, Phase 1 (issue #735): schema + RLS for the
-- shared ABC Supply reference catalog.
--
-- The four new tables are ORG-LESS BY DESIGN. They hold provider reference
-- data only (item number, description, manufacturer, hierarchy, units of
-- measure, dimensions) — no tenant data, no customer information, and NO
-- PRICES. Prices stay live via the authorized pricing lane (`pricing.read`)
-- and are never stored here; a catalog row containing a price is a defect.
-- Permission record: Penny Simpson (ABC Supply, apisupport@abcsupply.com),
-- 2026-11-25, Gmail 1a21437ff648b076 — storing one shared reference copy is
-- allowed when it serves mutual ABC customers doing business with ABC
-- Supply. If ABC narrows or revokes it, the importer stops and the stored
-- copy is dealt with per ABC's direction.
--
-- HIERARCHY DECISION (Phase 1): `abc_catalog_hierarchy` is a TABLE, not a
-- view over `abc_catalog_items.hierarchy_path`. Reasons:
--   1. Hierarchy is seeded from its own provider endpoint
--      (GET /api/product/v1/hierarchy — 9,059 paths per Phase 0), not from
--      item payloads, so a view over items would miss paths that have no
--      imported item yet and would couple hierarchy browse to the full item
--      import completing.
--   2. Hierarchy browse needs its own index (path_key PK + GIN on levels);
--      a view cannot carry one.
--   3. Phase 0 found a small set of hierarchy objects with empty level
--      nodes (8 per level in the sample). A table stores those paths as
--      returned instead of failing the import; the empty node is preserved
--      in `levels` and collapses to '' in `path_key`.
--
-- RLS model (mirrors the `codes_*` global-reference precedent,
-- 20261109220000_add_codes_authority_jurisdiction_source +
-- 20261109220000_add_codes_source_ingestion_rls):
--   - ENABLE + FORCE ROW LEVEL SECURITY on every new table.
--   - Global SELECT for any authenticated session
--     (`current_app_org_id() IS NOT NULL`): read is the point of a shared
--     reference copy, and there is no tenant data to leak.
--   - Writes are INGESTION-ONLY: INSERT/UPDATE allowed only inside a
--     transaction that sets the transaction-local `app.abc_catalog_ingestion`
--     flag. Only the governed importer service (Phase 2) ever sets that
--     flag, and only for the duration of its own transaction (mirrors the
--     `app.codes_ingestion` pattern). No tenant session, and no direct API
--     caller, can write these tables.
--   - No DELETE policy on any of the four tables: catalog rows are
--     soft-deactivated (`is_displayable = false`), never hard-deleted, so
--     history and tenant links survive; sync runs are the audit trail and
--     are never deleted.
--
-- GLOBAL SUPPLIER ROW (scope §2 decision): the catalog is shared, so its
-- supplier identity is a single global (org-less) ABC Supply row, seeded
-- here — the migration-seeded equivalent of extending
-- `npm run db:import-suppliers`, which only creates per-org rows. The row
-- is idempotent (ON CONFLICT on the new partial unique index) and has a
-- FIXED UUID so tests and the Phase 2 importer can reference it without
-- a lookup. The per-org ABC rows created by `db:import-suppliers` (and
-- referenced by ABC_SUPPLY_SANDBOX_SUPPLIER_ID in the pricing lane) are
-- untouched; the pricing lane keeps using them until Phase 5 adoption
-- switches to the global row.
-- A global row would be invisible under the existing org-scoped
-- `suppliers_select_policy` (org_id NULL never equals the session org),
-- so this migration adds `suppliers_global_select_policy`: org-less rows
-- are readable by any authenticated session. The existing write policy
-- still requires an org match, so no tenant session can write the global
-- row. The partial unique index guarantees at most one global row per
-- integration key.
--
-- This migration seeds NO catalog rows: all four catalog tables are empty
-- after it applies. The Phase 2 importer fills them.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------
-- abc_catalog_items: one row per ABC item number (the provider identity).
-- ---------------------------------------------------------------------------
CREATE TABLE public.abc_catalog_items (
  item_number           text PRIMARY KEY,
  description           text,
  marketing_description text,
  manufacturer          text,
  family_id             text,
  family_name           text,
  status                text NOT NULL DEFAULT 'Active',
  is_dimensional        boolean NOT NULL DEFAULT false,
  uoms                  jsonb NOT NULL DEFAULT '[]'::jsonb,
  dimensions            jsonb,
  color                 jsonb,
  finish                jsonb,
  weights               jsonb NOT NULL DEFAULT '[]'::jsonb,
  variations            jsonb NOT NULL DEFAULT '[]'::jsonb,
  prop65_warnings       jsonb NOT NULL DEFAULT '[]'::jsonb,
  hierarchy_path        jsonb,
  content_hash          text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  first_seen_at         timestamptz NOT NULL DEFAULT now(),
  last_seen_at          timestamptz NOT NULL DEFAULT now(),
  last_synced_at        timestamptz NOT NULL DEFAULT now(),
  is_displayable        boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.abc_catalog_items IS
  'Shared ABC Supply reference catalog (issue #735). Org-less by design; no tenant data and NO PRICES — prices stay live via the pricing lane.';

-- Trigram search across description + manufacturer + family_name for
-- Costbook search (scope §2).
CREATE INDEX abc_catalog_items_search_trgm_idx ON public.abc_catalog_items
  USING gin ((
    coalesce(description, '') || ' ' ||
    coalesce(manufacturer, '') || ' ' ||
    coalesce(family_name, '')
  ) gin_trgm_ops);

-- Hierarchy browse/filter without re-reading the provider.
CREATE INDEX abc_catalog_items_hierarchy_path_idx ON public.abc_catalog_items
  USING gin (hierarchy_path);

-- ---------------------------------------------------------------------------
-- abc_catalog_hierarchy: one row per distinct six-level hierarchy path.
-- path_key is the six level codes joined with '/'; a missing/empty code
-- collapses to '' (Phase 0 found 8 empty nodes per level in the sample).
-- Provider codes contain no '/', so the join is unambiguous; the full level
-- objects (code/label/name) are preserved in `levels`.
-- ---------------------------------------------------------------------------
CREATE TABLE public.abc_catalog_hierarchy (
  path_key      text PRIMARY KEY,
  level1_code   text,
  level1_label  text,
  level1_name   text,
  level2_code   text,
  level2_label  text,
  level2_name   text,
  level3_code   text,
  level3_label  text,
  level3_name   text,
  level4_code   text,
  level4_label  text,
  level4_name   text,
  level5_code   text,
  level5_label  text,
  level5_name   text,
  level6_code   text,
  level6_label  text,
  level6_name   text,
  levels        jsonb NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.abc_catalog_hierarchy IS
  'Distinct ABC hierarchy paths (issue #735). Seeded from GET /api/product/v1/hierarchy and from item payloads; org-less reference data.';

CREATE INDEX abc_catalog_hierarchy_levels_idx ON public.abc_catalog_hierarchy
  USING gin (levels);

-- ---------------------------------------------------------------------------
-- abc_catalog_sync_runs: one row per import/delta run (the audit trail).
-- ---------------------------------------------------------------------------
CREATE TABLE public.abc_catalog_sync_runs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind                  text NOT NULL CHECK (kind IN ('full', 'delta')),
  status                text NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'partial')),
  started_at            timestamptz NOT NULL DEFAULT now(),
  finished_at           timestamptz,
  provider_total_items  integer CHECK (provider_total_items IS NULL OR provider_total_items >= 0),
  provider_total_pages  integer CHECK (provider_total_pages IS NULL OR provider_total_pages >= 0),
  pages_processed       integer NOT NULL DEFAULT 0 CHECK (pages_processed >= 0),
  items_seen            integer NOT NULL DEFAULT 0 CHECK (items_seen >= 0),
  items_added           integer NOT NULL DEFAULT 0 CHECK (items_added >= 0),
  items_updated         integer NOT NULL DEFAULT 0 CHECK (items_updated >= 0),
  items_deactivated     integer NOT NULL DEFAULT 0 CHECK (items_deactivated >= 0),
  items_failed          integer NOT NULL DEFAULT 0 CHECK (items_failed >= 0),
  checkpoint_page       integer CHECK (checkpoint_page IS NULL OR checkpoint_page >= 0),
  correlation_id        text,
  error                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.abc_catalog_sync_runs IS
  'ABC catalog import/delta run reports (issue #735). checkpoint_page is the resume point; error is sanitized (no tokens, no payloads).';

CREATE INDEX abc_catalog_sync_runs_started_at_idx ON public.abc_catalog_sync_runs (started_at DESC);

-- ---------------------------------------------------------------------------
-- abc_catalog_sync_state: a single-row checkpoint read by the scheduler.
-- The id CHECK enforces exactly one row.
-- ---------------------------------------------------------------------------
CREATE TABLE public.abc_catalog_sync_state (
  id                    text PRIMARY KEY DEFAULT 'abc-catalog' CHECK (id = 'abc-catalog'),
  last_full_sync_at     timestamptz,
  last_delta_at         timestamptz,
  last_seen_total_items integer,
  last_seen_total_pages integer,
  last_successful_run_id uuid REFERENCES public.abc_catalog_sync_runs (id) ON DELETE SET NULL,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.abc_catalog_sync_state IS
  'Single-row ABC catalog sync checkpoint (issue #735). Written only by the importer; read by the scheduler.';

-- ---------------------------------------------------------------------------
-- RLS: forced on every catalog table; global read; ingestion-only writes.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_app_abc_catalog_ingestion() RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT coalesce(current_setting('app.abc_catalog_ingestion', true) = 'true', false)
$$;

ALTER TABLE public.abc_catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abc_catalog_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.abc_catalog_hierarchy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abc_catalog_hierarchy FORCE ROW LEVEL SECURITY;
ALTER TABLE public.abc_catalog_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abc_catalog_sync_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.abc_catalog_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abc_catalog_sync_state FORCE ROW LEVEL SECURITY;

-- Global reference reads: any authenticated session (org set by the
-- request-scoped database session) may read. Tenant isolation holds
-- because these tables carry no tenant data at all; costbook.read is
-- enforced at the API layer, as for other read-only catalog surfaces.
CREATE POLICY abc_catalog_items_select_policy ON public.abc_catalog_items
FOR SELECT USING (public.current_app_org_id() IS NOT NULL);
CREATE POLICY abc_catalog_hierarchy_select_policy ON public.abc_catalog_hierarchy
FOR SELECT USING (public.current_app_org_id() IS NOT NULL);
CREATE POLICY abc_catalog_sync_runs_select_policy ON public.abc_catalog_sync_runs
FOR SELECT USING (public.current_app_org_id() IS NOT NULL);
CREATE POLICY abc_catalog_sync_state_select_policy ON public.abc_catalog_sync_state
FOR SELECT USING (public.current_app_org_id() IS NOT NULL);

-- The ingestion transaction itself reads the current state without
-- depending on tenant session state (hash compare, checkpoint resume).
CREATE POLICY abc_catalog_items_ingest_select_policy ON public.abc_catalog_items
FOR SELECT USING (public.current_app_abc_catalog_ingestion());
CREATE POLICY abc_catalog_hierarchy_ingest_select_policy ON public.abc_catalog_hierarchy
FOR SELECT USING (public.current_app_abc_catalog_ingestion());
CREATE POLICY abc_catalog_sync_runs_ingest_select_policy ON public.abc_catalog_sync_runs
FOR SELECT USING (public.current_app_abc_catalog_ingestion());
CREATE POLICY abc_catalog_sync_state_ingest_select_policy ON public.abc_catalog_sync_state
FOR SELECT USING (public.current_app_abc_catalog_ingestion());

-- Ingestion-only writes (Phase 2 importer, under the flag).
CREATE POLICY abc_catalog_items_ingest_insert_policy ON public.abc_catalog_items
FOR INSERT WITH CHECK (public.current_app_abc_catalog_ingestion());
CREATE POLICY abc_catalog_items_ingest_update_policy ON public.abc_catalog_items
FOR UPDATE USING (public.current_app_abc_catalog_ingestion()) WITH CHECK (public.current_app_abc_catalog_ingestion());
CREATE POLICY abc_catalog_hierarchy_ingest_insert_policy ON public.abc_catalog_hierarchy
FOR INSERT WITH CHECK (public.current_app_abc_catalog_ingestion());
CREATE POLICY abc_catalog_hierarchy_ingest_update_policy ON public.abc_catalog_hierarchy
FOR UPDATE USING (public.current_app_abc_catalog_ingestion()) WITH CHECK (public.current_app_abc_catalog_ingestion());
CREATE POLICY abc_catalog_sync_runs_ingest_insert_policy ON public.abc_catalog_sync_runs
FOR INSERT WITH CHECK (public.current_app_abc_catalog_ingestion());
CREATE POLICY abc_catalog_sync_runs_ingest_update_policy ON public.abc_catalog_sync_runs
FOR UPDATE USING (public.current_app_abc_catalog_ingestion()) WITH CHECK (public.current_app_abc_catalog_ingestion());
CREATE POLICY abc_catalog_sync_state_ingest_insert_policy ON public.abc_catalog_sync_state
FOR INSERT WITH CHECK (public.current_app_abc_catalog_ingestion());
CREATE POLICY abc_catalog_sync_state_ingest_update_policy ON public.abc_catalog_sync_state
FOR UPDATE USING (public.current_app_abc_catalog_ingestion()) WITH CHECK (public.current_app_abc_catalog_ingestion());

-- No DELETE policy on any catalog table: rows are soft-deactivated, never
-- hard-deleted; sync runs are the audit trail.

-- ---------------------------------------------------------------------------
-- Global ABC Supply supplier row (org-less) + global-row read policy.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX suppliers_global_api_key_unique_idx
  ON public.suppliers (api_integration_key)
  WHERE org_id IS NULL;

CREATE POLICY suppliers_global_select_policy ON public.suppliers
FOR SELECT USING (org_id IS NULL AND public.current_app_org_id() IS NOT NULL);

-- Fixed UUID so tests and the Phase 2 importer can reference the global
-- row without a lookup. Idempotent: re-running this migration is a no-op
-- for the row.
INSERT INTO public.suppliers (id, org_id, name, website, api_integration_key)
VALUES ('73500001-0000-4000-8000-000000000001', NULL, 'ABC Supply', 'https://www.abcsupply.com', 'ABC_SUPPLY')
ON CONFLICT (api_integration_key) WHERE org_id IS NULL DO NOTHING;
