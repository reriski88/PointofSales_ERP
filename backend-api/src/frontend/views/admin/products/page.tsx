import { AdminNav, CashierBoundaryNotice } from "../_components/admin-nav";
import { ProductsClient } from "./products-client";

export default function AdminProductsPage() {
  return (
    <main className="min-h-screen bg-background">
      <AdminNav />
      <section className="admin-content space-y-6 px-6 py-8">
        <CashierBoundaryNotice />
        <ProductsClient />
      </section>
    </main>
  );
}
