import { AdminNav, CashierBoundaryNotice } from "../_components/admin-nav";
import { ProductsClient } from "./products-client";

export default function AdminProductsPage() {
  return (
    <main className="min-h-screen bg-background">
      <AdminNav />
      <section className="admin-content space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        <CashierBoundaryNotice />
        <ProductsClient />
      </section>
    </main>
  );
}

