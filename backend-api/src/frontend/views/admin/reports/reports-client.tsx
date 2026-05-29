"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Boxes,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CollapsibleSection } from "../_components/collapsible-section";
import { ListControls } from "../_components/list-controls";
import {
  PaginationControls,
  pageItems,
} from "../_components/pagination-controls";
import { allOutletsValue, useSelectedOutlet } from "@/frontend/controllers/selected-outlet-provider";
import { getOutlets, getProfile } from "@/frontend/controllers/admin-data-cache";

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
  receiptNumber: string;
  status: string;
  source: string;
  cashierName: string | null;
  subtotal: string;
  discountTotal: string;
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
  }>;
  createdAt: string;
};
type SalesDetailItem = SalesDetail["items"][number];
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

  async function loadOutlets() {
    try {
      const [profile, outlets] = await Promise.all([getProfile(), getOutlets()]);
      const nextCanViewAll = ["owner", "auditor"].includes(profile.role);
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
      window.location.href = "/admin/login";
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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOutlets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOutletId]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <CardTitle>Laporan Backend</CardTitle>
            <CardDescription>
              Ringkasan sales, stok, dan remahan dari data kasir Flutter.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadReports()}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {message ? (
            <p className="text-sm text-destructive">{message}</p>
          ) : null}
          {isLoading ? (
            <div className="rounded-lg border bg-muted/25 p-4 text-sm text-muted-foreground">
              Memuat filter dan ringkasan laporan...
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <ReportCard
          icon={BarChart3}
          title="Penjualan"
          rows={[
            ["Transaksi", sales?.transactionCount ?? 0],
            ["Gross Sales", currency(sales?.grossSales)],
            ["Net Sales", currency(sales?.netSales)],
            ["Gross Profit", currency(sales?.grossProfit)],
          ]}
        />
        <ReportCard
          icon={Boxes}
          title="Inventory"
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
          title="Waste / Remahan"
          rows={[
            ["Adjustment", waste?.adjustmentCount ?? 0],
            ["Qty Dasar", `${number(waste?.totalQuantityBase)} satuan dasar`],
            ["Estimasi Loss", currency(waste?.totalEstimatedLoss)],
          ]}
        />
      </div>

      <CollapsibleSection
        title="Kesimpulan Data Penjualan"
        description="Total dari data laporan penjualan pada outlet dan periode yang dipilih."
        isLoading={isLoading}
        loadingText="Menghitung kesimpulan data penjualan..."
      >
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <SummaryTile
            label="Total Transaksi"
            value={formatNumber(sales?.transactionCount ?? 0, 0)}
          />
          <SummaryTile
            label="Total Gross"
            value={currency(sales?.grossSales)}
          />
          <SummaryTile label="Total Net" value={currency(sales?.netSales)} />
          <SummaryTile label="Total HPP" value={currency(sales?.cogs)} />
          <SummaryTile
            label="Total Laba"
            value={currency(sales?.grossProfit)}
          />
          <SummaryTile
            label="Rata-rata / Struk"
            value={currency(averageTicket(sales))}
          />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Margin laba kotor:{" "}
          <span className="font-medium text-foreground">
            {profitMargin(sales)}
          </span>
          .
        </p>
      </CollapsibleSection>

      <CollapsibleSection
        title="Detail Penjualan"
        description={`${visibleSalesDetails.length} dari ${salesDetails.length} transaksi terbaru sesuai outlet dan filter laporan.`}
        isLoading={isLoading}
        loadingText="Memuat detail transaksi penjualan..."
      >
        <ListControls
          search={detailSearch}
          onSearchChange={setDetailSearch}
          searchPlaceholder="Cari struk, kasir, metode bayar..."
          filters={[
            {
              label: "Status",
              value: detailStatusFilter,
              onChange: setDetailStatusFilter,
              options: [
                { value: "all", label: "Semua status" },
                ...statusOptions,
              ],
            },
            {
              label: "Pembayaran",
              value: detailPaymentFilter,
              onChange: setDetailPaymentFilter,
              options: [
                { value: "all", label: "Semua metode" },
                ...paymentOptions,
              ],
            },
          ]}
          sort={detailSortBy}
          onSortChange={setDetailSortBy}
          sortOptions={[
            { value: "date-desc", label: "Terbaru" },
            { value: "date-asc", label: "Terlama" },
            { value: "total-desc", label: "Total terbesar" },
            { value: "total-asc", label: "Total terkecil" },
            { value: "profit-desc", label: "Laba terbesar" },
            { value: "receipt-asc", label: "Nomor struk" },
          ]}
        />
        <div className="mt-4">
          <PaginationControls
            page={detailPage}
            pageSize={detailPageSize}
            total={visibleSalesDetails.length}
            onPageChange={setDetailPage}
            onPageSizeChange={(value) => {
              setDetailPageSize(value);
              setDetailPage(1);
            }}
          />
        </div>
        <div className="mt-4 grid gap-3">
          {pagedSalesDetails.map((item) => (
            <div key={item.id} className="rounded-lg border p-4 text-sm">
              <div className="grid gap-3 lg:grid-cols-[1.2fr_0.9fr_0.7fr_0.8fr_0.8fr_0.8fr_0.8fr]">
                <div>
                  <p className="font-medium">{item.receiptNumber}</p>
                  <p className="text-muted-foreground">
                    {formatDate(item.createdAt)}
                  </p>
                </div>
                <div>
                  <p>{item.cashierName || "Kasir"}</p>
                  <p className="text-muted-foreground">
                    {item.paymentMethods || "-"}
                  </p>
                </div>
                <div>
                  <p>{item.itemCount.toLocaleString("id-ID")} item</p>
                  <p className="text-muted-foreground">{item.status}</p>
                </div>
                <MetricText label="Subtotal" value={currency(item.subtotal)} />
                <MetricText
                  label="Diskon"
                  value={currency(item.discountTotal)}
                />
                <MetricText label="Total" value={currency(item.grandTotal)} />
                <MetricText label="Laba" value={currency(item.grossProfit)} />
              </div>
              <SaleItemsList saleId={item.id} items={item.items} />
            </div>
          ))}
          {!visibleSalesDetails.length && !isLoading ? (
            <p className="text-sm text-muted-foreground">
              Data transaksi tidak ditemukan.
            </p>
          ) : null}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Detail Remahan"
        description={`${wasteDetails.length} catatan remahan dari outlet yang dipilih.`}
        isLoading={isLoading}
        loadingText="Memuat detail remahan..."
      >
        <div className="grid gap-3">
          {wasteDetails.map((item) => (
            <div
              key={item.id}
              className="grid gap-3 rounded-lg border p-4 text-sm lg:grid-cols-[1fr_1fr_0.8fr_0.8fr_0.8fr]"
            >
              <div>
                <p className="font-medium">{item.skuName}</p>
                <p className="text-muted-foreground">{item.skuCode}</p>
              </div>
              <div>
                <p>{item.outletName}</p>
                <p className="text-muted-foreground">{item.outletCode}</p>
              </div>
              <MetricText
                label="Qty"
                value={`${number(item.quantityBase)} ${item.unitCode || "unit"}`}
              />
              <MetricText label="Loss" value={currency(item.estimatedLoss)} />
              <div>
                <p className="font-medium">{wasteReasonLabel(item.reason)}</p>
                <p className="text-muted-foreground">
                  {item.status} - {formatDate(item.createdAt)}
                </p>
              </div>
            </div>
          ))}
          {!wasteDetails.length && !isLoading ? (
            <p className="text-sm text-muted-foreground">
              Data remahan tidak ditemukan.
            </p>
          ) : null}
        </div>
      </CollapsibleSection>
    </div>
  );
}

function ReportCard(props: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  rows: Array<[string, string | number]>;
}) {
  return (
    <Card>
      <CardHeader>
        <props.icon className="h-5 w-5 text-primary" />
        <CardTitle>{props.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {props.rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-4 border-b pb-2 last:border-0 last:pb-0"
          >
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="font-medium">{value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function MetricText(props: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{props.label}</p>
      <p className="font-medium">{props.value}</p>
    </div>
  );
}

function SummaryTile(props: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <p className="text-sm text-muted-foreground">{props.label}</p>
      <p className="mt-1 text-lg font-semibold">{props.value}</p>
    </div>
  );
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
    <div className="mt-4 rounded-md bg-muted/30 p-3">
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
              className="grid gap-2 border-b px-3 py-2 text-sm last:border-b-0 md:grid-cols-[minmax(0,1.4fr)_0.7fr_0.8fr_0.8fr] md:items-center"
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
              />
              <MetricText
                label="Dasar"
                value={`${number(line.quantityBase)} ${line.baseUnitCode || "unit"}`}
              />
              <MetricText label="Total" value={currency(line.lineTotal)} />
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
