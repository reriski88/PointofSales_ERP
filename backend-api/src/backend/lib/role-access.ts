import type { AppRole } from "@/db/schema";

export type RoleAccessAction = "view" | "create" | "edit" | "delete" | "approve" | "export";
export type RoleAccessMenuKey =
  | "dashboard"
  | "cashier"
  | "outlets"
  | "users"
  | "roleAccess"
  | "products"
  | "customers"
  | "promotions"
  | "inventory"
  | "stockOpname"
  | "suppliers"
  | "purchases"
  | "reports"
  | "financialReports"
  | "receipt"
  | "profile";
export type RoleAccessMap = Record<AppRole, Record<RoleAccessMenuKey, RoleAccessAction[]>>;

export const roleAccessActions: Array<{ key: RoleAccessAction; label: string; description: string }> = [
  { key: "view", label: "Lihat", description: "Boleh membuka menu dan melihat data." },
  { key: "create", label: "Tambah", description: "Boleh membuat data atau transaksi baru." },
  { key: "edit", label: "Edit", description: "Boleh mengubah data yang sudah ada." },
  { key: "delete", label: "Hapus", description: "Boleh menghapus atau menonaktifkan data." },
  { key: "approve", label: "Approve", description: "Boleh menyetujui proses yang butuh persetujuan." },
  { key: "export", label: "Export", description: "Boleh mengunduh laporan atau data." },
];

export const roleAccessMenus: Array<{
  key: RoleAccessMenuKey;
  label: string;
  description: string;
  actions: RoleAccessAction[];
}> = [
  { key: "dashboard", label: "Dashboard", description: "Ringkasan performa outlet, penjualan, stok, dan alert operasional.", actions: ["view", "export"] },
  { key: "cashier", label: "Kasir", description: "Transaksi kasir web, buka/tutup shift, dan input remahan. Sync offline dipakai kasir mobile.", actions: ["view", "create", "edit"] },
  { key: "outlets", label: "Outlet", description: "Master outlet, status outlet, alamat, kode, dan logo outlet.", actions: ["view", "create", "edit", "delete"] },
  { key: "users", label: "User", description: "Kelola user, role, status aktif, dan akses outlet user.", actions: ["view", "create", "edit", "delete"] },
  { key: "roleAccess", label: "Setting Role Akses", description: "Atur permission setiap role. Menu ini hanya untuk Owner.", actions: ["view", "edit"] },
  { key: "products", label: "Produk", description: "Master produk, SKU, harga, tipe jual, satuan stok, dan satuan jual kasir.", actions: ["view", "create", "edit", "delete"] },
  { key: "customers", label: "Pelanggan", description: "Master pelanggan, histori pembelian, loyalty, dan piutang pelanggan.", actions: ["view", "create", "edit", "delete", "export"] },
  { key: "promotions", label: "Pajak & Promo", description: "Master promo, voucher, aturan diskon, pajak otomatis, service charge, dan jadwal promo.", actions: ["view", "create", "edit", "delete"] },
  { key: "inventory", label: "Inventory", description: "Monitoring stok, stok masuk, adjustment, mutasi stok, dan approval stok.", actions: ["view", "create", "edit", "approve", "export"] },
  { key: "stockOpname", label: "Stock Opname", description: "Generate daftar hitung, input hasil fisik, approval selisih, dan posting adjustment stock opname.", actions: ["view", "create", "edit", "approve", "export"] },
  { key: "suppliers", label: "Supplier", description: "Master supplier/pemasok untuk pembelian barang dan hutang supplier.", actions: ["view", "create", "edit", "delete"] },
  { key: "purchases", label: "Pembelian", description: "Pesanan pembelian, penerimaan barang, stok masuk dari supplier, dan pembayaran supplier.", actions: ["view", "create", "edit", "approve", "export"] },
  { key: "reports", label: "Laporan", description: "Laporan penjualan, inventory, pembayaran, dan remahan operasional.", actions: ["view", "export"] },
  { key: "financialReports", label: "Laporan Keuangan", description: "Laba rugi, neraca, arus kas, perubahan ekuitas, catatan, dan export per tab.", actions: ["view", "create", "export"] },
  { key: "receipt", label: "Struk", description: "Pengaturan layout dan identitas struk transaksi.", actions: ["view", "edit"] },
  { key: "profile", label: "Profil", description: "Melihat dan mengubah profil akun sendiri.", actions: ["view", "edit"] },
];

export const appRoles: AppRole[] = [
  "superadmin",
  "cashier",
  "warehouse",
  "auditor",
  "admin_outlet",
  "owner",
];

export const roleLabels: Record<AppRole, string> = {
  superadmin: "Superadmin",
  cashier: "Kasir",
  warehouse: "Staff Gudang",
  auditor: "Auditor",
  admin_outlet: "Admin Outlet",
  owner: "Owner",
};

