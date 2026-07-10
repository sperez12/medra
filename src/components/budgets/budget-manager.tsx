"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { dedupeCategories, findCategoryName, isSameCategoryName, normalizeCategoryName } from "@/lib/categories";
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES, formatCurrency, groupMoneyByCurrency, isSupportedCurrency, normalizeCurrency } from "@/lib/currencies";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Budget, Category, CreditCard, Expense } from "@/types/finance";

const emptyForm = {
  name: "",
  category_id: "",
  amount: "0",
  currency: DEFAULT_CURRENCY,
  month: new Date().toISOString().slice(0, 7),
  description: "",
  is_active: true,
};

type Message = {
  type: "success" | "error" | "info";
  text: string;
};

type BudgetSummary = {
  budget: Budget;
  categoryName: string;
  spent: number;
  remaining: number;
  usedPercent: number;
  status: "normal" | "warning" | "danger" | "exceeded";
};

export function BudgetManager() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    if (!supabase) {
      setMessage({ type: "error", text: "Falta configurar Supabase para usar presupuestos." });
      setIsLoading(false);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage({ type: "info", text: "Inicia sesion para ver tus presupuestos." });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const [
      { data: budgetData, error: budgetError },
      { data: categoryData, error: categoryError },
      { data: cardData, error: cardError },
      { data: expenseData, error: expenseError },
    ] = await Promise.all([
      supabase.from("budgets").select("*").eq("user_id", userData.user.id).order("month", { ascending: false }),
      supabase.from("categories").select("*").eq("user_id", userData.user.id).eq("type", "expense").order("name"),
      supabase.from("credit_cards").select("*").eq("user_id", userData.user.id),
      supabase.from("expenses").select("*").eq("user_id", userData.user.id).order("expense_date", { ascending: false }),
    ]);

    if (budgetError || categoryError || cardError || expenseError) {
      setMessage({
        type: "error",
        text: getFriendlyBudgetError(budgetError?.message ?? categoryError?.message ?? cardError?.message ?? expenseError?.message ?? "No se pudieron cargar los presupuestos."),
      });
      setIsLoading(false);
      return;
    }

    setBudgets((budgetData ?? []) as Budget[]);
    setAllCategories((categoryData ?? []) as Category[]);
    setCategories(dedupeCategories((categoryData ?? []) as Category[]));
    setCards((cardData ?? []) as CreditCard[]);
    setExpenses((expenseData ?? []) as Expense[]);
    setIsLoading(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!supabase) {
      setMessage({ type: "error", text: "Falta configurar Supabase antes de guardar presupuestos." });
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage({ type: "error", text: "Primero inicia sesion para guardar presupuestos." });
      return;
    }

    const validationError = validateBudgetForm(form);
    if (validationError) {
      setMessage({ type: "error", text: validationError });
      return;
    }

    const payload = {
      user_id: userData.user.id,
      name: form.name.trim(),
      category_id: form.category_id,
      amount: Number(form.amount),
      currency: normalizeCurrency(form.currency),
      month: `${form.month}-01`,
      period: "monthly",
      description: form.description.trim() || null,
      is_active: form.is_active,
    };

    const request = editingBudgetId
      ? supabase.from("budgets").update(payload).eq("id", editingBudgetId).eq("user_id", userData.user.id)
      : supabase.from("budgets").insert(payload);

    const { error } = await request;
    if (error) {
      setMessage({ type: "error", text: getFriendlyBudgetError(error.message) });
      return;
    }

    setForm(emptyForm);
    setEditingBudgetId(null);
    setMessage({
      type: "success",
      text: editingBudgetId ? "Presupuesto actualizado correctamente." : "Presupuesto creado correctamente.",
    });
    await loadData();
  }

  function startEditBudget(budget: Budget) {
    setEditingBudgetId(budget.id);
    setForm({
      name: budget.name,
      category_id: budget.category_id,
      amount: String(budget.amount),
      currency: normalizeCurrency(budget.currency),
      month: budget.month.slice(0, 7),
      description: budget.description ?? "",
      is_active: budget.is_active,
    });
    setMessage({ type: "info", text: "Editando presupuesto. Cuando termines, presiona Guardar cambios." });
  }

  function cancelEditBudget() {
    setEditingBudgetId(null);
    setForm(emptyForm);
    setMessage({ type: "info", text: "Edicion cancelada." });
  }

  async function deleteBudget(budget: Budget) {
    if (!supabase) {
      setMessage({ type: "error", text: "Falta configurar Supabase antes de borrar presupuestos." });
      return;
    }

    const confirmed = window.confirm(
      `Vas a borrar el presupuesto "${budget.name}".\n\nEsta accion no se puede deshacer. ¿Seguro que quieres continuar?`
    );
    if (!confirmed) {
      setMessage({ type: "info", text: "No se borro el presupuesto." });
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage({ type: "error", text: "Primero inicia sesion para borrar presupuestos." });
      return;
    }

    const { error } = await supabase.from("budgets").delete().eq("id", budget.id).eq("user_id", userData.user.id);
    if (error) {
      setMessage({ type: "error", text: getFriendlyBudgetError(error.message) });
      return;
    }

    if (editingBudgetId === budget.id) {
      setEditingBudgetId(null);
      setForm(emptyForm);
    }

    setMessage({ type: "success", text: "Presupuesto borrado correctamente." });
    await loadData();
  }

  const budgetSummaries = budgets.map((budget) => buildBudgetSummary(budget, allCategories, cards, expenses));
  const activeBudgetSummaries = budgetSummaries.filter(({ budget }) => budget.is_active);
  const exceededBudgets = activeBudgetSummaries.filter((summary) => summary.status === "exceeded");
  const nearLimitBudgets = activeBudgetSummaries.filter((summary) => summary.status === "warning" || summary.status === "danger");
  const totalBudgetedByCurrency = groupMoneyByCurrency(activeBudgetSummaries, (summary) => Number(summary.budget.amount), (summary) => summary.budget.currency);
  const totalSpentByCurrency = groupMoneyByCurrency(activeBudgetSummaries, (summary) => summary.spent, (summary) => summary.budget.currency);
  const remainingByCurrency = buildRemainingTotals(totalBudgetedByCurrency, totalSpentByCurrency);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Total presupuestado" value={<MoneyTotals totals={totalBudgetedByCurrency} />} />
        <SummaryCard label="Total gastado" value={<MoneyTotals totals={totalSpentByCurrency} />} />
        <SummaryCard label="Restante" value={<MoneyTotals totals={remainingByCurrency} />} />
        <SummaryCard label="Excedidos" value={String(exceededBudgets.length)} />
        <SummaryCard label="Cerca del limite" value={String(nearLimitBudgets.length)} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <BudgetForm
          categories={categories}
          editingBudgetId={editingBudgetId}
          form={form}
          onCancel={cancelEditBudget}
          onChange={setForm}
          onSubmit={handleSubmit}
        />

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Presupuestos registrados</h2>
          {isLoading ? <p className="mt-4 text-sm text-slate-600">Cargando presupuestos...</p> : null}
          <div className="mt-4 grid gap-4">
            {budgetSummaries.map((summary) => (
              <BudgetCard key={summary.budget.id} onDelete={deleteBudget} onEdit={startEditBudget} summary={summary} />
            ))}
          </div>
          {!isLoading && budgetSummaries.length === 0 ? (
            <EmptyMessage text="Todavia no hay presupuestos. Crea uno para comparar tu plan mensual contra tus gastos reales." />
          ) : null}
        </div>
      </section>

      {message ? <StatusMessage message={message} /> : null}
    </div>
  );
}

