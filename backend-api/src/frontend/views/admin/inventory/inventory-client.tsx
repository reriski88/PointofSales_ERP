"use client";

import { useEffect, useMemo, useState, type ComponentProps, type ComponentType, type ReactNode } from "react";
import {
  AlertTriangle,
  Ban,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Eye,
  PackageSearch,
  PackageCheck,
  Pencil,
  Printer,
  Power,
  PowerOff,
  Shuffle,
  X,
  ArrowRightLeft,
  CreditCard,
  ChevronsUpDown,
  Plus,
  Search,
  Send,
  Truck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CollapsibleSection } from "../_components/collapsible-section";
import { AdminModal } from "../_components/admin-modal";
import { CodeInput } from "../_components/code-input";
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
  referenceId: string | null;
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
type BatchGap = {
  outletId: string;
  skuId: string;
  skuCode: string;
  skuName: string;
  onHandBaseQty: string;
  batchOnHandBaseQty: string;
  gapBaseQty: string;
  unitId: string;
  unitCode: string;
  cost: string | null;
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
type InventoryIconButtonProps = ComponentProps<typeof Button> & { compact?: boolean };

function InventoryIconButton({ className, compact, ...props }: InventoryIconButtonProps) {
  return <Button {...props} className={[compact ? "h-8 w-8" : "h-10 w-10", "shrink-0 p-0", className].filter(Boolean).join(" ")} />;
}

function InventoryTabButton(props: { active: boolean; children: ReactNode; icon: ComponentType<{ className?: string }>; onClick: () => void }) {
  const Icon = props.icon;
  return (
    <button
      type="button"
      className={[
        "relative inline-flex h-14 items-center gap-2 border-b-2 px-1 text-sm font-medium transition-colors",
        props.active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground",
      ].join(" ")}
      onClick={props.onClick}
    >
      <Icon className="h-4 w-4" />
      {props.children}
    </button>
  );
}

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
  const [batchGaps, setBatchGaps] = useState<BatchGap[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [stockOpnames, setStockOpnames] = useState<StockOpname[]>([]);
  const [stockOpnameDetail, setStockOpnameDetail] = useState<StockOpnameDetail | null>(null);
  const [stockOpnameNote, setStockOpnameNote] = useState("");
  const [isStockOpnameModalOpen, setIsStockOpnameModalOpen] = useState(false);
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
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
    name: "",
    code: "",
    phone: "",
    address: "",
  });
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [purchaseForm, setPurchaseForm] = useState({
    supplierId: "",
    skuId: "",
    quantityBase: "0",
    priceMode: "total" as "total" | "unit",
    unitCost: "0",
    lotCode: "",
    expiryDate: "",
    note: "",
  });
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [cancelPurchaseTarget, setCancelPurchaseTarget] = useState<PurchaseOrder | null>(null);
  const [cancelPurchaseReason, setCancelPurchaseReason] = useState("");
  const [paymentPurchaseTarget, setPaymentPurchaseTarget] = useState<PurchaseOrder | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [transferForm, setTransferForm] = useState({
    fromOutletId: "",
    toOutletId: "",
    skuId: "",
    targetMode: "auto" as "auto" | "existing",
    targetSkuId: "",
    quantityBase: "0",
    note: "",
  });
  const [transferTargetCatalog, setTransferTargetCatalog] = useState<CatalogItem[]>([]);
  const [isTransferTargetCatalogLoading, setIsTransferTargetCatalogLoading] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
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
  const [batchSearch, setBatchSearch] = useState("");
  const [batchStatusFilter, setBatchStatusFilter] = useState("all");
  const [batchPage, setBatchPage] = useState(1);
  const [batchPageSize, setBatchPageSize] = useState(10);
  const [inventoryTab, setInventoryTab] = useState<"stock" | "batch" | "movement">("stock");
  const [purchaseSearch, setPurchaseSearch] = useState("");
  const [purchaseStatusFilter, setPurchaseStatusFilter] = useState("all");
  const [purchasePaymentFilter, setPurchasePaymentFilter] = useState("all");
  const [purchaseSortBy, setPurchaseSortBy] = useState("date-desc");
  const [purchasePage, setPurchasePage] = useState(1);
  const [purchasePageSize, setPurchasePageSize] = useState(5);
  const [transferSearch, setTransferSearch] = useState("");
  const [transferPage, setTransferPage] = useState(1);
  const [transferPageSize, setTransferPageSize] = useState(10);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierStatusFilter, setSupplierStatusFilter] = useState("all");
  const [supplierPage, setSupplierPage] = useState(1);
  const [supplierPageSize, setSupplierPageSize] = useState(10);
  const showInventorySections = mode === "inventory";
  const showSupplierSection = mode === "suppliers";
  const showPurchaseSection = mode === "purchases";
  const showTransferSection = mode === "transfers";
  const showStockOpnameSection = mode === "stockOpname";
  const access = showStockOpnameSection ? stockOpnameAccess : inventoryAccess;
  const outletRequiredMessage =
    "Pilih outlet spesifik terlebih dahulu untuk memuat persediaan dan stock opname.";
  const purchaseOutletRequiredMessage = "Pilih outlet spesifik terlebih dahulu untuk memuat pembelian.";

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
  const visibleBatches = useMemo(() => {
    const keyword = batchSearch.trim().toLowerCase();
    return activeBatches.filter((item) => {
      const expiry = batchExpiryState(item.expiryDate);
      const matchesSearch = !keyword || [item.skuCode, item.skuName, item.lotCode, batchSourceLabel(item.sourceType)].join(" ").toLowerCase().includes(keyword);
      const matchesStatus = batchStatusFilter === "all" || expiry.status === batchStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [activeBatches, batchSearch, batchStatusFilter]);
  const pagedBatches = pageItems(visibleBatches, batchPage, batchPageSize);
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
  const visibleTransferMovements = useMemo(() => {
    const keyword = transferSearch.trim().toLowerCase();
    return movements
      .filter((item) => item.type === "transfer_in" || item.type === "transfer_out")
      .filter((item) => {
        if (!keyword) return true;
        return [item.skuCode ?? "", item.skuName ?? "", item.lotCode ?? "", item.note ?? "", item.referenceId ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [movements, transferSearch]);
  const pagedTransferMovements = pageItems(visibleTransferMovements, transferPage, transferPageSize);
  const visibleSuppliers = useMemo(() => {
    const keyword = supplierSearch.trim().toLowerCase();
    return suppliers
      .filter((item) => {
        const matchesSearch = !keyword || [item.name, item.code, item.phone ?? "", item.address ?? ""].join(" ").toLowerCase().includes(keyword);
        const matchesStatus = supplierStatusFilter === "all" || (supplierStatusFilter === "active" && item.isActive) || (supplierStatusFilter === "inactive" && !item.isActive);
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [supplierSearch, supplierStatusFilter, suppliers]);
  const pagedSuppliers = pageItems(visibleSuppliers, supplierPage, supplierPageSize);
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

  async function loadTransferTargetCatalog(targetOutletId: string) {
    if (!targetOutletId) {
      setTransferTargetCatalog([]);
      setTransferForm((current) => ({ ...current, targetSkuId: "" }));
      return;
    }
    setIsTransferTargetCatalogLoading(true);
    const response = await fetch(`/api/catalog?outletId=${encodeURIComponent(targetOutletId)}`);
    if (response.status === 401) {
      window.location.assign("/admin/login");
      return;
    }
    if (!response.ok) {
      setTransferTargetCatalog([]);
      setTransferForm((current) => ({ ...current, targetSkuId: "" }));
      showToast({ tone: "error", title: "Produk outlet tujuan gagal dimuat" });
      setIsTransferTargetCatalogLoading(false);
      return;
    }
    const targetCatalog = ((await response.json()) as ApiResponse<{ items: CatalogItem[] }>).data.items;
    setTransferTargetCatalog(targetCatalog);
    setTransferForm((current) => ({
      ...current,
      targetSkuId:
        current.targetSkuId && targetCatalog.some((item) => item.skuId === current.targetSkuId)
          ? current.targetSkuId
          : "",
    }));
    setIsTransferTargetCatalogLoading(false);
  }

  async function loadInventory(nextOutletId = outletId) {
    if (!nextOutletId) {
      setBalances([]);
      setMovements([]);
      setBatches([]);
      setBatchGaps([]);
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
    const batchGapsRequest = showInventorySections
      ? fetch(`/api/inventory/batch-gaps?${query}`)
      : Promise.resolve(null);
    const stockOpnamesRequest = showStockOpnameSection
      ? fetch(`/api/inventory/stock-opnames?${query}`)
      : Promise.resolve(null);
    const [balancesResponse, movementsResponse, batchesResponse, batchGapsResponse, catalogResponse, stockOpnamesResponse, suppliersResponse, purchasesResponse] =
      await Promise.all([
        fetch(`/api/inventory/balances?${query}`),
        fetch(`/api/inventory/movements?${query}`),
        batchesRequest,
        batchGapsRequest,
        fetch(`/api/catalog?${query}`),
        stockOpnamesRequest,
        supplierAccess.canView || purchaseAccess.canView ? fetch("/api/suppliers") : Promise.resolve(null),
        purchaseAccess.canView ? fetch(`/api/purchases?${query}`) : Promise.resolve(null),
      ]);
    if (
      balancesResponse.status === 401 ||
      movementsResponse.status === 401 ||
      batchesResponse?.status === 401 ||
      batchGapsResponse?.status === 401 ||
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
      (batchGapsResponse !== null && !batchGapsResponse.ok) ||
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
    const batchGapData = batchGapsResponse
      ? ((await batchGapsResponse.json()) as ApiResponse<BatchGap[]>).data
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
    setBatchGaps(batchGapData);
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
        current.priceMode === "unit" && current.unitCost && current.unitCost !== "0"
          ? current.unitCost
          : "0",
    }));
    setIsLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOutlets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOutletId, supplierAccess.canView, purchaseAccess.canView]);

  useEffect(() => {
    if (!showTransferSection) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTransferTargetCatalog(transferForm.toOutletId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTransferSection, transferForm.toOutletId]);

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
  const batchGapCount = batchGaps.length;
  const batchGapTotalQty = batchGaps.reduce((sum, item) => sum + Number(item.gapBaseQty), 0);
  const selectedAdjustmentSku = catalog.find(
    (item) => item.skuId === adjustment.skuId,
  );
  const adjustmentUnit = selectedAdjustmentSku?.baseUnitCode || "unit";
  const adjustmentQty = parseIndonesianNumber(adjustment.quantityBase);
  const purchaseQty = parseIndonesianNumber(purchaseForm.quantityBase);
  const purchasePriceInput = parseIndonesianNumber(purchaseForm.unitCost);
  const purchaseUnitCost =
    purchaseForm.priceMode === "total" && purchaseQty > 0
      ? purchasePriceInput / purchaseQty
      : purchasePriceInput;
  const purchaseLineTotal = purchaseForm.priceMode === "total" ? purchasePriceInput : purchaseQty * purchaseUnitCost;
  const selectedTransferSku = catalog.find(
    (item) => item.skuId === transferForm.skuId,
  );
  const transferUnit = selectedTransferSku?.baseUnitCode || "unit";
  const transferSourceOutletId = showTransferSection ? transferForm.fromOutletId : outletId;
  const activeTransferOutlets = outlets.filter((outlet) => outlet.isActive !== false);
  const transferTargetOutlets = activeTransferOutlets.filter((outlet) => outlet.id !== transferSourceOutletId);
  const selectedTransferTargetOutlet = activeTransferOutlets.find((item) => item.id === transferForm.toOutletId) ?? null;
  const selectedTransferTargetSku = transferTargetCatalog.find((item) => item.skuId === transferForm.targetSkuId) ?? null;
  const autoMatchedTransferTargetSku = selectedTransferSku
    ? transferTargetCatalog.find(
        (item) =>
          item.skuCode === selectedTransferSku.skuCode &&
          item.skuName === selectedTransferSku.skuName &&
          item.productName === selectedTransferSku.productName,
      ) ?? null
    : null;
  const resolvedTransferTargetSku = transferForm.targetMode === "existing" ? selectedTransferTargetSku : autoMatchedTransferTargetSku;
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
  const transferWillBeEmpty = transferQty > 0 && transferRemainingQty <= 0;
  const transferWillBeCritical = transferRemainingQty <= transferMinQty;
  const selectedPurchaseSku = catalog.find((item) => item.skuId === purchaseForm.skuId);
  const purchaseUnit = selectedPurchaseSku?.baseUnitCode || "unit";
  const activeStockOpname = stockOpnameDetail?.opname ?? null;
  const activeStockOpnameItems = stockOpnameDetail?.items ?? [];
  const activeOutlet = outlets.find((item) => item.id === outletId) ?? null;
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
    setIsAdjustmentModalOpen(false);
    setMessage("Penyesuaian stok berhasil dicatat.");
    showToast({ tone: "success", title: "Penyesuaian stok berhasil dicatat" });
    await loadInventory(outletId);
    setIsSubmitting(false);
  }

  async function reconcileBatchGap(item: BatchGap) {
    if (!outletId || isSubmitting) return;
    const confirmed = await confirmAction(
      `Rekonsiliasi batch gap ${item.skuCode} sebesar ${formatQty(item.gapBaseQty)} ${item.unitCode || 'unit'}? Total stok tidak berubah.`,
    );
    if (!confirmed) return;
    setIsSubmitting(true);
    const response = await fetch('/api/inventory/batch-gaps/reconcile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outletId, skuId: item.skuId }),
    });
    if (!response.ok) {
      const errorText = (await apiErrorMessage(response)) || 'Rekonsiliasi batch gagal.';
      showToast({ tone: 'error', title: 'Rekonsiliasi batch gagal', description: errorText });
      setIsSubmitting(false);
      return;
    }
    showToast({ tone: 'success', title: 'Batch gap sudah direkonsiliasi' });
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
    if (transferForm.targetMode === "existing" && !transferForm.targetSkuId) {
      setMessage("Pilih produk tujuan yang sudah ada di outlet penerima.");
      showToast({ tone: "error", title: "Produk tujuan wajib dipilih" });
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
        targetSkuId: transferForm.targetMode === "existing" ? transferForm.targetSkuId : undefined,
        cloneToOutlet: transferForm.targetMode === "auto",
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
    setTransferForm((current) => ({ ...current, targetSkuId: "", quantityBase: "0", note: "" }));
    setIsTransferModalOpen(false);
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
    setIsStockOpnameModalOpen(false);
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

  async function runStockOpnameListAction(item: StockOpname, action: "count" | "approve" | "post") {
    if (action === "count") {
      await loadStockOpnameDetail(item.id);
      return;
    }
    if (action === "approve" && !(await confirmAction(`Approve selisih ${item.code}?`))) {
      return;
    }
    if (action === "post" && !(await confirmAction("Posting stock opname? Selisih yang sudah diapprove akan mengubah stok dan membuat mutasi adjustment."))) {
      return;
    }
    setIsSubmitting(true);
    const response = await fetch(`/api/inventory/stock-opnames/${item.id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: stockOpnameNote || undefined }),
    });
    if (!response.ok) {
      const errorText = (await apiErrorMessage(response)) || `${action === "approve" ? "Approve" : "Posting"} stock opname gagal.`;
      setMessage(errorText);
      showToast({ tone: "error", title: action === "approve" ? "Approve gagal" : "Posting gagal", description: errorText });
      setIsSubmitting(false);
      return;
    }
    showToast({ tone: "success", title: action === "approve" ? "Approve berhasil" : "Posting berhasil" });
    await loadInventory(outletId);
    await loadStockOpnameDetail(item.id);
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
    setIsSupplierModalOpen(true);
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
    setIsSupplierModalOpen(false);
    setSupplierForm({ name: "", code: "", phone: "", address: "" });
  }

  function openSupplierModal() {
    setEditingSupplierId(null);
    setSupplierForm({ name: "", code: "", phone: "", address: "" });
    setIsSupplierModalOpen(true);
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
            unitCost: purchaseUnitCost,
            lotCode: purchaseForm.lotCode.trim() || undefined,
            expiryDate: purchaseForm.expiryDate || undefined,
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
    setIsPurchaseModalOpen(false);
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

  async function payPurchase(item: PurchaseOrder, rawAmount: string) {
    if (!outletId) {
      setMessage(purchaseOutletRequiredMessage);
      showToast({
        tone: "error",
        title: "Outlet tujuan belum dipilih",
        description: purchaseOutletRequiredMessage,
      });
      return;
    }
    const remainingDebt = purchaseRemainingDebt(item);
    const amount = parseIndonesianNumber(rawAmount);
    if (amount <= 0) {
      setMessage("Nominal pembayaran supplier wajib lebih dari 0.");
      return;
    }
    if (amount > remainingDebt) {
      const message = `Nominal pembayaran maksimal ${rupiah(remainingDebt)}.`;
      setMessage(message);
      showToast({ tone: "error", title: "Nominal melebihi sisa bayar", description: message });
      setPaymentAmount(formatNumberForInput(remainingDebt));
      return;
    }
    if (!(await confirmAction(`Catat pembayaran ${rupiah(amount)} untuk ${item.orderNumber}?`))) {
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
    setPaymentPurchaseTarget(null);
    setPaymentAmount("");
    setMessage("Pembayaran supplier berhasil dicatat.");
    showToast({ tone: "success", title: "Pembayaran supplier berhasil dicatat" });
    await loadInventory(outletId);
    setIsSubmitting(false);
  }

  async function cancelPurchase() {
    if (!cancelPurchaseTarget) return;
    const reason = cancelPurchaseReason.trim();
    if (reason.length < 3) {
      setMessage("Alasan pembatalan wajib diisi minimal 3 karakter.");
      showToast({ tone: "error", title: "Alasan pembatalan belum valid" });
      return;
    }
    if (!(await confirmAction(`Batalkan ${cancelPurchaseTarget.orderNumber}? Alasan: ${reason}`))) {
      return;
    }
    setIsSubmitting(true);
    const response = await fetch(`/api/purchases/${cancelPurchaseTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!response.ok) {
      const errorText = (await apiErrorMessage(response)) || "Pesanan pembelian gagal dibatalkan.";
      setMessage(errorText);
      showToast({ tone: "error", title: "Pembatalan pembelian gagal", description: errorText });
      setIsSubmitting(false);
      return;
    }
    setCancelPurchaseTarget(null);
    setCancelPurchaseReason("");
    setMessage("Pesanan pembelian berhasil dibatalkan.");
    showToast({ tone: "success", title: "Pesanan pembelian berhasil dibatalkan" });
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
        <>
          {!outletId ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{outletRequiredMessage}</p>
              </div>
            </div>
          ) : null}

          <div className="thin-x-scroll overflow-x-auto border-b bg-card">
            <div className="flex min-w-max gap-8 px-4">
              <InventoryTabButton active={inventoryTab === "stock"} icon={Boxes} onClick={() => setInventoryTab("stock")}>Daftar Stok Produk</InventoryTabButton>
              <InventoryTabButton active={inventoryTab === "batch"} icon={PackageSearch} onClick={() => setInventoryTab("batch")}>Batch & Expired Date</InventoryTabButton>
              <InventoryTabButton active={inventoryTab === "movement"} icon={ArrowRightLeft} onClick={() => setInventoryTab("movement")}>Mutasi Terakhir</InventoryTabButton>
            </div>
          </div>

          {inventoryTab === "stock" ? <section data-tour="section" className="overflow-hidden rounded-lg border bg-card shadow-sm">
            <div className="border-b px-5 py-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold leading-snug text-foreground">Daftar Stok Produk</h2>
                  <p className="mt-1 text-xs leading-4 text-muted-foreground">
                    Stok mengikuti outlet aktif di navbar{activeOutlet ? `: ${activeOutlet.name} (${activeOutlet.code})` : ""}.
                  </p>
                </div>
                {access.canCreate ? (
                  <InventoryIconButton type="button" onClick={() => setIsAdjustmentModalOpen(true)} disabled={!outletId || !catalog.length} aria-label="Tambah penyesuaian stok" title="Tambah penyesuaian stok">
                    <Plus className="h-4 w-4" />
                  </InventoryIconButton>
                ) : null}
              </div>
            </div>
            <div className="grid gap-3 border-b p-4 md:grid-cols-3">
              <Metric icon={Boxes} label="SKU Dimonitor" value={formatQty(balances.length)} />
              <Metric icon={Boxes} label="Total Stok Dasar" value={`${formatQty(balances.reduce((sum, item) => sum + Number(item.onHandBaseQty), 0))} satuan dasar`} />
              <Metric icon={AlertTriangle} label="Stok Kritis" value={formatQty(criticalCount)} />
            </div>
            <div className="p-4">
              {batchGaps.length ? (
                <div className="mb-4 overflow-hidden rounded-lg border border-amber-200 bg-amber-50">
                  <div className="flex flex-col gap-2 border-b border-amber-200 px-4 py-3 text-amber-900 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">Batch gap terdeteksi</h3>
                      <p className="mt-1 text-xs leading-5">Balance lebih besar dari total batch. Rekonsiliasi membuat batch NON-LOT tanpa mengubah total stok.</p>
                    </div>
                    <span className="inline-flex w-fit rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">{formatQty(batchGapTotalQty)} unit</span>
                  </div>
                  <div className="thin-x-scroll overflow-x-auto bg-background">
                    <table className="min-w-[840px] table-fixed border-collapse text-sm">
                      <colgroup><col className="w-[240px]" /><col className="w-[140px]" /><col className="w-[140px]" /><col className="w-[140px]" /><col className="w-[140px]" /></colgroup>
                      <thead className="border-b bg-amber-50 text-xs font-semibold text-amber-900"><tr><th className="px-4 py-3 text-left">Produk</th><th className="px-4 py-3 text-left">Balance</th><th className="px-4 py-3 text-left">Total Batch</th><th className="px-4 py-3 text-left">Selisih</th><th className="px-4 py-3 text-right">Aksi</th></tr></thead>
                      <tbody>
                        {batchGaps.map((item) => <tr key={item.skuId} className="border-b last:border-b-0"><td className="px-4 py-3 align-middle"><p className="truncate font-medium">{item.skuCode}</p><p className="truncate text-xs text-muted-foreground">{item.skuName}</p></td><td className="px-4 py-3 align-middle">{formatQty(item.onHandBaseQty)} {item.unitCode || 'unit'}</td><td className="px-4 py-3 align-middle text-muted-foreground">{formatQty(item.batchOnHandBaseQty)} {item.unitCode || 'unit'}</td><td className="px-4 py-3 align-middle font-semibold text-amber-700">{formatQty(item.gapBaseQty)} {item.unitCode || 'unit'}</td><td className="px-4 py-3 align-middle"><div className="flex justify-end"><Button type="button" size="sm" disabled={!access.canEdit || isSubmitting} onClick={() => void reconcileBatchGap(item)}><PackageCheck className="h-4 w-4" />Rekonsiliasi</Button></div></td></tr>)}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span>Show</span>
                  <select className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" value={balancePageSize} onChange={(event) => { setBalancePageSize(Number(event.target.value)); setBalancePage(1); }}>
                    {[5, 10, 20, 50, 100].map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                  <span>entries</span>
                  <select className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" value={balanceStatusFilter} onChange={(event) => { setBalanceStatusFilter(event.target.value); setBalancePage(1); }}>
                    <option value="all">Semua</option>
                    <option value="critical">Kritis</option>
                    <option value="safe">Aman</option>
                  </select>
                </div>
                <div className="relative md:w-80">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input className="h-11 rounded-lg pl-11" value={balanceSearch} placeholder="Search..." onChange={(event) => { setBalanceSearch(event.target.value); setBalancePage(1); }} />
                </div>
              </div>
              <div className="thin-x-scroll overflow-x-auto rounded-xl border bg-card">
                <table className="min-w-[1080px] table-fixed border-collapse text-sm">
                  <colgroup>
                    <col className="w-[150px]" />
                    <col className="w-[220px]" />
                    <col className="w-[130px]" />
                    <col className="w-[130px]" />
                    <col className="w-[120px]" />
                    <col className="w-[120px]" />
                    <col className="w-[120px]" />
                    <col className="w-[120px]" />
                    <col className="w-[96px]" />
                  </colgroup>
                  <thead className="border-b bg-background text-xs font-semibold text-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left"><button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setBalanceSortBy(balanceSortBy === "sku-asc" ? "sku-desc" : "sku-asc")}>Kode <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" /></button></th>
                      <th className="px-4 py-3 text-left"><button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setBalanceSortBy("name-asc")}>Produk <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" /></button></th>
                      <th className="px-4 py-3 text-left"><button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setBalanceSortBy("stock-desc")}>On Hand <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" /></button></th>
                      <th className="px-4 py-3 text-left"><button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setBalanceSortBy("stock-asc")}>Tersedia <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" /></button></th>
                      <th className="px-4 py-3 text-left">Reserved</th>
                      <th className="px-4 py-3 text-left">Hold</th>
                      <th className="px-4 py-3 text-left">Minimum</th>
                      <th className="px-4 py-3 text-left"><button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setBalanceSortBy("critical")}>Status <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" /></button></th>
                      <th className="px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="bg-background">
                    {pagedBalances.map((item) => {
                      const availableQty = balanceAvailableQty(item);
                      const isCritical = availableQty <= Number(item.minStockBaseQty);
                      const unit = item.minStockUnitCode || "unit";
                      return (
                        <tr key={`${item.outletId}-${item.skuId}`} className="border-b last:border-b-0">
                          <td className="truncate px-4 py-3 align-middle font-medium">{item.skuCode}</td>
                          <td className="truncate px-4 py-3 align-middle text-muted-foreground">{item.skuName}</td>
                          <td className="px-4 py-3 align-middle">{formatQty(item.onHandBaseQty)} {unit}</td>
                          <td className="px-4 py-3 align-middle font-medium text-primary">{formatQty(availableQty)} {unit}</td>
                          <td className="px-4 py-3 align-middle text-muted-foreground">{formatQty(item.reservedBaseQty)} {unit}</td>
                          <td className="px-4 py-3 align-middle text-muted-foreground">{formatQty(item.holdBaseQty)} {unit}</td>
                          <td className="px-4 py-3 align-middle text-muted-foreground">{formatQty(item.minStockBaseQty)} {unit}</td>
                          <td className="px-4 py-3 align-middle"><span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${isCritical ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>{isCritical ? "Kritis" : "Aman"}</span></td>
                          <td className="px-4 py-3 align-middle"><div className="flex justify-end gap-1">
                            <InventoryIconButton type="button" variant="outline" compact className="border-sky-200 text-sky-600 hover:bg-sky-50 hover:text-sky-700" onClick={() => { setAdjustment((current) => ({ ...current, skuId: item.skuId })); setIsAdjustmentModalOpen(true); }} disabled={!access.canCreate} aria-label={`Penyesuaian stok ${item.skuName}`} title="Penyesuaian stok"><Pencil className="h-4 w-4" /></InventoryIconButton>
                          </div></td>
                        </tr>
                      );
                    })}
                    {!visibleBalances.length && !isLoading ? <tr><td colSpan={9} className="px-4 py-6 text-sm text-muted-foreground">Data stok tidak ditemukan.</td></tr> : null}
                  </tbody>
                </table>
              </div>
              <TablePager page={balancePage} pageSize={balancePageSize} total={visibleBalances.length} pageCount={Math.max(1, Math.ceil(visibleBalances.length / balancePageSize))} setPage={setBalancePage} />
            </div>
          </section> : null}

          {inventoryTab === "batch" ? <section data-tour="section" className="overflow-hidden rounded-lg border bg-card shadow-sm">
            <div className="border-b px-5 py-4">
              <h2 className="text-base font-semibold leading-snug text-foreground">Batch & Expired Date</h2>
              <p className="mt-1 text-xs leading-4 text-muted-foreground">Pantau lot aktif, sisa batch, sumber stok, dan status expired.</p>
            </div>
            <div className="grid gap-3 border-b p-4 md:grid-cols-4">
              <Metric icon={PackageSearch} label="Batch Aktif" value={formatQty(activeBatches.length)} />
              <Metric icon={AlertTriangle} label="Akan Expired <= 30 Hari" value={formatQty(expiringBatchCount)} />
              <Metric icon={TrendingDown} label="Sudah Expired" value={formatQty(expiredBatchCount)} />
              <Metric icon={PackageCheck} label="Batch Gap" value={`${formatQty(batchGapCount)} SKU / ${formatQty(batchGapTotalQty)} unit`} />
            </div>
            <div className="p-4">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span>Show</span>
                  <select className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" value={batchPageSize} onChange={(event) => { setBatchPageSize(Number(event.target.value)); setBatchPage(1); }}>
                    {[5, 10, 20, 50, 100].map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                  <span>entries</span>
                  <select className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" value={batchStatusFilter} onChange={(event) => { setBatchStatusFilter(event.target.value); setBatchPage(1); }}>
                    <option value="all">Semua</option>
                    <option value="safe">Aman</option>
                    <option value="soon">Segera expired</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
                <div className="relative md:w-80">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input className="h-11 rounded-lg pl-11" value={batchSearch} placeholder="Search..." onChange={(event) => { setBatchSearch(event.target.value); setBatchPage(1); }} />
                </div>
              </div>
              <div className="thin-x-scroll overflow-x-auto rounded-xl border bg-card">
                <table className="min-w-[920px] table-fixed border-collapse text-sm">
                  <colgroup><col className="w-[220px]" /><col className="w-[150px]" /><col className="w-[130px]" /><col className="w-[150px]" /><col className="w-[140px]" /><col className="w-[130px]" /></colgroup>
                  <thead className="border-b bg-background text-xs font-semibold text-foreground"><tr><th className="px-4 py-3 text-left">Produk</th><th className="px-4 py-3 text-left">Batch</th><th className="px-4 py-3 text-left">Expired</th><th className="px-4 py-3 text-left">Sisa</th><th className="px-4 py-3 text-left">Sumber</th><th className="px-4 py-3 text-left">Status</th></tr></thead>
                  <tbody className="bg-background">
                    {pagedBatches.map((item) => { const expiry = batchExpiryState(item.expiryDate); return <tr key={item.id} className="border-b last:border-b-0"><td className="px-4 py-3 align-middle"><p className="truncate font-medium">{item.skuCode}</p><p className="truncate text-xs text-muted-foreground">{item.skuName}</p></td><td className="truncate px-4 py-3 align-middle font-medium">{item.lotCode}</td><td className="px-4 py-3 align-middle text-muted-foreground">{formatDateOnly(item.expiryDate)}</td><td className="px-4 py-3 align-middle">{formatQty(item.onHandBaseQty)} {item.unitCode || "unit"}<p className="text-xs text-muted-foreground">dari {formatQty(item.initialBaseQty)}</p></td><td className="px-4 py-3 align-middle text-muted-foreground">{batchSourceLabel(item.sourceType)}</td><td className="px-4 py-3 align-middle"><span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${expiry.className}`}>{expiry.label}</span></td></tr>; })}
                    {!visibleBatches.length && !isLoading ? <tr><td colSpan={6} className="px-4 py-6 text-sm text-muted-foreground">Data batch tidak ditemukan.</td></tr> : null}
                  </tbody>
                </table>
              </div>
              <TablePager page={batchPage} pageSize={batchPageSize} total={visibleBatches.length} pageCount={Math.max(1, Math.ceil(visibleBatches.length / batchPageSize))} setPage={setBatchPage} />
            </div>
          </section> : null}

          {inventoryTab === "movement" ? <section data-tour="section" className="overflow-hidden rounded-lg border bg-card shadow-sm">
            <div className="border-b px-5 py-4">
              <h2 className="text-base font-semibold leading-snug text-foreground">Mutasi Terakhir</h2>
              <p className="mt-1 text-xs leading-4 text-muted-foreground">Riwayat stok masuk, keluar, penjualan, remahan, transfer, dan koreksi stok.</p>
            </div>
            <div className="p-4">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span>Show</span>
                  <select className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" value={movementPageSize} onChange={(event) => { setMovementPageSize(Number(event.target.value)); setMovementPage(1); }}>
                    {[5, 10, 20, 50, 100].map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                  <span>entries</span>
                  <select className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" value={movementTypeFilter} onChange={(event) => { setMovementTypeFilter(event.target.value); setMovementPage(1); }}>
                    <option value="all">Semua tipe</option>{movementTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                <div className="relative md:w-80"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" /><Input className="h-11 rounded-lg pl-11" value={movementSearch} placeholder="Search..." onChange={(event) => { setMovementSearch(event.target.value); setMovementPage(1); }} /></div>
              </div>
              <div className="thin-x-scroll overflow-x-auto rounded-xl border bg-card">
                <table className="min-w-[1080px] table-fixed border-collapse text-sm">
                  <colgroup><col className="w-[160px]" /><col className="w-[150px]" /><col className="w-[220px]" /><col className="w-[150px]" /><col className="w-[110px]" /><col className="w-[140px]" /><col className="w-[140px]" /><col className="w-[180px]" /></colgroup>
                  <thead className="border-b bg-background text-xs font-semibold text-foreground"><tr><th className="px-4 py-3 text-left"><button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setMovementSortBy(movementSortBy === "date-desc" ? "date-asc" : "date-desc")}>Tanggal <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" /></button></th><th className="px-4 py-3 text-left">Jenis</th><th className="px-4 py-3 text-left">Produk</th><th className="px-4 py-3 text-left">Batch</th><th className="px-4 py-3 text-left">Arah</th><th className="px-4 py-3 text-left"><button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setMovementSortBy(movementSortBy === "qty-desc" ? "qty-asc" : "qty-desc")}>Qty <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" /></button></th><th className="px-4 py-3 text-left">Referensi</th><th className="px-4 py-3 text-left">Catatan</th></tr></thead>
                  <tbody className="bg-background">
                    {pagedMovements.map((item) => { const qty = Number(item.quantityBase); const isOut = qty < 0; return <tr key={item.id} className="border-b last:border-b-0"><td className="px-4 py-3 align-middle text-muted-foreground">{formatDate(item.createdAt)}</td><td className="px-4 py-3 align-middle"><p className="truncate font-medium">{movementTypeLabel(item.type)}</p><p className="truncate text-xs text-muted-foreground">{item.type}</p></td><td className="px-4 py-3 align-middle"><p className="truncate font-medium">{item.skuCode || "-"}</p><p className="truncate text-xs text-muted-foreground">{item.skuName || item.skuId}</p></td><td className="px-4 py-3 align-middle"><p className="truncate font-medium">{item.lotCode || "-"}</p><p className="truncate text-xs text-muted-foreground">Exp: {formatDateOnly(item.expiryDate)}</p></td><td className="px-4 py-3 align-middle"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${isOut ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>{isOut ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}{isOut ? "Keluar" : "Masuk"}</span></td><td className={`px-4 py-3 align-middle font-semibold ${isOut ? "text-destructive" : "text-primary"}`}>{formatQty(item.quantityBase)} {item.baseUnitCode || "unit"}</td><td className="px-4 py-3 align-middle text-muted-foreground">{referenceLabel(item.referenceType)}</td><td className="truncate px-4 py-3 align-middle text-muted-foreground">{item.note || "-"}</td></tr>; })}
                    {!visibleMovements.length && !isLoading ? <tr><td colSpan={8} className="px-4 py-6 text-sm text-muted-foreground">Data mutasi tidak ditemukan.</td></tr> : null}
                  </tbody>
                </table>
              </div>
              <TablePager page={movementPage} pageSize={movementPageSize} total={visibleMovements.length} pageCount={Math.max(1, Math.ceil(visibleMovements.length / movementPageSize))} setPage={setMovementPage} />
            </div>
          </section> : null}

          <AdminModal open={isAdjustmentModalOpen} title="Stok Masuk / Penyesuaian" description="Input stok awal, stok masuk, atau koreksi manual untuk outlet aktif." size="xl" onClose={() => setIsAdjustmentModalOpen(false)}>
            <form className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" onSubmit={onAdjustmentSubmit}>
              <div className="space-y-2 lg:col-span-2"><Label>SKU</Label><SearchableSelect value={adjustment.skuId} onChange={(value) => setAdjustment({ ...adjustment, skuId: value })} options={catalog.map((item) => ({ value: item.skuId, label: `${item.skuCode} - ${item.skuName}`, description: item.productName, keywords: `${item.skuCode} ${item.skuName} ${item.productName}` }))} placeholder="Pilih SKU" searchPlaceholder="Cari SKU..." emptyText="SKU tidak ditemukan." /></div>
              <div className="space-y-2"><Label>Tipe</Label><select className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" value={adjustment.type} onChange={(event) => setAdjustment({ ...adjustment, type: event.target.value })}><option value="purchase">Pembelian / Stok Masuk</option><option value="opening">Stok Awal</option><option value="adjustment">Koreksi Manual</option></select></div>
              <NumberField label={`Qty Dasar (${adjustmentUnit})`} value={adjustment.quantityBase} onChange={(value) => setAdjustment({ ...adjustment, quantityBase: value })} />
              <LotCodeField
                label="Batch / Lot"
                value={adjustment.lotCode}
                onChange={(value) => setAdjustment({ ...adjustment, lotCode: value })}
                onRandom={() => setAdjustment({ ...adjustment, lotCode: makeLotCode(catalog, adjustment.skuId, adjustment.type) })}
              />
              <div className="space-y-2"><Label>Expired</Label><input type="date" className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" value={adjustment.expiryDate} onChange={(event) => setAdjustment({ ...adjustment, expiryDate: event.target.value })} /></div>
              <div className="space-y-2 lg:col-span-3"><Label>Catatan</Label><Input value={adjustment.note} onChange={(event) => setAdjustment({ ...adjustment, note: event.target.value })} /></div>
              <div className="flex justify-end gap-2 lg:col-span-3"><Button type="button" variant="outline" onClick={() => setIsAdjustmentModalOpen(false)}><X className="h-4 w-4" />Batal</Button><Button type="submit" disabled={isSubmitting || !outletId || !catalog.length || adjustmentQty <= 0}><Plus className="h-4 w-4" />Simpan</Button></div>
            </form>
          </AdminModal>
        </>
      ) : null}

      {false && showInventorySections ? (
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

      {false && showInventorySections ? (
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
        <div className="thin-x-scroll mt-4 overflow-x-auto rounded-lg border">
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

      {false && showInventorySections && access.canCreate ? (
        <CollapsibleSection
          title="Form Stok Masuk / Penyesuaian"
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
            <Label>Batch / Lot (opsional)</Label>
            <input
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={adjustment.lotCode}
              placeholder="LOT-001"
              onChange={(event) =>
                setAdjustment({ ...adjustment, lotCode: event.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Expired (opsional)</Label>
            <input
              type="date"
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={adjustment.expiryDate}
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
                !catalog.length
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
          title="Daftar Stock Opname"
          description="Stock opname dipakai untuk hitung fisik, review selisih, approval, dan posting adjustment."
          showDescription
          isLoading={isLoading}
          loadingText="Memuat daftar stock opname..."
          actions={access.canCreate ? <Button type="button" className="border-emerald-200 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setIsStockOpnameModalOpen(true)} disabled={!outletId || !catalog.length} aria-label="Generate opname" title="Generate opname"><ClipboardList className="h-4 w-4" />Generate</Button> : null}
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
              {false ? <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
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
              </div> : null}

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <StockOpnameInfo tone="sky" label="Outlet" value={selectedOpnameOutlet ? selectedOpnameOutlet.name : "Belum dipilih"} description={selectedOpnameOutlet?.code ?? "Pilih outlet"} />
                <StockOpnameInfo tone="emerald" label="SKU Dimonitor" value={outletId ? formatQty(catalog.length) : "-"} description="Item masuk hitung fisik" />
                <StockOpnameInfo tone="violet" label="Sesi Opname" value={formatQty(stockOpnames.length)} description="Riwayat sesi outlet" />
                <StockOpnameInfo tone={activeStockOpname ? "amber" : "slate"} label="Sesi Aktif" value={activeStockOpname ? stockOpnameStatusLabel(activeStockOpname.status) : "Belum ada"} description={activeStockOpname?.code ?? "Belum dibuka"} />
              </div>
            </div>

            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl border bg-card">
                <div className="border-b px-4 py-3">
                  <p className="text-sm font-semibold">Sesi Opname</p>
                  <p className="mt-1 text-xs text-muted-foreground">Pilih sesi untuk input atau review hasil hitung.</p>
                </div>
                <div className="thin-x-scroll overflow-x-auto">
                  <table className="min-w-[920px] table-fixed border-collapse text-sm">
                    <colgroup><col className="w-[210px]" /><col className="w-[150px]" /><col className="w-[180px]" /><col className="w-[220px]" /><col className="w-[100px]" /><col className="w-[190px]" /></colgroup>
                    <thead className="border-b bg-background text-xs font-semibold text-foreground"><tr><th className="px-4 py-3 text-left">Kode</th><th className="px-4 py-3 text-left">Tanggal</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-left">Progress</th><th className="px-4 py-3 text-left">Selisih</th><th className="px-4 py-3 text-right">Aksi</th></tr></thead>
                    <tbody className="bg-background">
                      {stockOpnames.map((item) => {
                        const progress = item.itemCount ? Math.min(100, (item.countedCount / item.itemCount) * 100) : 0;
                        const progressTone = progress >= 100 ? "bg-emerald-500" : progress > 0 ? "bg-sky-500" : "bg-slate-300";
                        const active = activeStockOpname?.id === item.id;
                        return (
                          <tr key={item.id} className={`border-b last:border-b-0 ${active ? "bg-primary/5" : ""}`}>
                            <td className="px-4 py-3 align-middle">
                              <p className="font-medium">{item.code}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{formatQty(item.countedCount)} / {formatQty(item.itemCount)} dihitung - {Math.round(progress)}%</p>
                            </td>
                            <td className="px-4 py-3 align-middle text-muted-foreground">{formatDate(item.createdAt)}</td>
                            <td className="px-4 py-3 align-middle"><StockOpnameStatusBadge status={item.status} /></td>
                            <td className="px-4 py-3 align-middle"><div className="mb-1 flex items-center justify-between text-xs text-muted-foreground"><span>{formatQty(item.countedCount)} / {formatQty(item.itemCount)} item</span><span>{Math.round(progress)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${progressTone}`} style={{ width: `${progress}%` }} /></div></td>
                            <td className={`px-4 py-3 align-middle font-medium ${item.differenceCount ? "text-amber-700" : "text-muted-foreground"}`}>{formatQty(item.differenceCount)}</td>
                            <td className="px-4 py-3 align-middle"><div className="flex justify-end gap-1">
                              {item.status === "draft" || item.status === "counted" ? <Button type="button" variant="outline" size="sm" className="border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100" onClick={() => void runStockOpnameListAction(item, "count")} disabled={isSubmitting} title="Hitung Fisik"><PackageCheck className="h-4 w-4" />Hitung</Button> : null}
                              {item.status === "counted" && access.canApprove ? <Button type="button" variant="outline" size="sm" className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" onClick={() => void runStockOpnameListAction(item, "approve")} disabled={isSubmitting} title="Approval"><CheckCircle2 className="h-4 w-4" />Approval</Button> : null}
                              {item.status === "approved" && access.canApprove ? <Button type="button" variant="outline" size="sm" className="border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100" onClick={() => void runStockOpnameListAction(item, "post")} disabled={isSubmitting} title="Posting"><Send className="h-4 w-4" />Posting</Button> : null}
                              {item.status === "posted" ? <Button type="button" variant="outline" size="sm" className="border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100" onClick={() => void runStockOpnameListAction(item, "count")} disabled={isSubmitting} title="View"><Eye className="h-4 w-4" />View</Button> : null}
                            </div></td>
                          </tr>
                        );
                      })}
                      {!stockOpnames.length ? <tr><td colSpan={6} className="px-4 py-6 text-sm text-muted-foreground">{isLoading ? "Memuat sesi stock opname..." : "Belum ada sesi stock opname untuk outlet ini."}</td></tr> : null}
                    </tbody>
                  </table>
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
                            <InventoryIconButton type="button" variant="ghost" compact className="text-slate-600 hover:bg-slate-100 hover:text-slate-800" onClick={() => setStockOpnameDetail(null)} aria-label="Tutup detail" title="Tutup detail"><X className="h-4 w-4" /></InventoryIconButton>
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

                    <div className="thin-x-scroll overflow-x-auto rounded-lg border bg-background">
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
                          Pilih sesi di daftar, atau generate opname baru setelah outlet dipilih.
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

      <AdminModal open={isStockOpnameModalOpen} title="Generate Stock Opname" description="Pilih outlet dan catatan sesi sebelum membuat daftar hitung fisik." size="lg" onClose={() => setIsStockOpnameModalOpen(false)}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2"><Label>Outlet opname</Label><SearchableSelect value={outletId} onChange={(nextOutletId) => { setOutletId(nextOutletId); setStockOpnameDetail(null); if (nextOutletId) void loadInventory(nextOutletId); }} options={[{ value: "", label: "Pilih outlet" }, ...outlets.filter((item) => item.isActive !== false).map((item) => ({ value: item.id, label: `${item.name} (${item.code})`, keywords: `${item.name} ${item.code}` }))]} placeholder="Pilih outlet" searchPlaceholder="Cari outlet..." emptyText="Outlet tidak ditemukan." /></div>
          <TextField label="Catatan sesi" value={stockOpnameNote} onChange={setStockOpnameNote} />
          <div className="flex justify-end gap-2 md:col-span-2"><Button type="button" variant="outline" onClick={() => setIsStockOpnameModalOpen(false)}>Batal</Button><Button type="button" onClick={() => void createStockOpname()} disabled={isSubmitting || !outletId || !catalog.length}><ClipboardList className="h-4 w-4" />Generate</Button></div>
        </div>
      </AdminModal>

      {showTransferSection && access.canCreate ? (
        <CollapsibleSection
          title="Daftar Transfer Barang"
          description="Transfer barang dipakai untuk memindahkan stok antar outlet dan memantau mutasi transfer terakhir."
          showDescription
          isLoading={isLoading}
          loadingText="Memuat daftar transfer barang..."
          actions={<InventoryIconButton type="button" onClick={() => setIsTransferModalOpen(true)} disabled={!transferSourceOutletId} aria-label="Tambah transfer" title="Tambah transfer"><Plus className="h-4 w-4" /></InventoryIconButton>}
        >
          {!transferSourceOutletId ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Belum ada outlet yang bisa diakses user login.</p> : null}
          {transferSourceOutletId ? (
            <div className="overflow-hidden rounded-xl border bg-card">
              <div className="flex flex-col gap-3 border-b px-4 py-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span>Show</span>
                  <select className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" value={transferPageSize} onChange={(event) => { setTransferPageSize(Number(event.target.value)); setTransferPage(1); }}>
                    {[5, 10, 20, 50, 100].map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                  <span>entries</span>
                </div>
                <div className="relative md:w-80"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" /><Input className="h-11 rounded-lg pl-11" value={transferSearch} placeholder="Search..." onChange={(event) => { setTransferSearch(event.target.value); setTransferPage(1); }} /></div>
              </div>
              <div className="thin-x-scroll overflow-x-auto">
                <table className="min-w-[920px] table-fixed border-collapse text-sm">
                  <colgroup><col className="w-[160px]" /><col className="w-[160px]" /><col className="w-[240px]" /><col className="w-[120px]" /><col className="w-[160px]" /><col className="w-[220px]" /></colgroup>
                  <thead className="border-b bg-background text-xs font-semibold text-foreground"><tr><th className="px-4 py-3 text-left">Tanggal</th><th className="px-4 py-3 text-left">Arah</th><th className="px-4 py-3 text-left">Produk</th><th className="px-4 py-3 text-left">Qty</th><th className="px-4 py-3 text-left">Referensi</th><th className="px-4 py-3 text-left">Catatan</th></tr></thead>
                  <tbody className="bg-background">
                    {pagedTransferMovements.map((item) => {
                      const isOut = item.type === "transfer_out";
                      return <tr key={item.id} className="border-b last:border-b-0"><td className="px-4 py-3 align-middle text-muted-foreground">{formatDate(item.createdAt)}</td><td className="px-4 py-3 align-middle"><span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${isOut ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>{isOut ? "Keluar" : "Masuk"}</span></td><td className="px-4 py-3 align-middle"><p className="truncate font-medium">{item.skuCode || "-"}</p><p className="truncate text-xs text-muted-foreground">{item.skuName || item.skuId}</p></td><td className="px-4 py-3 align-middle font-medium">{formatQty(Math.abs(Number(item.quantityBase)))} {item.baseUnitCode || "unit"}</td><td className="truncate px-4 py-3 align-middle text-muted-foreground">{item.referenceId || "-"}</td><td className="truncate px-4 py-3 align-middle text-muted-foreground">{item.note || "-"}</td></tr>;
                    })}
                    {!visibleTransferMovements.length ? <tr><td colSpan={6} className="px-4 py-6 text-sm text-muted-foreground">Belum ada mutasi transfer barang.</td></tr> : null}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col gap-3 border-t px-4 py-4 md:flex-row md:items-center md:justify-between"><p className="text-sm text-muted-foreground">Showing {visibleTransferMovements.length ? (transferPage - 1) * transferPageSize + 1 : 0} to {Math.min(transferPage * transferPageSize, visibleTransferMovements.length)} of {visibleTransferMovements.length} entries</p><div className="flex items-center gap-3"><InventoryIconButton type="button" variant="outline" disabled={transferPage <= 1} onClick={() => setTransferPage((current) => Math.max(1, current - 1))} aria-label="Sebelumnya"><ChevronLeft className="h-4 w-4" /></InventoryIconButton><span className="inline-flex h-10 min-w-10 items-center justify-center rounded-lg bg-primary/10 px-3 text-sm font-semibold text-primary">{transferPage}</span><InventoryIconButton type="button" variant="outline" disabled={transferPage >= Math.max(1, Math.ceil(visibleTransferMovements.length / transferPageSize))} onClick={() => setTransferPage((current) => Math.min(Math.max(1, Math.ceil(visibleTransferMovements.length / transferPageSize)), current + 1))} aria-label="Berikutnya"><ChevronRight className="h-4 w-4" /></InventoryIconButton></div></div>
            </div>
          ) : null}
        </CollapsibleSection>
      ) : null}

      <AdminModal open={isTransferModalOpen} title="Tambah Transfer Barang" description="Pilih outlet asal, produk, outlet tujuan, dan qty transfer." size="xl" onClose={() => setIsTransferModalOpen(false)}>
        <form className="space-y-5" onSubmit={onTransferSubmit}>
          {transferSourceOutletId ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
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
                      setTransferForm({ ...transferForm, fromOutletId: nextFromOutletId, toOutletId: nextToOutletId });
                      void loadInventory(nextFromOutletId);
                    }}
                    options={activeTransferOutlets.map((item) => ({ value: item.id, label: `${item.name} (${item.code})`, keywords: `${item.name} ${item.code}` }))}
                    placeholder="Pilih outlet asal"
                    searchPlaceholder="Cari outlet..."
                    emptyText="Outlet tidak ditemukan."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Outlet Tujuan</Label>
                  <SearchableSelect
                    value={transferForm.toOutletId}
                    onChange={(value) => setTransferForm({ ...transferForm, toOutletId: value, targetSkuId: "" })}
                    options={[
                      { value: "", label: "Pilih outlet tujuan" },
                      ...transferTargetOutlets.map((item) => ({ value: item.id, label: `${item.name} (${item.code})`, keywords: `${item.name} ${item.code}` })),
                    ]}
                    placeholder="Pilih outlet tujuan"
                    searchPlaceholder="Cari outlet..."
                    emptyText="Outlet tujuan tidak ditemukan."
                    allowClear
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Produk / SKU</Label>
                  <SearchableSelect
                    value={transferForm.skuId}
                    onChange={(value) => setTransferForm({ ...transferForm, skuId: value, targetSkuId: "" })}
                    options={catalog.map((item) => ({ value: item.skuId, label: `${item.skuCode} - ${item.skuName}`, description: item.productName, keywords: `${item.skuCode} ${item.skuName} ${item.productName}` }))}
                    placeholder="Pilih SKU"
                    searchPlaceholder="Cari SKU..."
                    emptyText="SKU tidak ditemukan."
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Produk Tujuan</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      className={`rounded-lg border p-3 text-left transition-colors ${transferForm.targetMode === "auto" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "bg-background hover:bg-muted/40"}`}
                      onClick={() => setTransferForm({ ...transferForm, targetMode: "auto", targetSkuId: "" })}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold"><PackageCheck className="h-4 w-4" />Buat otomatis</span>
                      <span className="mt-1 block text-xs opacity-80">Pakai padanan jika ada. Jika belum ada, produk dan varian dibuat di outlet tujuan.</span>
                    </button>
                    <button
                      type="button"
                      className={`rounded-lg border p-3 text-left transition-colors ${transferForm.targetMode === "existing" ? "border-sky-300 bg-sky-50 text-sky-900" : "bg-background hover:bg-muted/40"}`}
                      onClick={() => setTransferForm({ ...transferForm, targetMode: "existing" })}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold"><PackageSearch className="h-4 w-4" />Produk sudah ada</span>
                      <span className="mt-1 block text-xs opacity-80">Pilih SKU tujuan manual agar stok bertambah ke barang yang benar.</span>
                    </button>
                  </div>
                </div>
                {transferForm.targetMode === "existing" ? (
                  <div className="space-y-2 md:col-span-2">
                    <Label>SKU Tujuan di {selectedTransferTargetOutlet?.name || "Outlet Tujuan"}</Label>
                    <SearchableSelect
                      value={transferForm.targetSkuId}
                      onChange={(value) => setTransferForm({ ...transferForm, targetSkuId: value })}
                      options={transferTargetCatalog.map((item) => ({ value: item.skuId, label: `${item.skuCode} - ${item.skuName}`, description: item.productName, keywords: `${item.skuCode} ${item.skuName} ${item.productName}` }))}
                      placeholder={isTransferTargetCatalogLoading ? "Memuat SKU tujuan..." : "Pilih SKU tujuan"}
                      searchPlaceholder="Cari SKU tujuan..."
                      emptyText="SKU outlet tujuan tidak ditemukan. Gunakan buat otomatis."
                    />
                  </div>
                ) : null}
                {transferForm.toOutletId && selectedTransferSku ? (
                  <div className={`rounded-lg border p-3 text-sm md:col-span-2 ${transferForm.targetMode === "existing" ? "border-sky-200 bg-sky-50 text-sky-900" : resolvedTransferTargetSku ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                    <div className="flex items-start gap-2">
                      {transferForm.targetMode === "existing" ? <PackageSearch className="mt-0.5 h-4 w-4 shrink-0" /> : resolvedTransferTargetSku ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                      <div>
                        <p className="font-semibold">
                          {transferForm.targetMode === "existing"
                            ? selectedTransferTargetSku
                              ? `Stok akan bertambah ke ${selectedTransferTargetSku.skuName}`
                              : "Pilih SKU tujuan yang sudah ada."
                            : resolvedTransferTargetSku
                              ? `Produk sudah ada: stok akan bertambah ke ${resolvedTransferTargetSku.skuName}`
                              : `Produk belum ada di ${selectedTransferTargetOutlet?.name || "outlet tujuan"}. Sistem akan membuat otomatis.`}
                        </p>
                        <p className="mt-1 text-xs opacity-80">
                          Asal: {selectedTransferSku.skuName} ({selectedTransferSku.skuCode})
                          {resolvedTransferTargetSku ? ` -> Tujuan: ${resolvedTransferTargetSku.productName} / ${resolvedTransferTargetSku.skuName} (${resolvedTransferTargetSku.skuCode})` : ` -> Tujuan: ${selectedTransferSku.productName} / ${selectedTransferSku.skuName} (${selectedTransferSku.skuCode})`}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
                <div className="space-y-2">
                  <NumberField
                    label={`Qty (${transferUnit})`}
                    value={transferForm.quantityBase}
                    onChange={(value) => {
                      const qty = parseIndonesianNumber(value);
                      const safeValue = qty > transferAvailableQty ? formatNumberForInput(transferAvailableQty) : value;
                      setTransferForm({ ...transferForm, quantityBase: safeValue });
                    }}
                  />
                  <p className="text-xs text-muted-foreground">Maksimal {formatQty(transferAvailableQty)} {transferUnit}, mengikuti stok tersedia barang.</p>
                </div>
                <TextField label="Catatan" value={transferForm.note} onChange={(value) => setTransferForm({ ...transferForm, note: value })} />
              </div>
            </>
          ) : <p className="text-sm text-muted-foreground">Belum ada outlet yang bisa diakses user login.</p>}

          {transferSourceOutletId && transferForm.skuId ? (
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <TransferSummary label="On Hand" value={`${formatQty(transferOnHandQty)} ${transferUnit}`} />
                <TransferSummary label="Tersedia" value={`${formatQty(transferAvailableQty)} ${transferUnit}`} highlight />
                <TransferSummary label="Minimal" value={`${formatQty(transferMinQty)} ${transferUnit}`} />
                <TransferSummary label="Sisa Setelah Transfer" value={`${formatQty(Math.max(transferRemainingQty, 0))} ${transferUnit}`} />
              </div>
              <div className={`mt-3 rounded-md border px-3 py-2 text-sm ${transferExceedsStock || transferWillBeEmpty ? "border-red-200 bg-red-50 text-red-700" : transferWillBeCritical ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                {transferExceedsStock
                  ? `Qty transfer maksimal ${formatQty(transferAvailableQty)} ${transferUnit}.`
                  : transferWillBeEmpty
                    ? `Stok outlet asal akan habis. Sisa setelah transfer 0 ${transferUnit}.`
                    : transferWillBeCritical
                      ? `Sisa stok ${formatQty(Math.max(transferRemainingQty, 0))} ${transferUnit}, di bawah/minimal batas ${formatQty(transferMinQty)} ${transferUnit}.`
                      : `Stok outlet asal aman. Sisa setelah transfer ${formatQty(transferRemainingQty)} ${transferUnit}.`}
              </div>
            </div>
          ) : null}

          {transferSourceOutletId && !transferTargetOutlets.length ? <p className="text-sm text-muted-foreground">Belum ada outlet lain sebagai tujuan transfer.</p> : null}

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => setIsTransferModalOpen(false)}>Batal</Button>
            <Button type="submit" disabled={isSubmitting || !catalog.length || !transferTargetOutlets.length || !transferForm.toOutletId || (transferForm.targetMode === "existing" && !transferForm.targetSkuId) || transferQty <= 0 || transferExceedsStock}><ArrowRightLeft className="h-4 w-4" />Transfer</Button>
          </div>
        </form>
      </AdminModal>

      {showSupplierSection && supplierAccess.canView ? (
        <CollapsibleSection
          title="Daftar Supplier"
          description="Master pemasok untuk alur pesanan pembelian dan hutang supplier."
          showDescription
          isLoading={isLoading}
          loadingText="Memuat daftar supplier..."
          actions={supplierAccess.canCreate ? (
            <InventoryIconButton type="button" onClick={openSupplierModal} aria-label="Tambah supplier" title="Tambah supplier">
              <Plus className="h-4 w-4" />
            </InventoryIconButton>
          ) : null}
        >
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="flex flex-col gap-3 border-b px-4 py-4 md:flex-row md:items-center md:justify-between"><div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground"><span>Show</span><select className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" value={supplierPageSize} onChange={(event) => { setSupplierPageSize(Number(event.target.value)); setSupplierPage(1); }}>{[5, 10, 20, 50, 100].map((value) => <option key={value} value={value}>{value}</option>)}</select><span>entries</span><select className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" value={supplierStatusFilter} onChange={(event) => { setSupplierStatusFilter(event.target.value); setSupplierPage(1); }}><option value="all">Semua</option><option value="active">Aktif</option><option value="inactive">Nonaktif</option></select></div><div className="relative md:w-80"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" /><Input className="h-11 rounded-lg pl-11" value={supplierSearch} placeholder="Search..." onChange={(event) => { setSupplierSearch(event.target.value); setSupplierPage(1); }} /></div></div>
            <div className="thin-x-scroll overflow-x-auto"><table className="min-w-[860px] table-fixed border-collapse text-sm"><colgroup><col className="w-[220px]" /><col className="w-[130px]" /><col className="w-[170px]" /><col className="w-[260px]" /><col className="w-[120px]" /><col className="w-[120px]" /></colgroup><thead className="border-b bg-background text-xs font-semibold text-foreground"><tr><th className="px-4 py-3 text-left">Supplier</th><th className="px-4 py-3 text-left">Kode</th><th className="px-4 py-3 text-left">Telepon</th><th className="px-4 py-3 text-left">Alamat</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-right">Aksi</th></tr></thead><tbody className="bg-background">{pagedSuppliers.map((item) => <tr key={item.id} className="border-b last:border-b-0"><td className="truncate px-4 py-3 align-middle font-medium">{item.name}</td><td className="truncate px-4 py-3 align-middle text-muted-foreground">{item.code}</td><td className="truncate px-4 py-3 align-middle text-muted-foreground">{item.phone || "-"}</td><td className="truncate px-4 py-3 align-middle text-muted-foreground">{item.address || "-"}</td><td className="px-4 py-3 align-middle"><span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${item.isActive ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{item.isActive ? "Aktif" : "Nonaktif"}</span></td><td className="px-4 py-3 align-middle"><div className="flex justify-end gap-1">{supplierAccess.canEdit ? <><InventoryIconButton type="button" variant="outline" compact className="border-sky-200 text-sky-600 hover:bg-sky-50 hover:text-sky-700" title="Edit supplier" aria-label={`Edit supplier ${item.name}`} disabled={isSubmitting} onClick={() => startEditSupplier(item)}><Pencil className="h-4 w-4" /></InventoryIconButton><InventoryIconButton type="button" variant="secondary" compact className={item.isActive ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"} title={item.isActive ? "Nonaktifkan supplier" : "Aktifkan supplier"} aria-label={`${item.isActive ? "Nonaktifkan" : "Aktifkan"} supplier ${item.name}`} disabled={isSubmitting} onClick={() => void toggleSupplierActive(item)}>{item.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}</InventoryIconButton></> : null}</div></td></tr>)}{!visibleSuppliers.length ? <tr><td colSpan={6} className="px-4 py-6 text-sm text-muted-foreground">Belum ada supplier.</td></tr> : null}</tbody></table></div>
            <div className="flex flex-col gap-3 border-t px-4 py-4 md:flex-row md:items-center md:justify-between"><p className="text-sm text-muted-foreground">Showing {visibleSuppliers.length ? (supplierPage - 1) * supplierPageSize + 1 : 0} to {Math.min(supplierPage * supplierPageSize, visibleSuppliers.length)} of {visibleSuppliers.length} entries</p><div className="flex items-center gap-3"><InventoryIconButton type="button" variant="outline" disabled={supplierPage <= 1} onClick={() => setSupplierPage((current) => Math.max(1, current - 1))} aria-label="Sebelumnya"><ChevronLeft className="h-4 w-4" /></InventoryIconButton><span className="inline-flex h-10 min-w-10 items-center justify-center rounded-lg bg-primary/10 px-3 text-sm font-semibold text-primary">{supplierPage}</span><InventoryIconButton type="button" variant="outline" disabled={supplierPage >= Math.max(1, Math.ceil(visibleSuppliers.length / supplierPageSize))} onClick={() => setSupplierPage((current) => Math.min(Math.max(1, Math.ceil(visibleSuppliers.length / supplierPageSize)), current + 1))} aria-label="Berikutnya"><ChevronRight className="h-4 w-4" /></InventoryIconButton></div></div>
          </div>
        </CollapsibleSection>
      ) : null}

      <AdminModal
        open={isSupplierModalOpen}
        title={editingSupplierId ? "Edit Supplier" : "Tambah Supplier"}
        description="Master pemasok untuk pembelian dan hutang supplier."
        size="lg"
        onClose={resetSupplierForm}
      >
        <form className="grid gap-4 md:grid-cols-2" onSubmit={onSupplierSubmit}>
          <TextField label="Nama Supplier" value={supplierForm.name} onChange={(value) => setSupplierForm({ ...supplierForm, name: value })} />
          <CodeInput label="Kode" value={supplierForm.code} prefix="SUP" onChange={(value) => setSupplierForm({ ...supplierForm, code: value })} />
          <TextField label="Telepon" value={supplierForm.phone} onChange={(value) => setSupplierForm({ ...supplierForm, phone: value })} />
          <TextField label="Alamat" value={supplierForm.address} onChange={(value) => setSupplierForm({ ...supplierForm, address: value })} />
          <div className="flex justify-end gap-2 md:col-span-2">
            <Button type="button" variant="outline" onClick={resetSupplierForm}>Batal</Button>
            <Button type="submit" disabled={isSubmitting || (editingSupplierId ? !supplierAccess.canEdit : !supplierAccess.canCreate)}>
              {editingSupplierId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editingSupplierId ? "Perbarui" : "Simpan"}
            </Button>
          </div>
        </form>
      </AdminModal>

      {showPurchaseSection && purchaseAccess.canView ? (
        <CollapsibleSection
          title="Daftar Pembelian"
          description="Pembelian dipakai untuk PO supplier, penerimaan barang, sisa bayar, invoice, dan pembatalan pesanan."
          showDescription
          isLoading={isLoading}
          loadingText="Memuat daftar pembelian..."
          actions={
            <>
              {purchaseAccess.canCreate && outletId ? (
                <InventoryIconButton type="button" onClick={() => setIsPurchaseModalOpen(true)} aria-label="Buat PO" title="Buat PO">
                  <Plus className="h-4 w-4" />
                </InventoryIconButton>
              ) : null}
              <InventoryIconButton
                type="button"
                variant="outline"
                title="Ekspor Excel"
                aria-label="Ekspor Excel pesanan pembelian"
                disabled={!outletId || !visiblePurchases.length}
                onClick={exportPurchaseExcel}
              >
                <Download className="h-4 w-4" />
              </InventoryIconButton>
            </>
          }
        >
          {!outletId ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{purchaseOutletRequiredMessage}</p>
              </div>
            </div>
          ) : null}
          {outletId ? (
            <div className="overflow-hidden rounded-xl border bg-card">
              <div className="flex flex-col gap-3 border-b px-4 py-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span>Show</span>
                  <select className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" value={purchasePageSize} onChange={(event) => { setPurchasePageSize(Number(event.target.value)); setPurchasePage(1); }}>
                    {[5, 10, 20, 50, 100].map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                  <span>entries</span>
                  <select className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" value={purchaseStatusFilter} onChange={(event) => { setPurchaseStatusFilter(event.target.value); setPurchasePage(1); }}>
                    <option value="all">Semua status</option>
                    <option value="ordered">Dipesan</option>
                    <option value="received">Diterima</option>
                    <option value="cancelled">Dibatalkan</option>
                  </select>
                  <select className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" value={purchasePaymentFilter} onChange={(event) => { setPurchasePaymentFilter(event.target.value); setPurchasePage(1); }}>
                    <option value="all">Semua pembayaran</option>
                    <option value="unpaid">Belum dibayar</option>
                    <option value="partial">Sebagian</option>
                    <option value="paid">Lunas</option>
                  </select>
                  <select className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" value={purchaseSortBy} onChange={(event) => { setPurchaseSortBy(event.target.value); setPurchasePage(1); }}>
                    <option value="date-desc">Terbaru</option>
                    <option value="date-asc">Terlama</option>
                    <option value="supplier-asc">Supplier A-Z</option>
                    <option value="supplier-desc">Supplier Z-A</option>
                    <option value="total-desc">Total terbesar</option>
                    <option value="total-asc">Total terkecil</option>
                    <option value="status-asc">Status A-Z</option>
                  </select>
                </div>
                <div className="relative md:w-80">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input className="h-11 rounded-lg pl-11" value={purchaseSearch} placeholder="Search..." onChange={(event) => { setPurchaseSearch(event.target.value); setPurchasePage(1); }} />
                </div>
              </div>
              <div className="thin-x-scroll overflow-x-auto">
                <table className="min-w-[1180px] table-fixed border-collapse text-sm">
                  <colgroup>
                    <col className="w-[190px]" />
                    <col className="w-[190px]" />
                    <col className="w-[145px]" />
                    <col className="w-[155px]" />
                    <col className="w-[135px]" />
                    <col className="w-[135px]" />
                    <col className="w-[135px]" />
                    <col className="w-[180px]" />
                  </colgroup>
                  <thead className="border-b bg-background text-xs font-semibold text-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left"><button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setPurchaseSortBy(purchaseSortBy === "date-desc" ? "date-asc" : "date-desc")}>Nomor PO <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" /></button></th>
                      <th className="px-4 py-3 text-left"><button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setPurchaseSortBy(purchaseSortBy === "supplier-asc" ? "supplier-desc" : "supplier-asc")}>Supplier <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" /></button></th>
                      <th className="px-4 py-3 text-left">Status Barang</th>
                      <th className="px-4 py-3 text-left">Status Bayar</th>
                      <th className="px-4 py-3 text-right"><button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setPurchaseSortBy(purchaseSortBy === "total-desc" ? "total-asc" : "total-desc")}>Total <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" /></button></th>
                      <th className="px-4 py-3 text-right">Terbayar</th>
                      <th className="px-4 py-3 text-right">Sisa</th>
                      <th className="px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="bg-background">
                    {pagedPurchases.map((item) => {
                      const remainingDebt = purchaseRemainingDebt(item);
                      return (
                        <tr key={item.id} className="border-b text-sm last:border-b-0">
                          <td className="px-4 py-3 align-middle">
                            <div className="min-w-0">
                              <p className="truncate font-medium">{item.orderNumber}</p>
                              <p className="truncate text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <div className="min-w-0">
                              <p className="truncate font-medium">{item.supplierName}</p>
                              <p className="truncate text-xs text-muted-foreground">{item.outletName}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 align-middle"><PurchaseStatusBadge status={item.status} /></td>
                          <td className="px-4 py-3 align-middle"><PurchasePaymentStatusBadge status={item.paymentStatus} purchaseStatus={item.status} /></td>
                          <td className="px-4 py-3 text-right align-middle font-medium">{rupiah(item.subtotal)}</td>
                          <td className="px-4 py-3 text-right align-middle text-muted-foreground">{rupiah(item.paidTotal)}</td>
                          <td className={`px-4 py-3 text-right align-middle font-medium ${item.status === "cancelled" ? "text-muted-foreground" : remainingDebt > 0 ? "text-amber-700" : "text-emerald-700"}`}>{item.status === "cancelled" ? "-" : rupiah(remainingDebt)}</td>
                          <td className="px-4 py-3 align-middle">
                            <div className="flex justify-end gap-1">
                              <InventoryIconButton type="button" variant="outline" compact className="border-sky-200 text-sky-600 hover:bg-sky-50 hover:text-sky-700" title="Cetak invoice" aria-label={`Cetak invoice ${item.orderNumber}`} disabled={isSubmitting} onClick={() => void printPurchaseInvoice(item)}>
                                <Printer className="h-4 w-4" />
                              </InventoryIconButton>
                              {item.status === "ordered" ? (
                                <InventoryIconButton type="button" variant="secondary" compact className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" title="Terima barang" aria-label={`Terima barang ${item.orderNumber}`} disabled={isSubmitting} onClick={() => void receivePurchase(item)}>
                                  <PackageCheck className="h-4 w-4" />
                                </InventoryIconButton>
                              ) : null}
                              {item.status !== "cancelled" && remainingDebt > 0 ? (
                                <InventoryIconButton type="button" variant="outline" compact className="border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700" title="Catat pembayaran" aria-label={`Catat pembayaran ${item.orderNumber}`} disabled={isSubmitting} onClick={() => { setPaymentPurchaseTarget(item); setPaymentAmount(""); }}>
                                  <CreditCard className="h-4 w-4" />
                                </InventoryIconButton>
                              ) : null}
                              {item.status === "ordered" ? (
                                <InventoryIconButton type="button" variant="destructive" compact className="bg-red-600 text-white hover:bg-red-700" title="Batalkan PO" aria-label={`Batalkan ${item.orderNumber}`} disabled={isSubmitting || Number(item.paidTotal) > 0} onClick={() => { setCancelPurchaseTarget(item); setCancelPurchaseReason(""); }}>
                                  <Ban className="h-4 w-4" />
                                </InventoryIconButton>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!visiblePurchases.length ? <tr><td colSpan={8} className="px-4 py-6 text-sm text-muted-foreground">Belum ada pesanan pembelian.</td></tr> : null}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col gap-3 border-t px-4 py-4 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-muted-foreground">Showing {visiblePurchases.length ? (purchasePage - 1) * purchasePageSize + 1 : 0} to {Math.min(purchasePage * purchasePageSize, visiblePurchases.length)} of {visiblePurchases.length} entries</p>
                <div className="flex items-center gap-3">
                  <InventoryIconButton type="button" variant="outline" disabled={purchasePage <= 1} onClick={() => setPurchasePage((current) => Math.max(1, current - 1))} aria-label="Sebelumnya"><ChevronLeft className="h-4 w-4" /></InventoryIconButton>
                  <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-lg bg-primary/10 px-3 text-sm font-semibold text-primary">{purchasePage}</span>
                  <InventoryIconButton type="button" variant="outline" disabled={purchasePage >= Math.max(1, Math.ceil(visiblePurchases.length / purchasePageSize))} onClick={() => setPurchasePage((current) => Math.min(Math.max(1, Math.ceil(visiblePurchases.length / purchasePageSize)), current + 1))} aria-label="Berikutnya"><ChevronRight className="h-4 w-4" /></InventoryIconButton>
                </div>
              </div>
            </div>
          ) : null}
        </CollapsibleSection>
      ) : null}

      {false && showInventorySections ? (
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
        <div className="thin-x-scroll mt-4 overflow-x-auto rounded-lg border">
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

      {false && showInventorySections ? (
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
        <div className="thin-x-scroll mt-4 overflow-x-auto rounded-lg border">
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

      <AdminModal
        open={isPurchaseModalOpen}
        title="Buat Pesanan Pembelian"
        description="Buat PO ke supplier dan siapkan batch stok saat barang diterima."
        size="xl"
        onClose={() => setIsPurchaseModalOpen(false)}
      >
        <form className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" onSubmit={onPurchaseSubmit}>
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
                  unitCost: purchaseForm.priceMode === "unit" ? formatNumberForInput(nextSku?.cost ?? 0) : "0",
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
          <NumberField label={`Qty (${purchaseUnit})`} value={purchaseForm.quantityBase} onChange={(value) => setPurchaseForm({ ...purchaseForm, quantityBase: value })} />
          <div className="space-y-2">
            <Label>Harga Diisi Sebagai</Label>
            <div className="grid h-10 grid-cols-2 gap-1 rounded-md border bg-muted/30 p-1">
              <button
                type="button"
                className={`rounded px-2 text-xs font-semibold ${purchaseForm.priceMode === "total" ? "bg-background text-primary shadow-sm" : "text-muted-foreground"}`}
                onClick={() => setPurchaseForm({ ...purchaseForm, priceMode: "total", unitCost: "0" })}
              >
                Total Bayar
              </button>
              <button
                type="button"
                className={`rounded px-2 text-xs font-semibold ${purchaseForm.priceMode === "unit" ? "bg-background text-primary shadow-sm" : "text-muted-foreground"}`}
                onClick={() => setPurchaseForm({ ...purchaseForm, priceMode: "unit", unitCost: formatNumberForInput(selectedPurchaseSku?.cost ?? 0) })}
              >
                Per Satuan
              </button>
            </div>
          </div>
          <NumberField
            label={purchaseForm.priceMode === "total" ? "Total Bayar" : `Harga per ${purchaseUnit}`}
            value={purchaseForm.unitCost}
            onChange={(value) => setPurchaseForm({ ...purchaseForm, unitCost: value })}
          />
          <LotCodeField
            label="Batch / Lot (opsional)"
            value={purchaseForm.lotCode}
            onChange={(value) => setPurchaseForm({ ...purchaseForm, lotCode: value })}
            onRandom={() => setPurchaseForm({ ...purchaseForm, lotCode: makeLotCode(catalog, purchaseForm.skuId, "purchase") })}
          />
          <div className="space-y-2">
            <Label>Expired (opsional)</Label>
            <input type="date" className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" value={purchaseForm.expiryDate} onChange={(event) => setPurchaseForm({ ...purchaseForm, expiryDate: event.target.value })} />
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 md:col-span-2 lg:col-span-3">
            <p className="font-medium">Yang disimpan: {rupiah(purchaseUnitCost)} per {purchaseUnit}. Total PO: {rupiah(purchaseLineTotal)}.</p>
            <p className="text-xs">Default Total Bayar. Pilih Per Satuan kalau nota supplier memakai harga per {purchaseUnit}.</p>
          </div>
          <div className="lg:col-span-3">
            <TextField label="Catatan" value={purchaseForm.note} onChange={(value) => setPurchaseForm({ ...purchaseForm, note: value })} />
          </div>
          <div className="flex justify-end gap-2 md:col-span-2 lg:col-span-3">
            <Button type="button" variant="outline" onClick={() => setIsPurchaseModalOpen(false)}>Batal</Button>
            <Button type="submit" disabled={isSubmitting || !suppliers.length || !catalog.length || purchaseQty <= 0}>
              <Truck className="h-4 w-4" />
              Buat PO
            </Button>
          </div>
        </form>
      </AdminModal>

      <AdminModal
        open={Boolean(cancelPurchaseTarget)}
        title="Batalkan Pesanan Pembelian"
        description={cancelPurchaseTarget ? `PO ${cancelPurchaseTarget.orderNumber} akan dibatalkan dan tidak menambah stok.` : "Isi alasan pembatalan."}
        size="md"
        onClose={() => {
          setCancelPurchaseTarget(null);
          setCancelPurchaseReason("");
        }}
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Pembatalan hanya untuk PO berstatus Dipesan dan belum ada pembayaran.
          </div>
          <div className="space-y-2">
            <Label>Alasan</Label>
            <textarea
              className="min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={cancelPurchaseReason}
              onChange={(event) => setCancelPurchaseReason(event.target.value)}
              placeholder="Contoh: supplier tidak jadi kirim barang"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCancelPurchaseTarget(null);
                setCancelPurchaseReason("");
              }}
            >
              Batal
            </Button>
            <Button type="button" variant="destructive" disabled={isSubmitting || cancelPurchaseReason.trim().length < 3} onClick={() => void cancelPurchase()}>
              <Ban className="h-4 w-4" />
              Batalkan PO
            </Button>
          </div>
        </div>
      </AdminModal>

      <AdminModal
        open={Boolean(paymentPurchaseTarget)}
        title="Catat Pembayaran Supplier"
        description={paymentPurchaseTarget ? `Sisa pembayaran ${paymentPurchaseTarget.orderNumber}: ${rupiah(purchaseRemainingDebt(paymentPurchaseTarget))}.` : "Catat pembayaran supplier."}
        size="md"
        onClose={() => {
          setPaymentPurchaseTarget(null);
          setPaymentAmount("");
        }}
      >
        {paymentPurchaseTarget ? (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-lg border bg-muted/20 px-3 py-3 text-sm sm:grid-cols-3">
              <MetricText label="Total" value={rupiah(paymentPurchaseTarget.subtotal)} />
              <MetricText label="Terbayar" value={rupiah(paymentPurchaseTarget.paidTotal)} />
              <MetricText label="Sisa" value={rupiah(purchaseRemainingDebt(paymentPurchaseTarget))} />
            </div>
            <div className="space-y-2">
              <Label>Nominal Bayar</Label>
              <input
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                inputMode="decimal"
                placeholder={`Maksimal ${rupiah(purchaseRemainingDebt(paymentPurchaseTarget))}`}
                value={paymentAmount}
                onChange={(event) => {
                  const formatted = formatNumberInput(event.target.value);
                  const amount = parseIndonesianNumber(formatted);
                  const maxAmount = purchaseRemainingDebt(paymentPurchaseTarget);
                  setPaymentAmount(amount > maxAmount ? formatNumberForInput(maxAmount) : formatted);
                }}
              />
              <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                Nominal tidak bisa lebih dari sisa bayar.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setPaymentPurchaseTarget(null); setPaymentAmount(""); }}>Batal</Button>
              <Button type="button" disabled={isSubmitting || parseIndonesianNumber(paymentAmount) <= 0} onClick={() => void payPurchase(paymentPurchaseTarget, paymentAmount)}>
                <CreditCard className="h-4 w-4" />
                Catat Pembayaran
              </Button>
            </div>
          </div>
        ) : null}
      </AdminModal>
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

function TransferSummary(props: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-md border bg-background px-3 py-2 text-sm">
      <p className="text-xs text-muted-foreground">{props.label}</p>
      <p className={`mt-1 font-semibold ${props.highlight ? "text-primary" : "text-foreground"}`}>{props.value}</p>
    </div>
  );
}

function PurchaseStatusBadge(props: { status: string }) {
  const meta: Record<string, { label: string; className: string }> = {
    ordered: { label: "Dipesan", className: "border-amber-300 bg-amber-100 text-amber-900" },
    received: { label: "Diterima", className: "border-emerald-300 bg-emerald-100 text-emerald-900" },
    cancelled: { label: "Dibatalkan", className: "border-red-300 bg-red-100 text-red-900" },
  };
  const status = meta[props.status] ?? { label: props.status, className: "border-slate-300 bg-slate-100 text-slate-800" };
  return <span className={`mt-1 inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-semibold ${status.className}`}>{status.label}</span>;
}

function PurchasePaymentStatusBadge(props: { status: string; purchaseStatus?: string }) {
  if (props.purchaseStatus === "cancelled") {
    return <span className="mt-1 inline-flex h-7 items-center rounded-full border border-red-300 bg-red-100 px-2.5 text-xs font-semibold text-red-900">Batal</span>;
  }
  const meta: Record<string, { label: string; className: string }> = {
    unpaid: { label: "Belum dibayar", className: "border-amber-300 bg-amber-100 text-amber-900" },
    partial: { label: "Sebagian", className: "border-blue-300 bg-blue-100 text-blue-900" },
    paid: { label: "Lunas", className: "border-emerald-300 bg-emerald-100 text-emerald-900" },
  };
  const status = meta[props.status] ?? { label: props.status, className: "border-slate-300 bg-slate-100 text-slate-800" };
  return <span className={`mt-1 inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-semibold ${status.className}`}>{status.label}</span>;
}

function TablePager(props: { page: number; pageSize: number; total: number; pageCount: number; setPage: (value: number | ((current: number) => number)) => void }) {
  return (
    <div className="mt-4 flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:justify-between">
      <p className="text-sm text-muted-foreground">Showing {props.total ? (props.page - 1) * props.pageSize + 1 : 0} to {Math.min(props.page * props.pageSize, props.total)} of {props.total} entries</p>
      <div className="flex items-center gap-3">
        <InventoryIconButton type="button" variant="outline" disabled={props.page <= 1} onClick={() => props.setPage((current) => Math.max(1, current - 1))} aria-label="Sebelumnya"><ChevronLeft className="h-4 w-4" /></InventoryIconButton>
        <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-lg bg-primary/10 px-3 text-sm font-semibold text-primary">{Math.min(props.page, props.pageCount)}</span>
        <InventoryIconButton type="button" variant="outline" disabled={props.page >= props.pageCount} onClick={() => props.setPage((current) => Math.min(props.pageCount, current + 1))} aria-label="Berikutnya"><ChevronRight className="h-4 w-4" /></InventoryIconButton>
      </div>
    </div>
  );
}

function StockOpnameStatusBadge(props: { status: string }) {
  const meta = stockOpnameStatusMeta(props.status);
  return (
    <span className={`inline-flex h-7 shrink-0 items-center rounded-full border px-2.5 text-xs font-medium whitespace-nowrap ${meta.className}`}>
      {meta.label}
    </span>
  );
}

function StockOpnameInfo(props: { label: string; value: string; description: string; tone: "sky" | "emerald" | "violet" | "amber" | "slate" }) {
  const toneClass: Record<typeof props.tone, string> = {
    sky: "border-sky-200 bg-sky-50 text-sky-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    violet: "border-violet-200 bg-violet-50 text-violet-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    slate: "border-slate-200 bg-slate-50 text-slate-800",
  };
  return (
    <div className={`rounded-lg border px-4 py-3 ${toneClass[props.tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-75">{props.label}</p>
      <p className="mt-2 truncate text-lg font-semibold">{props.value}</p>
      <p className="mt-1 truncate text-xs opacity-75">{props.description}</p>
    </div>
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

function LotCodeField(props: { label: string; value: string; onChange: (value: string) => void; onRandom: () => void }) {
  return (
    <div className="space-y-2">
      <Label>{props.label}</Label>
      <div className="relative">
        <Input
          className="pr-11 uppercase"
          value={props.value}
          placeholder="LOT-YYYYMMDD-001"
          onChange={(event) => props.onChange(event.target.value.toUpperCase())}
        />
        <Button
          type="button"
          variant="ghost"
          className="absolute right-1 top-1 h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          onClick={props.onRandom}
          title="Buat kode acak"
          aria-label={`Buat kode acak untuk ${props.label}`}
        >
          <Shuffle className="h-4 w-4" />
        </Button>
      </div>
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

function makeLotCode(catalog: CatalogItem[], skuId: string, type: string) {
  const sku = catalog.find((item) => item.skuId === skuId);
  const skuPrefix = sanitizeLotPart(sku?.skuCode || sku?.skuName || "");
  const typePrefix = type === "opening" ? "OPEN" : type === "adjustment" ? "ADJ" : "LOT";
  const prefix = skuPrefix || typePrefix;
  const now = new Date();
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const sequence = String(Math.floor(Math.random() * 900) + 100);
  return `${prefix}-${datePart}-${sequence}`;
}

function sanitizeLotPart(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 12);
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
  const paymentTotal = detail.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const overpaid = Math.max(0, Number(detail.purchase.paidTotal) - Number(detail.purchase.subtotal));
  const cancellationReason = purchaseCancellationReason(detail.purchase.status, detail.purchase.note);
  const statusNote = purchaseInvoiceStatusNote(detail.purchase.status, detail.purchase.paymentStatus, remainingDebt);
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
          <td>${escapeHtml(payment.note ?? "-")}</td>
          <td class="right">${rupiah(payment.amount)}</td>
        </tr>`,
        )
        .join("")
    : `<tr><td colspan="5" class="muted">Belum ada pembayaran.</td></tr>`;

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
    .badge { display: inline-block; border-radius: 999px; padding: 3px 8px; font-weight: 700; font-size: 11px; }
    .status-ordered, .pay-unpaid { background: #fef3c7; color: #92400e; }
    .status-received, .pay-paid { background: #dcfce7; color: #166534; }
    .status-cancelled { background: #fee2e2; color: #991b1b; }
    .pay-partial { background: #dbeafe; color: #1e40af; }
    .danger { color: #b91c1c; font-weight: 700; }
    .success { color: #047857; font-weight: 700; }
    .notice { margin-top: 10px; border: 1px solid #d1d5db; background: #f9fafb; padding: 10px; font-size: 12px; }
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
    <tr><th>Tanggal PO</th><td>${formatDate(detail.purchase.createdAt)}</td><th>Status Barang</th><td><span class="badge ${purchaseInvoiceStatusClass(detail.purchase.status)}">${purchaseStatusLabel(detail.purchase.status)}</span></td></tr>
    <tr><th>Status Bayar</th><td><span class="badge ${purchaseInvoicePaymentClass(detail.purchase.paymentStatus)}">${purchasePaymentStatusLabel(detail.purchase.paymentStatus)}</span></td><th>Diterima</th><td>${detail.purchase.receivedAt ? formatDate(detail.purchase.receivedAt) : "-"}</td></tr>
    <tr><th>Alasan Batal</th><td colspan="3">${escapeHtml(cancellationReason || "-")}</td></tr>
    <tr><th>Catatan</th><td colspan="3">${escapeHtml(detail.purchase.note ?? "-")}</td></tr>
  </table>
  <div class="notice"><strong>Status invoice:</strong> ${escapeHtml(statusNote)}</div>

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
    <tr><th>Total Riwayat Bayar</th><td class="right">${rupiah(paymentTotal)}</td></tr>
    <tr><th>Kekurangan Bayar</th><td class="right ${remainingDebt > 0 ? "danger" : "success"}">${rupiah(remainingDebt)}</td></tr>
    <tr><th>Lebih Bayar</th><td class="right">${rupiah(overpaid)}</td></tr>
  </table>

  <h2>Pembayaran</h2>
  <table>
    <thead><tr><th>Tanggal</th><th>Metode</th><th>Referensi</th><th>Catatan</th><th class="right">Nominal</th></tr></thead>
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

function purchaseRemainingDebt(item: Pick<PurchaseOrder, "subtotal" | "paidTotal">) {
  return Math.max(0, Number(item.subtotal) - Number(item.paidTotal));
}

function purchaseStatusLabel(status: string) {
  const labels: Record<string, string> = {
    ordered: "Dipesan",
    received: "Diterima",
    cancelled: "Dibatalkan",
  };
  return labels[status] ?? status;
}

function purchaseInvoiceStatusClass(status: string) {
  const classes: Record<string, string> = {
    ordered: "status-ordered",
    received: "status-received",
    cancelled: "status-cancelled",
  };
  return classes[status] ?? "";
}

function purchasePaymentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    unpaid: "Belum dibayar",
    partial: "Sebagian",
    paid: "Lunas",
  };
  return labels[status] ?? status;
}

function purchaseInvoicePaymentClass(status: string) {
  const classes: Record<string, string> = {
    unpaid: "pay-unpaid",
    partial: "pay-partial",
    paid: "pay-paid",
  };
  return classes[status] ?? "";
}

function purchaseCancellationReason(status: string, note: string | null) {
  if (status !== "cancelled" || !note) return "";
  const marker = "Dibatalkan:";
  const index = note.lastIndexOf(marker);
  return index >= 0 ? note.slice(index + marker.length).trim() : note.trim();
}

function purchaseInvoiceStatusNote(status: string, paymentStatus: string, remainingDebt: number) {
  if (status === "cancelled") return "Pesanan pembelian dibatalkan. Tidak ada penerimaan stok dari PO ini.";
  if (status === "ordered") return "Barang belum diterima. Stok belum bertambah sampai proses Terima Barang dilakukan.";
  if (remainingDebt > 0) return `Barang sudah diterima. Masih ada kekurangan bayar ${rupiah(remainingDebt)}.`;
  if (paymentStatus === "paid") return "Barang sudah diterima dan pembayaran lunas.";
  return "Barang sudah diterima. Periksa riwayat pembayaran untuk status pembayaran terbaru.";
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
    batch_reconciliation: "Rekonsiliasi batch",
  };
  return sourceType ? (labels[sourceType] ?? sourceType) : "-";
}
