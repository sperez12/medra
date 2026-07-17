"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const nextPath = getSafeNextPath(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function redirectIfAuthenticated() {
      if (!supabase) {
        if (isMounted) {
          setIsCheckingSession(false);
        }
        return;
      }

      const [{ data: sessionData }, { data: userData }] = await Promise.all([
        supabase.auth.getSession(),
        supabase.auth.getUser(),
      ]);

      if (sessionData.session || userData.user) {
        router.replace(nextPath);
        return;
      }

      if (isMounted) {
        setIsCheckingSession(false);
      }
    }

    redirectIfAuthenticated();

    if (!supabase) {
      return () => {
        isMounted = false;
      };
    }

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        router.replace(nextPath);
      }
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, [nextPath, router, supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage("");

    if (!supabase) {
      setIsLoading(false);
      setMessage("Falta configurar Supabase. Revisa el archivo .env.local y vuelve a intentar.");
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}${nextPath}`,
      },
    });

    setIsLoading(false);
    setMessage(
      error
        ? `No se pudo enviar el enlace: ${error.message}`
        : "Listo. Revisa tu correo y abre el enlace para entrar."
    );
  }

  if (isCheckingSession) {
    return <p className="mt-6 rounded-xl bg-finance-mist p-3 text-sm text-finance-muted">Revisando tu sesion...</p>;
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Correo</span>
        <input
          className="pp-input mt-1"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="tu-correo@ejemplo.com"
          required
          type="email"
          value={email}
        />
      </label>
      <button
        className="pp-button-primary w-full"
        disabled={isLoading}
        type="submit"
      >
        {isLoading ? "Enviando..." : "Enviar enlace de acceso"}
      </button>
      {message ? <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">{message}</p> : null}
    </form>
  );
}

function getSafeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }

  return next;
}
