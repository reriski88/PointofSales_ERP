import { AdminNav } from "../_components/admin-nav";
import { CashierClient } from "./cashier-client";

export default function AdminCashierPage() {
  return (
    <main className="min-h-screen bg-background">
      <AdminNav />
      <section className="admin-content space-y-4 px-4 py-4 sm:space-y-6 sm:px-6 sm:py-8">
        <CashierClient />
      </section>
    </main>
  );
}
