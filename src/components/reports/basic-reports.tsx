"use client";

import { useEffect, useMemo, useState } from "react";
import { PeriodFilterControls } from "@/components/period-filter-controls";
import { MoneyAmount } from "@/components/ui/money-amount";
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES, groupMoneyByCurrency, normalizeCurrency } from "@/lib/currencies";
import { formatDateForPreference } from "@/lib/date-format";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserPreferences } from "@/lib/use-user-preferences";
import {
  getDefaultPeriodFilter,
  getPeriodLabel,
  getRangeForCard,
  getRangeForFilter,
  isDateInSelectedPeriod,
  type PeriodFilterState,
} from "@/lib/period-filters";
import type {
  Account,
  AccountMovement,
  AutomaticExchangeRate,
  Category,
  CreditCard,
  Expense,
  Holding,
  InvestmentAsset,
  NetWorthSnapshot,
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

type Message = {
  type: "error" | "info" | "success";
  text: string;
};

type ReportRow = {
  id: string;
  label: string;
  currency: string;
  value: number;
};

type NetWorthSnapshotRow = {
  currency: string;
  totalAccounts: number;
  totalInvestments: number;
  pendingCreditCards: number;
  netWorth: number;
};

type SnapshotHistoryRow = {
  currency: string;
  snapshots: NetWorthSnapshot[];
  firstSnapshot: NetWorthSnapshot | null;
  lastSnapshot: NetWorthSnapshot | null;
  absoluteChange: number;
  percentChange: number | null;
};

type AutomaticExchangeRateMatch = {
  rate: AutomaticExchangeRate;
  direction: "direct" | "inverse";
  conversionRate: number;
};

type AutomaticExchangeRateFreshness = {
  status: "current" | "missing" | "possibly_stale";
  title: string;
  description: string;
  helper: string;
};

type ConsolidatedNetWorthResult = {
  baseCurrency: string;
  total: number;
  rows: Array<{
    currency: string;
    originalAmount: number;
    convertedAmount: number | null;
    rate: AutomaticExchangeRateMatch | null;
    missingRate: boolean;
    sourceDate: string | null;
  }>;
  missingRates: string[];
  snapshotComparison: {
    total: number;
    rows: Array<{
      currency: string;
      originalAmount: number;
      convertedAmount: number | null;
      rate: AutomaticExchangeRateMatch | null;
      missingRate: boolean;
      sourceDate: string | null;
    }>;
    missingRates: string[];
    difference: number | null;
    percentDifference: number | null;
  };
};

type SupabaseErrorLike = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

export function BasicReports() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { dateFormat, preferredCurrency, isLoaded: preferencesLoaded } = useUserPreferences();
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountMovements, setAccountMovements] = useState<AccountMovement[]>([]);
  const [assets, setAssets] = useState<InvestmentAsset[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [snapshots, setSnapshots] = useState<NetWorthSnapshot[]>([]);
  const [automaticExchangeRates, setAutomaticExchangeRates] = useState<AutomaticExchangeRate[]>([]);
  const [snapshotNotes, setSnapshotNotes] = useState("");
  const [baseCurrency, setBaseCurrency] = useState(DEFAULT_CURRENCY);
  const [hasSelectedBaseCurrency, setHasSelectedBaseCurrency] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterState>(getDefaultPeriodFilter);
  const [message, setMessage] = useState<Message | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedReports, setHasLoadedReports] = useState(false);
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);
  const [isUpdatingAutomaticExchangeRates, setIsUpdatingAutomaticExchangeRates] = useState(false);
  const [needsAutomaticExchangeRatesMigration, setNeedsAutomaticExchangeRatesMigration] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (preferencesLoaded && !hasSelectedBaseCurrency) {
      setBaseCurrency(preferredCurrency);
    }
  }, [hasSelectedBaseCurrency, preferencesLoaded, preferredCurrency]);

  async function loadData() {
    if (!supabase) {
      setMessage({ type: "error", text: "Falta configurar Supabase para ver reportes." });
      setHasLoadedReports(false);
      setIsLoading(false);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage({ type: "info", text: "Inicia sesion para ver tus reportes." });
      setHasLoadedReports(false);
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
      { data: assetData, error: assetError },
      { data: holdingData, error: holdingError },
      { data: snapshotData, error: snapshotError },
      { data: automaticExchangeRateData, error: automaticExchangeRateError },
    ] = await Promise.all([
      supabase.from("credit_cards").select("*").eq("user_id", userData.user.id).order("name"),
      supabase.from("expenses").select("*").eq("user_id", userData.user.id).order("expense_date", { ascending: false }),
      supabase.from("payments").select("*").eq("user_id", userData.user.id).order("payment_date", { ascending: false }),
      supabase.from("categories").select("*").eq("user_id", userData.user.id),
      supabase.from("accounts").select("*").eq("user_id", userData.user.id).order("created_at", { ascending: false }),
      supabase.from("account_movements").select("*").eq("user_id", userData.user.id).order("movement_date", { ascending: false }),
      supabase.from("assets").select("*").eq("user_id", userData.user.id).order("symbol"),
      supabase.from("holdings").select("*").eq("user_id", userData.user.id).order("created_at", { ascending: false }),
      supabase
        .from("net_worth_snapshots")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("snapshot_date", { ascending: false })
        .limit(30),
      supabase
        .from("exchange_rates")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("rate_date", { ascending: false })
        .order("fetched_at", { ascending: false })
        .limit(80),
    ]);

    if (
      cardError ||
      expenseError ||
      paymentError ||
      categoryError ||
      accountError ||
      movementError ||
      assetError ||
      holdingError ||
      snapshotError
    ) {
      setMessage({
        type: "error",
        text:
          cardError?.message ??
          expenseError?.message ??
          paymentError?.message ??
          categoryError?.message ??
          accountError?.message ??
          movementError?.message ??
          assetError?.message ??
          holdingError?.message ??
          (snapshotError ? getFriendlySnapshotError(snapshotError.message) : null) ??
          "No se pudieron cargar los reportes.",
      });
      setHasLoadedReports(false);
      setIsLoading(false);
      return;
    }

    setCards((cardData ?? []) as CreditCard[]);
    setExpenses((expenseData ?? []) as Expense[]);
    setPayments((paymentData ?? []) as Payment[]);
    setCategories((categoryData ?? []) as Category[]);
    setAccounts((accountData ?? []) as Account[]);
    setAccountMovements((movementData ?? []) as AccountMovement[]);
    setAssets((assetData ?? []) as InvestmentAsset[]);
    setHoldings((holdingData ?? []) as Holding[]);
    setSnapshots((snapshotData ?? []) as NetWorthSnapshot[]);
    if (automaticExchangeRateError) {
      const missingAutomaticRatesTable = isMissingAutomaticExchangeRatesTableError(automaticExchangeRateError);
      setNeedsAutomaticExchangeRatesMigration(missingAutomaticRatesTable);
      setAutomaticExchangeRates([]);
      if (!missingAutomaticRatesTable) {
        setMessage({ type: "error", text: getFriendlyAutomaticExchangeRateError(automaticExchangeRateError) });
      }
    } else {
      setNeedsAutomaticExchangeRatesMigration(false);
      setAutomaticExchangeRates((automaticExchangeRateData ?? []) as AutomaticExchangeRate[]);
    }
    setHasLoadedReports(true);
    setIsLoading(false);
  }

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

  const expensesByCategory = groupExpensesByCategory(filteredExpenses, categories, cards);
  const expensesByCard = groupExpensesByCard(filteredExpenses, cards);
  const paymentsByCard = groupPaymentsByCard(filteredPayments, cards);
  const comparisonByCard = buildComparisonByCard(cards, filteredExpenses, filteredPayments);
  const highestExpenses = [...filteredExpenses].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 8);
  const recentPayments = filteredPayments.slice(0, 8);
  const totalSpentByCurrency = groupMoneyByCurrency(filteredExpenses, (expense) => Number(expense.amount), (expense) => getCardCurrency(cards, expense.credit_card_id));
  const totalPaidByCurrency = groupMoneyByCurrency(filteredPayments, (payment) => Number(payment.amount), (payment) => getCardCurrency(cards, payment.credit_card_id));
  const pendingByCurrency = buildPendingTotals(totalSpentByCurrency, totalPaidByCurrency);
  const currentNetWorthRows = buildNetWorthRows({
    accounts,
    accountMovements,
    assets,
    cards,
    expenses,
    holdings,
    payments,
    periodFilter,
  });
  const snapshotHistoryRows = buildSnapshotHistoryRows(snapshots);
  const consolidatedNetWorth = buildConsolidatedNetWorth(currentNetWorthRows, automaticExchangeRates, baseCurrency, snapshots);
  const topCategory = expensesByCategory[0] ? `${expensesByCategory[0].label} (${expensesByCategory[0].currency})` : "Sin datos";
  const topCard = expensesByCard[0] ? `${expensesByCard[0].label} (${expensesByCard[0].currency})` : "Sin datos";
  const dayCount = getPeriodDayCount(periodFilter, cards);
  const dailyAverageByCurrency = totalSpentByCurrency.map((total) => ({
    currency: total.currency,
    amount: total.amount / dayCount,
  }));

  async function saveTodaySnapshot() {
    setMessage(null);
    if (!supabase) return setMessage({ type: "error", text: "Falta configurar Supabase para guardar snapshots." });

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return setMessage({ type: "error", text: "Primero inicia sesion para guardar snapshots." });
    if (currentNetWorthRows.length === 0) {
      return setMessage({ type: "info", text: "Aun no hay cuentas, inversiones ni saldos de tarjeta para guardar un snapshot." });
    }

    const today = new Date().toISOString().slice(0, 10);
    const existingToday = snapshots.filter((snapshot) => snapshot.snapshot_date === today);
    if (existingToday.length > 0) {
      const confirmed = window.confirm(
        `Ya existe un snapshot para hoy (${today}) en ${existingToday.length} moneda(s).\n\nSi continuas, se actualizara el snapshot existente para cada moneda.`
      );
      if (!confirmed) return setMessage({ type: "info", text: "No se guardo ningun snapshot." });
    }

    setIsSavingSnapshot(true);
    const payload = currentNetWorthRows.map((row) => ({
      user_id: userId,
      snapshot_date: today,
      currency: row.currency,
      total_accounts: row.totalAccounts,
      total_investments: row.totalInvestments,
      pending_credit_cards: row.pendingCreditCards,
      net_worth: row.netWorth,
      notes: snapshotNotes.trim() || null,
    }));

    const { error } = await supabase
      .from("net_worth_snapshots")
      .upsert(payload, { onConflict: "user_id,snapshot_date,currency" });

    setIsSavingSnapshot(false);
    if (error) return setMessage({ type: "error", text: getFriendlySnapshotError(error.message) });

    setSnapshotNotes("");
    setMessage({ type: "success", text: "Snapshot de patrimonio guardado correctamente." });
    await loadData();
  }

  async function deleteSnapshot(snapshot: NetWorthSnapshot) {
    setMessage(null);
    if (!supabase) return;
    const confirmed = window.confirm(
      `Vas a borrar el snapshot de ${snapshot.currency} del ${formatDate(snapshot.snapshot_date, dateFormat)}.\n\nSeguro que quieres continuar?`
    );
    if (!confirmed) return setMessage({ type: "info", text: "No se borro ningun snapshot." });

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return setMessage({ type: "error", text: "Primero inicia sesion para borrar snapshots." });

    const { error } = await supabase.from("net_worth_snapshots").delete().eq("id", snapshot.id).eq("user_id", userId);
    if (error) return setMessage({ type: "error", text: getFriendlySnapshotError(error.message) });

    setMessage({ type: "success", text: "Snapshot borrado correctamente." });
    await loadData();
  }

  async function updateAutomaticExchangeRates() {
    setMessage(null);
    if (!supabase) return setMessage({ type: "error", text: "Falta configurar Supabase para actualizar tipos de cambio automaticos." });

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return setMessage({ type: "error", text: "Primero inicia sesion para actualizar tipos de cambio automaticos." });

    setIsUpdatingAutomaticExchangeRates(true);
    try {
      const response = await fetch("/api/exchange-rates/update", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          baseCurrency,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        if (result.needsMigration) setNeedsAutomaticExchangeRatesMigration(true);
        setMessage({
          type: "error",
          text: result.error ?? "No pude actualizar los tipos de cambio automaticos.",
        });
        return;
      }

      setNeedsAutomaticExchangeRatesMigration(false);
      setMessage({
        type: "success",
        text: result.message ?? "Tipos de cambio automaticos actualizados correctamente.",
      });
      await loadData();
    } catch {
      setMessage({ type: "error", text: "No pude conectar con el actualizador de tipos de cambio. Intenta mas tarde." });
    } finally {
      setIsUpdatingAutomaticExchangeRates(false);
    }
  }

  function handleBaseCurrencyChange(currency: string) {
    setHasSelectedBaseCurrency(true);
    setBaseCurrency(normalizeCurrency(currency));
  }

  if (isLoading && !hasLoadedReports) {
    return <StatusPanel text="Cargando reportes..." />;
  }

  if (message && !hasLoadedReports) {
    return <StatusPanel text={message.text} tone={message.type} />;
  }

  return (
    <div className="max-w-full space-y-6 overflow-x-hidden">
      <section>
        <h1 className="text-3xl font-bold text-slate-950">Reportes</h1>
        <p className="mt-2 text-slate-600">
          Analiza gastos, pagos, patrimonio por moneda y patrimonio consolidado visual. Vista actual: {getPeriodLabel(periodFilter)}.
        </p>
      </section>

      <ReportsInternalNavigation />

      <PeriodFilterControls value={periodFilter} onChange={setPeriodFilter} />

      {message ? <InlineMessage message={message} /> : null}

      <section className="scroll-mt-24 space-y-4" id="resumen">
        <SectionIntro
          title="Resumen"
          description="Vista rapida del periodo seleccionado para gastos, pagos y tarjetas."
        />
        <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SummaryCard label="Total gastado" value={<MoneyTotals totals={totalSpentByCurrency} />} />
          <SummaryCard label="Total pagado" value={<MoneyTotals totals={totalPaidByCurrency} />} />
          <SummaryCard label="Pendiente estimado" value={<MoneyTotals totals={pendingByCurrency} />} strong />
          <SummaryCard label="Categoria principal" value={topCategory} />
          <SummaryCard label="Tarjeta principal" value={topCard} />
        </div>
      </section>

      <section className="scroll-mt-24 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5" id="historial-patrimonio">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold text-slate-950">Historial de patrimonio</h2>
          <p className="text-sm text-slate-600">
            Guarda snapshots manuales por moneda para comparar tu evolucion. La conversion consolidada es solo visual y no modifica saldos originales.
          </p>
        </div>

        <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {currentNetWorthRows.map((row) => (
              <NetWorthPreviewCard key={row.currency} row={row} />
            ))}
            {currentNetWorthRows.length === 0 ? (
              <div className="rounded-md bg-slate-50 p-4 text-sm text-slate-600">
                Aun no hay cuentas, inversiones ni saldos de tarjeta para calcular patrimonio.
              </div>
            ) : null}
          </div>

          <div className="min-w-0 rounded-md border border-slate-200 p-4">
            <label className="text-sm font-medium text-slate-700" htmlFor="snapshot-notes">Notas opcionales</label>
            <textarea
              className="mt-2 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              id="snapshot-notes"
              onChange={(event) => setSnapshotNotes(event.target.value)}
              placeholder="Ej. cierre de mes, despues de actualizar precios..."
              value={snapshotNotes}
            />
            <button
              className="mt-3 w-full rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={isSavingSnapshot}
              onClick={saveTodaySnapshot}
              type="button"
            >
              {isSavingSnapshot ? "Guardando..." : "Guardar snapshot de hoy"}
            </button>
          </div>
        </div>

        <div className="mt-5 grid min-w-0 gap-4 xl:grid-cols-2">
          <SnapshotHistoryBars dateFormat={dateFormat} rows={snapshotHistoryRows} />
          <SnapshotsTable dateFormat={dateFormat} snapshots={snapshots.slice(0, 12)} onDelete={deleteSnapshot} />
        </div>
      </section>

      <section className="min-w-0 scroll-mt-24" id="patrimonio-consolidado">
        <ConsolidatedNetWorthSection
          baseCurrency={baseCurrency}
          dateFormat={dateFormat}
          onBaseCurrencyChange={handleBaseCurrencyChange}
          result={consolidatedNetWorth}
        />
      </section>

      <section className="min-w-0 scroll-mt-24 space-y-4" id="tipos-cambio">
        <AutomaticExchangeRatesSection
          baseCurrency={baseCurrency}
          dateFormat={dateFormat}
          isUpdating={isUpdatingAutomaticExchangeRates}
          needsMigration={needsAutomaticExchangeRatesMigration}
          onBaseCurrencyChange={handleBaseCurrencyChange}
          onUpdate={updateAutomaticExchangeRates}
          rates={automaticExchangeRates}
        />
      </section>

      <section className="scroll-mt-24 space-y-4" id="reportes-basicos">
        <SectionIntro
          title="Reportes de gastos y pagos"
          description="Detalle del periodo seleccionado. Estos reportes no usan tipos de cambio."
        />
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          <BarReport title="Gasto por categoria" rows={expensesByCategory} emptyText="No hay gastos por categoria en este periodo." />
          <BarReport title="Gasto por tarjeta" rows={expensesByCard} emptyText="No hay gastos por tarjeta en este periodo." />
        </div>

        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          <BarReport title="Pagos por tarjeta" rows={paymentsByCard} emptyText="No hay pagos por tarjeta en este periodo." />
          <ComparisonReport rows={comparisonByCard} />
        </div>

        <div className="grid min-w-0 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Promedio de gasto por dia</p>
            <div className="mt-2 text-3xl font-bold text-slate-950">
              <MoneyTotals totals={dailyAverageByCurrency} />
            </div>
            <p className="mt-2 text-sm text-slate-500">Calculado sobre el periodo seleccionado.</p>
          </div>
          <HighestExpensesTable dateFormat={dateFormat} expenses={highestExpenses} cards={cards} categories={categories} />
        </div>

        <RecentPaymentsTable dateFormat={dateFormat} payments={recentPayments} cards={cards} />
      </section>
    </div>
  );
}

