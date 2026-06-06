"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import Swal from "sweetalert2";
import {
  BarChart3,
  Ban,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Eye,
  HandCoins,
  PackageMinus,
  Printer,
  ReceiptText,
  Search,
  Undo2,
  Scale,
  TrendingUp,
  Wallet,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminModal } from "../_components/admin-modal";
import { printReceiptViaBrowser } from "../_components/receipt-browser-print";
import { pageItems } from "../_components/pagination-controls";
import { allOutletsValue, useSelectedOutlet } from "@/frontend/controllers/selected-outlet-provider";
import { getOutlets, getProfile } from "@/frontend/controllers/admin-data-cache";
import { useRealtimeEvents } from "@/frontend/controllers/use-realtime-events";

type Outlet = {
  id: string;
  name: string;
  code: string;
};

type ApiResponse<T> = { data: T };
type Profile = { role: string };

type SalesSummary = {
  transactionCount: number;
  grossSales: string;
  netSales: string;
  cogs: string;
  grossProfit: string;
};

type InventorySummary = {
  skuCount: number;
  totalOnHandBaseQty: string;
  criticalStockCount: number;
};

type WasteSummary = {
  adjustmentCount: number;
  totalQuantityBase: string;
  totalEstimatedLoss: string;
};

type SalesDetail = {
  id: string;
  outletName: string;
  outletLogoUrl: string | null;
  receiptNumber: string;
  status: string;
  source: string;
  cashierName: string | null;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  serviceChargeTotal: string;
  donationTotal: string;
  roundingTotal: string;
  cashTenderedTotal: string;
  changeTotal: string;
  grandTotal: string;
  cogsTotal: string;
  grossProfit: string;
  itemCount: number;
  paymentMethods: string;
  payments: Array<{
    method: string;
    amount: string;
    reference: string | null;
  }>;
  promotions: Array<{
    name: string;
    code: string | null;
    type: string;
    discountTotal: string;
  }>;
  items: Array<{
    skuId: string;
    skuCode: string | null;
    name: string;
    quantityInput: string;
    quantityBase: string;
    unitCode: string | null;
    baseUnitCode: string | null;
    unitPrice: string;
    discountTotal: string;
    lineTotal: string;
    voidWindowHours: number | null;
    refundWindowHours: number | null;
  }>;
  createdAt: string;
};
type SalesDetailItem = SalesDetail["items"][number];
type ReceiptSettings = {
  defaultOutletLogoUrl?: string | null;
  receiptLayout?: {
    autoPrint?: boolean;
    printerName?: string;
    paperWidth?: "58" | "80";
    header?: string[];
    body?: string[];
    footer?: string[];
    footerNote?: string;
  } | null;
};
type WasteDetail = {
  id: string;
  outletName: string;
  outletCode: string;
  skuName: string;
  skuCode: string;
  status: string;
  reason: string;
  quantityBase: string;
  unitCode: string;
  estimatedLoss: string;
  note: string | null;
  requestedByName: string | null;
  createdAt: string;
};

type SummaryTone = "sky" | "emerald" | "blue" | "amber" | "violet" | "rose";

