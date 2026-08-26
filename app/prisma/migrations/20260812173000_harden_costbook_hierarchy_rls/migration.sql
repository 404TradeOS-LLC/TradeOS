-- Harden C005 Costbook hierarchy boundaries identified during post-merge triage.
--
-- 1. Category/subcategory write policies now carry an explicit organization
--    predicate instead of relying on nested RLS visibility alone.
-- 2. Active categories/subcategories may only reference active parents.
-- 3. A division/category cannot be deactivated while active descendants remain.
--    Together these guards preserve hierarchy activity invariants even when
--    application-layer validation is bypassed.

create or replace function public.enforce_costbook_active_category_parent()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.is_active and not exists (
    select 1
      from public.divisions d
     where d.id = new.division_id
       and d.org_id = public.current_app_org_id()
       and d.is_active
  ) then
    raise exception 'active category requires an active division in the authenticated organization'
      using errcode = '23514';
  end if;

  return new;
end
$function$;

create or replace function public.enforce_costbook_active_subcategory_parent()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.is_active and not exists (
    select 1
      from public.categories c
      join public.divisions d on d.id = c.division_id
     where c.id = new.category_id
       and d.org_id = public.current_app_org_id()
       and d.is_active
       and c.is_active
  ) then
    raise exception 'active subcategory requires an active category and division in the authenticated organization'
      using errcode = '23514';
  end if;

  return new;
end
$function$;

create or replace function public.enforce_costbook_division_deactivation()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if old.is_active and not new.is_active and exists (
    select 1
      from public.categories c
     where c.division_id = new.id
       and c.is_active
  ) then
    raise exception 'division cannot be deactivated while active categories remain'
      using errcode = '23514';
  end if;

  return new;
end
$function$;

create or replace function public.enforce_costbook_category_deactivation()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if old.is_active and not new.is_active and exists (
    select 1
      from public.subcategories s
     where s.category_id = new.id
       and s.is_active
  ) then
    raise exception 'category cannot be deactivated while active subcategories remain'
      using errcode = '23514';
  end if;

  return new;
end
$function$;

drop trigger if exists categories_active_parent_guard on public.categories;
create trigger categories_active_parent_guard
before insert or update of division_id, is_active on public.categories
for each row execute function public.enforce_costbook_active_category_parent();

drop trigger if exists subcategories_active_parent_guard on public.subcategories;
create trigger subcategories_active_parent_guard
before insert or update of category_id, is_active on public.subcategories
for each row execute function public.enforce_costbook_active_subcategory_parent();

drop trigger if exists divisions_active_descendant_guard on public.divisions;
create trigger divisions_active_descendant_guard
before update of is_active on public.divisions
for each row execute function public.enforce_costbook_division_deactivation();

drop trigger if exists categories_active_descendant_guard on public.categories;
create trigger categories_active_descendant_guard
before update of is_active on public.categories
for each row execute function public.enforce_costbook_category_deactivation();

drop policy if exists categories_write_policy on public.categories;
create policy categories_write_policy on public.categories
for all using (
  (select public.current_app_can_manage_costbook())
  and exists (
    select 1
      from public.divisions d
     where d.id = categories.division_id
       and d.org_id = (select public.current_app_org_id())
  )
) with check (
  (select public.current_app_can_manage_costbook())
  and exists (
    select 1
      from public.divisions d
     where d.id = categories.division_id
       and d.org_id = (select public.current_app_org_id())
  )
);

drop policy if exists subcategories_write_policy on public.subcategories;
create policy subcategories_write_policy on public.subcategories
for all using (
  (select public.current_app_can_manage_costbook())
  and exists (
    select 1
      from public.categories c
      join public.divisions d on d.id = c.division_id
     where c.id = subcategories.category_id
       and d.org_id = (select public.current_app_org_id())
  )
) with check (
  (select public.current_app_can_manage_costbook())
  and exists (
    select 1
      from public.categories c
      join public.divisions d on d.id = c.division_id
     where c.id = subcategories.category_id
       and d.org_id = (select public.current_app_org_id())
  )
);
