import { AdminNav, CashierBoundaryNotice } from "../_components/admin-nav";
import { PromotionsClient } from "./promotions-client";

export default function PromotionsPage() {
  return (
    <>
      <AdminNav />
      <section className="admin-content space-y-6 px-6 py-8">
        <CashierBoundaryNotice />
        <PromotionsClient />
      </section>
    </>
  );
}
