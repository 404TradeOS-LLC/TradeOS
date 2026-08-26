-- Declined technicians must not retain job visibility through forced RLS.
-- Application predicates already exclude declined assignments; keep the database
-- security boundary aligned with that established active-assignment invariant.

alter policy jobs_select_policy on jobs
using (
  org_id = (select current_app_org_id())
  and (
    current_app_can_administer()
    or exists (
      select 1
      from job_assignments
      where job_assignments.job_id = jobs.id
        and job_assignments.user_id = current_app_user_id()
        and job_assignments.removed_at is null
        and job_assignments.declined_at is null
    )
  )
);

alter policy jobs_update_policy on jobs
using (
  org_id = (select current_app_org_id())
  and (
    current_app_can_administer()
    or exists (
      select 1
      from job_assignments
      where job_assignments.job_id = jobs.id
        and job_assignments.user_id = current_app_user_id()
        and job_assignments.removed_at is null
        and job_assignments.declined_at is null
    )
  )
)
with check (
  org_id = (select current_app_org_id())
  and (
    current_app_can_administer()
    or exists (
      select 1
      from job_assignments
      where job_assignments.job_id = jobs.id
        and job_assignments.user_id = current_app_user_id()
        and job_assignments.removed_at is null
        and job_assignments.declined_at is null
    )
  )
);

alter policy job_equipment_select_policy on job_equipment
using (
  exists (
    select 1
    from jobs
    where jobs.id = job_equipment.job_id
      and jobs.org_id = (select current_app_org_id())
      and (
        current_app_can_administer()
        or exists (
          select 1
          from job_assignments
          where job_assignments.job_id = jobs.id
            and job_assignments.user_id = current_app_user_id()
            and job_assignments.removed_at is null
            and job_assignments.declined_at is null
        )
      )
  )
);
