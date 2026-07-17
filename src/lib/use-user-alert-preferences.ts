"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_ALERT_PREFERENCES,
  isMissingAlertPreferencesTableError,
  normalizeAlertPreferences,
  type AlertPreferenceValues,
} from "@/lib/financial-alerts";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { UserAlertPreference } from "@/types/finance";

type UserAlertPreferenceState = {
  alertPreferences: AlertPreferenceValues;
  isLoaded: boolean;
  needsMigration: boolean;
};

const fallbackAlertPreferenceState: UserAlertPreferenceState = {
  alertPreferences: DEFAULT_ALERT_PREFERENCES,
  isLoaded: false,
  needsMigration: false,
};

export function useUserAlertPreferences() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [state, setState] = useState<UserAlertPreferenceState>(fallbackAlertPreferenceState);

  useEffect(() => {
    let isMounted = true;

    async function loadAlertPreferences() {
      if (!supabase) {
        if (isMounted) {
          setState({ ...fallbackAlertPreferenceState, isLoaded: true });
        }
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        if (isMounted) {
          setState({ ...fallbackAlertPreferenceState, isLoaded: true });
        }
        return;
      }

      const { data, error } = await supabase
        .from("user_alert_preferences")
        .select("*")
        .eq("user_id", userData.user.id)
        .maybeSingle<UserAlertPreference>();

      if (!isMounted) return;

      if (error) {
        const missingTable = isMissingAlertPreferencesTableError(error.message);

        setState({
          alertPreferences: DEFAULT_ALERT_PREFERENCES,
          isLoaded: true,
          needsMigration: missingTable,
        });

        if (!missingTable) {
          console.warn("No se pudieron cargar preferencias de alertas.", error.message);
        }
        return;
      }

      setState({
        alertPreferences: normalizeAlertPreferences(data),
        isLoaded: true,
        needsMigration: false,
      });
    }

    loadAlertPreferences();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  return state;
}
