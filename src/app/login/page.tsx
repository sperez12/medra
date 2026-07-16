import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { LoginForm } from "@/components/auth/login-form";
import { BrandMark } from "@/components/brand/brand-mark";
import { BRAND } from "@/lib/brand";

export default function LoginPage() {
  return (
    <AppShell requireAuth={false}>
      <div className="mx-auto max-w-md pp-card p-6 sm:p-7">
        <div className="flex items-center gap-4">
          <BrandMark className="h-14 w-14 shrink-0" />
          <div>
            <p className="pp-display text-[2.15rem] leading-[0.9]">{BRAND.visibleName}</p>
            <p className="mt-1.5 text-sm font-medium leading-tight text-brand-700">{BRAND.slogan}</p>
          </div>
        </div>
        <h1 className="mt-7 text-2xl font-semibold text-finance-ink">Iniciar sesion</h1>
        <p className="mt-2 text-sm text-finance-muted">
          Usa tu correo para recibir un enlace de acceso seguro y revisar tu patrimonio con calma.
        </p>
        <Suspense fallback={<p className="mt-6 text-sm text-slate-600">Preparando login...</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </AppShell>
  );
}
