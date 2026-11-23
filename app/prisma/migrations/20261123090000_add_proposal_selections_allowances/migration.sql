-- DES-10-F8: Copperline proposal sections 03 (selections) and 04 (allowances).
-- Additive only: two new tables, no existing table is altered and no existing
-- migration is replayed.
--
--   proposal_selections — one row per customer decision on a proposal.
--     label is the selection category ("CABINET FINISH", "COUNTERTOP",
--     "PENDANTS"); detail is the chosen option text ("Rift white oak ·
--     clear matte") and is NULL while the decision is still open; status is
--     "action_required" (Figma ACTION REQUIRED) or "confirmed" (Figma
--     CONFIRMED); due_date is the nullable decision deadline (Figma
--     "Choose by Oct 09").
--   proposal_allowances — one row per allowance line ("PENDANT LIGHTING"
--     $1,200, "CABINET HARDWARE" $1,600; Figma total $2,800 is the sum of
--     the rows, computed at read time, never stored).
--
-- Neither table feeds the proposal total: finalPrice is untouched by this
-- migration and by the service. Wiring allowance sums into totals is a
-- separate follow-up (see docs/modules/proposals.md); the existing total
-- pipeline has no clean hook for it.
--
-- Tenant scope mirrors proposal_deliveries: each row carries its own org_id
-- (set by the service from the owning proposal's project, never from caller
-- input) and forced RLS scopes reads and writes to the session org.

CREATE TABLE IF NOT EXISTS public.proposal_selections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  label text NOT NULL CONSTRAINT proposal_selections_label_check CHECK (char_length(label) BETWEEN 1 AND 120),
  detail text CONSTRAINT proposal_selections_detail_check CHECK (detail IS NULL OR char_length(detail) BETWEEN 1 AND 500),
  status text NOT NULL DEFAULT 'action_required' CONSTRAINT proposal_selections_status_check CHECK (status IN ('action_required', 'confirmed')),
  due_date timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT proposal_selections_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS proposal_selections_proposal_sort_idx
  ON public.proposal_selections (proposal_id, sort_order, created_at);

CREATE TABLE IF NOT EXISTS public.proposal_allowances (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  description text NOT NULL CONSTRAINT proposal_allowances_description_check CHECK (char_length(description) BETWEEN 1 AND 200),
  amount numeric(14, 2) NOT NULL CONSTRAINT proposal_allowances_amount_check CHECK (amount >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT proposal_allowances_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS proposal_allowances_proposal_sort_idx
  ON public.proposal_allowances (proposal_id, sort_order, created_at);

ALTER TABLE public.proposal_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_selections FORCE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_allowances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_allowances FORCE ROW LEVEL SECURITY;

CREATE POLICY proposal_selections_select_policy ON public.proposal_selections
FOR SELECT USING (
  org_id = (SELECT public.current_app_org_id())
);

CREATE POLICY proposal_selections_write_policy ON public.proposal_selections
FOR ALL USING (
  org_id = (SELECT public.current_app_org_id()) AND (SELECT public.current_app_can_write())
) WITH CHECK (
  org_id = (SELECT public.current_app_org_id()) AND (SELECT public.current_app_can_write())
);

CREATE POLICY proposal_allowances_select_policy ON public.proposal_allowances
FOR SELECT USING (
  org_id = (SELECT public.current_app_org_id())
);

CREATE POLICY proposal_allowances_write_policy ON public.proposal_allowances
FOR ALL USING (
  org_id = (SELECT public.current_app_org_id()) AND (SELECT public.current_app_can_write())
) WITH CHECK (
  org_id = (SELECT public.current_app_org_id()) AND (SELECT public.current_app_can_write())
);
