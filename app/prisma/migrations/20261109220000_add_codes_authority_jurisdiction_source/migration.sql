-- Issue #946 TODO 2: minimal authority / jurisdiction / versioned-source
-- records for the Codes & Permits registry (expands the #945 read-only pilot).
--
-- Four tables, all global reference data (no org_id, no tenant rows):
--   codes_authority        governing authority (county / state / federal /
--                          municipality / utility)
--   codes_jurisdiction     geographic / legal scope governed by an authority
--   codes_source           one cited official source version (citation + URL
--                          + hash + metadata only; NEVER full model-code text)
--   codes_source_history   append-only version history for codes_source
--
-- These tables hold NO pricing, CostItem, Assembly, estimate, customer, or
-- payment data. Costbook evidence/provenance lives in
-- app/modules/costbook/provenance.ts (trust-state vocabulary),
-- supplierPrices47802.ts (retail pricing) and assemblies; none of those
-- models stores authority/jurisdiction/versioned-source records, so there
-- is no duplication. See docs/architecture/COSTBOOK_CODES_PERMITS_PILOT.md
-- ("No-duplication proof (TODO 2)").
--
-- RLS: readable by any authenticated session (current_app_org_id() IS NOT
-- NULL); the costbook.read permission is enforced at the API layer. There
-- are deliberately NO INSERT / UPDATE / DELETE policies for tenant roles:
-- writes go only through the governed ingestion path (TODO 3), which adds
-- its own flag-gated write policy. codes_source_history is append-only:
-- no UPDATE or DELETE policy exists for any role. Migrations and the seed
-- below run as the elevated admin role, which bypasses RLS.
--
-- MINIMAL CONTRACT CORRECTIONS vs the #946 TODO 2 text (see the TODO 2 doc
-- section in COSTBOOK_CODES_PERMITS_PILOT.md):
--   1. codes_source gains topics (text[]), summary, next_action. The pilot
--      API returns those three fields per item and the web page renders
--      summary/nextAction; without columns the DB-backed API could not
--      reproduce the pilot response. Nullable so governed ingestion (TODO 3)
--      is not forced to supply presentation text for every new source.
--   2. A partial unique index enforces the (authority_id, code_family,
--      citation) singleton when version_label IS NULL. PostgreSQL treats
--      NULLs as distinct in the specified UNIQUE
--      (authority_id, code_family, citation, version_label), so without it
--      two unversioned rows for the same citation could coexist.
--
-- Seed rows use fixed UUIDs so API ids are stable across environments.
-- source_hash is NULL for all six seed rows: the hash is set on the first
-- governed fetch (TODO 3); no fetched bytes exist yet to hash.
-- published_date is copied from the pilot registry's sourceDate and is NULL
-- where the pilot has null. No effective date is guessed: effective_date
-- stays NULL unless the source states one (none of the six does).

CREATE TABLE IF NOT EXISTS public.codes_authority (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  authority_kind text NOT NULL CONSTRAINT codes_authority_kind_check
    CHECK (authority_kind IN ('county', 'state', 'federal', 'municipality', 'utility')),
  state char(2) NOT NULL,
  county text NULL,
  source_url text NULL,
  contact text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT codes_authority_pkey PRIMARY KEY (id),
  CONSTRAINT codes_authority_name_state_county_key UNIQUE (name, state, county)
);

CREATE TABLE IF NOT EXISTS public.codes_jurisdiction (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  authority_id uuid NOT NULL REFERENCES public.codes_authority (id) ON DELETE RESTRICT,
  name text NOT NULL,
  jurisdiction_kind text NOT NULL CONSTRAINT codes_jurisdiction_kind_check
    CHECK (jurisdiction_kind IN ('county', 'municipality', 'unincorporated', 'state', 'federal', 'overlay')),
  state char(2) NOT NULL,
  county text NULL,
  gis_ref text NULL,
  parent_id uuid NULL REFERENCES public.codes_jurisdiction (id) ON DELETE SET NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT codes_jurisdiction_pkey PRIMARY KEY (id),
  CONSTRAINT codes_jurisdiction_authority_name_kind_key UNIQUE (authority_id, name, jurisdiction_kind)
);
CREATE INDEX IF NOT EXISTS codes_jurisdiction_state_county_idx
  ON public.codes_jurisdiction (state, county);

