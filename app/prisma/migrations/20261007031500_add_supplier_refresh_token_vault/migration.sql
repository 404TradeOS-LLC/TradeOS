-- Persist rotated ABC Supply refresh tokens in Supabase Vault without
-- exposing Vault itself to the application role. The private wrapper validates
-- the request/background RLS session and only permits owner/admin access to the
-- configured ABC supplier row.
--
-- CI/local integration uses stock PostgreSQL, where supabase_vault is absent.
-- In that environment the read helper safely returns NULL (env bootstrap token
-- remains usable) and the write helper fails closed if a rotation occurs.

create schema if not exists tradeos_private;
revoke all on schema tradeos_private from public;

do $migration$
begin
  if exists (
    select 1
    from pg_extension
    where extname = 'supabase_vault'
  ) then
    execute $sql$
      create or replace function tradeos_private.get_abc_supply_refresh_token(
        p_org_id uuid,
        p_supplier_id uuid
      )
      returns text
      language plpgsql
      security definer
      set search_path = ''
      as $function$
      declare
        v_secret_name text;
        v_refresh_token text;
      begin
        if public.current_app_user_id() is null
           or public.current_app_org_id() is distinct from p_org_id
           or coalesce(nullif(current_setting('app.role', true), ''), '') not in ('owner', 'admin') then
          raise exception 'ABC Supply credential access requires an owner/admin tenant session'
            using errcode = '42501';
        end if;

        if not exists (
          select 1
          from public.organization_memberships membership
          where membership.org_id = p_org_id
            and membership.user_id = public.current_app_user_id()
            and membership.status = 'active'
            and membership.role in ('owner', 'admin')
        ) then
          raise exception 'ABC Supply credential access requires an active owner/admin membership'
            using errcode = '42501';
        end if;

        if not exists (
          select 1
          from public.suppliers supplier
          where supplier.id = p_supplier_id
            and supplier.org_id = p_org_id
            and supplier.api_integration_key = 'ABC_SUPPLY'
        ) then
          raise exception 'ABC Supply supplier is not visible in the active organization'
            using errcode = '42501';
        end if;

        v_secret_name :=
          'tradeos.abc_supply.refresh_token.' || p_org_id::text || '.' || p_supplier_id::text;

        select nullif(btrim(secret.decrypted_secret), '')
        into v_refresh_token
        from vault.decrypted_secrets secret
        where secret.name = v_secret_name;

        return v_refresh_token;
      end;
      $function$
    $sql$;

    execute $sql$
      create or replace function tradeos_private.put_abc_supply_refresh_token(
        p_org_id uuid,
        p_supplier_id uuid,
        p_refresh_token text
      )
      returns void
      language plpgsql
      security definer
      set search_path = ''
      as $function$
      declare
        v_secret_name text;
        v_secret_id uuid;
      begin
        if p_refresh_token is null
           or btrim(p_refresh_token) = ''
           or length(p_refresh_token) > 8192 then
          raise exception 'ABC Supply refresh token must be 1-8192 characters'
            using errcode = '22023';
        end if;

        if public.current_app_user_id() is null
           or public.current_app_org_id() is distinct from p_org_id
           or coalesce(nullif(current_setting('app.role', true), ''), '') not in ('owner', 'admin') then
          raise exception 'ABC Supply credential access requires an owner/admin tenant session'
            using errcode = '42501';
        end if;

        if not exists (
          select 1
          from public.organization_memberships membership
          where membership.org_id = p_org_id
            and membership.user_id = public.current_app_user_id()
            and membership.status = 'active'
            and membership.role in ('owner', 'admin')
        ) then
          raise exception 'ABC Supply credential access requires an active owner/admin membership'
            using errcode = '42501';
        end if;

        if not exists (
          select 1
          from public.suppliers supplier
          where supplier.id = p_supplier_id
            and supplier.org_id = p_org_id
            and supplier.api_integration_key = 'ABC_SUPPLY'
        ) then
          raise exception 'ABC Supply supplier is not visible in the active organization'
            using errcode = '42501';
        end if;

        v_secret_name :=
          'tradeos.abc_supply.refresh_token.' || p_org_id::text || '.' || p_supplier_id::text;

        select secret.id
        into v_secret_id
        from vault.secrets secret
        where secret.name = v_secret_name;

        if v_secret_id is null then
          perform vault.create_secret(
            p_refresh_token,
            v_secret_name,
            'TradeOS ABC Supply OAuth refresh token'
          );
        else
          perform vault.update_secret(
            v_secret_id,
            p_refresh_token,
            v_secret_name,
            'TradeOS ABC Supply OAuth refresh token'
          );
        end if;
      end;
      $function$
    $sql$;
  else
    execute $sql$
      create or replace function tradeos_private.get_abc_supply_refresh_token(
        p_org_id uuid,
        p_supplier_id uuid
      )
      returns text
      language sql
      security definer
      set search_path = ''
      as $function$
        select null::text
      $function$
    $sql$;

    execute $sql$
      create or replace function tradeos_private.put_abc_supply_refresh_token(
        p_org_id uuid,
        p_supplier_id uuid,
        p_refresh_token text
      )
      returns void
      language plpgsql
      security definer
      set search_path = ''
      as $function$
      begin
        raise exception 'Durable ABC Supply refresh-token persistence requires Supabase Vault'
          using errcode = '0A000';
      end;
      $function$
    $sql$;
  end if;
end
$migration$;

revoke all on function tradeos_private.get_abc_supply_refresh_token(uuid, uuid) from public;
revoke all on function tradeos_private.put_abc_supply_refresh_token(uuid, uuid, text) from public;