export function ReportsClient() {
  const { selectedOutletId } = useSelectedOutlet();
  const [outletId, setOutletId] = useState("");
  const [sales, setSales] = useState<SalesSummary | null>(null);
  const [salesDetails, setSalesDetails] = useState<SalesDetail[]>([]);
  const [inventory, setInventory] = useState<InventorySummary | null>(null);
  const [waste, setWaste] = useState<WasteSummary | null>(null);
  const [wasteDetails, setWasteDetails] = useState<WasteDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [detailSearch, setDetailSearch] = useState("");
  const [detailStatusFilter, setDetailStatusFilter] = useState("all");
  const [detailPaymentFilter, setDetailPaymentFilter] = useState("all");
  const [detailSortBy, setDetailSortBy] = useState("date-desc");
  const [detailPage, setDetailPage] = useState(1);
  const [detailPageSize, setDetailPageSize] = useState(10);
  const [wasteSearch, setWasteSearch] = useState("");
  const [wastePage, setWastePage] = useState(1);
  const [wastePageSize, setWastePageSize] = useState(10);
  const [detailSale, setDetailSale] = useState<SalesDetail | null>(null);
  const [canManageSaleCorrections, setCanManageSaleCorrections] = useState(false);
  const [actionSaleId, setActionSaleId] = useState<string | null>(null);
  const [reprintSaleId, setReprintSaleId] = useState<string | null>(null);
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings | null>(null);

  const statusOptions = useMemo(
    () =>
      Array.from(new Set(salesDetails.map((item) => item.status))).map(
        (status) => ({
          value: status,
          label: status,
        }),
      ),
    [salesDetails],
  );
  const paymentOptions = useMemo(
    () =>
      Array.from(
        new Set(
          salesDetails
            .flatMap((item) =>
              item.paymentMethods.split(",").map((method) => method.trim()),
            )
            .filter(Boolean),
        ),
      ).map((method) => ({
        value: method,
        label: method,
      })),
    [salesDetails],
  );
  const visibleSalesDetails = useMemo(() => {
    const keyword = detailSearch.trim().toLowerCase();
    return salesDetails
      .filter((item) => {
        const methods = item.paymentMethods
          .split(",")
          .map((method) => method.trim());
        const matchesSearch =
          !keyword ||
          [
            item.receiptNumber,
            item.cashierName ?? "",
            item.status,
            item.source,
            item.paymentMethods,
          ]
            .join(" ")
            .toLowerCase()
            .includes(keyword);
        const matchesStatus =
          detailStatusFilter === "all" || item.status === detailStatusFilter;
        const matchesPayment =
          detailPaymentFilter === "all" ||
          methods.includes(detailPaymentFilter);
        return matchesSearch && matchesStatus && matchesPayment;
      })
      .sort((a, b) => {
        switch (detailSortBy) {
          case "date-asc":
            return (
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
          case "total-desc":
            return Number(b.grandTotal) - Number(a.grandTotal);
          case "total-asc":
            return Number(a.grandTotal) - Number(b.grandTotal);
          case "profit-desc":
            return Number(b.grossProfit) - Number(a.grossProfit);
          case "receipt-asc":
            return a.receiptNumber.localeCompare(b.receiptNumber);
          default:
            return (
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
        }
      });
  }, [
    detailPaymentFilter,
    detailSearch,
    detailSortBy,
    detailStatusFilter,
    salesDetails,
  ]);
  const pagedSalesDetails = pageItems(
    visibleSalesDetails,
    detailPage,
    detailPageSize,
  );
  const visibleWasteDetails = useMemo(() => {
    const keyword = wasteSearch.trim().toLowerCase();
    return wasteDetails.filter((item) => {
      if (!keyword) return true;
      return [
        item.skuName,
        item.skuCode,
        item.outletName,
        item.outletCode,
        item.status,
        item.reason,
        item.note ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [wasteDetails, wasteSearch]);
  const pagedWasteDetails = pageItems(
    visibleWasteDetails,
    wastePage,
    wastePageSize,
  );

  async function loadOutlets() {
    try {
      const [profile, outlets, settingsResponse] = await Promise.all([
        getProfile(),
        getOutlets(),
        fetch("/api/settings"),
      ]);
      if (settingsResponse.status === 401) {
        window.location.assign("/admin/login");
        return;
      }
      if (settingsResponse.ok) {
        setReceiptSettings(((await settingsResponse.json()) as ApiResponse<ReceiptSettings>).data);
      }
      const nextCanViewAll = ["owner", "auditor"].includes(profile.role);
      setCanManageSaleCorrections(["owner", "admin_outlet"].includes(profile.role));
      const selectedIsAllowed =
        selectedOutletId === allOutletsValue
          ? nextCanViewAll
          : outlets.some((outlet) => outlet.id === selectedOutletId);
      const nextOutletId =
        (selectedIsAllowed ? selectedOutletId : "") ||
        (nextCanViewAll ? allOutletsValue : outlets[0]?.id || "");
      setOutletId(nextOutletId);
      if (nextOutletId) {
        await loadReports(nextOutletId);
      } else {
        setIsLoading(false);
      }
    } catch {
      setMessage("Gagal memuat outlet.");
      setIsLoading(false);
      return;
    }
  }

  function reportQuery(nextOutletId = outletId) {
    if (nextOutletId === allOutletsValue) {
      return "";
    }
    return `outletId=${encodeURIComponent(nextOutletId)}`;
  }

  function reportUrl(path: string, nextOutletId = outletId) {
    const query = reportQuery(nextOutletId);
    return query ? `${path}?${query}` : path;
  }

  async function loadReports(nextOutletId = outletId) {
    if (!nextOutletId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setMessage(null);
    const [
      salesResponse,
      detailResponse,
      inventoryResponse,
      wasteResponse,
      wasteDetailResponse,
    ] = await Promise.all([
      fetch(reportUrl("/api/reports/sales-summary", nextOutletId)),
      fetch(reportUrl("/api/reports/sales-detail", nextOutletId)),
      fetch(reportUrl("/api/reports/inventory-summary", nextOutletId)),
      fetch(reportUrl("/api/reports/waste-summary", nextOutletId)),
      fetch(reportUrl("/api/reports/waste-detail", nextOutletId)),
    ]);

    if (
      salesResponse.status === 401 ||
      detailResponse.status === 401 ||
      inventoryResponse.status === 401 ||
      wasteResponse.status === 401 ||
      wasteDetailResponse.status === 401
    ) {
      window.location.assign("/admin/login");
      return;
    }

    if (
      !salesResponse.ok ||
      !detailResponse.ok ||
      !inventoryResponse.ok ||
      !wasteResponse.ok ||
      !wasteDetailResponse.ok
    ) {
      setMessage("Gagal memuat laporan. Pastikan akun memiliki akses outlet.");
      setIsLoading(false);
      return;
    }

    setSales(((await salesResponse.json()) as ApiResponse<SalesSummary>).data);
    setSalesDetails(
      ((await detailResponse.json()) as ApiResponse<SalesDetail[]>).data,
    );
    setInventory(
      ((await inventoryResponse.json()) as ApiResponse<InventorySummary>).data,
    );
    setWaste(((await wasteResponse.json()) as ApiResponse<WasteSummary>).data);
    setWasteDetails(
      ((await wasteDetailResponse.json()) as ApiResponse<WasteDetail[]>).data,
    );
    setIsLoading(false);
  }

  async function submitSaleCorrection(item: SalesDetail, action: "void" | "refund") {
    const label = action === "void" ? "pembatalan transaksi" : "retur/pengembalian dana";
    const correctionInput = await requestSaleCorrectionInput(item.receiptNumber, action);
    if (!correctionInput) return;
    if (correctionInput.reason.length < 3) {
      await Swal.fire({
        icon: "warning",
        title: "Alasan terlalu pendek",
        text: "Alasan minimal 3 karakter.",
      });
      return;
    }

    setActionSaleId(item.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/sales/${item.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "refund"
            ? { reason: correctionInput.reason, restock: correctionInput.restock }
            : { reason: correctionInput.reason },
        ),
      });
      if (!response.ok) {
        setMessage(await readError(response, `${label} gagal.`));
        return;
      }
      setMessage(
        `${item.receiptNumber} berhasil diproses ${
          action === "void" ? "pembatalan transaksi" : "retur/pengembalian dana"
        }.`,
      );
      await Swal.fire({
        icon: "success",
        title: "Berhasil",
        text: `${item.receiptNumber} berhasil diproses.`,
      });
      await loadReports();
    } catch {
      setMessage(`${label} gagal. Koneksi server tidak tersedia.`);
    } finally {
      setActionSaleId(null);
    }
  }

  async function submitSyncReviewResolution(item: SalesDetail, action: "post" | "reject") {
    const isPost = action === "post";
    const result = await Swal.fire<{ reason?: string }>({
      icon: isPost ? "question" : "warning",
      title: isPost ? "Post transaksi review?" : "Reject transaksi review?",
      html: isPost
        ? `<p class="text-left text-sm">Sistem akan mencoba posting stok, payment, shift cash, dan jurnal untuk <strong>${item.receiptNumber}</strong>. Jika stok/batch atau shift belum valid, proses akan ditolak.</p>`
        : `<p class="text-left text-sm">Transaksi <strong>${item.receiptNumber}</strong> akan ditandai batal dan tidak masuk omzet/stok/finance.</p>`,
      input: isPost ? undefined : "textarea",
      inputLabel: isPost ? undefined : "Alasan reject",
      inputPlaceholder: isPost ? undefined : "Contoh: transaksi offline double, stok tidak valid",
      showCancelButton: true,
      confirmButtonText: isPost ? "Post" : "Reject",
      cancelButtonText: "Batal",
      confirmButtonColor: isPost ? "#16a34a" : "#dc2626",
      preConfirm: (value) => {
        const reason = String(value ?? "").trim();
        if (!isPost && reason.length < 3) {
          Swal.showValidationMessage("Alasan minimal 3 karakter.");
          return false;
        }
        return { reason };
      },
    });
    if (!result.isConfirmed) return;

    setActionSaleId(item.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/sales/${item.id}/sync-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: result.value?.reason }),
      });
      if (!response.ok) {
        setMessage(await readError(response, "Proses transaksi review gagal."));
        return;
      }
      setMessage(`${item.receiptNumber} berhasil ${isPost ? "diposting" : "direject"}.`);
      await Swal.fire({
        icon: "success",
        title: "Berhasil",
        text: `${item.receiptNumber} berhasil ${isPost ? "diposting" : "direject"}.`,
      });
      await loadReports();
    } catch {
      setMessage("Proses transaksi review gagal. Koneksi server tidak tersedia.");
    } finally {
      setActionSaleId(null);
    }
  }

  async function reprintSale(item: SalesDetail) {
    const layout = receiptSettings?.receiptLayout;
    setReprintSaleId(item.id);
    setMessage(null);
    try {
      await printReceiptViaBrowser(buildSalesDetailReceiptText(item, layout), {
        title: `Cetak ulang ${item.receiptNumber}`,
        paperWidth: layout?.paperWidth === "80" ? "80" : "58",
        logoUrl: item.outletLogoUrl || receiptSettings?.defaultOutletLogoUrl,
        showLogo: layout?.header?.includes("logo") ?? true,
      });
      await Swal.fire({
        icon: "success",
        title: "Dialog print dibuka",
        text: "Pilih printer dari browser.",
      });
    } catch {
      const error = "Cetak ulang struk gagal. Browser belum bisa membuka dialog print.";
      setMessage(error);
      await Swal.fire({
        icon: "error",
        title: "Cetak ulang gagal",
        text: error,
      });
    } finally {
      setReprintSaleId(null);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOutlets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOutletId]);

  useRealtimeEvents({
    topics: ["sales", "inventory", "waste", "purchases", "customers", "settings"],
    enabled: Boolean(outletId),
    debounceMs: 800,
    onEvent: (event) => {
      if (outletId !== allOutletsValue && event.outletId && event.outletId !== outletId) return;
      if (event.topics.includes("settings")) {
        void loadOutlets();
        return;
      }
      void loadReports(outletId);
    },
  });

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="h-1 bg-[linear-gradient(90deg,#2563eb,#16a34a,#f59e0b,#ef4444,#8b5cf6)]" />
        <div className="flex flex-col justify-between gap-3 px-4 pt-4 md:flex-row md:items-start">
          <div>
            <h2 className="text-base font-semibold leading-snug text-foreground">Kesimpulan Data Penjualan</h2>
            <p className="mt-1 text-xs leading-4 text-muted-foreground">Total dari data laporan penjualan pada outlet dan periode yang dipilih.</p>
          </div>
          <span className="inline-flex h-9 w-fit items-center rounded-md border bg-background px-3 text-xs font-medium text-muted-foreground">{outletId === allOutletsValue ? "Semua outlet" : "Outlet aktif"}</span>
        </div>
        <div className="px-4 pt-4">
          {message ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>
          ) : null}
          {isLoading ? (
            <div className="rounded-lg border bg-muted/25 p-4 text-sm text-muted-foreground">
              Memuat filter dan ringkasan laporan...
            </div>
          ) : null}
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-3 xl:grid-cols-6">
          <SummaryTile
            icon={ReceiptText}
            label="Total Transaksi"
            value={formatNumber(sales?.transactionCount ?? 0, 0)}
            tone="sky"
            caption="Struk masuk"
          />
          <SummaryTile
            icon={CircleDollarSign}
            label="Total Gross"
            value={currency(sales?.grossSales)}
            tone="emerald"
            caption="Sebelum potongan"
          />
          <SummaryTile icon={Wallet} label="Total Net" value={currency(sales?.netSales)} tone="blue" caption="Penjualan bersih" />
          <SummaryTile icon={PackageMinus} label="Total HPP" value={currency(sales?.cogs)} tone="amber" caption="Biaya barang" />
          <SummaryTile
            icon={TrendingUp}
            label="Total Laba"
            value={currency(sales?.grossProfit)}
            tone="violet"
            caption="Gross profit"
          />
          <SummaryTile
            icon={HandCoins}
            label="Rata-rata / Struk"
            value={currency(averageTicket(sales))}
            tone="rose"
            caption="Average ticket"
          />
        </div>
        <div className="border-t px-4 py-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Margin laba kotor</p>
              <p className="text-xs text-muted-foreground">Perbandingan laba terhadap penjualan bersih.</p>
            </div>
            <span className="inline-flex h-9 w-fit items-center rounded-lg bg-emerald-100 px-3 text-sm font-semibold text-emerald-700">{profitMargin(sales)}</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-[linear-gradient(90deg,#16a34a,#22c55e,#84cc16)] transition-all" style={{ width: `${profitMarginWidth(sales)}%` }} />
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <ReportCard
          icon={BarChart3}
          title="Penjualan"
          rows={[
            ["Transaksi", sales?.transactionCount ?? 0],
            ["Penjualan Kotor", currency(sales?.grossSales)],
            ["Penjualan Bersih", currency(sales?.netSales)],
            ["Laba Kotor", currency(sales?.grossProfit)],
          ]}
        />
        <ReportCard
          icon={Boxes}
          title="Persediaan"
          rows={[
            ["Jumlah SKU", inventory?.skuCount ?? 0],
            [
              "Stok Dasar",
              `${number(inventory?.totalOnHandBaseQty)} satuan dasar`,
            ],
            ["Stok Kritis", inventory?.criticalStockCount ?? 0],
          ]}
        />
        <ReportCard
          icon={Scale}
          title="Remahan / Rusak"
          rows={[
            ["Penyesuaian", waste?.adjustmentCount ?? 0],
            ["Qty Dasar", `${number(waste?.totalQuantityBase)} satuan dasar`],
            ["Estimasi Kerugian", currency(waste?.totalEstimatedLoss)],
          ]}
        />
      </div>

      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-1">
          <div>
            <h2 className="text-base font-semibold leading-snug text-foreground">Detail Penjualan</h2>
            <p className="mt-1 text-xs leading-4 text-muted-foreground">{visibleSalesDetails.length} dari {salesDetails.length} transaksi terbaru sesuai outlet dan filter laporan.</p>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border bg-card">
          <ReportTableControls search={detailSearch} setSearch={setDetailSearch} statusFilter={detailStatusFilter} setStatusFilter={setDetailStatusFilter} paymentFilter={detailPaymentFilter} setPaymentFilter={setDetailPaymentFilter} sortBy={detailSortBy} setSortBy={setDetailSortBy} pageSize={detailPageSize} setPageSize={setDetailPageSize} setPage={setDetailPage} statusOptions={statusOptions} paymentOptions={paymentOptions} />
          <div className="thin-x-scroll overflow-x-auto">
          <table className="min-w-[1088px] table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[210px]" />
              <col className="w-[180px]" />
              <col className="w-[120px]" />
              <col className="w-[150px]" />
              <col className="w-[150px]" />
              <col className="w-[160px]" />
              <col className="w-[130px]" />
            </colgroup>
            <thead className="border-b bg-background text-xs font-semibold text-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Struk</th>
                <th className="px-4 py-3 text-left">Kasir / Bayar</th>
                <th className="px-4 py-3 text-left">Item</th>
                <th className="px-4 py-3 text-left">Total</th>
                <th className="px-4 py-3 text-left">Laba</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-background">
              {pagedSalesDetails.map((item) => {
                const canVoidSale = canCorrectSale(item, "void");
                const canRefundSale = canCorrectSale(item, "refund");
                return (
                  <tr key={item.id} className="border-b text-sm last:border-b-0">
                    <td className="px-4 py-3 align-middle">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{item.receiptNumber}</p>
                        <p className="truncate text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="min-w-0">
                        <p className="truncate">{item.cashierName || "Kasir"}</p>
                        <p className="truncate text-xs text-muted-foreground">{item.paymentMethods || "-"}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <p className="font-medium">{item.itemCount.toLocaleString("id-ID")}</p>
                      <p className="text-xs text-muted-foreground">item</p>
                    </td>
                    <td className="px-4 py-3 align-middle font-medium">{currency(item.grandTotal)}</td>
                    <td className="px-4 py-3 align-middle font-medium">{currency(item.grossProfit)}</td>
                    <td className="px-4 py-3 align-middle">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${saleStatusClass(item.status)}`}>{saleStatusLabel(item.status)}</span>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex justify-end gap-1">
                        <Button type="button" variant="outline" size="sm" className="h-8 w-8 border-sky-200 p-0 text-sky-600 hover:bg-sky-50 hover:text-sky-700" onClick={() => setDetailSale(item)} aria-label="Lihat detail" title="Lihat detail">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="h-8 w-8 border-violet-200 p-0 text-violet-600 hover:bg-violet-50 hover:text-violet-700" disabled={reprintSaleId === item.id} onClick={() => void reprintSale(item)} aria-label="Cetak ulang" title="Cetak ulang">
                          <Printer className="h-4 w-4" />
                        </Button>
                        {canManageSaleCorrections && item.status === "completed" && canVoidSale ? (
                          <Button type="button" variant="outline" size="sm" className="h-8 w-8 border-red-200 p-0 text-red-600 hover:bg-red-50 hover:text-red-700" disabled={actionSaleId === item.id} onClick={() => void submitSaleCorrection(item, "void")} aria-label="Void" title="Void">
                            <Ban className="h-4 w-4" />
                          </Button>
                        ) : null}
                        {canManageSaleCorrections && item.status === "completed" && canRefundSale ? (
                          <Button type="button" variant="outline" size="sm" className="h-8 w-8 border-amber-200 p-0 text-amber-700 hover:bg-amber-50 hover:text-amber-800" disabled={actionSaleId === item.id} onClick={() => void submitSaleCorrection(item, "refund")} aria-label="Retur" title="Retur">
                            <Undo2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                        {canManageSaleCorrections && item.status === "sync_review" ? (
                          <Button type="button" variant="outline" size="sm" className="h-8 w-8 border-emerald-200 p-0 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800" disabled={actionSaleId === item.id} onClick={() => void submitSyncReviewResolution(item, "post")} aria-label="Post review" title="Post review">
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                        {canManageSaleCorrections && item.status === "sync_review" ? (
                          <Button type="button" variant="outline" size="sm" className="h-8 w-8 border-red-200 p-0 text-red-600 hover:bg-red-50 hover:text-red-700" disabled={actionSaleId === item.id} onClick={() => void submitSyncReviewResolution(item, "reject")} aria-label="Reject review" title="Reject review">
                            <XCircle className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!visibleSalesDetails.length && !isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-sm text-muted-foreground">Data transaksi tidak ditemukan.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <TablePager page={detailPage} pageSize={detailPageSize} total={visibleSalesDetails.length} setPage={setDetailPage} />
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-1">
          <div>
            <h2 className="text-base font-semibold leading-snug text-foreground">Detail Remahan</h2>
            <p className="mt-1 text-xs leading-4 text-muted-foreground">{visibleWasteDetails.length} dari {wasteDetails.length} catatan remahan sesuai outlet dan pencarian.</p>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border bg-card">
          <SimpleTableControls search={wasteSearch} setSearch={setWasteSearch} pageSize={wastePageSize} setPageSize={setWastePageSize} setPage={setWastePage} />
          <div className="thin-x-scroll overflow-x-auto">
          <table className="min-w-[1088px] table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[250px]" />
              <col className="w-[210px]" />
              <col className="w-[150px]" />
              <col className="w-[150px]" />
              <col className="w-[280px]" />
            </colgroup>
            <thead className="border-b bg-background text-xs font-semibold text-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Produk</th>
                <th className="px-4 py-3 text-left">Outlet</th>
                <th className="px-4 py-3 text-left">Qty</th>
                <th className="px-4 py-3 text-left">Loss</th>
                <th className="px-4 py-3 text-left">Alasan / Status</th>
              </tr>
            </thead>
            <tbody className="bg-background">
              {pagedWasteDetails.map((item) => (
                <tr key={item.id} className="border-b text-sm last:border-b-0">
                  <td className="px-4 py-3 align-middle">
                    <p className="truncate font-medium">{item.skuName}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.skuCode}</p>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <p className="truncate">{item.outletName}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.outletCode}</p>
                  </td>
                  <td className="px-4 py-3 align-middle font-medium">{number(item.quantityBase)} {item.unitCode || "unit"}</td>
                  <td className="px-4 py-3 align-middle font-medium">{currency(item.estimatedLoss)}</td>
                  <td className="px-4 py-3 align-middle">
                    <p className="truncate font-medium text-orange-700">{wasteReasonLabel(item.reason)}</p>
                    <p className="truncate text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
                    <span className={`mt-1 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${wasteStatusClass(item.status)}`}>{item.status}</span>
                  </td>
                </tr>
              ))}
              {!visibleWasteDetails.length && !isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-sm text-muted-foreground">Data remahan tidak ditemukan.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <TablePager page={wastePage} pageSize={wastePageSize} total={visibleWasteDetails.length} setPage={setWastePage} />
        </div>
      </section>

      <AdminModal open={Boolean(detailSale)} title="Detail Penjualan" description={detailSale ? `${detailSale.receiptNumber} - ${detailSale.outletName}` : undefined} size="xl" onClose={() => setDetailSale(null)}>
        {detailSale ? <SaleDetailPanel item={detailSale} /> : null}
      </AdminModal>
    </div>
  );
}

function ReportCard(props: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  rows: Array<[string, string | number]>;
}) {
  const Icon = props.icon;
  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex flex-row items-center gap-2 border-b bg-muted/20 p-3">
        <span className="rounded-md bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" /></span>
        <h3 className="text-sm font-semibold">{props.title}</h3>
      </div>
      <div className="grid gap-2 p-3">
        {props.rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-4 text-sm"
          >
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportTableControls(props: {
  search: string;
  setSearch: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  paymentFilter: string;
  setPaymentFilter: (value: string) => void;
  sortBy: string;
  setSortBy: (value: string) => void;
  pageSize: number;
  setPageSize: (value: number) => void;
  setPage: (value: number) => void;
  statusOptions: Array<{ value: string; label: string }>;
  paymentOptions: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="flex flex-col gap-3 border-b px-4 py-4 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>Show</span>
        <select className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" value={props.pageSize} onChange={(event) => { props.setPageSize(Number(event.target.value)); props.setPage(1); }}>
          {[5, 10, 20, 50, 100].map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <span>entries</span>
        <select className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" value={props.statusFilter} onChange={(event) => { props.setStatusFilter(event.target.value); props.setPage(1); }}>
          <option value="all">Semua status</option>{props.statusOptions.map((option) => <option key={option.value} value={option.value}>{saleStatusLabel(option.label)}</option>)}
        </select>
        <select className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" value={props.paymentFilter} onChange={(event) => { props.setPaymentFilter(event.target.value); props.setPage(1); }}>
          <option value="all">Semua metode</option>{props.paymentOptions.map((option) => <option key={option.value} value={option.value}>{paymentMethodLabel(option.label)}</option>)}
        </select>
        <select className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" value={props.sortBy} onChange={(event) => { props.setSortBy(event.target.value); props.setPage(1); }}>
          <option value="date-desc">Terbaru</option><option value="date-asc">Terlama</option><option value="total-desc">Total terbesar</option><option value="total-asc">Total terkecil</option><option value="profit-desc">Laba terbesar</option><option value="receipt-asc">Nomor struk</option>
        </select>
      </div>
      <div className="relative md:w-80"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" /><Input className="h-11 rounded-lg pl-11" value={props.search} placeholder="Search..." onChange={(event) => { props.setSearch(event.target.value); props.setPage(1); }} /></div>
    </div>
  );
}

function SimpleTableControls(props: {
  search: string;
  setSearch: (value: string) => void;
  pageSize: number;
  setPageSize: (value: number) => void;
  setPage: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-b px-4 py-4 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>Show</span>
        <select className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" value={props.pageSize} onChange={(event) => { props.setPageSize(Number(event.target.value)); props.setPage(1); }}>
          {[5, 10, 20, 50, 100].map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <span>entries</span>
      </div>
      <div className="relative md:w-80">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input className="h-11 rounded-lg pl-11" value={props.search} placeholder="Search..." onChange={(event) => { props.setSearch(event.target.value); props.setPage(1); }} />
      </div>
    </div>
  );
}

function SaleDetailPanel(props: { item: SalesDetail }) {
  const item = props.item;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MetricText label="Subtotal" value={currency(item.subtotal)} compact />
        <MetricText label="Diskon" value={currency(item.discountTotal)} compact />
        <MetricText label="Pajak" value={currency(item.taxTotal)} compact />
        <MetricText label="Service" value={currency(item.serviceChargeTotal)} compact />
        <MetricText label="Donasi" value={currency(item.donationTotal)} compact />
        <MetricText label="Kembali" value={currency(item.changeTotal)} compact />
      </div>
      {item.promotions.length ? (
        <div className="rounded-lg border bg-muted/15 p-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Promo</p>
          <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {item.promotions.map((promo, index) => (
              <p key={`${promo.name}-${index}`} className="truncate rounded-md border bg-background px-3 py-2 text-sm">
                <span className="font-medium">{promo.name}</span> <span className="text-muted-foreground">{promo.code || "Otomatis"} - {currency(promo.discountTotal)}</span>
              </p>
            ))}
          </div>
        </div>
      ) : null}
      <SaleItemsList saleId={item.id} items={item.items} />
    </div>
  );
}

function TablePager(props: {
  page: number;
  pageSize: number;
  total: number;
  setPage: (value: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(props.total / props.pageSize));
  const currentPage = Math.min(props.page, pageCount);
  const start = props.total === 0 ? 0 : (currentPage - 1) * props.pageSize + 1;
  const end = Math.min(props.total, currentPage * props.pageSize);

  return (
    <div className="flex flex-col gap-3 border-t px-4 py-4 md:flex-row md:items-center md:justify-between">
      <p className="text-sm text-muted-foreground">
        Showing {start} to {end} of {props.total} entries
      </p>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 w-10 shrink-0 p-0"
          disabled={currentPage <= 1}
          onClick={() => props.setPage(currentPage - 1)}
          aria-label="Halaman sebelumnya"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-lg bg-primary/10 px-3 text-sm font-semibold text-primary">
          {currentPage}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 w-10 shrink-0 p-0"
          disabled={currentPage >= pageCount}
          onClick={() => props.setPage(currentPage + 1)}
          aria-label="Halaman berikutnya"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function MetricText(props: { label: string; value: string; compact?: boolean }) {
  return (
    <div>
      <p className={props.compact ? "text-xs text-muted-foreground" : "text-muted-foreground"}>{props.label}</p>
      <p className={props.compact ? "text-sm font-medium" : "font-medium"}>{props.value}</p>
    </div>
  );
}

function SummaryTile(props: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: SummaryTone;
  caption: string;
}) {
  const Icon = props.icon;
  const toneClasses: Record<SummaryTone, string> = {
    sky: "border-sky-200 bg-sky-50 text-sky-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
  };
  return (
    <div className="group rounded-lg border bg-background p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{props.label}</p>
          <p className="mt-1 truncate text-base font-semibold text-foreground">{props.value}</p>
        </div>
        <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${toneClasses[props.tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span className={`h-2 w-2 rounded-full ${dotClass(props.tone)}`} />
        <span className="truncate">{props.caption}</span>
      </div>
    </div>
  );
}

function dotClass(tone: SummaryTone) {
  const classes: Record<SummaryTone, string> = {
    sky: "bg-sky-500",
    emerald: "bg-emerald-500",
    blue: "bg-blue-500",
    amber: "bg-amber-500",
    violet: "bg-violet-500",
    rose: "bg-rose-500",
  };
  return classes[tone];
}

function SaleItemsList(props: { saleId: string; items: SalesDetailItem[] }) {
  const pageSize = 10;
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(props.items.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleItems = pageItems(props.items, currentPage, pageSize);
  const start =
    props.items.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(props.items.length, currentPage * pageSize);

  return (
    <div className="mt-3 rounded-md bg-muted/20 p-2">
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Produk Dibeli
        </p>
        {props.items.length > pageSize ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {start}-{end} dari {props.items.length} produk
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
              aria-label="Produk sebelumnya"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-10 text-center font-medium text-foreground">
              {currentPage}/{pageCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={currentPage >= pageCount}
              onClick={() => setPage(currentPage + 1)}
              aria-label="Produk berikutnya"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </div>

      {visibleItems.length ? (
        <div className="overflow-hidden rounded-md border bg-background">
          {visibleItems.map((line, index) => (
            <div
              key={`${props.saleId}-${line.skuId}-${line.name}-${index}`}
              className="grid gap-2 border-b px-2 py-1.5 text-sm last:border-b-0 md:grid-cols-[minmax(0,1.4fr)_0.7fr_0.8fr_0.8fr] md:items-center"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{line.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {line.skuCode || "-"}
                </p>
              </div>
              <MetricText
                label="Qty"
                value={`${number(line.quantityInput)} ${line.unitCode || "unit"}`}
                compact
              />
              <MetricText
                label="Dasar"
                value={`${number(line.quantityBase)} ${line.baseUnitCode || "unit"}`}
                compact
              />
              <MetricText label="Total" value={currency(line.lineTotal)} compact />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Detail item belum tersedia.
        </p>
      )}
    </div>
  );
}

function currency(value?: string | number) {
  return `Rp ${formatNumber(value, 0)}`;
}

function averageTicket(sales?: SalesSummary | null) {
  const count = sales?.transactionCount ?? 0;
  if (!count) return 0;
  return Number(sales?.netSales ?? 0) / count;
}

function profitMargin(sales?: SalesSummary | null) {
  const net = Number(sales?.netSales ?? 0);
  if (!net) return "0%";
  return `${((Number(sales?.grossProfit ?? 0) / net) * 100).toLocaleString(
    "id-ID",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    },
  )}%`;
}

function profitMarginWidth(sales?: SalesSummary | null) {
  const net = Number(sales?.netSales ?? 0);
  if (!net) return 0;
  const percent = (Number(sales?.grossProfit ?? 0) / net) * 100;
  return Math.max(0, Math.min(100, percent));
}

function number(value?: string) {
  return formatNumber(value);
}

function formatNumber(value?: string | number, maximumFractionDigits = 3) {
  return Number(value ?? 0).toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function wasteReasonLabel(value: string) {
  const labels: Record<string, string> = {
    crumbs_unsellable: "Remah tidak layak jual",
    spilled: "Tumpah",
    damaged: "Rusak",
    quality_drop: "Turun kualitas",
    expired: "Kedaluwarsa",
    weighing_difference: "Selisih timbang",
    sampling: "Sampling",
    internal_use: "Pemakaian internal",
    stock_opname_correction: "Koreksi opname",
    other: "Lainnya",
  };
  return labels[value] ?? value;
}

function saleStatusLabel(value: string) {
  const labels: Record<string, string> = {
    completed: "Selesai",
    voided: "Dibatalkan",
    refunded: "Dana dikembalikan",
    sync_review: "Perlu ditinjau",
  };
  return labels[value] ?? value;
}

function saleStatusClass(value: string) {
  const classes: Record<string, string> = {
    completed: "bg-emerald-100 text-emerald-700",
    voided: "bg-red-100 text-red-700",
    refunded: "bg-amber-100 text-amber-700",
    sync_review: "bg-violet-100 text-violet-700",
  };
  return classes[value] ?? "bg-muted text-muted-foreground";
}

function wasteStatusClass(value: string) {
  const normalized = value.toLowerCase();
  if (["approved", "posted", "completed"].includes(normalized)) {
    return "bg-emerald-100 text-emerald-700";
  }
  if (["rejected", "voided", "cancelled", "canceled"].includes(normalized)) {
    return "bg-red-100 text-red-700";
  }
  if (["pending", "draft", "requested"].includes(normalized)) {
    return "bg-amber-100 text-amber-700";
  }
  return "bg-sky-100 text-sky-700";
}

function canCorrectSale(item: SalesDetail, action: "void" | "refund") {
  if (!item.items.length) return false;
  const saleAgeHours = (Date.now() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60);
  const policyField = action === "void" ? "voidWindowHours" : "refundWindowHours";
  return item.items.every((line) => {
    const windowHours = line[policyField];
    if (windowHours === null) return true;
    return windowHours > 0 && saleAgeHours <= windowHours;
  });
}

function buildSalesDetailReceiptText(item: SalesDetail, layout: ReceiptSettings["receiptLayout"] | undefined) {
  const paperWidth = layout?.paperWidth === "80" ? "80" : "58";
  const width = paperWidth === "80" ? 42 : 28;
  const separator = "-".repeat(width);
  const header = layout?.header?.length ? layout.header : ["logo", "outlet", "address", "cashier", "receiptNumber"];
  const body = layout?.body?.length ? layout.body : ["items", "totals", "payment"];
  const footer = layout?.footer?.length ? layout.footer : ["note"];
  const footerNote = layout?.footerNote || "Terima kasih";
  const center = (value: string) => {
    const safe = normalizeReceiptText(value).slice(0, width);
    const leftPad = Math.max(0, Math.floor((width - safe.length) / 2));
    return `${" ".repeat(leftPad)}${safe}`;
  };
  const row = (left: string, right: string) => {
    const rightSafe = normalizeReceiptText(right).slice(0, width);
    const leftSafe = normalizeReceiptText(left).slice(0, Math.max(0, width - rightSafe.length - 1));
    return `${leftSafe.padEnd(Math.max(0, width - rightSafe.length - 1))} ${rightSafe}`;
  };
  const cashAppliedTotal = item.payments
    .filter((payment) => payment.method === "cash")
    .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  const cashDisplayTotal = Math.max(Number(item.cashTenderedTotal ?? 0), cashAppliedTotal);
  const change = Number(item.changeTotal ?? 0);

  const lines: string[] = [];
  function renderBlock(block: string) {
    if (block === "logo") return;
    if (block === "outlet") lines.push(center(item.outletName || "Outlet"));
    if (block === "address") return;
    if (block === "cashier") lines.push(center(`Kasir: ${item.cashierName || "Kasir"}`));
    if (block === "receiptNumber") {
      lines.push(center(`No: ${item.receiptNumber}`));
      lines.push(center(formatDate(item.createdAt)));
      lines.push(center("CETAK ULANG"));
    }
    if (block === "items") {
      lines.push(separator);
      lines.push(...item.items.flatMap((line) => [
        ...wrapReceiptLine(line.name, width),
        ...receiptItemLine(`${number(line.quantityInput)} ${receiptUnitLabel(line.unitCode)} x ${currency(line.unitPrice)}`, currency(line.lineTotal), width, row),
        ...(Number(line.discountTotal ?? 0) > 0 ? [row("Diskon item", currency(line.discountTotal))] : []),
      ]));
    }
    if (block === "totals") {
      lines.push(separator);
      if (Number(item.subtotal ?? 0) > 0) lines.push(row("Subtotal", currency(item.subtotal)));
      if (Number(item.discountTotal ?? 0) > 0) lines.push(row("Diskon", currency(item.discountTotal)));
      if (Number(item.taxTotal ?? 0) > 0) lines.push(row("Pajak", currency(item.taxTotal)));
      if (Number(item.serviceChargeTotal ?? 0) > 0) lines.push(row("Service", currency(item.serviceChargeTotal)));
      if (Number(item.donationTotal ?? 0) > 0) lines.push(row("Donasi", currency(item.donationTotal)));
      if (Number(item.roundingTotal ?? 0) > 0) lines.push(row("Pembulatan", currency(item.roundingTotal)));
      lines.push(row("TOTAL", currency(item.grandTotal)));
    }
    if (block === "payment") {
      lines.push(...item.payments
        .filter((payment) => Number(payment.amount ?? 0) > 0 && payment.method !== "cash")
        .map((payment) => row(paymentMethodLabel(payment.method), currency(payment.amount))));
      if (cashDisplayTotal > 0) {
        lines.push(row(cashDisplayTotal > cashAppliedTotal ? "Tunai diterima" : "Tunai", currency(cashDisplayTotal)));
      }
      if (change > 0) lines.push(row("Kembali", currency(change)));
    }
    if (block === "note") {
      lines.push(separator);
      lines.push(...receiptNoteLines(footerNote, width).map(center));
    }
  }

  header.forEach(renderBlock);
  body.forEach(renderBlock);
  footer.forEach(renderBlock);
  return `${lines.join("\n")}\n`;
}

function normalizeReceiptText(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "?");
}

function wrapReceiptLine(value: string, width: number) {
  const normalized = normalizeReceiptText(value).trim();
  if (!normalized) return [];
  const chunks = [];
  for (let index = 0; index < normalized.length; index += width) {
    chunks.push(normalized.slice(index, index + width));
  }
  return chunks;
}

function receiptNoteLines(value: string, width: number) {
  const note = value.trim() ? value : "Terima kasih";
  return note.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").flatMap((line) => {
    const wrapped = wrapReceiptLine(line, width);
    return wrapped.length ? wrapped : [""];
  });
}

function receiptUnitLabel(value: string | null | undefined) {
  const normalized = normalizeReceiptText(value || "unit").trim();
  return normalized || "unit";
}

function receiptItemLine(left: string, right: string, width: number, row: (left: string, right: string) => string) {
  const leftSafe = normalizeReceiptText(left).trim();
  const rightSafe = normalizeReceiptText(right).trim();
  if (leftSafe.length + rightSafe.length + 1 <= width) return [row(leftSafe, rightSafe)];
  return [leftSafe.slice(0, width), row("", rightSafe)];
}

function paymentMethodLabel(method: string) {
  const labels: Record<string, string> = {
    cash: "Tunai",
    qris: "QRIS",
    transfer: "Transfer",
    card: "Kartu",
    ewallet: "E-Wallet",
    other: "Lainnya",
  };
  return labels[method] ?? method;
}


async function requestSaleCorrectionInput(receiptNumber: string, action: "void" | "refund") {
  const isRefund = action === "refund";
  const result = await Swal.fire({
    title: isRefund ? "Retur/Pengembalian Dana" : "Pembatalan Transaksi",
    html: `
      <div style="text-align:left">
        <label for="sale-correction-reason" style="display:block;margin-bottom:6px;font-weight:600">Alasan</label>
        <textarea id="sale-correction-reason" class="swal2-textarea" placeholder="Tulis alasan untuk ${receiptNumber}" style="margin:0;width:100%;height:110px"></textarea>
        ${
          isRefund
            ? `<label style="display:flex;align-items:center;gap:8px;margin-top:14px">
                <input id="sale-correction-restock" type="checkbox" checked />
                <span>Kembalikan item ke stok</span>
              </label>`
            : ""
        }
      </div>
    `,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: isRefund ? "Proses Retur/Pengembalian Dana" : "Proses Pembatalan",
    cancelButtonText: "Batal",
    focusConfirm: false,
    preConfirm: () => {
      const reasonElement = document.getElementById("sale-correction-reason") as HTMLTextAreaElement | null;
      const restockElement = document.getElementById("sale-correction-restock") as HTMLInputElement | null;
      const reason = reasonElement?.value.trim() ?? "";
      if (reason.length < 3) {
        Swal.showValidationMessage("Alasan minimal 3 karakter.");
        return false;
      }
      return {
        reason,
        restock: restockElement?.checked ?? true,
      };
    },
  });

  return result.isConfirmed ? result.value : null;
}

async function readError(response: Response, fallback: string) {
  try {
    const json = (await response.json()) as { error?: { message?: string } };
    return json.error?.message ? `${fallback} ${json.error.message}` : fallback;
  } catch {
    return fallback;
  }
}
