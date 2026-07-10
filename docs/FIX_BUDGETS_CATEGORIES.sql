-- Fix duplicated categories for budgets without deleting expenses or budgets.
-- Safe goal:
-- 1. Move expenses and budgets to the oldest category with the same user/type/name when possible.
-- 2. Delete only duplicate category rows that are no longer referenced.
-- 3. Recreate the unique category index to prevent future duplicates.

begin;

-- Move expenses that point to duplicated categories.
with ranked_categories as (
  select
    id,
    first_value(id) over (
      partition by user_id, type, lower(trim(name))
      order by created_at asc, id asc
    ) as keep_id
  from public.categories
),
duplicates as (
  select id, keep_id
  from ranked_categories
  where id <> keep_id
)
update public.expenses
set category_id = duplicates.keep_id
from duplicates
where public.expenses.category_id = duplicates.id;

-- Move budgets that point to duplicated categories only when that does not
-- collide with another budget for the same user/month/currency.
with ranked_categories as (
  select
    id,
    first_value(id) over (
      partition by user_id, type, lower(trim(name))
      order by created_at asc, id asc
    ) as keep_id
  from public.categories
),
duplicates as (
  select id, keep_id
  from ranked_categories
  where id <> keep_id
)
update public.budgets
set category_id = duplicates.keep_id
from duplicates
where public.budgets.category_id = duplicates.id
  and not exists (
    select 1
    from public.budgets existing_budget
    where existing_budget.user_id = public.budgets.user_id
      and existing_budget.category_id = duplicates.keep_id
      and existing_budget.month = public.budgets.month
      and existing_budget.currency = public.budgets.currency
      and existing_budget.id <> public.budgets.id
  );

-- Delete duplicated categories only if no expenses or budgets still reference them.
with ranked_categories as (
  select
    id,
    row_number() over (
      partition by user_id, type, lower(trim(name))
      order by created_at asc, id asc
    ) as row_number
  from public.categories
)
delete from public.categories
using ranked_categories
where public.categories.id = ranked_categories.id
  and ranked_categories.row_number > 1
  and not exists (
    select 1 from public.expenses where public.expenses.category_id = public.categories.id
  )
  and not exists (
    select 1 from public.budgets where public.budgets.category_id = public.categories.id
  );

-- Prevent future duplicates only when the database is clean enough for the index.
do $$
begin
  if not exists (
    select 1
    from public.categories
    group by user_id, type, lower(trim(name))
    having count(*) > 1
  ) then
    create unique index if not exists categories_user_type_name_unique_idx
    on public.categories (user_id, type, lower(trim(name)));
  end if;
end $$;

commit;
