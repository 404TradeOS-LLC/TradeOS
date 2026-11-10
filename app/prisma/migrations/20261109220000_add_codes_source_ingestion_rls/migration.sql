-- Governed Codes & Permits source ingestion RLS (issue #946, TODO 3).
--
-- MERGE DEPENDENCY — READ FIRST: this migration only secures the tables
-- TODO 2 creates (`codes_source`, `codes_source_history`, PR #960,
-- `feat/codes-permits-registry-946`, stacked on the #945 pilot branch).
-- It creates NO tables itself. If either table is missing it FAILS HARD
-- (following the team_time FORCE-RLS pattern) so Prisma can never record
-- a misleading "applied" migration on a database where the tables are
-- installed later. Merge chain: #945 -> #960 (TODO 2) -> this PR; do not
-- apply this migration before TODO 2 lands.
--
-- This migration shares the timestamp 20261109220000 with TODO 2's
-- migration (`..._add_codes_authority_jurisdiction_source`). The directory
-- names differ, so there is no filesystem collision, and Prisma applies
-- them in lexicographic order — TODO 2's directory sorts first, so the
-- tables exist before this migration runs.
--
-- Trust model (see docs/architecture/COSTBOOK_CODES_INGESTION.md):
-- - Both tables are GLOBAL-READ reference tables: any authenticated tenant
--   session (app.org_id set) may SELECT. They carry no org_id — official
--   sources are shared reference material, not tenant data. The API layer
--   additionally enforces costbook.read on every read route. The global
--   SELECT policies themselves come from TODO 2's migration; this
--   migration deliberately does NOT re-create them (duplicate policy
--   names would fail).
-- - Writes are INGESTION-ONLY: INSERT/UPDATE are allowed only inside a
--   transaction that sets the transaction-local `app.codes_ingestion`
--   flag. Only the governed service (`app/modules/costbook/codes/store.ts`)
--   ever sets that flag, and only for the duration of its own transaction
--   (mirrors the `app.resend_webhook` flag pattern). No tenant session,
--   and no direct API caller, can write these tables.
-- - No DELETE policy on either table: source versions are never deleted.
-- - No UPDATE/DELETE policy on `codes_source_history`: it is append-only.
-- - A reviewed row's content is never edited in place by the service; a
--   new version supersedes it. The UPDATE policy exists so the governed
--   service can perform the research -> reviewed / research -> superseded
--   status transitions and the old-head supersede flip — both under the
--   flag, both with a history entry + audit event in the same tx.
-- - Flag-scoped SELECT policies exist so the ingestion transaction itself
--   can read the current head (hash compare, version count) without
--   depending on tenant session state.

DO $codes_source_ingestion_rls$
DECLARE
  missing_tables text[] := ARRAY[]::text[];
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['codes_source', 'codes_source_history'] LOOP
    IF to_regclass(format('public.%I', tbl)) IS NULL THEN
      missing_tables := array_append(missing_tables, tbl);
    END IF;
  END LOOP;
  IF array_length(missing_tables, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'Codes & Permits source tables missing: %; merge TODO 2 (issue #946) before applying this migration', array_to_string(missing_tables, ',')
      USING ERRCODE = '42P01';
  END IF;
END
$codes_source_ingestion_rls$;

-- Transaction-local flag for the governed ingestion service. Mirrors
-- current_app_resend_webhook(): only the ingestion store transaction sets
-- app.codes_ingestion, and only for its own duration.
CREATE OR REPLACE FUNCTION public.current_app_codes_ingestion() RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT coalesce(current_setting('app.codes_ingestion', true) = 'true', false)
$$;

ALTER TABLE public.codes_source ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.codes_source FORCE ROW LEVEL SECURITY;
ALTER TABLE public.codes_source_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.codes_source_history FORCE ROW LEVEL SECURITY;

-- Global-read SELECT policies are owned by TODO 2's migration
-- (20261109220000_add_codes_authority_jurisdiction_source) and are
-- deliberately NOT re-created here: CREATE POLICY with an existing name
-- would fail once TODO 2 has applied.
-- The ingestion transaction itself reads the head without tenant context.
CREATE POLICY codes_source_ingest_select_policy ON public.codes_source
FOR SELECT USING (public.current_app_codes_ingestion());
-- Ingestion-only writes (new versions + status transitions).
CREATE POLICY codes_source_ingest_insert_policy ON public.codes_source
FOR INSERT WITH CHECK (public.current_app_codes_ingestion());
CREATE POLICY codes_source_ingest_update_policy ON public.codes_source
FOR UPDATE USING (public.current_app_codes_ingestion()) WITH CHECK (public.current_app_codes_ingestion());
-- No DELETE policy: source versions are never deleted.

CREATE POLICY codes_source_history_ingest_select_policy ON public.codes_source_history
FOR SELECT USING (public.current_app_codes_ingestion());
CREATE POLICY codes_source_history_ingest_insert_policy ON public.codes_source_history
FOR INSERT WITH CHECK (public.current_app_codes_ingestion());
-- No UPDATE or DELETE policy on codes_source_history: append-only.
