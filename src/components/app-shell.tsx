import Link from "next/link";
import { AuthButton } from "@/components/auth/auth-button";
import { AuthGuard } from "@/components/auth/auth-guard";
import { BrandMark } from "@/components/brand/brand-mark";
import { SiteNavigation } from "@/components/site-navigation";
import { BRAND } from "@/lib/brand";

type AppShellProps = {
  children: React.ReactNode;
  requireAuth?: boolean;
};

export function AppShell({ children, requireAuth = true }: AppShellProps) {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <header className="border-b border-finance-line/80 bg-white/90 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl min-w-0 flex-col gap-4 px-4 py-5 sm:px-6">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <BrandMark className="h-[3.35rem] w-[3.35rem] shrink-0" />
              <div className="min-w-0">
                <Link href="/" className="pp-display min-w-0 break-words text-[2rem] leading-[0.9]">
                  {BRAND.visibleName}
                </Link>
                <p className="mt-1.5 text-xs font-medium leading-tight text-brand-700">
                  {BRAND.slogan}
                </p>
                <p className="sr-only">{BRAND.technicalName}</p>
              </div>
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
