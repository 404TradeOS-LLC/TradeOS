-- Codex P2 (PR #1079 promotion review): the DES-10-F7 trigger only
-- checked the signature data-URL pattern, so
-- `data:image/png;base64,AA==` (one zero byte) and base64-encoded
-- "not an image" passed the database check even though they are not
-- images. The app validator
-- (app/modules/proposals/signatureValidation.ts) now requires the decoded
-- payload to start with the magic bytes of the declared type; this
-- migration carries the same rule into the database so the trigger — the
-- last line — rejects non-image signatures too.
--
-- The original migration (20261124150000_add_proposal_portal_acceptance)
-- is not edited. This migration replaces only the trigger function; the
-- trigger itself references the function by name, so it picks up the new
-- body with no drop/create.

create or replace function public.is_valid_signature_image(data_url text)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  -- Decode only after the pattern and length checks: a payload whose
  -- length is not a multiple of 4 cannot be canonical base64, and
  -- decode() would raise on it. The regex already guarantees the
  -- alphabet, so decode() cannot fail past this point.
  with decoded as (
    select
      substring(data_url from '^data:image/([a-z]+);base64,') as mime,
      case
        when data_url is null then null
        when data_url !~ '^data:image/(png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$' then null
        when length(split_part(data_url, ',', 2)) % 4 <> 0 then null
        else decode(split_part(data_url, ',', 2), 'base64')
      end as bytes
  )
  select case
    when bytes is null then false
    -- CASE (not AND) guards the get_byte() calls: get_byte() raises
    -- when the index is out of range, so the length check must be
    -- evaluated first, which only CASE guarantees.
    when mime = 'png' then
      case when octet_length(bytes) < 4 then false
        else get_byte(bytes, 0) = 137 and get_byte(bytes, 1) = 80 and get_byte(bytes, 2) = 78 and get_byte(bytes, 3) = 71 end
    when mime in ('jpeg', 'jpg') then
      case when octet_length(bytes) < 3 then false
        else get_byte(bytes, 0) = 255 and get_byte(bytes, 1) = 216 and get_byte(bytes, 2) = 255 end
    when mime = 'gif' then
      case when octet_length(bytes) < 4 then false
        else get_byte(bytes, 0) = 71 and get_byte(bytes, 1) = 73 and get_byte(bytes, 2) = 70 and get_byte(bytes, 3) = 56 end
    when mime = 'webp' then
      case when octet_length(bytes) < 12 then false
        else get_byte(bytes, 0) = 82 and get_byte(bytes, 1) = 73 and get_byte(bytes, 2) = 70 and get_byte(bytes, 3) = 70
          and get_byte(bytes, 8) = 87 and get_byte(bytes, 9) = 69 and get_byte(bytes, 10) = 66 and get_byte(bytes, 11) = 80 end
    else false
  end
  from decoded
$function$;

create or replace function public.enforce_customer_portal_proposal_response() returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if public.current_app_role() = 'portal_customer' then
    if old.id <> new.id
      or old.project_id <> new.project_id
      or old.estimate_id is distinct from new.estimate_id
      or old.company_name is distinct from new.company_name
      or old.show_line_item_detail <> new.show_line_item_detail
      or old.scope_of_work is distinct from new.scope_of_work
      or old.assumptions is distinct from new.assumptions
      or old.exclusions is distinct from new.exclusions
      or old.timeline is distinct from new.timeline
      or old.price_low is distinct from new.price_low
      or old.price_high is distinct from new.price_high
      or old.final_price is distinct from new.final_price
      or old.payment_schedule_json is distinct from new.payment_schedule_json
      or old.pdf_url is distinct from new.pdf_url
      or old.terms_and_conditions is distinct from new.terms_and_conditions
      or old.sent_at is distinct from new.sent_at
      or old.viewed_at is distinct from new.viewed_at
      or old.idempotency_key is distinct from new.idempotency_key
      or old.idempotency_hash is distinct from new.idempotency_hash
      or old.created_at <> new.created_at
      or old.status not in ('sent', 'viewed')
      or new.status not in ('accepted', 'declined')
      or old.responded_at is not null
      or new.responded_at is null
      or (new.status = 'accepted' and (
        new.signer_name is null
        or btrim(new.signer_name) = ''
        or new.signer_email is null
        or btrim(new.signer_email) = ''
        or new.signature_data_url is null
        or new.signature_data_url !~ '^data:image/(png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$'
        or not public.is_valid_signature_image(new.signature_data_url)
        or new.signed_at is null
        or new.declined_reason is not null
      ))
      or (new.status = 'declined' and (
        new.signer_name is not null
        or new.signer_email is not null
        or new.signature_data_url is not null
        or new.signature_ip_reported is not null
        or new.signature_user_agent_reported is not null
        or new.signed_at is not null
        or (new.declined_reason is not null and char_length(new.declined_reason) > 500)
      ))
    then
      raise exception 'Customer portal proposal response may only record the governed accept or decline of the sent proposal';
    end if;
  end if;
  return new;
end;
$function$;
