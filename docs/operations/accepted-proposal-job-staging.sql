-- Evidence capture only. Run through a verified staging connection.
-- Connection/project identity must be established outside SQL; database name
-- and current_user alone do not prove the Supabase project.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;

SELECT current_timestamp AS captured_at, current_database() AS database_name,
       current_setting('transaction_read_only') AS transaction_read_only;

SELECT migration_name, checksum, finished_at, rolled_back_at
FROM public._prisma_migrations
ORDER BY migration_name, started_at;

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'jobs'
  AND column_name IN ('source_proposal_id', 'accepted_baseline_json')
ORDER BY column_name;

SELECT i.relname AS index_name, ix.indisunique, ix.indisvalid, ix.indisready,
       pg_get_indexdef(ix.indexrelid) AS definition
FROM pg_index ix
JOIN pg_class i ON i.oid = ix.indexrelid
WHERE ix.indrelid = 'public.jobs'::regclass
  AND i.relname = 'jobs_source_proposal_id_key';

SELECT relrowsecurity, relforcerowsecurity
FROM pg_class WHERE oid = 'public.jobs'::regclass;

SELECT count(*) AS existing_job_count FROM public.jobs;
COMMIT;
