"use client";

import { useEffect, useMemo, useState } from "react";
import { PeriodFilterControls } from "@/components/period-filter-controls";
import { findCategoryName, isSameCategoryName, normalizeCategoryName } from "@/lib/categories";
import { DEFAULT_CURRENCY, formatCurrency, groupMoneyByCurrency, normalizeCurrency } from "@/lib/currencies";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  getDefaultPeriodFilter,
  getPeriodLabel,
  getRangeForCard,
  isDateInSelectedPeriod,
  type PeriodFilterState,
} from "@/lib/period-filters";
import type {
  Account,
  AccountMovement,
  AccountMovementType,
  AccountTransfer,
  Budget,
  Category,
  CreditCard,
  Expense,
  Goal,
  GoalContribution,
  Holding,
  InvestmentAsset,
  InvestmentPlatform,
  Payment,
  PaymentType,
} from "@/types/finance";

const paymentTypeLabels: Record<PaymentType, string> = {
  minimum: "Pago minimo",
  partial: "Pago parcial",
  no_interest: "Pago para no generar intereses",
  total: "Pago total",
  other: "Otro",
};

const movementTypeLabels: Record<AccountMovementType, string> = {
  income: "Ingreso",
  expense: "Egreso",
  transfer: "Transferencia",
  adjustment: "Ajuste",
};

type Message = {
  type: "error" | "info";
  text: string;
};

type DashboardCardSummary = {
  card: CreditCard;
  spent: number;
  paid: number;
  pending: number;
  available: number;
  usagePercent: number;
  daysToCut: number;
  daysToPayment: number;
};

