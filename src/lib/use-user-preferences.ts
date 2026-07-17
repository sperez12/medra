"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_CURRENCY, normalizeCurrency } from "@/lib/currencies";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { DEFAULT_DASHBOARD_PERIOD, DEFAULT_DATE_FORMAT, isMissingPreferencesTableError } from "@/lib/user-preferences";
import type { UserDashboardPeriodPreference, UserDateFormatPreference, UserPreference } from "@/types/finance";

type UserPreferenceState = {
  displayName: string | null;
  preferredCurrency: string;
  dateFormat: UserDateFormatPreference;
  defaultDashboardPeriod: UserDashboardPeriodPreference;
  isLoaded: boolean;
};

const fallbackPreferences: UserPreferenceState = {
  displayName: null,
  preferredCurrency: DEFAULT_CURRENCY,
  dateFormat: DEFAULT_DATE_FORMAT,
  defaultDashboardPeriod: DEFAULT_DASHBOARD_PERIOD,
  isLoaded: false,
};

export function useUserPreferences() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [preferences, setPreferences] = useState<UserPreferenceState>(fallbackPreferences);

  useEffect(() => {
    let isMounted = true;

    async function loadPreferences() {
      if (!supabase) {
        if (isMounted) {
          setPreferences({ ...fallbackPreferences, isLoaded: true });
        }
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        if (isMounted) {
          setPreferences({ ...fallbackPreferences, isLoaded: true });
        }
        return;
      }

      const { data, error } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", userData.user.id)
        .maybeSingle<UserPreference>();

      if (!isMounted) return;

      if (error) {
        setPreferences({ ...fallbackPreferences, isLoaded: true });
        if (!isMissingPreferencesTableError(error.message)) {
          console.warn("No se pudieron cargar preferencias de usuario.", error.message);
        }
        return;
      }

      setPreferences({
        displayName: data?.display_name?.trim() || null,
        preferredCurrency: normalizeCurrency(data?.preferred_currency),
        dateFormat: data?.date_format ?? DEFAULT_DATE_FORMAT,
        defaultDashboardPeriod: data?.default_dashboard_period ?? DEFAULT_DASHBOARD_PERIOD,
        isLoaded: true,
      });
    }

    loadPreferences();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  return preferences;
}
