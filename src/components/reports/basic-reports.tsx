"use client";

import { useEffect, useMemo, useState } from "react";
import { PeriodFilterControls } from "@/components/period-filter-controls";
import { DEFAULT_CURRENCY, formatCurrency, groupMoneyByCurrency, normalizeCurrency } from "@/lib/currencies";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
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

export function BasicReports() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountMovements, setAccountMovements] = useState<AccountMovement[]>([]);
  const [assets, setAssets] = useState<InvestmentAsset[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [snapshots, setSnapshots] = useState<NetWorthSnapshot[]>([]);
  const [snapshotNotes, setSnapshotNotes] = useState("");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterState>(getDefaultPeriodFilter);
  const [message, setMessage] = useState<Message | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    if (!supabase) {
      setMessage({ type: "error", text: "Falta configurar Supabase para ver reportes." });
      setIsLoading(false);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage({ type: "info", text: "Inicia sesion para ver tus reportes." });
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
    ]);

    if (cardError || expenseError || paymentError || categoryError || accountError || movementError || assetError || holdingError || snapshotError) {
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
      `Vas a borrar el snapshot de ${snapshot.currency} del ${formatDate(snapshot.snapshot_date)}.\n\nSeguro que quieres continuar?`
    );
    if (!confirmed) return setMessage({ type: "info", text: "No se borro ningun snapshot." });

    const { error } = await supabase.from("net_worth_snapshots").delete().eq("id", snapshot.id);
    if (error) return setMessage({ type: "error", text: getFriendlySnapshotError(error.message) });

    setMessage({ type: "success", text: "Snapshot borrado correctamente." });
    await loadData();
  }

  if (isLoading) {
    return <StatusPanel text="Cargando reportes..." />;
  }

  if (message) {
    return <StatusPanel text={message.text} tone={message.type} />;
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-3xl font-bold text-slate-950">Reportes</h1>
        <p className="mt-2 text-slate-600">
          Reportes simples de gastos, pagos y tarjetas. Vista actual: {getPeriodLabel(periodFilter)}.
        </p>
      </section>

      <PeriodFilterControls value={periodFilter} onChange={setPeriodFilter} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Total gastado" value={<MoneyTotals totals={totalSpentByCurrency} />} />
        <SummaryCard label="Total pagado" value={<MoneyTotals totals={totalPaidByCurrency} />} />
        <SummaryCard label="Pendiente estimado" value={<MoneyTotals totals={pendingByCurrency} />} strong />
        <SummaryCard label="Categoria principal" value={topCategory} />
        <SummaryCard label="Tarjeta principal" value={topCard} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold text-slate-950">Historial de patrimonio</h2>
          <p className="text-sm text-slate-600">
            Guarda snapshots manuales por moneda. No hay conversion automatica entre monedas.
          </p>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {currentNetWorthRows.map((row) => (
              <NetWorthPreviewCard key={row.currency} row={row} />
            ))}
            {currentNetWorthRows.length === 0 ? (
              <div className="rounded-md bg-slate-50 p-4 text-sm text-slate-600">
                Aun no hay cuentas, inversiones ni saldos de tarjeta para calcular patrimonio.
              </div>
            ) : null}
          </div>

          <div className="rounded-md border border-slate-200 p-4">
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

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <SnapshotHistoryBars rows={snapshotHistoryRows} />
          <SnapshotsTable snapshots={snapshots.slice(0, 12)} onDelete={deleteSnapshot} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <BarReport title="Gasto por categoria" rows={expensesByCategory} emptyText="No hay gastos por categoria en este periodo." />
        <BarReport title="Gasto por tarjeta" rows={expensesByCard} emptyText="No hay gastos por tarjeta en este periodo." />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <BarReport title="Pagos por tarjeta" rows={paymentsByCard} emptyText="No hay pagos por tarjeta en este periodo." />
        <ComparisonReport rows={comparisonByCard} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Promedio de gasto por dia</p>
          <div className="mt-2 text-3xl font-bold text-slate-950">
            <MoneyTotals totals={dailyAverageByCurrency} />
          </div>
          <p className="mt-2 text-sm text-slate-500">Calculado sobre el periodo seleccionado.</p>
        </div>
        <HighestExpensesTable expenses={highestExpenses} cards={cards} categories={categories} />
      </section>

      <RecentPaymentsTable payments={recentPayments} cards={cards} />
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

  return Array.from(latestByCurrency.entries()).map(([currency, rows]) => ({
    currency,
    snapshots: rows
      .sort((a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime())
      .slice(-6),
  }));
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
  if (totals.length === 0) return <span>{formatCurrency(0, DEFAULT_CURRENCY)}</span>;

  return (
    <span className="space-y-1">
      {totals.map((total) => (
        <span className="block" key={total.currency}>{formatCurrency(total.amount, total.currency)}</span>
      ))}
    </span>
  );
}

function SummaryCard({ label, value, strong = false }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 break-words text-xl ${strong ? "font-bold text-slate-950" : "font-semibold text-slate-800"}`}>
        {value}
      </p>
    </div>
  );
}

function NetWorthPreviewCard({ row }: { row: NetWorthSnapshotRow }) {
  return (
    <article className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-700">{row.currency}</p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{formatCurrency(row.netWorth, row.currency)}</p>
      <div className="mt-3 space-y-1 text-sm text-slate-600">
        <p>Cuentas: {formatCurrency(row.totalAccounts, row.currency)}</p>
        <p>Inversiones: {formatCurrency(row.totalInvestments, row.currency)}</p>
        <p>Deuda tarjetas: {formatCurrency(row.pendingCreditCards, row.currency)}</p>
      </div>
    </article>
  );
}

function SnapshotHistoryBars({
  rows,
}: {
  rows: Array<{
    currency: string;
    snapshots: NetWorthSnapshot[];
  }>;
}) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <h3 className="font-semibold text-slate-950">Evolucion basica</h3>
      <div className="mt-4 space-y-5">
        {rows.map((row) => {
          const max = Math.max(...row.snapshots.map((snapshot) => Math.abs(Number(snapshot.net_worth))), 1);
          return (
            <div className="space-y-3" key={row.currency}>
              <p className="text-sm font-semibold text-slate-700">{row.currency}</p>
              {row.snapshots.map((snapshot) => (
                <div key={snapshot.id}>
                  <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                    <span>{formatDate(snapshot.snapshot_date)}</span>
                    <span className="font-medium text-slate-900">{formatCurrency(Number(snapshot.net_worth), snapshot.currency)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100">
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
      {rows.length === 0 ? <EmptyMessage text="Aun no hay snapshots guardados." /> : null}
    </div>
  );
}

function SnapshotsTable({ snapshots, onDelete }: { snapshots: NetWorthSnapshot[]; onDelete: (snapshot: NetWorthSnapshot) => void }) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <h3 className="font-semibold text-slate-950">Snapshots recientes</h3>
      <div className="mt-3 overflow-x-auto">
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
                <td className="py-3 pr-3 text-slate-700">{formatDate(snapshot.snapshot_date)}</td>
                <td className="py-3 pr-3 text-slate-700">{snapshot.currency}</td>
                <td className="py-3 pr-3 text-right text-slate-700">{formatCurrency(Number(snapshot.total_accounts), snapshot.currency)}</td>
                <td className="py-3 pr-3 text-right text-slate-700">{formatCurrency(Number(snapshot.total_investments), snapshot.currency)}</td>
                <td className="py-3 pr-3 text-right text-slate-700">{formatCurrency(Number(snapshot.pending_credit_cards), snapshot.currency)}</td>
                <td className="py-3 pr-3 text-right font-semibold text-slate-950">{formatCurrency(Number(snapshot.net_worth), snapshot.currency)}</td>
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
      {snapshots.length === 0 ? <EmptyMessage text="Aun no hay snapshots recientes." /> : null}
    </div>
  );
}

function BarReport({ title, rows, emptyText }: { title: string; rows: ReportRow[]; emptyText: string }) {
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <div className="mt-4 space-y-4">
        {rows.map((row) => (
          <div key={row.id}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-slate-700">{row.label}</span>
              <span className="font-medium text-slate-950">{formatCurrency(row.value, row.currency)}</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-100">
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
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Gasto vs pagos por tarjeta</h2>
      <div className="mt-4 space-y-5">
        {rows.map((row) => (
          <div key={row.id}>
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
    <div className="mt-2">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span>{formatCurrency(value, currency)}</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-slate-100">
        <div className={`h-2 rounded-full ${colorClass}`} style={{ width: `${Math.max((value / max) * 100, value > 0 ? 2 : 0)}%` }} />
      </div>
    </div>
  );
}

function HighestExpensesTable({
  expenses,
  cards,
  categories,
}: {
  expenses: Expense[];
  cards: CreditCard[];
  categories: Category[];
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Gastos recientes más altos</h2>
      <div className="mt-4 overflow-x-auto">
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
                <td className="py-3 pr-4 text-slate-700">{formatDate(expense.expense_date)}</td>
                <td className="py-3 pr-4 text-slate-700">{getCardName(cards, expense.credit_card_id)}</td>
                <td className="py-3 pr-4 text-slate-700">{getCategoryName(categories, expense.category_id)}</td>
                <td className="py-3 pr-4 text-slate-700">{expense.description || "Sin descripcion"}</td>
                <td className="py-3 text-right font-semibold text-slate-950">{formatCurrency(Number(expense.amount), getCardCurrency(cards, expense.credit_card_id))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {expenses.length === 0 ? <EmptyMessage text="No hay gastos en el periodo seleccionado." /> : null}
    </div>
  );
}

function RecentPaymentsTable({ payments, cards }: { payments: Payment[]; cards: CreditCard[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Pagos recientes</h2>
      <div className="mt-4 overflow-x-auto">
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
                <td className="py-3 pr-4 text-slate-700">{formatDate(payment.payment_date)}</td>
                <td className="py-3 pr-4 text-slate-700">{getCardName(cards, payment.credit_card_id)}</td>
                <td className="py-3 pr-4 text-slate-700">{paymentTypeLabels[payment.payment_type]}</td>
                <td className="py-3 pr-4 text-slate-700">{payment.notes || "Sin descripcion"}</td>
                <td className="py-3 text-right font-semibold text-slate-950">{formatCurrency(Number(payment.amount), getCardCurrency(cards, payment.credit_card_id))}</td>
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

function formatDate(dateValue: string) {
  return new Date(`${dateValue}T00:00:00`).toLocaleDateString("es-MX");
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

function StatusPanel({ text, tone = "info" }: { text: string; tone?: "error" | "info" | "success" }) {
  const styles =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : tone === "success"
        ? "border-green-200 bg-green-50 text-green-800"
        : "border-slate-200 bg-white text-slate-600";
  return <div className={`rounded-lg border p-6 shadow-sm ${styles}`}>{text}</div>;
}
