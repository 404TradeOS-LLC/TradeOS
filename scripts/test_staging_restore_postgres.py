"""Optional real local PostgreSQL regression; never connects to a remote host."""
import importlib.util
import os
import sys
from pathlib import Path
import unittest
from urllib.parse import urlsplit
import uuid

sys.dont_write_bytecode = True

spec = importlib.util.spec_from_file_location('restore', Path(__file__).with_name('staging-database-restore.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


@unittest.skipUnless(os.environ.get('RESTORE_TEST_ADMIN_URL'), 'Local disposable PostgreSQL admin URL required')
class PostgresRegression(unittest.TestCase):
    def test_canonical_catalog_and_non_vacuous_isolation(self):
        import psycopg
        from psycopg import sql
        url = os.environ['RESTORE_TEST_ADMIN_URL']
        parsed = urlsplit(url)
        self.assertIn(parsed.hostname, ('localhost', '127.0.0.1'))
        self.assertEqual(parsed.path, '/postgres')
        self.assertFalse(parsed.query or parsed.fragment)
        name = 'restore_manifest_' + uuid.uuid4().hex[:12]
        role = 'restore_probe_' + uuid.uuid4().hex[:12]
        role_created = False
        with psycopg.connect(url, autocommit=True) as admin:
            admin.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(name)))
            try:
                with psycopg.connect(url, dbname=name) as conn:
                    conn.execute("CREATE SCHEMA extensions; CREATE SCHEMA tradeos_private; CREATE FUNCTION extensions.demo() RETURNS integer LANGUAGE SQL IMMUTABLE AS 'SELECT 3'; CREATE TABLE public.fixture(id int DEFAULT extensions.demo()); INSERT INTO public.fixture DEFAULT VALUES")
                    conn.execute('SET LOCAL search_path=public,extensions')
                    # Same default deparses differently without canonicalization.
                    visible = conn.execute("SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='fixture'").fetchone()
                    before = m.manifest(conn)
                    conn.execute('SET LOCAL search_path=public')
                    qualified = conn.execute("SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='fixture'").fetchone()
                    self.assertNotEqual(visible, qualified)
                    after = m.manifest(conn)
                    m.assert_manifest_matches(before, after)
                    conn.execute("CREATE TABLE public.customers(org_id uuid NOT NULL); INSERT INTO public.customers VALUES ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222'); ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY; ALTER TABLE public.customers FORCE ROW LEVEL SECURITY; CREATE POLICY fixture_scope ON public.customers FOR SELECT TO PUBLIC USING (org_id=nullif(current_setting('app.org_id',true),'')::uuid)")
                    conn.execute(sql.SQL('CREATE ROLE {} NOLOGIN NOSUPERUSER NOBYPASSRLS').format(sql.Identifier(role)))
                    role_created = True
                    conn.execute(sql.SQL('GRANT USAGE ON SCHEMA public TO {}').format(sql.Identifier(role)))
                    conn.execute(sql.SQL('GRANT SELECT ON public.customers TO {}').format(sql.Identifier(role)))
                    scopes = conn.execute('SELECT org_id,count(*) FROM public.customers GROUP BY org_id ORDER BY org_id').fetchall()
                    receipt = m.verify_customer_isolation(conn, scopes, role)
                    self.assertEqual(receipt['own_rows_visible'], 1)
                    self.assertTrue(receipt['foreign_rows_denied'])
                    conn.execute("SELECT set_config('app.org_id','00000000-0000-0000-0000-000000000000',true)")
                    self.assertEqual(conn.execute('SELECT count(*) FROM public.customers').fetchone()[0], 0)
                    conn.execute('RESET ROLE; DROP POLICY fixture_scope ON public.customers; CREATE POLICY broken_scope ON public.customers FOR SELECT TO PUBLIC USING (true)')
                    with self.assertRaises(m.PreflightError) as caught:
                        m.verify_customer_isolation(conn, scopes, role)
                    self.assertEqual(caught.exception.code, 'RESTRICTED_CUSTOMER_ISOLATION_FAILED')
            finally:
                admin.execute(sql.SQL('DROP DATABASE {} WITH (FORCE)').format(sql.Identifier(name)))
                if role_created:
                    admin.execute(sql.SQL('DROP ROLE IF EXISTS {}').format(sql.Identifier(role)))


if __name__ == '__main__':
    unittest.main()
