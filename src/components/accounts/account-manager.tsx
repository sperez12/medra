"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Account, AccountMovement, AccountMovementType, AccountType } from "@/types/finance";

const accountTypeLabels: Record<AccountType, string> = {
  bank: "Banco",
  cash: "Efectivo",
  savings: "Ahorro",
  manual_investment: "Inversión manual",
  other: "Otra",
};

const movementTypeLabels: Record<AccountMovementType, string> = {
  income: "Ingreso",
  expense: "Egreso",
  transfer: "Transferencia",
  adjustment: "Ajuste",
};

const emptyAccountForm = {
  name: "",
  institution: "",
  account_type: "bank" as AccountType,
  currency: "MXN" as "MXN" | "USD",
  initial_balance: "0",
  description: "",
  is_active: true,
};

const emptyMovementForm = {
  account_id: "",
  movement_date: new Date().toISOString().slice(0, 10),
  movement_type: "income" as AccountMovementType,
  amount: "0",
  description: "",
};

type Message = {
  type: "success" | "error" | "info";
  text: string;
};

export function AccountManager() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [movements, setMovements] = useState<AccountMovement[]>([]);
  const [accountForm, setAccountForm] = useState(emptyAccountForm);
  const [movementForm, setMovementForm] = useState(emptyMovementForm);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    if (!supabase) {
      setMessage({ type: "error", text: "Falta configurar Supabase para usar cuentas." });
      setIsLoading(false);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage({ type: "info", text: "Inicia sesión para ver tus cuentas." });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const [{ data: accountData, error: accountError }, { data: movementData, error: movementError }] =
      await Promise.all([
        supabase
          .from("accounts")
          .select("*")
          .eq("user_id", userData.user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("account_movements")
          .select("*")
          .eq("user_id", userData.user.id)
          .order("movement_date", { ascending: false }),
      ]);

    if (accountError || movementError) {
      setMessage({
        type: "error",
        text: getFriendlyAccountError(accountError?.message ?? movementError?.message ?? "No se pudieron cargar las cuentas."),
      });
      setIsLoading(false);
      return;
    }

    setAccounts((accountData ?? []) as Account[]);
    setMovements((movementData ?? []) as AccountMovement[]);
    setIsLoading(false);
  }

  async function handleAccountSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!supabase) {
      setMessage({ type: "error", text: "Falta configurar Supabase antes de guardar cuentas." });
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage({ type: "error", text: "Primero inicia sesión para guardar cuentas." });
      return;
    }

    const validationError = validateAccountForm(accountForm);
    if (validationError) {
      setMessage({ type: "error", text: validationError });
      return;
    }

    const payload = {
      user_id: userData.user.id,
      name: accountForm.name.trim(),
      institution: accountForm.institution.trim() || null,
      account_type: accountForm.account_type,
      currency: accountForm.currency,
      initial_balance: Number(accountForm.initial_balance),
      description: accountForm.description.trim() || null,
      is_active: accountForm.is_active,
    };

    const request = editingAccountId
      ? supabase
          .from("accounts")
          .update(payload)
          .eq("id", editingAccountId)
          .eq("user_id", userData.user.id)
      : supabase.from("accounts").insert(payload);

    const { error } = await request;
    if (error) {
      setMessage({ type: "error", text: getFriendlyAccountError(error.message) });
      return;
    }

    setAccountForm(emptyAccountForm);
    setEditingAccountId(null);
    setMessage({
      type: "success",
      text: editingAccountId ? "Cuenta actualizada correctamente." : "Cuenta creada correctamente.",
    });
    await loadData();
  }

  async function handleMovementSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!supabase) {
      setMessage({ type: "error", text: "Falta configurar Supabase antes de guardar movimientos." });
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage({ type: "error", text: "Primero inicia sesión para guardar movimientos." });
      return;
    }

    const validationError = validateMovementForm(movementForm);
    if (validationError) {
      setMessage({ type: "error", text: validationError });
      return;
    }

    const { error } = await supabase.from("account_movements").insert({
      user_id: userData.user.id,
      account_id: movementForm.account_id,
      movement_date: movementForm.movement_date,
      movement_type: movementForm.movement_type,
      amount: Number(movementForm.amount),
      description: movementForm.description.trim() || null,
    });

    if (error) {
      setMessage({ type: "error", text: getFriendlyAccountError(error.message) });
      return;
    }

    setMovementForm({ ...emptyMovementForm, account_id: movementForm.account_id });
    setMessage({ type: "success", text: "Movimiento registrado correctamente." });
    await loadData();
  }

  function startEditAccount(account: Account) {
    setEditingAccountId(account.id);
    setAccountForm({
      name: account.name,
      institution: account.institution ?? "",
      account_type: account.account_type,
      currency: account.currency,
      initial_balance: String(account.initial_balance),
      description: account.description ?? "",
      is_active: account.is_active,
    });
    setMessage({ type: "info", text: "Editando cuenta. Cuando termines, presiona Guardar cambios." });
  }

  function cancelEditAccount() {
    setEditingAccountId(null);
    setAccountForm(emptyAccountForm);
    setMessage({ type: "info", text: "Edición cancelada." });
  }

  async function deleteAccount(account: Account) {
    if (!supabase) {
      setMessage({ type: "error", text: "Falta configurar Supabase antes de borrar cuentas." });
      return;
    }

    const movementCount = movements.filter((movement) => movement.account_id === account.id).length;
    const warning =
      movementCount > 0
        ? `La cuenta "${account.name}" tiene ${movementCount} movimiento(s). Si la borras, esos movimientos también se borrarán.`
        : `Vas a borrar la cuenta "${account.name}".`;

    const confirmed = window.confirm(`${warning}\n\nEsta acción no se puede deshacer. ¿Seguro que quieres continuar?`);
    if (!confirmed) {
      setMessage({ type: "info", text: "No se borró la cuenta." });
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage({ type: "error", text: "Primero inicia sesión para borrar cuentas." });
      return;
    }

    const { error } = await supabase
      .from("accounts")
      .delete()
      .eq("id", account.id)
      .eq("user_id", userData.user.id);

    if (error) {
      setMessage({ type: "error", text: getFriendlyAccountError(error.message) });
      return;
    }

    if (editingAccountId === account.id) {
      setEditingAccountId(null);
      setAccountForm(emptyAccountForm);
    }

    setMessage({ type: "success", text: "Cuenta borrada correctamente." });
    await loadData();
  }

  const accountSummaries = accounts.map((account) => ({
    account,
    balance: calculateAccountBalance(account, movements),
    movementCount: movements.filter((movement) => movement.account_id === account.id).length,
  }));
  const activeAccounts = accountSummaries.filter(({ account }) => account.is_active);
  const totalMxn = activeAccounts
    .filter(({ account }) => account.currency === "MXN")
    .reduce((total, item) => total + item.balance, 0);
  const totalUsd = activeAccounts
    .filter(({ account }) => account.currency === "USD")
    .reduce((total, item) => total + item.balance, 0);
  const recentMovements = movements.slice(0, 8);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-3xl font-bold text-slate-950">Cuentas</h1>
        <p className="mt-2 text-slate-600">
          Registra cuentas bancarias, efectivo y saldos manuales para preparar el cálculo de patrimonio.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Total en MXN" value={formatMoney(totalMxn, "MXN")} />
        <SummaryCard label="Total en USD" value={formatMoney(totalUsd, "USD")} />
        <SummaryCard label="Cuentas activas" value={String(activeAccounts.length)} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <AccountForm
          editingAccountId={editingAccountId}
          form={accountForm}
          onCancel={cancelEditAccount}
          onChange={setAccountForm}
          onSubmit={handleAccountSubmit}
        />

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Cuentas registradas</h2>
          {isLoading ? <p className="mt-4 text-sm text-slate-600">Cargando cuentas...</p> : null}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {accountSummaries.map(({ account, balance, movementCount }) => (
              <article className="rounded-lg border border-slate-200 p-4" key={account.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-950">{account.name}</h3>
                    <p className="text-sm text-slate-500">{account.institution || "Sin institución"}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {accountTypeLabels[account.account_type]} - {account.currency}
                    </p>
                  </div>
                  <StatusPill active={account.is_active} />
                </div>
                <p className="mt-4 text-sm text-slate-500">Saldo actual estimado</p>
                <p className="text-2xl font-bold text-slate-950">{formatMoney(balance, account.currency)}</p>
                <p className="mt-1 text-xs text-slate-500">{movementCount} movimiento(s)</p>
                {account.description ? <p className="mt-3 text-sm text-slate-600">{account.description}</p> : null}
                <div className="mt-4 flex gap-2">
                  <button className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={() => startEditAccount(account)} type="button">
                    Editar
                  </button>
                  <button className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700" onClick={() => deleteAccount(account)} type="button">
                    Borrar
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!isLoading && accountSummaries.length === 0 ? (
            <EmptyMessage text="Todavía no hay cuentas. Crea tu primera cuenta para empezar a registrar saldos." />
          ) : null}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <MovementForm
          accounts={accounts}
          form={movementForm}
          onChange={setMovementForm}
          onSubmit={handleMovementSubmit}
        />
        <RecentMovements accounts={accounts} movements={recentMovements} />
      </section>

      {message ? <StatusMessage message={message} /> : null}
    </div>
  );
}

function AccountForm({
  editingAccountId,
  form,
  onCancel,
  onChange,
  onSubmit,
}: {
  editingAccountId: string | null;
  form: typeof emptyAccountForm;
  onCancel: () => void;
  onChange: (form: typeof emptyAccountForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm" onSubmit={onSubmit}>
      <h2 className="text-lg font-semibold text-slate-950">{editingAccountId ? "Editar cuenta" : "Nueva cuenta"}</h2>
      <div className="mt-4 grid gap-4">
        <TextInput label="Nombre de la cuenta" value={form.name} onChange={(value) => onChange({ ...form, name: value })} />
        <TextInput label="Institución o banco" value={form.institution} onChange={(value) => onChange({ ...form, institution: value })} required={false} />
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Tipo de cuenta</span>
          <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" onChange={(event) => onChange({ ...form, account_type: event.target.value as AccountType })} value={form.account_type}>
            {Object.entries(accountTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Moneda</span>
          <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" onChange={(event) => onChange({ ...form, currency: event.target.value as "MXN" | "USD" })} value={form.currency}>
            <option value="MXN">MXN</option>
            <option value="USD">USD</option>
          </select>
        </label>
        <TextInput label="Saldo inicial" min="0" step="0.01" type="number" value={form.initial_balance} onChange={(value) => onChange({ ...form, initial_balance: value })} />
        <TextInput label="Descripción opcional" value={form.description} onChange={(value) => onChange({ ...form, description: value })} required={false} />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input checked={form.is_active} onChange={(event) => onChange({ ...form, is_active: event.target.checked })} type="checkbox" />
          Activa
        </label>
      </div>
      <button className="mt-5 w-full rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700" type="submit">
        {editingAccountId ? "Guardar cambios" : "Crear cuenta"}
      </button>
      {editingAccountId ? (
        <button className="mt-2 w-full rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700" onClick={onCancel} type="button">
          Cancelar edición
        </button>
      ) : null}
    </form>
  );
}

function MovementForm({
  accounts,
  form,
  onChange,
  onSubmit,
}: {
  accounts: Account[];
  form: typeof emptyMovementForm;
  onChange: (form: typeof emptyMovementForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm" onSubmit={onSubmit}>
      <h2 className="text-lg font-semibold text-slate-950">Nuevo movimiento</h2>
      <div className="mt-4 grid gap-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Cuenta</span>
          <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" onChange={(event) => onChange({ ...form, account_id: event.target.value })} required value={form.account_id}>
            <option value="">Selecciona una cuenta</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>{account.name}</option>
            ))}
          </select>
        </label>
        <TextInput label="Fecha" type="date" value={form.movement_date} onChange={(value) => onChange({ ...form, movement_date: value })} />
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Tipo de movimiento</span>
          <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" onChange={(event) => onChange({ ...form, movement_type: event.target.value as AccountMovementType })} value={form.movement_type}>
            {Object.entries(movementTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <TextInput label="Monto" min="0.01" step="0.01" type="number" value={form.amount} onChange={(value) => onChange({ ...form, amount: value })} />
        <TextInput label="Descripción opcional" value={form.description} onChange={(value) => onChange({ ...form, description: value })} required={false} />
      </div>
      <button className="mt-5 w-full rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700" type="submit">
        Registrar movimiento
      </button>
    </form>
  );
}

function RecentMovements({ accounts, movements }: { accounts: Account[]; movements: AccountMovement[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Últimos movimientos</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2 pr-4 font-medium">Fecha</th>
              <th className="py-2 pr-4 font-medium">Cuenta</th>
              <th className="py-2 pr-4 font-medium">Tipo</th>
              <th className="py-2 pr-4 font-medium">Descripción</th>
              <th className="py-2 text-right font-medium">Monto</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((movement) => {
              const account = accounts.find((item) => item.id === movement.account_id);
              return (
                <tr className="border-b border-slate-100" key={movement.id}>
                  <td className="py-3 pr-4 text-slate-700">{new Date(`${movement.movement_date}T00:00:00`).toLocaleDateString("es-MX")}</td>
                  <td className="py-3 pr-4 text-slate-700">{account?.name ?? "Cuenta no encontrada"}</td>
                  <td className="py-3 pr-4 text-slate-700">{movementTypeLabels[movement.movement_type]}</td>
                  <td className="py-3 pr-4 text-slate-700">{movement.description || "Sin descripción"}</td>
                  <td className="py-3 text-right font-semibold text-slate-950">{formatMoney(Number(movement.amount), account?.currency ?? "MXN")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {movements.length === 0 ? <EmptyMessage text="Todavía no hay movimientos registrados." /> : null}
    </div>
  );
}

function calculateAccountBalance(account: Account, movements: AccountMovement[]) {
  return movements
    .filter((movement) => movement.account_id === account.id)
    .reduce((balance, movement) => {
      if (movement.movement_type === "income") return balance + Number(movement.amount);
      if (movement.movement_type === "expense") return balance - Number(movement.amount);
      if (movement.movement_type === "adjustment") return balance + Number(movement.amount);
      return balance;
    }, Number(account.initial_balance));
}

function validateAccountForm(form: typeof emptyAccountForm) {
  if (!form.name.trim()) return "Escribe el nombre de la cuenta.";
  if (Number(form.initial_balance) < 0) return "El saldo inicial no puede ser negativo.";
  return "";
}

function validateMovementForm(form: typeof emptyMovementForm) {
  if (!form.account_id) return "Selecciona una cuenta.";
  if (!form.movement_date) return "Selecciona la fecha del movimiento.";
  if (Number(form.amount) <= 0) return "El monto debe ser mayor a 0.";
  return "";
}

function getFriendlyAccountError(error: string) {
  if (error.includes("account_type") || error.includes("description")) {
    return "Falta actualizar Supabase para cuentas. Ejecuta el SQL docs/ADD_ACCOUNTS.sql.";
  }
  return `No se pudo completar la acción. Detalle: ${error}`;
}

function formatMoney(amount: number, currency: string) {
  return amount.toLocaleString("es-MX", { style: "currency", currency });
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span className={`w-fit rounded-full border px-3 py-1 text-xs font-medium ${active ? "border-teal-200 bg-teal-50 text-teal-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
      {active ? "Activa" : "Inactiva"}
    </span>
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
