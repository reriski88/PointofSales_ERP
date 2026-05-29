"use client";

import Link from "next/link";
import { BarChart3, Boxes, Building2, Calculator, FileSpreadsheet, PackageSearch, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRolePermissions } from "./_components/use-role-permissions";
import type { RoleAccessMenuKey } from "@/lib/role-access";

type DashboardModuleKey = Extract<
  RoleAccessMenuKey,
  "cashier" | "outlets" | "users" | "products" | "inventory" | "reports" | "financialReports"
>;

const modules: Array<{
  href: string;
  title: string;
  text: string;
  icon: React.ComponentType<{ className?: string }>;
  menuKey: DashboardModuleKey;
}> = [
  {
    href: "/admin/cashier",
    title: "Kasir",
    text: "Buka shift, transaksi penjualan, input remahan, sync offline, dan lihat laporan harian.",
    icon: Calculator,
    menuKey: "cashier",
  },
  {
    href: "/admin/outlets",
    title: "Outlet",
    text: "Tambah outlet, pantau cabang, dan pisahkan laporan tiap lokasi.",
    icon: Building2,
    menuKey: "outlets",
  },
  {
    href: "/admin/users",
    title: "User / Kasir",
    text: "Buat kasir, admin outlet, gudang, auditor, dan atur akses outlet.",
    icon: Users,
    menuKey: "users",
  },
  {
    href: "/admin/products",
    title: "Produk",
    text: "Buat produk, SKU, harga, HPP, satuan dasar, dan satuan jual.",
    icon: Boxes,
    menuKey: "products",
  },
  {
    href: "/admin/inventory",
    title: "Inventory",
    text: "Monitoring stok produk masing-masing outlet dan mutasi terakhir.",
    icon: PackageSearch,
    menuKey: "inventory",
  },
  {
    href: "/admin/reports",
    title: "Laporan",
    text: "Lihat sales, inventory, gross profit, dan remahan/waste.",
    icon: BarChart3,
    menuKey: "reports",
  },
  {
    href: "/admin/financial-reports",
    title: "Laporan Keuangan",
    text: "Lihat laba rugi, arus kas, neraca, dan perubahan ekuitas.",
    icon: FileSpreadsheet,
    menuKey: "financialReports",
  },
];

export function DashboardModules() {
  const dashboard = useRolePermissions("dashboard");
  const cashier = useRolePermissions("cashier");
  const outlets = useRolePermissions("outlets");
  const users = useRolePermissions("users");
  const products = useRolePermissions("products");
  const inventory = useRolePermissions("inventory");
  const reports = useRolePermissions("reports");
  const financialReports = useRolePermissions("financialReports");
  const accessByMenu = {
    cashier,
    outlets,
    users,
    products,
    inventory,
    reports,
    financialReports,
  } satisfies Record<DashboardModuleKey, { canView: boolean }>;
  const visibleModules = modules.filter(
    (item) => accessByMenu[item.menuKey]?.canView,
  );

  if (!dashboard.canView || (!visibleModules.length && dashboard.isLoading)) {
    return null;
  }

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {visibleModules.map((item) => (
        <div key={item.href} className="rounded-lg border p-4">
          <item.icon className="mb-3 h-5 w-5 text-primary" />
          <p className="font-medium">{item.title}</p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground sm:min-h-16">
            {item.text}
          </p>
          <Button
            asChild
            className="mt-4 w-full"
            variant={item.href === "/admin/products" ? "default" : "secondary"}
          >
            <Link href={item.href}>Buka</Link>
          </Button>
        </div>
      ))}
    </div>
  );
}
