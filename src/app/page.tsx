import { AppShell } from "@/components/app-shell";
import { DashboardSummary } from "@/components/dashboard/dashboard-summary";

export default function HomePage() {
  return (
    <AppShell>
      <DashboardSummary />
    </AppShell>
  );
}
