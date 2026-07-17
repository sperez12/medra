"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_ALERT_PREFERENCES,
  isMissingAlertPreferencesTableError,
  normalizeAlertPreferences,
  type AlertPreferenceValues,
} from "@/lib/financial-alerts";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { UserAlertPreference } from "@/types/finance";

type Message = {
  type: "success" | "error" | "info";
  text: string;
};

type AlertPreferencesFormState = {
  card_payment_warning_days: string;
  budget_warning_percent: string;
  investment_stale_price_days: string;
  low_balance_alert_enabled: boolean;
  investment_price_alerts_enabled: boolean;
};

function preferencesToForm(preferences: AlertPreferenceValues): AlertPreferencesFormState {
  return {
    card_payment_warning_days: String(preferences.card_payment_warning_days),
    budget_warning_percent: String(preferences.budget_warning_percent),
    investment_stale_price_days: String(preferences.investment_stale_price_days),
    low_balance_alert_enabled: preferences.low_balance_alert_enabled,
    investment_price_alerts_enabled: preferences.investment_price_alerts_enabled,
  };
}

export function AlertPreferencesForm() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [userId, setUserId] = useState("");
  const [form, setForm] = useState<AlertPreferencesFormState>(preferencesToForm(DEFAULT_ALERT_PREFERENCES));
  const [message, setMessage] = useState<Message | null>(null);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadAlertPreferences();
  }, []);

  async function loadAlertPreferences() {
    if (!supabase) {
      setMessage({ type: "error", text: "Falta configurar Supabase para cargar preferencias de alertas." });
      setIsLoading(false);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage({ type: "info", text: "Inicia sesion para editar tus preferencias de alertas." });
      setIsLoading(false);
      return;
    }

    setUserId(userData.user.id);

    const { data, error } = await supabase
      .from("user_alert_preferences")
      .select("*")
      .eq("user_id", userData.user.id)
      .maybeSingle<UserAlertPreference>();

    if (error) {
      const missingTable = isMissingAlertPreferencesTableError(error.message);

      setNeedsMigration(missingTable);
      setMessage({
        type: missingTable ? "info" : "error",
        text: missingTable
          ? "Para guardar preferencias de alertas, ejecuta la migracion pendiente docs/ADD_ALERT_PREFERENCES.sql en Supabase."
          : `No pude cargar tus preferencias de alertas: ${error.message}`,
      });
      setIsLoading(false);
      return;
    }

    setForm(preferencesToForm(normalizeAlertPreferences(data)));
    setNeedsMigration(false);
    setIsLoading(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !userId) {
      setMessage({ type: "error", text: "No pude guardar porque no hay una sesion activa." });
      return;
    }

    if (needsMigration) {
      setMessage({
        type: "error",
        text: "Para guardar preferencias de alertas, ejecuta primero docs/ADD_ALERT_PREFERENCES.sql en Supabase.",
      });
      return;
    }

    const parsedPreferences = parseFormPreferences(form);
    const validationError = validateAlertPreferences(parsedPreferences);
    if (validationError) {
      setMessage({ type: "error", text: validationError });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    const { error } = await supabase.from("user_alert_preferences").upsert(
      {
        user_id: userId,
        ...parsedPreferences,
      },
      { onConflict: "user_id" }
    );

    setIsSaving(false);

    if (error) {
      const missingTable = isMissingAlertPreferencesTableError(error.message);
      setNeedsMigration(missingTable);
      setMessage({
        type: "error",
        text: missingTable
          ? "Para guardar preferencias de alertas, ejecuta primero docs/ADD_ALERT_PREFERENCES.sql en Supabase."
          : `No pude guardar tus preferencias de alertas: ${error.message}`,
      });
      return;
    }

    setMessage({ type: "success", text: "Preferencias de alertas guardadas correctamente." });
  }

  return (
    <section className="pp-card min-w-0 p-5 sm:p-6">
      <div className="min-w-0">
        <h2 className="text-xl font-semibold text-finance-ink">Preferencias de alertas</h2>
        <p className="mt-2 text-sm text-finance-muted">
          Estos umbrales solo ajustan avisos visuales. No cambian calculos financieros, saldos ni reportes.
        </p>
      </div>

      {message ? <StatusMessage message={message} /> : null}
      {isLoading ? <p className="mt-4 text-sm text-finance-muted">Cargando preferencias de alertas...</p> : null}

      <form className="mt-5 grid min-w-0 gap-4" onSubmit={handleSubmit}>
        <div className="grid min-w-0 gap-4 md:grid-cols-3">
          <NumberField
            disabled={needsMigration}
            help="Rango permitido: 1 a 30 dias."
            label="Avisar pago de tarjeta dias antes"
            max={30}
            min={1}
            onChange={(value) => setForm({ ...form, card_payment_warning_days: value })}
            value={form.card_payment_warning_days}
          />
          <NumberField
            disabled={needsMigration}
            help="Rango permitido: 50% a 100%."
            label="Avisar presupuesto desde"
            max={100}
            min={50}
            onChange={(value) => setForm({ ...form, budget_warning_percent: value })}
            suffix="%"
            value={form.budget_warning_percent}
          />
          <NumberField
            disabled={needsMigration}
            help="Rango permitido: 1 a 30 dias."
            label="Precio automatico antiguo despues de"
            max={30}
            min={1}
            onChange={(value) => setForm({ ...form, investment_stale_price_days: value })}
            value={form.investment_stale_price_days}
          />
        </div>

        <div className="grid min-w-0 gap-3 md:grid-cols-2">
          <CheckboxField
            checked={form.low_balance_alert_enabled}
            disabled={needsMigration}
            label="Alertar cuentas activas con saldo menor o igual a 0"
            onChange={(checked) => setForm({ ...form, low_balance_alert_enabled: checked })}
          />
          <CheckboxField
            checked={form.investment_price_alerts_enabled}
            disabled={needsMigration}
            label="Alertar precios automaticos de inversiones"
            onChange={(checked) => setForm({ ...form, investment_price_alerts_enabled: checked })}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <button className="pp-button-primary w-full sm:w-fit" disabled={isSaving || isLoading || needsMigration} type="submit">
            {isSaving ? "Guardando..." : "Guardar preferencias de alertas"}
          </button>
          {needsMigration ? (
            <p className="text-xs text-finance-muted">
              Mientras no ejecutes el SQL, Medra seguira usando valores por defecto para calcular alertas.
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function NumberField({
  disabled,
  help,
  label,
  max,
  min,
  onChange,
  suffix,
  value,
}: {
  disabled: boolean;
  help: string;
  label: string;
  max: number;
  min: number;
  onChange: (value: string) => void;
  suffix?: string;
  value: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-sm font-medium text-finance-ink">{label}</span>
      <div className="mt-1 flex min-w-0 items-center gap-2">
        <input
          className="pp-input"
          disabled={disabled}
          max={max}
          min={min}
          onChange={(event) => onChange(event.target.value)}
          type="number"
          value={value}
        />
        {suffix ? <span className="text-sm font-semibold text-finance-muted">{suffix}</span> : null}
      </div>
      <span className="mt-1 block text-xs text-finance-muted">{help}</span>
    </label>
  );
}

function CheckboxField({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-w-0 items-start gap-3 rounded-xl border border-finance-line bg-finance-mist p-3 text-sm text-finance-ink">
      <input
        checked={checked}
        className="mt-1 h-4 w-4 rounded border-finance-line text-brand-700"
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span className="break-words">{label}</span>
    </label>
  );
}

function StatusMessage({ message }: { message: Message }) {
  const styles = {
    success: "border-green-200 bg-green-50 text-green-800",
    error: "border-red-200 bg-red-50 text-red-800",
    info: "border-amber-200 bg-amber-50 text-amber-900",
  };

  return <p className={`mt-4 rounded-md border px-3 py-2 text-sm ${styles[message.type]}`}>{message.text}</p>;
}

function parseFormPreferences(form: AlertPreferencesFormState): AlertPreferenceValues {
  return {
    card_payment_warning_days: Number(form.card_payment_warning_days),
    budget_warning_percent: Number(form.budget_warning_percent),
    investment_stale_price_days: Number(form.investment_stale_price_days),
    low_balance_alert_enabled: form.low_balance_alert_enabled,
    investment_price_alerts_enabled: form.investment_price_alerts_enabled,
  };
}

function validateAlertPreferences(preferences: AlertPreferenceValues) {
  if (!isIntegerInRange(preferences.card_payment_warning_days, 1, 30)) {
    return "Los dias de aviso para tarjetas deben estar entre 1 y 30.";
  }

  if (!isIntegerInRange(preferences.budget_warning_percent, 50, 100)) {
    return "El porcentaje de aviso de presupuesto debe estar entre 50 y 100.";
  }

  if (!isIntegerInRange(preferences.investment_stale_price_days, 1, 30)) {
    return "Los dias para precio antiguo deben estar entre 1 y 30.";
  }

  return null;
}

function isIntegerInRange(value: number, min: number, max: number) {
  return Number.isInteger(value) && value >= min && value <= max;
}
