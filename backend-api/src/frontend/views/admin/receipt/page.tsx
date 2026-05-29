import { AdminNav, CashierBoundaryNotice } from "../_components/admin-nav";
import { ReceiptLayoutClient } from "./receipt-layout-client";

export default function AdminReceiptPage() {
  return (
    <main className="min-h-screen bg-background">
      <AdminNav />
      <section className="admin-content space-y-6 px-6 py-8">
        <CashierBoundaryNotice />
        <ReceiptLayoutClient />
      </section>
    </main>
  );
}