export function DashboardSummary() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountMovements, setAccountMovements] = useState<AccountMovement[]>([]);
  const [accountTransfers, setAccountTransfers] = useState<AccountTransfer[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalContributions, setGoalContributions] = useState<GoalContribution[]>([]);
  const [investmentPlatforms, setInvestmentPlatforms] = useState<InvestmentPlatform[]>([]);
  const [investmentAssets, setInvestmentAssets] = useState<InvestmentAsset[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterState>(getDefaultPeriodFilter);
  const [message, setMessage] = useState<Message | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    if (!supabase) {
      setMessage({ type: "error", text: "Falta configurar Supabase para ver el dashboard." });
      setIsLoading(false);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage({ type: "info", text: "Inicia sesion para ver tu dashboard." });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const [
      { data: cardData, error: cardError },
      { data: expenseData, error: expenseError },
      { data: paymentData, error: paymentError },
      { data: categoryData, error: categoryError },
      { data: accountData, error: accountError },
      { data: movementData, error: movementError },
      { data: transferData, error: transferError },
      { data: budgetData, error: budgetError },
      { data: goalData, error: goalError },
      { data: goalContributionData, error: goalContributionError },
      { data: platformData, error: platformError },
      { data: assetData, error: assetError },
      { data: holdingData, error: holdingError },
    ] = await Promise.all([
      supabase
        .from("credit_cards")
        .select("*")
        .eq("user_id", userData.user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      supabase.from("expenses").select("*").eq("user_id", userData.user.id).order("expense_date", { ascending: false }),
      supabase.from("payments").select("*").eq("user_id", userData.user.id).order("payment_date", { ascending: false }),
      supabase.from("categories").select("*").eq("user_id", userData.user.id),
      supabase
        .from("accounts")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("account_movements")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("movement_date", { ascending: false }),
      supabase
        .from("account_transfers")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("transfer_date", { ascending: false }),
      supabase
        .from("budgets")
        .select("*")
        .eq("user_id", userData.user.id)
        .eq("is_active", true)
        .order("month", { ascending: false }),
      supabase
        .from("goals")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("goal_contributions")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("contribution_date", { ascending: false }),
      supabase.from("platforms").select("*").eq("user_id", userData.user.id).order("created_at", { ascending: false }),
      supabase.from("assets").select("*").eq("user_id", userData.user.id).order("symbol"),
      supabase.from("holdings").select("*").eq("user_id", userData.user.id).order("created_at", { ascending: false }),
    ]);

    if (cardError || expenseError || paymentError || categoryError || accountError || movementError || transferError || budgetError || goalError || goalContributionError || platformError || assetError || holdingError) {
      setMessage({
        type: "error",
        text:
          cardError?.message ??
          expenseError?.message ??
          paymentError?.message ??
          categoryError?.message ??
          accountError?.message ??
          movementError?.message ??
          transferError?.message ??
          budgetError?.message ??
          goalError?.message ??
          goalContributionError?.message ??
          platformError?.message ??
          assetError?.message ??
          holdingError?.message ??
          "No se pudo cargar el dashboard.",
      });
      setIsLoading(false);
      return;
    }

    setCards((cardData ?? []) as CreditCard[]);
    setExpenses((expenseData ?? []) as Expense[]);
    setPayments((paymentData ?? []) as Payment[]);
    setCategories((categoryData ?? []) as Category[]);
    setAccounts((accountData ?? []) as Account[]);
    setAccountMovements((movementData ?? []) as AccountMovement[]);
    setAccountTransfers((transferData ?? []) as AccountTransfer[]);
    setBudgets((budgetData ?? []) as Budget[]);
    setGoals((goalData ?? []) as Goal[]);
    setGoalContributions((goalContributionData ?? []) as GoalContribution[]);
    setInvestmentPlatforms((platformData ?? []) as InvestmentPlatform[]);
    setInvestmentAssets((assetData ?? []) as InvestmentAsset[]);
    setHoldings((holdingData ?? []) as Holding[]);
    setIsLoading(false);
  }

  const cardSummaries: DashboardCardSummary[] = cards.map((card) => {
    const period = getRangeForCard(periodFilter, card);
    const spent = sumExpensesForCardPeriod(expenses, card.id, period.start, period.end);
    const paid = sumPaymentsForCardPeriod(payments, card.id, period.start, period.end);
    const pending = Math.max(spent - paid, 0);
    const limit = Number(card.credit_limit);
    const available = Math.max(limit - pending, 0);
    const usagePercent = limit > 0 ? (pending / limit) * 100 : 0;
    const daysToCut = getDaysUntilDay(card.statement_cut_day);
    const daysToPayment = getDaysUntilDay(card.payment_due_day);

    return {
      card,
      spent,
      paid,
      pending,
      available,
      usagePercent,
      daysToCut,
      daysToPayment,
    };
  });

  const totalSpentByCurrency = groupMoneyByCurrency(cardSummaries, (item) => item.spent, (item) => item.card.currency);
  const totalPaidByCurrency = groupMoneyByCurrency(cardSummaries, (item) => item.paid, (item) => item.card.currency);
  const totalPendingByCurrency = groupMoneyByCurrency(cardSummaries, (item) => item.pending, (item) => item.card.currency);
  const totalAvailableByCurrency = groupMoneyByCurrency(cardSummaries, (item) => item.available, (item) => item.card.currency);
  const accountSummaries = accounts.map((account) => ({
    account,
    balance: calculateAccountBalance(account, accountMovements),
  }));
  const activeAccountSummaries = accountSummaries.filter(({ account }) => account.is_active);
  const accountTotalsByCurrency = groupMoneyByCurrency(activeAccountSummaries, (item) => item.balance, (item) => item.account.currency);
  const topAccounts = [...activeAccountSummaries].sort((a, b) => b.balance - a.balance).slice(0, 5);
  const recentAccountMovements = accountMovements.slice(0, 6);
  const recentAccountTransfers = accountTransfers.slice(0, 5);
  const currentMonthValue = new Date().toISOString().slice(0, 7);
  const currentBudgetSummaries = budgets
    .filter((budget) => budget.month.slice(0, 7) === currentMonthValue)
    .map((budget) => buildBudgetDashboardSummary(budget, categories, cards, expenses));
  const exceededBudgets = currentBudgetSummaries.filter((summary) => summary.status === "exceeded");
  const nearLimitBudgets = currentBudgetSummaries.filter((summary) => summary.status === "warning" || summary.status === "danger");
  const budgetedByCurrency = groupMoneyByCurrency(currentBudgetSummaries, (summary) => Number(summary.budget.amount), (summary) => summary.budget.currency);
  const budgetSpentByCurrency = groupMoneyByCurrency(currentBudgetSummaries, (summary) => summary.spent, (summary) => summary.budget.currency);
  const goalSummaries = goals.map((goal) => buildGoalDashboardSummary(goal, goalContributions));
  const activeGoalSummaries = goalSummaries.filter(({ goal }) => goal.is_active);
  const completedGoalSummaries = goalSummaries.filter((summary) => summary.isCompleted);
  const goalCurrentByCurrency = groupMoneyByCurrency(activeGoalSummaries, (summary) => summary.currentAmount, (summary) => summary.goal.currency);
  const goalTargetByCurrency = groupMoneyByCurrency(activeGoalSummaries, (summary) => Number(summary.goal.target_amount), (summary) => summary.goal.currency);
  const upcomingGoals = activeGoalSummaries
    .filter(({ goal }) => Boolean(goal.target_date))
    .sort((a, b) => new Date(`${a.goal.target_date}T00:00:00`).getTime() - new Date(`${b.goal.target_date}T00:00:00`).getTime())
    .slice(0, 4);
  const investmentSummaries = holdings.map((holding) => buildInvestmentDashboardSummary(holding, investmentPlatforms, investmentAssets));
  const investmentsByCurrency = groupMoneyByCurrency(investmentSummaries, (summary) => summary.value, (summary) => summary.asset?.currency);
  const netWorthByCurrency = buildNetWorthByCurrency(accountTotalsByCurrency, investmentsByCurrency, totalPendingByCurrency);
  const topInvestmentPlatforms = buildTopInvestmentPlatforms(investmentSummaries).slice(0, 4);
  const topInvestmentAssets = [...investmentSummaries].sort((a, b) => b.value - a.value).slice(0, 4);
  const summaryCurrencies = Array.from(
    new Set([
      ...totalSpentByCurrency,
      ...totalPaidByCurrency,
      ...totalPendingByCurrency,
      ...totalAvailableByCurrency,
    ].map((total) => total.currency))
  ).sort();
  const cardsNearCut = cardSummaries.filter((item) => item.daysToCut <= 7);
  const cardsNearPayment = cardSummaries.filter((item) => item.daysToPayment <= 7);
  const averageCreditUsage =
    cardSummaries.length > 0
      ? cardSummaries.reduce((total, summary) => total + summary.usagePercent, 0) / cardSummaries.length
      : 0;
  const cardWithHighestPending = [...cardSummaries].sort((a, b) => b.pending - a.pending)[0];
  const cardWithHighestUsage = [...cardSummaries].sort((a, b) => b.usagePercent - a.usagePercent)[0];
  const mainCardSummaries = [...cardSummaries]
    .sort((a, b) => b.pending - a.pending || b.usagePercent - a.usagePercent)
    .slice(0, 6);
  const filteredExpenses = expenses.filter((expense) =>
    isDateInSelectedPeriod({
      dateValue: expense.expense_date,
      cardId: expense.credit_card_id,
      cards,
      filter: periodFilter,
    })
  );
  const filteredPayments = payments.filter((payment) =>
    isDateInSelectedPeriod({
      dateValue: payment.payment_date,
      cardId: payment.credit_card_id,
      cards,
      filter: periodFilter,
    })
  );
  const recentExpenses = filteredExpenses.slice(0, 8);
  const recentPayments = filteredPayments.slice(0, 8);
  const visualSummaryRows = summaryCurrencies.map((currency) => {
    const spent = getTotalForCurrency(totalSpentByCurrency, currency);
    const paid = getTotalForCurrency(totalPaidByCurrency, currency);
    const pending = getTotalForCurrency(totalPendingByCurrency, currency);
    const available = getTotalForCurrency(totalAvailableByCurrency, currency);

    return {
      currency,
      spent,
      paid,
      pending,
      available,
      max: Math.max(spent, paid, pending, available, 1),
    };
  });

  if (isLoading) {
    return <StatusPanel text="Cargando dashboard..." />;
  }

  if (message) {
    return <StatusPanel text={message.text} tone={message.type} />;
  }

  return (
    <div className="max-w-full space-y-6 overflow-x-hidden">
      <section className="relative overflow-hidden rounded-3xl border border-brand-900/10 bg-gradient-to-br from-[#123a36] via-brand-700 to-brand-900 p-5 text-white shadow-sm sm:p-7">
        <div className="pointer-events-none absolute -left-20 -top-24 h-80 w-80 rounded-full bg-brand-200/24 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-brand-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-finance-ivory/10 blur-3xl" />
        <div className="relative grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)] lg:items-end">
          <div className="min-w-0">
            <h1 className="pp-display text-4xl leading-none text-white sm:text-5xl">Resumen de patrimonio</h1>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
              Vista general de tarjetas, {getPeriodLabel(periodFilter).toLowerCase()}, cuentas, inversiones, presupuestos y metas.
            </p>
            <p className="mt-4 inline-flex max-w-full rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-brand-100">
              Los totales se muestran por moneda. No hay conversion automatica entre monedas.
            </p>
          </div>
          <div className="min-w-0 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-200">Senales clave</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <HeroMetric label="Tarjetas" value={cards.length} />
              <HeroMetric label="Cuentas" value={activeAccountSummaries.length} />
              <HeroMetric label="Metas" value={activeGoalSummaries.length} />
              <HeroMetric label="Alertas pago" value={cardsNearPayment.length} />
            </div>
          </div>
        </div>
      </section>

      <PeriodFilterControls value={periodFilter} onChange={setPeriodFilter} />

      <section className="grid min-w-0 gap-4 md:grid-cols-3">
        <SmallStat label="Tarjetas activas" value={cards.length} />
        <SmallStat label="Cuentas activas" value={activeAccountSummaries.length} />
        <SmallStat label="Presupuestos activos" value={currentBudgetSummaries.length} />
        <SmallStat label="Metas activas" value={activeGoalSummaries.length} />
        <SmallStat label="Proximas a corte" value={cardsNearCut.length} />
        <SmallStat label="Proximas a pago" value={cardsNearPayment.length} />
      </section>

      <section className="pp-card p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="pp-display text-3xl">Patrimonio neto estimado</h2>
          <p className="text-sm text-slate-600">
            Cuentas mas inversiones, menos saldo pendiente de tarjetas. No hay conversion automatica entre monedas. Cada moneda se muestra por separado.
          </p>
        </div>
        <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {netWorthByCurrency.map((row) => (
            <NetWorthCard key={row.currency} row={row} />
          ))}
        </div>
        {netWorthByCurrency.length === 0 ? <EmptyTableMessage text="Aun no hay cuentas, inversiones ni saldos de tarjeta para calcular patrimonio." /> : null}
      </section>

      <section className="pp-card p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="pp-display text-3xl">Resumen de tarjetas</h2>
          <p className="text-sm text-slate-600">
            Vista rapida del periodo seleccionado, separada por moneda y sin mezclar saldos.
          </p>
        </div>

        <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Tarjetas activas" value={String(cards.length)} />
          <SummaryCard label="Deuda pendiente" value={<MoneyTotals totals={totalPendingByCurrency} />} strong />
          <SummaryCard label="Credito disponible" value={<MoneyTotals totals={totalAvailableByCurrency} />} />
          <SummaryCard label="Uso promedio" value={`${averageCreditUsage.toFixed(1)}%`} />
        </div>

        <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2">
          <CardHighlight title="Mayor saldo pendiente" summary={cardWithHighestPending} />
          <CardHighlight title="Mayor porcentaje usado" summary={cardWithHighestUsage} showUsage />
        </div>

        <div className="mt-5 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
          <CardCurrencySummary rows={visualSummaryRows} />
          <MainCardsTable summaries={mainCardSummaries} />
        </div>
      </section>

      <section className="pp-card p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-slate-950">Cuentas</h2>
          <p className="text-sm text-slate-600">Saldos estimados por cuenta, separados por moneda.</p>
        </div>
        <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Total en cuentas" value={<MoneyTotals totals={accountTotalsByCurrency} />} strong />
          <SummaryCard label="Cuentas activas" value={String(activeAccountSummaries.length)} />
        </div>
        <div className="mt-4">
          <TopAccountsList accounts={topAccounts} />
        </div>
      </section>

      <section className="pp-card p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-slate-950">Inversiones</h2>
          <p className="text-sm text-slate-600">
            Valores estimados con el precio actual registrado en cada activo. Los precios pueden ser manuales, de CoinGecko o de Alpha Vantage.
          </p>
        </div>
        <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Valor total" value={<MoneyTotals totals={investmentsByCurrency} />} />
          <SummaryCard label="Plataformas" value={String(investmentPlatforms.length)} />
          <SummaryCard label="Activos" value={String(investmentAssets.length)} />
          <SummaryCard label="Holdings" value={String(holdings.length)} />
        </div>
        {investmentSummaries.length > 0 ? (
          <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-2">
            <TopInvestmentsList title="Principales plataformas" rows={topInvestmentPlatforms} />
            <TopInvestmentsList title="Principales activos" rows={topInvestmentAssets} />
          </div>
        ) : (
          <EmptyTableMessage text="Aun no hay holdings de inversion para resumir. Cuando registres uno, aqui veras tus principales plataformas y activos." />
        )}
      </section>

      <section className="pp-card p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-slate-950">Presupuestos del mes</h2>
          <p className="text-sm text-slate-600">Resumen de presupuestos activos del mes actual, separado por moneda.</p>
        </div>
        <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Presupuestado" value={<MoneyTotals totals={budgetedByCurrency} />} />
          <SummaryCard label="Gastado" value={<MoneyTotals totals={budgetSpentByCurrency} />} />
          <SummaryCard label="Excedidos" value={String(exceededBudgets.length)} />
          <SummaryCard label="Cerca del limite" value={String(nearLimitBudgets.length)} />
        </div>
        {currentBudgetSummaries.length === 0 ? <EmptyTableMessage text="Aun no hay presupuestos activos para el mes actual." /> : null}
      </section>

      <section className="pp-card p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-slate-950">Metas</h2>
          <p className="text-sm text-slate-600">Progreso de metas activas, separado por moneda.</p>
        </div>
        <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Objetivo total" value={<MoneyTotals totals={goalTargetByCurrency} />} />
          <SummaryCard label="Avance actual" value={<MoneyTotals totals={goalCurrentByCurrency} />} />
          <SummaryCard label="Metas activas" value={String(activeGoalSummaries.length)} />
          <SummaryCard label="Completadas" value={String(completedGoalSummaries.length)} />
        </div>
        {activeGoalSummaries.length > 0 ? (
          <UpcomingGoals goals={upcomingGoals} />
        ) : (
          <EmptyTableMessage text="Aun no hay metas activas. Cuando crees una meta, aqui veras su avance y fechas importantes." />
        )}
      </section>

      <section className="pp-card p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-slate-950">Actividad reciente</h2>
          <p className="text-sm text-slate-600">
            Ultimos movimientos visibles segun tus datos actuales. Gastos y pagos respetan el filtro de periodo seleccionado.
          </p>
        </div>

        <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2">
          <UpcomingCards title="Tarjetas proximas a corte" items={cardsNearCut} type="cut" />
          <UpcomingCards title="Tarjetas proximas a pago" items={cardsNearPayment} type="payment" />
        </div>

        <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-2">
          <RecentExpensesTable
            categories={categories}
            cards={cards}
            expenses={recentExpenses}
          />
          <RecentPaymentsTable cards={cards} payments={recentPayments} />
        </div>

        <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-2">
          <RecentAccountMovementsTable accounts={accounts} movements={recentAccountMovements} />
          <RecentTransfersTable accounts={accounts} transfers={recentAccountTransfers} />
        </div>
      </section>
    </div>
  );
}

function sumExpensesForCardPeriod(expenses: Expense[], cardId: string, start: Date, end: Date) {
  return expenses
    .filter((expense) => {
      const expenseDate = new Date(`${expense.expense_date}T00:00:00`);
      return expense.credit_card_id === cardId && expenseDate >= start && expenseDate <= end;
    })
    .reduce((total, expense) => total + Number(expense.amount), 0);
}

function sumPaymentsForCardPeriod(payments: Payment[], cardId: string, start: Date, end: Date) {
  return payments
    .filter((payment) => {
      const paymentDate = new Date(`${payment.payment_date}T00:00:00`);
      return payment.credit_card_id === cardId && paymentDate >= start && paymentDate <= end;
    })
    .reduce((total, payment) => total + Number(payment.amount), 0);
}

function getDaysUntilDay(day: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(today.getFullYear(), today.getMonth(), Math.min(day, daysInMonth(today)));
  if (target < today) {
    target.setMonth(target.getMonth() + 1);
    target.setDate(Math.min(day, daysInMonth(target)));
  }

  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function daysInMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function getCardName(cards: CreditCard[], cardId: string | null) {
  return cards.find((card) => card.id === cardId)?.name ?? "Tarjeta no encontrada";
}

function getCardInfo(cards: CreditCard[], cardId: string | null) {
  const card = cards.find((item) => item.id === cardId);
  return card ? `${card.bank} - **** ${card.last_four_digits}` : "Sin tarjeta";
}

function getCategoryName(categories: Category[], categoryId: string | null) {
  return categories.find((category) => category.id === categoryId)?.name ?? "Sin categoria";
}

function formatDate(dateValue: string) {
  return new Date(`${dateValue}T00:00:00`).toLocaleDateString("es-MX");
}

function getCardCurrency(cards: CreditCard[], cardId: string | null) {
  return cards.find((card) => card.id === cardId)?.currency ?? DEFAULT_CURRENCY;
}

function getAccountName(accounts: Account[], accountId: string | null) {
  return accounts.find((account) => account.id === accountId)?.name ?? "Cuenta no encontrada";
}

function getAccountCurrency(accounts: Account[], accountId: string | null) {
  return accounts.find((account) => account.id === accountId)?.currency ?? DEFAULT_CURRENCY;
}

function getTotalForCurrency(totals: Array<{ currency: string; amount: number }>, currency: string) {
  return totals.find((total) => total.currency === currency)?.amount ?? 0;
}

function calculateAccountBalance(account: Account, movements: AccountMovement[]) {
  return movements
    .filter((movement) => movement.account_id === account.id)
    .reduce((balance, movement) => {
      if (movement.movement_type === "income") return balance + Number(movement.amount);
      if (movement.movement_type === "expense") return balance - Number(movement.amount);
      if (movement.movement_type === "adjustment") return balance + Number(movement.amount);
      return balance;
    }, Number(account.initial_balance));
}

function buildNetWorthByCurrency(
  accountTotals: Array<{ currency: string; amount: number }>,
  investmentTotals: Array<{ currency: string; amount: number }>,
  pendingTotals: Array<{ currency: string; amount: number }>
) {
  const currencies = Array.from(
    new Set([...accountTotals, ...investmentTotals, ...pendingTotals].map((total) => normalizeCurrency(total.currency)))
  ).sort();

  return currencies.map((currency) => {
    const accounts = getTotalForCurrency(accountTotals, currency);
    const investments = getTotalForCurrency(investmentTotals, currency);
    const pendingCards = getTotalForCurrency(pendingTotals, currency);

    return {
      currency,
      accounts,
      investments,
      pendingCards,
      netWorth: accounts + investments - pendingCards,
    };
  });
}

function buildBudgetDashboardSummary(budget: Budget, categories: Category[], cards: CreditCard[], expenses: Expense[]) {
  const start = new Date(`${budget.month.slice(0, 7)}-01T00:00:00`);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  const currency = normalizeCurrency(budget.currency);
  const budgetCategoryName = normalizeCategoryName(findCategoryName(categories, budget.category_id));
  const spent = expenses
    .filter((expense) => {
      const card = cards.find((item) => item.id === expense.credit_card_id);
      const expenseDate = new Date(`${expense.expense_date}T00:00:00`);
      return (
        (expense.category_id === budget.category_id ||
          isSameCategoryName(categories, expense.category_id, budget.category_id) ||
          Boolean(budgetCategoryName && normalizeCategoryName(findCategoryName(categories, expense.category_id)) === budgetCategoryName)) &&
        normalizeCurrency(card?.currency) === currency &&
        expenseDate >= start &&
        expenseDate < end
      );
    })
    .reduce((total, expense) => total + Number(expense.amount), 0);
  const usedPercent = Number(budget.amount) > 0 ? (spent / Number(budget.amount)) * 100 : 0;

  return {
    budget,
    spent,
    status: getBudgetStatus(usedPercent),
  };
}

function getBudgetStatus(percent: number) {
  if (percent > 100) return "exceeded";
  if (percent > 90) return "danger";
  if (percent >= 70) return "warning";
  return "normal";
}

function buildGoalDashboardSummary(goal: Goal, contributions: GoalContribution[]) {
  const currentAmount =
    Number(goal.current_amount) +
    contributions
      .filter((contribution) => contribution.goal_id === goal.id)
      .reduce((total, contribution) => total + Number(contribution.amount), 0);
  const targetAmount = Number(goal.target_amount);
  const progressPercent = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;

  return {
    goal,
    currentAmount,
    progressPercent,
    isCompleted: currentAmount >= targetAmount,
  };
}

function buildInvestmentDashboardSummary(holding: Holding, platforms: InvestmentPlatform[], assets: InvestmentAsset[]) {
  const asset = assets.find((item) => item.id === holding.asset_id);
  const platform = platforms.find((item) => item.id === holding.platform_id);

  return {
    keyId: `holding-${holding.id}`,
    holding,
    asset,
    platform,
    name: asset ? `${asset.symbol} - ${asset.name}` : "Activo no encontrado",
    detail: platform?.name ?? "Plataforma no encontrada",
    currency: normalizeCurrency(asset?.currency),
    value: Number(holding.quantity) * Number(asset?.current_price ?? 0),
  };
}

function buildTopInvestmentPlatforms(
  summaries: Array<{
    platform: InvestmentPlatform | undefined;
    currency: string;
    value: number;
  }>
) {
  const totals = new Map<string, { keyId: string; name: string; detail: string; currency: string; value: number }>();

  summaries.forEach((summary) => {
    const platformName = summary.platform?.name ?? "Plataforma no encontrada";
    const key = `${summary.platform?.id ?? "missing"}-${summary.currency}`;
    const current = totals.get(key) ?? {
      keyId: `platform-${key}`,
      name: platformName,
      detail: summary.currency,
      currency: summary.currency,
      value: 0,
    };
    current.value += summary.value;
    totals.set(key, current);
  });

  return Array.from(totals.values()).sort((a, b) => b.value - a.value);
}

function MoneyTotals({ totals }: { totals: Array<{ currency: string; amount: number }> }) {
  if (totals.length === 0) return <span>{formatCurrency(0, DEFAULT_CURRENCY)}</span>;

  return (
    <span className="space-y-1">
      {totals.map((total) => (
        <span className="block" key={total.currency}>{formatCurrency(total.amount, total.currency)}</span>
      ))}
    </span>
  );
}

function HeroMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/10 p-3">
      <p className="text-xs text-white/70">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function SummaryCard({ label, value, strong = false }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="pp-metric-card min-w-0">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-finance-muted">{label}</p>
      <p className={`mt-3 break-words text-2xl ${strong ? "font-bold text-finance-ink" : "font-semibold text-slate-800"}`}>
        {value}
      </p>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="pp-metric-card min-w-0 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-finance-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-finance-ink">{value}</p>
    </div>
  );
}

function CardHighlight({
  title,
  summary,
  showUsage = false,
}: {
  title: string;
  summary: DashboardCardSummary | undefined;
  showUsage?: boolean;
}) {
  if (!summary || (summary.pending === 0 && summary.usagePercent === 0)) {
    return (
      <div className="rounded-2xl border border-finance-line bg-finance-mist p-4">
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        <p className="mt-2 text-sm text-slate-500">Aun no hay saldo pendiente en tarjetas.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-finance-line bg-finance-mist p-4">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <div className="mt-2 flex flex-col gap-1">
        <p className="font-semibold text-slate-950">{summary.card.name}</p>
        <p className="text-sm text-slate-500">
          {summary.card.bank} - **** {summary.card.last_four_digits} - {summary.card.currency}
        </p>
        <p className="text-sm text-slate-700">
          {showUsage
            ? `${summary.usagePercent.toFixed(1)}% usado`
            : `${formatCurrency(summary.pending, summary.card.currency)} pendiente`}
        </p>
      </div>
    </div>
  );
}

function CardCurrencySummary({
  rows,
}: {
  rows: Array<{
    currency: string;
    spent: number;
    paid: number;
    pending: number;
    available: number;
    max: number;
  }>;
}) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 p-4">
      <h3 className="font-semibold text-slate-950">Resumen por moneda</h3>
      <div className="mt-4 space-y-5">
        {rows.map((row) => (
          <div className="space-y-3" key={row.currency}>
            <p className="text-sm font-semibold text-slate-700">{row.currency}</p>
            <DashboardBar label="Gastado" value={row.spent} max={row.max} currency={row.currency} colorClass="bg-red-500" />
            <DashboardBar label="Pagado" value={row.paid} max={row.max} currency={row.currency} colorClass="bg-teal-600" />
            <DashboardBar label="Pendiente" value={row.pending} max={row.max} currency={row.currency} colorClass="bg-amber-500" />
            <DashboardBar label="Disponible" value={row.available} max={row.max} currency={row.currency} colorClass="bg-slate-500" />
          </div>
        ))}
      </div>
      {rows.length === 0 ? <EmptyTableMessage text="Aun no hay datos de tarjetas para resumir." /> : null}
    </div>
  );
}

