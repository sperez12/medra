"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getCurrentCardPeriod } from "@/lib/periods";
import type { CreditCard, Expense } from "@/types/finance";

const emptyForm = {
  name: "",
  bank: "",
  last_four_digits: "",
  credit_limit: "0",
  statement_cut_day: "10",
  payment_due_day: "25",
  currency: "MXN",
  color: "#0d9488",
  is_active: true,
};

type Message = {
  type: "success" | "error" | "info";
  text: string;
};

export function CardManager() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    if (!supabase) {
      setMessage({ type: "error", text: "Falta configurar Supabase para guardar tarjetas." });
      setIsLoading(false);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage({ type: "info", text: "Inicia sesion para ver tus tarjetas." });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const [{ data: cardData, error: cardError }, { data: expenseData, error: expenseError }] =
      await Promise.all([
        supabase
          .from("credit_cards")
          .select("*")
          .eq("user_id", userData.user.id)
          .order("created_at", { ascending: false }),
        supabase.from("expenses").select("*").eq("user_id", userData.user.id),
      ]);

    if (cardError || expenseError) {
      setMessage({
        type: "error",
        text: cardError?.message ?? expenseError?.message ?? "No se pudieron cargar tus tarjetas.",
      });
      setIsLoading(false);
      return;
    }

    setCards((cardData ?? []) as CreditCard[]);
    setExpenses((expenseData ?? []) as Expense[]);
    setIsLoading(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!supabase) {
      setMessage({ type: "error", text: "Falta configurar Supabase antes de guardar tarjetas." });
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage({ type: "error", text: "Primero inicia sesion para guardar tarjetas." });
      return;
    }

    const validationError = validateCardForm(form);
    if (validationError) {
      setMessage({ type: "error", text: validationError });
      return;
    }

    const payload = {
      user_id: userData.user.id,
      name: form.name.trim(),
      bank: form.bank.trim(),
      last_four_digits: form.last_four_digits.trim(),
      credit_limit: Number(form.credit_limit),
      statement_cut_day: Number(form.statement_cut_day),
      payment_due_day: Number(form.payment_due_day),
      currency: form.currency.trim().toUpperCase(),
      color: form.color || null,
      is_active: form.is_active,
    };

    const request = editingId
      ? supabase
          .from("credit_cards")
          .update(payload)
          .eq("id", editingId)
          .eq("user_id", userData.user.id)
      : supabase.from("credit_cards").insert(payload);

    const { error } = await request;
    if (error) {
      setMessage({ type: "error", text: getFriendlyCardError(error.message) });
      return;
    }

    setForm(emptyForm);
    setEditingId(null);
    setMessage({
      type: "success",
      text: editingId ? "Tarjeta actualizada correctamente." : "Tarjeta creada correctamente.",
    });
    await loadData();
  }

  function startEdit(card: CreditCard) {
    setEditingId(card.id);
    setForm({
      name: card.name,
      bank: card.bank,
      last_four_digits: card.last_four_digits,
      credit_limit: String(card.credit_limit),
      statement_cut_day: String(card.statement_cut_day),
      payment_due_day: String(card.payment_due_day),
      currency: card.currency,
      color: card.color ?? "",
      is_active: card.is_active,
    });
  }

  async function deleteCard(id: string) {
    if (!supabase) {
      setMessage({ type: "error", text: "Falta configurar Supabase antes de borrar tarjetas." });
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage({ type: "error", text: "Primero inicia sesion para borrar tarjetas." });
      return;
    }

    const card = cards.find((item) => item.id === id);
    const expenseCount = expenses.filter((expense) => expense.credit_card_id === id).length;
    const warning =
      expenseCount > 0
        ? `La tarjeta "${card?.name ?? "seleccionada"}" tiene ${expenseCount} gasto(s) asociados. Si la borras, esos gastos tambien se borraran y puede afectar tu historial.`
        : `Vas a borrar la tarjeta "${card?.name ?? "seleccionada"}".`;

    const confirmed = window.confirm(`${warning}\n\n¿Seguro que quieres continuar?`);
    if (!confirmed) {
      setMessage({ type: "info", text: "No se borro la tarjeta." });
      return;
    }

    const { error } = await supabase
      .from("credit_cards")
      .delete()
      .eq("id", id)
      .eq("user_id", userData.user.id);

    setMessage({
      type: error ? "error" : "success",
      text: error ? getFriendlyCardError(error.message) : "Tarjeta borrada correctamente.",
    });
    await loadData();
  }

  function getCurrentPeriodTotal(card: CreditCard) {
    const period = getCurrentCardPeriod(card.statement_cut_day);

    return expenses
      .filter((expense) => {
        const expenseDate = new Date(`${expense.expense_date}T00:00:00`);
        return (
          expense.credit_card_id === card.id &&
          expenseDate >= period.start &&
          expenseDate <= period.end
        );
      })
      .reduce((total, expense) => total + Number(expense.amount), 0);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
      <form className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm" onSubmit={handleSubmit}>
        <h2 className="text-lg font-semibold text-slate-950">
          {editingId ? "Editar tarjeta" : "Nueva tarjeta"}
        </h2>
        <div className="mt-4 grid gap-4">
          <TextInput label="Nombre" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
          <TextInput label="Banco" value={form.bank} onChange={(value) => setForm({ ...form, bank: value })} />
          <TextInput label="Ultimos 4 digitos" inputMode="numeric" maxLength={4} value={form.last_four_digits} onChange={(value) => setForm({ ...form, last_four_digits: value })} />
          <TextInput label="Limite de credito" min="0.01" step="0.01" type="number" value={form.credit_limit} onChange={(value) => setForm({ ...form, credit_limit: value })} />
          <TextInput label="Dia de corte" max="31" min="1" type="number" value={form.statement_cut_day} onChange={(value) => setForm({ ...form, statement_cut_day: value })} />
          <TextInput label="Dia limite de pago" max="31" min="1" type="number" value={form.payment_due_day} onChange={(value) => setForm({ ...form, payment_due_day: value })} />
          <TextInput label="Moneda" value={form.currency} onChange={(value) => setForm({ ...form, currency: value.toUpperCase() })} />
          <TextInput label="Color opcional" type="color" value={form.color} onChange={(value) => setForm({ ...form, color: value })} />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              checked={form.is_active}
              onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
              type="checkbox"
            />
            Activa
          </label>
        </div>
        <button className="mt-5 w-full rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700" type="submit">
          {editingId ? "Guardar cambios" : "Crear tarjeta"}
        </button>
        {editingId ? (
          <button
            className="mt-2 w-full rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700"
            onClick={() => {
              setEditingId(null);
              setForm(emptyForm);
            }}
            type="button"
          >
            Cancelar edicion
          </button>
        ) : null}
        {message ? <StatusMessage message={message} /> : null}
      </form>

      <div className="space-y-4">
        {isLoading ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-600">
            Cargando tarjetas...
          </div>
        ) : null}

        {cards.map((card) => {
          const period = getCurrentCardPeriod(card.statement_cut_day);
          const total = getCurrentPeriodTotal(card);
          const limit = Number(card.credit_limit);
          const available = Math.max(limit - total, 0);
          const usedPercent = limit > 0 ? Math.min((total / limit) * 100, 100) : 0;
          const daysToCut = getDaysUntilDay(card.statement_cut_day);
          const daysToPayment = getDaysUntilDay(card.payment_due_day);

          return (
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" key={card.id}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: card.color ?? "#0d9488" }} />
                    <h3 className="text-lg font-semibold text-slate-950">{card.name}</h3>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {card.bank} - **** {card.last_four_digits} - {card.currency}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    Periodo actual: {period.start.toLocaleDateString("es-MX")} a {period.end.toLocaleDateString("es-MX")}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    Corte: dia {card.statement_cut_day} ({daysToCut} dia(s)). Pago: dia {card.payment_due_day} ({daysToPayment} dia(s)).
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-sm text-slate-500">Gastado en periodo</p>
                  <p className="text-2xl font-bold text-slate-950">{formatMoney(total, card.currency)}</p>
                  <p className="text-sm text-slate-500">
                    Disponible estimado: {formatMoney(available, card.currency)}
                  </p>
                  <p className="text-sm text-slate-500">Limite: {formatMoney(limit, card.currency)}</p>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Uso del limite</span>
                  <span>{usedPercent.toFixed(1)}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-teal-600" style={{ width: `${usedPercent}%` }} />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={() => startEdit(card)} type="button">
                  Editar
                </button>
                <button className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700" onClick={() => deleteCard(card.id)} type="button">
                  Borrar
                </button>
              </div>
            </article>
          );
        })}

        {!isLoading && cards.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
            Todavia no hay tarjetas. Crea la primera desde el formulario.
          </div>
        ) : null}
      </div>
    </div>
  );
}

type TextInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  min?: string;
  max?: string;
  maxLength?: number;
  step?: string;
  inputMode?: "numeric";
};

function TextInput({ label, value, onChange, type = "text", min, max, maxLength, step, inputMode }: TextInputProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
        inputMode={inputMode}
        max={max}
        maxLength={maxLength}
        min={min}
        onChange={(event) => onChange(event.target.value)}
        required={label !== "Color opcional"}
        step={step}
        type={type}
        value={value}
      />
    </label>
  );
}

function validateCardForm(form: typeof emptyForm) {
  if (!form.name.trim()) return "Escribe el nombre de la tarjeta.";
  if (!form.bank.trim()) return "Escribe el banco de la tarjeta.";
  if (!/^\d{4}$/.test(form.last_four_digits.trim())) {
    return "Los ultimos 4 digitos deben ser exactamente 4 numeros.";
  }
  if (Number(form.credit_limit) <= 0) return "El limite de credito debe ser mayor a 0.";
  if (!isDayBetween1And31(form.statement_cut_day)) return "El dia de corte debe estar entre 1 y 31.";
  if (!isDayBetween1And31(form.payment_due_day)) return "El dia limite de pago debe estar entre 1 y 31.";
  if (!form.currency.trim()) return "Escribe la moneda, por ejemplo MXN.";
  return "";
}

function isDayBetween1And31(value: string) {
  const day = Number(value);
  return Number.isInteger(day) && day >= 1 && day <= 31;
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

function formatMoney(amount: number, currency: string) {
  try {
    return amount.toLocaleString("es-MX", { style: "currency", currency });
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function getFriendlyCardError(error: string) {
  if (error.includes("last_four_digits")) return "Revisa los ultimos 4 digitos de la tarjeta.";
  return `No se pudo completar la accion. Detalle: ${error}`;
}

function StatusMessage({ message }: { message: Message }) {
  const styles = {
    success: "border-green-200 bg-green-50 text-green-800",
    error: "border-red-200 bg-red-50 text-red-800",
    info: "border-slate-200 bg-slate-50 text-slate-700",
  };

  return <p className={`mt-4 rounded-md border px-3 py-2 text-sm ${styles[message.type]}`}>{message.text}</p>;
}
