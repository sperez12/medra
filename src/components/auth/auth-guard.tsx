"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthGuardProps = {
  children: React.ReactNode;
};

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [status, setStatus] = useState<"checking" | "ready" | "missing-config">(
    "checking"
  );

  useEffect(() => {
    async function checkSession() {
      if (!supabase) {
        setStatus("missing-config");
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      setStatus("ready");
    }

    checkSession();
  }, [pathname, router, supabase]);

  if (status === "checking") {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
        Revisando tu sesion...
      </div>
    );
  }

  if (status === "missing-config") {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-900">
        Falta configurar Supabase en el archivo .env.local.
      </div>
    );
  }

  return children;
}