function MainCardsTable({ summaries }: { summaries: DashboardCardSummary[] }) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 p-4">
      <h3 className="font-semibold text-slate-950">Tarjetas principales</h3>
      <div className="mt-3 space-y-3 md:hidden">
        {summaries.map((summary) => (
          <article className="min-w-0 rounded-md bg-slate-50 p-3" key={summary.card.id}>
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-slate-950">{summary.card.name}</p>
                <p className="text-xs text-slate-500">
                  {summary.card.bank} - **** {summary.card.last_four_digits} - {summary.card.currency}
                </p>
              </div>
              <p className="shrink-0 text-right text-sm font-semibold text-slate-950">{summary.usagePercent.toFixed(1)}%</p>
            </div>
            <div className="mt-3 grid min-w-0 grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <MiniMetric label="Gastado" value={formatCurrency(summary.spent, summary.card.currency)} />
              <MiniMetric label="Pagado" value={formatCurrency(summary.paid, summary.card.currency)} />
              <MiniMetric label="Pendiente" value={formatCurrency(summary.pending, summary.card.currency)} />
              <MiniMetric label="Disponible" value={formatCurrency(summary.available, summary.card.currency)} />
              <MiniMetric label="Corte" value={`${summary.daysToCut} dia(s)`} />
              <MiniMetric label="Pago" value={`${summary.daysToPayment} dia(s)`} />
            </div>
          </article>
        ))}
      </div>
      <div className="mt-3 hidden max-w-full overflow-x-auto md:block">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2 pr-3 font-medium">Tarjeta</th>
              <th className="py-2 pr-3 font-medium">Moneda</th>
              <th className="py-2 pr-3 text-right font-medium">Gastado</th>
              <th className="py-2 pr-3 text-right font-medium">Pagado</th>
              <th className="py-2 pr-3 text-right font-medium">Pendiente</th>
              <th className="py-2 pr-3 text-right font-medium">Disponible</th>
              <th className="py-2 pr-3 text-right font-medium">Uso</th>
              <th className="py-2 pr-3 text-right font-medium">Corte</th>
              <th className="py-2 text-right font-medium">Pago</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((summary) => (
              <tr className="border-b border-slate-100" key={summary.card.id}>
                <td className="py-3 pr-3">
                  <p className="font-medium text-slate-950">{summary.card.name}</p>
                  <p className="text-xs text-slate-500">
                    {summary.card.bank} - **** {summary.card.last_four_digits}
                  </p>
                </td>
                <td className="py-3 pr-3 text-slate-700">{summary.card.currency}</td>
                <td className="py-3 pr-3 text-right text-slate-700">{formatCurrency(summary.spent, summary.card.currency)}</td>
                <td className="py-3 pr-3 text-right text-slate-700">{formatCurrency(summary.paid, summary.card.currency)}</td>
                <td className="py-3 pr-3 text-right font-semibold text-slate-950">{formatCurrency(summary.pending, summary.card.currency)}</td>
                <td className="py-3 pr-3 text-right text-slate-700">{formatCurrency(summary.available, summary.card.currency)}</td>
                <td className="py-3 pr-3 text-right text-slate-700">{summary.usagePercent.toFixed(1)}%</td>
                <td className="py-3 pr-3 text-right text-slate-700">{summary.daysToCut} dia(s)</td>
                <td className="py-3 text-right text-slate-700">{summary.daysToPayment} dia(s)</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {summaries.length === 0 ? <EmptyTableMessage text="Aun no hay tarjetas activas para mostrar." /> : null}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="break-words font-medium text-slate-900">{value}</p>
    </div>
  );
}

