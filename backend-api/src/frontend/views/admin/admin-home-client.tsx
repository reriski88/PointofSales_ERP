"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { CashierBoundaryNotice } from "./_components/admin-nav";
import { DashboardClient } from "./dashboard-client";
import type { RoleAccessAction, RoleAccessMenuKey } from "@/lib/role-access";

type CurrentAccessResponse = {
  data: {
    permissions: Record<RoleAccessMenuKey, RoleAccessAction[]>;
  };
};

const routeOrder: Array<{ menuKey: RoleAccessMenuKey; href: string }> = [
  { menuKey: "dashboard", href: "/admin" },
  { menuKey: "cashier", href: "/admin/cashier" },
  { menuKey: "outlets", href: "/admin/outlets" },
  { menuKey: "users", href: "/admin/users" },
  { menuKey: "products", href: "/admin/products" },
  { menuKey: "customers", href: "/admin/customers" },
  { menuKey: "inventory", href: "/admin/inventory" },
  { menuKey: "stockOpname", href: "/admin/stock-opname" },
  { menuKey: "suppliers", href: "/admin/suppliers" },
  { menuKey: "purchases", href: "/admin/purchases" },
  { menuKey: "reports", href: "/admin/reports" },
  { menuKey: "financialReports", href: "/admin/financial-reports" },
  { menuKey: "receipt", href: "/admin/receipt" },
  { menuKey: "profile", href: "/admin/profile" },
];

export function AdminHomeClient() {
  const [permissions, setPermissions] =
    useState<Record<RoleAccessMenuKey, RoleAccessAction[]> | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const canViewDashboard = permissions?.dashboard?.includes("view") ?? false;

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentAccess() {
      const response = await fetch("/api/role-access/me");
      if (response.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      if (!response.ok) {
        setPermissions(null);
        return;
      }

      const json = (await response.json()) as CurrentAccessResponse;
      if (cancelled) return;
      setPermissions(json.data.permissions);

      if (!json.data.permissions.dashboard?.includes("view")) {
        const firstAllowedRoute = routeOrder.find((route) =>
          json.data.permissions[route.menuKey]?.includes("view"),
        );
        setIsRedirecting(true);
        window.location.replace(firstAllowedRoute?.href ?? "/admin/profile");
      }
    }

    void loadCurrentAccess();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!permissions || !canViewDashboard) {
    return (
      <div className="flex min-h-40 items-center gap-3 rounded-lg border bg-card p-4 text-sm text-muted-foreground shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        {isRedirecting ? "Mengalihkan ke modul yang diizinkan..." : "Memuat akses dashboard..."}
      </div>
    );
  }

  return <DashboardClient />;
}
