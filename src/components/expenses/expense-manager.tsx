"use client";

import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { PeriodFilterControls } from "@/components/period-filter-controls";
import { MoneyAmount } from "@/components/ui/money-amount";
import { formatDateForPreference } from "@/lib/date-format";
import {
  getDefaultPeriodFilter,
  getPeriodLabel,
  type PeriodFilterState,
} from "@/lib/period-filters";
import { formatCurrency } from "@/lib/currencies";
import { DEFAULT_EXPENSE_CATEGORY_NAMES, dedupeCategories } from "@/lib/categories";
import { getExpenseCurrency, getExpenseSourceInfo, isExpenseInSelectedPeriod } from "@/lib/expense-sources";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserPreferences } from "@/lib/use-user-preferences";
import type { Account, Category, CreditCard, Expense } from "@/types/finance";

const emptyForm = {
  payment_source: "card" as "card" | "account",
  credit_card_id: "",
  account_id: "",
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

type ExpenseSourceFilter = "all" | "card" | "account";

export function ExpenseManager() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { dateFormat } = useUserPreferences();
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterState>(getDefaultPeriodFilter);
  const [sourceFilter, setSourceFilter] = useState<ExpenseSourceFilter>("all");
  const [cardFilterId, setCardFilterId] = useState("");
  const [accountFilterId, setAccountFilterId] = useState("");
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
      { data: accountData, error: accountError },
      { data: expenseData, error: expenseError },
    ] = await Promise.all([
      supabase
        .from("credit_cards")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("name"),
      supabase
        .from("accounts")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("name"),
      supabase
        .from("expenses")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("expense_date", { ascending: false }),
    ]);

    if (cardError || accountError || expenseError) {
      setMessage({
        type: "error",
        text: cardError?.message ?? accountError?.message ?? expenseError?.message ?? "No se pudieron cargar tus gastos.",
      });
      setIsLoading(false);
      return;
    }

    setCards((cardData ?? []) as CreditCard[]);
    setAccounts((accountData ?? []) as Account[]);
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

    const isAccountExpense = form.payment_source === "account";
    const payload = {
      user_id: userData.user.id,
      credit_card_id: isAccountExpense ? null : form.credit_card_id,
      account_id: isAccountExpense ? form.account_id : null,
      category_id: form.category_id,
      expense_date: form.expense_date,
      amount: Number(form.amount),
      description: form.description.trim(),
      expense_type: form.expense_type,
      is_installment_purchase: isAccountExpense ? false : form.is_installment_purchase,
      installment_months: !isAccountExpense && form.is_installment_purchase ? Number(form.installment_months) : null,
    };

    const { data: savedExpense, error } = editingExpenseId
      ? await supabase
          .from("expenses")
          .update(payload)
          .eq("id", editingExpenseId)
          .eq("user_id", userData.user.id)
          .select("*")
          .single()
      : await supabase.from("expenses").insert(payload).select("*").single();

    if (error || !savedExpense) {
      setMessage({ type: "error", text: getFriendlyExpenseError(error?.message ?? "No se pudo guardar el gasto.") });
      return;
    }

    const movementError = await syncAutomaticAccountMovement(savedExpense as Expense, userData.user.id);
    if (movementError) {
      if (!editingExpenseId) {
        await supabase.from("expenses").delete().eq("id", savedExpense.id).eq("user_id", userData.user.id);
      }
      setMessage({ type: "error", text: movementError });
      await loadData();
      return;
    }

    const nextCreditCardId =
      form.payment_source === "card" && cards.some((card) => card.id === form.credit_card_id && card.is_active)
        ? form.credit_card_id
        : "";
    const nextAccountId =
      form.payment_source === "account" && accounts.some((account) => account.id === form.account_id && account.is_active)
        ? form.account_id
        : "";

    setForm({
      ...emptyForm,
      payment_source: form.payment_source,
      credit_card_id: nextCreditCardId,
      account_id: nextAccountId,
      category_id: form.category_id,
    });
    setEditingExpenseId(null);
    setMessage({
      type: "success",
      text: editingExpenseId
        ? "Gasto actualizado correctamente."
        : isAccountExpense
          ? "Gasto registrado correctamente y descontado de la cuenta."
          : "Gasto registrado correctamente.",
    });
    await loadData();
  }

  function startEdit(expense: Expense) {
    setEditingExpenseId(expense.id);
    setForm({
      payment_source: expense.account_id ? "account" : "card",
      credit_card_id: expense.credit_card_id ?? "",
      account_id: expense.account_id ?? "",
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

  async function syncAutomaticAccountMovement(expense: Expense, userId: string) {
    if (!supabase) return "Falta configurar Supabase.";

    if (!expense.account_id) {
      const { error } = await supabase
        .from("account_movements")
        .delete()
        .eq("expense_id", expense.id)
        .eq("user_id", userId);

      return error ? getFriendlyExpenseError(error.message) : "";
    }

    const movementPayload = {
      user_id: userId,
      account_id: expense.account_id,
      expense_id: expense.id,
      movement_date: expense.expense_date,
      movement_type: "expense",
      amount: Number(expense.amount),
      description: `Gasto: ${expense.description || getCategoryName(expense.category_id)}`,
    };

    const { data: existingMovement, error: findError } = await supabase
      .from("account_movements")
      .select("id")
      .eq("expense_id", expense.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (findError) return getFriendlyExpenseError(findError.message);

    const { error } = existingMovement
      ? await supabase
          .from("account_movements")
          .update(movementPayload)
          .eq("id", existingMovement.id)
          .eq("user_id", userId)
      : await supabase.from("account_movements").insert(movementPayload);

    return error ? getFriendlyExpenseError(error.message) : "";
  }

  async function deleteExpense(expense: Expense) {
    if (!supabase) {
      setMessage({ type: "error", text: "Falta configurar Supabase antes de borrar gastos." });
      return;
    }

    const confirmed = window.confirm(
      `Vas a borrar este gasto:\n\n${expense.description || "Sin descripcion"} - ${formatCurrency(Number(expense.amount), getExpenseCurrency(expense, cards, accounts))}\n\nSi el gasto salio de una cuenta, su movimiento automatico tambien se borrara.\n\nEsta accion no se puede deshacer. ¿Seguro que quieres continuar?`
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

    const { error: movementError } = await supabase
      .from("account_movements")
      .delete()
      .eq("expense_id", expense.id)
      .eq("user_id", userData.user.id);

    if (movementError) {
      setMessage({ type: "error", text: getFriendlyExpenseError(movementError.message) });
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

    setMessage({ type: "success", text: "Gasto borrado correctamente." });
    await loadData();
  }

  function getCategoryName(categoryId: string | null) {
    return categories.find((category) => category.id === categoryId)?.name ?? "Sin categoria";
  }

  function changeSourceFilter(nextFilter: ExpenseSourceFilter) {
    setSourceFilter(nextFilter);
    if (nextFilter !== "card") setCardFilterId("");
    if (nextFilter !== "account") setAccountFilterId("");
  }

  const activeCards = cards.filter((card) => card.is_active);
  const activeAccounts = accounts.filter((account) => account.is_active);
  const selectableCards = buildSelectableSources(cards, activeCards, form.credit_card_id, editingExpenseId);
  const selectableAccounts = buildSelectableSources(accounts, activeAccounts, form.account_id, editingExpenseId);

  const filteredExpenses = expenses.filter((expense) =>
    isExpenseInSelectedPeriod({ expense, cards, filter: periodFilter }) &&
    isExpenseMatchingSourceFilter({
      expense,
      sourceFilter,
      cardFilterId,
      accountFilterId,
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
            <span className="text-sm font-medium text-slate-700">Metodo de pago</span>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) =>
                setForm({
                  ...form,
                  payment_source: event.target.value as "card" | "account",
                  credit_card_id: event.target.value === "card" ? form.credit_card_id : "",
                  account_id: event.target.value === "account" ? form.account_id : "",
                  is_installment_purchase: event.target.value === "card" ? form.is_installment_purchase : false,
                  installment_months: event.target.value === "card" ? form.installment_months : "",
                })
              }
              value={form.payment_source}
            >
              <option value="card">Tarjeta</option>
              <option value="account">Cuenta / efectivo</option>
            </select>
          </label>

          {form.payment_source === "card" ? (
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Tarjeta</span>
              <select
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                onChange={(event) => setForm({ ...form, credit_card_id: event.target.value })}
                required
                value={form.credit_card_id}
              >
                <option value="">Selecciona una tarjeta</option>
                {selectableCards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.name} - {card.bank}{card.is_active ? "" : " (inactiva)"}
                  </option>
                ))}
              </select>
              {!isLoading && activeCards.length === 0 ? (
                <span className="mt-2 block rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  No tienes tarjetas activas para registrar este movimiento.
                </span>
              ) : null}
            </label>
          ) : (
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Cuenta / efectivo</span>
              <select
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                onChange={(event) => setForm({ ...form, account_id: event.target.value })}
                required
                value={form.account_id}
              >
                <option value="">Selecciona una cuenta</option>
                {selectableAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} - {account.currency}{account.is_active ? "" : " (inactiva)"}
                  </option>
                ))}
              </select>
              <span className="mt-2 block text-xs text-slate-500">
                El gasto creara un movimiento de egreso y reducira el saldo de la cuenta.
              </span>
              {!isLoading && activeAccounts.length === 0 ? (
                <span className="mt-2 block rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  No tienes cuentas activas para registrar este movimiento.
                </span>
              ) : null}
            </label>
          )}

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

          {form.payment_source === "card" ? (
            <>
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
            </>
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
          <ExpenseSourceFilters
            accountFilterId={accountFilterId}
            accounts={accounts}
            cardFilterId={cardFilterId}
            cards={cards}
            onAccountChange={setAccountFilterId}
            onCardChange={setCardFilterId}
            onSourceChange={changeSourceFilter}
            sourceFilter={sourceFilter}
          />
        </div>
        {isLoading ? <p className="mt-4 text-sm text-slate-600">Cargando gastos...</p> : null}
        <div className="mt-4 w-full max-w-full overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-4 font-medium">Fecha</th>
                <th className="py-2 pr-4 font-medium">Origen</th>
                <th className="py-2 pr-4 font-medium">Categoria</th>
                <th className="py-2 pr-4 font-medium">Descripcion</th>
                <th className="py-2 text-right font-medium">Monto</th>
                <th className="py-2 pl-4 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((expense) => {
                const source = getExpenseSourceInfo(expense, cards, accounts);

                return (
                  <tr className="border-b border-slate-100" key={expense.id}>
                    <td className="py-3 pr-4 text-slate-700">
                      {formatDateForPreference(expense.expense_date, dateFormat)}
                    </td>
                    <td className="py-3 pr-4 text-slate-700">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{source.label}</span>
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
                            {source.badgeLabel}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">{source.detail}</p>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-slate-700">{getCategoryName(expense.category_id)}</td>
                    <td className="py-3 pr-4 text-slate-700">{expense.description || "Sin descripcion"}</td>
                    <td className="py-3 text-right font-semibold text-slate-950">
                      <MoneyAmount amount={Number(expense.amount)} currency={source.currency} />
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
                );
              })}
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

