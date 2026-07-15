"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AuthButton() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
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
      <span className="text-sm text-slate-600">{email}</span>
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
