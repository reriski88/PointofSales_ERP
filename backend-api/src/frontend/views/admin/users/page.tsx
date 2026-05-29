import { AdminNav, CashierBoundaryNotice } from "../_components/admin-nav";
import { UsersClient } from "./users-client";

export default function AdminUsersPage() {
  return (
    <main className="min-h-screen bg-background">
      <AdminNav />
      <section className="admin-content space-y-6 px-6 py-8">
        <CashierBoundaryNotice />
        <UsersClient />
      </section>
    </main>
  );
}
