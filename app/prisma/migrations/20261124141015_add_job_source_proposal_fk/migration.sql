-- DEV-22(a): enforce the proposal -> job provenance link at the database
-- level. source_proposal_id has existed as an unenforced nullable column
-- since 20261028151000; this adds the restricted foreign key.
--
-- Step 1: tighten the column type to UUID. The 20261028 migration added it
-- as TEXT while proposals.id is UUID, so a FK cannot reference it as-is.
-- The USING cast fails loudly on any stored non-UUID value.
ALTER TABLE "jobs" ALTER COLUMN "source_proposal_id" TYPE UUID USING "source_proposal_id"::uuid;

-- Step 2: audit tenant consistency before constraining. Proposals carry no
-- org_id (org is reached via project), so tenant consistency cannot be a
-- composite FK. Fail loudly if any existing job references a proposal from
-- another org; the FK itself also rejects references to missing proposals.
DO $$
DECLARE
  violations integer;
BEGIN
  SELECT count(*) INTO violations
  FROM "jobs" j
  JOIN "proposals" p ON p."id" = j."source_proposal_id"
  JOIN "projects" pr ON pr."id" = p."project_id"
  WHERE j."source_proposal_id" IS NOT NULL
    AND pr."org_id" <> j."org_id";
  IF violations > 0 THEN
    RAISE EXCEPTION 'DEV-22(a): % job(s) reference a proposal from another org; resolve before adding the FK', violations;
  END IF;
END $$;

-- Step 3: the restricted FK. Deleting a proposal that a field job was
-- created from is refused (RESTRICT); the job must be dealt with first.
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_source_proposal_id_fkey" FOREIGN KEY ("source_proposal_id") REFERENCES "proposals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
