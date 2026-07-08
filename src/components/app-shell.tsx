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
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/" className="text-2xl font-bold tracking-tight text-slate-950">
              Patrimonio Personal
            </Link>
            <AuthButton />
          </div>
          <SiteNavigation />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">
        {requireAuth ? <AuthGuard>{children}</AuthGuard> : children}
      </main>
    </div>
  );
}
