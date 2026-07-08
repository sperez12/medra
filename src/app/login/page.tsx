import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <AppShell requireAuth={false}>
      <div className="mx-auto max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-950">Iniciar sesion</h1>
        <p className="mt-2 text-sm text-slate-600">
          Usa tu correo para recibir un enlace de acceso seguro con Supabase.
        </p>
        <Suspense fallback={<p className="mt-6 text-sm text-slate-600">Preparando login...</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </AppShell>
  );
}
