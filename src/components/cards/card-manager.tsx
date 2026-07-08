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

export function CardManager() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    if (!supabase) {
      setMessage("Configura Supabase en .env.local para guardar tarjetas.");
      setIsLoading(false);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage("Inicia sesion para ver tus tarjetas.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const [{ data: cardData, error: cardError }, { data: expenseData, error: expenseError }] = await Promise.all([
      supabase
        .from("credit_cards")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false }),
      supabase.from("expenses").select("*").eq("user_id", userData.user.id),
    ]);

    if (cardError || expenseError) {
      setMessage(cardError?.message ?? expenseError?.message ?? "No se pudieron cargar los datos.");
      setIsLoading(false);
      return;
    }

    setCards((cardData ?? []) as CreditCard[]);
    setExpenses((expenseData ?? []) as Expense[]);
    setIsLoading(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!supabase) {
      setMessage("Configura Supabase en .env.local antes de crear tarjetas.");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage("Primero inicia sesion.");
      return;
    }

    const payload = {
      user_id: userData.user.id,
      name: form.name,
      bank: form.bank,
      last_four_digits: form.last_four_digits,
      credit_limit: Number(form.credit_limit),
      statement_cut_day: Number(form.statement_cut_day),
      payment_due_day: Number(form.payment_due_day),
      currency: form.currency,
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
      setMessage(error.message);
      return;
    }

    setForm(emptyForm);
    setEditingId(null);
    setMessage(editingId ? "Tarjeta actualizada." : "Tarjeta creada.");
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
      setMessage("Configura Supabase en .env.local antes de borrar tarjetas.");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage("Primero inicia sesion.");
      return;
    }

    const { error } = await supabase
      .from("credit_cards")
      .delete()
      .eq("id", id)
      .eq("user_id", userData.user.id);
    setMessage(error ? error.message : "Tarjeta borrada.");
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
          <TextInput label="Ultimos 4 digitos" maxLength={4} value={form.last_four_digits} onChange={(value) => setForm({ ...form, last_four_digits: value })} />
          <TextInput label="Limite de credito" type="number" value={form.credit_limit} onChange={(value) => setForm({ ...form, credit_limit: value })} />
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
        {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
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
                    Corte: dia {card.statement_cut_day}. Pago: dia {card.payment_due_day}.
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    Periodo actual: {period.start.toLocaleDateString("es-MX")} a {period.end.toLocaleDateString("es-MX")}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-sm text-slate-500">Gastado en periodo</p>
                  <p className="text-2xl font-bold text-slate-950">
                    {total.toLocaleString("es-MX", { style: "currency", currency: card.currency })}
                  </p>
                  <p className="text-sm text-slate-500">
                    Limite: {Number(card.credit_limit).toLocaleString("es-MX", { style: "currency", currency: card.currency })}
                  </p>
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
};

function TextInput({ label, value, onChange, type = "text", min, max, maxLength }: TextInputProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
        max={max}
        maxLength={maxLength}
        min={min}
        onChange={(event) => onChange(event.target.value)}
        required={label !== "Color opcional"}
        type={type}
        value={value}
      />
    </label>
  );
}
