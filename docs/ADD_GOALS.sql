-- Complete goals and add goal contributions.
-- Safe to run more than once. It does not delete existing data.

alter table public.goals
add column if not exists currency text not null default 'MXN';

alter table public.goals
add column if not exists account_id uuid references public.accounts(id) on delete set null;

alter table public.goals
add column if not exists description text;

alter table public.goals
add column if not exists is_active boolean not null default true;

alter table public.goals
drop constraint if exists goals_goal_type_check;

alter table public.goals
add constraint goals_goal_type_check
check (goal_type in ('savings', 'debt_payment', 'emergency_fund', 'travel', 'large_purchase', 'other'));

create table if not exists public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  contribution_date date not null,
  amount numeric(14, 2) not null check (amount > 0),
  description text,
  created_at timestamptz not null default now()
);

alter table public.account_movements
add column if not exists goal_contribution_id uuid references public.goal_contributions(id) on delete cascade;

create index if not exists goals_user_id_idx
on public.goals(user_id);

create index if not exists goal_contributions_user_id_idx
on public.goal_contributions(user_id);

create index if not exists goal_contributions_goal_id_idx
on public.goal_contributions(goal_id);

create index if not exists account_movements_goal_contribution_id_idx
on public.account_movements(goal_contribution_id);

alter table public.goal_contributions enable row level security;

drop policy if exists "Users can manage their goal contributions" on public.goal_contributions;

create policy "Users can manage their goal contributions"
on public.goal_contributions for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