function buildNetWorthRows({
  accounts,
  accountMovements,
  assets,
  cards,
  expenses,
  holdings,
  payments,
  periodFilter,
}: {
  accounts: Account[];
  accountMovements: AccountMovement[];
  assets: InvestmentAsset[];
  cards: CreditCard[];
  expenses: Expense[];
  holdings: Holding[];
  payments: Payment[];
  periodFilter: PeriodFilterState;
}): NetWorthSnapshotRow[] {
  const accountTotals = groupMoneyByCurrency(
    accounts.filter((account) => account.is_active).map((account) => ({
      account,
      balance: calculateAccountBalance(account, accountMovements),
    })),
    (item) => item.balance,
    (item) => item.account.currency
  );
  const investmentTotals = groupMoneyByCurrency(
    holdings.map((holding) => {
      const asset = assets.find((item) => item.id === holding.asset_id);
      return {
        currency: normalizeCurrency(asset?.currency),
        value: Number(holding.quantity) * Number(asset?.current_price ?? 0),
      };
    }),
    (item) => item.value,
    (item) => item.currency
  );
  const pendingTotals = groupMoneyByCurrency(
    cards.map((card) => {
      const range = getRangeForCard(periodFilter, card);
      const spent = sumExpensesForCardPeriod(expenses, card.id, range.start, range.end);
      const paid = sumPaymentsForCardPeriod(payments, card.id, range.start, range.end);
      return {
        currency: card.currency,
        pending: Math.max(spent - paid, 0),
      };
    }),
    (item) => item.pending,
    (item) => item.currency
  );
  const currencies = Array.from(
    new Set([...accountTotals, ...investmentTotals, ...pendingTotals].map((total) => normalizeCurrency(total.currency)))
  ).sort();

  return currencies.map((currency) => {
    const totalAccounts = getTotalForCurrency(accountTotals, currency);
    const totalInvestments = getTotalForCurrency(investmentTotals, currency);
    const pendingCreditCards = getTotalForCurrency(pendingTotals, currency);

    return {
      currency,
      totalAccounts,
      totalInvestments,
      pendingCreditCards,
      netWorth: totalAccounts + totalInvestments - pendingCreditCards,
    };
  });
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

function getTotalForCurrency(totals: Array<{ currency: string; amount: number }>, currency: string) {
  return totals.find((total) => normalizeCurrency(total.currency) === currency)?.amount ?? 0;
}

function buildSnapshotHistoryRows(snapshots: NetWorthSnapshot[]) {
  const latestByCurrency = new Map<string, NetWorthSnapshot[]>();

  snapshots.forEach((snapshot) => {
    const currency = normalizeCurrency(snapshot.currency);
    latestByCurrency.set(currency, [...(latestByCurrency.get(currency) ?? []), snapshot]);
  });

  return Array.from(latestByCurrency.entries()).map(([currency, rows]) => {
    const sortedRows = rows.sort((a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime());
    const firstSnapshot = sortedRows[0] ?? null;
    const lastSnapshot = sortedRows[sortedRows.length - 1] ?? null;
    const firstNetWorth = Number(firstSnapshot?.net_worth ?? 0);
    const lastNetWorth = Number(lastSnapshot?.net_worth ?? 0);
    const absoluteChange = lastNetWorth - firstNetWorth;
    const percentChange = firstSnapshot && firstNetWorth !== 0 ? (absoluteChange / Math.abs(firstNetWorth)) * 100 : null;

    return {
      currency,
      snapshots: sortedRows.slice(-6),
      firstSnapshot,
      lastSnapshot,
      absoluteChange,
      percentChange,
    };
  });
}

function buildConsolidatedNetWorth(
  rows: NetWorthSnapshotRow[],
  rates: AutomaticExchangeRate[],
  baseCurrency: string,
  snapshots: NetWorthSnapshot[]
): ConsolidatedNetWorthResult {
  const normalizedBaseCurrency = normalizeCurrency(baseCurrency);
  const currentConversion = convertNetWorthAmounts(
    rows.map((row) => ({
      currency: row.currency,
      amount: row.netWorth,
      sourceDate: null,
    })),
    rates,
    normalizedBaseCurrency
  );
  const snapshotConversion = convertNetWorthAmounts(buildLatestSnapshotAmounts(snapshots), rates, normalizedBaseCurrency);
  const difference = snapshotConversion.rows.length > 0 ? currentConversion.total - snapshotConversion.total : null;
  const percentDifference =
    difference !== null && snapshotConversion.total !== 0 ? (difference / Math.abs(snapshotConversion.total)) * 100 : null;

  return {
    baseCurrency: normalizedBaseCurrency,
    total: currentConversion.total,
    rows: currentConversion.rows,
    missingRates: currentConversion.missingRates,
    snapshotComparison: {
      total: snapshotConversion.total,
      rows: snapshotConversion.rows,
      missingRates: snapshotConversion.missingRates,
      difference,
      percentDifference,
    },
  };
}

function convertNetWorthAmounts(
  amounts: Array<{ currency: string; amount: number; sourceDate: string | null }>,
  rates: AutomaticExchangeRate[],
  baseCurrency: string
) {
  const normalizedBaseCurrency = normalizeCurrency(baseCurrency);
  let total = 0;
  const missingRates: string[] = [];

  const convertedRows = amounts.map((row) => {
    const currency = normalizeCurrency(row.currency);
    if (currency === normalizedBaseCurrency) {
      total += row.amount;
      return {
        currency,
        originalAmount: row.amount,
        convertedAmount: row.amount,
        rate: null,
        missingRate: false,
        sourceDate: row.sourceDate,
      };
    }

    const rate = findLatestAutomaticExchangeRate(rates, currency, baseCurrency);
    if (!rate) {
      missingRates.push(`${currency} -> ${baseCurrency}`);
      return {
        currency,
        originalAmount: row.amount,
        convertedAmount: null,
        rate: null,
        missingRate: true,
        sourceDate: row.sourceDate,
      };
    }

    const convertedAmount = row.amount * rate.conversionRate;
    total += convertedAmount;
    return {
      currency,
      originalAmount: row.amount,
      convertedAmount,
      rate,
      missingRate: false,
      sourceDate: row.sourceDate,
    };
  });

  return {
    total,
    rows: convertedRows,
    missingRates,
  };
}

function buildLatestSnapshotAmounts(snapshots: NetWorthSnapshot[]) {
  const latestByCurrency = new Map<string, NetWorthSnapshot>();

  snapshots.forEach((snapshot) => {
    const currency = normalizeCurrency(snapshot.currency);
    const current = latestByCurrency.get(currency);
    if (!current) {
      latestByCurrency.set(currency, snapshot);
      return;
    }

    const snapshotDate = new Date(snapshot.snapshot_date).getTime();
    const currentDate = new Date(current.snapshot_date).getTime();
    if (snapshotDate > currentDate || (snapshotDate === currentDate && new Date(snapshot.created_at).getTime() > new Date(current.created_at).getTime())) {
      latestByCurrency.set(currency, snapshot);
    }
  });

  return Array.from(latestByCurrency.values())
    .map((snapshot) => ({
      currency: snapshot.currency,
      amount: Number(snapshot.net_worth),
      sourceDate: snapshot.snapshot_date,
    }))
    .sort((a, b) => normalizeCurrency(a.currency).localeCompare(normalizeCurrency(b.currency)));
}

function findLatestAutomaticExchangeRate(rates: AutomaticExchangeRate[], fromCurrency: string, toCurrency: string): AutomaticExchangeRateMatch | null {
  const normalizedFromCurrency = normalizeCurrency(fromCurrency);
  const normalizedToCurrency = normalizeCurrency(toCurrency);

  const matches = rates
    .map((rate) => {
      const baseCurrency = normalizeCurrency(rate.base_currency);
      const quoteCurrency = normalizeCurrency(rate.quote_currency);
      const numericRate = Number(rate.rate);

      if (!Number.isFinite(numericRate) || numericRate <= 0) return null;

      if (baseCurrency === normalizedFromCurrency && quoteCurrency === normalizedToCurrency) {
        return {
          rate,
          direction: "direct" as const,
          conversionRate: numericRate,
        };
      }

      if (baseCurrency === normalizedToCurrency && quoteCurrency === normalizedFromCurrency) {
        return {
          rate,
          direction: "inverse" as const,
          conversionRate: 1 / numericRate,
        };
      }

      return null;
    })
    .filter((match): match is AutomaticExchangeRateMatch => Boolean(match))
    .sort((a, b) => {
      const dateDiff = new Date(b.rate.rate_date).getTime() - new Date(a.rate.rate_date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return new Date(b.rate.fetched_at).getTime() - new Date(a.rate.fetched_at).getTime();
    });

  return matches[0] ?? null;
}

function getAutomaticExchangeRateCoverage(rates: AutomaticExchangeRate[], baseCurrency: string) {
  const normalizedBaseCurrency = normalizeCurrency(baseCurrency);

  return SUPPORTED_CURRENCIES
    .map((currency) => currency.code)
    .filter((currency) => currency !== normalizedBaseCurrency)
    .map((currency) => ({
      currency,
      match: findLatestAutomaticExchangeRate(rates, currency, normalizedBaseCurrency),
    }));
}

function getLatestAutomaticRateField(rates: AutomaticExchangeRate[], field: "rate_date" | "fetched_at") {
  const latestRate = [...rates]
    .filter((rate) => Boolean(rate[field]))
    .sort((a, b) => new Date(b[field]).getTime() - new Date(a[field]).getTime())[0];

  return latestRate?.[field] ?? null;
}

function getAutomaticExchangeRateFreshness({
  baseCurrency,
  hasDirectRatesForBase,
  latestRateDate,
}: {
  baseCurrency: string;
  hasDirectRatesForBase: boolean;
  latestRateDate: string | null;
}): AutomaticExchangeRateFreshness {
  const normalizedBaseCurrency = normalizeCurrency(baseCurrency);

  if (!hasDirectRatesForBase || !latestRateDate) {
    return {
      status: "missing",
      title: `Faltan tasas para ${normalizedBaseCurrency}`,
      description: `No hay tasas guardadas con ${normalizedBaseCurrency} como moneda base. Actualiza los tipos de cambio para calcular reportes consolidados con esta base.`,
      helper: "La actualizacion usa tu sesion activa. Si falla, se conservan las tasas anteriores.",
    };
  }

  if (latestRateDate < getTodayDateKey()) {
    return {
      status: "possibly_stale",
      title: "Las tasas disponibles podrian no ser las mas recientes.",
      description: `Ultima tasa disponible: ${latestRateDate}. Podria no haber nueva tasa si es fin de semana o dia inhabil.`,
      helper: "Puedes actualizar cuando quieras. Si Frankfurter / ECB falla, Medra conserva las tasas anteriores.",
    };
  }

  return {
    status: "current",
    title: "Actualizadas hoy",
    description: `Ultima tasa disponible: ${latestRateDate}.`,
    helper: "Estas tasas son referencias diarias, no precios en tiempo real.",
  };
}

function getTodayDateKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getLatestAutomaticRatesForBase(rates: AutomaticExchangeRate[], baseCurrency: string) {
  const normalizedBaseCurrency = normalizeCurrency(baseCurrency);
  const latestByQuoteCurrency = new Map<string, AutomaticExchangeRate>();

  rates
    .filter((rate) => normalizeCurrency(rate.base_currency) === normalizedBaseCurrency)
    .forEach((rate) => {
      const quoteCurrency = normalizeCurrency(rate.quote_currency);
      const current = latestByQuoteCurrency.get(quoteCurrency);
      if (!current) {
        latestByQuoteCurrency.set(quoteCurrency, rate);
        return;
      }

      const rateDateDiff = new Date(rate.rate_date).getTime() - new Date(current.rate_date).getTime();
      const fetchedAtDiff = new Date(rate.fetched_at).getTime() - new Date(current.fetched_at).getTime();
      if (rateDateDiff > 0 || (rateDateDiff === 0 && fetchedAtDiff > 0)) {
        latestByQuoteCurrency.set(quoteCurrency, rate);
      }
    });

  return Array.from(latestByQuoteCurrency.values()).sort((a, b) => normalizeCurrency(a.quote_currency).localeCompare(normalizeCurrency(b.quote_currency)));
}

function groupExpensesByCategory(expenses: Expense[], categories: Category[], cards: CreditCard[]): ReportRow[] {
  const totals = new Map<string, ReportRow>();

  expenses.forEach((expense) => {
    const label = getCategoryName(categories, expense.category_id);
    const currency = getCardCurrency(cards, expense.credit_card_id);
    const id = `${label}-${currency}`;
    const current = totals.get(id)?.value ?? 0;
    totals.set(id, { id, label, currency, value: current + Number(expense.amount) });
  });

  return sortRows(totals);
}

function groupExpensesByCard(expenses: Expense[], cards: CreditCard[]): ReportRow[] {
  const totals = new Map<string, ReportRow>();

  expenses.forEach((expense) => {
    const card = cards.find((item) => item.id === expense.credit_card_id);
    const label = card?.name ?? "Tarjeta no encontrada";
    const currency = card?.currency ?? DEFAULT_CURRENCY;
    const id = `${label}-${currency}`;
    const current = totals.get(id)?.value ?? 0;
    totals.set(id, { id, label, currency, value: current + Number(expense.amount) });
  });

  return sortRows(totals);
}

function groupPaymentsByCard(payments: Payment[], cards: CreditCard[]): ReportRow[] {
  const totals = new Map<string, ReportRow>();

  payments.forEach((payment) => {
    const card = cards.find((item) => item.id === payment.credit_card_id);
    const label = card?.name ?? "Tarjeta no encontrada";
    const currency = card?.currency ?? DEFAULT_CURRENCY;
    const id = `${label}-${currency}`;
    const current = totals.get(id)?.value ?? 0;
    totals.set(id, { id, label, currency, value: current + Number(payment.amount) });
  });

  return sortRows(totals);
}

function buildComparisonByCard(cards: CreditCard[], expenses: Expense[], payments: Payment[]) {
  return cards
    .map((card) => {
      const spent = expenses
        .filter((expense) => expense.credit_card_id === card.id)
        .reduce((total, expense) => total + Number(expense.amount), 0);
      const paid = payments
        .filter((payment) => payment.credit_card_id === card.id)
        .reduce((total, payment) => total + Number(payment.amount), 0);

      return {
        id: card.id,
        label: card.name,
        currency: card.currency,
        spent,
        paid,
      };
    })
    .filter((row) => row.spent > 0 || row.paid > 0)
    .sort((a, b) => b.spent - a.spent);
}

function sortRows(rows: Map<string, ReportRow>) {
  return Array.from(rows.values()).sort((a, b) => b.value - a.value);
}

function getPeriodDayCount(filter: PeriodFilterState, cards: CreditCard[]) {
  if (filter.mode === "card_current" && cards.length > 0) {
    const totalDays = cards.reduce((total, card) => {
      const range = getRangeForCard(filter, card);
      return total + getDaysBetween(range.start, range.end);
    }, 0);

    return Math.max(Math.round(totalDays / cards.length), 1);
  }

  const range = getRangeForFilter(filter);
  return getDaysBetween(range.start, range.end);
}

function getDaysBetween(start: Date, end: Date) {
  return Math.max(Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1, 1);
}

function getCardName(cards: CreditCard[], cardId: string | null) {
  return cards.find((card) => card.id === cardId)?.name ?? "Tarjeta no encontrada";
}

function getCategoryName(categories: Category[], categoryId: string | null) {
  return categories.find((category) => category.id === categoryId)?.name ?? "Sin categoria";
}

function getCardCurrency(cards: CreditCard[], cardId: string | null) {
  return cards.find((card) => card.id === cardId)?.currency ?? DEFAULT_CURRENCY;
}

function buildPendingTotals(spentTotals: Array<{ currency: string; amount: number }>, paidTotals: Array<{ currency: string; amount: number }>) {
  const currencies = Array.from(new Set([...spentTotals, ...paidTotals].map((total) => total.currency))).sort();

  return currencies.map((currency) => {
    const spent = spentTotals.find((total) => total.currency === currency)?.amount ?? 0;
    const paid = paidTotals.find((total) => total.currency === currency)?.amount ?? 0;
    return { currency, amount: Math.max(spent - paid, 0) };
  });
}

function MoneyTotals({ totals }: { totals: Array<{ currency: string; amount: number }> }) {
  if (totals.length === 0) return <MoneyAmount amount={0} currency={DEFAULT_CURRENCY} />;

  return (
    <span className="space-y-1">
      {totals.map((total) => (
        <span className="block" key={total.currency}><MoneyAmount amount={total.amount} currency={total.currency} /></span>
      ))}
    </span>
  );
}

function ReportsInternalNavigation() {
  const links = [
    { href: "#resumen", label: "Resumen" },
    { href: "#historial-patrimonio", label: "Historial de patrimonio" },
    { href: "#tipos-cambio", label: "Tipos de cambio" },
    { href: "#patrimonio-consolidado", label: "Patrimonio consolidado" },
    { href: "#reportes-basicos", label: "Gastos y pagos" },
  ];

  return (
    <nav className="max-w-full overflow-x-auto rounded-lg border border-slate-200 bg-white p-3 shadow-sm" aria-label="Navegacion de reportes">
      <div className="flex min-w-0 flex-wrap gap-2">
        {links.map((link) => (
          <a
            className="whitespace-nowrap rounded-md bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950"
            href={link.href}
            key={link.href}
          >
            {link.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

function SectionIntro({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
    </div>
  );
}

function SummaryCard({ label, value, strong = false }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 break-words text-xl ${strong ? "font-bold text-slate-950" : "font-semibold text-slate-800"}`}>
        {value}
      </p>
    </div>
  );
}

function NetWorthPreviewCard({ row }: { row: NetWorthSnapshotRow }) {
  return (
    <article className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-700">Moneda</p>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">{row.currency}</span>
      </div>
      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">Patrimonio neto</p>
      <p className="mt-1 text-2xl font-bold text-slate-950"><MoneyAmount amount={row.netWorth} currency={row.currency} /></p>
      <div className="mt-3 space-y-1 text-sm text-slate-600">
        <p>Cuentas: <MoneyAmount amount={row.totalAccounts} currency={row.currency} /></p>
        <p>Inversiones: <MoneyAmount amount={row.totalInvestments} currency={row.currency} /></p>
        <p>Deuda tarjetas: <MoneyAmount amount={row.pendingCreditCards} currency={row.currency} /></p>
      </div>
    </article>
  );
}

function SnapshotHistoryBars({
  dateFormat,
  rows,
}: {
  dateFormat: string;
  rows: SnapshotHistoryRow[];
}) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 p-4">
      <h3 className="font-semibold text-slate-950">Evolucion basica</h3>
      <div className="mt-4 space-y-5">
        {rows.map((row) => {
          const max = Math.max(...row.snapshots.map((snapshot) => Math.abs(Number(snapshot.net_worth))), 1);
          const hasEvolution = row.snapshots.length > 1;
          const changeTone = row.absoluteChange >= 0 ? "text-emerald-700" : "text-red-700";

          return (
            <div className="min-w-0 space-y-3" key={row.currency}>
              <div className="flex min-w-0 flex-col gap-2 rounded-md bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{row.currency}</p>
                  {hasEvolution ? (
                    <p className={`text-xs font-medium ${changeTone}`}>
                      Cambio: <MoneyAmount amount={row.absoluteChange} currency={row.currency} />
                      {row.percentChange === null ? "" : ` (${formatPercentChange(row.percentChange)})`}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-600">Necesitas mas de un snapshot en esta moneda para ver evolucion.</p>
                  )}
                </div>
                {row.lastSnapshot ? (
                  <div className="min-w-0 text-sm sm:text-right">
                    <p className="font-semibold text-slate-950"><MoneyAmount amount={Number(row.lastSnapshot.net_worth)} currency={row.currency} /></p>
                    <p className="text-xs text-slate-500">Ultimo: {formatDate(row.lastSnapshot.snapshot_date, dateFormat)}</p>
                  </div>
                ) : null}
              </div>
              {row.snapshots.map((snapshot) => (
                <div key={snapshot.id}>
                  <div className="flex min-w-0 flex-col gap-1 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                    <span>{formatDate(snapshot.snapshot_date, dateFormat)}</span>
                    <span className="break-words font-medium text-slate-900"><MoneyAmount amount={Number(snapshot.net_worth)} currency={snapshot.currency} /></span>
                  </div>
                  <div className="mt-1 h-2 w-full max-w-full rounded-full bg-slate-100">
                    <div
                      className={`h-2 rounded-full ${Number(snapshot.net_worth) >= 0 ? "bg-blue-600" : "bg-red-500"}`}
                      style={{ width: `${Math.max((Math.abs(Number(snapshot.net_worth)) / max) * 100, 2)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {rows.length === 0 ? (
        <EmptyMessage text="Todavia no tienes snapshots de patrimonio. Guarda uno para empezar a ver tu evolucion." />
      ) : null}
    </div>
  );
}

function SnapshotsTable({ dateFormat, snapshots, onDelete }: { dateFormat: string; snapshots: NetWorthSnapshot[]; onDelete: (snapshot: NetWorthSnapshot) => void }) {
  if (snapshots.length === 0) {
    return (
      <div className="min-w-0 rounded-md border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-950">Snapshots recientes</h3>
        <EmptyMessage text="Todavia no tienes snapshots de patrimonio. Guarda uno para empezar a ver tu evolucion." />
      </div>
    );
  }

  return (
    <div className="min-w-0 rounded-md border border-slate-200 p-4">
      <h3 className="font-semibold text-slate-950">Snapshots recientes</h3>
      <div className="mt-3 max-w-full overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2 pr-3 font-medium">Fecha</th>
              <th className="py-2 pr-3 font-medium">Moneda</th>
              <th className="py-2 pr-3 text-right font-medium">Cuentas</th>
              <th className="py-2 pr-3 text-right font-medium">Inversiones</th>
              <th className="py-2 pr-3 text-right font-medium">Deuda</th>
              <th className="py-2 pr-3 text-right font-medium">Patrimonio</th>
              <th className="py-2 pr-3 font-medium">Notas</th>
              <th className="py-2 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map((snapshot) => (
              <tr className="border-b border-slate-100" key={snapshot.id}>
                <td className="py-3 pr-3 text-slate-700">{formatDate(snapshot.snapshot_date, dateFormat)}</td>
                <td className="py-3 pr-3">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{snapshot.currency}</span>
                </td>
                <td className="py-3 pr-3 text-right text-slate-700"><MoneyAmount amount={Number(snapshot.total_accounts)} currency={snapshot.currency} /></td>
                <td className="py-3 pr-3 text-right text-slate-700"><MoneyAmount amount={Number(snapshot.total_investments)} currency={snapshot.currency} /></td>
                <td className="py-3 pr-3 text-right text-slate-700"><MoneyAmount amount={Number(snapshot.pending_credit_cards)} currency={snapshot.currency} /></td>
                <td className="py-3 pr-3 text-right text-base font-bold text-slate-950"><MoneyAmount amount={Number(snapshot.net_worth)} currency={snapshot.currency} /></td>
                <td className="py-3 pr-3 text-slate-700">{snapshot.notes || "Sin notas"}</td>
                <td className="py-3 text-right">
                  <button className="rounded-md bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100" onClick={() => onDelete(snapshot)} type="button">
                    Borrar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConsolidatedNetWorthSection({
  baseCurrency,
  dateFormat,
  onBaseCurrencyChange,
  result,
}: {
  baseCurrency: string;
  dateFormat: string;
  onBaseCurrencyChange: (currency: string) => void;
  result: ConsolidatedNetWorthResult;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-slate-950">Reporte patrimonial consolidado</h2>
          <p className="mt-1 text-sm text-slate-600">
            Conversion solo visual para reportes. Tus saldos originales no se modifican y se usan tipos automaticos Frankfurter / ECB guardados para tu usuario.
          </p>
        </div>
        <label className="text-sm font-medium text-slate-700">
          Moneda base
          <CurrencySelect value={baseCurrency} onChange={onBaseCurrencyChange} />
        </label>
      </div>

      <div className="mt-5 min-w-0 rounded-md bg-slate-950 p-4 text-white">
        <p className="text-sm text-slate-300">Total consolidado estimado en {result.baseCurrency}</p>
        <p className="mt-1 text-3xl font-bold"><MoneyAmount amount={result.total} currency={result.baseCurrency} /></p>
        {result.missingRates.length > 0 ? (
          <p className="mt-2 text-xs text-slate-300">Este total excluye monedas sin tasa automatica disponible.</p>
        ) : null}
      </div>

      {result.missingRates.length > 0 ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Faltan tipos de cambio automaticos: {formatMissingRateList(result.missingRates)}. Esos montos no se sumaron al total consolidado.
        </div>
      ) : null}

      <div className="mt-5">
        <h3 className="text-sm font-semibold text-slate-950">Patrimonio actual por moneda</h3>
        <p className="mt-1 text-xs text-slate-500">Si falta una tasa automatica clara, esa moneda se excluye del total consolidado.</p>
      </div>

      <div className="mt-3 space-y-3">
        {result.rows.map((row) => (
          <div className="min-w-0 rounded-md border border-slate-200 p-3" key={row.currency}>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-950">{row.currency}</p>
                <p className="text-sm text-slate-600">Original: <MoneyAmount amount={row.originalAmount} currency={row.currency} /></p>
              </div>
              <div className="min-w-0 text-sm sm:text-right">
                {row.convertedAmount === null ? (
                  <p className="font-medium text-amber-700">{`Falta tipo de cambio automatico ${row.currency} -> ${result.baseCurrency}`}</p>
                ) : (
                  <>
                    <p className="font-semibold text-slate-950"><MoneyAmount amount={row.convertedAmount} currency={result.baseCurrency} /></p>
                    <p className="text-xs text-slate-500">
                      {row.rate
                        ? formatAutomaticRateUsage(row.rate, dateFormat)
                        : "Sin conversion: ya esta en la moneda base"}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        {result.rows.length === 0 ? <EmptyMessage text="Aun no hay patrimonio por moneda para consolidar." /> : null}
      </div>

      <div className="mt-5 rounded-md border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-950">Comparacion contra ultimo snapshot</h3>
        <p className="mt-1 text-sm text-slate-600">
          Usa el ultimo snapshot disponible por moneda y los tipos automaticos mas recientes disponibles para {result.baseCurrency}.
        </p>

        {result.snapshotComparison.rows.length === 0 ? (
          <EmptyMessage text="Aun no hay snapshots para comparar contra el patrimonio actual." />
        ) : (
          <>
            <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-3">
              <SummaryCard
                label="Actual consolidado"
                value={<MoneyAmount amount={result.total} currency={result.baseCurrency} />}
                strong
              />
              <SummaryCard
                label="Ultimo snapshot convertible"
                value={<MoneyAmount amount={result.snapshotComparison.total} currency={result.baseCurrency} />}
              />
              <SummaryCard
                label="Diferencia"
                value={
                  result.snapshotComparison.difference === null
                    ? "Sin datos"
                    : (
                      <>
                        <MoneyAmount amount={result.snapshotComparison.difference} currency={result.baseCurrency} />
                        {result.snapshotComparison.percentDifference === null ? "" : ` (${formatPercentChange(result.snapshotComparison.percentDifference)})`}
                      </>
                    )
                }
                strong
              />
            </div>

            {result.snapshotComparison.missingRates.length > 0 ? (
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Faltan tasas automaticas para convertir snapshots: {formatMissingRateList(result.snapshotComparison.missingRates)}. Esas monedas no se sumaron a la comparacion.
              </div>
            ) : null}

            <div className="mt-4 space-y-3">
              {result.snapshotComparison.rows.map((row) => (
                <div className="min-w-0 rounded-md bg-slate-50 p-3" key={row.currency}>
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-950">{row.currency}</p>
                      <p className="text-sm text-slate-600">
                        Snapshot {row.sourceDate ? formatDate(row.sourceDate, dateFormat) : "sin fecha"}: <MoneyAmount amount={row.originalAmount} currency={row.currency} />
                      </p>
                    </div>
                    <div className="min-w-0 text-sm sm:text-right">
                      {row.convertedAmount === null ? (
                        <p className="font-medium text-amber-700">{`Falta tipo de cambio automatico ${row.currency} -> ${result.baseCurrency}`}</p>
                      ) : (
                        <>
                          <p className="font-semibold text-slate-950"><MoneyAmount amount={row.convertedAmount} currency={result.baseCurrency} /></p>
                          <p className="text-xs text-slate-500">
                            {row.rate
                              ? formatAutomaticRateUsage(row.rate, dateFormat)
                              : "Sin conversion: ya esta en la moneda base"}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AutomaticExchangeRatesSection({
  baseCurrency,
  dateFormat,
  isUpdating,
  needsMigration,
  onBaseCurrencyChange,
  onUpdate,
  rates,
}: {
  baseCurrency: string;
  dateFormat: string;
  isUpdating: boolean;
  needsMigration: boolean;
  onBaseCurrencyChange: (currency: string) => void;
  onUpdate: () => void;
  rates: AutomaticExchangeRate[];
}) {
  const latestRates = getLatestAutomaticRatesForBase(rates, baseCurrency);
  const rateCoverage = getAutomaticExchangeRateCoverage(rates, baseCurrency);
  const availableCoverage = rateCoverage.flatMap((row) => (row.match ? [{ currency: row.currency, match: row.match }] : []));
  const missingCurrencies = rateCoverage.filter((row) => !row.match).map((row) => row.currency);
  const latestCoveredRates = availableCoverage.map((row) => row.match.rate);
  const latestFetchedAt = getLatestAutomaticRateField(latestRates, "fetched_at") ?? getLatestAutomaticRateField(latestCoveredRates, "fetched_at");
  const latestRateDate = getLatestAutomaticRateField(latestRates, "rate_date") ?? getLatestAutomaticRateField(latestCoveredRates, "rate_date");
  const hasDirectRatesForBase = latestRates.length > 0;
  const freshness = getAutomaticExchangeRateFreshness({
    baseCurrency,
    hasDirectRatesForBase,
    latestRateDate,
  });

  return (
    <div className="min-w-0 rounded-lg border border-teal-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Frankfurter / ECB</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">Tipos de cambio automaticos</h2>
          <p className="mt-1 text-sm text-slate-600">
            Tasas diarias de referencia Frankfurter / ECB para reportes consolidados. No son precios en tiempo real y no modifican tus saldos originales.
          </p>
        </div>
        <div className="min-w-0 sm:w-64">
          <label className="text-sm font-medium text-slate-700">
            Moneda base
            <CurrencySelect value={baseCurrency} onChange={onBaseCurrencyChange} />
          </label>
          <button
            className="mt-3 w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={isUpdating}
            onClick={onUpdate}
            type="button"
          >
            {isUpdating ? "Actualizando..." : "Actualizar tipos de cambio"}
          </button>
        </div>
      </div>

      {needsMigration ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Para guardar tipos de cambio automaticos, ejecuta la migracion pendiente: docs/ADD_AUTOMATIC_EXCHANGE_RATES.sql.
        </div>
      ) : null}

      {!needsMigration ? <ExchangeRateFreshnessMessage freshness={freshness} /> : null}

      <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Moneda base" value={normalizeCurrency(baseCurrency)} />
        <SummaryCard label="Fuente" value="Frankfurter / ECB" />
        <SummaryCard label="Fecha de tasa" value={latestRateDate ? formatDate(latestRateDate, dateFormat) : "Sin datos"} />
        <SummaryCard label="Ultima actualizacion" value={latestFetchedAt ? formatDateTime(latestFetchedAt, dateFormat) : "Sin datos"} />
      </div>

      <div className="mt-5 grid min-w-0 gap-3 lg:grid-cols-2">
        <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="text-sm font-semibold text-slate-950">Monedas disponibles hacia {normalizeCurrency(baseCurrency)}</h3>
          <p className="mt-1 text-xs text-slate-500">El reporte puede usar tasas directas o inversas claras en memoria.</p>
          {availableCoverage.length > 0 ? (
            <div className="mt-3 flex min-w-0 flex-wrap gap-2">
              {availableCoverage.map((row) => (
                <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800" key={row.currency}>
                  {row.currency}
                </span>
              ))}
            </div>
          ) : (
            <EmptyMessage text="Todavia no hay monedas disponibles para esta base. Actualiza los tipos de cambio para empezar." />
          )}
        </div>
        <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="text-sm font-semibold text-slate-950">Monedas faltantes</h3>
          <p className="mt-1 text-xs text-slate-500">Si una moneda falta, se excluye del total consolidado para evitar montos engañosos.</p>
          {missingCurrencies.length > 0 ? (
            <div className="mt-3 flex min-w-0 flex-wrap gap-2">
              {missingCurrencies.map((currency) => (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800" key={currency}>
                  {currency}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-md bg-green-50 p-3 text-sm text-green-800">Todas las monedas soportadas tienen una conversion disponible hacia {normalizeCurrency(baseCurrency)}.</p>
          )}
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-semibold text-slate-950">Tasas guardadas con base {normalizeCurrency(baseCurrency)}</h3>
        <p className="mt-1 text-xs text-slate-500">Estos son pares directos de base hacia destino. El reporte consolidado tambien puede usar una tasa inversa cuando la direccion es clara.</p>
        <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {latestRates.map((rate) => (
            <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-3" key={rate.id}>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{formatDate(rate.rate_date, dateFormat)}</p>
              <p className="mt-1 text-sm font-semibold text-slate-950">
                1 {rate.base_currency} = {formatExchangeRateValue(Number(rate.rate))} {rate.quote_currency}
              </p>
              <p className="mt-1 text-xs text-slate-500">Referencia diaria Frankfurter / ECB. Guardada para tu usuario.</p>
            </div>
          ))}
        </div>
        {latestRates.length === 0 ? (
          <EmptyMessage
            text={
              needsMigration
                ? "La tabla de tipos automaticos aun no existe."
                : availableCoverage.length > 0 && !hasDirectRatesForBase
                  ? "No hay pares directos guardados con esta moneda como base. El reporte puede usar tasas inversas existentes, pero conviene actualizar esta moneda base para una lectura mas clara."
                  : "Actualiza los tipos de cambio para calcular reportes consolidados."
            }
          />
        ) : null}
      </div>
    </div>
  );
}

function ExchangeRateFreshnessMessage({ freshness }: { freshness: AutomaticExchangeRateFreshness }) {
  const styles =
    freshness.status === "current"
      ? "border-green-200 bg-green-50 text-green-800"
      : freshness.status === "missing"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-blue-200 bg-blue-50 text-blue-800";

  return (
    <div className={`mt-4 rounded-md border p-3 text-sm ${styles}`}>
      <p className="font-semibold">{freshness.title}</p>
      <p className="mt-1">{freshness.description}</p>
      <p className="mt-1 text-xs opacity-90">{freshness.helper}</p>
    </div>
  );
}

function CurrencySelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <select
      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      {SUPPORTED_CURRENCIES.map((currency) => (
        <option key={currency.code} value={currency.code}>
          {currency.label}
        </option>
      ))}
    </select>
  );
}

function BarReport({ title, rows, emptyText }: { title: string; rows: ReportRow[]; emptyText: string }) {
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <div className="mt-4 space-y-4">
        {rows.map((row) => (
          <div className="min-w-0" key={row.id}>
            <div className="flex min-w-0 flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <span className="min-w-0 truncate text-slate-700">{row.label}</span>
              <span className="break-words font-medium text-slate-950"><MoneyAmount amount={row.value} currency={row.currency} /></span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-teal-600" style={{ width: `${Math.max((row.value / max) * 100, 2)}%` }} />
            </div>
          </div>
        ))}
      </div>
      {rows.length === 0 ? <EmptyMessage text={emptyText} /> : null}
    </div>
  );
}

function ComparisonReport({ rows }: { rows: Array<{ id: string; label: string; currency: string; spent: number; paid: number }> }) {
  const max = Math.max(...rows.flatMap((row) => [row.spent, row.paid]), 1);

  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Gasto vs pagos por tarjeta</h2>
      <div className="mt-4 space-y-5">
        {rows.map((row) => (
          <div className="min-w-0" key={row.id}>
            <p className="text-sm font-medium text-slate-800">{row.label}</p>
            <ComparisonBar label="Gastado" value={row.spent} max={max} currency={row.currency} colorClass="bg-red-500" />
            <ComparisonBar label="Pagado" value={row.paid} max={max} currency={row.currency} colorClass="bg-teal-600" />
          </div>
        ))}
      </div>
      {rows.length === 0 ? <EmptyMessage text="No hay gastos ni pagos para comparar en este periodo." /> : null}
    </div>
  );
}

function ComparisonBar({ label, value, max, currency, colorClass }: { label: string; value: number; max: number; currency: string; colorClass: string }) {
  return (
    <div className="mt-2 min-w-0">
      <div className="flex min-w-0 flex-col gap-1 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span>{label}</span>
        <span className="break-words"><MoneyAmount amount={value} currency={currency} /></span>
      </div>
      <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
        <div className={`h-2 rounded-full ${colorClass}`} style={{ width: `${Math.max((value / max) * 100, value > 0 ? 2 : 0)}%` }} />
      </div>
    </div>
  );
}

function HighestExpensesTable({
  dateFormat,
  expenses,
  cards,
  categories,
}: {
  dateFormat: string;
  expenses: Expense[];
  cards: CreditCard[];
  categories: Category[];
}) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-semibold text-slate-950">Gastos recientes más altos</h2>
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
                <td className="py-3 pr-4 text-slate-700">{formatDate(expense.expense_date, dateFormat)}</td>
                <td className="py-3 pr-4 text-slate-700">{getCardName(cards, expense.credit_card_id)}</td>
                <td className="py-3 pr-4 text-slate-700">{getCategoryName(categories, expense.category_id)}</td>
                <td className="py-3 pr-4 text-slate-700">{expense.description || "Sin descripcion"}</td>
                <td className="py-3 text-right font-semibold text-slate-950"><MoneyAmount amount={Number(expense.amount)} currency={getCardCurrency(cards, expense.credit_card_id)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {expenses.length === 0 ? <EmptyMessage text="No hay gastos en el periodo seleccionado." /> : null}
    </div>
  );
}

function RecentPaymentsTable({ dateFormat, payments, cards }: { dateFormat: string; payments: Payment[]; cards: CreditCard[] }) {
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
                <td className="py-3 pr-4 text-slate-700">{formatDate(payment.payment_date, dateFormat)}</td>
                <td className="py-3 pr-4 text-slate-700">{getCardName(cards, payment.credit_card_id)}</td>
                <td className="py-3 pr-4 text-slate-700">{paymentTypeLabels[payment.payment_type]}</td>
                <td className="py-3 pr-4 text-slate-700">{payment.notes || "Sin descripcion"}</td>
                <td className="py-3 text-right font-semibold text-slate-950"><MoneyAmount amount={Number(payment.amount)} currency={getCardCurrency(cards, payment.credit_card_id)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {payments.length === 0 ? <EmptyMessage text="No hay pagos en el periodo seleccionado." /> : null}
    </div>
  );
}

function EmptyMessage({ text }: { text: string }) {
  return <p className="mt-4 rounded-md bg-slate-50 p-4 text-sm text-slate-600">{text}</p>;
}

function InlineMessage({ message }: { message: Message }) {
  const styles =
    message.type === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : message.type === "success"
        ? "border-green-200 bg-green-50 text-green-800"
        : "border-blue-200 bg-blue-50 text-blue-800";

  return <div className={`rounded-md border px-4 py-3 text-sm ${styles}`}>{message.text}</div>;
}

function formatDate(dateValue: string, dateFormat?: string) {
  return formatDateForPreference(dateValue, dateFormat);
}

function formatDateTime(dateValue: string, dateFormat?: string) {
  const date = new Date(dateValue);
  const time = date.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${formatDate(dateValue, dateFormat)} ${time}`;
}

function formatPercentChange(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatExchangeRateValue(value: number) {
  return Number(value).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  });
}

function formatAutomaticRateUsage(match: AutomaticExchangeRateMatch, dateFormat?: string) {
  const baseCurrency = normalizeCurrency(match.rate.base_currency);
  const quoteCurrency = normalizeCurrency(match.rate.quote_currency);
  const rateText = formatExchangeRateValue(Number(match.rate.rate));
  const dateText = formatDate(match.rate.rate_date, dateFormat);

  if (match.direction === "direct") {
    return `Tasa usada: 1 ${baseCurrency} = ${rateText} ${quoteCurrency} (Frankfurter / ECB, ${dateText})`;
  }

  return `Tasa usada: 1 ${baseCurrency} = ${rateText} ${quoteCurrency} (Frankfurter / ECB, ${dateText}); Medra divide en memoria para convertir ${quoteCurrency} a ${baseCurrency}.`;
}

function formatMissingRateList(missingRates: string[]) {
  return missingRates
    .map((rate) => {
      const [fromCurrency, toCurrency] = rate.split("->").map((value) => value.trim());
      return fromCurrency && toCurrency ? `${fromCurrency} hacia ${toCurrency}` : rate;
    })
    .join(", ");
}

function getFriendlySnapshotError(error: string) {
  if (error.includes("net_worth_snapshots") || error.includes("schema cache")) {
    return "Falta crear la tabla de historial de patrimonio. Ejecuta docs/ADD_NET_WORTH_SNAPSHOTS.sql en Supabase.";
  }
  if (error.includes("duplicate") || error.includes("unique")) {
    return "Ya existe un snapshot para esa fecha y moneda. Usa la confirmacion para actualizarlo.";
  }
  return `No se pudo completar la accion de historial de patrimonio. Detalle: ${error}`;
}

function getFriendlyAutomaticExchangeRateError(error: SupabaseErrorLike | string) {
  const message = typeof error === "string" ? error : error.message ?? "";
  if (isMissingAutomaticExchangeRatesTableError(error)) {
    return "Para guardar tipos de cambio automaticos, ejecuta la migracion pendiente.";
  }

  return message ? "No pude cargar los tipos de cambio automaticos. Intenta mas tarde." : "No pude cargar los tipos de cambio automaticos.";
}

function isMissingAutomaticExchangeRatesTableError(error: SupabaseErrorLike | string) {
  const code = typeof error === "string" ? "" : error.code ?? "";
  const message = typeof error === "string" ? error : `${error.message ?? ""} ${error.details ?? ""}`;
  const normalizedMessage = message.toLowerCase();

  return (
    code === "42P01" ||
    normalizedMessage.includes("exchange_rates") && (normalizedMessage.includes("schema cache") || normalizedMessage.includes("does not exist"))
  );
}

function StatusPanel({ text, tone = "info" }: { text: string; tone?: "error" | "info" | "success" }) {
  const styles =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : tone === "success"
        ? "border-green-200 bg-green-50 text-green-800"
        : "border-slate-200 bg-white text-slate-600";
  return <div className={`rounded-lg border p-6 shadow-sm ${styles}`}>{text}</div>;
}
