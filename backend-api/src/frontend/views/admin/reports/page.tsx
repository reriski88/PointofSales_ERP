import { AdminNav, CashierBoundaryNotice } from "../_components/admin-nav";
import { ReportsClient } from "./reports-client";

export default function AdminReportsPage() {
  return (
    <main className="min-h-screen bg-background">
      <AdminNav />
      <section className="admin-content space-y-6 px-6 py-8">
        <CashierBoundaryNotice />
        <ReportsClient />
      </section>
    </main>
  );
}
