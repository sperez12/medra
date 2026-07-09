"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PeriodFilterControls } from "@/components/period-filter-controls";
import {
  getDefaultPeriodFilter,
  getPeriodLabel,
  isDateInSelectedPeriod,
  type PeriodFilterState,
} from "@/lib/period-filters";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { CreditCard, Payment, PaymentType } from "@/types/finance";

const paymentTypeLabels: Record<PaymentType, string> = {
  minimum: "Pago minimo",
  partial: "Pago parcial",
  no_interest: "Pago para no generar intereses",
  total: "Pago total",
  other: "Otro",
};

const emptyForm = {
  credit_card_id: "",
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
  const [cards, setCards] = useState<CreditCard[]>([]);
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
      setMessage({ type: "info", text: "Inicia sesion para ver tus pagos." });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const [{ data: cardData, error: cardError }, { data: paymentData, error: paymentError }] =
      await Promise.all([
        supabase
          .from("credit_cards")
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

    if (cardError || paymentError) {
      setMessage({
        type: "error",
        text: cardError?.message ?? paymentError?.message ?? "No se pudieron cargar los pagos.",
      });
      setIsLoading(false);
      return;
    }

    setCards((cardData ?? []) as CreditCard[]);
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
      setMessage({ type: "error", text: "Primero inicia sesion para guardar pagos." });
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
      account_id: null,
      payment_date: form.payment_date,
      amount: Number(form.amount),
      payment_type: form.payment_type,
      notes: form.notes.trim() || null,
    };

    const request = editingPaymentId
      ? supabase
          .from("payments")
          .update(payload)
          .eq("id", editingPaymentId)
          .eq("user_id", userData.user.id)
      : supabase.from("payments").insert(payload);

    const { error } = await request;
    if (error) {
      setMessage({ type: "error", text: getFriendlyPaymentError(error.message) });
      return;
    }

    setForm({ ...emptyForm, credit_card_id: form.credit_card_id });
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
    setMessage({ type: "info", text: "Edicion cancelada." });
  }

  async function deletePayment(payment: Payment) {
    if (!supabase) {
      setMessage({ type: "error", text: "Falta configurar Supabase antes de borrar pagos." });
      return;
    }

    const confirmed = window.confirm(
      `Vas a borrar este pago:\n\n${getCardName(payment.credit_card_id)} - ${formatMoney(Number(payment.amount))}\n\nEsta accion no se puede deshacer. ¿Seguro que quieres continuar?`
    );

    if (!confirmed) {
      setMessage({ type: "info", text: "No se borro el pago." });
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage({ type: "error", text: "Primero inicia sesion para borrar pagos." });
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

  function getCardName(cardId: string | null) {
    return cards.find((card) => card.id === cardId)?.name ?? "Tarjeta no encontrada";
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
    <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
      <form className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm" onSubmit={handleSubmit}>
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
            <span className="text-sm font-medium text-slate-700">Descripcion opcional</span>
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
            Cancelar edicion
          </button>
        ) : null}
        {message ? <StatusMessage message={message} /> : null}
      </form>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Pagos</h2>
            <p className="mt-1 text-sm text-slate-600">Vista actual: {getPeriodLabel(periodFilter)}.</p>
          </div>
          <PeriodFilterControls value={periodFilter} onChange={setPeriodFilter} />
        </div>
        {isLoading ? <p className="mt-4 text-sm text-slate-600">Cargando pagos...</p> : null}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-4 font-medium">Fecha</th>
                <th className="py-2 pr-4 font-medium">Tarjeta</th>
                <th className="py-2 pr-4 font-medium">Tipo</th>
                <th className="py-2 pr-4 font-medium">Descripcion</th>
                <th className="py-2 text-right font-medium">Monto</th>
                <th className="py-2 pl-4 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((payment) => (
                <tr className="border-b border-slate-100" key={payment.id}>
                  <td className="py-3 pr-4 text-slate-700">
                    {new Date(`${payment.payment_date}T00:00:00`).toLocaleDateString("es-MX")}
                  </td>
                  <td className="py-3 pr-4 text-slate-700">{getCardName(payment.credit_card_id)}</td>
                  <td className="py-3 pr-4 text-slate-700">{paymentTypeLabels[payment.payment_type]}</td>
                  <td className="py-3 pr-4 text-slate-700">{payment.notes || "Sin descripcion"}</td>
                  <td className="py-3 text-right font-semibold text-slate-950">{formatMoney(Number(payment.amount))}</td>
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
            No hay pagos para el periodo seleccionado.
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

function formatMoney(amount: number) {
  return amount.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function getFriendlyPaymentError(error: string) {
  if (error.includes("payment_type")) {
    return "El tipo de pago no es valido. Revisa la opcion seleccionada.";
  }

  if (error.includes("credit_card_id")) {
    return "Selecciona una tarjeta valida.";
  }

  if (error.includes("column") && error.includes("payment_type")) {
    return "Falta actualizar Supabase. Ejecuta el SQL docs/ADD_CARD_PAYMENTS.sql.";
  }

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
