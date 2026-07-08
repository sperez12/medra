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
        className="w-fit rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
      >
        Iniciar sesion
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:items-end">
      <span className="text-sm text-slate-600">{email}</span>
      <button
        className="w-fit rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-teal-500 hover:text-teal-700"
        onClick={handleLogout}
        type="button"
      >
        Cerrar sesion
      </button>
    </div>
  );
}