CREATE TABLE IF NOT EXISTS public.codes_source (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  jurisdiction_id uuid NULL REFERENCES public.codes_jurisdiction (id) ON DELETE SET NULL,
  authority_id uuid NOT NULL REFERENCES public.codes_authority (id) ON DELETE RESTRICT,
  code_family text NOT NULL,
  section text NULL,
  citation text NOT NULL,
  title text NOT NULL,
  source_url text NOT NULL,
  source_hash text NULL CONSTRAINT codes_source_hash_check
    CHECK (source_hash IS NULL OR source_hash ~ '^[0-9a-f]{64}$'),
  license_note text NULL,
  published_date date NULL,
  amended_date date NULL,
  effective_date date NULL,
  expiry_date date NULL,
  status text NOT NULL DEFAULT 'research' CONSTRAINT codes_source_status_check
    CHECK (status IN ('research', 'reviewed', 'superseded')),
  reviewed_at timestamptz NULL,
  reviewed_by text NULL,
  version_label text NULL,
  supersedes_id uuid NULL REFERENCES public.codes_source (id) ON DELETE SET NULL,
  topics text[] NOT NULL DEFAULT '{}',
  summary text NULL,
  next_action text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT codes_source_pkey PRIMARY KEY (id),
  CONSTRAINT codes_source_authority_family_citation_version_key
    UNIQUE (authority_id, code_family, citation, version_label)
);
-- Unversioned (version_label IS NULL) rows are singletons per
-- (authority, family, citation); see the header note.
CREATE UNIQUE INDEX IF NOT EXISTS codes_source_unversioned_key
  ON public.codes_source (authority_id, code_family, citation)
  WHERE version_label IS NULL;
CREATE INDEX IF NOT EXISTS codes_source_jurisdiction_idx
  ON public.codes_source (jurisdiction_id);
CREATE INDEX IF NOT EXISTS codes_source_authority_family_idx
  ON public.codes_source (authority_id, code_family);