function ExpenseSourceFilters({
  accountFilterId,
  accounts,
  cardFilterId,
  cards,
  onAccountChange,
  onCardChange,
  onSourceChange,
  sourceFilter,
}: {
  accountFilterId: string;
  accounts: Account[];
  cardFilterId: string;
  cards: CreditCard[];
  onAccountChange: (accountId: string) => void;
  onCardChange: (cardId: string) => void;
  onSourceChange: (source: ExpenseSourceFilter) => void;
  sourceFilter: ExpenseSourceFilter;
}) {
  return (
    <div className="max-w-full rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-700">Origen del gasto</p>
          <p className="mt-1 text-xs text-slate-500">
            Filtra por tarjeta o por cuenta/efectivo sin cambiar tus registros.
          </p>
          <div className="mt-3 flex min-w-0 flex-wrap gap-2">
            <SourceFilterButton active={sourceFilter === "all"} onClick={() => onSourceChange("all")}>
              Todos
            </SourceFilterButton>
            <SourceFilterButton active={sourceFilter === "card"} onClick={() => onSourceChange("card")}>
              Tarjeta
            </SourceFilterButton>
            <SourceFilterButton active={sourceFilter === "account"} onClick={() => onSourceChange("account")}>
              Cuenta / efectivo
            </SourceFilterButton>
          </div>
        </div>

        {sourceFilter === "card" ? (
          <label className="block min-w-0 lg:w-72">
            <span className="text-sm font-medium text-slate-700">Tarjeta</span>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              onChange={(event) => onCardChange(event.target.value)}
              value={cardFilterId}
            >
              <option value="">Todas las tarjetas</option>
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.name} - {card.bank}{card.is_active ? "" : " (inactiva)"}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {sourceFilter === "account" ? (
          <label className="block min-w-0 lg:w-72">
            <span className="text-sm font-medium text-slate-700">Cuenta / efectivo</span>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              onChange={(event) => onAccountChange(event.target.value)}
              value={accountFilterId}
            >
              <option value="">Todas las cuentas</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} - {account.currency}{account.is_active ? "" : " (inactiva)"}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    </div>
  );
}

function SourceFilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={`max-w-full rounded-md border px-3 py-2 text-sm ${
        active
          ? "border-teal-600 bg-white text-teal-700 shadow-sm"
          : "border-slate-200 bg-white/70 text-slate-700 hover:border-teal-500"
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function isExpenseMatchingSourceFilter({
  accountFilterId,
  cardFilterId,
  expense,
  sourceFilter,
}: {
  accountFilterId: string;
  cardFilterId: string;
  expense: Expense;
  sourceFilter: ExpenseSourceFilter;
}) {
  if (sourceFilter === "card") {
    return Boolean(expense.credit_card_id) && (!cardFilterId || expense.credit_card_id === cardFilterId);
  }

  if (sourceFilter === "account") {
    return Boolean(expense.account_id) && (!accountFilterId || expense.account_id === accountFilterId);
  }

  return true;
}

function buildSelectableSources<T extends { id: string; is_active: boolean }>(
  allSources: T[],
  activeSources: T[],
  selectedId: string,
  editingId: string | null
) {
  if (!editingId || !selectedId || activeSources.some((source) => source.id === selectedId)) {
    return activeSources;
  }

  const selectedSource = allSources.find((source) => source.id === selectedId);
  return selectedSource ? [selectedSource, ...activeSources] : activeSources;
}

function validateExpenseForm(form: typeof emptyForm) {
  if (form.payment_source === "card" && !form.credit_card_id) return "Selecciona una tarjeta.";
  if (form.payment_source === "account" && !form.account_id) return "Selecciona una cuenta o billetera de efectivo.";
  if (!form.expense_date) return "Selecciona la fecha del gasto.";
  if (Number(form.amount) <= 0) return "El monto debe ser mayor a 0.";
  if (!form.category_id) return "Selecciona una categoria.";
  if (form.payment_source === "card" && form.is_installment_purchase && Number(form.installment_months) <= 0) {
    return "Indica el numero de meses de la compra.";
  }
  return "";
}

function getFriendlyExpenseError(error: string) {
  if (error.includes("credit_card_id")) return "Selecciona una tarjeta valida.";
  if (error.includes("account_id")) return "Selecciona una cuenta valida.";
  if (error.includes("category_id")) return "Selecciona una categoria valida.";
  if (error.includes("expense_id")) return "Falta actualizar Supabase para vincular gastos con movimientos de cuenta.";
  if (error.includes("expenses_single_payment_source_check")) {
    return "El gasto debe tener una sola fuente de pago: tarjeta o cuenta/efectivo.";
  }
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
