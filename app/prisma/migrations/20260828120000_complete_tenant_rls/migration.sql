-- Complete the database tenant boundary for every current tenant-owned table.
-- These tables all carry org_id, so they use the same organization-scoped
-- policy shape as the original tenant-table migration.

do $$
declare
  tenant_table text;
begin
  foreach tenant_table in array array[
    'activity_events', 'notifications', 'attachments',
    'comments', 'tags', 'tag_assignments', 'saved_views', 'recent_items',
    'feature_flags'
  ]
  loop
    execute format('alter table %I enable row level security', tenant_table);
    execute format('alter table %I force row level security', tenant_table);
    execute format('drop policy if exists %I on %I', tenant_table || '_select_policy', tenant_table);
    execute format('drop policy if exists %I on %I', tenant_table || '_write_policy', tenant_table);
    execute format(
      'create policy %I on %I for select using (org_id = (select current_app_org_id()))',
      tenant_table || '_select_policy', tenant_table
    );
    execute format(
      'create policy %I on %I for all using (org_id = (select current_app_org_id()) and (select current_app_can_write())) with check (org_id = (select current_app_org_id()) and (select current_app_can_write()))',
      tenant_table || '_write_policy', tenant_table
    );
  end loop;
end
$$;

-- Admins may inspect users only when the user belongs to the active
-- organization. The self/auth-subject clauses preserve login bootstrap and
-- current-user reads without widening organization administration.
drop policy if exists users_select_policy on users;
create policy users_select_policy on users
for select using (
  auth_subject = current_app_auth_subject()
  or id = current_app_user_id()
  or (select current_app_is_provisioning())
  or (
    (select current_app_can_administer())
    and exists (
      select 1
      from organization_memberships membership
      where membership.user_id = users.id
        and membership.org_id = (select current_app_org_id())
    )
  )
);
