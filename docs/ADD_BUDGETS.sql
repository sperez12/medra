-- Complete monthly budgets.
-- Safe to run more than once. It does not delete existing budget data.

alter table public.budgets
add column if not exists name text not null default 'Presupuesto mensual';

alter table public.budgets
add column if not exists period text not null default 'monthly';

alter table public.budgets
add column if not exists description text;

alter table public.budgets
add column if not exists is_active boolean not null default true;

alter table public.budgets
drop constraint if exists budgets_period_check;

alter table public.budgets
add constraint budgets_period_check
check (period in ('monthly'));

alter table public.budgets
drop constraint if exists budgets_user_id_category_id_month_key;

create unique index if not exists budgets_user_category_month_currency_idx
on public.budgets(user_id, category_id, month, currency);

create index if not exists budgets_user_id_idx
on public.budgets(user_id);

create index if not exists budgets_month_idx
on public.budgets(month);
