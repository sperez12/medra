"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PeriodFilterControls } from "@/components/period-filter-controls";
import {
  getDefaultPeriodFilter,
  getPeriodLabel,
  isDateInSelectedPeriod,
  type PeriodFilterState,
} from "@/lib/period-filters";
import { DEFAULT_CURRENCY, formatCurrency } from "@/lib/currencies";
import { DEFAULT_EXPENSE_CATEGORY_NAMES, dedupeCategories } from "@/lib/categories";
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

type Message = {
  type: "success" | "error" | "info";
  text: string;
};

export function ExpenseManager() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterState>(getDefaultPeriodFilter);
  const [message, setMessage] = useState<Message | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    if (!supabase) {
      setMessage({ type: "error", text: "Falta configurar Supabase para registrar gastos." });
      setIsLoading(false);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage({ type: "info", text: "Inicia sesion para registrar gastos." });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const loadedCategories = await ensureDefaultCategories(userData.user.id);

    const [
      { data: cardData, error: cardError },
      { data: expenseData, error: expenseError },
    ] = await Promise.all([
      supabase
        .from("credit_cards")
        .select("*")
        .eq("user_id", userData.user.id)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("expenses")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("expense_date", { ascending: false }),
    ]);

    if (cardError || expenseError) {
      setMessage({
        type: "error",
        text: cardError?.message ?? expenseError?.message ?? "No se pudieron cargar tus gastos.",
      });
      setIsLoading(false);
      return;
    }

    setCards((cardData ?? []) as CreditCard[]);
    setCategories(dedupeCategories(loadedCategories));
    setExpenses((expenseData ?? []) as Expense[]);
    setIsLoading(false);
  }

  async function ensureDefaultCategories(userId: string) {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("user_id", userId)
      .eq("type", "expense")
      .order("name");

    if (error) {
      setMessage({ type: "error", text: `No se pudieron cargar las categorias. Detalle: ${error.message}` });
      return [];
    }

    const existingCategories = dedupeCategories((data ?? []) as Category[]);
    const existingNames = new Set(existingCategories.map((category) => category.name.toLowerCase()));
    const missingNames = DEFAULT_EXPENSE_CATEGORY_NAMES.filter((name) => !existingNames.has(name.toLowerCase()));

    if (missingNames.length > 0) {
      const { error: insertError } = await supabase.from("categories").insert(
        missingNames.map((name) => ({
          user_id: userId,
          name,
          type: "expense",
          color: null,
        }))
      );

      if (insertError) {
        setMessage({ type: "error", text: `No se pudieron crear las categorias iniciales. Detalle: ${insertError.message}` });
        return existingCategories;
      }

      const { data: refreshedCategories } = await supabase
        .from("categories")
        .select("*")
        .eq("user_id", userId)
        .eq("type", "expense")
        .order("name");

      return dedupeCategories((refreshedCategories ?? []) as Category[]);
    }

    return existingCategories;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!supabase) {
      setMessage({ type: "error", text: "Falta configurar Supabase antes de guardar gastos." });
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage({ type: "error", text: "Primero inicia sesion para guardar gastos." });
      return;
    }

    const validationError = validateExpenseForm(form);
    if (validationError) {
      setMessage({ type: "error", text: validationError });
      return;
    }

    const payload = {
      user_id: userData.user.id,
      credit_card_id: form.credit_card_id,
      category_id: form.category_id,
      expense_date: form.expense_date,
      amount: Number(form.amount),
      description: form.description.trim(),
      expense_type: form.expense_type,
      is_installment_purchase: form.is_installment_purchase,
      installment_months: form.is_installment_purchase ? Number(form.installment_months) : null,
    };

    const request = editingExpenseId
      ? supabase
          .from("expenses")
          .update(payload)
          .eq("id", editingExpenseId)
          .eq("user_id", userData.user.id)
      : supabase.from("expenses").insert(payload);

    const { error } = await request;
    if (error) {
      setMessage({ type: "error", text: getFriendlyExpenseError(error.message) });
      return;
    }

    setForm({ ...emptyForm, credit_card_id: form.credit_card_id, category_id: form.category_id });
    setEditingExpenseId(null);
    setMessage({
      type: "success",
      text: editingExpenseId ? "Gasto actualizado correctamente." : "Gasto registrado correctamente.",
    });
    await loadData();
  }

  function startEdit(expense: Expense) {
    setEditingExpenseId(expense.id);
    setForm({
      credit_card_id: expense.credit_card_id,
      category_id: expense.category_id ?? "",
      expense_date: expense.expense_date,
      amount: String(expense.amount),
      description: expense.description ?? "",
      expense_type: expense.expense_type,
      is_installment_purchase: expense.is_installment_purchase,
      installment_months: expense.installment_months ? String(expense.installment_months) : "",
    });
    setMessage({ type: "info", text: "Editando gasto. Cuando termines, presiona Guardar cambios." });
  }

  function cancelEdit() {
    setEditingExpenseId(null);
    setForm(emptyForm);
    setMessage({ type: "info", text: "Edicion cancelada." });
  }

  async function deleteExpense(expense: Expense) {
    if (!supabase) {
      setMessage({ type: "error", text: "Falta configurar Supabase antes de borrar gastos." });
      return;
    }

    const confirmed = window.confirm(
      `Vas a borrar este gasto:\n\n${expense.description || "Sin descripcion"} - ${formatCurrency(Number(expense.amount), getCardCurrency(expense.credit_card_id))}\n\nEsta acción no se puede deshacer. ¿Seguro que quieres continuar?`
    );

    if (!confirmed) {
      setMessage({ type: "info", text: "No se borro el gasto." });
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage({ type: "error", text: "Primero inicia sesion para borrar gastos." });
      return;
    }

    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", expense.id)
      .eq("user_id", userData.user.id);

    if (error) {
      setMessage({ type: "error", text: getFriendlyExpenseError(error.message) });
      return;
    }

    if (editingExpenseId === expense.id) {
      setEditingExpenseId(null);
      setForm(emptyForm);
    }

    setMessage({ type: "success", text: "Gasto borrado correctamente. La vista de tarjetas se actualizara al entrar de nuevo a Tarjetas." });
    await loadData();
  }

  function getCardName(cardId: string) {
    return cards.find((card) => card.id === cardId)?.name ?? "Tarjeta no encontrada";
  }

  function getCategoryName(categoryId: string | null) {
    return categories.find((category) => category.id === categoryId)?.name ?? "Sin categoria";
  }

  function getCardCurrency(cardId: string | null) {
    return cards.find((card) => card.id === cardId)?.currency ?? DEFAULT_CURRENCY;
  }

  const filteredExpenses = expenses.filter((expense) =>
    isDateInSelectedPeriod({
      dateValue: expense.expense_date,
      cardId: expense.credit_card_id,
      cards,
      filter: periodFilter,
    })
  );

  return (
    <div className="grid max-w-full min-w-0 gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
      <form className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6" onSubmit={handleSubmit}>
        <h2 className="text-lg font-semibold text-slate-950">
          {editingExpenseId ? "Editar gasto" : "Nuevo gasto"}
        </h2>
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
              min="0.01"
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
              required
              value={form.category_id}
            >
              <option value="">Selecciona una categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Descripcion opcional</span>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Ejemplo: cafe, gasolina, farmacia"
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
          {editingExpenseId ? "Guardar cambios" : "Registrar gasto"}
        </button>
        {editingExpenseId ? (
          <button
            className="mt-2 w-full rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700"
            onClick={cancelEdit}
            type="button"
          >
            Cancelar edicion
          </button>
        ) : null}
        {message ? <StatusMessage message={message} /> : null}
      </form>

      <div className="min-w-0 max-w-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-950">Gastos</h2>
            <p className="mt-1 text-sm text-slate-600">Vista actual: {getPeriodLabel(periodFilter)}.</p>
          </div>
          <PeriodFilterControls value={periodFilter} onChange={setPeriodFilter} />
        </div>
        {isLoading ? <p className="mt-4 text-sm text-slate-600">Cargando gastos...</p> : null}
        <div className="mt-4 w-full max-w-full overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-4 font-medium">Fecha</th>
                <th className="py-2 pr-4 font-medium">Tarjeta</th>
                <th className="py-2 pr-4 font-medium">Categoria</th>
                <th className="py-2 pr-4 font-medium">Descripcion</th>
                <th className="py-2 text-right font-medium">Monto</th>
                <th className="py-2 pl-4 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((expense) => (
                <tr className="border-b border-slate-100" key={expense.id}>
                  <td className="py-3 pr-4 text-slate-700">
                    {new Date(`${expense.expense_date}T00:00:00`).toLocaleDateString("es-MX")}
                  </td>
                  <td className="py-3 pr-4 text-slate-700">{getCardName(expense.credit_card_id)}</td>
                  <td className="py-3 pr-4 text-slate-700">{getCategoryName(expense.category_id)}</td>
                  <td className="py-3 pr-4 text-slate-700">{expense.description || "Sin descripcion"}</td>
                  <td className="py-3 text-right font-semibold text-slate-950">
                    {formatCurrency(Number(expense.amount), getCardCurrency(expense.credit_card_id))}
                  </td>
                  <td className="py-3 pl-4">
                    <div className="flex justify-end gap-2">
                      <button
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
                        onClick={() => startEdit(expense)}
                        type="button"
                      >
                        Editar
                      </button>
                      <button
                        className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700"
                        onClick={() => deleteExpense(expense)}
                        type="button"
                      >
                        Borrar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!isLoading && filteredExpenses.length === 0 ? (
          <p className="mt-4 rounded-md bg-slate-50 p-4 text-sm text-slate-600">
            No hay gastos para el periodo seleccionado. Registra un gasto para verlo aquí.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function validateExpenseForm(form: typeof emptyForm) {
  if (!form.credit_card_id) return "Selecciona una tarjeta.";
  if (!form.expense_date) return "Selecciona la fecha del gasto.";
  if (Number(form.amount) <= 0) return "El monto debe ser mayor a 0.";
  if (!form.category_id) return "Selecciona una categoria.";
  if (form.is_installment_purchase && Number(form.installment_months) <= 0) {
    return "Indica el numero de meses de la compra.";
  }
  return "";
}

function getFriendlyExpenseError(error: string) {
  if (error.includes("credit_card_id")) return "Selecciona una tarjeta valida.";
  if (error.includes("category_id")) return "Selecciona una categoria valida.";
  return `No se pudo registrar el gasto. Detalle: ${error}`;
}

function StatusMessage({ message }: { message: Message }) {
  const styles = {
    success: "border-green-200 bg-green-50 text-green-800",
    error: "border-red-200 bg-red-50 text-red-800",
    info: "border-slate-200 bg-slate-50 text-slate-700",
  };

  return <p className={`mt-4 rounded-md border px-3 py-2 text-sm ${styles[message.type]}`}>{message.text}</p>;
}
