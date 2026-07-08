import { AppShell } from "@/components/app-shell";

type PlaceholderPageProps = {
  title: string;
  description: string;
};

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <AppShell>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-950">{title}</h1>
        <p className="mt-3 max-w-2xl text-slate-600">{description}</p>
      </div>
    </AppShell>
  );
}
