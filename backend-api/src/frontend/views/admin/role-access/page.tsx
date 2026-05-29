import { AdminNav, CashierBoundaryNotice } from "../_components/admin-nav";
import { RoleAccessClient } from "./role-access-client";

export default function RoleAccessPage() {
  return (
    <main className="min-h-screen bg-background">
      <AdminNav />
      <section className="admin-content space-y-6 px-6 py-8">
        <CashierBoundaryNotice />
        <RoleAccessClient />
      </section>
    </main>
  );
}
