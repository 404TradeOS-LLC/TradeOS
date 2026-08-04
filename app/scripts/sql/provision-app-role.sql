-- Idempotently creates (or updates the password/attributes of) the
-- restricted application role, then grants it the same permissions on
-- every existing table/sequence/function in the public schema, and sets
-- default privileges so future migrations don't silently leave new objects
-- ungranted until someone remembers to re-run this script.
--
-- Invoked via psql -v role_name=... -v role_password=... — never edit this
-- file to hardcode a real password.
-- psql variable interpolation (:'var') doesn't happen inside dollar-quoted
-- (DO $$ ... $$) blocks, so the create-or-alter branch is built and run via
-- \gexec instead of PL/pgSQL — substitution works normally here since
-- nothing below is dollar-quoted.
--
-- The ALTER branch deliberately omits nosuperuser/nocreatedb/nocreaterole
-- (only re-asserted on CREATE, where they're required to be specified at
-- all): PostgreSQL requires the *executing* role to itself be a true
-- superuser to touch the SUPERUSER/NOSUPERUSER clause in an ALTER ROLE
-- statement, regardless of direction or the target's current value — even
-- though CREATEROLE alone is sufficient to specify it on CREATE ROLE. On
-- Supabase, the admin `postgres` role has CREATEROLE but is not a true
-- superuser, so re-running this script against an already-provisioned
-- role failed with "permission denied to alter role" until this was split.
select format('alter role %I with login password %L', :'role_name', :'role_password')
where exists (select 1 from pg_roles where rolname = :'role_name')
union all
select format('create role %I login password %L nosuperuser nocreatedb nocreaterole noinherit', :'role_name', :'role_password')
where not exists (select 1 from pg_roles where rolname = :'role_name')
\gexec

grant usage on schema public to :"role_name";
grant select, insert, update, delete on all tables in schema public to :"role_name";

-- Prisma migration history is an administrator-only control plane. Keep this
-- explicit exception after the broad table grant so every idempotent role
-- reprovision preserves the boundary for both existing and newly-created
-- application roles.
revoke all privileges on table public._prisma_migrations from :"role_name";

grant usage, select on all sequences in schema public to :"role_name";
grant execute on all functions in schema public to :"role_name";

alter default privileges in schema public grant select, insert, update, delete on tables to :"role_name";
alter default privileges in schema public grant usage, select on sequences to :"role_name";
alter default privileges in schema public grant execute on functions to :"role_name";
