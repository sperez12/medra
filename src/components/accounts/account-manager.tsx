"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES, formatCurrency, groupMoneyByCurrency, isSupportedCurrency, normalizeCurrency } from "@/lib/currencies";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Account, AccountMovement, AccountMovementType, AccountTransfer, AccountType } from "@/types/finance";

const accountTypeLabels: Record<AccountType, string> = {
  bank: "Banco",
  cash: "Efectivo",
  savings: "Ahorro",
  manual_investment: "Inversion manual",
  other: "Otra",
};

const movementTypeLabels: Record<AccountMovementType, string> = {
  income: "Ingreso",
  expense: "Egreso",
  transfer: "Transferencia",
  adjustment: "Ajuste",
};

const manualMovementTypes: AccountMovementType[] = ["income", "expense", "adjustment"];

const emptyAccountForm = {
  name: "",
  institution: "",
  account_type: "bank" as AccountType,
  currency: DEFAULT_CURRENCY,
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

const emptyTransferForm = {
  from_account_id: "",
  to_account_id: "",
  transfer_date: new Date().toISOString().slice(0, 10),
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
  const [transfers, setTransfers] = useState<AccountTransfer[]>([]);
  const [accountForm, setAccountForm] = useState(emptyAccountForm);
  const [movementForm, setMovementForm] = useState(emptyMovementForm);
  const [transferForm, setTransferForm] = useState(emptyTransferForm);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingTransferId, setEditingTransferId] = useState<string | null>(null);
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
      setMessage({ type: "info", text: "Inicia sesion para ver tus cuentas." });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const [
      { data: accountData, error: accountError },
      { data: movementData, error: movementError },
      { data: transferData, error: transferError },
    ] = await Promise.all([
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
      supabase
        .from("account_transfers")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("transfer_date", { ascending: false }),
    ]);

    if (accountError || movementError || transferError) {
      setMessage({
        type: "error",
        text: getFriendlyAccountError(accountError?.message ?? movementError?.message ?? transferError?.message ?? "No se pudieron cargar las cuentas."),
      });
      setIsLoading(false);
      return;
    }

    setAccounts((accountData ?? []) as Account[]);
    setMovements((movementData ?? []) as AccountMovement[]);
    setTransfers((transferData ?? []) as AccountTransfer[]);
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
      setMessage({ type: "error", text: "Primero inicia sesion para guardar cuentas." });
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
      currency: normalizeCurrency(accountForm.currency),
      initial_balance: Number(accountForm.initial_balance),
      description: accountForm.description.trim() || null,
      is_active: accountForm.is_active,
    };

    const request = editingAccountId
      ? supabase.from("accounts").update(payload).eq("id", editingAccountId).eq("user_id", userData.user.id)
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
      setMessage({ type: "error", text: "Primero inicia sesion para guardar movimientos." });
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

  async function handleTransferSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!supabase) {
      setMessage({ type: "error", text: "Falta configurar Supabase antes de guardar transferencias." });
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage({ type: "error", text: "Primero inicia sesion para guardar transferencias." });
      return;
    }

    const validationError = validateTransferForm(transferForm, accounts);
    if (validationError) {
      setMessage({ type: "error", text: validationError });
      return;
    }

    const fromAccount = getAccountById(accounts, transferForm.from_account_id);
    const toAccount = getAccountById(accounts, transferForm.to_account_id);
    const currency = normalizeCurrency(fromAccount?.currency);
    const description = transferForm.description.trim() || `Transferencia de ${fromAccount?.name} a ${toAccount?.name}`;

    const transferPayload = {
      user_id: userData.user.id,
      from_account_id: transferForm.from_account_id,
      to_account_id: transferForm.to_account_id,
      transfer_date: transferForm.transfer_date,
      amount: Number(transferForm.amount),
      currency,
      description,
    };

    const { data: savedTransfer, error: transferError } = editingTransferId
      ? await supabase
          .from("account_transfers")
          .update(transferPayload)
          .eq("id", editingTransferId)
          .eq("user_id", userData.user.id)
          .select("*")
          .single()
      : await supabase
          .from("account_transfers")
          .insert(transferPayload)
          .select("*")
          .single();

    if (transferError || !savedTransfer) {
      setMessage({ type: "error", text: getFriendlyAccountError(transferError?.message ?? "No se pudo guardar la transferencia.") });
      return;
    }

    const transfer = savedTransfer as AccountTransfer;
    const movementError = await syncTransferMovements(transfer, description, userData.user.id);
    if (movementError) {
      if (!editingTransferId) {
        await supabase.from("account_transfers").delete().eq("id", transfer.id).eq("user_id", userData.user.id);
      }
      setMessage({ type: "error", text: movementError });
      return;
    }

    setTransferForm({ ...emptyTransferForm, from_account_id: transferForm.from_account_id });
    setEditingTransferId(null);
    setMessage({
      type: "success",
      text: editingTransferId
        ? "Transferencia actualizada correctamente. Sus movimientos asociados tambien se actualizaron."
        : "Transferencia registrada correctamente. Se crearon el egreso y el ingreso automaticamente.",
    });
    await loadData();
  }

  async function syncTransferMovements(transfer: AccountTransfer, description: string, userId: string) {
    if (!supabase) return "Falta configurar Supabase.";

    const movementPayloads = {
      expense: {
        user_id: userId,
        account_id: transfer.from_account_id,
        transfer_id: transfer.id,
        movement_date: transfer.transfer_date,
        movement_type: "expense" as const,
        amount: Number(transfer.amount),
        description: `Salida por transferencia: ${description}`,
      },
      income: {
        user_id: userId,
        account_id: transfer.to_account_id,
        transfer_id: transfer.id,
        movement_date: transfer.transfer_date,
        movement_type: "income" as const,
        amount: Number(transfer.amount),
        description: `Entrada por transferencia: ${description}`,
      },
    };

    const existingMovements = movements.filter((movement) => movement.transfer_id === transfer.id);
    const expenseMovement = existingMovements.find((movement) => movement.movement_type === "expense");
    const incomeMovement = existingMovements.find((movement) => movement.movement_type === "income");

    if (expenseMovement && incomeMovement) {
      const [{ error: expenseError }, { error: incomeError }] = await Promise.all([
        supabase
          .from("account_movements")
          .update(movementPayloads.expense)
          .eq("id", expenseMovement.id)
          .eq("user_id", userId),
        supabase
          .from("account_movements")
          .update(movementPayloads.income)
          .eq("id", incomeMovement.id)
          .eq("user_id", userId),
      ]);

      return expenseError || incomeError
        ? getFriendlyAccountError(expenseError?.message ?? incomeError?.message ?? "No se pudieron actualizar los movimientos.")
        : "";
    }

    const { error: deleteError } = await supabase
      .from("account_movements")
      .delete()
      .eq("transfer_id", transfer.id)
      .eq("user_id", userId);

    if (deleteError) return getFriendlyAccountError(deleteError.message);

    const { error: insertError } = await supabase.from("account_movements").insert([
      {
        user_id: userId,
        account_id: transfer.from_account_id,
        transfer_id: transfer.id,
        movement_date: transfer.transfer_date,
        movement_type: "expense",
        amount: Number(transfer.amount),
        description: `Salida por transferencia: ${description}`,
      },
      {
        user_id: userId,
        account_id: transfer.to_account_id,
        transfer_id: transfer.id,
        movement_date: transfer.transfer_date,
        movement_type: "income",
        amount: Number(transfer.amount),
        description: `Entrada por transferencia: ${description}`,
      },
    ]);

    return insertError ? getFriendlyAccountError(insertError.message) : "";
  }

  function startEditAccount(account: Account) {
    setEditingAccountId(account.id);
    setAccountForm({
      name: account.name,
      institution: account.institution ?? "",
      account_type: account.account_type,
      currency: normalizeCurrency(account.currency),
      initial_balance: String(account.initial_balance),
      description: account.description ?? "",
      is_active: account.is_active,
    });
    setMessage({ type: "info", text: "Editando cuenta. Cuando termines, presiona Guardar cambios." });
  }

  function cancelEditAccount() {
    setEditingAccountId(null);
    setAccountForm(emptyAccountForm);
    setMessage({ type: "info", text: "Edicion cancelada." });
  }

  function startEditTransfer(transfer: AccountTransfer) {
    setEditingTransferId(transfer.id);
    setTransferForm({
      from_account_id: transfer.from_account_id,
      to_account_id: transfer.to_account_id,
      transfer_date: transfer.transfer_date,
      amount: String(transfer.amount),
      description: transfer.description ?? "",
    });
    setMessage({ type: "info", text: "Editando transferencia. Cuando termines, presiona Guardar cambios." });
  }

  function cancelEditTransfer() {
    setEditingTransferId(null);
    setTransferForm(emptyTransferForm);
    setMessage({ type: "info", text: "Edicion de transferencia cancelada." });
  }

  async function deleteAccount(account: Account) {
    if (!supabase) {
      setMessage({ type: "error", text: "Falta configurar Supabase antes de borrar cuentas." });
      return;
    }

    const movementCount = movements.filter((movement) => movement.account_id === account.id).length;
    const transferCount = transfers.filter((transfer) => transfer.from_account_id === account.id || transfer.to_account_id === account.id).length;
    const warning =
      movementCount > 0 || transferCount > 0
        ? `La cuenta "${account.name}" tiene ${movementCount} movimiento(s) y ${transferCount} transferencia(s). Si la borras, ese historial tambien se borrara.`
        : `Vas a borrar la cuenta "${account.name}".`;

    const confirmed = window.confirm(`${warning}\n\nEsta accion no se puede deshacer. ¿Seguro que quieres continuar?`);
    if (!confirmed) {
      setMessage({ type: "info", text: "No se borro la cuenta." });
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage({ type: "error", text: "Primero inicia sesion para borrar cuentas." });
      return;
    }

    const { error } = await supabase.from("accounts").delete().eq("id", account.id).eq("user_id", userData.user.id);

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

  async function deleteTransfer(transfer: AccountTransfer) {
    if (!supabase) {
      setMessage({ type: "error", text: "Falta configurar Supabase antes de borrar transferencias." });
      return;
    }

    const fromAccount = getAccountById(accounts, transfer.from_account_id);
    const toAccount = getAccountById(accounts, transfer.to_account_id);
    const confirmed = window.confirm(
      `Vas a borrar esta transferencia:\n\n${fromAccount?.name ?? "Cuenta origen"} -> ${toAccount?.name ?? "Cuenta destino"}\n${formatCurrency(Number(transfer.amount), transfer.currency)}\n\nTambien se borraran el egreso y el ingreso asociados. Esta accion no se puede deshacer. ¿Seguro que quieres continuar?`
    );

    if (!confirmed) {
      setMessage({ type: "info", text: "No se borro la transferencia." });
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage({ type: "error", text: "Primero inicia sesion para borrar transferencias." });
      return;
    }

    const { error: movementError } = await supabase
      .from("account_movements")
      .delete()
      .eq("transfer_id", transfer.id)
      .eq("user_id", userData.user.id);

    if (movementError) {
      setMessage({ type: "error", text: getFriendlyAccountError(movementError.message) });
      return;
    }

    const { error } = await supabase
      .from("account_transfers")
      .delete()
      .eq("id", transfer.id)
      .eq("user_id", userData.user.id);

    if (error) {
      setMessage({ type: "error", text: getFriendlyAccountError(error.message) });
      return;
    }

    setMessage({ type: "success", text: "Transferencia borrada correctamente. Tambien se quitaron sus movimientos asociados." });
    await loadData();
  }

  const accountSummaries = accounts.map((account) => ({
    account,
    balance: calculateAccountBalance(account, movements),
    movementCount: movements.filter((movement) => movement.account_id === account.id).length,
  }));
  const activeAccounts = accountSummaries.filter(({ account }) => account.is_active);
  const totalsByCurrency = groupMoneyByCurrency(activeAccounts, (item) => item.balance, (item) => item.account.currency);
  const recentMovements = movements.slice(0, 10);
  const recentTransfers = transfers.slice(0, 8);

  return (
    <div className="max-w-full space-y-6 overflow-x-hidden">
      <section>
        <h1 className="text-3xl font-bold text-slate-950">Cuentas</h1>
        <p className="mt-2 text-slate-600">
          Registra cuentas bancarias, efectivo, movimientos y transferencias entre cuentas.
        </p>
      </section>

      <section className="grid min-w-0 gap-4 md:grid-cols-3">
        <SummaryCard label="Totales por moneda" value={<MoneyTotals totals={totalsByCurrency} />} />
        <SummaryCard label="Cuentas activas" value={String(activeAccounts.length)} />
        <SummaryCard label="Transferencias" value={String(transfers.length)} />
      </section>

      <section className="grid min-w-0 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <AccountForm
          editingAccountId={editingAccountId}
          form={accountForm}
          onCancel={cancelEditAccount}
          onChange={setAccountForm}
          onSubmit={handleAccountSubmit}
        />
        <AccountList
          accountSummaries={accountSummaries}
          isLoading={isLoading}
          onDelete={deleteAccount}
          onEdit={startEditAccount}
        />
      </section>

      <section className="grid min-w-0 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <TransferForm
          accounts={accounts}
          editingTransferId={editingTransferId}
          form={transferForm}
          onCancel={cancelEditTransfer}
          onChange={setTransferForm}
          onSubmit={handleTransferSubmit}
        />
        <RecentTransfers accounts={accounts} transfers={recentTransfers} onDelete={deleteTransfer} onEdit={startEditTransfer} />
      </section>

      <section className="grid min-w-0 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <MovementForm accounts={accounts} form={movementForm} onChange={setMovementForm} onSubmit={handleMovementSubmit} />
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
    <form className="min-w-0 max-w-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6" onSubmit={onSubmit}>
      <h2 className="text-lg font-semibold text-slate-950">{editingAccountId ? "Editar cuenta" : "Nueva cuenta"}</h2>
      <div className="mt-4 grid gap-4">
        <TextInput label="Nombre de la cuenta" value={form.name} onChange={(value) => onChange({ ...form, name: value })} />
        <TextInput label="Institucion o banco" value={form.institution} onChange={(value) => onChange({ ...form, institution: value })} required={false} />
        <SelectInput label="Tipo de cuenta" value={form.account_type} onChange={(value) => onChange({ ...form, account_type: value as AccountType })}>
          {Object.entries(accountTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </SelectInput>
        <SelectInput label="Moneda" value={form.currency} onChange={(value) => onChange({ ...form, currency: value })}>
          {SUPPORTED_CURRENCIES.map((currency) => (
            <option key={currency.code} value={currency.code}>{currency.label}</option>
          ))}
        </SelectInput>
        <TextInput label="Saldo inicial" min="0" step="0.01" type="number" value={form.initial_balance} onChange={(value) => onChange({ ...form, initial_balance: value })} />
        <TextInput label="Descripcion opcional" value={form.description} onChange={(value) => onChange({ ...form, description: value })} required={false} />
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
          Cancelar edicion
        </button>
      ) : null}
    </form>
  );
}

