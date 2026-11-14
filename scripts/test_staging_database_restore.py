import importlib.util
import unittest
import tempfile
import types
import sys
from unittest.mock import patch
from pathlib import Path

spec = importlib.util.spec_from_file_location('restore', Path(__file__).with_name('staging-database-restore.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class GuardTests(unittest.TestCase):
    def test_canonical_direct_and_session_only(self):
        base = f'postgresql://postgres:secret@db.{m.REF}.supabase.co/postgres'
        self.assertEqual(m.source_config(base)['sslmode'], 'require')
        self.assertIn('default_transaction_read_only=on', m.source_config(base)['options'])
        for suffix in ('?host=evil', '?hostaddr=127.0.0.1', '?options=x', '#fragment', '?sslmode=disable'):
            with self.assertRaises(ValueError):
                m.source_config(base + suffix)
        for value in (base.replace(m.REF, 'kssaceuetdjwfqnbzhly'), base.replace('/postgres', '/other'), base.replace(':secret', ''), base.replace('.co/', '.co:6543/')):
            with self.assertRaises(ValueError):
                m.source_config(value)
        self.assertEqual(m.source_config(f'postgres://postgres.{m.REF}:x@aws-0-us-east-2.pooler.supabase.com:5432/postgres')['port'], 5432)

    def test_conventional_tls_query_is_normalized_without_libpq_options(self):
        base = f'postgresql://postgres:secret@db.{m.REF}.supabase.co/postgres'
        self.assertEqual(m.source_config(base + '?sslmode=require'), m.source_config(base))
        self.assertEqual(m.source_config(base + '?schema=public&sslmode=require'), m.source_config(base))
        self.assertEqual(m.source_config(f'postgres://postgres.{m.REF}:secret@aws-0-us-east-2.pooler.supabase.com:6543/postgres?sslmode=require&schema=public')['port'], 5432)
        for query in ('sslmode=require&sslmode=require', 'sslmode=require&host=evil',
                      'service=other', 'options=-c+default_transaction_read_only=off',
                      'hostaddr=127.0.0.1', 'sslmode=disable', 'schema=auth', 'schema=public&schema=public',
                      'schema=public&%73chema=public', 'sslmode=require&%73slmode=require'):
            with self.assertRaises(m.PreflightError) as caught:
                m.source_config(base + '?' + query)
            self.assertEqual(m.failure_metadata(caught.exception)['code'], 'SOURCE_QUERY_REJECTED')
            self.assertNotIn('secret', str(m.failure_metadata(caught.exception)))
        with self.assertRaises(m.PreflightError) as caught:
            m.source_config(base.replace(':secret', ''))
        self.assertEqual(caught.exception.code, 'SOURCE_CREDENTIAL_MISSING')

    def test_commands_never_emit_database_errors(self):
        with patch.object(m.subprocess, 'run', return_value=types.SimpleNamespace(returncode=0)) as run:
            m.command(['pg_dump'], {})
            self.assertTrue(run.call_args.kwargs['stderr'].closed)
            self.assertEqual(run.call_args.kwargs['timeout'], 900)

    def test_command_diagnostics_emit_fixed_codes_not_rows_sql_or_credentials(self):
        samples = [
            (b'pg_restore: error: could not execute query: ERROR: schema "auth" does not exist\nCommand was: SECRET SQL', 'COMMAND_SCHEMA_MISSING'),
            (b'ERROR: function secret_private_name(text) does not exist\npassword=SECRET', 'COMMAND_FUNCTION_MISSING'),
            (b'ERROR: relation "sensitive" already exists', 'COMMAND_OBJECT_EXISTS'),
            (b'ERROR: insert or update violates foreign key constraint "private"\nDETAIL: Key (email)=(private@example.invalid)', 'COMMAND_FOREIGN_KEY_VIOLATION'),
            (b'unknown secret connection failure', 'SUBPROCESS_FAILED'),
        ]
        for raw, expected in samples:
            self.assertEqual(m.command_failure_code(raw), expected)
        def failed(*args, **kwargs):
            kwargs['stderr'].write(samples[0][0])
            return types.SimpleNamespace(returncode=1)
        with patch.object(m.subprocess, 'run', side_effect=failed):
            with self.assertRaises(m.CommandFailure) as caught:
                m.command(['pg_restore', 'SECRET-PATH'], {})
        self.assertEqual(m.failure_metadata(caught.exception)['code'], 'COMMAND_SCHEMA_MISSING')
        self.assertNotIn('SECRET', str(caught.exception))

    def test_raw_directory_removed_on_connection_failure(self):
        fake = types.SimpleNamespace(connect=lambda **kwargs: (_ for _ in ()).throw(RuntimeError('sensitive')), sql=object())
        with tempfile.TemporaryDirectory() as root:
            env = {'GITHUB_REF': 'refs/heads/main', 'RUNNER_TEMP': root,
                   'STAGING_DATABASE_ADMIN_URL': f'postgres://postgres:x@db.{m.REF}.supabase.co/postgres'}
            with patch.dict(sys.modules, {'psycopg': fake}), patch.dict(m.os.environ, env, clear=True):
                with self.assertRaises(RuntimeError):
                    m.run()
            self.assertEqual(list(Path(root).iterdir()), [])

    def test_direct_tenant_probes_allow_global_rows_and_mark_children(self):
        self.assertEqual(m.probe_outcome(0, 9)['visible_global_rows'], 9)
        with self.assertRaises(ValueError):
            m.probe_outcome(1, 9)
        self.assertEqual(m.tenant_probe_columns([('shared', 'org_id'), ('owned', 'organization_id'), ('child', 'parent_id')], ['shared', 'owned', 'child']),
                         {'shared': ['org_id'], 'owned': ['organization_id'], 'child': []})

    def test_extensions_preserve_source_namespace_and_fail_unsupported(self):
        self.assertEqual(m.extension_plan([('pgcrypto', 'extensions')]), [('pgcrypto', 'extensions')])
        for rows in ([('pgcrypto', 'auth')], [('pgcrypto', 'storage')], [('unknown', 'public')]):
            with self.assertRaises(ValueError):
                m.extension_plan(rows)

    def test_public_extension_closure_includes_owned_defaults_and_transitive_refs(self):
        # public table -> reverse auto-owned default -> external function -> extension.
        # unrelated bundled extension has no path from the public dump objects.
        edges = [(2, 20, 1, 10, 'a'), (2, 20, 3, 30, 'n'),
                 (3, 30, 4, 40, 'e'), (5, 50, 4, 60, 'e')]
        extensions = [(4, 40, 'pgcrypto', 'extensions'), (4, 60, 'supabase_vault', 'vault')]
        self.assertEqual(m.public_extension_dependencies([(1, 10)], edges, extensions), [('pgcrypto', 'extensions')])
        with self.assertRaises(ValueError):
            m.public_extension_dependencies([(5, 50)], edges, extensions)
        # Cycles terminate; extension memberships do not reverse-pull unrelated objects.
        self.assertEqual(m.public_extension_dependencies([(1, 10)], edges + [(3, 30, 2, 20, 'n')], extensions), [('pgcrypto', 'extensions')])

    def test_actual_trigram_index_extension_is_supported_in_public(self):
        # Live staging catalog closure verified pg_trgm/public and btree_gist/extensions.
        # public table -> auto-owned index -> operator class -> extension.
        edges = [(2, 20, 1, 10, 'a'), (2, 20, 3, 30, 'n'), (3, 30, 4, 40, 'e')]
        self.assertEqual(m.public_extension_dependencies([(1, 10)], edges,
                         [(4, 40, 'pg_trgm', 'public')]), [('pg_trgm', 'public')])

    def test_failure_metadata_never_contains_exception_text(self):
        error = RuntimeError('password=secret row=email@example.test')
        error.sqlstate = '42501'
        self.assertEqual(m.failure_metadata(error)['code'], '42501')
        error.sqlstate = 'secret'
        self.assertEqual(m.failure_metadata(error)['code'], 'REHEARSAL_FAILED')
        self.assertNotIn('secret', str(m.failure_metadata(error)))

    def test_cleanup_and_artifact_contract(self):
        script = Path(m.__file__).read_text()
        workflow = Path('.github/workflows/staging-database-restore.yml').read_text()
        self.assertIn('finally:\n        shutil.rmtree(work)', script)
        self.assertIn('backup.touch(mode=0o600)', script)
        self.assertIn('retention-days: 7', workflow)
        self.assertIn('if: always()', workflow)
        self.assertIn('environment: staging', workflow)
        self.assertNotIn('path: ${{ runner.temp }}\n', workflow)


if __name__ == '__main__':
    unittest.main()
