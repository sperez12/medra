alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.credit_cards enable row level security;
alter table public.accounts enable row level security;
alter table public.expenses enable row level security;
alter table public.payments enable row level security;
alter table public.installment_purchases enable row level security;
alter table public.account_movements enable row level security;
alter table public.account_transfers enable row level security;
alter table public.platforms enable row level security;
alter table public.assets enable row level security;
alter table public.holdings enable row level security;
alter table public.investment_transactions enable row level security;
alter table public.asset_prices enable row level security;
alter table public.budgets enable row level security;
alter table public.goals enable row level security;
alter table public.financial_events enable row level security;

create policy "Users can read their profile"
on public.profiles for select
using (auth.uid() = id);

create policy "Users can insert their profile"
on public.profiles for insert
with check (auth.uid() = id);

create policy "Users can update their profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Users can delete their profile"
on public.profiles for delete
using (auth.uid() = id);

create policy "Users can manage their categories"
on public.categories for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage their credit cards"
on public.credit_cards for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage their accounts"
on public.accounts for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage their expenses"
on public.expenses for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage their payments"
on public.payments for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage their installment purchases"
on public.installment_purchases for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage their account movements"
on public.account_movements for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage their account transfers"
on public.account_transfers for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage their platforms"
on public.platforms for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage their assets"
on public.assets for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage their holdings"
on public.holdings for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage their investment transactions"
on public.investment_transactions for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage their asset prices"
on public.asset_prices for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage their budgets"
on public.budgets for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage their goals"
on public.goals for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage their financial events"
on public.financial_events for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
