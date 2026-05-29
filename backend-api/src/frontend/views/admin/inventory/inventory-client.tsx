"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  Plus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CollapsibleSection } from "../_components/collapsible-section";
import { ListControls } from "../_components/list-controls";
import {
  PaginationControls,
  pageItems,
} from "../_components/pagination-controls";
import { useToast } from "../_components/toast-provider";
import { useRolePermissions } from "../_components/use-role-permissions";
import { allOutletsValue, useSelectedOutlet } from "@/frontend/controllers/selected-outlet-provider";
import { getOutlets } from "@/frontend/controllers/admin-data-cache";

type Outlet = { id: string; name: string; code: string };
type Balance = {
  outletId: string;
  skuId: string;
  skuCode: string;
  skuName: string;
  onHandBaseQty: string;
  reservedBaseQty: string;
  holdBaseQty: string;
  minStockBaseQty: string;
  minStockUnitCode: string;
};
type Movement = {
  id: string;
  type: string;
  skuId: string;
  skuCode: string | null;
  skuName: string | null;
  quantityBase: string;
  quantityInput: string | null;
  baseUnitCode: string | null;
  referenceType: string | null;
  note: string | null;
  createdAt: string;
};
type CatalogItem = {
  skuId: string;
  skuCode: string;
  skuName: string;
  productName: string;
  baseUnitCode: string | null;
};
type ApiResponse<T> = { data: T };

