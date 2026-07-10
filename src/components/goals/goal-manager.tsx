"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES, formatCurrency, groupMoneyByCurrency, isSupportedCurrency, normalizeCurrency } from "@/lib/currencies";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Account, Goal, GoalContribution, GoalType } from "@/types/finance";

const goalTypeLabels: Record<GoalType, string> = {
  savings: "Ahorro",
  debt_payment: "Pago de deuda",
  emergency_fund: "Fondo de emergencia",
  travel: "Viaje",
  large_purchase: "Compra grande",
  other: "Otro",
};

const emptyGoalForm = {
  name: "",
  goal_type: "savings" as GoalType,
  target_amount: "0",
  currency: DEFAULT_CURRENCY,
  current_amount: "0",
  account_id: "",
  target_date: "",
  description: "",
  is_active: true,
};

const emptyContributionForm = {
  goal_id: "",
  contribution_date: new Date().toISOString().slice(0, 10),
  amount: "0",
  description: "",
  account_id: "",
};

type Message = {
  type: "success" | "error" | "info";
  text: string;
};

type GoalSummary = {
  goal: Goal;
  currentAmount: number;
  remaining: number;
  progressPercent: number;
  isCompleted: boolean;
};

export function GoalManager() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [contributions, setContributions] = useState<GoalContribution[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [goalForm, setGoalForm] = useState(emptyGoalForm);
  const [contributionForm, setContributionForm] = useState(emptyContributionForm);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editingContributionId, setEditingContributionId] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    if (!supabase) {
      setMessage({ type: "error", text: "Falta configurar Supabase para usar metas." });
      setIsLoading(false);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage({ type: "info", text: "Inicia sesion para ver tus metas." });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const [
      { data: goalData, error: goalError },
      { data: contributionData, error: contributionError },
      { data: accountData, error: accountError },
    ] = await Promise.all([
      supabase.from("goals").select("*").eq("user_id", userData.user.id).order("created_at", { ascending: false }),
      supabase.from("goal_contributions").select("*").eq("user_id", userData.user.id).order("contribution_date", { ascending: false }),
      supabase.from("accounts").select("*").eq("user_id", userData.user.id).eq("is_active", true).order("name"),
    ]);

    if (goalError || contributionError || accountError) {
      setMessage({
        type: "error",
        text: getFriendlyGoalError(goalError?.message ?? contributionError?.message ?? accountError?.message ?? "No se pudieron cargar las metas."),
      });
      setIsLoading(false);
      return;
    }

    setGoals((goalData ?? []) as Goal[]);
    setContributions((contributionData ?? []) as GoalContribution[]);
    setAccounts((accountData ?? []) as Account[]);
    setIsLoading(false);
  }

  async function handleGoalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!supabase) {
      setMessage({ type: "error", text: "Falta configurar Supabase antes de guardar metas." });
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage({ type: "error", text: "Primero inicia sesion para guardar metas." });
      return;
    }

    const validationError = validateGoalForm(goalForm);
    if (validationError) {
      setMessage({ type: "error", text: validationError });
      return;
    }

    const payload = {
      user_id: userData.user.id,
      name: goalForm.name.trim(),
      goal_type: goalForm.goal_type,
      target_amount: Number(goalForm.target_amount),
      current_amount: Number(goalForm.current_amount),
      currency: normalizeCurrency(goalForm.currency),
      account_id: goalForm.account_id || null,
      target_date: goalForm.target_date || null,
      description: goalForm.description.trim() || null,
      is_active: goalForm.is_active,
      status: goalForm.is_active ? "active" : "paused",
    };

    const request = editingGoalId
      ? supabase.from("goals").update(payload).eq("id", editingGoalId).eq("user_id", userData.user.id)
      : supabase.from("goals").insert(payload);

    const { error } = await request;
    if (error) {
      setMessage({ type: "error", text: getFriendlyGoalError(error.message) });
      return;
    }

    setGoalForm(emptyGoalForm);
    setEditingGoalId(null);
    setMessage({ type: "success", text: editingGoalId ? "Meta actualizada correctamente." : "Meta creada correctamente." });
    await loadData();
  }

  async function handleContributionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!supabase) {
      setMessage({ type: "error", text: "Falta configurar Supabase antes de guardar aportaciones." });
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage({ type: "error", text: "Primero inicia sesion para guardar aportaciones." });
      return;
    }

    const validationError = validateContributionForm(contributionForm, goals, accounts);
    if (validationError) {
      setMessage({ type: "error", text: validationError });
      return;
    }

    const payload = {
      user_id: userData.user.id,
      goal_id: contributionForm.goal_id,
      account_id: contributionForm.account_id || null,
      contribution_date: contributionForm.contribution_date,
      amount: Number(contributionForm.amount),
      description: contributionForm.description.trim() || null,
    };

    const { data: savedContribution, error } = editingContributionId
      ? await supabase
          .from("goal_contributions")
          .update(payload)
          .eq("id", editingContributionId)
          .eq("user_id", userData.user.id)
          .select("*")
          .single()
      : await supabase.from("goal_contributions").insert(payload).select("*").single();

    if (error || !savedContribution) {
      setMessage({ type: "error", text: getFriendlyGoalError(error?.message ?? "No se pudo guardar la aportacion.") });
      return;
    }

    const movementError = await syncContributionMovement(savedContribution as GoalContribution, userData.user.id);
    if (movementError) {
      if (!editingContributionId) {
        await supabase.from("goal_contributions").delete().eq("id", savedContribution.id).eq("user_id", userData.user.id);
      }
      setMessage({ type: "error", text: movementError });
      return;
    }

    setContributionForm({ ...emptyContributionForm, goal_id: contributionForm.goal_id });
    setEditingContributionId(null);
    setMessage({
      type: "success",
      text: editingContributionId ? "Aportacion actualizada correctamente." : "Aportacion registrada correctamente.",
    });
    await loadData();
  }

  async function syncContributionMovement(contribution: GoalContribution, userId: string) {
    if (!supabase) return "Falta configurar Supabase.";

    if (!contribution.account_id) {
      const { error } = await supabase
        .from("account_movements")
        .delete()
        .eq("goal_contribution_id", contribution.id)
        .eq("user_id", userId);

      return error ? getFriendlyGoalError(error.message) : "";
    }

    const goal = goals.find((item) => item.id === contribution.goal_id);
    const payload = {
      user_id: userId,
      account_id: contribution.account_id,
      goal_contribution_id: contribution.id,
      movement_date: contribution.contribution_date,
      movement_type: "expense",
      amount: Number(contribution.amount),
      description: `Aportacion a meta ${goal?.name ?? "sin nombre"}`,
    };

    const { data: existingMovement, error: findError } = await supabase
      .from("account_movements")
      .select("id")
      .eq("goal_contribution_id", contribution.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (findError) return getFriendlyGoalError(findError.message);

    const { error } = existingMovement
      ? await supabase.from("account_movements").update(payload).eq("id", existingMovement.id).eq("user_id", userId)
      : await supabase.from("account_movements").insert(payload);

    return error ? getFriendlyGoalError(error.message) : "";
  }

  function startEditGoal(goal: Goal) {
    setEditingGoalId(goal.id);
    setGoalForm({
      name: goal.name,
      goal_type: goal.goal_type,
      target_amount: String(goal.target_amount),
      currency: normalizeCurrency(goal.currency),
      current_amount: String(goal.current_amount),
      account_id: goal.account_id ?? "",
      target_date: goal.target_date ?? "",
      description: goal.description ?? "",
      is_active: goal.is_active,
    });
    setMessage({ type: "info", text: "Editando meta. Cuando termines, presiona Guardar cambios." });
  }

  function cancelEditGoal() {
    setEditingGoalId(null);
    setGoalForm(emptyGoalForm);
    setMessage({ type: "info", text: "Edicion de meta cancelada." });
  }

  function startEditContribution(contribution: GoalContribution) {
    setEditingContributionId(contribution.id);
    setContributionForm({
      goal_id: contribution.goal_id,
      contribution_date: contribution.contribution_date,
      amount: String(contribution.amount),
      description: contribution.description ?? "",
      account_id: contribution.account_id ?? "",
    });
    setMessage({ type: "info", text: "Editando aportacion. Cuando termines, presiona Guardar cambios." });
  }

  function cancelEditContribution() {
    setEditingContributionId(null);
    setContributionForm(emptyContributionForm);
    setMessage({ type: "info", text: "Edicion de aportacion cancelada." });
  }

  async function deleteGoal(goal: Goal) {
    if (!supabase) return;

    const confirmed = window.confirm(`Vas a borrar la meta "${goal.name}". Tambien se borraran sus aportaciones.\n\n¿Seguro que quieres continuar?`);
    if (!confirmed) {
      setMessage({ type: "info", text: "No se borro la meta." });
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage({ type: "error", text: "Primero inicia sesion para borrar metas." });
      return;
    }

    const goalContributionIds = contributions.filter((item) => item.goal_id === goal.id).map((item) => item.id);
    if (goalContributionIds.length > 0) {
      const { error: movementError } = await supabase
        .from("account_movements")
        .delete()
        .in("goal_contribution_id", goalContributionIds)
        .eq("user_id", userData.user.id);

      if (movementError) {
        setMessage({ type: "error", text: getFriendlyGoalError(movementError.message) });
        return;
      }
    }

    const { error } = await supabase.from("goals").delete().eq("id", goal.id).eq("user_id", userData.user.id);
    if (error) {
      setMessage({ type: "error", text: getFriendlyGoalError(error.message) });
      return;
    }

    setMessage({ type: "success", text: "Meta borrada correctamente." });
    await loadData();
  }

  async function deleteContribution(contribution: GoalContribution) {
    if (!supabase) return;

    const confirmed = window.confirm(`Vas a borrar esta aportacion de ${formatCurrency(Number(contribution.amount), getGoalCurrency(goals, contribution.goal_id))}.\n\n¿Seguro que quieres continuar?`);
    if (!confirmed) {
      setMessage({ type: "info", text: "No se borro la aportacion." });
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage({ type: "error", text: "Primero inicia sesion para borrar aportaciones." });
      return;
    }

    const { error: movementError } = await supabase
      .from("account_movements")
      .delete()
      .eq("goal_contribution_id", contribution.id)
      .eq("user_id", userData.user.id);

    if (movementError) {
      setMessage({ type: "error", text: getFriendlyGoalError(movementError.message) });
      return;
    }

    const { error } = await supabase.from("goal_contributions").delete().eq("id", contribution.id).eq("user_id", userData.user.id);
    if (error) {
      setMessage({ type: "error", text: getFriendlyGoalError(error.message) });
      return;
    }

    setMessage({ type: "success", text: "Aportacion borrada correctamente." });
    await loadData();
  }

  const goalSummaries = goals.map((goal) => buildGoalSummary(goal, contributions));
  const activeGoals = goalSummaries.filter(({ goal }) => goal.is_active);
  const completedGoals = goalSummaries.filter((summary) => summary.isCompleted);
  const nearTargetDate = activeGoals.filter(({ goal }) => {
    if (!goal.target_date) return false;
    const diffDays = Math.ceil((new Date(`${goal.target_date}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
    return diffDays >= 0 && diffDays <= 30;
  });
  const targetByCurrency = groupMoneyByCurrency(activeGoals, (summary) => Number(summary.goal.target_amount), (summary) => summary.goal.currency);
  const currentByCurrency = groupMoneyByCurrency(activeGoals, (summary) => summary.currentAmount, (summary) => summary.goal.currency);
  const remainingByCurrency = buildRemainingTotals(targetByCurrency, currentByCurrency);
  const recentContributions = contributions.slice(0, 8);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Objetivo total" value={<MoneyTotals totals={targetByCurrency} />} />
        <SummaryCard label="Avance total" value={<MoneyTotals totals={currentByCurrency} />} />
        <SummaryCard label="Restante" value={<MoneyTotals totals={remainingByCurrency} />} />
        <SummaryCard label="Metas activas" value={String(activeGoals.length)} />
        <SummaryCard label="Completadas" value={String(completedGoals.length)} />
      </section>

      {nearTargetDate.length > 0 ? (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          Tienes {nearTargetDate.length} meta(s) con fecha objetivo en los proximos 30 dias.
        </p>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <GoalForm
          accounts={accounts}
          editingGoalId={editingGoalId}
          form={goalForm}
          onCancel={cancelEditGoal}
          onChange={setGoalForm}
          onSubmit={handleGoalSubmit}
        />

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Metas registradas</h2>
          {isLoading ? <p className="mt-4 text-sm text-slate-600">Cargando metas...</p> : null}
          <div className="mt-4 grid gap-4">
            {goalSummaries.map((summary) => (
              <GoalCard accounts={accounts} key={summary.goal.id} onDelete={deleteGoal} onEdit={startEditGoal} summary={summary} />
            ))}
          </div>
          {!isLoading && goalSummaries.length === 0 ? <EmptyMessage text="Todavia no hay metas. Crea una para empezar a medir tu avance." /> : null}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <ContributionForm
          accounts={accounts}
          editingContributionId={editingContributionId}
          form={contributionForm}
          goals={goals}
          onCancel={cancelEditContribution}
          onChange={setContributionForm}
          onSubmit={handleContributionSubmit}
        />
        <RecentContributions
          accounts={accounts}
          contributions={recentContributions}
          goals={goals}
          onDelete={deleteContribution}
          onEdit={startEditContribution}
        />
      </section>

      {message ? <StatusMessage message={message} /> : null}
    </div>
  );
}

function GoalForm({
  accounts,
  editingGoalId,
  form,
  onCancel,
  onChange,
  onSubmit,
}: {
  accounts: Account[];
  editingGoalId: string | null;
  form: typeof emptyGoalForm;
  onCancel: () => void;
  onChange: (form: typeof emptyGoalForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm" onSubmit={onSubmit}>
      <h2 className="text-lg font-semibold text-slate-950">{editingGoalId ? "Editar meta" : "Nueva meta"}</h2>
      <div className="mt-4 grid gap-4">
        <TextInput label="Nombre de la meta" value={form.name} onChange={(value) => onChange({ ...form, name: value })} />
        <SelectInput label="Tipo de meta" value={form.goal_type} onChange={(value) => onChange({ ...form, goal_type: value as GoalType })}>
          {Object.entries(goalTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </SelectInput>
        <TextInput label="Monto objetivo" min="0.01" step="0.01" type="number" value={form.target_amount} onChange={(value) => onChange({ ...form, target_amount: value })} />
        <SelectInput label="Moneda" value={form.currency} onChange={(value) => onChange({ ...form, currency: value })}>
          {SUPPORTED_CURRENCIES.map((currency) => (
            <option key={currency.code} value={currency.code}>{currency.label}</option>
          ))}
        </SelectInput>
        <TextInput label="Monto actual inicial" min="0" step="0.01" type="number" value={form.current_amount} onChange={(value) => onChange({ ...form, current_amount: value })} />
        <AccountSelect accounts={accounts} label="Cuenta asociada opcional" value={form.account_id} onChange={(value) => onChange({ ...form, account_id: value })} />
        <TextInput label="Fecha objetivo opcional" required={false} type="date" value={form.target_date} onChange={(value) => onChange({ ...form, target_date: value })} />
        <TextInput label="Descripcion opcional" required={false} value={form.description} onChange={(value) => onChange({ ...form, description: value })} />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input checked={form.is_active} onChange={(event) => onChange({ ...form, is_active: event.target.checked })} type="checkbox" />
          Activa
        </label>
      </div>
      <button className="mt-5 w-full rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700" type="submit">
        {editingGoalId ? "Guardar cambios" : "Crear meta"}
      </button>
      {editingGoalId ? (
        <button className="mt-2 w-full rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700" onClick={onCancel} type="button">
          Cancelar edicion
        </button>
      ) : null}
    </form>
  );
}

function ContributionForm({
  accounts,
  editingContributionId,
  form,
  goals,
  onCancel,
  onChange,
  onSubmit,
}: {
  accounts: Account[];
  editingContributionId: string | null;
  form: typeof emptyContributionForm;
  goals: Goal[];
  onCancel: () => void;
  onChange: (form: typeof emptyContributionForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm" onSubmit={onSubmit}>
      <h2 className="text-lg font-semibold text-slate-950">{editingContributionId ? "Editar aportacion" : "Nueva aportacion"}</h2>
      <div className="mt-4 grid gap-4">
        <SelectInput label="Meta" value={form.goal_id} onChange={(value) => onChange({ ...form, goal_id: value })}>
          <option value="">Selecciona una meta</option>
          {goals.map((goal) => (
            <option key={goal.id} value={goal.id}>{goal.name} - {goal.currency}</option>
          ))}
        </SelectInput>
        <TextInput label="Fecha" type="date" value={form.contribution_date} onChange={(value) => onChange({ ...form, contribution_date: value })} />
        <TextInput label="Monto" min="0.01" step="0.01" type="number" value={form.amount} onChange={(value) => onChange({ ...form, amount: value })} />
        <AccountSelect accounts={accounts} label="Cuenta origen opcional" value={form.account_id} onChange={(value) => onChange({ ...form, account_id: value })} />
        <TextInput label="Descripcion opcional" required={false} value={form.description} onChange={(value) => onChange({ ...form, description: value })} />
      </div>
      <button className="mt-5 w-full rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700" type="submit">
        {editingContributionId ? "Guardar cambios" : "Registrar aportacion"}
      </button>
      {editingContributionId ? (
        <button className="mt-2 w-full rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700" onClick={onCancel} type="button">
          Cancelar edicion
        </button>
      ) : null}
    </form>
  );
}

function GoalCard({ accounts, summary, onEdit, onDelete }: { accounts: Account[]; summary: GoalSummary; onEdit: (goal: Goal) => void; onDelete: (goal: Goal) => void }) {
  const { goal, currentAmount, remaining, progressPercent, isCompleted } = summary;

  return (
    <article className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="font-semibold text-slate-950">{goal.name}</h3>
          <p className="text-sm text-slate-500">{goalTypeLabels[goal.goal_type]} - {goal.currency}</p>
          <p className="mt-1 text-sm text-slate-500">Cuenta: {getAccountName(accounts, goal.account_id)}</p>
          {goal.target_date ? <p className="text-sm text-slate-500">Fecha objetivo: {formatDate(goal.target_date)}</p> : null}
          {goal.description ? <p className="mt-2 text-sm text-slate-600">{goal.description}</p> : null}
        </div>
        <span className={`w-fit rounded-full border px-3 py-1 text-xs font-medium ${goal.is_active ? "border-teal-200 bg-teal-50 text-teal-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
          {goal.is_active ? "Activa" : "Inactiva"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <Metric label="Objetivo" value={formatCurrency(Number(goal.target_amount), goal.currency)} />
        <Metric label="Actual" value={formatCurrency(currentAmount, goal.currency)} />
        <Metric label="Restante" value={formatCurrency(remaining, goal.currency)} />
        <Metric label="Avance" value={`${progressPercent.toFixed(1)}%`} />
      </div>

      <div className="mt-4 h-2 rounded-full bg-slate-100">
        <div className={`h-2 rounded-full ${isCompleted ? "bg-teal-600" : "bg-blue-500"}`} style={{ width: `${Math.min(progressPercent, 100)}%` }} />
      </div>

      <div className="mt-4 flex gap-2">
        <button className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={() => onEdit(goal)} type="button">
          Editar
        </button>
        <button className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700" onClick={() => onDelete(goal)} type="button">
          Borrar
        </button>
      </div>
    </article>
  );
}

function RecentContributions({
  accounts,
  contributions,
  goals,
  onDelete,
  onEdit,
}: {
  accounts: Account[];
  contributions: GoalContribution[];
  goals: Goal[];
  onDelete: (contribution: GoalContribution) => void;
  onEdit: (contribution: GoalContribution) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Aportaciones recientes</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2 pr-4 font-medium">Fecha</th>
              <th className="py-2 pr-4 font-medium">Meta</th>
              <th className="py-2 pr-4 font-medium">Cuenta origen</th>
              <th className="py-2 pr-4 font-medium">Descripcion</th>
              <th className="py-2 text-right font-medium">Monto</th>
              <th className="py-2 pl-4 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {contributions.map((contribution) => {
              const goal = goals.find((item) => item.id === contribution.goal_id);
              return (
                <tr className="border-b border-slate-100" key={contribution.id}>
                  <td className="py-3 pr-4 text-slate-700">{formatDate(contribution.contribution_date)}</td>
                  <td className="py-3 pr-4 text-slate-700">{goal?.name ?? "Meta no encontrada"}</td>
                  <td className="py-3 pr-4 text-slate-700">{getAccountName(accounts, contribution.account_id)}</td>
                  <td className="py-3 pr-4 text-slate-700">{contribution.description || "Sin descripcion"}</td>
                  <td className="py-3 text-right font-semibold text-slate-950">{formatCurrency(Number(contribution.amount), goal?.currency)}</td>
                  <td className="py-3 pl-4">
                    <div className="flex justify-end gap-2">
                      <button className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700" onClick={() => onEdit(contribution)} type="button">
                        Editar
                      </button>
                      <button className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700" onClick={() => onDelete(contribution)} type="button">
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
      {contributions.length === 0 ? <EmptyMessage text="Todavia no hay aportaciones registradas." /> : null}
    </div>
  );
}

function buildGoalSummary(goal: Goal, contributions: GoalContribution[]): GoalSummary {
  const contributionTotal = contributions
    .filter((contribution) => contribution.goal_id === goal.id)
    .reduce((total, contribution) => total + Number(contribution.amount), 0);
  const currentAmount = Number(goal.current_amount) + contributionTotal;
  const targetAmount = Number(goal.target_amount);
  const progressPercent = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;

  return {
    goal,
    currentAmount,
    remaining: Math.max(targetAmount - currentAmount, 0),
    progressPercent,
    isCompleted: currentAmount >= targetAmount,
  };
}

function validateGoalForm(form: typeof emptyGoalForm) {
  if (!form.name.trim()) return "Escribe el nombre de la meta.";
  if (Number(form.target_amount) <= 0) return "El monto objetivo debe ser mayor a 0.";
  if (!isSupportedCurrency(form.currency)) return "Selecciona una moneda valida.";
  if (Number(form.current_amount) < 0) return "El monto actual inicial no puede ser negativo.";
  return "";
}

function validateContributionForm(form: typeof emptyContributionForm, goals: Goal[], accounts: Account[]) {
  if (!form.goal_id) return "Selecciona una meta.";
  if (!form.contribution_date) return "Selecciona la fecha de la aportacion.";
  if (Number(form.amount) <= 0) return "El monto debe ser mayor a 0.";

  const goal = goals.find((item) => item.id === form.goal_id);
  if (!goal) return "Selecciona una meta valida.";

  if (form.account_id) {
    const account = accounts.find((item) => item.id === form.account_id);
    if (!account) return "Selecciona una cuenta valida.";
    if (normalizeCurrency(account.currency) !== normalizeCurrency(goal.currency)) {
      return "La meta y la cuenta origen tienen monedas distintas. El tipo de cambio se agregara en una fase posterior.";
    }
  }

  return "";
}

function buildRemainingTotals(targets: Array<{ currency: string; amount: number }>, current: Array<{ currency: string; amount: number }>) {
  const currencies = Array.from(new Set([...targets, ...current].map((item) => normalizeCurrency(item.currency)))).sort();

  return currencies.map((currency) => ({
    currency,
    amount: Math.max((targets.find((item) => item.currency === currency)?.amount ?? 0) - (current.find((item) => item.currency === currency)?.amount ?? 0), 0),
  }));
}

function getGoalCurrency(goals: Goal[], goalId: string | null) {
  return goals.find((goal) => goal.id === goalId)?.currency ?? DEFAULT_CURRENCY;
}

function getAccountName(accounts: Account[], accountId: string | null) {
  return accounts.find((account) => account.id === accountId)?.name ?? "Sin cuenta";
}

function getFriendlyGoalError(error: string) {
  if (error.includes("goal_contributions") || error.includes("goal_contribution_id") || error.includes("currency") || error.includes("schema cache")) {
    return "Falta actualizar Supabase para metas. Ejecuta el SQL docs/ADD_GOALS.sql.";
  }

  return `No se pudo completar la accion. Detalle: ${error}`;
}

function formatDate(dateValue: string) {
  return new Date(`${dateValue}T00:00:00`).toLocaleDateString("es-MX");
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

function SelectInput({
  label,
  value,
  onChange,
  children,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" onChange={(event) => onChange(event.target.value)} required={required} value={value}>
        {children}
      </select>
    </label>
  );
}

function AccountSelect({ accounts, label, value, onChange }: { accounts: Account[]; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <SelectInput label={label} required={false} value={value} onChange={onChange}>
      <option value="">Sin cuenta</option>
      {accounts.map((account) => (
        <option key={account.id} value={account.id}>{account.name} - {account.currency}</option>
      ))}
    </SelectInput>
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