export const roleDescriptions: Record<AppRole, string> = {
  superadmin: "IT Support yang mengelola seluruh tenant, langganan, dan sistem.",
  owner: "Akses penuh seluruh aplikasi, termasuk role akses dan semua outlet.",
  admin_outlet: "Mengelola operasional outlet, produk, user outlet, inventory, kasir, dan laporan.",
  auditor: "Melihat dashboard, master data, inventory, dan laporan tanpa mengubah operasional.",
  warehouse: "Fokus pada produk dan inventory: stok masuk, adjustment, dan monitoring stok.",
  cashier: "Fokus transaksi kasir, shift, pembayaran, dan profil sendiri. Sync offline dipakai kasir mobile.",
};

export const defaultRoleAccess: RoleAccessMap = {
  superadmin: allMenusAllActions(),
  owner: allMenusAllActions(),
  admin_outlet: access({
    dashboard: ["view", "export"],
    cashier: ["view", "create", "edit"],
    outlets: ["view", "create", "edit"],
    users: ["view", "create", "edit"],
    roleAccess: [],
    products: ["view", "create", "edit"],
    customers: ["view", "create", "edit", "export"],
    promotions: ["view", "create", "edit", "delete"],
    inventory: ["view", "create", "edit", "approve", "export"],
    stockOpname: ["view", "create", "edit", "approve", "export"],
    suppliers: ["view", "create", "edit"],
    purchases: ["view", "create", "edit", "approve", "export"],
    reports: ["view", "export"],
    financialReports: ["view", "create", "export"],
    receipt: ["view", "edit"],
    profile: ["view", "edit"],
  }),
  auditor: access({
    dashboard: ["view", "export"],
    cashier: [],
    outlets: ["view"],
    users: [],
    roleAccess: [],
    products: ["view"],
    customers: ["view", "export"],
    promotions: ["view"],
    inventory: ["view", "export"],
    stockOpname: ["view", "export"],
    suppliers: ["view"],
    purchases: ["view", "export"],
    reports: ["view", "export"],
    financialReports: ["view", "export"],
    receipt: ["view"],
    profile: ["view", "edit"],
  }),
  warehouse: access({
    dashboard: ["view"],
    cashier: [],
    outlets: ["view"],
    users: [],
    roleAccess: [],
    products: ["view"],
    customers: ["view"],
    promotions: [],
    inventory: ["view", "create", "edit"],
    stockOpname: ["view", "create", "edit"],
    suppliers: ["view"],
    purchases: ["view", "create", "edit"],
    reports: [],
    financialReports: [],
    receipt: [],
    profile: ["view", "edit"],
  }),
  cashier: access({
    dashboard: [],
    cashier: ["view", "create", "edit"],
    outlets: [],
    users: [],
    roleAccess: [],
    products: [],
    customers: ["view", "create"],
    promotions: [],
    inventory: [],
    stockOpname: [],
    suppliers: [],
    purchases: [],
    reports: [],
    financialReports: [],
    receipt: [],
    profile: ["view", "edit"],
  }),
};

export function normalizeRoleAccess(value: unknown): RoleAccessMap {
  const source = isObject(value) ? value : {};
  const normalized = structuredClone(defaultRoleAccess);

  for (const role of appRoles) {
    const roleValue = isObject(source[role]) ? source[role] : {};
    for (const menu of roleAccessMenus) {
      const roleMenuValue = roleValue[menu.key];
      const rawActions: unknown[] = Array.isArray(roleMenuValue)
        ? roleMenuValue
        : normalized[role][menu.key];
      normalized[role][menu.key] = rawActions.filter(
        (action): action is RoleAccessAction =>
          menu.actions.includes(action as RoleAccessAction),
      );
    }
  }

  normalized.owner = allMenusAllActions();
  for (const role of appRoles) {
    if (role !== "owner") {
      normalized[role].roleAccess = [];
    }
  }
  return normalized;
}

export function roleCanView(
  permissions: RoleAccessMap,
  role: AppRole,
  menu: RoleAccessMenuKey,
) {
  return permissions[role]?.[menu]?.includes("view") ?? false;
}

function allMenusAllActions() {
  return access(
    Object.fromEntries(
      roleAccessMenus.map((menu) => [menu.key, menu.actions]),
    ) as Record<RoleAccessMenuKey, RoleAccessAction[]>,
  );
}

function access(
  values: Partial<Record<RoleAccessMenuKey, RoleAccessAction[]>>,
) {
  return Object.fromEntries(
    roleAccessMenus.map((menu) => [
      menu.key,
      (values[menu.key] ?? []).filter((action) => menu.actions.includes(action)),
    ]),
  ) as Record<RoleAccessMenuKey, RoleAccessAction[]>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
