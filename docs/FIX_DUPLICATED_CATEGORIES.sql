-- Fix duplicated expense categories.
-- Run this once in Supabase SQL Editor.

begin;

-- Move expenses that point to duplicated categories so they keep pointing to
-- the oldest category with the same user, type and normalized name.
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

-- Delete duplicated category rows after expenses have been moved.
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
  and ranked_categories.row_number > 1;

-- Prevent future duplicates, even if capitalization or extra spaces differ.
create unique index if not exists categories_user_type_name_unique_idx
on public.categories (user_id, type, lower(trim(name)));

commit;