function BudgetForm({
  categories,
  editingBudgetId,
  form,
  onCancel,
  onChange,
  onSubmit,
}: {
  categories: Category[];
  editingBudgetId: string | null;
  form: typeof emptyForm;
  onCancel: () => void;
  onChange: (form: typeof emptyForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm" onSubmit={onSubmit}>
      <h2 className="text-lg font-semibold text-slate-950">{editingBudgetId ? "Editar presupuesto" : "Nuevo presupuesto"}</h2>
      <div className="mt-4 grid gap-4">
        <TextInput label="Nombre del presupuesto" value={form.name} onChange={(value) => onChange({ ...form, name: value })} />
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Categoria</span>
          <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" onChange={(event) => onChange({ ...form, category_id: event.target.value })} required value={form.category_id}>
            <option value="">Selecciona una categoria</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
        <TextInput label="Monto limite" min="0.01" step="0.01" type="number" value={form.amount} onChange={(value) => onChange({ ...form, amount: value })} />
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Moneda</span>
          <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" onChange={(event) => onChange({ ...form, currency: event.target.value })} value={form.currency}>
            {SUPPORTED_CURRENCIES.map((currency) => (
              <option key={currency.code} value={currency.code}>{currency.label}</option>
            ))}
          </select>
        </label>
        <TextInput label="Mes y año" type="month" value={form.month} onChange={(value) => onChange({ ...form, month: value })} />
        <TextInput label="Descripcion opcional" value={form.description} onChange={(value) => onChange({ ...form, description: value })} required={false} />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input checked={form.is_active} onChange={(event) => onChange({ ...form, is_active: event.target.checked })} type="checkbox" />
          Activo
        </label>
      </div>
      <button className="mt-5 w-full rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700" type="submit">
        {editingBudgetId ? "Guardar cambios" : "Crear presupuesto"}
      </button>
      {editingBudgetId ? (
        <button className="mt-2 w-full rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700" onClick={onCancel} type="button">
          Cancelar edicion
        </button>
      ) : null}
      {categories.length === 0 ? (
        <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          Aun no hay categorias. Entra primero a Gastos para crear las categorias iniciales.
        </p>
      ) : null}
    </form>
  );
}

function BudgetCard({ summary, onEdit, onDelete }: { summary: BudgetSummary; onEdit: (budget: Budget) => void; onDelete: (budget: Budget) => void }) {
  const { budget, categoryName, spent, remaining, usedPercent, status } = summary;
  const statusData = getBudgetStatusData(status);

  return (
    <article className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="font-semibold text-slate-950">{budget.name}</h3>
          <p className="text-sm text-slate-500">{categoryName} - {formatBudgetMonth(budget.month)}</p>
          {budget.description ? <p className="mt-2 text-sm text-slate-600">{budget.description}</p> : null}
        </div>
        <span className={`w-fit rounded-full border px-3 py-1 text-xs font-medium ${budget.is_active ? "border-teal-200 bg-teal-50 text-teal-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
          {budget.is_active ? "Activo" : "Inactivo"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <Metric label="Limite" value={formatCurrency(Number(budget.amount), budget.currency)} />
        <Metric label="Gasto real" value={formatCurrency(spent, budget.currency)} />
        <Metric label="Restante" value={formatCurrency(remaining, budget.currency)} />
        <Metric label="Usado" value={`${usedPercent.toFixed(1)}%`} />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-sm">
          <span className={statusData.textClass}>{statusData.label}</span>
          <span className="font-medium text-slate-700">{usedPercent.toFixed(1)}%</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-slate-100">
          <div className={`h-2 rounded-full ${statusData.barClass}`} style={{ width: `${Math.min(usedPercent, 100)}%` }} />
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={() => onEdit(budget)} type="button">
          Editar
        </button>
        <button className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700" onClick={() => onDelete(budget)} type="button">
          Borrar
        </button>
      </div>
    </article>
  );
}

function buildBudgetSummary(budget: Budget, categories: Category[], cards: CreditCard[], expenses: Expense[]): BudgetSummary {
  const start = new Date(`${budget.month.slice(0, 7)}-01T00:00:00`);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  const currency = normalizeCurrency(budget.currency);
  const budgetCategoryName = normalizeCategoryName(findCategoryName(categories, budget.category_id));
  const spent = expenses
    .filter((expense) => {
      const expenseDate = new Date(`${expense.expense_date}T00:00:00`);
      const card = cards.find((item) => item.id === expense.credit_card_id);
      return (
        (expense.category_id === budget.category_id ||
          isSameCategoryName(categories, expense.category_id, budget.category_id) ||
          Boolean(budgetCategoryName && normalizeCategoryName(findCategoryName(categories, expense.category_id)) === budgetCategoryName)) &&
        normalizeCurrency(card?.currency) === currency &&
        expenseDate >= start &&
        expenseDate < end
      );
    })
    .reduce((total, expense) => total + Number(expense.amount), 0);
  const limit = Number(budget.amount);
  const usedPercent = limit > 0 ? (spent / limit) * 100 : 0;

  return {
    budget,
    categoryName: findCategoryName(categories, budget.category_id) || "Categoria no encontrada",
    spent,
    remaining: limit - spent,
    usedPercent,
    status: getBudgetStatus(usedPercent),
  };
}

function getBudgetStatus(percent: number): BudgetSummary["status"] {
  if (percent > 100) return "exceeded";
  if (percent > 90) return "danger";
  if (percent >= 70) return "warning";
  return "normal";
}

function getBudgetStatusData(status: BudgetSummary["status"]) {
  const data = {
    normal: { label: "Normal", textClass: "text-teal-700", barClass: "bg-teal-600" },
    warning: { label: "Advertencia", textClass: "text-amber-700", barClass: "bg-amber-500" },
    danger: { label: "Alerta", textClass: "text-red-700", barClass: "bg-red-500" },
    exceeded: { label: "Excedido", textClass: "text-red-800", barClass: "bg-red-700" },
  };

  return data[status];
}

function buildRemainingTotals(budgeted: Array<{ currency: string; amount: number }>, spent: Array<{ currency: string; amount: number }>) {
  const currencies = Array.from(new Set([...budgeted, ...spent].map((item) => normalizeCurrency(item.currency)))).sort();

  return currencies.map((currency) => ({
    currency,
    amount: (budgeted.find((item) => item.currency === currency)?.amount ?? 0) - (spent.find((item) => item.currency === currency)?.amount ?? 0),
  }));
}

function validateBudgetForm(form: typeof emptyForm) {
  if (!form.name.trim()) return "Escribe el nombre del presupuesto.";
  if (!form.category_id) return "Selecciona una categoria.";
  if (Number(form.amount) <= 0) return "El monto limite debe ser mayor a 0.";
  if (!isSupportedCurrency(form.currency)) return "Selecciona una moneda valida.";
  if (!form.month) return "Selecciona mes y año.";
  return "";
}

function getFriendlyBudgetError(error: string) {
  if (error.includes("name") || error.includes("period") || error.includes("description") || error.includes("is_active") || error.includes("schema cache")) {
    return "Falta actualizar Supabase para presupuestos. Ejecuta el SQL docs/ADD_BUDGETS.sql.";
  }

  if (error.includes("budgets_user_category_month_currency_idx") || error.includes("duplicate")) {
    return "Ya existe un presupuesto para esa categoria, mes y moneda.";
  }

  return `No se pudo completar la accion. Detalle: ${error}`;
}

function formatBudgetMonth(month: string) {
  return new Date(`${month.slice(0, 7)}-01T00:00:00`).toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric",
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

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  min,
  step,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  min?: string;
  step?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" min={min} onChange={(event) => onChange(event.target.value)} required={required} step={step} type={type} value={value} />
    </label>
  );
}

function SummaryCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function EmptyMessage({ text }: { text: string }) {
  return <p className="mt-4 rounded-md bg-slate-50 p-4 text-sm text-slate-600">{text}</p>;
}

function StatusMessage({ message }: { message: Message }) {
  const styles = {
    success: "border-green-200 bg-green-50 text-green-800",
    error: "border-red-200 bg-red-50 text-red-800",
    info: "border-slate-200 bg-slate-50 text-slate-700",
  };

  return <p className={`rounded-md border px-3 py-2 text-sm ${styles[message.type]}`}>{message.text}</p>;
}
