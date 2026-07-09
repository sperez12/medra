create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('expense', 'income')),
  color text,
  created_at timestamptz not null default now()
);

create table if not exists public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  bank text not null,
  last_four_digits text not null check (char_length(last_four_digits) = 4),
  credit_limit numeric(14, 2) not null default 0,
  statement_cut_day int not null check (statement_cut_day between 1 and 31),
  payment_due_day int not null check (payment_due_day between 1 and 31),
  currency text not null default 'MXN',
  color text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  institution text,
  account_type text not null check (account_type in ('bank', 'cash', 'investment', 'other')),
  currency text not null default 'MXN',
  initial_balance numeric(14, 2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credit_card_id uuid not null references public.credit_cards(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  expense_date date not null,
  amount numeric(14, 2) not null check (amount >= 0),
  description text not null,
  expense_type text not null default 'one_time' check (expense_type in ('one_time', 'recurring')),
  is_installment_purchase boolean not null default false,
  installment_months int check (installment_months is null or installment_months > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credit_card_id uuid references public.credit_cards(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  payment_date date not null,
  amount numeric(14, 2) not null check (amount >= 0),
  payment_type text not null default 'other' check (payment_type in ('minimum', 'partial', 'no_interest', 'total', 'other')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.installment_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expense_id uuid not null references public.expenses(id) on delete cascade,
  credit_card_id uuid not null references public.credit_cards(id) on delete cascade,
  total_amount numeric(14, 2) not null,
  months int not null check (months > 0),
  monthly_amount numeric(14, 2) not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'active' check (status in ('active', 'finished', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.account_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  movement_date date not null,
  amount numeric(14, 2) not null,
  movement_type text not null check (movement_type in ('income', 'expense', 'transfer', 'adjustment')),
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.platforms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  platform_type text not null check (platform_type in ('broker', 'crypto_exchange', 'bank', 'other')),
  currency text not null default 'MXN',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  name text not null,
  asset_type text not null check (asset_type in ('stock', 'etf', 'crypto', 'fund', 'cash', 'other')),
  currency text not null default 'USD',
  created_at timestamptz not null default now()
);

create table if not exists public.holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform_id uuid not null references public.platforms(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  quantity numeric(20, 8) not null default 0,
  average_cost numeric(20, 8) not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, platform_id, asset_id)
);

create table if not exists public.investment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform_id uuid not null references public.platforms(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  transaction_date date not null,
  transaction_type text not null check (transaction_type in ('buy', 'sell', 'dividend', 'deposit', 'withdrawal')),
  quantity numeric(20, 8) not null default 0,
  price numeric(20, 8) not null default 0,
  fees numeric(14, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.asset_prices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  price_date date not null,
  price numeric(20, 8) not null,
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  unique (user_id, asset_id, price_date)
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  month date not null,
  amount numeric(14, 2) not null check (amount >= 0),
  currency text not null default 'MXN',
  created_at timestamptz not null default now(),
  unique (user_id, category_id, month)
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  goal_type text not null check (goal_type in ('savings', 'debt_payment', 'investment', 'other')),
  target_amount numeric(14, 2) not null,
  current_amount numeric(14, 2) not null default 0,
  target_date date,
  status text not null default 'active' check (status in ('active', 'completed', 'paused', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.financial_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  event_date date not null,
  event_type text not null check (event_type in ('card_cut', 'card_payment', 'subscription', 'income', 'custom')),
  amount numeric(14, 2),
  related_credit_card_id uuid references public.credit_cards(id) on delete set null,
  related_account_id uuid references public.accounts(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists credit_cards_user_id_idx on public.credit_cards(user_id);
create index if not exists expenses_user_id_idx on public.expenses(user_id);
create index if not exists expenses_credit_card_id_idx on public.expenses(credit_card_id);
create index if not exists expenses_expense_date_idx on public.expenses(expense_date);
create index if not exists payments_user_id_idx on public.payments(user_id);
create index if not exists payments_credit_card_id_idx on public.payments(credit_card_id);
create index if not exists payments_payment_date_idx on public.payments(payment_date);
create index if not exists account_movements_user_id_idx on public.account_movements(user_id);
create index if not exists financial_events_user_id_idx on public.financial_events(user_id);
