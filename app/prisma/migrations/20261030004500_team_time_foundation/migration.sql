-- Source-controlled equivalent of Supabase staging's 20260924145928 team_time_foundation.
-- Must be applied before 20261030010000_force_team_time_rls.
-- All tables start with RLS enabled and NO public/anonymous table grants.
-- Existing staging tables are preserved; do not overwrite data or policies.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS public.team_time_profiles (
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  user_id uuid NOT NULL REFERENCES public.users(id),
  worker_type text NOT NULL CONSTRAINT team_time_profiles_worker_type_check CHECK (worker_type IN ('employee','subcontractor')),
  subcontractor_id uuid REFERENCES public.subcontractors(id),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_time_profiles_pkey PRIMARY KEY (org_id,user_id),
  CONSTRAINT team_time_profile_subcontractor CHECK (
    (worker_type='employee' AND subcontractor_id IS NULL) OR worker_type='subcontractor'
  )
);
CREATE INDEX IF NOT EXISTS team_time_profiles_subcontractor_idx
  ON public.team_time_profiles (org_id,subcontractor_id) WHERE subcontractor_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.team_time_shifts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  worker_user_id uuid NOT NULL REFERENCES public.users(id),
  job_id uuid NOT NULL REFERENCES public.jobs(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  break_started_at timestamptz,
  break_minutes integer NOT NULL DEFAULT 0 CONSTRAINT team_time_shifts_break_minutes_check CHECK (break_minutes BETWEEN 0 AND 1440),
  note text NOT NULL DEFAULT '' CONSTRAINT team_time_shifts_note_check CHECK (char_length(note)<=500),
  status text NOT NULL DEFAULT 'open' CONSTRAINT team_time_shifts_status_check CHECK (status IN ('open','pending','approved')),
  corrected_at timestamptz,
  correction_reason text CONSTRAINT team_time_shifts_correction_reason_check CHECK (correction_reason IS NULL OR char_length(correction_reason) BETWEEN 1 AND 500),
  reviewed_at timestamptz,
  reviewed_by_id uuid REFERENCES public.users(id),
  last_actor_id uuid NOT NULL REFERENCES public.users(id),
  last_action text NOT NULL CONSTRAINT team_time_shifts_last_action_check CHECK (last_action IN ('clock_in','break_start','break_end','clock_out','correct','approve','reopen')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  worker_type text NOT NULL DEFAULT 'employee' CONSTRAINT team_time_shifts_worker_type_check CHECK (worker_type IN ('employee','subcontractor')),
  CONSTRAINT team_time_shifts_pkey PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS team_time_one_open_shift
  ON public.team_time_shifts (org_id,worker_user_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS team_time_shifts_worker
  ON public.team_time_shifts (org_id,worker_user_id,started_at DESC);
CREATE INDEX IF NOT EXISTS team_time_shifts_org_review
  ON public.team_time_shifts (org_id,status,started_at DESC);

CREATE TABLE IF NOT EXISTS public.team_time_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  shift_id uuid NOT NULL REFERENCES public.team_time_shifts(id),
  actor_user_id uuid NOT NULL REFERENCES public.users(id),
  action text NOT NULL,
  before_record jsonb,
  after_record jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_time_events_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS team_time_events_shift
  ON public.team_time_events (org_id,shift_id,occurred_at);

ALTER TABLE public.team_time_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_time_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_time_events ENABLE ROW LEVEL SECURITY;
-- Do not grant authenticated/anon access. The Edge Function's bypass-role
-- execution path is separately reviewed/tested; FORCE does not override it.