function NetWorthCard({
  row,
}: {
  row: {
    currency: string;
    accounts: number;
    investments: number;
    pendingCards: number;
    netWorth: number;
  };
}) {
  return (
    <article className="min-w-0 rounded-2xl border border-brand-900/10 bg-gradient-to-br from-brand-900 to-brand-700 p-5 text-white shadow-sm">
      <p className="pp-badge border-white/10 bg-white/10 text-brand-100">{row.currency}</p>
      <p className="mt-4 break-words text-3xl font-semibold text-white">{formatCurrency(row.netWorth, row.currency)}</p>
      <div className="mt-4 space-y-1 text-sm text-white/75">
        <p>Cuentas: {formatCurrency(row.accounts, row.currency)}</p>
        <p>Inversiones: {formatCurrency(row.investments, row.currency)}</p>
        <p>Deuda tarjetas: {formatCurrency(row.pendingCards, row.currency)}</p>
      </div>
    </article>
  );
}

function TopAccountsList({ accounts }: { accounts: Array<{ account: Account; balance: number }> }) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 p-4">
      <h3 className="font-semibold text-slate-950">Cuentas con mayor saldo</h3>
      <div className="mt-3 space-y-3">
        {accounts.map(({ account, balance }) => (
          <div className="flex min-w-0 flex-col gap-2 border-b border-slate-100 pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-3" key={account.id}>
            <div className="min-w-0">
              <p className="font-medium text-slate-900">{account.name}</p>
              <p className="text-sm text-slate-500">{account.institution || "Sin institucion"} - {account.currency}</p>
            </div>
            <p className="break-words text-sm font-semibold text-slate-950 sm:text-right">{formatCurrency(balance, account.currency)}</p>
          </div>
        ))}
      </div>
      {accounts.length === 0 ? <EmptyTableMessage text="Aun no hay cuentas activas." /> : null}
    </div>
  );
}

