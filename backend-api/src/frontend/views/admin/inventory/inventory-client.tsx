"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Download,
  PackageSearch,
  PackageCheck,
  Pencil,
  Printer,
  Power,
  PowerOff,
  X,
  ArrowRightLeft,
  CreditCard,
  Plus,
  RefreshCw,
  Send,
  Truck,
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
import { confirmAction, useToast } from "../_components/toast-provider";
import { useRolePermissions } from "../_components/use-role-permissions";
import { SearchableSelect } from "../_components/searchable-select";
import { allOutletsValue, useSelectedOutlet } from "@/frontend/controllers/selected-outlet-provider";
import { getOutlets } from "@/frontend/controllers/admin-data-cache";
import { useRealtimeEvents } from "@/frontend/controllers/use-realtime-events";

type Outlet = { id: string; name: string; code: string; isActive?: boolean };
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
  batchId: string | null;
  lotCode: string | null;
  expiryDate: string | null;
  quantityBase: string;
  quantityInput: string | null;
  baseUnitCode: string | null;
  referenceType: string | null;
  note: string | null;
  createdAt: string;
};
type InventoryBatch = {
  id: string;
  outletId: string;
  skuId: string;
  skuCode: string;
  skuName: string;
  lotCode: string;
  expiryDate: string | null;
  receivedAt: string;
  initialBaseQty: string;
  onHandBaseQty: string;
  unitCost: string | null;
  unitCode: string;
  sourceType: string | null;
  sourceId: string | null;
  sourceItemId: string | null;
  note: string | null;
};
type CatalogItem = {
  skuId: string;
  skuCode: string;
  skuName: string;
  productName: string;
  baseUnitId: string | null;
  baseUnitCode: string | null;
  cost: string;
};
type Supplier = {
  id: string;
  name: string;
  code: string;
  phone: string | null;
  address: string | null;
  isActive: boolean;
};
type PurchaseOrder = {
  id: string;
  outletId: string;
  outletName: string;
  supplierId: string;
  supplierName: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  subtotal: string;
  paidTotal: string;
  note: string | null;
  receivedAt: string | null;
  createdAt: string;
};
type PurchaseOrderItem = {
  id: string;
  skuCode: string | null;
  nameSnapshot: string;
  quantityBase: string;
  unitCode: string | null;
  unitCost: string;
  lineTotal: string;
  receivedBaseQty: string | null;
  lotCode: string | null;
  expiryDate: string | null;
};
type PurchasePayment = {
  id: string;
  method: string;
  amount: string;
  reference: string | null;
  note: string | null;
  createdAt: string;
};
type PurchaseOrderDetail = {
  purchase: PurchaseOrder & {
    outletCode: string;
    supplierCode: string;
  };
  items: PurchaseOrderItem[];
  payments: PurchasePayment[];
};
type StockOpname = {
  id: string;
  outletId: string;
  code: string;
  status: string;
  note: string | null;
  itemCount: number;
  countedCount: number;
  differenceCount: number;
  createdAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  postedAt: string | null;
};
type StockOpnameItem = {
  id: string;
  skuId: string;
  skuCode: string;
  skuName: string;
  unitCode: string;
  systemBaseQty: string;
  physicalBaseQty: string | null;
  differenceBaseQty: string | null;
  note: string | null;
};
type StockOpnameDetail = {
  opname: StockOpname & {
    outletName: string;
    outletCode: string;
  };
  items: StockOpnameItem[];
};
type ApiResponse<T> = { data: T };

type InventoryClientMode = "inventory" | "suppliers" | "purchases" | "transfers" | "stockOpname";

