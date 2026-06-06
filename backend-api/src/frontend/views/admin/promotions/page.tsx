import { AdminNav, CashierBoundaryNotice } from "../_components/admin-nav";
import { PromotionsClient } from "./promotions-client";

export default function PromotionsPage() {
  return (
    <>
      <AdminNav />
      <section className="admin-content space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        <CashierBoundaryNotice />
        <PromotionsClient />
      </section>
    </>
  );
}

