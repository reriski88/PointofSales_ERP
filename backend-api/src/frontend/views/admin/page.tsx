import { AdminNav } from "./_components/admin-nav";
import { AdminHomeClient } from "./admin-home-client";

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-background">
      <AdminNav />
      <section className="admin-content space-y-4 px-4 py-4 sm:space-y-6 sm:px-6 sm:py-8">
        <AdminHomeClient />
      </section>
    </main>
  );
}