export function InventoryClient({ mode = "inventory" }: { mode?: InventoryClientMode }) {
  const inventoryAccess = useRolePermissions("inventory");
  const stockOpnameAccess = useRolePermissions("stockOpname");
  const supplierAccess = useRolePermissions("suppliers");
  const purchaseAccess = useRolePermissions("purchases");
  const { showToast } = useToast();
  const { selectedOutletId } = useSelectedOutlet();
  const [outletId, setOutletId] = useState("");
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [stockOpnames, setStockOpnames] = useState<StockOpname[]>([]);
  const [stockOpnameDetail, setStockOpnameDetail] = useState<StockOpnameDetail | null>(null);
  const [stockOpnameNote, setStockOpnameNote] = useState("");
  const [stockOpnameCounts, setStockOpnameCounts] = useState<Record<string, string>>({});
  const [stockOpnameItemNotes, setStockOpnameItemNotes] = useState<Record<string, string>>({});
  const [adjustment, setAdjustment] = useState({
    skuId: "",
    type: "purchase",
    quantityBase: "0",
    lotCode: "",
    expiryDate: "",
    note: "",
  });
  const [supplierForm, setSupplierForm] = useState({
    name: "",
    code: "",
    phone: "",
    address: "",
  });
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [purchaseForm, setPurchaseForm] = useState({
    supplierId: "",
    skuId: "",
    quantityBase: "0",
    unitCost: "0",
    lotCode: "",
    expiryDate: "",
    note: "",
  });
  const [transferForm, setTransferForm] = useState({
    fromOutletId: "",
    toOutletId: "",
    skuId: "",
    quantityBase: "0",
    note: "",
  });
  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>({});
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
  const [purchaseSearch, setPurchaseSearch] = useState("");
  const [purchaseStatusFilter, setPurchaseStatusFilter] = useState("all");
  const [purchasePaymentFilter, setPurchasePaymentFilter] = useState("all");
  const [purchaseSortBy, setPurchaseSortBy] = useState("date-desc");
  const [purchasePage, setPurchasePage] = useState(1);
  const [purchasePageSize, setPurchasePageSize] = useState(5);
  const showInventorySections = mode === "inventory";
  const showSupplierSection = mode === "suppliers";
  const showPurchaseSection = mode === "purchases";
  const showTransferSection = mode === "transfers";
  const showStockOpnameSection = mode === "stockOpname";
  const access = showStockOpnameSection ? stockOpnameAccess : inventoryAccess;
  const outletRequiredMessage =
    "Pilih outlet spesifik terlebih dahulu untuk memuat persediaan dan stock opname.";

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
        const isCritical = balanceAvailableQty(item) <= Number(item.minStockBaseQty);
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
            return balanceAvailableQty(b) - balanceAvailableQty(a);
          case "stock-asc":
            return balanceAvailableQty(a) - balanceAvailableQty(b);
          case "critical":
            return (
              Number(balanceAvailableQty(a) > Number(a.minStockBaseQty)) -
                Number(balanceAvailableQty(b) > Number(b.minStockBaseQty)) ||
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
  const activeBatches = useMemo(
    () => batches.filter((item) => Number(item.onHandBaseQty) > 0),
    [batches],
  );
  const expiredBatchCount = activeBatches.filter((item) => batchExpiryState(item.expiryDate).status === "expired").length;
  const expiringBatchCount = activeBatches.filter((item) => batchExpiryState(item.expiryDate).status === "soon").length;

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
            item.lotCode ?? "",
            item.expiryDate ?? "",
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
  const visiblePurchases = useMemo(() => {
    const keyword = purchaseSearch.trim().toLowerCase();
    return purchases
      .filter((item) => {
        const matchesSearch =
          !keyword ||
          [
            item.orderNumber,
            item.supplierName,
            item.outletName,
            item.note ?? "",
            purchaseStatusLabel(item.status),
            purchasePaymentStatusLabel(item.paymentStatus),
          ]
            .join(" ")
            .toLowerCase()
            .includes(keyword);
        const matchesStatus =
          purchaseStatusFilter === "all" || item.status === purchaseStatusFilter;
        const matchesPayment =
          purchasePaymentFilter === "all" || item.paymentStatus === purchasePaymentFilter;
        return matchesSearch && matchesStatus && matchesPayment;
      })
      .sort((a, b) => {
        switch (purchaseSortBy) {
          case "date-asc":
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          case "supplier-asc":
            return a.supplierName.localeCompare(b.supplierName);
          case "supplier-desc":
            return b.supplierName.localeCompare(a.supplierName);
          case "total-desc":
            return Number(b.subtotal) - Number(a.subtotal);
          case "total-asc":
            return Number(a.subtotal) - Number(b.subtotal);
          case "status-asc":
            return (
              purchaseStatusLabel(a.status).localeCompare(purchaseStatusLabel(b.status)) ||
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
          default:
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
      });
  }, [purchasePaymentFilter, purchaseSearch, purchaseSortBy, purchaseStatusFilter, purchases]);
  const pagedPurchases = pageItems(
    visiblePurchases,
    purchasePage,
    purchasePageSize,
  );

  async function loadOutlets() {
    try {
      const outlets = await getOutlets();
      setOutlets(outlets);
      const selectedIsSpecificOutlet =
        selectedOutletId !== allOutletsValue &&
        outlets.some((outlet) => outlet.id === selectedOutletId);
      const nextOutletId = selectedIsSpecificOutlet ? selectedOutletId : "";
      setOutletId(nextOutletId);
      if (showTransferSection) {
        const transferOutlets = outlets.filter((outlet) => outlet.isActive !== false);
        const defaultFromOutletId =
          (selectedIsSpecificOutlet && transferOutlets.some((outlet) => outlet.id === selectedOutletId)
            ? selectedOutletId
            : "") || transferOutlets[0]?.id || "";
        setOutletId(defaultFromOutletId);
        setTransferForm((current) => {
          const fromOutletId =
            current.fromOutletId && transferOutlets.some((outlet) => outlet.id === current.fromOutletId)
              ? current.fromOutletId
              : defaultFromOutletId;
          const toOutletId =
            current.toOutletId &&
            current.toOutletId !== fromOutletId &&
            transferOutlets.some((outlet) => outlet.id === current.toOutletId)
              ? current.toOutletId
              : transferOutlets.find((outlet) => outlet.id !== fromOutletId)?.id ?? "";
          return {
            ...current,
            fromOutletId,
            toOutletId,
          };
        });
        if (defaultFromOutletId) {
          await loadInventory(defaultFromOutletId);
        } else {
          setMessage("Belum ada outlet yang bisa diakses user login.");
          setIsLoading(false);
        }
        return;
      }
      setTransferForm((current) => {
        const activeOutlets = outlets.filter((outlet) => outlet.isActive !== false);
        const hasValidTarget =
          current.toOutletId &&
          current.toOutletId !== nextOutletId &&
          activeOutlets.some((outlet) => outlet.id === current.toOutletId);
        return {
          ...current,
          toOutletId: hasValidTarget
            ? current.toOutletId
            : activeOutlets.find((outlet) => outlet.id !== nextOutletId)?.id ?? "",
        };
      });
      if (showSupplierSection) {
        await loadSuppliers();
        return;
      }
      if (!nextOutletId) {
        setBalances([]);
        setMovements([]);
        setCatalog([]);
        setPurchases([]);
        setStockOpnames([]);
        setStockOpnameDetail(null);
        setMessage(outletRequiredMessage);
        setIsLoading(false);
        return;
      }
      await loadInventory(nextOutletId);
    } catch {
      setMessage("Gagal memuat outlet.");
      setIsLoading(false);
    }
  }

  async function loadSuppliers() {
    setIsLoading(true);
    setMessage(null);
    const response = await fetch("/api/suppliers");
    if (response.status === 401) {
      window.location.assign("/admin/login");
      return;
    }
    if (!response.ok) {
      setMessage("Gagal memuat supplier.");
      setIsLoading(false);
      return;
    }
    setSuppliers(((await response.json()) as ApiResponse<Supplier[]>).data);
    setIsLoading(false);
  }

  async function loadInventory(nextOutletId = outletId) {
    if (!nextOutletId) {
      setBalances([]);
      setMovements([]);
      setBatches([]);
      setCatalog([]);
      setPurchases([]);
      setStockOpnames([]);
      setStockOpnameDetail(null);
      setMessage(outletRequiredMessage);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setMessage(null);
    const query = `outletId=${encodeURIComponent(nextOutletId)}`;
    const batchesRequest = showInventorySections
      ? fetch(`/api/inventory/batches?${query}`)
      : Promise.resolve(null);
    const stockOpnamesRequest = showStockOpnameSection
      ? fetch(`/api/inventory/stock-opnames?${query}`)
      : Promise.resolve(null);
    const [balancesResponse, movementsResponse, batchesResponse, catalogResponse, stockOpnamesResponse, suppliersResponse, purchasesResponse] =
      await Promise.all([
        fetch(`/api/inventory/balances?${query}`),
        fetch(`/api/inventory/movements?${query}`),
        batchesRequest,
        fetch(`/api/catalog?${query}`),
        stockOpnamesRequest,
        supplierAccess.canView || purchaseAccess.canView ? fetch("/api/suppliers") : Promise.resolve(null),
        purchaseAccess.canView ? fetch(`/api/purchases?${query}`) : Promise.resolve(null),
      ]);
    if (
      balancesResponse.status === 401 ||
      movementsResponse.status === 401 ||
      batchesResponse?.status === 401 ||
      catalogResponse.status === 401 ||
      stockOpnamesResponse?.status === 401 ||
      suppliersResponse?.status === 401 ||
      purchasesResponse?.status === 401
    ) {
      window.location.assign("/admin/login");
      return;
    }
    if (
      !balancesResponse.ok ||
      !movementsResponse.ok ||
      (batchesResponse !== null && !batchesResponse.ok) ||
      !catalogResponse.ok ||
      (stockOpnamesResponse !== null && !stockOpnamesResponse.ok) ||
      (suppliersResponse !== null && !suppliersResponse.ok) ||
      (purchasesResponse !== null && !purchasesResponse.ok)
    ) {
      setMessage("Gagal memuat persediaan outlet.");
      setIsLoading(false);
      return;
    }
    setBalances(
      ((await balancesResponse.json()) as ApiResponse<Balance[]>).data,
    );
    setMovements(
      ((await movementsResponse.json()) as ApiResponse<Movement[]>).data,
    );
    const batchData = batchesResponse
      ? ((await batchesResponse.json()) as ApiResponse<InventoryBatch[]>).data
      : [];
    const catalogData = (
      (await catalogResponse.json()) as ApiResponse<{ items: CatalogItem[] }>
    ).data.items;
    const supplierData = suppliersResponse
      ? ((await suppliersResponse.json()) as ApiResponse<Supplier[]>).data
      : [];
    const purchaseData = purchasesResponse
      ? ((await purchasesResponse.json()) as ApiResponse<PurchaseOrder[]>).data
      : [];
    const stockOpnameData = stockOpnamesResponse
      ? ((await stockOpnamesResponse.json()) as ApiResponse<StockOpname[]>).data
      : [];
    setCatalog(catalogData);
    setBatches(batchData);
    setSuppliers(supplierData);
    setPurchases(purchaseData);
    setStockOpnames(stockOpnameData);
    setStockOpnameDetail((current) =>
      current && stockOpnameData.some((item) => item.id === current.opname.id)
        ? current
        : null,
    );
    setAdjustment((current) => ({
      ...current,
      skuId: current.skuId || catalogData[0]?.skuId || "",
    }));
    setTransferForm((current) => ({
      ...current,
      skuId:
        current.skuId && catalogData.some((item) => item.skuId === current.skuId)
          ? current.skuId
          : catalogData[0]?.skuId || "",
    }));
    setPurchaseForm((current) => ({
      ...current,
      supplierId:
        current.supplierId && supplierData.some((item) => item.id === current.supplierId)
          ? current.supplierId
          : supplierData.find((item) => item.isActive)?.id || "",
      skuId:
        current.skuId && catalogData.some((item) => item.skuId === current.skuId)
          ? current.skuId
          : catalogData[0]?.skuId || "",
      unitCost:
        current.unitCost && current.unitCost !== "0"
          ? current.unitCost
          : formatNumberForInput(catalogData[0]?.cost ?? 0),
    }));
    setIsLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOutlets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOutletId, supplierAccess.canView, purchaseAccess.canView]);

  useRealtimeEvents({
    topics: ["inventory", "stockOpname", "purchases", "waste", "sales"],
    enabled: Boolean(outletId),
    debounceMs: 700,
    onEvent: () => {
      void loadInventory(outletId);
      if (stockOpnameDetail) {
        void loadStockOpnameDetail(stockOpnameDetail.opname.id);
      }
    },
  });

  const criticalCount = balances.filter(
    (item) => balanceAvailableQty(item) <= Number(item.minStockBaseQty),
  ).length;
  const selectedAdjustmentSku = catalog.find(
    (item) => item.skuId === adjustment.skuId,
  );
  const adjustmentUnit = selectedAdjustmentSku?.baseUnitCode || "unit";
  const adjustmentQty = parseIndonesianNumber(adjustment.quantityBase);
  const adjustmentNeedsBatch = ["opening", "purchase"].includes(adjustment.type) && adjustmentQty > 0;
  const purchaseQty = parseIndonesianNumber(purchaseForm.quantityBase);
  const selectedTransferSku = catalog.find(
    (item) => item.skuId === transferForm.skuId,
  );
  const transferUnit = selectedTransferSku?.baseUnitCode || "unit";
  const transferSourceOutletId = showTransferSection ? transferForm.fromOutletId : outletId;
  const activeTransferOutlets = outlets.filter((outlet) => outlet.isActive !== false);
  const transferTargetOutlets = activeTransferOutlets.filter((outlet) => outlet.id !== transferSourceOutletId);
  const selectedTransferBalance = balances.find(
    (item) => item.skuId === transferForm.skuId,
  );
  const transferQty = parseIndonesianNumber(transferForm.quantityBase);
  const transferOnHandQty = Number(selectedTransferBalance?.onHandBaseQty ?? 0);
  const transferAvailableQty = Math.max(
    0,
    transferOnHandQty -
      Number(selectedTransferBalance?.reservedBaseQty ?? 0) -
      Number(selectedTransferBalance?.holdBaseQty ?? 0),
  );
  const transferMinQty = Number(selectedTransferBalance?.minStockBaseQty ?? 0);
  const transferRemainingQty = transferAvailableQty - transferQty;
  const transferExceedsStock = transferQty > transferAvailableQty;
  const transferWillBeCritical = transferRemainingQty <= transferMinQty;
  const selectedPurchaseSku = catalog.find((item) => item.skuId === purchaseForm.skuId);
  const purchaseUnit = selectedPurchaseSku?.baseUnitCode || "unit";
  const activeStockOpname = stockOpnameDetail?.opname ?? null;
  const activeStockOpnameItems = stockOpnameDetail?.items ?? [];
  const selectedOpnameOutlet = outlets.find((item) => item.id === outletId);
  const stockOpnameSummary = useMemo(() => {
    const items = stockOpnameDetail?.items ?? [];
    return items.reduce(
      (summary, item) => {
        const physicalInput = stockOpnameCounts[item.id];
        const physical =
          physicalInput !== undefined && physicalInput !== ""
            ? parseIndonesianNumber(physicalInput)
            : Number(item.physicalBaseQty ?? Number.NaN);
        const hasPhysical = Number.isFinite(physical);
        const diff = hasPhysical ? physical - Number(item.systemBaseQty) : Number(item.differenceBaseQty ?? 0);
        return {
          totalItems: summary.totalItems + 1,
          countedItems: summary.countedItems + Number(hasPhysical),
          differenceItems: summary.differenceItems + Number(Math.abs(diff) >= 0.0005),
          totalDifference: summary.totalDifference + (Number.isFinite(diff) ? diff : 0),
        };
      },
      { totalItems: 0, countedItems: 0, differenceItems: 0, totalDifference: 0 },
    );
  }, [stockOpnameCounts, stockOpnameDetail]);

  async function onAdjustmentSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!outletId) {
      setMessage(outletRequiredMessage);
      showToast({
        tone: "error",
        title: "Outlet belum dipilih",
        description: outletRequiredMessage,
      });
      return;
    }
    if (adjustmentNeedsBatch && (!adjustment.lotCode.trim() || !adjustment.expiryDate)) {
      setMessage("Batch/lot dan expired date wajib diisi untuk stok masuk produk.");
      showToast({
        tone: "error",
        title: "Data batch belum lengkap",
        description: "Isi kode batch/lot dan tanggal expired sebelum menambah stok.",
      });
      return;
    }
    if (!purchaseForm.lotCode.trim() || !purchaseForm.expiryDate) {
      setMessage("Batch/lot dan expired date wajib diisi untuk PO produk.");
      showToast({
        tone: "error",
        title: "Data batch PO belum lengkap",
        description: "Isi kode batch/lot dan tanggal expired sebelum membuat PO.",
      });
      return;
    }
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
        lotCode: adjustment.lotCode.trim() || undefined,
        expiryDate: adjustment.expiryDate || undefined,
        note: adjustment.note || undefined,
      }),
    });
    if (!response.ok) {
      setMessage(
        "Penyesuaian stok gagal. Pastikan SKU dipilih dan jumlah valid.",
      );
      showToast({
        tone: "error",
        title: "Penyesuaian stok gagal",
        description: "Pastikan SKU dipilih dan jumlah valid.",
      });
      setIsSubmitting(false);
      return;
    }
    setAdjustment((current) => ({ ...current, quantityBase: "0", lotCode: "", expiryDate: "", note: "" }));
    setMessage("Penyesuaian stok berhasil dicatat.");
    showToast({ tone: "success", title: "Penyesuaian stok berhasil dicatat" });
    await loadInventory(outletId);
    setIsSubmitting(false);
  }

  async function onTransferSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!transferSourceOutletId) {
      setMessage("Pilih outlet asal transfer.");
      showToast({
        tone: "error",
        title: "Outlet asal belum dipilih",
        description: "Outlet asal transfer wajib dipilih.",
      });
      return;
    }
    if (!transferForm.toOutletId) {
      setMessage("Pilih outlet tujuan transfer.");
      showToast({ tone: "error", title: "Outlet tujuan wajib dipilih" });
      return;
    }
    if (transferQty <= 0) {
      setMessage("Qty transfer wajib lebih dari 0.");
      showToast({ tone: "error", title: "Qty transfer belum valid" });
      return;
    }
    if (transferExceedsStock) {
      setMessage("Qty transfer tidak boleh melebihi stok tersisa di outlet asal.");
      showToast({
        tone: "error",
        title: "Qty melebihi stok outlet asal",
        description: `Maksimal transfer ${formatQty(transferAvailableQty)} ${transferUnit}.`,
      });
      return;
    }
    setIsSubmitting(true);
    setMessage(null);
    const response = await fetch("/api/inventory/transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromOutletId: transferSourceOutletId,
        toOutletId: transferForm.toOutletId,
        skuId: transferForm.skuId,
        quantityBase: parseIndonesianNumber(transferForm.quantityBase),
        note: transferForm.note || undefined,
      }),
    });
    if (!response.ok) {
      const errorText =
        (await apiErrorMessage(response)) ||
        (response.status === 400
          ? "Transfer stok gagal. Pastikan stok outlet asal mencukupi dan jumlah valid."
          : "Transfer stok gagal diproses.");
      setMessage(errorText);
      showToast({ tone: "error", title: "Transfer stok gagal", description: errorText });
      setIsSubmitting(false);
      return;
    }
    setTransferForm((current) => ({ ...current, quantityBase: "0", note: "" }));
    setMessage("Transfer stok berhasil dicatat.");
    showToast({ tone: "success", title: "Transfer stok berhasil dicatat" });
    await loadInventory(transferSourceOutletId);
    setIsSubmitting(false);
  }

  async function loadStockOpnameDetail(id: string) {
    setIsSubmitting(true);
    const response = await fetch(`/api/inventory/stock-opnames/${id}`);
    if (response.status === 401) {
      window.location.assign("/admin/login");
      return;
    }
    if (!response.ok) {
      const errorText = (await apiErrorMessage(response)) || "Stock opname gagal dimuat.";
      setMessage(errorText);
      showToast({ tone: "error", title: "Stock opname gagal dimuat", description: errorText });
      setIsSubmitting(false);
      return;
    }
    const detail = ((await response.json()) as ApiResponse<StockOpnameDetail>).data;
    const countedCount = detail.items.filter((item) => item.physicalBaseQty !== null).length;
    const differenceCount = detail.items.filter((item) => Math.abs(Number(item.differenceBaseQty ?? 0)) >= 0.0005).length;
    setStockOpnameDetail(detail);
    setStockOpnames((current) =>
      current.map((item) =>
        item.id === detail.opname.id
          ? {
              ...item,
              itemCount: detail.items.length,
              countedCount,
              differenceCount,
              status: detail.opname.status,
              note: detail.opname.note,
              submittedAt: detail.opname.submittedAt,
              approvedAt: detail.opname.approvedAt,
              postedAt: detail.opname.postedAt,
            }
          : item,
      ),
    );
    setStockOpnameNote(detail.opname.note ?? "");
    setStockOpnameCounts(
      Object.fromEntries(
        detail.items.map((item) => [
          item.id,
          item.physicalBaseQty === null ? "" : formatNumberForInput(item.physicalBaseQty),
        ]),
      ),
    );
    setStockOpnameItemNotes(
      Object.fromEntries(detail.items.map((item) => [item.id, item.note ?? ""])),
    );
    setIsSubmitting(false);
  }

  async function createStockOpname() {
    if (!outletId) {
      setMessage(outletRequiredMessage);
      showToast({ tone: "error", title: "Outlet belum dipilih", description: outletRequiredMessage });
      return;
    }
    setIsSubmitting(true);
    const response = await fetch("/api/inventory/stock-opnames", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        outletId,
        note: stockOpnameNote || undefined,
      }),
    });
    if (!response.ok) {
      const errorText = (await apiErrorMessage(response)) || "Stock opname gagal dibuat.";
      setMessage(errorText);
      showToast({ tone: "error", title: "Stock opname gagal dibuat", description: errorText });
      setIsSubmitting(false);
      return;
    }
    const created = ((await response.json()) as ApiResponse<StockOpname>).data;
    showToast({ tone: "success", title: "Daftar stock opname dibuat" });
    await loadInventory(outletId);
    await loadStockOpnameDetail(created.id);
    setIsSubmitting(false);
  }

  async function saveStockOpnameCounts() {
    if (!stockOpnameDetail) return;
    const items = activeStockOpnameItems
      .map((item) => {
        const rawQty = stockOpnameCounts[item.id];
        if (rawQty === undefined || rawQty === "") return null;
        const physicalBaseQty = parseIndonesianNumber(rawQty);
        if (!Number.isFinite(physicalBaseQty) || physicalBaseQty < 0) return null;
        return {
          itemId: item.id,
          physicalBaseQty,
          note: stockOpnameItemNotes[item.id] || undefined,
        };
      })
      .filter(
        (item): item is { itemId: string; physicalBaseQty: number; note: string | undefined } =>
          Boolean(item),
      );
    if (!items.length) {
      showToast({ tone: "error", title: "Belum ada hasil fisik yang diisi" });
      return;
    }
    setIsSubmitting(true);
    const response = await fetch(`/api/inventory/stock-opnames/${stockOpnameDetail.opname.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    if (!response.ok) {
      const errorText = (await apiErrorMessage(response)) || "Hasil hitung gagal disimpan.";
      setMessage(errorText);
      showToast({ tone: "error", title: "Hasil hitung gagal disimpan", description: errorText });
      setIsSubmitting(false);
      return;
    }
    const detail = ((await response.json()) as ApiResponse<StockOpnameDetail>).data;
    setStockOpnameDetail(detail);
    showToast({ tone: "success", title: "Hasil hitung tersimpan" });
    await loadInventory(outletId);
    setIsSubmitting(false);
  }

  async function runStockOpnameAction(action: "submit" | "approve" | "post") {
    if (!stockOpnameDetail) return;
    const labels = {
      submit: "Submit hasil hitung",
      approve: "Approve selisih",
      post: "Posting adjustment",
    };
    if (action === "post") {
      const confirmed = await confirmAction(
        "Posting stock opname? Selisih yang sudah diapprove akan mengubah stok dan membuat mutasi adjustment.",
      );
      if (!confirmed) return;
    }
    setIsSubmitting(true);
    const response = await fetch(`/api/inventory/stock-opnames/${stockOpnameDetail.opname.id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: stockOpnameNote || undefined }),
    });
    if (!response.ok) {
      const errorText = (await apiErrorMessage(response)) || `${labels[action]} gagal.`;
      setMessage(errorText);
      showToast({ tone: "error", title: `${labels[action]} gagal`, description: errorText });
      setIsSubmitting(false);
      return;
    }
    showToast({ tone: "success", title: `${labels[action]} berhasil` });
    await loadInventory(outletId);
    await loadStockOpnameDetail(stockOpnameDetail.opname.id);
    setIsSubmitting(false);
  }

  async function onSupplierSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    const response = await fetch(editingSupplierId ? `/api/suppliers/${editingSupplierId}` : "/api/suppliers", {
      method: editingSupplierId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: supplierForm.name,
        code: supplierForm.code,
        phone: supplierForm.phone || null,
        address: supplierForm.address || null,
      }),
    });
    if (!response.ok) {
      setMessage("Supplier gagal disimpan. Pastikan kode supplier unik.");
      showToast({ tone: "error", title: "Supplier gagal disimpan" });
      setIsSubmitting(false);
      return;
    }
    resetSupplierForm();
    setMessage(editingSupplierId ? "Supplier berhasil diperbarui." : "Supplier berhasil dibuat.");
    showToast({ tone: "success", title: editingSupplierId ? "Supplier berhasil diperbarui" : "Supplier berhasil dibuat" });
    if (showSupplierSection) {
      await loadSuppliers();
    } else {
      await loadInventory(outletId);
    }
    setIsSubmitting(false);
  }

  function startEditSupplier(item: Supplier) {
    setEditingSupplierId(item.id);
    setSupplierForm({
      name: item.name,
      code: item.code,
      phone: item.phone ?? "",
      address: item.address ?? "",
    });
    setMessage(null);
  }

  function resetSupplierForm() {
    setEditingSupplierId(null);
    setSupplierForm({ name: "", code: "", phone: "", address: "" });
  }

  async function toggleSupplierActive(item: Supplier) {
    const nextActive = !item.isActive;
    const actionLabel = nextActive ? "aktifkan" : "nonaktifkan";
    if (!(await confirmAction(`Yakin ingin ${actionLabel} supplier ${item.name}?`))) {
      return;
    }
    setIsSubmitting(true);
    setMessage(null);
    const response = await fetch(`/api/suppliers/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: nextActive }),
    });
    if (!response.ok) {
      setMessage("Status supplier gagal diperbarui.");
      showToast({ tone: "error", title: "Status supplier gagal diperbarui" });
      setIsSubmitting(false);
      return;
    }
    if (editingSupplierId === item.id) {
      resetSupplierForm();
    }
    setMessage(`Supplier berhasil di${nextActive ? "aktifkan" : "nonaktifkan"}.`);
    showToast({ tone: "success", title: `Supplier berhasil di${nextActive ? "aktifkan" : "nonaktifkan"}` });
    await loadSuppliers();
    setIsSubmitting(false);
  }

  async function onPurchaseSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!outletId) {
      setMessage(outletRequiredMessage);
      showToast({
        tone: "error",
        title: "Outlet tujuan belum dipilih",
        description: outletRequiredMessage,
      });
      return;
    }
    setIsSubmitting(true);
    setMessage(null);
    const response = await fetch("/api/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        outletId,
        supplierId: purchaseForm.supplierId,
        note: purchaseForm.note || undefined,
        items: [
          {
            skuId: purchaseForm.skuId,
            quantityBase: parseIndonesianNumber(purchaseForm.quantityBase),
            unitCost: parseIndonesianNumber(purchaseForm.unitCost),
            lotCode: purchaseForm.lotCode.trim(),
            expiryDate: purchaseForm.expiryDate,
          },
        ],
      }),
    });
    if (!response.ok) {
      setMessage("Pesanan pembelian gagal dibuat. Pastikan supplier, SKU, qty, dan harga beli valid.");
      showToast({ tone: "error", title: "Pesanan pembelian gagal dibuat" });
      setIsSubmitting(false);
      return;
    }
    setPurchaseForm((current) => ({ ...current, quantityBase: "0", lotCode: "", expiryDate: "", note: "" }));
    setMessage("Pesanan pembelian berhasil dibuat.");
    showToast({ tone: "success", title: "Pesanan pembelian berhasil dibuat" });
    await loadInventory(outletId);
    setIsSubmitting(false);
  }

  async function receivePurchase(item: PurchaseOrder) {
    if (!outletId) {
      setMessage(outletRequiredMessage);
      showToast({
        tone: "error",
        title: "Outlet tujuan belum dipilih",
        description: outletRequiredMessage,
      });
      return;
    }
    if (!(await confirmAction(`Terima barang untuk ${item.orderNumber}? Stok akan bertambah otomatis.`))) {
      return;
    }
    setIsSubmitting(true);
    const response = await fetch(`/api/purchases/${item.id}/receive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: `Penerimaan barang ${item.orderNumber}` }),
    });
    if (!response.ok) {
      setMessage("Penerimaan barang gagal diproses.");
      showToast({ tone: "error", title: "Penerimaan barang gagal" });
      setIsSubmitting(false);
      return;
    }
    setMessage("Barang diterima dan stok berhasil ditambahkan.");
    showToast({ tone: "success", title: "Barang diterima dan stok bertambah" });
    await loadInventory(outletId);
    setIsSubmitting(false);
  }

  async function payPurchase(item: PurchaseOrder) {
    if (!outletId) {
      setMessage(outletRequiredMessage);
      showToast({
        tone: "error",
        title: "Outlet tujuan belum dipilih",
        description: outletRequiredMessage,
      });
      return;
    }
    const amount = parseIndonesianNumber(paymentInputs[item.id] ?? "");
    if (amount <= 0) {
      setMessage("Nominal pembayaran supplier wajib lebih dari 0.");
      return;
    }
    setIsSubmitting(true);
    const response = await fetch(`/api/purchases/${item.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        method: "transfer",
        note: `Pembayaran supplier ${item.orderNumber}`,
      }),
    });
    if (!response.ok) {
      setMessage("Pembayaran supplier gagal. Pastikan nominal tidak melebihi sisa hutang.");
      showToast({ tone: "error", title: "Pembayaran supplier gagal" });
      setIsSubmitting(false);
      return;
    }
    setPaymentInputs((current) => ({ ...current, [item.id]: "" }));
    setMessage("Pembayaran supplier berhasil dicatat.");
    showToast({ tone: "success", title: "Pembayaran supplier berhasil dicatat" });
    await loadInventory(outletId);
    setIsSubmitting(false);
  }

  async function printPurchaseInvoice(item: PurchaseOrder) {
    const response = await fetch(`/api/purchases/${item.id}`);
    if (!response.ok) {
      showToast({ tone: "error", title: "Invoice pembelian gagal dimuat" });
      return;
    }
    const detail = ((await response.json()) as ApiResponse<PurchaseOrderDetail>).data;
    const invoiceWindow = window.open("", "_blank", "width=920,height=720");
    if (!invoiceWindow) {
      showToast({
        tone: "error",
        title: "Popup cetak diblokir",
        description: "Izinkan popup browser untuk mencetak invoice pembelian.",
      });
      return;
    }

    invoiceWindow.document.open();
    invoiceWindow.document.write(createPurchaseInvoiceHtml(detail));
    invoiceWindow.document.close();
    invoiceWindow.focus();
    window.setTimeout(() => invoiceWindow.print(), 300);
  }

  function exportPurchaseExcel() {
    downloadTableExcel({
      title: "Data Pesanan Pembelian",
      filePrefix: "pesanan-pembelian",
      headers: [
        "Nomor PO",
        "Tanggal",
        "Outlet",
        "Supplier",
        "Status Barang",
        "Status Bayar",
        "Total",
        "Terbayar",
        "Sisa",
        "Catatan",
      ],
      rows: visiblePurchases.map((item) => {
        const remainingDebt = Math.max(0, Number(item.subtotal) - Number(item.paidTotal));
        return [
          item.orderNumber,
          formatDate(item.createdAt),
          item.outletName,
          item.supplierName,
          purchaseStatusLabel(item.status),
          purchasePaymentStatusLabel(item.paymentStatus),
          rupiah(item.subtotal),
          rupiah(item.paidTotal),
          rupiah(remainingDebt),
          item.note ?? "-",
        ];
      }),
    });
  }

  return (
    <div className="space-y-6">
      {showInventorySections ? (
        <CollapsibleSection
        title="Pemantauan Persediaan per Outlet"
        description="Owner/admin dapat melihat stok produk, stok kritis, dan mutasi terakhir."
        collapsible={false}
        isLoading={isLoading}
        loadingText="Memuat ringkasan persediaan..."
        actions={
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="space-y-2">
              <Label>Outlet persediaan</Label>
              <SearchableSelect
                className="min-w-64"
                value={outletId}
                onChange={(nextOutletId) => {
                  setOutletId(nextOutletId);
                  setStockOpnameDetail(null);
                  if (nextOutletId) {
                    void loadInventory(nextOutletId);
                  }
                }}
                options={[
                  { value: "", label: "Pilih outlet" },
                  ...outlets
                  .filter((item) => item.isActive !== false)
                  .map((item) => ({
                    value: item.id,
                    label: `${item.name} (${item.code})`,
                    keywords: `${item.name} ${item.code}`,
                  })),
                ]}
                placeholder="Pilih outlet"
                searchPlaceholder="Cari outlet..."
                emptyText="Outlet tidak ditemukan."
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadInventory()}
              disabled={!outletId}
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
            Memuat persediaan...
          </p>
        ) : null}
        </CollapsibleSection>
      ) : null}

      {showInventorySections ? (
        <CollapsibleSection
          title="Batch & Expired Date"
          description="Pantau stok per lot agar produk yang mendekati expired bisa diprioritaskan atau diajukan waste."
          isLoading={isLoading}
          loadingText="Memuat batch stok..."
        >
          <div className="grid gap-4 md:grid-cols-3">
            <Metric
              icon={PackageSearch}
              label="Batch Aktif"
              value={formatQty(activeBatches.length)}
            />
            <Metric
              icon={AlertTriangle}
              label="Akan Expired <= 30 Hari"
              value={formatQty(expiringBatchCount)}
            />
            <Metric
              icon={TrendingDown}
              label="Sudah Expired"
              value={formatQty(expiredBatchCount)}
            />
          </div>
          <div className="mt-4 overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">SKU / Produk</th>
                  <th className="px-4 py-3 font-medium">Batch / Lot</th>
                  <th className="px-4 py-3 font-medium">Expired</th>
                  <th className="px-4 py-3 font-medium">Sisa Batch</th>
                  <th className="px-4 py-3 font-medium">Sumber</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {activeBatches.map((item) => {
                  const expiry = batchExpiryState(item.expiryDate);
                  return (
                    <tr key={item.id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <p className="font-medium">{item.skuCode}</p>
                        <p className="text-xs text-muted-foreground">{item.skuName}</p>
                      </td>
                      <td className="px-4 py-3 font-medium">{item.lotCode}</td>
                      <td className="px-4 py-3">{formatDateOnly(item.expiryDate)}</td>
                      <td className="px-4 py-3">
                        {formatQty(item.onHandBaseQty)} {item.unitCode || "unit"}
                        <p className="text-xs text-muted-foreground">
                          dari {formatQty(item.initialBaseQty)} {item.unitCode || "unit"}
                        </p>
                      </td>
                      <td className="px-4 py-3">{batchSourceLabel(item.sourceType)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${expiry.className}`}>
                          {expiry.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!activeBatches.length && !isLoading ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Belum ada batch aktif untuk outlet ini. Batch baru akan tercatat dari stok masuk atau penerimaan pembelian berikutnya.
            </p>
          ) : null}
        </CollapsibleSection>
      ) : null}

      {showInventorySections && access.canCreate ? (
        <CollapsibleSection
          title="Stok Masuk / Penyesuaian"
          description="Input stok awal atau koreksi manual. Untuk pembelian supplier, gunakan alur pesanan pembelian di bawah."
        >
          <form
            className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.6fr_0.8fr_0.8fr_1.2fr_auto]"
            onSubmit={onAdjustmentSubmit}
          >
          <div className="space-y-2">
            <Label>SKU</Label>
            <SearchableSelect
              value={adjustment.skuId}
              onChange={(value) => setAdjustment({ ...adjustment, skuId: value })}
              options={catalog.map((item) => ({
                value: item.skuId,
                label: `${item.skuCode} - ${item.skuName}`,
                description: item.productName,
                keywords: `${item.skuCode} ${item.skuName} ${item.productName}`,
              }))}
              placeholder="Pilih SKU"
              searchPlaceholder="Cari SKU..."
              emptyText="SKU tidak ditemukan."
            />
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
            <Label>Batch / Lot</Label>
            <input
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:bg-muted"
              value={adjustment.lotCode}
              disabled={!adjustmentNeedsBatch}
              placeholder={adjustmentNeedsBatch ? "LOT-001" : "Tidak wajib"}
              onChange={(event) =>
                setAdjustment({ ...adjustment, lotCode: event.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Expired</Label>
            <input
              type="date"
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:bg-muted"
              value={adjustment.expiryDate}
              disabled={!adjustmentNeedsBatch}
              onChange={(event) =>
                setAdjustment({ ...adjustment, expiryDate: event.target.value })
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
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                !catalog.length ||
                (adjustmentNeedsBatch && (!adjustment.lotCode.trim() || !adjustment.expiryDate))
              }
            >
              <Plus className="h-4 w-4" />
              Simpan
            </Button>
          </div>
          </form>
        </CollapsibleSection>
      ) : null}

      {showStockOpnameSection ? (
        <CollapsibleSection
          title="Stock Opname"
          description="Ruang kerja hitung stok fisik, review selisih, approval, dan posting adjustment."
        >
          {!outletId ? (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{outletRequiredMessage}</p>
              </div>
            </div>
          ) : null}

          <div className="space-y-5">
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
                <div className="space-y-2">
                  <Label>Outlet opname</Label>
                  <SearchableSelect
                    value={outletId}
                    onChange={(nextOutletId) => {
                      setOutletId(nextOutletId);
                      setStockOpnameDetail(null);
                      if (nextOutletId) {
                        void loadInventory(nextOutletId);
                      }
                    }}
                    options={[
                      { value: "", label: "Pilih outlet" },
                      ...outlets
                      .filter((item) => item.isActive !== false)
                      .map((item) => ({
                        value: item.id,
                        label: `${item.name} (${item.code})`,
                        keywords: `${item.name} ${item.code}`,
                      })),
                    ]}
                    placeholder="Pilih outlet"
                    searchPlaceholder="Cari outlet..."
                    emptyText="Outlet tidak ditemukan."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Catatan sesi</Label>
                  <input
                    className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={stockOpnameNote}
                    onChange={(event) => setStockOpnameNote(event.target.value)}
                    placeholder="Contoh: Opname akhir bulan"
                  />
                </div>
                <div className="flex lg:justify-end">
                  {access.canCreate ? (
                    <Button
                      type="button"
                      className="w-full lg:w-auto"
                      onClick={() => void createStockOpname()}
                      disabled={isSubmitting || !outletId || !catalog.length}
                    >
                      <ClipboardList className="h-4 w-4" />
                      Generate Opname
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <MetricText label="Outlet" value={selectedOpnameOutlet ? `${selectedOpnameOutlet.name} (${selectedOpnameOutlet.code})` : "Belum dipilih"} />
                <MetricText label="SKU Dimonitor" value={outletId ? formatQty(catalog.length) : "-"} />
                <MetricText label="Sesi Opname" value={formatQty(stockOpnames.length)} />
                <MetricText
                  label="Sesi Aktif"
                  value={activeStockOpname ? stockOpnameStatusLabel(activeStockOpname.status) : "Belum ada"}
                />
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[22rem_1fr]">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Sesi Opname</p>
                    <p className="text-xs text-muted-foreground">Pilih sesi untuk input atau review hasil hitung.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void loadInventory()}
                    disabled={!outletId || isLoading}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                </div>
                <div className="max-h-[34rem] space-y-2 overflow-y-auto rounded-lg border bg-background p-2">
                  {stockOpnames.length ? (
                    stockOpnames.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`w-full rounded-md border p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 ${
                          activeStockOpname?.id === item.id ? "border-primary bg-primary/5" : "bg-background"
                        }`}
                        onClick={() => void loadStockOpnameDetail(item.id)}
                        disabled={isSubmitting}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{item.code}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
                          </div>
                          <StockOpnameStatusBadge status={item.status} />
                        </div>
                        <div className="mt-3">
                          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                            <span>{formatQty(item.countedCount)} / {formatQty(item.itemCount)} item</span>
                            <span>{formatQty(item.differenceCount)} selisih</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{
                                width: `${item.itemCount ? Math.min(100, (item.countedCount / item.itemCount) * 100) : 0}%`,
                              }}
                            />
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                      {isLoading ? "Memuat sesi stock opname..." : "Belum ada sesi stock opname untuk outlet ini."}
                    </div>
                  )}
                </div>
              </div>

              <div className="min-w-0 space-y-4">
                {activeStockOpname ? (
                  <>
                    <div className="rounded-lg border bg-background p-4">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold">{activeStockOpname.code}</h3>
                            <StockOpnameStatusBadge status={activeStockOpname.status} />
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {stockOpnameSummary.countedItems < stockOpnameSummary.totalItems
                              ? `${formatQty(stockOpnameSummary.totalItems - stockOpnameSummary.countedItems)} item belum dihitung.`
                              : "Semua item sudah memiliki hasil fisik."}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              downloadTableExcel({
                                title: `Daftar Stock Opname ${activeStockOpname.code}`,
                                filePrefix: `stock-opname-${activeStockOpname.code}`,
                                headers: ["SKU", "Produk", "Stok Sistem", "Stok Fisik", "Selisih", "Satuan", "Catatan"],
                                rows: activeStockOpnameItems.map((item) => [
                                  item.skuCode,
                                  item.skuName,
                                  formatQty(item.systemBaseQty),
                                  stockOpnameCounts[item.id] || "",
                                  formatQty(stockOpnameDifference(item, stockOpnameCounts[item.id])),
                                  item.unitCode || "unit",
                                  stockOpnameItemNotes[item.id] || "",
                                ]),
                              })
                            }
                          >
                            <Download className="h-4 w-4" />
                            Export
                          </Button>
                          {["draft", "counted"].includes(activeStockOpname.status) && access.canEdit ? (
                            <Button type="button" onClick={() => void saveStockOpnameCounts()} disabled={isSubmitting}>
                              <PackageCheck className="h-4 w-4" />
                              Simpan
                            </Button>
                          ) : null}
                          {["draft", "counted"].includes(activeStockOpname.status) && access.canEdit ? (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => void runStockOpnameAction("submit")}
                              disabled={
                                isSubmitting ||
                                stockOpnameSummary.countedItems < stockOpnameSummary.totalItems
                              }
                            >
                              <Send className="h-4 w-4" />
                              Submit
                            </Button>
                          ) : null}
                          {activeStockOpname.status === "counted" && access.canApprove ? (
                            <Button type="button" variant="outline" onClick={() => void runStockOpnameAction("approve")} disabled={isSubmitting}>
                              <CheckCircle2 className="h-4 w-4" />
                              Approve
                            </Button>
                          ) : null}
                          {activeStockOpname.status === "approved" && access.canApprove ? (
                            <Button type="button" onClick={() => void runStockOpnameAction("post")} disabled={isSubmitting}>
                              <Pencil className="h-4 w-4" />
                              Posting
                            </Button>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-4">
                        <StockOpnameStep label="Generate" isActive={activeStockOpname.status === "draft"} isDone={Boolean(activeStockOpname)} />
                        <StockOpnameStep label="Hitung Fisik" isActive={activeStockOpname.status === "counted"} isDone={["counted", "approved", "posted"].includes(activeStockOpname.status)} />
                        <StockOpnameStep label="Approval" isActive={activeStockOpname.status === "approved"} isDone={["approved", "posted"].includes(activeStockOpname.status)} />
                        <StockOpnameStep label="Posting" isActive={activeStockOpname.status === "posted"} isDone={activeStockOpname.status === "posted"} />
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-4">
                        <MetricText label="Progress" value={`${formatQty(stockOpnameSummary.countedItems)} / ${formatQty(stockOpnameSummary.totalItems)}`} />
                        <MetricText label="Item Selisih" value={formatQty(stockOpnameSummary.differenceItems)} />
                        <MetricText label="Total Selisih" value={`${formatQty(stockOpnameSummary.totalDifference)} satuan`} />
                        <MetricText label="Dibuat" value={formatDate(activeStockOpname.createdAt)} />
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-lg border bg-background">
                      <table className="w-full min-w-[980px] text-left text-sm">
                        <thead className="bg-muted text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3 font-medium">SKU / Produk</th>
                            <th className="px-4 py-3 font-medium">Stok Sistem</th>
                            <th className="px-4 py-3 font-medium">Hasil Fisik</th>
                            <th className="px-4 py-3 font-medium">Selisih</th>
                            <th className="px-4 py-3 font-medium">Catatan Item</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeStockOpnameItems.map((item) => {
                            const diff = stockOpnameDifference(item, stockOpnameCounts[item.id]);
                            const isEditable = ["draft", "counted"].includes(activeStockOpname.status) && access.canEdit;
                            return (
                              <tr key={item.id} className="border-t hover:bg-muted/30">
                                <td className="px-4 py-3">
                                  <p className="font-medium">{item.skuCode}</p>
                                  <p className="text-xs text-muted-foreground">{item.skuName}</p>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="font-medium">{formatQty(item.systemBaseQty)}</span>{" "}
                                  <span className="text-muted-foreground">{item.unitCode || "unit"}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <input
                                    className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-right text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:bg-muted"
                                    inputMode="decimal"
                                    value={stockOpnameCounts[item.id] ?? ""}
                                    disabled={!isEditable}
                                    placeholder="0"
                                    onChange={(event) =>
                                      setStockOpnameCounts({
                                        ...stockOpnameCounts,
                                        [item.id]: formatNumberInput(event.target.value),
                                      })
                                    }
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <StockOpnameDifferenceBadge value={diff} unit={item.unitCode || "unit"} />
                                </td>
                                <td className="px-4 py-3">
                                  <input
                                    className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:bg-muted"
                                    value={stockOpnameItemNotes[item.id] ?? ""}
                                    disabled={!isEditable}
                                    placeholder="Opsional"
                                    onChange={(event) =>
                                      setStockOpnameItemNotes({
                                        ...stockOpnameItemNotes,
                                        [item.id]: event.target.value,
                                      })
                                    }
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="flex min-h-[24rem] items-center justify-center rounded-lg border border-dashed bg-muted/20 p-8 text-center">
                    <div className="max-w-md space-y-3">
                      <ClipboardList className="mx-auto h-10 w-10 text-primary" />
                      <div>
                        <p className="font-medium">Belum ada sesi yang dibuka</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Pilih sesi di kiri, atau generate opname baru setelah outlet dipilih.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CollapsibleSection>
      ) : null}

      {showTransferSection && access.canCreate ? (
        <CollapsibleSection
          title="Transfer Stok Antar Outlet"
          description="Pilih outlet asal dan tujuan dari daftar outlet yang boleh diakses user login."
        >
          {!transferSourceOutletId ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Belum ada outlet yang bisa diakses user login.
            </p>
          ) : null}
          {transferSourceOutletId ? (
            <form
              className="grid gap-4 lg:grid-cols-[1fr_1.2fr_1fr_0.6fr_1.2fr_auto]"
              onSubmit={onTransferSubmit}
            >
              <div className="space-y-2">
                <Label>Outlet Asal</Label>
                <SearchableSelect
                  value={transferSourceOutletId}
                  onChange={(nextFromOutletId) => {
                    const nextToOutletId =
                      transferForm.toOutletId && transferForm.toOutletId !== nextFromOutletId
                        ? transferForm.toOutletId
                        : activeTransferOutlets.find((outlet) => outlet.id !== nextFromOutletId)?.id ?? "";
                    setOutletId(nextFromOutletId);
                    setTransferForm({
                      ...transferForm,
                      fromOutletId: nextFromOutletId,
                      toOutletId: nextToOutletId,
                    });
                    void loadInventory(nextFromOutletId);
                  }}
                  options={activeTransferOutlets.map((item) => ({
                    value: item.id,
                    label: `${item.name} (${item.code})`,
                    keywords: `${item.name} ${item.code}`,
                  }))}
                  placeholder="Pilih outlet asal"
                  searchPlaceholder="Cari outlet..."
                  emptyText="Outlet tidak ditemukan."
                />
              </div>
              <div className="space-y-2">
                <Label>SKU</Label>
                <SearchableSelect
                  value={transferForm.skuId}
                  onChange={(value) => setTransferForm({ ...transferForm, skuId: value })}
                  options={catalog.map((item) => ({
                    value: item.skuId,
                    label: `${item.skuCode} - ${item.skuName}`,
                    description: item.productName,
                    keywords: `${item.skuCode} ${item.skuName} ${item.productName}`,
                  }))}
                  placeholder="Pilih SKU"
                  searchPlaceholder="Cari SKU..."
                  emptyText="SKU tidak ditemukan."
                />
              </div>
              <div className="space-y-2">
                <Label>Outlet Tujuan</Label>
                <SearchableSelect
                  value={transferForm.toOutletId}
                  onChange={(value) => setTransferForm({ ...transferForm, toOutletId: value })}
                  options={[
                    { value: "", label: "Pilih outlet tujuan" },
                    ...transferTargetOutlets.map((item) => ({
                      value: item.id,
                      label: `${item.name} (${item.code})`,
                      keywords: `${item.name} ${item.code}`,
                    })),
                  ]}
                  placeholder="Pilih outlet tujuan"
                  searchPlaceholder="Cari outlet..."
                  emptyText="Outlet tujuan tidak ditemukan."
                  allowClear
                />
              </div>
              <NumberField
                label={`Qty (${transferUnit})`}
                value={transferForm.quantityBase}
                onChange={(value) => setTransferForm({ ...transferForm, quantityBase: value })}
              />
              <TextField
                label="Catatan"
                value={transferForm.note}
                onChange={(value) => setTransferForm({ ...transferForm, note: value })}
              />
              <div className="flex items-end">
                <Button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    !catalog.length ||
                    !transferTargetOutlets.length ||
                    !transferForm.toOutletId ||
                    transferQty <= 0 ||
                    transferExceedsStock
                  }
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  Transfer
                </Button>
              </div>
            </form>
          ) : null}
          {transferSourceOutletId && transferForm.skuId ? (
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <MetricText
                label="On Hand Outlet Asal"
                value={`${formatQty(transferOnHandQty)} ${transferUnit}`}
              />
              <Metric
                icon={PackageSearch}
                label="Tersedia Outlet Asal"
                value={`${formatQty(transferAvailableQty)} ${transferUnit}`}
              />
              <MetricText
                label="Minimal Stok"
                value={`${formatQty(transferMinQty)} ${transferUnit}`}
              />
              <MetricText
                label="Sisa Setelah Transfer"
                value={`${formatQty(Math.max(transferRemainingQty, 0))} ${transferUnit}`}
              />
              <div
                className={`rounded-lg border p-3 text-sm ${
                  transferExceedsStock
                    ? "border-red-200 bg-red-50 text-red-700"
                    : transferWillBeCritical
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                <p className="text-xs font-medium uppercase">Status Outlet Asal</p>
                <p className="mt-1 font-semibold">
                  {transferExceedsStock
                    ? "Qty melebihi stok"
                    : transferWillBeCritical
                      ? "Akan kritis"
                      : "Aman"}
                </p>
              </div>
            </div>
          ) : null}
          {transferExceedsStock ? (
            <p className="mt-3 text-sm text-destructive">
              Qty transfer maksimal {formatQty(transferAvailableQty)} {transferUnit}, sesuai stok tersedia di outlet asal.
            </p>
          ) : null}
          {transferSourceOutletId && !transferTargetOutlets.length ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Belum ada outlet lain sebagai tujuan transfer.
            </p>
          ) : null}
        </CollapsibleSection>
      ) : null}

      {showSupplierSection && supplierAccess.canView ? (
        <CollapsibleSection
          title="Supplier"
          description="Master pemasok untuk alur pesanan pembelian dan hutang supplier."
        >
          {supplierAccess.canCreate || (supplierAccess.canEdit && editingSupplierId) ? (
            <form className="grid gap-4 lg:grid-cols-[1fr_0.7fr_0.8fr_1.2fr_auto]" onSubmit={onSupplierSubmit}>
              <TextField
                label="Nama Supplier"
                value={supplierForm.name}
                onChange={(value) => setSupplierForm({ ...supplierForm, name: value })}
              />
              <TextField
                label="Kode"
                value={supplierForm.code}
                onChange={(value) => setSupplierForm({ ...supplierForm, code: value })}
              />
              <TextField
                label="Telepon"
                value={supplierForm.phone}
                onChange={(value) => setSupplierForm({ ...supplierForm, phone: value })}
              />
              <TextField
                label="Alamat"
                value={supplierForm.address}
                onChange={(value) => setSupplierForm({ ...supplierForm, address: value })}
              />
              <div className="flex items-end">
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={
                      isSubmitting ||
                      (editingSupplierId ? !supplierAccess.canEdit : !supplierAccess.canCreate)
                    }
                  >
                    {editingSupplierId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {editingSupplierId ? "Perbarui" : "Simpan"}
                  </Button>
                  {editingSupplierId ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 w-10 p-0"
                      title="Batal edit"
                      aria-label="Batal edit supplier"
                      onClick={resetSupplierForm}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            </form>
          ) : null}
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {suppliers.map((item) => (
              <div
                key={item.id}
                className={`rounded-lg border p-3 text-sm ${editingSupplierId === item.id ? "border-primary bg-primary/5" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-muted-foreground">{item.code}</p>
                  </div>
                  <span className={item.isActive ? "text-primary" : "text-muted-foreground"}>
                    {item.isActive ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
                <p className="mt-2 text-muted-foreground">{item.phone || "-"}</p>
                <p className="mt-1 text-muted-foreground">{item.address || "-"}</p>
                {supplierAccess.canEdit ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 p-0"
                      title="Edit supplier"
                      aria-label={`Edit supplier ${item.name}`}
                      disabled={isSubmitting}
                      onClick={() => startEditSupplier(item)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant={item.isActive ? "outline" : "secondary"}
                      size="sm"
                      className="h-9 w-9 p-0"
                      title={item.isActive ? "Nonaktifkan supplier" : "Aktifkan supplier"}
                      aria-label={`${item.isActive ? "Nonaktifkan" : "Aktifkan"} supplier ${item.name}`}
                      disabled={isSubmitting}
                      onClick={() => void toggleSupplierActive(item)}
                    >
                      {item.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
            {!suppliers.length ? (
              <p className="text-sm text-muted-foreground">Belum ada supplier.</p>
            ) : null}
          </div>
        </CollapsibleSection>
      ) : null}

      {showPurchaseSection && purchaseAccess.canView ? (
        <CollapsibleSection
          title="Pesanan Pembelian"
          description="Buat PO ke supplier, terima barang untuk menambah stok, lalu catat pembayaran hutang supplier."
          actions={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0"
              title="Ekspor Excel"
              aria-label="Ekspor Excel pesanan pembelian"
              disabled={!outletId || !visiblePurchases.length}
              onClick={exportPurchaseExcel}
            >
              <Download className="h-4 w-4" />
            </Button>
          }
        >
          <div className="mb-4 max-w-sm space-y-2">
            <Label>Outlet pembelian</Label>
            <SearchableSelect
              value={outletId}
              onChange={(nextOutletId) => {
                setOutletId(nextOutletId);
                if (nextOutletId) {
                  void loadInventory(nextOutletId);
                }
              }}
              options={[
                { value: "", label: "Pilih outlet" },
                ...outlets
                .filter((item) => item.isActive !== false)
                .map((item) => ({
                  value: item.id,
                  label: `${item.name} (${item.code})`,
                  keywords: `${item.name} ${item.code}`,
                })),
              ]}
              placeholder="Pilih outlet"
              searchPlaceholder="Cari outlet..."
              emptyText="Outlet tidak ditemukan."
            />
          </div>
          {!outletId ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {outletRequiredMessage}
            </p>
          ) : null}
          {purchaseAccess.canCreate && outletId ? (
            <form
              className="grid gap-4 lg:grid-cols-[1fr_1.2fr_0.65fr_0.65fr_0.8fr_0.8fr_1fr_auto]"
              onSubmit={onPurchaseSubmit}
            >
            <div className="space-y-2">
              <Label>Supplier</Label>
              <SearchableSelect
                value={purchaseForm.supplierId}
                onChange={(value) => setPurchaseForm({ ...purchaseForm, supplierId: value })}
                options={[
                  { value: "", label: "Pilih supplier" },
                  ...suppliers.filter((item) => item.isActive).map((item) => ({
                    value: item.id,
                    label: `${item.code} - ${item.name}`,
                    description: item.phone ?? undefined,
                    keywords: `${item.code} ${item.name} ${item.phone ?? ""}`,
                  })),
                ]}
                placeholder="Pilih supplier"
                searchPlaceholder="Cari supplier..."
                emptyText="Supplier tidak ditemukan."
                allowClear
              />
            </div>
            <div className="space-y-2">
              <Label>SKU</Label>
              <SearchableSelect
                value={purchaseForm.skuId}
                onChange={(value) => {
                  const nextSku = catalog.find((item) => item.skuId === value);
                  setPurchaseForm({
                    ...purchaseForm,
                    skuId: value,
                    unitCost: formatNumberForInput(nextSku?.cost ?? 0),
                  });
                }}
                options={catalog.map((item) => ({
                  value: item.skuId,
                  label: `${item.skuCode} - ${item.skuName}`,
                  description: item.productName,
                  keywords: `${item.skuCode} ${item.skuName} ${item.productName}`,
                }))}
                placeholder="Pilih SKU"
                searchPlaceholder="Cari SKU..."
                emptyText="SKU tidak ditemukan."
              />
            </div>
            <NumberField
              label={`Qty (${purchaseUnit})`}
              value={purchaseForm.quantityBase}
              onChange={(value) => setPurchaseForm({ ...purchaseForm, quantityBase: value })}
            />
            <NumberField
              label="Harga Beli"
              value={purchaseForm.unitCost}
              onChange={(value) => setPurchaseForm({ ...purchaseForm, unitCost: value })}
            />
            <TextField
              label="Batch / Lot"
              value={purchaseForm.lotCode}
              onChange={(value) => setPurchaseForm({ ...purchaseForm, lotCode: value })}
            />
            <div className="space-y-2">
              <Label>Expired</Label>
              <input
                type="date"
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={purchaseForm.expiryDate}
                onChange={(event) => setPurchaseForm({ ...purchaseForm, expiryDate: event.target.value })}
              />
            </div>
            <TextField
              label="Catatan"
              value={purchaseForm.note}
              onChange={(value) => setPurchaseForm({ ...purchaseForm, note: value })}
            />
            <div className="flex items-end">
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  !suppliers.length ||
                  !catalog.length ||
                  purchaseQty <= 0 ||
                  !purchaseForm.lotCode.trim() ||
                  !purchaseForm.expiryDate
                }
              >
                <Truck className="h-4 w-4" />
                Buat PO
              </Button>
            </div>
            </form>
          ) : null}

          {outletId ? (
          <div className="mt-4 grid gap-3">
            <ListControls
              search={purchaseSearch}
              onSearchChange={(value) => {
                setPurchaseSearch(value);
                setPurchasePage(1);
              }}
              searchPlaceholder="Cari nomor PO, supplier, outlet, catatan..."
              filters={[
                {
                  label: "Status Barang",
                  value: purchaseStatusFilter,
                  onChange: (value) => {
                    setPurchaseStatusFilter(value);
                    setPurchasePage(1);
                  },
                  options: [
                    { value: "all", label: "Semua status" },
                    { value: "ordered", label: "Dipesan" },
                    { value: "received", label: "Diterima" },
                    { value: "cancelled", label: "Dibatalkan" },
                  ],
                },
                {
                  label: "Status Bayar",
                  value: purchasePaymentFilter,
                  onChange: (value) => {
                    setPurchasePaymentFilter(value);
                    setPurchasePage(1);
                  },
                  options: [
                    { value: "all", label: "Semua pembayaran" },
                    { value: "unpaid", label: "Belum dibayar" },
                    { value: "partial", label: "Sebagian" },
                    { value: "paid", label: "Lunas" },
                  ],
                },
              ]}
              sort={purchaseSortBy}
              onSortChange={(value) => {
                setPurchaseSortBy(value);
                setPurchasePage(1);
              }}
              sortOptions={[
                { value: "date-desc", label: "Terbaru" },
                { value: "date-asc", label: "Terlama" },
                { value: "supplier-asc", label: "Supplier A-Z" },
                { value: "supplier-desc", label: "Supplier Z-A" },
                { value: "total-desc", label: "Total terbesar" },
                { value: "total-asc", label: "Total terkecil" },
                { value: "status-asc", label: "Status A-Z" },
              ]}
            />
            {pagedPurchases.map((item) => {
              const remainingDebt = Math.max(0, Number(item.subtotal) - Number(item.paidTotal));
              return (
                <div key={item.id} className="rounded-lg border p-4 text-sm">
                  <div className="grid gap-3 lg:grid-cols-[1fr_1fr_0.8fr_0.8fr_0.8fr_1.2fr] lg:items-center">
                    <div>
                      <p className="font-medium">{item.orderNumber}</p>
                      <p className="text-muted-foreground">{formatDate(item.createdAt)}</p>
                    </div>
                    <div>
                      <p>{item.supplierName}</p>
                      <p className="text-muted-foreground">{item.outletName}</p>
                    </div>
                    <MetricText label="Status Barang" value={purchaseStatusLabel(item.status)} />
                    <MetricText label="Status Bayar" value={purchasePaymentStatusLabel(item.paymentStatus)} />
                    <MetricText label="Total" value={rupiah(item.subtotal)} />
                    <div className="grid gap-2">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 w-9 p-0"
                          title="Cetak invoice"
                          aria-label={`Cetak invoice ${item.orderNumber}`}
                          disabled={isSubmitting}
                          onClick={() => void printPurchaseInvoice(item)}
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                        {item.status === "ordered" ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-9 w-9 p-0"
                          title="Terima barang"
                          aria-label={`Terima barang ${item.orderNumber}`}
                          disabled={isSubmitting || item.status !== "ordered"}
                          onClick={() => void receivePurchase(item)}
                        >
                          <PackageCheck className="h-4 w-4" />
                        </Button>
                        ) : null}
                      </div>
                      {remainingDebt > 0 ? (
                      <div className="flex gap-2">
                        <input
                          className="flex h-9 min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          inputMode="decimal"
                          placeholder={`Sisa ${rupiah(remainingDebt)}`}
                          value={paymentInputs[item.id] ?? ""}
                          onChange={(event) =>
                            setPaymentInputs({
                              ...paymentInputs,
                              [item.id]: formatNumberInput(event.target.value),
                            })
                          }
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 w-9 p-0"
                          title="Catat pembayaran"
                          aria-label={`Catat pembayaran ${item.orderNumber}`}
                          disabled={isSubmitting || remainingDebt <= 0}
                          onClick={() => void payPurchase(item)}
                        >
                          <CreditCard className="h-4 w-4" />
                        </Button>
                      </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
            {!visiblePurchases.length ? (
              <p className="text-sm text-muted-foreground">Belum ada pesanan pembelian.</p>
            ) : null}
            <PaginationControls
              page={purchasePage}
              pageSize={purchasePageSize}
              total={visiblePurchases.length}
              onPageChange={setPurchasePage}
              onPageSizeChange={(pageSize) => {
                setPurchasePageSize(pageSize);
                setPurchasePage(1);
              }}
            />
          </div>
          ) : null}
        </CollapsibleSection>
      ) : null}

      {showInventorySections ? (
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
                <th className="px-4 py-3 font-medium">Tersedia + Satuan</th>
                <th className="px-4 py-3 font-medium">Reserved + Satuan</th>
                <th className="px-4 py-3 font-medium">Hold + Satuan</th>
                <th className="px-4 py-3 font-medium">Min + Satuan</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {pagedBalances.map((item) => {
                const availableQty = balanceAvailableQty(item);
                const isCritical = availableQty <= Number(item.minStockBaseQty);
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
                    <td className="px-4 py-3 font-medium text-primary">
                      {formatQty(availableQty)}{" "}
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
      ) : null}

      {showInventorySections ? (
        <CollapsibleSection
        title="Mutasi Terakhir"
        description={`${visibleMovements.length} dari ${movements.length} mutasi penjualan, remahan, penyesuaian, transfer, dan stok awal.`}
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
                <th className="px-4 py-3 font-medium">Batch</th>
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
                      <p className="font-medium">{item.lotCode || "-"}</p>
                      <p className="text-xs text-muted-foreground">
                        Exp: {formatDateOnly(item.expiryDate)}
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
      ) : null}
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

function MetricText(props: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{props.label}</p>
      <p className="font-medium">{props.value}</p>
    </div>
  );
}

function StockOpnameStatusBadge(props: { status: string }) {
  const meta = stockOpnameStatusMeta(props.status);
  return (
    <span className={`inline-flex h-7 shrink-0 items-center rounded-full border px-2.5 text-xs font-medium ${meta.className}`}>
      {meta.label}
    </span>
  );
}

function StockOpnameStep(props: { label: string; isActive: boolean; isDone: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm ${
        props.isDone
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : props.isActive
            ? "border-primary/30 bg-primary/5 text-primary"
            : "bg-muted/30 text-muted-foreground"
      }`}
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
          props.isDone
            ? "border-emerald-300 bg-white text-emerald-700"
            : props.isActive
              ? "border-primary/40 bg-white text-primary"
              : "bg-background text-muted-foreground"
        }`}
      >
        {props.isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
      </span>
      <span className="font-medium">{props.label}</span>
    </div>
  );
}

function StockOpnameDifferenceBadge(props: { value: number; unit: string }) {
  const isShort = props.value < -0.0005;
  const isOver = props.value > 0.0005;
  return (
    <span
      className={`inline-flex min-w-28 items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold ${
        isShort
          ? "border-red-200 bg-red-50 text-red-700"
          : isOver
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      {formatQty(props.value)} {props.unit}
    </span>
  );
}

function TextField(props: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{props.label}</Label>
      <input
        className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </div>
  );
}

function NumberField(props: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{props.label}</Label>
      <input
        className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        inputMode="decimal"
        value={props.value}
        onChange={(event) => props.onChange(formatNumberInput(event.target.value))}
      />
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

function formatNumberForInput(value: string | number) {
  return Number(value ?? 0).toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function rupiah(value: string | number) {
  return `Rp ${Number(value ?? 0).toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
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

function formatDateOnly(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function batchExpiryState(value: string | null) {
  if (!value) {
    return {
      status: "none",
      label: "Tanpa expired",
      className: "border-slate-200 bg-slate-50 text-slate-700",
    };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(value);
  expiry.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000);
  if (daysLeft < 0) {
    return {
      status: "expired",
      label: `Expired ${Math.abs(daysLeft)} hari`,
      className: "border-red-200 bg-red-50 text-red-700",
    };
  }
  if (daysLeft <= 30) {
    return {
      status: "soon",
      label: `${daysLeft} hari lagi`,
      className: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }
  return {
    status: "safe",
    label: "Aman",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
}

async function apiErrorMessage(response: Response) {
  try {
    const json = (await response.json()) as {
      error?: { message?: string; details?: unknown };
    };
    const message = json.error?.message;
    if (message === "Request validation failed") {
      return "Data transfer belum valid. Periksa outlet, SKU, dan qty.";
    }
    return message ?? null;
  } catch {
    return null;
  }
}

function createPurchaseInvoiceHtml(detail: PurchaseOrderDetail) {
  const remainingDebt = Math.max(0, Number(detail.purchase.subtotal) - Number(detail.purchase.paidTotal));
  const itemRows = detail.items
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.skuCode ?? "-")}</td>
          <td>${escapeHtml(item.nameSnapshot)}<br/><span class="muted">Batch: ${escapeHtml(item.lotCode ?? "-")} | Exp: ${escapeHtml(formatDateOnly(item.expiryDate))}</span></td>
          <td class="right">${formatQty(item.quantityBase)} ${escapeHtml(item.unitCode ?? "unit")}</td>
          <td class="right">${rupiah(item.unitCost)}</td>
          <td class="right">${rupiah(item.lineTotal)}</td>
        </tr>`,
    )
    .join("");
  const paymentRows = detail.payments.length
    ? detail.payments
        .map(
          (payment) => `
            <tr>
              <td>${formatDate(payment.createdAt)}</td>
              <td>${escapeHtml(payment.method)}</td>
              <td>${escapeHtml(payment.reference ?? "-")}</td>
              <td class="right">${rupiah(payment.amount)}</td>
            </tr>`,
        )
        .join("")
    : `<tr><td colspan="4" class="muted">Belum ada pembayaran.</td></tr>`;

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Invoice ${escapeHtml(detail.purchase.orderNumber)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; margin: 28px; color: #1f2937; }
    .header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #111827; padding-bottom: 16px; }
    h1 { margin: 0; font-size: 24px; }
    h2 { margin: 22px 0 8px; font-size: 15px; }
    p { margin: 4px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
    th, td { border: 1px solid #d1d5db; padding: 8px; vertical-align: top; }
    th { background: #f3f4f6; text-align: left; }
    .right { text-align: right; }
    .summary { margin-left: auto; width: 320px; }
    .muted { color: #6b7280; }
    .footer { margin-top: 36px; display: flex; justify-content: flex-end; }
    .sign { width: 220px; text-align: center; }
    .sign-space { height: 72px; }
    @media print { body { margin: 18mm; } button { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Invoice Pembelian</h1>
      <p><strong>${escapeHtml(detail.purchase.orderNumber)}</strong></p>
      <p class="muted">Dicetak: ${formatDate(new Date().toISOString())}</p>
    </div>
    <div>
      <p><strong>Outlet Tujuan</strong></p>
      <p>${escapeHtml(detail.purchase.outletName)} (${escapeHtml(detail.purchase.outletCode)})</p>
      <p><strong>Supplier</strong></p>
      <p>${escapeHtml(detail.purchase.supplierName)} (${escapeHtml(detail.purchase.supplierCode)})</p>
    </div>
  </div>

  <h2>Ringkasan</h2>
  <table>
    <tr><th>Tanggal PO</th><td>${formatDate(detail.purchase.createdAt)}</td><th>Status Barang</th><td>${purchaseStatusLabel(detail.purchase.status)}</td></tr>
    <tr><th>Status Bayar</th><td>${purchasePaymentStatusLabel(detail.purchase.paymentStatus)}</td><th>Diterima</th><td>${detail.purchase.receivedAt ? formatDate(detail.purchase.receivedAt) : "-"}</td></tr>
    <tr><th>Catatan</th><td colspan="3">${escapeHtml(detail.purchase.note ?? "-")}</td></tr>
  </table>

  <h2>Item Pembelian</h2>
  <table>
    <thead>
      <tr><th>No</th><th>SKU</th><th>Produk / Batch</th><th class="right">Qty</th><th class="right">Harga Beli</th><th class="right">Subtotal</th></tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <table class="summary">
    <tr><th>Total</th><td class="right">${rupiah(detail.purchase.subtotal)}</td></tr>
    <tr><th>Terbayar</th><td class="right">${rupiah(detail.purchase.paidTotal)}</td></tr>
    <tr><th>Sisa</th><td class="right">${rupiah(remainingDebt)}</td></tr>
  </table>

  <h2>Pembayaran</h2>
  <table>
    <thead><tr><th>Tanggal</th><th>Metode</th><th>Referensi</th><th class="right">Nominal</th></tr></thead>
    <tbody>${paymentRows}</tbody>
  </table>

  <div class="footer">
    <div class="sign">
      <p>Admin</p>
      <div class="sign-space"></div>
      <p>(____________________)</p>
    </div>
  </div>
</body>
</html>`;
}

function downloadTableExcel(input: {
  title: string;
  filePrefix: string;
  headers: string[];
  rows: string[][];
}) {
  const workbook = createTableExcelXml(input.title, input.headers, input.rows);
  const blob = new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `${input.filePrefix}-${dateFileStamp(new Date())}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function createTableExcelXml(title: string, headers: string[], rows: string[][]) {
  const headerXml = headers
    .map((header) => `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(header)}</Data></Cell>`)
    .join("");
  const rowsXml = rows
    .map(
      (row) =>
        `<Row>${row
          .map((value) => `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`)
          .join("")}</Row>`,
    )
    .join("");
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Title"><Font ss:Bold="1" ss:Size="14"/><Interior ss:Color="#F1FAEE" ss:Pattern="Solid"/></Style>
  <Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#A8DADC" ss:Pattern="Solid"/></Style>
 </Styles>
 <Worksheet ss:Name="${escapeXml(sheetName(title))}">
  <Table>
   <Row><Cell ss:StyleID="Title"><Data ss:Type="String">${escapeXml(title)}</Data></Cell></Row>
   <Row>${headerXml}</Row>
   ${rowsXml}
  </Table>
 </Worksheet>
</Workbook>`;
}

function sheetName(value: string) {
  return value.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeXml(value: string) {
  return escapeHtml(value);
}

function dateFileStamp(value: Date) {
  const year = value.getFullYear().toString().padStart(4, "0");
  const month = (value.getMonth() + 1).toString().padStart(2, "0");
  const day = value.getDate().toString().padStart(2, "0");
  const hour = value.getHours().toString().padStart(2, "0");
  const minute = value.getMinutes().toString().padStart(2, "0");
  return `${year}${month}${day}-${hour}${minute}`;
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

function stockOpnameStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Draft hitung",
    counted: "Menunggu approval",
    approved: "Disetujui",
    posted: "Sudah posting",
    cancelled: "Dibatalkan",
  };
  return labels[status] ?? status;
}

function stockOpnameStatusMeta(status: string) {
  const classNames: Record<string, string> = {
    draft: "border-sky-200 bg-sky-50 text-sky-700",
    counted: "border-amber-200 bg-amber-50 text-amber-800",
    approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
    posted: "border-slate-200 bg-slate-50 text-slate-700",
    cancelled: "border-red-200 bg-red-50 text-red-700",
  };
  return {
    label: stockOpnameStatusLabel(status),
    className: classNames[status] ?? "border-slate-200 bg-slate-50 text-slate-700",
  };
}

function stockOpnameDifference(item: StockOpnameItem, rawPhysical?: string) {
  const physical =
    rawPhysical !== undefined && rawPhysical !== ""
      ? parseIndonesianNumber(rawPhysical)
      : Number(item.physicalBaseQty ?? Number.NaN);
  if (Number.isFinite(physical)) {
    return physical - Number(item.systemBaseQty);
  }
  return Number(item.differenceBaseQty ?? 0);
}

function purchaseStatusLabel(status: string) {
  const labels: Record<string, string> = {
    ordered: "Dipesan",
    received: "Diterima",
    cancelled: "Dibatalkan",
  };
  return labels[status] ?? status;
}

function purchasePaymentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    unpaid: "Belum dibayar",
    partial: "Sebagian",
    paid: "Lunas",
  };
  return labels[status] ?? status;
}

function referenceLabel(referenceType: string | null) {
  const labels: Record<string, string> = {
    sale: "Transaksi penjualan",
    waste_adjustment: "Penyesuaian remahan",
    dashboard_inventory_adjustment: "Input dasbor",
    purchase_order: "Pesanan pembelian",
    inventory_transfer: "Transfer stok",
    stock_opname: "Stock opname",
  };
  return referenceType ? (labels[referenceType] ?? referenceType) : "-";
}

function balanceAvailableQty(item: Pick<Balance, "onHandBaseQty" | "reservedBaseQty" | "holdBaseQty">) {
  return Math.max(0, Number(item.onHandBaseQty) - Number(item.reservedBaseQty) - Number(item.holdBaseQty));
}

function batchSourceLabel(sourceType: string | null) {
  const labels: Record<string, string> = {
    purchase_order: "Pembelian",
    dashboard_inventory_adjustment: "Input stok",
  };
  return sourceType ? (labels[sourceType] ?? sourceType) : "-";
}
