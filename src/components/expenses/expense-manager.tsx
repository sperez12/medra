"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Category, CreditCard, Expense } from "@/types/finance";

const emptyForm = {
  credit_card_id: "",
  category_id: "",
  expense_date: new Date().toISOString().slice(0, 10),
  amount: "0",
  description: "",
  expense_type: "one_time",
  is_installment_purchase: false,
  installment_months: "",
};

export function ExpenseManager() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    if (!supabase) {
      setMessage("Configura Supabase en .env.local para registrar gastos.");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage("Inicia sesion para registrar gastos.");
      return;
    }

    const [{ data: cardData }, { data: categoryData }, { data: expenseData }] = await Promise.all([
      supabase.from("credit_cards").select("*").eq("is_active", true).order("name"),
      supabase.from("categories").select("*").eq("type", "expense").order("name"),
      supabase.from("expenses").select("*").order("expense_date", { ascending: false }),
    ]);

    setCards((cardData ?? []) as CreditCard[]);
    setCategories((categoryData ?? []) as Category[]);
    setExpenses((expenseData ?? []) as Expense[]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!supabase) {
      setMessage("Configura Supabase en .env.local antes de registrar gastos.");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage("Primero inicia sesion.");
      return;
    }

    const payload = {
      user_id: userData.user.id,
      credit_card_id: form.credit_card_id,
      category_id: form.category_id || null,
      expense_date: form.expense_date,
      amount: Number(form.amount),
      description: form.description,
      expense_type: form.expense_type,
      is_installment_purchase: form.is_installment_purchase,
      installment_months: form.is_installment_purchase ? Number(form.installment_months) : null,
    };

    const { error } = await supabase.from("expenses").insert(payload);
    if (error) {
      setMessage(error.message);
      return;
    }

    setForm({ ...emptyForm, credit_card_id: form.credit_card_id });
    setMessage("Gasto registrado.");
    await loadData();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
      <form className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm" onSubmit={handleSubmit}>
        <h2 className="text-lg font-semibold text-slate-950">Nuevo gasto</h2>
        <div className="mt-4 grid gap-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Tarjeta</span>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setForm({ ...form, credit_card_id: event.target.value })}
              required
              value={form.credit_card_id}
            >
              <option value="">Selecciona una tarjeta</option>
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.name} - {card.bank}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Fecha</span>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setForm({ ...form, expense_date: event.target.value })}
              required
              type="date"
              value={form.expense_date}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Monto</span>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              min="0"
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
              required
              step="0.01"
              type="number"
              value={form.amount}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Categoria</span>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setForm({ ...form, category_id: event.target.value })}
              value={form.category_id}
            >
              <option value="">Sin categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Descripcion</span>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              required
              value={form.description}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Tipo</span>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setForm({ ...form, expense_type: event.target.value })}
              value={form.expense_type}
            >
              <option value="one_time">Unico</option>
              <option value="recurring">Recurrente</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              checked={form.is_installment_purchase}
              onChange={(event) => setForm({ ...form, is_installment_purchase: event.target.checked })}
              type="checkbox"
            />
            Es compra a meses sin intereses
          </label>

          {form.is_installment_purchase ? (
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Numero de meses</span>
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                min="1"
                onChange={(event) => setForm({ ...form, installment_months: event.target.value })}
                required
                type="number"
                value={form.installment_months}
              />
            </label>
          ) : null}
        </div>

        <button className="mt-5 w-full rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700" type="submit">
          Registrar gasto
        </button>
        {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
      </form>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Gastos recientes</h2>
        <div className="mt-4 divide-y divide-slate-100">
          {expenses.map((expense) => (
            <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between" key={expense.id}>
              <div>
                <p className="font-medium text-slate-900">{expense.description}</p>
                <p className="text-sm text-slate-500">{new Date(`${expense.expense_date}T00:00:00`).toLocaleDateString("es-MX")}</p>
              </div>
              <p className="font-semibold text-slate-950">
                {Number(expense.amount).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}
              </p>
            </div>
          ))}
        </div>
        {expenses.length === 0 ? (
          <p className="mt-4 rounded-md bg-slate-50 p-4 text-sm text-slate-600">
            Todavia no hay gastos registrados.
          </p>
        ) : null}
      </div>
    </div>
  );
}
