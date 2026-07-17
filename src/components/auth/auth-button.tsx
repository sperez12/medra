"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isMissingPreferencesTableError } from "@/lib/user-preferences";
import type { UserPreference } from "@/types/finance";

export function AuthButton() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      return;
    }
    const client = supabase;

    async function loadUser() {
      const { data } = await client.auth.getUser();
      const user = data.user;
      setEmail(user?.email ?? null);

      if (!user) {
        setDisplayName(null);
        return;
      }

      const { data: preferences, error } = await client
        .from("user_preferences")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle<Pick<UserPreference, "display_name">>();

      if (error && !isMissingPreferencesTableError(error.message)) {
        return;
      }

      setDisplayName(preferences?.display_name?.trim() || null);
    }

    loadUser();

    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
      if (!session?.user) {
        setDisplayName(null);
        return;
      }

      loadUser();
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleLogout() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setEmail(null);
    setDisplayName(null);
    router.push("/login");
    router.refresh();
  }

  if (!email) {
    return (
      <Link
        href="/login"
        className="pp-button-primary w-fit"
      >
        Iniciar sesion
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:items-end">
      <span className="break-words text-sm font-medium text-slate-700">{displayName || email}</span>
      {displayName ? <span className="break-words text-xs text-slate-500">{email}</span> : null}
      <button
        className="pp-button-secondary w-fit"
        onClick={handleLogout}
        type="button"
      >
        Cerrar sesion
      </button>
    </div>
  );
}