function AccountList({
  accountSummaries,
  isLoading,
  onEdit,
  onDelete,
}: {
  accountSummaries: Array<{ account: Account; balance: number; movementCount: number }>;
  isLoading: boolean;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
}) {
  return (
    <div className="min-w-0 max-w-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-slate-950">Cuentas registradas</h2>
      {isLoading ? <p className="mt-4 text-sm text-slate-600">Cargando cuentas...</p> : null}
      <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2">
        {accountSummaries.map(({ account, balance, movementCount }) => (
          <article className="min-w-0 rounded-lg border border-slate-200 p-4" key={account.id}>
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-950">{account.name}</h3>
                <p className="text-sm text-slate-500">{account.institution || "Sin institucion"}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {accountTypeLabels[account.account_type]} - {account.currency}
                </p>
              </div>
              <StatusPill active={account.is_active} />
            </div>
            <p className="mt-4 text-sm text-slate-500">Saldo actual estimado</p>
            <p className="break-words text-2xl font-bold text-slate-950">{formatCurrency(balance, account.currency)}</p>
            <p className="mt-1 text-xs text-slate-500">{movementCount} movimiento(s)</p>
            {account.description ? <p className="mt-3 text-sm text-slate-600">{account.description}</p> : null}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={() => onEdit(account)} type="button">
                Editar
              </button>
              <button className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700" onClick={() => onDelete(account)} type="button">
                Borrar
              </button>
            </div>
          </article>
        ))}
      </div>
      {!isLoading && accountSummaries.length === 0 ? (
        <EmptyMessage text="Todavia no hay cuentas. Crea tu primera cuenta para empezar a registrar saldos." />
      ) : null}
    </div>
  );
}

