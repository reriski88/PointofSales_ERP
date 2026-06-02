import { AdminNav, CashierBoundaryNotice } from "../_components/admin-nav";
import { InventoryClient } from "../inventory/inventory-client";

export default function AdminSuppliersPage() {
  return (
    <main className="min-h-screen bg-background">
      <AdminNav />
      <section className="admin-content space-y-6 px-6 py-8">
        <CashierBoundaryNotice />
        <InventoryClient mode="suppliers" />
      </section>
    </main>
  );
}
