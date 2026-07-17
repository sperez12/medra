"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { SUPPORTED_CURRENCIES, isSupportedCurrency, normalizeCurrency } from "@/lib/currencies";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  DEFAULT_DASHBOARD_PERIOD,
  DEFAULT_DATE_FORMAT,
  dashboardPeriodOptions,
  dateFormatOptions,
  isMissingPreferencesTableError,
} from "@/lib/user-preferences";
import type { UserDashboardPeriodPreference, UserDateFormatPreference, UserPreference } from "@/types/finance";

type Message = {
  type: "success" | "error" | "info";
  text: string;
};

type PreferencesForm = {
  display_name: string;
  preferred_currency: string;
  date_format: UserDateFormatPreference;
  default_dashboard_period: UserDashboardPeriodPreference;
};

const emptyForm: PreferencesForm = {
  display_name: "",
  preferred_currency: "MXN",
  date_format: DEFAULT_DATE_FORMAT,
  default_dashboard_period: DEFAULT_DASHBOARD_PERIOD,
};

export function UserPreferencesForm() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [form, setForm] = useState<PreferencesForm>(emptyForm);
  const [message, setMessage] = useState<Message | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  async function loadPreferences() {
    if (!supabase) {
      setMessage({ type: "error", text: "Falta configurar Supabase para cargar tus preferencias." });
      setIsLoading(false);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage({ type: "info", text: "Inicia sesion para editar tu perfil y preferencias." });
      setIsLoading(false);
      return;
    }

    setEmail(userData.user.email ?? "");
    setUserId(userData.user.id);

    const { data, error } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", userData.user.id)
      .maybeSingle<UserPreference>();

    if (error) {
      setMessage({
        type: "error",
        text: isMissingPreferencesTableError(error.message)
          ? "Falta crear la tabla de preferencias. Ejecuta docs/ADD_USER_PREFERENCES.sql en Supabase."
          : `No pude cargar tus preferencias: ${error.message}`,
      });
      setIsLoading(false);
      return;
    }

    if (data) {
      setForm({
        display_name: data.display_name ?? "",
        preferred_currency: normalizeCurrency(data.preferred_currency),
        date_format: data.date_format ?? DEFAULT_DATE_FORMAT,
        default_dashboard_period: data.default_dashboard_period ?? DEFAULT_DASHBOARD_PERIOD,
      });
    }

    setIsLoading(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !userId) {
      setMessage({ type: "error", text: "No pude guardar porque no hay una sesion activa." });
      return;
    }

    if (!isSupportedCurrency(form.preferred_currency)) {
      setMessage({ type: "error", text: "Elige una moneda principal valida." });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    const { error } = await supabase.from("user_preferences").upsert(
      {
        user_id: userId,
        display_name: form.display_name.trim() || null,
        preferred_currency: normalizeCurrency(form.preferred_currency),
        date_format: form.date_format,
        default_dashboard_period: form.default_dashboard_period,
      },
      { onConflict: "user_id" }
    );

    setIsSaving(false);

    if (error) {
      setMessage({
        type: "error",
        text: isMissingPreferencesTableError(error.message)
          ? "Falta crear la tabla de preferencias. Ejecuta docs/ADD_USER_PREFERENCES.sql en Supabase."
          : `No pude guardar tus preferencias: ${error.message}`,
      });
      return;
    }

    setMessage({ type: "success", text: "Preferencias guardadas correctamente." });
  }

  return (
    <section className="pp-card min-w-0 p-5 sm:p-6">
      <div className="min-w-0">
        <h2 className="text-xl font-semibold text-finance-ink">Perfil y preferencias</h2>
        <p className="mt-2 text-sm text-finance-muted">
          Estos datos solo aplican a tu usuario. No cambian saldos, reportes ni calculos financieros.
        </p>
      </div>

      {message ? <StatusMessage message={message} /> : null}
      {isLoading ? <p className="mt-4 text-sm text-finance-muted">Cargando preferencias...</p> : null}

      <form className="mt-5 grid min-w-0 gap-4" onSubmit={handleSubmit}>
        <div className="rounded-xl border border-finance-line bg-finance-mist p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-finance-muted">Correo actual</p>
          <p className="mt-1 break-words text-sm font-medium text-finance-ink">{email || "Sin correo disponible"}</p>
        </div>

        <label className="block min-w-0">
          <span className="text-sm font-medium text-finance-ink">Nombre visible opcional</span>
          <input
            className="pp-input mt-1"
            onChange={(event) => setForm({ ...form, display_name: event.target.value })}
            placeholder="Ej. David"
            value={form.display_name}
          />
        </label>

        <div className="grid min-w-0 gap-4 md:grid-cols-3">
          <label className="block min-w-0">
            <span className="text-sm font-medium text-finance-ink">Moneda principal</span>
            <select
              className="pp-input mt-1"
              onChange={(event) => setForm({ ...form, preferred_currency: event.target.value })}
              value={form.preferred_currency}
            >
              {SUPPORTED_CURRENCIES.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block min-w-0">
            <span className="text-sm font-medium text-finance-ink">Formato de fecha</span>
            <select
              className="pp-input mt-1"
              onChange={(event) => setForm({ ...form, date_format: event.target.value as UserDateFormatPreference })}
              value={form.date_format}
            >
              {dateFormatOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block min-w-0">
            <span className="text-sm font-medium text-finance-ink">Periodo inicial del Dashboard</span>
            <select
              className="pp-input mt-1"
              onChange={(event) => setForm({ ...form, default_dashboard_period: event.target.value as UserDashboardPeriodPreference })}
              value={form.default_dashboard_period}
            >
              {dashboardPeriodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <button className="pp-button-primary w-full sm:w-fit" disabled={isSaving || isLoading} type="submit">
            {isSaving ? "Guardando..." : "Guardar preferencias"}
          </button>
          <p className="text-xs text-finance-muted">
            La moneda principal se guarda para futuras vistas consolidadas; por ahora no convierte montos automaticamente.
          </p>
        </div>
      </form>
    </section>
  );
}

function StatusMessage({ message }: { message: Message }) {
  const styles = {
    success: "border-green-200 bg-green-50 text-green-800",
    error: "border-red-200 bg-red-50 text-red-800",
    info: "border-slate-200 bg-slate-50 text-slate-700",
  };

  return <p className={`mt-4 rounded-md border px-3 py-2 text-sm ${styles[message.type]}`}>{message.text}</p>;
}
