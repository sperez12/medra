"use client";

import { useEffect, useMemo, useState } from "react";
import { PeriodFilterControls } from "@/components/period-filter-controls";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  getDefaultPeriodFilter,
  getPeriodLabel,
  getRangeForCard,
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

export function DashboardSummary() {
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
    ]);

    if (cardError || expenseError || paymentError || categoryError) {
      setMessage({
        type: "error",
        text:
          cardError?.message ??
          expenseError?.message ??
          paymentError?.message ??
          categoryError?.message ??
          "No se pudo cargar el dashboard.",
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

  const cardSummaries = cards.map((card) => {
    const period = getRangeForCard(periodFilter, card);
    const spent = sumExpensesForCardPeriod(expenses, card.id, period.start, period.end);
    const paid = sumPaymentsForCardPeriod(payments, card.id, period.start, period.end);
    const pending = Math.max(spent - paid, 0);
    const limit = Number(card.credit_limit);
    const available = Math.max(limit - pending, 0);
    const daysToCut = getDaysUntilDay(card.statement_cut_day);
    const daysToPayment = getDaysUntilDay(card.payment_due_day);

    return {
      card,
      spent,
      paid,
      pending,
      available,
      daysToCut,
      daysToPayment,
    };
  });

  const totalSpent = cardSummaries.reduce((total, item) => total + item.spent, 0);
  const totalPaid = cardSummaries.reduce((total, item) => total + item.paid, 0);
  const totalPending = cardSummaries.reduce((total, item) => total + item.pending, 0);
  const totalAvailable = cardSummaries.reduce((total, item) => total + item.available, 0);
  const cardsNearCut = cardSummaries.filter((item) => item.daysToCut <= 7);
  const cardsNearPayment = cardSummaries.filter((item) => item.daysToPayment <= 7);
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
  const maxBarValue = Math.max(totalSpent, totalPaid, totalPending, totalAvailable, 1);

  if (isLoading) {
    return <StatusPanel text="Cargando dashboard..." />;
  }

  if (message) {
    return <StatusPanel text={message.text} tone={message.type} />;
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-3xl font-bold text-slate-950">Dashboard</h1>
        <p className="mt-2 text-slate-600">
          Resumen global de tus tarjetas, gastos y pagos. Vista actual: {getPeriodLabel(periodFilter)}.
        </p>
      </section>

      <PeriodFilterControls value={periodFilter} onChange={setPeriodFilter} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Gastado del periodo" value={formatMoney(totalSpent)} />
        <SummaryCard label="Pagado del periodo" value={formatMoney(totalPaid)} />
        <SummaryCard label="Saldo pendiente estimado" value={formatMoney(totalPending)} strong />
        <SummaryCard label="Credito disponible estimado" value={formatMoney(totalAvailable)} />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <SmallStat label="Tarjetas activas" value={cards.length} />
        <SmallStat label="Proximas a corte" value={cardsNearCut.length} />
        <SmallStat label="Proximas a pago" value={cardsNearPayment.length} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Resumen visual</h2>
        <div className="mt-4 space-y-3">
          <DashboardBar label="Gastado" value={totalSpent} max={maxBarValue} colorClass="bg-red-500" />
          <DashboardBar label="Pagado" value={totalPaid} max={maxBarValue} colorClass="bg-teal-600" />
          <DashboardBar label="Pendiente" value={totalPending} max={maxBarValue} colorClass="bg-amber-500" />
          <DashboardBar label="Disponible" value={totalAvailable} max={maxBarValue} colorClass="bg-slate-500" />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <UpcomingCards title="Tarjetas proximas a corte" items={cardsNearCut} type="cut" />
        <UpcomingCards title="Tarjetas proximas a pago" items={cardsNearPayment} type="payment" />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <RecentExpensesTable
          categories={categories}
          cards={cards}
          expenses={recentExpenses}
        />
        <RecentPaymentsTable cards={cards} payments={recentPayments} />
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

function formatMoney(amount: number) {
  return amount.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function SummaryCard({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl ${strong ? "font-bold text-slate-950" : "font-semibold text-slate-800"}`}>
        {value}
      </p>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

function DashboardBar({
  label,
  value,
  max,
  colorClass,
}: {
  label: string;
  value: number;
  max: number;
  colorClass: string;
}) {
  const width = Math.max((value / max) * 100, value > 0 ? 2 : 0);

  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium text-slate-900">{formatMoney(value)}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-100">
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
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <div className="mt-4 space-y-3">
        {items.map(({ card, daysToCut, daysToPayment }) => {
          const days = type === "cut" ? daysToCut : daysToPayment;
          return (
            <div className="rounded-md border border-slate-200 p-3" key={card.id}>
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
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Gastos recientes</h2>
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
                <td className="py-3 pr-4 text-slate-700">
                  {new Date(`${expense.expense_date}T00:00:00`).toLocaleDateString("es-MX")}
                </td>
                <td className="py-3 pr-4 text-slate-700">{getCardName(cards, expense.credit_card_id)}</td>
                <td className="py-3 pr-4 text-slate-700">{getCategoryName(categories, expense.category_id)}</td>
                <td className="py-3 pr-4 text-slate-700">{expense.description || "Sin descripcion"}</td>
                <td className="py-3 text-right font-semibold text-slate-950">
                  {formatMoney(Number(expense.amount))}
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
                <td className="py-3 pr-4 text-slate-700">
                  {new Date(`${payment.payment_date}T00:00:00`).toLocaleDateString("es-MX")}
                </td>
                <td className="py-3 pr-4 text-slate-700">{getCardInfo(cards, payment.credit_card_id)}</td>
                <td className="py-3 pr-4 text-slate-700">{paymentTypeLabels[payment.payment_type]}</td>
                <td className="py-3 pr-4 text-slate-700">{payment.notes || "Sin descripcion"}</td>
                <td className="py-3 text-right font-semibold text-slate-950">
                  {formatMoney(Number(payment.amount))}
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