export function InventoryClient() {
  const access = useRolePermissions("inventory");
  const { showToast } = useToast();
  const { selectedOutletId } = useSelectedOutlet();
  const [outletId, setOutletId] = useState("");
  const [balances, setBalances] = useState<Balance[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [adjustment, setAdjustment] = useState({
    skuId: "",
    type: "purchase",
    quantityBase: "0",
    note: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [balanceSearch, setBalanceSearch] = useState("");
  const [balanceStatusFilter, setBalanceStatusFilter] = useState("all");
  const [balanceSortBy, setBalanceSortBy] = useState("sku-asc");
  const [movementSearch, setMovementSearch] = useState("");
  const [movementTypeFilter, setMovementTypeFilter] = useState("all");
  const [movementSortBy, setMovementSortBy] = useState("date-desc");
  const [balancePage, setBalancePage] = useState(1);
  const [balancePageSize, setBalancePageSize] = useState(10);
  const [movementPage, setMovementPage] = useState(1);
  const [movementPageSize, setMovementPageSize] = useState(10);

  const movementTypeOptions = useMemo(
    () =>
      Array.from(new Set(movements.map((item) => item.type))).map((type) => ({
        value: type,
        label: type,
      })),
    [movements],
  );

  const visibleBalances = useMemo(() => {
    const keyword = balanceSearch.trim().toLowerCase();
    return balances
      .filter((item) => {
        const isCritical =
          Number(item.onHandBaseQty) <= Number(item.minStockBaseQty);
        const matchesSearch =
          !keyword ||
          [item.skuCode, item.skuName]
            .join(" ")
            .toLowerCase()
            .includes(keyword);
        const matchesStatus =
          balanceStatusFilter === "all" ||
          (balanceStatusFilter === "critical" && isCritical) ||
          (balanceStatusFilter === "safe" && !isCritical);
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        switch (balanceSortBy) {
          case "sku-desc":
            return b.skuCode.localeCompare(a.skuCode);
          case "name-asc":
            return a.skuName.localeCompare(b.skuName);
          case "stock-desc":
            return Number(b.onHandBaseQty) - Number(a.onHandBaseQty);
          case "stock-asc":
            return Number(a.onHandBaseQty) - Number(b.onHandBaseQty);
          case "critical":
            return (
              Number(Number(a.onHandBaseQty) > Number(a.minStockBaseQty)) -
                Number(Number(b.onHandBaseQty) > Number(b.minStockBaseQty)) ||
              a.skuCode.localeCompare(b.skuCode)
            );
          default:
            return a.skuCode.localeCompare(b.skuCode);
        }
      });
  }, [balanceSearch, balanceSortBy, balanceStatusFilter, balances]);
  const pagedBalances = pageItems(
    visibleBalances,
    balancePage,
    balancePageSize,
  );

  const visibleMovements = useMemo(() => {
    const keyword = movementSearch.trim().toLowerCase();
    return movements
      .filter((item) => {
        const matchesSearch =
          !keyword ||
          [
            item.type,
            item.referenceType ?? "",
            item.note ?? "",
            item.skuId,
            item.skuCode ?? "",
            item.skuName ?? "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(keyword);
        const matchesType =
          movementTypeFilter === "all" || item.type === movementTypeFilter;
        return matchesSearch && matchesType;
      })
      .sort((a, b) => {
        switch (movementSortBy) {
          case "date-asc":
            return (
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
          case "type-asc":
            return a.type.localeCompare(b.type);
          case "qty-desc":
            return Number(b.quantityBase) - Number(a.quantityBase);
          case "qty-asc":
            return Number(a.quantityBase) - Number(b.quantityBase);
          default:
            return (
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
        }
      });
  }, [movementSearch, movementSortBy, movementTypeFilter, movements]);
  const pagedMovements = pageItems(
    visibleMovements,
    movementPage,
    movementPageSize,
  );

  async function loadOutlets() {
    try {
      const outlets = await getOutlets();
      const selectedIsSpecificOutlet =
        selectedOutletId !== allOutletsValue &&
        outlets.some((outlet) => outlet.id === selectedOutletId);
      const nextOutletId = selectedIsSpecificOutlet ? selectedOutletId : outlets[0]?.id || "";
      setOutletId(nextOutletId);
      if (nextOutletId) {
        await loadInventory(nextOutletId);
      } else {
        setIsLoading(false);
      }
    } catch {
      setMessage("Gagal memuat outlet.");
      setIsLoading(false);
    }
  }

  async function loadInventory(nextOutletId = outletId) {
    if (!nextOutletId) return;
    setIsLoading(true);
    setMessage(null);
    const query = `outletId=${encodeURIComponent(nextOutletId)}`;
    const [balancesResponse, movementsResponse, catalogResponse] =
      await Promise.all([
        fetch(`/api/inventory/balances?${query}`),
        fetch(`/api/inventory/movements?${query}`),
        fetch(`/api/catalog?${query}`),
      ]);
    if (
      balancesResponse.status === 401 ||
      movementsResponse.status === 401 ||
      catalogResponse.status === 401
    ) {
      window.location.href = "/admin/login";
      return;
    }
    if (!balancesResponse.ok || !movementsResponse.ok || !catalogResponse.ok) {
      setMessage("Gagal memuat inventory outlet.");
      setIsLoading(false);
      return;
    }
    setBalances(
      ((await balancesResponse.json()) as ApiResponse<Balance[]>).data,
    );
    setMovements(
      ((await movementsResponse.json()) as ApiResponse<Movement[]>).data,
    );
    const catalogData = (
      (await catalogResponse.json()) as ApiResponse<{ items: CatalogItem[] }>
    ).data.items;
    setCatalog(catalogData);
    setAdjustment((current) => ({
      ...current,
      skuId: current.skuId || catalogData[0]?.skuId || "",
    }));
    setIsLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOutlets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOutletId]);

  const criticalCount = balances.filter(
    (item) => Number(item.onHandBaseQty) <= Number(item.minStockBaseQty),
  ).length;
  const selectedAdjustmentSku = catalog.find(
    (item) => item.skuId === adjustment.skuId,
  );
  const adjustmentUnit = selectedAdjustmentSku?.baseUnitCode || "unit";

  async function onAdjustmentSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    const response = await fetch("/api/inventory/adjustments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        outletId,
        skuId: adjustment.skuId,
        type: adjustment.type,
        quantityBase: parseIndonesianNumber(adjustment.quantityBase),
        note: adjustment.note || undefined,
      }),
    });
    if (!response.ok) {
      setMessage(
        "Adjustment stok gagal. Pastikan SKU dipilih dan quantity valid.",
      );
      showToast({
        tone: "error",
        title: "Adjustment stok gagal",
        description: "Pastikan SKU dipilih dan quantity valid.",
      });
      setIsSubmitting(false);
      return;
    }
    setAdjustment((current) => ({ ...current, quantityBase: "0", note: "" }));
    setMessage("Adjustment stok berhasil dicatat.");
    showToast({ tone: "success", title: "Adjustment stok berhasil dicatat" });
    await loadInventory(outletId);
    setIsSubmitting(false);
  }

  return (
    <div className="space-y-6">
      <CollapsibleSection
        title="Monitoring Inventory per Outlet"
        description="Owner/admin dapat melihat stok produk, stok kritis, dan mutasi terakhir."
        collapsible={false}
        isLoading={isLoading}
        loadingText="Memuat ringkasan inventory..."
        actions={
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadInventory()}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          <Metric
            icon={Boxes}
            label="SKU Dimonitor"
            value={formatQty(balances.length)}
          />
          <Metric
            icon={Boxes}
            label="Total Stok Dasar"
            value={`${formatQty(
              balances.reduce(
                (sum, item) => sum + Number(item.onHandBaseQty),
                0,
              ),
            )} satuan dasar`}
          />
          <Metric
            icon={AlertTriangle}
            label="Stok Kritis"
            value={formatQty(criticalCount)}
          />
        </div>
        {message ? (
          <p className="mt-4 text-sm text-destructive">{message}</p>
        ) : null}
        {isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Memuat inventory...
          </p>
        ) : null}
      </CollapsibleSection>

      {access.canCreate ? (
        <CollapsibleSection
          title="Stok Masuk / Adjustment"
          description="Input stok awal, pembelian, atau koreksi langsung dari dashboard."
        >
          <form
            className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.6fr_1.2fr_auto]"
            onSubmit={onAdjustmentSubmit}
          >
          <div className="space-y-2">
            <Label>SKU</Label>
            <select
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={adjustment.skuId}
              onChange={(event) =>
                setAdjustment({ ...adjustment, skuId: event.target.value })
              }
            >
              {catalog.map((item) => (
                <option key={item.skuId} value={item.skuId}>
                  {item.skuCode} - {item.skuName}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Tipe</Label>
            <select
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={adjustment.type}
              onChange={(event) =>
                setAdjustment({ ...adjustment, type: event.target.value })
              }
            >
              <option value="purchase">Pembelian / Stok Masuk</option>
              <option value="opening">Stok Awal</option>
              <option value="adjustment">Koreksi Manual</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Qty Dasar ({adjustmentUnit})</Label>
            <input
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              inputMode="decimal"
              value={adjustment.quantityBase}
              onChange={(event) =>
                setAdjustment({
                  ...adjustment,
                  quantityBase: formatNumberInput(event.target.value),
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Catatan</Label>
            <input
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={adjustment.note}
              onChange={(event) =>
                setAdjustment({ ...adjustment, note: event.target.value })
              }
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={isSubmitting || !catalog.length}>
              <Plus className="h-4 w-4" />
              Simpan
            </Button>
          </div>
          </form>
        </CollapsibleSection>
      ) : null}

      <CollapsibleSection
        title="Stok Produk"
        description={`${visibleBalances.length} dari ${balances.length} balance terbaru per SKU dan outlet.`}
        isLoading={isLoading}
        loadingText="Memuat stok produk..."
      >
        <ListControls
          search={balanceSearch}
          onSearchChange={setBalanceSearch}
          searchPlaceholder="Cari SKU atau produk..."
          filters={[
            {
              label: "Status",
              value: balanceStatusFilter,
              onChange: setBalanceStatusFilter,
              options: [
                { value: "all", label: "Semua" },
                { value: "critical", label: "Kritis" },
                { value: "safe", label: "Aman" },
              ],
            },
          ]}
          sort={balanceSortBy}
          onSortChange={setBalanceSortBy}
          sortOptions={[
            { value: "sku-asc", label: "SKU A-Z" },
            { value: "sku-desc", label: "SKU Z-A" },
            { value: "name-asc", label: "Produk A-Z" },
            { value: "stock-desc", label: "Stok tertinggi" },
            { value: "stock-asc", label: "Stok terendah" },
            { value: "critical", label: "Kritis dulu" },
          ]}
        />
        <div className="mt-4">
          <PaginationControls
            page={balancePage}
            pageSize={balancePageSize}
            total={visibleBalances.length}
            onPageChange={setBalancePage}
            onPageSizeChange={(value) => {
              setBalancePageSize(value);
              setBalancePage(1);
            }}
          />
        </div>
        <div className="mt-4 overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Produk</th>
                <th className="px-4 py-3 font-medium">On Hand + Satuan</th>
                <th className="px-4 py-3 font-medium">Reserved + Satuan</th>
                <th className="px-4 py-3 font-medium">Hold + Satuan</th>
                <th className="px-4 py-3 font-medium">Min + Satuan</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {pagedBalances.map((item) => {
                const isCritical =
                  Number(item.onHandBaseQty) <= Number(item.minStockBaseQty);
                return (
                  <tr
                    key={`${item.outletId}-${item.skuId}`}
                    className="border-t"
                  >
                    <td className="px-4 py-3">{item.skuCode}</td>
                    <td className="px-4 py-3">{item.skuName}</td>
                    <td className="px-4 py-3">
                      {formatQty(item.onHandBaseQty)}{" "}
                      {item.minStockUnitCode || "unit"}
                    </td>
                    <td className="px-4 py-3">
                      {formatQty(item.reservedBaseQty)}{" "}
                      {item.minStockUnitCode || "unit"}
                    </td>
                    <td className="px-4 py-3">
                      {formatQty(item.holdBaseQty)}{" "}
                      {item.minStockUnitCode || "unit"}
                    </td>
                    <td className="px-4 py-3">
                      {formatQty(item.minStockBaseQty)}{" "}
                      {item.minStockUnitCode || "unit"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          isCritical ? "text-destructive" : "text-primary"
                        }
                      >
                        {isCritical ? "Kritis" : "Aman"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!visibleBalances.length && !isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Data stok tidak ditemukan.
          </p>
        ) : null}
      </CollapsibleSection>

      <CollapsibleSection
        title="Mutasi Terakhir"
        description={`${visibleMovements.length} dari ${movements.length} mutasi sale, waste, adjustment, transfer, dan opening stok.`}
        isLoading={isLoading}
        loadingText="Memuat mutasi stok terakhir..."
      >
        <ListControls
          search={movementSearch}
          onSearchChange={setMovementSearch}
          searchPlaceholder="Cari tipe, referensi, catatan..."
          filters={[
            {
              label: "Tipe",
              value: movementTypeFilter,
              onChange: setMovementTypeFilter,
              options: [
                { value: "all", label: "Semua tipe" },
                ...movementTypeOptions,
              ],
            },
          ]}
          sort={movementSortBy}
          onSortChange={setMovementSortBy}
          sortOptions={[
            { value: "date-desc", label: "Terbaru" },
            { value: "date-asc", label: "Terlama" },
            { value: "type-asc", label: "Tipe A-Z" },
            { value: "qty-desc", label: "Qty terbesar" },
            { value: "qty-asc", label: "Qty terkecil" },
          ]}
        />
        <div className="mt-4">
          <PaginationControls
            page={movementPage}
            pageSize={movementPageSize}
            total={visibleMovements.length}
            onPageChange={setMovementPage}
            onPageSizeChange={(value) => {
              setMovementPageSize(value);
              setMovementPage(1);
            }}
          />
        </div>
        <div className="mt-4 overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Tanggal</th>
                <th className="px-4 py-3 font-medium">Jenis Mutasi</th>
                <th className="px-4 py-3 font-medium">SKU / Produk</th>
                <th className="px-4 py-3 font-medium">Arah</th>
                <th className="px-4 py-3 font-medium">Qty Dasar + Satuan</th>
                <th className="px-4 py-3 font-medium">Referensi</th>
                <th className="px-4 py-3 font-medium">Catatan</th>
              </tr>
            </thead>
            <tbody>
              {pagedMovements.map((item) => {
                const qty = Number(item.quantityBase);
                const isOut = qty < 0;
                return (
                  <tr key={item.id} className="border-t">
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">
                        {movementTypeLabel(item.type)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.type}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{item.skuCode || "-"}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.skuName || item.skuId}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                          isOut
                            ? "bg-red-50 text-red-700"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {isOut ? (
                          <TrendingDown className="h-3 w-3" />
                        ) : (
                          <TrendingUp className="h-3 w-3" />
                        )}
                        {isOut ? "Keluar" : "Masuk"}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3 font-semibold ${isOut ? "text-destructive" : "text-primary"}`}
                    >
                      {formatQty(item.quantityBase)}{" "}
                      {item.baseUnitCode || "unit"}
                    </td>
                    <td className="px-4 py-3">
                      <p>{referenceLabel(item.referenceType)}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.referenceType || "-"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.note || "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!visibleMovements.length && !isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Data mutasi tidak ditemukan.
          </p>
        ) : null}
      </CollapsibleSection>
    </div>
  );
}

function Metric(props: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border p-4">
      <props.icon className="mb-3 h-5 w-5 text-primary" />
      <p className="text-sm text-muted-foreground">{props.label}</p>
      <p className="mt-1 text-2xl font-semibold">{props.value}</p>
    </div>
  );
}

function parseIndonesianNumber(value: string) {
  return Number(value.replace(/\./g, "").replace(",", "."));
}

function formatNumberInput(value: string) {
  const cleaned = value.replace(/[^\d,]/g, "");
  const [wholeRaw, decimalRaw] = cleaned.split(",");
  const whole = wholeRaw.replace(/^0+(?=\d)/, "") || "0";
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (cleaned.includes(",")) {
    return `${grouped},${decimalRaw ?? ""}`;
  }
  return grouped;
}

function formatQty(value: string | number) {
  return Number(value ?? 0).toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
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

function movementTypeLabel(type: string) {
  const labels: Record<string, string> = {
    opening: "Stok awal",
    purchase: "Stok masuk",
    sale: "Penjualan",
    refund: "Retur",
    waste: "Remahan / rusak",
    adjustment: "Koreksi stok",
    transfer_in: "Transfer masuk",
    transfer_out: "Transfer keluar",
  };
  return labels[type] ?? type;
}

function referenceLabel(referenceType: string | null) {
  const labels: Record<string, string> = {
    sale: "Transaksi penjualan",
    waste_adjustment: "Adjustment remahan",
    dashboard_inventory_adjustment: "Input dashboard",
  };
  return referenceType ? (labels[referenceType] ?? referenceType) : "-";
}
