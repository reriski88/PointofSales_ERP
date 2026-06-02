import { AdminNav, CashierBoundaryNotice } from "../_components/admin-nav";
import { CustomersClient } from "./customers-client";

export default function AdminCustomersPage() {
  return (
    <main className="min-h-screen bg-background">
      <AdminNav />
      <section className="admin-content space-y-6 px-6 py-8">
        <CashierBoundaryNotice />
        <CustomersClient />
      </section>
    </main>
  );
}
