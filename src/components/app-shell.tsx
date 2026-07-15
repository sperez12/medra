import Link from "next/link";
import { AuthButton } from "@/components/auth/auth-button";
import { AuthGuard } from "@/components/auth/auth-guard";
import { SiteNavigation } from "@/components/site-navigation";

type AppShellProps = {
  children: React.ReactNode;
  requireAuth?: boolean;
};

export function AppShell({ children, requireAuth = true }: AppShellProps) {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <header className="border-b border-slate-200/80 bg-white/90 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl min-w-0 flex-col gap-4 px-4 py-5 sm:px-6">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <Link href="/" className="min-w-0 break-words text-2xl font-bold tracking-tight text-slate-950">
                Patrimonio Personal
              </Link>
              <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Finanzas personales
              </p>
            </div>
            <AuthButton />
          </div>
          <SiteNavigation />
        </div>
      </header>
      <main className="mx-auto max-w-7xl min-w-0 overflow-x-hidden px-4 py-8 sm:px-6">
        {requireAuth ? <AuthGuard>{children}</AuthGuard> : children}
      </main>
    </div>
  );
}
