-- Additive only: durable Resend delivery-event journal (issue #927).
-- No existing table is altered and no existing migration is replayed.
--
-- Two tables:
--   email_delivery_messages — outbound journal. One row per provider send,
--     keyed by Resend's provider message id (unique). org_id is nullable by
--     design: password-reset mail is user-wide and must never have a tenant
--     guessed for it. recipient_digest is a SHA-256 hex digest only; no
--     recipient plaintext, action-link token, raw HTML, or provider secret
--     is ever stored here.
--   email_delivery_events — verified event inbox. One row per Svix delivery,
--     keyed by svix-id (unique) so duplicate provider retries are no-ops.
--     Only allowlisted metadata is stored; the raw payload is never stored,
--     only its irreversible SHA-256 digest (payload_digest).
--
-- No suppression is performed by this migration. A hard bounce or complaint
-- only sets suppression_candidate on the owning tenant's journal row; acting
-- on it is governed by docs/modules/resend-delivery-suppression-policy.md.
-- The webhook receiver itself is NOT registered by this migration; staging
-- application and webhook registration are separate later approvals.
-- No grants to anon/authenticated: tenant sessions read only their own org's
-- rows, and all writes go through the transaction-local app.resend_webhook
-- flag set only inside the server-only Prisma webhook store transaction.
-- This mirrors the app.login_lookup flag pattern (migration
-- 20260624120000_add_users_login_lookup_policy): the flag policy only ever
-- widens access for the duration of that one server transaction.

CREATE TABLE IF NOT EXISTS public.email_delivery_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider_message_id text NOT NULL CONSTRAINT email_delivery_messages_provider_message_id_check CHECK (char_length(provider_message_id) BETWEEN 1 AND 256),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL CONSTRAINT email_delivery_messages_kind_check CHECK (kind IN ('password_reset', 'team_invite', 'customer_portal_access')),
  recipient_digest text CONSTRAINT email_delivery_messages_recipient_digest_check CHECK (recipient_digest IS NULL OR recipient_digest ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'sent' CONSTRAINT email_delivery_messages_status_check CHECK (status IN ('sent', 'delivered', 'delayed', 'failed', 'bounced', 'complained', 'suppressed')),
  suppression_candidate boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_delivery_messages_pkey PRIMARY KEY (id),
  CONSTRAINT email_delivery_messages_provider_message_id_key UNIQUE (provider_message_id)
);
CREATE INDEX IF NOT EXISTS email_delivery_messages_org_created_idx
  ON public.email_delivery_messages (org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.email_delivery_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  svix_id text NOT NULL CONSTRAINT email_delivery_events_svix_id_check CHECK (char_length(svix_id) BETWEEN 1 AND 256),
  event_type text NOT NULL CONSTRAINT email_delivery_events_event_type_check CHECK (char_length(event_type) BETWEEN 1 AND 64),
  provider_message_id text CONSTRAINT email_delivery_events_provider_message_id_check CHECK (provider_message_id IS NULL OR char_length(provider_message_id) BETWEEN 1 AND 256),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  payload_digest text NOT NULL CONSTRAINT email_delivery_events_payload_digest_check CHECK (payload_digest ~ '^[0-9a-f]{64}$'),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_delivery_events_pkey PRIMARY KEY (id),
  CONSTRAINT email_delivery_events_svix_id_key UNIQUE (svix_id)
);
CREATE INDEX IF NOT EXISTS email_delivery_events_provider_message_idx
  ON public.email_delivery_events (provider_message_id, received_at DESC);
CREATE INDEX IF NOT EXISTS email_delivery_events_org_received_idx
  ON public.email_delivery_events (org_id, received_at DESC);

-- Transaction-local flag for the server-only webhook store. Mirrors
-- current_app_login_lookup(): only the Prisma webhook store transaction sets
-- app.resend_webhook, and only for its own duration.
CREATE OR REPLACE FUNCTION public.current_app_resend_webhook() RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT coalesce(current_setting('app.resend_webhook', true) = 'true', false)
$$;

ALTER TABLE public.email_delivery_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_delivery_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.email_delivery_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_delivery_events FORCE ROW LEVEL SECURITY;

-- Tenant reads: only rows of the session's own org. Rows with a NULL org
-- (user-wide password-reset mail) are visible to no tenant session.
CREATE POLICY email_delivery_messages_select_policy ON public.email_delivery_messages
FOR SELECT USING (
  org_id IS NOT NULL AND org_id = (SELECT public.current_app_org_id())
);
CREATE POLICY email_delivery_events_select_policy ON public.email_delivery_events
FOR SELECT USING (
  org_id IS NOT NULL AND org_id = (SELECT public.current_app_org_id())
);

-- Server-only webhook writes. These permissive policies OR with the select
-- policies above; the flag is set only inside the webhook store's own
-- transaction, so they only ever widen writes for that transaction.
CREATE POLICY email_delivery_messages_webhook_select_policy ON public.email_delivery_messages
FOR SELECT USING (public.current_app_resend_webhook());
CREATE POLICY email_delivery_messages_webhook_insert_policy ON public.email_delivery_messages
FOR INSERT WITH CHECK (public.current_app_resend_webhook());
CREATE POLICY email_delivery_messages_webhook_update_policy ON public.email_delivery_messages
FOR UPDATE USING (public.current_app_resend_webhook()) WITH CHECK (public.current_app_resend_webhook());
CREATE POLICY email_delivery_events_webhook_select_policy ON public.email_delivery_events
FOR SELECT USING (public.current_app_resend_webhook());
CREATE POLICY email_delivery_events_webhook_insert_policy ON public.email_delivery_events
FOR INSERT WITH CHECK (public.current_app_resend_webhook());

-- No UPDATE or DELETE policy on email_delivery_events: inbox rows are
-- append-only. No DELETE policy on email_delivery_messages: journal rows
-- are retained for audit.