function TransferForm({
  accounts,
  editingTransferId,
  form,
  onCancel,
  onChange,
  onSubmit,
}: {
  accounts: Account[];
  editingTransferId: string | null;
  form: typeof emptyTransferForm;
  onCancel: () => void;
  onChange: (form: typeof emptyTransferForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="min-w-0 max-w-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6" onSubmit={onSubmit}>
      <h2 className="text-lg font-semibold text-slate-950">{editingTransferId ? "Editar transferencia" : "Nueva transferencia"}</h2>
      <p className="mt-1 text-sm text-slate-600">Por ahora solo se permiten transferencias entre cuentas con la misma moneda.</p>
      <div className="mt-4 grid gap-4">
        <AccountSelect accounts={accounts} label="Cuenta origen" value={form.from_account_id} onChange={(value) => onChange({ ...form, from_account_id: value })} />
        <AccountSelect accounts={accounts} label="Cuenta destino" value={form.to_account_id} onChange={(value) => onChange({ ...form, to_account_id: value })} />
        <TextInput label="Fecha" type="date" value={form.transfer_date} onChange={(value) => onChange({ ...form, transfer_date: value })} />
        <TextInput label="Monto" min="0.01" step="0.01" type="number" value={form.amount} onChange={(value) => onChange({ ...form, amount: value })} />
        <TextInput label="Descripcion opcional" value={form.description} onChange={(value) => onChange({ ...form, description: value })} required={false} />
      </div>
      <button className="mt-5 w-full rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700" type="submit">
        {editingTransferId ? "Guardar cambios" : "Registrar transferencia"}
      </button>
      {editingTransferId ? (
        <button className="mt-2 w-full rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700" onClick={onCancel} type="button">
          Cancelar edicion
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
    <form className="min-w-0 max-w-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6" onSubmit={onSubmit}>
      <h2 className="text-lg font-semibold text-slate-950">Nuevo movimiento manual</h2>
      <div className="mt-4 grid gap-4">
        <AccountSelect accounts={accounts} label="Cuenta" value={form.account_id} onChange={(value) => onChange({ ...form, account_id: value })} />
        <TextInput label="Fecha" type="date" value={form.movement_date} onChange={(value) => onChange({ ...form, movement_date: value })} />
        <SelectInput label="Tipo de movimiento" value={form.movement_type} onChange={(value) => onChange({ ...form, movement_type: value as AccountMovementType })}>
          {manualMovementTypes.map((value) => (
            <option key={value} value={value}>{movementTypeLabels[value]}</option>
          ))}
        </SelectInput>
        <TextInput label="Monto" min="0.01" step="0.01" type="number" value={form.amount} onChange={(value) => onChange({ ...form, amount: value })} />
        <TextInput label="Descripcion opcional" value={form.description} onChange={(value) => onChange({ ...form, description: value })} required={false} />
      </div>
      <button className="mt-5 w-full rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700" type="submit">
        Registrar movimiento
      </button>
    </form>
  );
}

function RecentTransfers({
  accounts,
  transfers,
  onDelete,
  onEdit,
}: {
  accounts: Account[];
  transfers: AccountTransfer[];
  onDelete: (transfer: AccountTransfer) => void;
  onEdit: (transfer: AccountTransfer) => void;
}) {
  return (
    <div className="min-w-0 max-w-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-slate-950">Transferencias recientes</h2>
      <div className="mt-4 w-full max-w-full overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2 pr-4 font-medium">Fecha</th>
              <th className="py-2 pr-4 font-medium">Origen</th>
              <th className="py-2 pr-4 font-medium">Destino</th>
              <th className="py-2 pr-4 font-medium">Descripcion</th>
              <th className="py-2 text-right font-medium">Monto</th>
              <th className="py-2 pl-4 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((transfer) => {
              const fromAccount = getAccountById(accounts, transfer.from_account_id);
              const toAccount = getAccountById(accounts, transfer.to_account_id);
              return (
                <tr className="border-b border-slate-100" key={transfer.id}>
                  <td className="py-3 pr-4 text-slate-700">{formatDate(transfer.transfer_date)}</td>
                  <td className="py-3 pr-4 text-slate-700">{fromAccount?.name ?? "Cuenta no encontrada"}</td>
                  <td className="py-3 pr-4 text-slate-700">{toAccount?.name ?? "Cuenta no encontrada"}</td>
                  <td className="py-3 pr-4 text-slate-700">{transfer.description || "Sin descripcion"}</td>
                  <td className="py-3 text-right font-semibold text-slate-950">{formatCurrency(Number(transfer.amount), transfer.currency)}</td>
                  <td className="py-3 pl-4">
                    <div className="flex justify-end gap-2">
                      <button className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700" onClick={() => onEdit(transfer)} type="button">
                        Editar
                      </button>
                      <button className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700" onClick={() => onDelete(transfer)} type="button">
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
      {transfers.length === 0 ? <EmptyMessage text="Todavia no hay transferencias registradas." /> : null}
    </div>
  );
}

function RecentMovements({ accounts, movements }: { accounts: Account[]; movements: AccountMovement[] }) {
  return (
    <div className="min-w-0 max-w-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-slate-950">Ultimos movimientos</h2>
      <div className="mt-4 w-full max-w-full overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2 pr-4 font-medium">Fecha</th>
              <th className="py-2 pr-4 font-medium">Cuenta</th>
              <th className="py-2 pr-4 font-medium">Tipo</th>
              <th className="py-2 pr-4 font-medium">Descripcion</th>
              <th className="py-2 text-right font-medium">Monto</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((movement) => {
              const account = getAccountById(accounts, movement.account_id);
              return (
                <tr className="border-b border-slate-100" key={movement.id}>
                  <td className="py-3 pr-4 text-slate-700">{formatDate(movement.movement_date)}</td>
                  <td className="py-3 pr-4 text-slate-700">{account?.name ?? "Cuenta no encontrada"}</td>
                  <td className="py-3 pr-4 text-slate-700">
                    {movementTypeLabels[movement.movement_type]}
                    {movement.transfer_id ? <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">Transferencia</span> : null}
                  </td>
                  <td className="py-3 pr-4 text-slate-700">{movement.description || "Sin descripcion"}</td>
                  <td className="py-3 text-right font-semibold text-slate-950">{formatCurrency(Number(movement.amount), account?.currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {movements.length === 0 ? <EmptyMessage text="Todavia no hay movimientos registrados." /> : null}
    </div>
  );
}

function AccountSelect({ accounts, label, value, onChange }: { accounts: Account[]; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <SelectInput label={label} value={value} onChange={onChange}>
      <option value="">Selecciona una cuenta</option>
      {accounts.map((account) => (
        <option key={account.id} value={account.id}>
          {account.name} - {account.currency}
        </option>
      ))}
    </SelectInput>
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
  if (!isSupportedCurrency(form.currency)) return "Selecciona una moneda valida.";
  if (Number(form.initial_balance) < 0) return "El saldo inicial no puede ser negativo.";
  return "";
}

function validateMovementForm(form: typeof emptyMovementForm) {
  if (!form.account_id) return "Selecciona una cuenta.";
  if (!form.movement_date) return "Selecciona la fecha del movimiento.";
  if (Number(form.amount) <= 0) return "El monto debe ser mayor a 0.";
  return "";
}

function validateTransferForm(form: typeof emptyTransferForm, accounts: Account[]) {
  if (!form.from_account_id) return "Selecciona la cuenta origen.";
  if (!form.to_account_id) return "Selecciona la cuenta destino.";
  if (form.from_account_id === form.to_account_id) return "La cuenta origen y la cuenta destino deben ser diferentes.";
  if (!form.transfer_date) return "Selecciona la fecha de la transferencia.";
  if (Number(form.amount) <= 0) return "El monto debe ser mayor a 0.";

  const fromAccount = getAccountById(accounts, form.from_account_id);
  const toAccount = getAccountById(accounts, form.to_account_id);
  if (!fromAccount || !toAccount) return "Selecciona cuentas validas.";

  if (normalizeCurrency(fromAccount.currency) !== normalizeCurrency(toAccount.currency)) {
    return "Por ahora no se permiten transferencias entre monedas distintas. Necesitan tipo de cambio y lo agregaremos en una fase posterior.";
  }

  return "";
}

function getAccountById(accounts: Account[], accountId: string | null) {
  return accounts.find((account) => account.id === accountId);
}

function getFriendlyAccountError(error: string) {
  if (error.includes("account_transfers") || error.includes("transfer_id") || error.includes("schema cache")) {
    return "Falta actualizar Supabase para transferencias. Ejecuta el SQL docs/ADD_ACCOUNT_TRANSFERS.sql.";
  }

  if (error.includes("account_type") || error.includes("description")) {
    return "Falta actualizar Supabase para cuentas. Ejecuta el SQL docs/ADD_ACCOUNTS.sql.";
  }

  return `No se pudo completar la accion. Detalle: ${error}`;
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
      <input
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        min={min}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        step={step}
        type={type}
        value={value}
      />
    </label>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" onChange={(event) => onChange(event.target.value)} value={value}>
        {children}
      </select>
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

function formatDate(dateValue: string) {
  return new Date(`${dateValue}T00:00:00`).toLocaleDateString("es-MX");
}
