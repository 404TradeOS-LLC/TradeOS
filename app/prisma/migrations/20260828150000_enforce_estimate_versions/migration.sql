-- Serialize estimate version allocation at the project boundary and preserve
-- a database invariant against duplicate revisions.
do $$
begin
  if exists (
    select 1
    from estimates
    group by project_id, version
    having count(*) > 1
  ) then
    raise exception 'Cannot enforce estimate version uniqueness: duplicate project/version rows exist';
  end if;
end
$$;

-- Prisma applies migrations transactionally, so CREATE INDEX CONCURRENTLY is
-- not valid here. Bound the lock wait and run this migration in the documented
-- write-maintenance window rather than allowing an unbounded production block.
set local lock_timeout = '5s';

create unique index if not exists estimates_project_id_version_key
  on estimates (project_id, version);
