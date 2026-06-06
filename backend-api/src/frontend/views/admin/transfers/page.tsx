import { AdminNav, CashierBoundaryNotice } from "../_components/admin-nav";
import { InventoryClient } from "../inventory/inventory-client";

export default function AdminTransfersPage() {
  return (
    <main className="min-h-screen bg-background">
      <AdminNav />
      <section className="admin-content space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        <CashierBoundaryNotice />
        <InventoryClient mode="transfers" />
      </section>
    </main>
  );
}

