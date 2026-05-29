import { AdminNav, CashierBoundaryNotice } from "../_components/admin-nav";
import { ProfileClient } from "./profile-client";

export default function AdminProfilePage() {
  return (
    <main className="min-h-screen bg-background">
      <AdminNav />
      <section className="admin-content space-y-6 px-6 py-8">
        <CashierBoundaryNotice />
        <ProfileClient />
      </section>
    </main>
  );
}
