"""Read-only staging public backup -> isolated local PostgreSQL restore evidence.
Never print exception details: PostgreSQL errors may contain restored row values.
"""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
from urllib.parse import urlsplit, unquote

REF = 'qfbgdkbamfaasmtjfyru'


def source_config(value):
    u = urlsplit(value)
    user = unquote(u.username or '')
    direct = u.hostname == f'db.{REF}.supabase.co' and u.port in (None, 5432)
    pool = u.hostname == 'aws-0-us-east-2.pooler.supabase.com' and u.port == 5432 and user.endswith('.' + REF)
    # No URI options: libpq host/hostaddr/service/options can redirect or alter safety.
    if u.scheme not in ('postgres', 'postgresql') or u.path != '/postgres' or u.query or u.fragment or not (direct or pool) or not user or not u.password:
        raise ValueError('Invalid staging connection identity')
    return dict(host=u.hostname, port=u.port or 5432, dbname='postgres', user=user,
                password=unquote(u.password), sslmode='require', connect_timeout=15,
                options='-c default_transaction_read_only=on -c statement_timeout=600000')


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, default=str).encode()).hexdigest()


def command(args, env):
    # Never inherit PGHOST/PGSERVICE/PGOPTIONS or log subprocess diagnostics.
    subprocess.run(args, env=env, check=True, stdout=subprocess.DEVNULL,
                   stderr=subprocess.DEVNULL, timeout=900)


def manifest(conn):
    from psycopg import sql
    tables = conn.execute("SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname").fetchall()
    if not tables:
        raise ValueError('No public tables')
    counts = {name: conn.execute(sql.SQL('SELECT count(*) FROM public.{}').format(sql.Identifier(name))).fetchone()[0] for name, _, _ in tables}
    columns = conn.execute("SELECT table_name,column_name,ordinal_position,data_type,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position").fetchall()
    policies = conn.execute("SELECT tablename,policyname,permissive,roles::text,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname").fetchall()
    constraints = conn.execute("SELECT c.relname,p.conname,pg_get_constraintdef(p.oid) FROM pg_constraint p JOIN pg_class c ON c.oid=p.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,p.conname").fetchall()
    indexes = conn.execute("SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname").fetchall()
    triggers = conn.execute("SELECT c.relname,t.tgname,pg_get_triggerdef(t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname").fetchall()
    functions = conn.execute("SELECT p.proname,pg_get_function_identity_arguments(p.oid),pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind IN ('f','p') AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e') ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)").fetchall()
    return dict(counts=counts, schema_digest=digest([tables, columns, policies, constraints, indexes, triggers, functions]), rls_tables=[name for name, enabled, forced in tables if enabled and forced])


def run():
    import psycopg
    from psycopg import sql
    if os.environ.get('GITHUB_REF') != 'refs/heads/main':
        raise ValueError('Main only')
    config = source_config(os.environ['STAGING_DATABASE_ADMIN_URL'])
    root = Path(os.environ['RUNNER_TEMP']).resolve()
    started = time.monotonic()
    work = Path(tempfile.mkdtemp(prefix='tradeos-restore-', dir=root))
    os.chmod(work, 0o700)
    try:
        receipt_path = root / 'staging-restore-receipt.json'
        receipt_path.unlink(missing_ok=True)
        backup = work / 'public.dump'
        backup.touch(mode=0o600)
        env = {k: v for k, v in os.environ.items() if not k.startswith('PG') and k != 'STAGING_DATABASE_ADMIN_URL'}
        env.update({('PGDATABASE' if k == 'dbname' else f'PG{k.upper()}'): str(v) for k, v in config.items()})
        with psycopg.connect(**config, autocommit=True) as source:
            source.execute('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
            snapshot = source.execute('SELECT pg_export_snapshot()').fetchone()[0]
            before = manifest(source)
            roles = source.execute("SELECT DISTINCT unnest(roles)::text FROM pg_policies WHERE schemaname='public'").fetchall()
            extensions = source.execute("SELECT extname FROM pg_extension WHERE extname IN ('pgcrypto','uuid-ossp','btree_gist','citext')").fetchall()
            command(['pg_dump', '--format=custom', '--schema=public', '--no-owner', '--no-privileges', '--snapshot=' + snapshot, '--file=' + str(backup)], env)
        local = dict(host='127.0.0.1', port=5432, dbname='rehearsal', user='postgres', password='disposable-only', connect_timeout=10)
        with psycopg.connect(**local, autocommit=True) as target:
            for (role,) in roles:
                if role not in ('public', 'postgres'):
                    target.execute(sql.SQL('CREATE ROLE {} NOLOGIN NOSUPERUSER NOBYPASSRLS').format(sql.Identifier(role)))
            for (extension,) in extensions:
                target.execute(sql.SQL('CREATE EXTENSION IF NOT EXISTS {}').format(sql.Identifier(extension)))
        local_env = env | {('PGDATABASE' if k == 'dbname' else f'PG{k.upper()}'): str(v) for k, v in local.items()}
        local_env['PGSSLMODE'] = 'disable'
        local_env['PGOPTIONS'] = '-c statement_timeout=600000'
        command(['pg_restore', '--exit-on-error', '--single-transaction', '--no-owner', '--no-privileges', '--dbname=rehearsal', str(backup)], local_env)
        with psycopg.connect(**local) as target:
            after = manifest(target)
            if before != after:
                raise ValueError('Restored manifest mismatch')
            if not before['rls_tables']:
                raise ValueError('No forced RLS tables')
            target.execute('CREATE ROLE restore_probe NOLOGIN NOSUPERUSER NOBYPASSRLS')
            target.execute('GRANT USAGE ON SCHEMA public TO restore_probe')
            target.execute('GRANT SELECT ON ALL TABLES IN SCHEMA public TO restore_probe')
            target.execute('SET LOCAL ROLE restore_probe')
            target.execute("SELECT set_config('app.user_id','00000000-0000-0000-0000-000000000000',true),set_config('app.org_id','00000000-0000-0000-0000-000000000000',true),set_config('app.role','viewer',true)")
            for table in before['rls_tables']:
                count = target.execute(sql.SQL('SELECT count(*) FROM public.{}').format(sql.Identifier(table))).fetchone()[0]
                if count != 0:
                    raise ValueError('Restricted role saw rows without membership')
            target.rollback()
        receipt = dict(status='passed', scope='actual-staging-public-schema-and-data-only', source_project=REF,
                       commit=os.environ.get('GITHUB_SHA'), run_id=os.environ.get('GITHUB_RUN_ID'),
                       elapsed_seconds=round(time.monotonic()-started, 2), backup_sha256=hashlib.file_digest(backup.open('rb'), 'sha256').hexdigest(),
                       **before, restricted_role_zero_rows=True,
                       limitations=['No Supabase auth/storage recovery', 'No production recovery claim', 'ACL/ownership excluded; restricted role independently granted SELECT', 'Snapshot point-in-time only; no WAL/PITR or RPO claim'])
        (root / 'staging-restore-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    finally:
        shutil.rmtree(work)


if __name__ == '__main__':
    try:
        run()
        print('Staging public database restore rehearsal passed; sanitized receipt retained.')
    except Exception:
        print('Staging public database restore rehearsal failed; raw backup cleaned; diagnostics suppressed.')
        raise SystemExit(1)
