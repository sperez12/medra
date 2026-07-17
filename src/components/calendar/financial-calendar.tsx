"use client";

import { useEffect, useMemo, useState } from "react";
import { MoneyAmount } from "@/components/ui/money-amount";
import { DEFAULT_CURRENCY } from "@/lib/currencies";
import { formatDateForPreference } from "@/lib/date-format";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserPreferences } from "@/lib/use-user-preferences";
import type { CreditCard, Expense, Payment, PaymentType } from "@/types/finance";

const paymentTypeLabels: Record<PaymentType, string> = {
  minimum: "Pago minimo",
  partial: "Pago parcial",
  no_interest: "Pago para no generar intereses",
  total: "Pago total",
  other: "Otro",
};

type CalendarEventType = "card_cut" | "payment_due" | "payment_registered" | "important_expense";

type CalendarEvent = {
  id: string;
  date: Date;
  type: CalendarEventType;
  cardName: string;
  cardDetail: string;
  description: string;
  amount?: number;
  currency?: string;
};

type Message = {
  type: "error" | "info";
  text: string;
};

export function FinancialCalendar() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { dateFormat } = useUserPreferences();
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [message, setMessage] = useState<Message | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    if (!supabase) {
      setMessage({ type: "error", text: "Falta configurar Supabase para ver el calendario." });
      setIsLoading(false);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage({ type: "info", text: "Inicia sesion para ver tu calendario financiero." });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const [
      { data: cardData, error: cardError },
      { data: paymentData, error: paymentError },
      { data: expenseData, error: expenseError },
    ] = await Promise.all([
      supabase
        .from("credit_cards")
        .select("*")
        .eq("user_id", userData.user.id)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("payments")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("payment_date", { ascending: false }),
      supabase
        .from("expenses")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("expense_date", { ascending: false })
        .limit(50),
    ]);

    if (cardError || paymentError || expenseError) {
      setMessage({
        type: "error",
        text:
          cardError?.message ??
          paymentError?.message ??
          expenseError?.message ??
          "No se pudo cargar el calendario.",
      });
      setIsLoading(false);
      return;
    }

    setCards((cardData ?? []) as CreditCard[]);
    setPayments((paymentData ?? []) as Payment[]);
    setExpenses((expenseData ?? []) as Expense[]);
    setIsLoading(false);
  }

  const events = buildCalendarEvents(cards, payments, expenses);
  const overdueCount = events.filter((event) => getEventStatus(event.date) === "overdue").length;
  const thisWeekCount = events.filter((event) => getEventStatus(event.date) === "this_week").length;
  const upcomingCount = events.filter((event) => getEventStatus(event.date) === "upcoming").length;
  const registeredPaymentsCount = events.filter((event) => event.type === "payment_registered").length;

  if (isLoading) {
    return <StatusPanel text="Cargando calendario..." />;
  }

  if (message) {
    return <StatusPanel text={message.text} tone={message.type} />;
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-3xl font-bold text-slate-950">Calendario financiero</h1>
        <p className="mt-2 text-slate-600">
          Próximos cortes, fechas límite de pago y pagos registrados de tus tarjetas.
        </p>
      </section>

      <section className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Vencidos" value={overdueCount} tone="danger" />
        <SummaryCard label="Esta semana" value={thisWeekCount} tone="warning" />
        <SummaryCard label="Próximos" value={upcomingCount} tone="neutral" />
        <SummaryCard label="Pagos registrados" value={registeredPaymentsCount} tone="success" />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Eventos</h2>
        <div className="mt-4 space-y-3">
          {events.map((event) => (
            <EventItem dateFormat={dateFormat} event={event} key={event.id} />
          ))}
        </div>
        {events.length === 0 ? (
          <p className="mt-4 rounded-md bg-slate-50 p-4 text-sm text-slate-600">
            Todavía no hay eventos para mostrar.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function buildCalendarEvents(cards: CreditCard[], payments: Payment[], expenses: Expense[]) {
  const today = startOfDay(new Date());
  const horizon = new Date(today);
  horizon.setDate(today.getDate() + 45);

  const cardEvents = cards.flatMap((card) => {
    const cutDate = getNextDateForDay(card.statement_cut_day, today);
    const paymentDate = getNextDateForDay(card.payment_due_day, today);

    return [
      {
        id: `cut-${card.id}-${cutDate.toISOString()}`,
        date: cutDate,
        type: "card_cut" as const,
        cardName: card.name,
        cardDetail: `${card.bank} - **** ${card.last_four_digits}`,
        description: `Corte de tarjeta el día ${card.statement_cut_day}`,
      },
      {
        id: `due-${card.id}-${paymentDate.toISOString()}`,
        date: paymentDate,
        type: "payment_due" as const,
        cardName: card.name,
        cardDetail: `${card.bank} - **** ${card.last_four_digits}`,
        description: `Fecha límite de pago el día ${card.payment_due_day}`,
      },
    ];
  });

  const paymentEvents = payments.slice(0, 30).map((payment) => {
    const card = cards.find((item) => item.id === payment.credit_card_id);
    return {
      id: `payment-${payment.id}`,
      date: new Date(`${payment.payment_date}T00:00:00`),
      type: "payment_registered" as const,
      cardName: card?.name ?? "Tarjeta no encontrada",
      cardDetail: card ? `${card.bank} - **** ${card.last_four_digits}` : "Sin tarjeta",
      description: payment.notes || paymentTypeLabels[payment.payment_type],
      amount: Number(payment.amount),
      currency: card?.currency ?? DEFAULT_CURRENCY,
    };
  });

  const importantExpenseEvents = expenses
    .filter((expense) => Number(expense.amount) >= 1000)
    .slice(0, 8)
    .map((expense) => {
      const card = cards.find((item) => item.id === expense.credit_card_id);
      return {
        id: `expense-${expense.id}`,
        date: new Date(`${expense.expense_date}T00:00:00`),
        type: "important_expense" as const,
        cardName: card?.name ?? "Tarjeta no encontrada",
        cardDetail: card ? `${card.bank} - **** ${card.last_four_digits}` : "Sin tarjeta",
        description: expense.description || "Gasto importante",
        amount: Number(expense.amount),
        currency: card?.currency ?? DEFAULT_CURRENCY,
      };
    });

  return [...cardEvents, ...paymentEvents, ...importantExpenseEvents]
    .filter((event) => event.type !== "card_cut" && event.type !== "payment_due" ? true : event.date <= horizon)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

function getNextDateForDay(day: number, fromDate: Date) {
  const target = new Date(fromDate.getFullYear(), fromDate.getMonth(), Math.min(day, daysInMonth(fromDate)));
  if (target < fromDate) {
    target.setMonth(target.getMonth() + 1);
    target.setDate(Math.min(day, daysInMonth(target)));
  }

  return target;
}

function getEventStatus(date: Date) {
  const today = startOfDay(new Date());
  const eventDate = startOfDay(date);
  const diffDays = Math.ceil((eventDate.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "today";
  if (diffDays <= 7) return "this_week";
  return "upcoming";
}

function getEventTypeLabel(type: CalendarEventType) {
  const labels = {
    card_cut: "Corte",
    payment_due: "Pago límite",
    payment_registered: "Pago registrado",
    important_expense: "Gasto importante",
  };

  return labels[type];
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function daysInMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "danger" | "warning" | "neutral" | "success";
}) {
  const styles = {
    danger: "border-red-200 bg-red-50 text-red-800",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    neutral: "border-slate-200 bg-white text-slate-800",
    success: "border-teal-200 bg-teal-50 text-teal-800",
  };

  return (
    <div className={`rounded-lg border p-4 shadow-sm ${styles[tone]}`}>
      <p className="text-sm opacity-80">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

function EventItem({ dateFormat, event }: { dateFormat: string; event: CalendarEvent }) {
  const status = getEventStatus(event.date);
  const typeStyles = {
    card_cut: {
      accent: "border-l-blue-500",
      chip: "border-blue-200 bg-blue-50 text-blue-700",
    },
    payment_due: {
      accent: "border-l-red-500",
      chip: "border-red-200 bg-red-50 text-red-700",
    },
    payment_registered: {
      accent: "border-l-teal-600",
      chip: "border-teal-200 bg-teal-50 text-teal-700",
    },
    important_expense: {
      accent: "border-l-slate-500",
      chip: "border-slate-200 bg-slate-100 text-slate-700",
    },
  };
  const urgencyStyles = {
    overdue: "border-red-200 bg-red-50 text-red-700",
    today: "border-red-200 bg-red-50 text-red-700",
    this_week: "border-amber-200 bg-amber-50 text-amber-800",
    upcoming: "border-slate-200 bg-slate-50 text-slate-600",
  };
  const statusLabel = {
    overdue: "Vencido",
    today: "Hoy",
    this_week: "Esta semana",
    upcoming: "Próximo",
  };

  return (
    <article className={`rounded-lg border border-l-4 border-slate-200 bg-white p-4 text-slate-700 shadow-sm ${typeStyles[event.type].accent}`}>
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${typeStyles[event.type].chip}`}>
              {getEventTypeLabel(event.type)}
            </span>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${urgencyStyles[status]}`}>
              {statusLabel[status]}
            </span>
          </div>
          <p className="mt-2 font-semibold text-slate-950">{event.cardName}</p>
          <p className="text-sm text-slate-500">{event.cardDetail}</p>
          <p className="mt-2 text-sm">{event.description}</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="font-semibold text-slate-950">{formatDateForPreference(event.date, dateFormat)}</p>
          {event.amount ? <p className="mt-1 text-sm text-slate-600"><MoneyAmount amount={event.amount} currency={event.currency} /></p> : null}
        </div>
      </div>
    </article>
  );
}

function StatusPanel({ text, tone = "info" }: { text: string; tone?: "error" | "info" }) {
  const styles = tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-slate-200 bg-white text-slate-600";
  return <div className={`rounded-lg border p-6 shadow-sm ${styles}`}>{text}</div>;
}
