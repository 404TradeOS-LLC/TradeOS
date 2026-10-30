-- Optional source reference and immutable acceptance snapshot for existing and future jobs.
-- Keep legacy standalone jobs intact; PostgreSQL permits multiple NULLs under UNIQUE.
ALTER TABLE "jobs" ADD COLUMN "source_proposal_id" TEXT;
ALTER TABLE "jobs" ADD COLUMN "accepted_baseline_json" JSONB;
CREATE UNIQUE INDEX "jobs_source_proposal_id_key" ON "jobs"("source_proposal_id");