function RecentAccountMovementsTable({ accounts, movements }: { accounts: Account[]; movements: AccountMovement[] }) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 p-4">
      <h3 className="font-semibold text-slate-950">Ultimos movimientos</h3>
      <div className="mt-3 max-w-full overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2 pr-3 font-medium">Fecha</th>
              <th className="py-2 pr-3 font-medium">Cuenta</th>
              <th className="py-2 pr-3 font-medium">Tipo</th>
              <th className="py-2 text-right font-medium">Monto</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((movement) => (
              <tr className="border-b border-slate-100" key={movement.id}>
                <td className="py-3 pr-3 text-slate-700">{formatDate(movement.movement_date)}</td>
                <td className="py-3 pr-3 text-slate-700">{getAccountName(accounts, movement.account_id)}</td>
                <td className="py-3 pr-3 text-slate-700">
                  {movementTypeLabels[movement.movement_type]}
                  {movement.transfer_id ? <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">Transf.</span> : null}
                </td>
                <td className="py-3 text-right font-semibold text-slate-950">{formatCurrency(Number(movement.amount), getAccountCurrency(accounts, movement.account_id))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {movements.length === 0 ? <EmptyTableMessage text="Aun no hay movimientos de cuenta." /> : null}
    </div>
  );
}

function RecentTransfersTable({ accounts, transfers }: { accounts: Account[]; transfers: AccountTransfer[] }) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 p-4">
      <h3 className="font-semibold text-slate-950">Transferencias recientes</h3>
      <div className="mt-3 max-w-full overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2 pr-3 font-medium">Fecha</th>
              <th className="py-2 pr-3 font-medium">Origen</th>
              <th className="py-2 pr-3 font-medium">Destino</th>
              <th className="py-2 text-right font-medium">Monto</th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((transfer) => (
              <tr className="border-b border-slate-100" key={transfer.id}>
                <td className="py-3 pr-3 text-slate-700">{formatDate(transfer.transfer_date)}</td>
                <td className="py-3 pr-3 text-slate-700">{getAccountName(accounts, transfer.from_account_id)}</td>
                <td className="py-3 pr-3 text-slate-700">{getAccountName(accounts, transfer.to_account_id)}</td>
                <td className="py-3 text-right font-semibold text-slate-950">{formatCurrency(Number(transfer.amount), transfer.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {transfers.length === 0 ? <EmptyTableMessage text="Aun no hay transferencias registradas." /> : null}
    </div>
  );
}

function UpcomingGoals({
  goals,
}: {
  goals: Array<{
    goal: Goal;
    currentAmount: number;
    progressPercent: number;
  }>;
}) {
  return (
    <div className="mt-4 min-w-0 rounded-md border border-slate-200 p-4">
      <h3 className="font-semibold text-slate-950">Proximas metas por fecha objetivo</h3>
      <div className="mt-3 grid min-w-0 gap-3 md:grid-cols-2">
        {goals.map(({ goal, currentAmount, progressPercent }) => (
          <div className="min-w-0 rounded-md bg-slate-50 p-3" key={goal.id}>
            <p className="font-medium text-slate-950">{goal.name}</p>
            <p className="text-sm text-slate-500">{goal.target_date ? formatDate(goal.target_date) : "Sin fecha"}</p>
            <p className="mt-2 text-sm text-slate-700">
              {formatCurrency(currentAmount, goal.currency)} de {formatCurrency(Number(goal.target_amount), goal.currency)}
            </p>
            <div className="mt-2 h-2 rounded-full bg-slate-200">
              <div className="h-2 rounded-full bg-blue-500" style={{ width: `${Math.min(progressPercent, 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
      {goals.length === 0 ? <EmptyTableMessage text="Aun no hay metas activas con fecha objetivo." /> : null}
    </div>
  );
}

function TopInvestmentsList({
  title,
  rows,
}: {
  title: string;
  rows: Array<{
    keyId: string;
    name: string;
    detail: string;
    currency: string;
    value: number;
  }>;
}) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 p-4">
      <h3 className="font-semibold text-slate-950">{title}</h3>
      <div className="mt-3 space-y-3">
        {rows.map((row) => (
          <div className="flex min-w-0 flex-col gap-2 border-b border-slate-100 pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-3" key={row.keyId}>
            <div className="min-w-0">
              <p className="font-medium text-slate-900">{row.name}</p>
              <p className="text-sm text-slate-500">{row.detail}</p>
            </div>
            <p className="break-words text-sm font-semibold text-slate-950 sm:text-right">{formatCurrency(row.value, row.currency)}</p>
          </div>
        ))}
      </div>
      {rows.length === 0 ? <EmptyTableMessage text="Aun no hay inversiones manuales registradas." /> : null}
    </div>
  );
}

function DashboardBar({
  label,
  value,
  max,
  currency,
  colorClass,
}: {
  label: string;
  value: number;
  max: number;
  currency: string;
  colorClass: string;
}) {
  const width = Math.max((value / max) * 100, value > 0 ? 2 : 0);

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
        <span className="text-slate-600">{label}</span>
        <span className="break-words font-medium text-slate-900">{formatCurrency(value, currency)}</span>
      </div>
      <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
        <div className={`h-2 rounded-full ${colorClass}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function UpcomingCards({
  title,
  items,
  type,
}: {
  title: string;
  items: Array<{
    card: CreditCard;
    daysToCut: number;
    daysToPayment: number;
  }>;
  type: "cut" | "payment";
}) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <div className="mt-4 space-y-3">
        {items.map(({ card, daysToCut, daysToPayment }) => {
          const days = type === "cut" ? daysToCut : daysToPayment;
          return (
            <div className="min-w-0 rounded-md border border-slate-200 p-3" key={card.id}>
              <p className="font-medium text-slate-950">{card.name}</p>
              <p className="text-sm text-slate-500">
                {card.bank} - **** {card.last_four_digits}
              </p>
              <p className={`mt-2 text-sm font-medium ${days <= 3 ? "text-red-700" : "text-amber-700"}`}>
                Faltan {days} dia(s)
              </p>
            </div>
          );
        })}
        {items.length === 0 ? (
          <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-600">
            No hay tarjetas proximas en los siguientes 7 dias.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function RecentExpensesTable({
  expenses,
  cards,
  categories,
}: {
  expenses: Expense[];
  cards: CreditCard[];
  categories: Category[];
}) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-semibold text-slate-950">Gastos recientes</h2>
      <div className="mt-4 max-w-full overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2 pr-4 font-medium">Fecha</th>
              <th className="py-2 pr-4 font-medium">Tarjeta</th>
              <th className="py-2 pr-4 font-medium">Categoria</th>
              <th className="py-2 pr-4 font-medium">Descripcion</th>
              <th className="py-2 text-right font-medium">Monto</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => (
              <tr className="border-b border-slate-100" key={expense.id}>
                <td className="py-3 pr-4 text-slate-700">
                  {formatDate(expense.expense_date)}
                </td>
                <td className="py-3 pr-4 text-slate-700">{getCardName(cards, expense.credit_card_id)}</td>
                <td className="py-3 pr-4 text-slate-700">{getCategoryName(categories, expense.category_id)}</td>
                <td className="py-3 pr-4 text-slate-700">{expense.description || "Sin descripcion"}</td>
                <td className="py-3 text-right font-semibold text-slate-950">
                  {formatCurrency(Number(expense.amount), getCardCurrency(cards, expense.credit_card_id))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {expenses.length === 0 ? <EmptyTableMessage text="Todavia no hay gastos registrados." /> : null}
    </div>
  );
}

function RecentPaymentsTable({ payments, cards }: { payments: Payment[]; cards: CreditCard[] }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-semibold text-slate-950">Pagos recientes</h2>
      <div className="mt-4 max-w-full overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2 pr-4 font-medium">Fecha</th>
              <th className="py-2 pr-4 font-medium">Tarjeta</th>
              <th className="py-2 pr-4 font-medium">Tipo</th>
              <th className="py-2 pr-4 font-medium">Descripcion</th>
              <th className="py-2 text-right font-medium">Monto</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr className="border-b border-slate-100" key={payment.id}>
                <td className="py-3 pr-4 text-slate-700">
                  {formatDate(payment.payment_date)}
                </td>
                <td className="py-3 pr-4 text-slate-700">{getCardInfo(cards, payment.credit_card_id)}</td>
                <td className="py-3 pr-4 text-slate-700">{paymentTypeLabels[payment.payment_type]}</td>
                <td className="py-3 pr-4 text-slate-700">{payment.notes || "Sin descripcion"}</td>
                <td className="py-3 text-right font-semibold text-slate-950">
                  {formatCurrency(Number(payment.amount), getCardCurrency(cards, payment.credit_card_id))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {payments.length === 0 ? <EmptyTableMessage text="Todavia no hay pagos registrados." /> : null}
    </div>
  );
}

function EmptyTableMessage({ text }: { text: string }) {
  return <p className="mt-4 rounded-md bg-slate-50 p-4 text-sm text-slate-600">{text}</p>;
}

function StatusPanel({ text, tone = "info" }: { text: string; tone?: "error" | "info" }) {
  const styles = tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-slate-200 bg-white text-slate-600";
  return <div className={`rounded-lg border p-6 shadow-sm ${styles}`}>{text}</div>;
}