CREATE TABLE IF NOT EXISTS public.codes_source_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.codes_source (id) ON DELETE RESTRICT,
  version_label text NOT NULL,
  source_hash text NULL CONSTRAINT codes_source_history_hash_check
    CHECK (source_hash IS NULL OR source_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL CONSTRAINT codes_source_history_status_check
    CHECK (status IN ('research', 'reviewed', 'superseded')),
  change_summary text NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by text NULL,
  CONSTRAINT codes_source_history_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS codes_source_history_source_recorded_idx
  ON public.codes_source_history (source_id, recorded_at DESC);

-- Row-level security: forced on every codes_* table.
ALTER TABLE public.codes_authority ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.codes_authority FORCE ROW LEVEL SECURITY;
ALTER TABLE public.codes_jurisdiction ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.codes_jurisdiction FORCE ROW LEVEL SECURITY;
ALTER TABLE public.codes_source ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.codes_source FORCE ROW LEVEL SECURITY;
ALTER TABLE public.codes_source_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.codes_source_history FORCE ROW LEVEL SECURITY;

-- Global reference reads: any authenticated session (org set by the
-- request-scoped database session) may read. Tenant isolation holds
-- because these tables carry no tenant data at all; costbook.read is
-- enforced at the API layer, as for other read-only catalog surfaces.
CREATE POLICY codes_authority_select_policy ON public.codes_authority
FOR SELECT USING (public.current_app_org_id() IS NOT NULL);
CREATE POLICY codes_jurisdiction_select_policy ON public.codes_jurisdiction
FOR SELECT USING (public.current_app_org_id() IS NOT NULL);
CREATE POLICY codes_source_select_policy ON public.codes_source
FOR SELECT USING (public.current_app_org_id() IS NOT NULL);
CREATE POLICY codes_source_history_select_policy ON public.codes_source_history
FOR SELECT USING (public.current_app_org_id() IS NOT NULL);

-- No INSERT / UPDATE / DELETE policy on any codes_* table: tenant roles
-- cannot write. The governed ingestion path (TODO 3) adds its own
-- flag-gated write policy. No UPDATE / DELETE policy on
-- codes_source_history for any role: history is append-only.

-- Seed: the six #945 pilot references, verbatim from
-- app/modules/costbook/codes/registry.ts (the seed source). Idempotent:
-- re-running this migration is a no-op for existing rows.
INSERT INTO public.codes_authority (id, name, authority_kind, state, county) VALUES
  ('94600001-0000-4000-8000-000000000001', 'Vigo County Area Planning', 'county', 'IN', 'Vigo'),
  ('94600001-0000-4000-8000-000000000002', 'Indiana Department of Homeland Security', 'state', 'IN', NULL),
  ('94600001-0000-4000-8000-000000000003', 'Indiana Department of Transportation', 'state', 'IN', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.codes_jurisdiction (id, authority_id, name, jurisdiction_kind, state, county, gis_ref, notes) VALUES
  ('94600002-0000-4000-8000-000000000001', '94600001-0000-4000-8000-000000000001', 'Vigo County', 'county', 'IN', 'Vigo', NULL,
   $$Vigo County, Indiana — county zoning scope for the UZO references. No GIS geometry yet; gis_ref stays NULL until authoritative parcel/GIS mapping (TODO 4).$$),
  ('94600002-0000-4000-8000-000000000002', '94600001-0000-4000-8000-000000000002', 'Indiana', 'state', 'IN', NULL, NULL,
   $$Statewide scope for the IDHS adopted-code index.$$),
  ('94600002-0000-4000-8000-000000000003', '94600001-0000-4000-8000-000000000003', 'Indiana', 'state', 'IN', NULL, NULL,
   $$Statewide scope for INDOT permit guidance.$$)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.codes_source
  (id, jurisdiction_id, authority_id, code_family, section, citation, title, source_url,
   source_hash, published_date, status, reviewed_at, version_label,
   topics, summary, next_action) VALUES
  ('94600003-0000-4000-8000-000000000001', '94600002-0000-4000-8000-000000000001', '94600001-0000-4000-8000-000000000001',
   'UZO', '§16', 'Vigo County UZO §16', 'Unified Zoning Ordinance — Sign Regulation',
   'https://www.vigocounty.in.gov/egov/docs/1088861399_472198.pdf',
   NULL, '1996-10-21', 'reviewed', '2026-11-08', NULL,
   ARRAY['signage', 'permits'],
   $$The county-published ordinance includes a sign-regulation section. Publication does not establish whether later amendments or parcel-specific restrictions apply.$$,
   $$Confirm the current amended ordinance, zoning district, sign classification, height and setback with Vigo County Area Planning before bidding or installing.$$),
  ('94600003-0000-4000-8000-000000000002', '94600002-0000-4000-8000-000000000001', '94600001-0000-4000-8000-000000000001',
   'UZO', '§5', 'Vigo County UZO §5', 'Unified Zoning Ordinance — Permits',
   'https://www.vigocounty.in.gov/egov/docs/1088861399_472198.pdf',
   NULL, '1996-10-21', 'reviewed', '2026-11-08', NULL,
   ARRAY['permits', 'signage', 'structural'],
   $$The county-published zoning ordinance contains permit provisions. The correct review office and current application requirements depend on the parcel and proposed work.$$,
   $$Ask the appropriate local permit office which zoning, building and sign permits and inspections are required for the specific project.$$),
  ('94600003-0000-4000-8000-000000000003', '94600002-0000-4000-8000-000000000002', '94600001-0000-4000-8000-000000000002',
   'IBC', NULL, '675 IAC 13-2.6', 'Indiana Building Code — state adoption register',
   'https://www.in.gov/dhs/boards-and-commissions/fpbsc-rules/',
   NULL, '2014-12-01', 'reviewed', '2026-11-08', NULL,
   ARRAY['structural', 'permits'],
   $$The official state rules listing identifies the adopted building-code edition. Proposed replacement codes are not automatically current or applicable.$$,
   $$Confirm the adopted edition on the job date and obtain the required structural design and local building review for the proposed sign foundation.$$),
  ('94600003-0000-4000-8000-000000000004', '94600002-0000-4000-8000-000000000002', '94600001-0000-4000-8000-000000000002',
   'NEC', NULL, '675 IAC 17-1.8', 'Indiana Electrical Code — state adoption register',
   'https://www.in.gov/dhs/boards-and-commissions/fpbsc-rules/',
   NULL, '2009-08-26', 'reviewed', '2026-11-08', NULL,
   ARRAY['electrical', 'permits'],
   $$The official state rules listing identifies the adopted electrical code. It does not approve any specific wiring method or installation.$$,
   $$Confirm current adoption, conductor and protection requirements, authorized installer, circuit design and inspections with the electrical authority.$$),
  ('94600003-0000-4000-8000-000000000005', '94600002-0000-4000-8000-000000000003', '94600001-0000-4000-8000-000000000003',
   'INDOT-PERMITS', NULL, 'INDOT — Outdoor Advertising Sign Permits', 'INDOT outdoor advertising sign permits',
   'https://www.in.gov/indot/doing-business-with-indot/permits/',
   NULL, NULL, 'reviewed', '2026-11-08', NULL,
   ARRAY['signage', 'permits', 'right-of-way'],
   $$INDOT regulates qualifying outdoor signs along designated control routes. On-premises and off-premises sign classifications can differ; proximity to a state road alone does not determine the permit.$$,
   $$Confirm the control route, property boundary, right-of-way and on-premises classification with INDOT District Permits before selecting a sign location.$$),
  ('94600003-0000-4000-8000-000000000006', '94600002-0000-4000-8000-000000000003', '94600001-0000-4000-8000-000000000003',
   'INDOT-PERMITS', NULL, 'INDOT — Above Ground Occupancy', 'INDOT right-of-way occupancy permits',
   'https://www.in.gov/indot/doing-business-with-indot/permits/',
   NULL, NULL, 'reviewed', '2026-11-08', NULL,
   ARRAY['right-of-way', 'electrical', 'permits'],
   $$INDOT lists permitting for qualifying above-ground installations within state right-of-way. A private fence-side run is not automatically an INDOT occupancy project.$$,
   $$Identify surveyed right-of-way and utility/easement boundaries; verify occupancy and electrical approval for the proposed route before installation.$$)
ON CONFLICT (id) DO NOTHING;
