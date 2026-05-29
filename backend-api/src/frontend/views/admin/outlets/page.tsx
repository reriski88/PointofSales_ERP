import { AdminNav, CashierBoundaryNotice } from "../_components/admin-nav";
import { OutletsClient } from "./outlets-client";

export default function AdminOutletsPage() {
  return (
    <main className="min-h-screen bg-background">
      <AdminNav />
      <section className="admin-content space-y-6 px-6 py-8">
        <CashierBoundaryNotice />
        
        <OutletsClient />
      </section>
    </main>
  );
}
