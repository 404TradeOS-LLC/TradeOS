"""Read-only staging public backup -> isolated local PostgreSQL restore evidence.
Never print exception details: PostgreSQL errors may contain restored row values.
"""
import hashlib
import json
import os
import re
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
from urllib.parse import urlsplit, unquote, parse_qsl

REF = 'qfbgdkbamfaasmtjfyru'


class PreflightError(ValueError):
    """Fixed diagnostic codes; never retain a credential or URI component."""
    def __init__(self, code):
        self.code = code
        super().__init__(code)


def source_config(value):
    try:
        u = urlsplit(value)
        port = u.port
        user = unquote(u.username or '')
        query = parse_qsl(u.query, keep_blank_values=True, strict_parsing=True)
    except ValueError:
        raise PreflightError('SOURCE_URI_MALFORMED') from None
    if u.scheme not in ('postgres', 'postgresql') or u.fragment:
        raise PreflightError('SOURCE_URI_FORMAT')
    if u.path != '/postgres':
        raise PreflightError('SOURCE_DATABASE_REJECTED')
    # Permit only conventional TLS/public-schema hints. Never pass URI options to libpq:
    # host/hostaddr/service/options could redirect or change read-only safety.
    allowed_query = {'sslmode': 'require', 'schema': 'public'}
    if len({key for key, _ in query}) != len(query) or any(allowed_query.get(key) != value for key, value in query):
        raise PreflightError('SOURCE_QUERY_REJECTED')
    direct = u.hostname == f'db.{REF}.supabase.co' and port in (None, 5432)
    pool = (u.hostname == 'aws-0-us-east-2.pooler.supabase.com' and port in (5432, 6543)
            and re.fullmatch(r'[a-zA-Z_][a-zA-Z0-9_]*\.' + REF, user) is not None)
    if not (direct or pool):
        raise PreflightError('SOURCE_HOST_OR_PORT_REJECTED')
    if not user or not u.password:
        raise PreflightError('SOURCE_CREDENTIAL_MISSING')
    # Match the existing staging migration contract: same verified pooler host/user,
    # always session mode. An exported snapshot cannot use transaction pooling.
    return dict(host=u.hostname, port=5432, dbname='postgres', user=user,
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


PHASE = 'preflight'
SUPPORTED_EXTENSIONS = {'pgcrypto', 'uuid-ossp', 'btree_gist', 'citext', 'pg_trgm'}


def extension_plan(rows):
    for name, namespace in rows:
        if name not in SUPPORTED_EXTENSIONS or namespace not in ('public', 'extensions'):
            raise ValueError('Unsupported extension or namespace')
    return rows


def public_extension_dependencies(seeds, edges, extensions):
    """Follow catalog references plus internally/automatically owned objects.

    Table defaults, policies, constraints, indexes and rewrite rules can own the
    extension reference while lacking their own namespace dependency. Follow
    their ownership edges back from the seeded public table as well.
    """
    graph = {}
    for cls, obj, refcls, refobj, kind in edges:
        graph.setdefault((cls, obj), set()).add((refcls, refobj))
        if kind in ('i', 'a'):
            graph.setdefault((refcls, refobj), set()).add((cls, obj))
    visited = set()
    pending = list(seeds)
    while pending:
        node = tuple(pending.pop())
        if node in visited:
            continue
        visited.add(node)
        pending.extend(graph.get(node, set()) - visited)
    return extension_plan(sorted((name, namespace) for cls, obj, name, namespace in extensions
                                 if (cls, obj) in visited and name != 'plpgsql'))


def tenant_probe_columns(columns, tables):
    return {table: [name for owner, name in columns if owner == table and name in ('org_id', 'organization_id')]
            for table in tables}


def probe_outcome(tenant_count, global_count):
    if tenant_count != 0:
        raise ValueError('Restricted role saw tenant rows without membership')
    return {'status': 'tenant_rows_denied', 'visible_tenant_rows': 0, 'visible_global_rows': global_count}


def failure_metadata(error):
    if isinstance(error, PreflightError):
        return {'status': 'failed', 'phase': PHASE, 'code': error.code}
    code = getattr(error, 'sqlstate', None)
    if not isinstance(code, str) or not re.fullmatch(r'[0-9A-Z]{5}', code):
        code = 'SUBPROCESS_FAILED' if isinstance(error, subprocess.CalledProcessError) else 'REHEARSAL_FAILED'
    return {'status': 'failed', 'phase': PHASE, 'code': code}


def run():
    global PHASE
    PHASE = 'preflight'
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
        PHASE = 'source_snapshot'
        with psycopg.connect(**config, autocommit=True) as source:
            source.execute('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
            snapshot = source.execute('SELECT pg_export_snapshot()').fetchone()[0]
            before = manifest(source)
            roles = source.execute("SELECT DISTINCT unnest(roles)::text FROM pg_policies WHERE schemaname='public'").fetchall()
            extension_catalog = source.execute("SELECT 'pg_extension'::regclass::oid,e.oid,e.extname,n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace").fetchall()
            seeds = source.execute("SELECT d.classid,d.objid FROM pg_depend d WHERE d.refclassid='pg_namespace'::regclass AND d.refobjid='public'::regnamespace AND NOT EXISTS (SELECT 1 FROM pg_depend member WHERE member.classid=d.classid AND member.objid=d.objid AND member.deptype='e')").fetchall()
            edges = source.execute("SELECT classid,objid,refclassid,refobjid,deptype FROM pg_depend").fetchall()
            extensions = public_extension_dependencies(seeds, edges, extension_catalog)
            columns = source.execute("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,column_name").fetchall()
            probe_columns = tenant_probe_columns(columns, before['rls_tables'])
            PHASE = 'source_dump'
            command(['pg_dump', '--format=custom', '--schema=public', '--no-owner', '--no-privileges', '--snapshot=' + snapshot, '--file=' + str(backup)], env)
        local = dict(host='127.0.0.1', port=5432, dbname='rehearsal', user='postgres', password='disposable-only', connect_timeout=10)
        PHASE = 'local_bootstrap'
        with psycopg.connect(**local, autocommit=True) as target:
            for (role,) in roles:
                if role not in ('public', 'postgres'):
                    target.execute(sql.SQL('CREATE ROLE {} NOLOGIN NOSUPERUSER NOBYPASSRLS').format(sql.Identifier(role)))
            for extension, namespace in extensions:
                target.execute(sql.SQL('CREATE SCHEMA IF NOT EXISTS {}').format(sql.Identifier(namespace)))
                target.execute(sql.SQL('CREATE EXTENSION IF NOT EXISTS {} WITH SCHEMA {}').format(sql.Identifier(extension), sql.Identifier(namespace)))
        local_env = env | {('PGDATABASE' if k == 'dbname' else f'PG{k.upper()}'): str(v) for k, v in local.items()}
        local_env['PGSSLMODE'] = 'disable'
        local_env['PGOPTIONS'] = '-c statement_timeout=600000'
        # Empty PostgreSQL databases already contain public; retain all archive
        # objects except that one schema creation (extensions need it first).
        PHASE = 'archive_catalog'
        catalog = subprocess.run(['pg_restore', '--list', str(backup)], env=local_env, check=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=60).stdout.decode()
        restore_list = work / 'restore.list'
        restore_list.touch(mode=0o600)
        restore_list.write_text('\n'.join(line for line in catalog.splitlines() if not re.match(r'^\d+; \d+ \d+ SCHEMA - public ', line)) + '\n')
        PHASE = 'local_restore'
        command(['pg_restore', '--use-list=' + str(restore_list), '--exit-on-error', '--single-transaction', '--no-owner', '--no-privileges', '--dbname=rehearsal', str(backup)], local_env)
        PHASE = 'manifest_comparison'
        with psycopg.connect(**local) as target:
            after = manifest(target)
            if before != after:
                raise ValueError('Restored manifest mismatch')
            if not before['rls_tables']:
                raise ValueError('No forced RLS tables')
            PHASE = 'restricted_role_probe'
            target.execute('CREATE ROLE restore_probe NOLOGIN NOSUPERUSER NOBYPASSRLS')
            target.execute('GRANT USAGE ON SCHEMA public TO restore_probe')
            target.execute('GRANT SELECT ON ALL TABLES IN SCHEMA public TO restore_probe')
            target.execute('SET LOCAL ROLE restore_probe')
            target.execute("SELECT set_config('app.user_id','00000000-0000-0000-0000-000000000000',true),set_config('app.org_id','00000000-0000-0000-0000-000000000000',true),set_config('app.role','viewer',true)")
            probe_results = {}
            for table, tenant_columns in probe_columns.items():
                if not tenant_columns:
                    probe_results[table] = {'status': 'unverified_no_direct_tenant_column'}
                    continue
                predicate = sql.SQL(' OR ').join(sql.SQL('{} IS NOT NULL').format(sql.Identifier(c)) for c in tenant_columns)
                count = target.execute(sql.SQL('SELECT count(*) FROM public.{} WHERE ').format(sql.Identifier(table)) + predicate).fetchone()[0]
                if count != 0:
                    raise ValueError('Restricted role saw tenant rows without membership')
                global_count = target.execute(sql.SQL('SELECT count(*) FROM public.{} WHERE NOT (').format(sql.Identifier(table)) + predicate + sql.SQL(')')).fetchone()[0]
                probe_results[table] = probe_outcome(count, global_count)
            if not any(p['status'] == 'tenant_rows_denied' for p in probe_results.values()):
                raise ValueError('No direct tenant probe coverage')
            target.rollback()
        receipt = dict(status='passed', scope='actual-staging-public-schema-and-data-only', source_project=REF,
                       commit=os.environ.get('GITHUB_SHA'), run_id=os.environ.get('GITHUB_RUN_ID'),
                       elapsed_seconds=round(time.monotonic()-started, 2), backup_sha256=hashlib.file_digest(backup.open('rb'), 'sha256').hexdigest(),
                       **before, restricted_role_probes=probe_results, extension_namespaces=extensions,
                       limitations=['Child tables without direct tenant columns are unverified by restricted-role probe', 'No Supabase auth/storage recovery', 'No production recovery claim', 'ACL/ownership excluded; restricted role independently granted SELECT', 'Snapshot point-in-time only; no WAL/PITR or RPO claim'])
        (root / 'staging-restore-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    finally:
        shutil.rmtree(work)


if __name__ == '__main__':
    try:
        run()
        print('Staging public database restore rehearsal passed; sanitized receipt retained.')
    except Exception as error:
        print(json.dumps(failure_metadata(error), sort_keys=True))
        raise SystemExit(1)
