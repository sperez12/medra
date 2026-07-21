"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PeriodFilterControls } from "@/components/period-filter-controls";
import { MoneyAmount } from "@/components/ui/money-amount";
import { formatDateForPreference } from "@/lib/date-format";
import {
  getDefaultPeriodFilter,
  getPeriodLabel,
  isDateInSelectedPeriod,
  type PeriodFilterState,
} from "@/lib/period-filters";
import { DEFAULT_CURRENCY, formatCurrency } from "@/lib/currencies";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserPreferences } from "@/lib/use-user-preferences";
import type { Account, CreditCard, Payment, PaymentType } from "@/types/finance";

const paymentTypeLabels: Record<PaymentType, string> = {
  minimum: "Pago mínimo",
  partial: "Pago parcial",
  no_interest: "Pago para no generar intereses",
  total: "Pago total",
  other: "Otro",
};

const emptyForm = {
  credit_card_id: "",
  account_id: "",
  payment_date: new Date().toISOString().slice(0, 10),
  amount: "0",
  payment_type: "partial" as PaymentType,
  notes: "",
};

type Message = {
  type: "success" | "error" | "info";
  text: string;
};

export function PaymentManager() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { dateFormat } = useUserPreferences();
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterState>(getDefaultPeriodFilter);
  const [message, setMessage] = useState<Message | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    if (!supabase) {
      setMessage({ type: "error", text: "Falta configurar Supabase para registrar pagos." });
      setIsLoading(false);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage({ type: "info", text: "Inicia sesión para ver tus pagos." });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const [
      { data: cardData, error: cardError },
      { data: accountData, error: accountError },
      { data: paymentData, error: paymentError },
    ] = await Promise.all([
      supabase
        .from("credit_cards")
        .select("*")
        .eq("user_id", userData.user.id)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("accounts")
        .select("*")
        .eq("user_id", userData.user.id)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("payments")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("payment_date", { ascending: false }),
    ]);

    if (cardError || accountError || paymentError) {
      setMessage({
        type: "error",
        text: cardError?.message ?? accountError?.message ?? paymentError?.message ?? "No se pudieron cargar los pagos.",
      });
      setIsLoading(false);
      return;
    }

    setCards((cardData ?? []) as CreditCard[]);
    setAccounts((accountData ?? []) as Account[]);
    setPayments((paymentData ?? []) as Payment[]);
    setIsLoading(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!supabase) {
      setMessage({ type: "error", text: "Falta configurar Supabase antes de guardar pagos." });
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage({ type: "error", text: "Primero inicia sesión para guardar pagos." });
      return;
    }

    const validationError = validatePaymentForm(form);
    if (validationError) {
      setMessage({ type: "error", text: validationError });
      return;
    }

    const payload = {
      user_id: userData.user.id,
      credit_card_id: form.credit_card_id,
      account_id: form.account_id || null,
      payment_date: form.payment_date,
      amount: Number(form.amount),
      payment_type: form.payment_type,
      notes: form.notes.trim() || null,
    };

    const { data: savedPayment, error } = editingPaymentId
      ? await supabase
          .from("payments")
          .update(payload)
          .eq("id", editingPaymentId)
          .eq("user_id", userData.user.id)
          .select("*")
          .single()
      : await supabase.from("payments").insert(payload).select("*").single();

    if (error || !savedPayment) {
      setMessage({ type: "error", text: getFriendlyPaymentError(error?.message ?? "No se pudo guardar el pago.") });
      return;
    }

    const movementError = await syncAutomaticAccountMovement(savedPayment as Payment, userData.user.id);
    if (movementError) {
      setMessage({ type: "error", text: movementError });
      return;
    }

    setForm({ ...emptyForm, credit_card_id: form.credit_card_id, account_id: form.account_id });
    setEditingPaymentId(null);
    setMessage({
      type: "success",
      text: editingPaymentId ? "Pago actualizado correctamente." : "Pago registrado correctamente.",
    });
    await loadData();
  }

  function startEdit(payment: Payment) {
    setEditingPaymentId(payment.id);
    setForm({
      credit_card_id: payment.credit_card_id ?? "",
      account_id: payment.account_id ?? "",
      payment_date: payment.payment_date,
      amount: String(payment.amount),
      payment_type: payment.payment_type,
      notes: payment.notes ?? "",
    });
    setMessage({ type: "info", text: "Editando pago. Cuando termines, presiona Guardar cambios." });
  }

  function cancelEdit() {
    setEditingPaymentId(null);
    setForm(emptyForm);
    setMessage({ type: "info", text: "Edición cancelada." });
  }

  async function deletePayment(payment: Payment) {
    if (!supabase) {
      setMessage({ type: "error", text: "Falta configurar Supabase antes de borrar pagos." });
      return;
    }

    const confirmed = window.confirm(
      `Vas a borrar este pago:\n\n${getCardName(payment.credit_card_id)} - ${formatCurrency(Number(payment.amount), getCardCurrency(payment.credit_card_id))}\n\nSi el pago creó un movimiento en una cuenta, ese movimiento también se borrará.\n\nEsta acción no se puede deshacer. ¿Seguro que quieres continuar?`
    );

    if (!confirmed) {
      setMessage({ type: "info", text: "No se borró el pago." });
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage({ type: "error", text: "Primero inicia sesión para borrar pagos." });
      return;
    }

    const { error: movementError } = await supabase
      .from("account_movements")
      .delete()
      .eq("payment_id", payment.id)
      .eq("user_id", userData.user.id);

    if (movementError) {
      setMessage({ type: "error", text: getFriendlyPaymentError(movementError.message) });
      return;
    }

    const { error } = await supabase
      .from("payments")
      .delete()
      .eq("id", payment.id)
      .eq("user_id", userData.user.id);

    if (error) {
      setMessage({ type: "error", text: getFriendlyPaymentError(error.message) });
      return;
    }

    if (editingPaymentId === payment.id) {
      setEditingPaymentId(null);
      setForm(emptyForm);
    }

    setMessage({ type: "success", text: "Pago borrado correctamente." });
    await loadData();
  }

  async function syncAutomaticAccountMovement(payment: Payment, userId: string) {
    if (!supabase) return "Falta configurar Supabase.";

    if (!payment.account_id) {
      const { error } = await supabase
        .from("account_movements")
        .delete()
        .eq("payment_id", payment.id)
        .eq("user_id", userId);

      return error ? getFriendlyPaymentError(error.message) : "";
    }

    const movementPayload = {
      user_id: userId,
      account_id: payment.account_id,
      payment_id: payment.id,
      movement_date: payment.payment_date,
      movement_type: "expense",
      amount: Number(payment.amount),
      description: `Pago de tarjeta ${getCardName(payment.credit_card_id)}`,
    };

    const { data: existingMovement, error: findError } = await supabase
      .from("account_movements")
      .select("id")
      .eq("payment_id", payment.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (findError) return getFriendlyPaymentError(findError.message);

    const { error } = existingMovement
      ? await supabase
          .from("account_movements")
          .update(movementPayload)
          .eq("id", existingMovement.id)
          .eq("user_id", userId)
      : await supabase.from("account_movements").insert(movementPayload);

    return error ? getFriendlyPaymentError(error.message) : "";
  }

  function getCardName(cardId: string | null) {
    return cards.find((card) => card.id === cardId)?.name ?? "Tarjeta no encontrada";
  }

  function getAccountName(accountId: string | null) {
    return accounts.find((account) => account.id === accountId)?.name ?? "Sin cuenta";
  }

  function getCardCurrency(cardId: string | null) {
    return cards.find((card) => card.id === cardId)?.currency ?? DEFAULT_CURRENCY;
  }

  const filteredPayments = payments.filter((payment) =>
    isDateInSelectedPeriod({
      dateValue: payment.payment_date,
      cardId: payment.credit_card_id,
      cards,
      filter: periodFilter,
    })
  );

  return (
    <div className="grid max-w-full min-w-0 gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
      <form className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6" onSubmit={handleSubmit}>
        <h2 className="text-lg font-semibold text-slate-950">
          {editingPaymentId ? "Editar pago" : "Nuevo pago"}
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
            {!isLoading && cards.length === 0 ? (
              <span className="mt-2 block rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                No tienes tarjetas activas para registrar este movimiento.
              </span>
            ) : null}
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Cuenta de origen opcional</span>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setForm({ ...form, account_id: event.target.value })}
              value={form.account_id}
            >
              <option value="">Sin cuenta de origen</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} - {account.currency}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Fecha de pago</span>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setForm({ ...form, payment_date: event.target.value })}
              required
              type="date"
              value={form.payment_date}
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
            <span className="text-sm font-medium text-slate-700">Tipo de pago</span>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setForm({ ...form, payment_type: event.target.value as PaymentType })}
              value={form.payment_type}
            >
              {Object.entries(paymentTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Descripción opcional</span>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              placeholder="Ejemplo: pago desde app bancaria"
              value={form.notes}
            />
          </label>
        </div>

        <button className="mt-5 w-full rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700" type="submit">
          {editingPaymentId ? "Guardar cambios" : "Registrar pago"}
        </button>
        {editingPaymentId ? (
          <button
            className="mt-2 w-full rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700"
            onClick={cancelEdit}
            type="button"
          >
            Cancelar edición
          </button>
        ) : null}
        {message ? <StatusMessage message={message} /> : null}
      </form>

      <div className="min-w-0 max-w-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-950">Pagos</h2>
            <p className="mt-1 text-sm text-slate-600">Vista actual: {getPeriodLabel(periodFilter)}.</p>
          </div>
          <PeriodFilterControls value={periodFilter} onChange={setPeriodFilter} />
        </div>
        {isLoading ? <p className="mt-4 text-sm text-slate-600">Cargando pagos...</p> : null}

        <div className="mt-4 w-full max-w-full overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-4 font-medium">Fecha</th>
                <th className="py-2 pr-4 font-medium">Tarjeta</th>
                <th className="py-2 pr-4 font-medium">Cuenta origen</th>
                <th className="py-2 pr-4 font-medium">Tipo</th>
                <th className="py-2 pr-4 font-medium">Descripción</th>
                <th className="py-2 text-right font-medium">Monto</th>
                <th className="py-2 pl-4 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((payment) => (
                <tr className="border-b border-slate-100" key={payment.id}>
                  <td className="py-3 pr-4 text-slate-700">
                    {formatDateForPreference(payment.payment_date, dateFormat)}
                  </td>
                  <td className="py-3 pr-4 text-slate-700">{getCardName(payment.credit_card_id)}</td>
                  <td className="py-3 pr-4 text-slate-700">{getAccountName(payment.account_id)}</td>
                  <td className="py-3 pr-4 text-slate-700">{paymentTypeLabels[payment.payment_type]}</td>
                  <td className="py-3 pr-4 text-slate-700">{payment.notes || "Sin descripción"}</td>
                  <td className="py-3 text-right font-semibold text-slate-950"><MoneyAmount amount={Number(payment.amount)} currency={getCardCurrency(payment.credit_card_id)} /></td>
                  <td className="py-3 pl-4">
                    <div className="flex justify-end gap-2">
                      <button
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
                        onClick={() => startEdit(payment)}
                        type="button"
                      >
                        Editar
                      </button>
                      <button
                        className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700"
                        onClick={() => deletePayment(payment)}
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

        {!isLoading && filteredPayments.length === 0 ? (
          <p className="mt-4 rounded-md bg-slate-50 p-4 text-sm text-slate-600">
            No hay pagos para el periodo seleccionado. Registra un pago para verlo aquí.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function validatePaymentForm(form: typeof emptyForm) {
  if (!form.credit_card_id) return "Selecciona una tarjeta.";
  if (!form.payment_date) return "Selecciona la fecha del pago.";
  if (Number(form.amount) <= 0) return "El monto debe ser mayor a 0.";
  if (!form.payment_type) return "Selecciona el tipo de pago.";
  return "";
}

function getFriendlyPaymentError(error: string) {
  if (error.includes("payment_type")) {
    return "El tipo de pago no es válido. Revisa la opción seleccionada.";
  }

  if (error.includes("credit_card_id")) {
    return "Selecciona una tarjeta válida.";
  }

  if (error.includes("payment_id")) {
    return "Falta actualizar Supabase. Ejecuta el SQL docs/ADD_PAYMENT_ACCOUNT_LINK.sql.";
  }

  if (error.includes("column") && error.includes("payment_type")) {
    return "Falta actualizar Supabase. Ejecuta el SQL docs/ADD_CARD_PAYMENTS.sql.";
  }

  return `No se pudo completar la acción. Detalle: ${error}`;
}

function StatusMessage({ message }: { message: Message }) {
  const styles = {
    success: "border-green-200 bg-green-50 text-green-800",
    error: "border-red-200 bg-red-50 text-red-800",
    info: "border-slate-200 bg-slate-50 text-slate-700",
  };

  return <p className={`mt-4 rounded-md border px-3 py-2 text-sm ${styles[message.type]}`}>{message.text}</p>;
}
