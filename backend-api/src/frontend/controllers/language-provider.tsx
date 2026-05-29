"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

export type AppLanguage = "id";

type Dictionary = Record<string, string>;
type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (key: string) => string;
};

const dictionary: Dictionary = {
  dashboard: "Dashboard",
  cashier: "Kasir",
  outlets: "Outlet",
  usersCashiers: "User",
  roleAccess: "Setting Role Akses",
  products: "Produk",
  inventory: "Inventory",
  reports: "Laporan",
  financialReports: "Laporan Keuangan",
  financialReportsDesc: "Lihat dan export laporan keuangan per jenis laporan, bukan digabung dalam satu file.",
  financialLoading: "Memuat laporan keuangan...",
  financialLoadFailed: "Gagal memuat laporan keuangan. Pastikan akun memiliki akses outlet.",
  exportSelectedReport: "Export Laporan Ini",
  receipt: "Struk",
  profile: "Profil",
  menuGroupOperations: "Operasional",
  menuGroupMasterData: "Master Data",
  menuGroupMonitoring: "Monitoring",
  menuGroupSettings: "Pengaturan Aplikasi",
  backendDashboard: "Backend Dashboard",
  adminConsole: "Admin Console",
  logout: "Keluar",
  loggingOut: "Keluar...",
  boundaryNotice:
    "Transaksi kasir, shift, sync offline, dan penjualan harian bisa dijalankan dari menu Kasir web atau APK Flutter. Dashboard ini tetap dipakai untuk master data, monitoring laporan, audit, dan konfigurasi backend.",
  operationalStats: "Statistik Operasional",
  operationalStatsDesc: "Ringkasan data real-time dari outlet, produk, user, dan penjualan hari ini.",
  loadingStats: "Memuat statistik dashboard...",
  dashboardStatsError: "Statistik dashboard belum bisa dimuat.",
  activeOutlets: "Outlet Aktif",
  productsSku: "Produk / SKU",
  activeUsers: "User Aktif",
  netSalesToday: "Net Sales Hari Ini",
  transactions: "transaksi",
  salesChart: "Grafik Penjualan",
  salesChartDesc: "Pilih mode dan range grafik net sales dari semua outlet.",
  loadingSalesChart: "Memuat grafik penjualan...",
  daily: "Harian",
  weekly: "Mingguan",
  monthly: "Bulanan",
  yearly: "Tahunan",
  fromDate: "Dari Tanggal",
  toDate: "Sampai Tanggal",
  month: "Bulan",
  year: "Tahun",
  startYear: "Tahun Awal",
  endYear: "Tahun Akhir",
  apply: "Terapkan",
  period: "periode",
  noSalesChartData: "Belum ada data penjualan untuk range ini.",
  topProductsByOutlet: "Produk Terlaris per Outlet",
  topProductsDesc: "Top 5 SKU berdasarkan jumlah terjual dari transaksi selesai.",
  loadingTopProducts: "Memuat produk terlaris...",
  noActiveOutlets: "Belum ada outlet aktif untuk ditampilkan.",
  sold: "terjual",
  noProductsSold: "Belum ada produk terjual di outlet ini.",
  operationalAlerts: "Alert Operasional",
  operationalAlertsDesc: "Notifikasi outlet tutup, stok hampir habis, dan stok kosong.",
  loadingAlerts: "Memuat alert operasional...",
  closedOutlets: "Outlet Tutup",
  lowStock: "Stok Hampir Habis",
  emptyStock: "Stok Kosong",
  noClosedOutlets: "Tidak ada outlet aktif yang terdeteksi tutup.",
  noLowStock: "Tidak ada stok hampir habis.",
  noEmptyStock: "Tidak ada stok kosong.",
  stock: "stok",
  min: "min",
  alert: "alert",
  allOutlets: "Semua Outlet",
  activeOutlet: "Outlet Aktif",
  outletRequired: "Pilih outlet aktif terlebih dahulu.",
  exportFinancialReport: "Export Laporan Keuangan",
  exporting: "Mengekspor...",
  financialExportTitle: "Export laporan keuangan UMKM",
  financialExportDenied: "Akses export belum diizinkan",
  financialExportDeniedDesc: "Aktifkan permission Export pada menu Laporan untuk role ini.",
  financialExportSuccess: "Laporan keuangan berhasil diexport",
  financialExportSuccessDesc:
    "Workbook Excel berisi ringkasan, laba rugi, arus kas, neraca, ekuitas, dan detail transaksi.",
  financialSingleExportSuccessDesc: "File Excel dibuat untuk tab laporan yang sedang dipilih.",
  financialExportFailed: "Laporan keuangan gagal diexport",
  financialExportFailedDesc: "Coba refresh laporan atau periksa akses outlet.",
  profitLossDesc: "Pendapatan, HPP, laba kotor, waste, dan laba operasional sederhana.",
  balanceSheetDesc: "Aset kas, persediaan, kewajiban, dan ekuitas versi sederhana dari data POS.",
  cashFlowDesc: "Ringkasan kas masuk berdasarkan metode pembayaran transaksi selesai.",
  equityChangesDesc:
    "Perubahan modal dari laba periode. Modal tambahan dan prive masih disiapkan untuk modul berikutnya.",
  notesDesc: "Catatan asumsi perhitungan laporan keuangan.",
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const value = useMemo<LanguageContextValue>(
    () => ({
      language: "id",
      setLanguage: () => undefined,
      t: (key: string) => dictionary[key] ?? key,
    }),
    [],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return context;
}
