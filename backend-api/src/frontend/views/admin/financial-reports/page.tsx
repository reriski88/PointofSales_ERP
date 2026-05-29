import { AdminNav, CashierBoundaryNotice } from "../_components/admin-nav";
import { FinancialReportsClient } from "./financial-reports-client";

export default function FinancialReportsPage() {
  return (
    <main className="min-h-screen bg-background">
      <AdminNav />
      <section className="admin-content space-y-6 px-6 py-8">
        <CashierBoundaryNotice />
        <FinancialReportsClient />
      </section>
    </main>
  );
}
