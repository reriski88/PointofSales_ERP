import { AdminNav, CashierBoundaryNotice } from "../_components/admin-nav";
import { UnitsClient } from "./units-client";

export default function AdminUnitsPage() {
  return (
    <main className="min-h-screen bg-background">
      <AdminNav />
      <section className="admin-content space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        <CashierBoundaryNotice />
        <UnitsClient />
      </section>
    </main>
  );
}
