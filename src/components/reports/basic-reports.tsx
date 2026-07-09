"use client";

import { useEffect, useMemo, useState } from "react";
import { PeriodFilterControls } from "@/components/period-filter-controls";
import { DEFAULT_CURRENCY, formatCurrency, groupMoneyByCurrency } from "@/lib/currencies";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  getDefaultPeriodFilter,
  getPeriodLabel,
  getRangeForCard,
  getRangeForFilter,
  isDateInSelectedPeriod,
  type PeriodFilterState,
} from "@/lib/period-filters";
import type { Category, CreditCard, Expense, Payment, PaymentType } from "@/types/finance";

const paymentTypeLabels: Record<PaymentType, string> = {
  minimum: "Pago minimo",
  partial: "Pago parcial",
  no_interest: "Pago para no generar intereses",
  total: "Pago total",
  other: "Otro",
};

type Message = {
  type: "error" | "info";
  text: string;
};

type ReportRow = {
  id: string;
  label: string;
  currency: string;
  value: number;
};

export function BasicReports() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterState>(getDefaultPeriodFilter);
  const [message, setMessage] = useState<Message | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
    ] = await Promise.all([
      supabase.from("credit_cards").select("*").eq("user_id", userData.user.id).order("name"),
      supabase.from("expenses").select("*").eq("user_id", userData.user.id).order("expense_date", { ascending: false }),
      supabase.from("payments").select("*").eq("user_id", userData.user.id).order("payment_date", { ascending: false }),
      supabase.from("categories").select("*").eq("user_id", userData.user.id),
    ]);

    if (cardError || expenseError || paymentError || categoryError) {
      setMessage({
        type: "error",
        text:
          cardError?.message ??
          expenseError?.message ??
          paymentError?.message ??
          categoryError?.message ??
          "No se pudieron cargar los reportes.",
      });
      setIsLoading(false);
      return;
    }

    setCards((cardData ?? []) as CreditCard[]);
    setExpenses((expenseData ?? []) as Expense[]);
    setPayments((paymentData ?? []) as Payment[]);
    setCategories((categoryData ?? []) as Category[]);
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
  const topCategory = expensesByCategory[0] ? `${expensesByCategory[0].label} (${expensesByCategory[0].currency})` : "Sin datos";
  const topCard = expensesByCard[0] ? `${expensesByCard[0].label} (${expensesByCard[0].currency})` : "Sin datos";
  const dayCount = getPeriodDayCount(periodFilter, cards);
  const dailyAverageByCurrency = totalSpentByCurrency.map((total) => ({
    currency: total.currency,
    amount: total.amount / dayCount,
  }));

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
                <td className="py-3 pr-4 text-slate-700">{new Date(`${expense.expense_date}T00:00:00`).toLocaleDateString("es-MX")}</td>
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
                <td className="py-3 pr-4 text-slate-700">{new Date(`${payment.payment_date}T00:00:00`).toLocaleDateString("es-MX")}</td>
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

function StatusPanel({ text, tone = "info" }: { text: string; tone?: "error" | "info" }) {
  const styles = tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-slate-200 bg-white text-slate-600";
  return <div className={`rounded-lg border p-6 shadow-sm ${styles}`}>{text}</div>;
}
