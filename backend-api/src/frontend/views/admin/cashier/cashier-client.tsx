"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  ArrowUpDown,
  Banknote,
  BadgePercent,
  Building2,
  Clock,
  CreditCard,
  LayoutGrid,
  Minus,
  Plus,
  Printer,
  ReceiptText,
  Scale,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CollapsibleSection } from "../_components/collapsible-section";
import { SearchableSelect } from "../_components/searchable-select";
import { printReceiptViaBrowser } from "../_components/receipt-browser-print";
import { useRolePermissions } from "../_components/use-role-permissions";
import { useToast } from "../_components/toast-provider";
import { allOutletsValue, useSelectedOutlet } from "@/frontend/controllers/selected-outlet-provider";
import { getOutlets, getProfile } from "@/frontend/controllers/admin-data-cache";
import { useRealtimeEvents } from "@/frontend/controllers/use-realtime-events";

type ApiResponse<T> = { data: T };
type Outlet = {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  logoUrl?: string | null;
  isActive?: boolean;
};
type Profile = { id: string; name: string; email: string; role: string };
type Shift = {
  id: string;
  status: string;
  openingCash: string;
  expectedCash: string;
  actualCash?: string | null;
  cashInTotal?: string;
  cashOutTotal?: string;
  cashVariance?: string | null;
  closeApprovalStatus?: string;
};
type ShiftCashMovement = {
  id: string;
  type: "cash_in" | "cash_out";
  amount: string;
  reason: string;
  note: string | null;
  actorName: string | null;
  createdAt: string;
};
type ShiftPaymentSummary = {
  method: string;
  amount: string;
  count: string;
};
type ShiftSummary = {
  shift: Shift;
  cashMovements: ShiftCashMovement[];
  paymentSummary: ShiftPaymentSummary[];
  variance: number | null;
};
type PendingVarianceShift = {
  id: string;
  cashierName: string | null;
  expectedCash: string;
  actualCash: string | null;
  cashVariance: string | null;
  varianceReason: string | null;
  closedAt: string | null;
};
type CatalogItem = {
  productId: string;
  productName: string;
  productImageUrl: string | null;
  category: string | null;
  skuId: string;
  skuCode: string;
  barcode: string | null;
  skuName: string;
  skuImageUrl: string | null;
  price: string;
  baseUnitId: string | null;
  saleUnitId: string;
  saleUnitToBaseFactor: string;
  trackInventory: boolean;
  quantityMode: "required" | "fixed_one";
  baseUnitCode: string | null;
  saleUnitCode: string | null;
  onHandBaseQty: string | null;
  reservedBaseQty: string | null;
  holdBaseQty: string | null;
};
type Customer = {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  isActive: boolean;
};
type UnitChoice = {
  id: string;
  label: string;
  toBaseFactor: number;
  price: number;
};
type CartLine = {
  item: CatalogItem;
  quantity: number;
  unitId: string;
  unitLabel: string;
  unitToBaseFactor: number;
  unitPrice: number;
  discount: string;
};
type CartSession = { id: string; label: string; lines: CartLine[] };
type PaymentInput = { id: string; method: string; amount: string };
type SalePaymentInput = { method: string; amount: number };
type SaleQuote = {
  subtotal: number;
  manualDiscountTotal: number;
  promotionDiscountTotal: number;
  discountTotal: number;
  taxTotal: number;
  serviceChargeTotal: number;
  donationTotal: number;
  roundingTotal: number;
  grandTotal: number;
  posSettings?: {
    taxEnabled: boolean;
    taxRatePercent: number;
    taxIncluded: boolean;
    serviceChargeEnabled: boolean;
    serviceChargeRatePercent: number;
  };
  appliedPromotions: Array<{
    code: string | null;
    name: string;
    type: string;
    discountTotal: number;
  }>;
  promotionIssues?: Array<{
    code: string;
    reason: string;
    message: string;
  }>;
};
type ReceiptSettings = {
  defaultOutletLogoUrl?: string | null;
  receiptLayout?: {
    autoPrint?: boolean;
    printMode?: "browser";
    printerName?: string;
    paperWidth?: "58" | "80";
    header?: ReceiptBlock[];
    body?: ReceiptBlock[];
    footer?: ReceiptBlock[];
    footerNote?: string;
  } | null;
};
type ReceiptBlock = "logo" | "outlet" | "address" | "cashier" | "receiptNumber" | "items" | "totals" | "payment" | "note";
type ReceiptPrintLayout = {
  paperWidth: "58" | "80";
  header: ReceiptBlock[];
  body: ReceiptBlock[];
  footer: ReceiptBlock[];
};
type SalesSummary = {
  transactionCount: number;
  netSales: string;
  grossProfit: string;
};
type SalesDetail = {
  id: string;
  outletName?: string;
  outletLogoUrl?: string | null;
  receiptNumber: string;
  cashierName: string | null;
  subtotal?: string;
  discountTotal?: string;
  taxTotal?: string;
  serviceChargeTotal?: string;
  donationTotal?: string;
  roundingTotal?: string;
  cashTenderedTotal?: string;
  changeTotal?: string;
  grandTotal: string;
  paymentMethods: string;
  payments?: Array<{
    method: string;
    amount: string;
    reference: string | null;
  }>;
  createdAt: string;
  items: Array<{
    name: string;
    quantityInput: string;
    unitCode: string | null;
    unitPrice: string;
    discountTotal?: string;
    lineTotal: string;
  }>;
};
type FlyingProduct = {
  id: string;
  name: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  active: boolean;
};

const pendingStorageKey = "pos_web_cashier_pending_sales";
const paymentMethods = [
  { value: "cash", label: "Tunai" },
  { value: "qris", label: "QRIS" },
  { value: "transfer", label: "Transfer" },
  { value: "card", label: "Kartu" },
  { value: "ewallet", label: "E-Wallet" },
  { value: "receivable", label: "Piutang" },
  { value: "other", label: "Lainnya" },
];
const wasteReasons = [
  ["crumbs_unsellable", "Remah tidak layak jual"],
  ["spilled", "Tumpah"],
  ["damaged", "Rusak"],
  ["quality_drop", "Turun kualitas"],
  ["expired", "Kedaluwarsa"],
  ["weighing_difference", "Selisih timbang"],
  ["sampling", "Sampling"],
  ["internal_use", "Pemakaian internal"],
  ["stock_opname_correction", "Koreksi opname"],
  ["other", "Lainnya"],
] as const;

function normalizeCartCustomerLabels(sessions: CartSession[]) {
  return sessions.map((session, index) => ({
    ...session,
    label: `Pelanggan ${index + 1}`,
  }));
}

export function CashierClient() {
  const access = useRolePermissions("cashier");
  const { showToast } = useToast();
  const { selectedOutletId } = useSelectedOutlet();
  const saleCounter = useRef(0);
  const cartFabRef = useRef<HTMLButtonElement | null>(null);
  const workspaceRequestRef = useRef(0);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [outletId, setOutletId] = useState("");
  const [shift, setShift] = useState<Shift | null>(null);
  const [shiftSummary, setShiftSummary] = useState<ShiftSummary | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [sessions, setSessions] = useState<CartSession[]>([
    { id: "main", label: "Pelanggan 1", lines: [] },
  ]);
  const [activeSessionId, setActiveSessionId] = useState("main");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Semua");
  const [openingCash, setOpeningCash] = useState("0");
  const [actualCash, setActualCash] = useState("0");
  const [varianceReason, setVarianceReason] = useState("");
  const [cashMovementForm, setCashMovementForm] = useState({
    type: "cash_in" as "cash_in" | "cash_out",
    amount: "",
    reason: "",
    note: "",
  });
  const [discount, setDiscount] = useState("0");
  const [tax, setTax] = useState("0");
  const [serviceCharge, setServiceCharge] = useState("0");
  const [donation, setDonation] = useState("0");
  const [promotionCode, setPromotionCode] = useState("");
  const [saleQuote, setSaleQuote] = useState<SaleQuote | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [paymentLines, setPaymentLines] = useState<PaymentInput[]>([
    { id: "payment-1", method: "cash", amount: "" },
  ]);
  const [activePaymentLineId, setActivePaymentLineId] = useState("payment-1");
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [activeLineDiscountSkuId, setActiveLineDiscountSkuId] = useState<string | null>(null);
  const [salesSummary, setSalesSummary] = useState<SalesSummary | null>(null);
  const [salesDetails, setSalesDetails] = useState<SalesDetail[]>([]);
  const [pendingVarianceShifts, setPendingVarianceShifts] = useState<PendingVarianceShift[]>([]);
  const [receiptAutoPrint, setReceiptAutoPrint] = useState(false);
  const [receiptPaperWidth, setReceiptPaperWidth] = useState<"58" | "80">("58");
  const [receiptHeader, setReceiptHeader] = useState<string[]>(["logo", "outlet", "address", "cashier", "receiptNumber"]);
  const [defaultOutletLogoUrl, setDefaultOutletLogoUrl] = useState("");
  const receiptSettingsRef = useRef({
    autoPrint: false,
    printMode: "browser" as const,
    paperWidth: "58" as "58" | "80",
    header: ["logo", "outlet", "address", "cashier", "receiptNumber"] as ReceiptBlock[],
    body: ["items", "totals", "payment"] as ReceiptBlock[],
    footer: ["note"] as ReceiptBlock[],
    defaultOutletLogoUrl: "",
    footerNote: "Terima kasih",
  });
  const [wasteForm, setWasteForm] = useState({
    skuId: "",
    quantity: "",
    reason: "crumbs_unsellable",
    note: "",
  });
  const [, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [activeModal, setActiveModal] = useState<
    | "shift"
    | "waste"
    | "reports"
    | "tools"
    | "cart"
    | null
  >(null);
  const [flyingProduct, setFlyingProduct] = useState<FlyingProduct | null>(null);

  const activeOutlet = outlets.find((item) => item.id === outletId) ?? null;
  const canApproveShiftVariance = profile?.role === "owner" || profile?.role === "admin_outlet";
  const activeSession = useMemo(
    () => sessions.find((item) => item.id === activeSessionId) ?? sessions[0],
    [activeSessionId, sessions],
  );
  const cart = useMemo(() => activeSession?.lines ?? [], [activeSession]);
  const rawSubtotal = cart.reduce((sum, line) => sum + lineNetTotal(line), 0);
  const manualDiscountTotal = Math.min(parseNumber(discount), rawSubtotal);
  const manualTaxTotal = Math.max(0, parseNumber(tax));
  const manualServiceChargeTotal = Math.max(0, parseNumber(serviceCharge));
  const donationTotal = Math.max(0, parseNumber(donation));
  const quotedSubtotalMatchesCart =
    saleQuote?.subtotal !== undefined &&
    Math.abs(saleQuote.subtotal - rawSubtotal) < 0.000001;
  const quotedManualDiscountMatchesInput =
    saleQuote?.manualDiscountTotal !== undefined &&
    Math.abs(saleQuote.manualDiscountTotal - manualDiscountTotal) < 0.000001;
  const quotedDonationMatchesInput =
    saleQuote?.donationTotal !== undefined &&
    Math.abs(saleQuote.donationTotal - donationTotal) < 0.000001;
  const quotedPromotionCodeMatchesInput =
    !promotionCode.trim() ||
    Boolean(
      saleQuote?.appliedPromotions.some(
        (promo) => promo.code?.toUpperCase() === promotionCode.trim().toUpperCase(),
      ),
    );
  const quoteMatchesCurrentInputs =
    Boolean(saleQuote) &&
    quotedSubtotalMatchesCart &&
    quotedManualDiscountMatchesInput &&
    quotedDonationMatchesInput &&
    quotedPromotionCodeMatchesInput;
  const subtotal = quoteMatchesCurrentInputs ? saleQuote?.subtotal ?? rawSubtotal : rawSubtotal;
  const discountTotal = quoteMatchesCurrentInputs ? saleQuote?.discountTotal ?? manualDiscountTotal : manualDiscountTotal;
  const taxTotal = quoteMatchesCurrentInputs ? saleQuote?.taxTotal ?? manualTaxTotal : (saleQuote?.taxTotal ?? manualTaxTotal);
  const serviceChargeTotal = quoteMatchesCurrentInputs
    ? saleQuote?.serviceChargeTotal ?? manualServiceChargeTotal
    : (saleQuote?.serviceChargeTotal ?? manualServiceChargeTotal);
  const taxIsIncludedInPrice = saleQuote?.posSettings?.taxIncluded ?? false;
  const totalBeforeRounding = Math.max(
    0,
    rawSubtotal -
      manualDiscountTotal +
      (taxIsIncludedInPrice ? 0 : taxTotal) +
      serviceChargeTotal +
      donationTotal,
  );
  const roundingTotal = quoteMatchesCurrentInputs
    ? saleQuote?.roundingTotal ?? roundToCashHundred(totalBeforeRounding) - totalBeforeRounding
    : roundToCashHundred(totalBeforeRounding) - totalBeforeRounding;
  const grandTotal = quoteMatchesCurrentInputs
    ? saleQuote?.grandTotal ?? roundToCashHundred(totalBeforeRounding)
    : roundToCashHundred(totalBeforeRounding);
  const paymentBreakdown = useMemo(
    () => calculatePaymentBreakdown(paymentLines, grandTotal),
    [grandTotal, paymentLines],
  );
  const activePaymentLine =
    paymentLines.find((line) => line.id === activePaymentLineId) ??
    paymentLines[0] ??
    { id: "payment-1", method: "cash", amount: "" };
  const activePaymentIndex = Math.max(
    0,
    paymentLines.findIndex((line) => line.id === activePaymentLine.id),
  );
  const hasReceivablePayment = paymentLines.some((line) => line.method === "receivable");
  const hasEnteredPaymentAmount = paymentLines.some(
    (line) => line.method !== "receivable" && parseNumber(line.amount) > 0,
  );
  const paidTotal = paymentBreakdown.appliedTotal;
  const cashTenderedTotal = paymentBreakdown.cashTenderedTotal;
  const receivableTotal = hasReceivablePayment ? Math.max(0, grandTotal - paidTotal) : 0;
  const changeTotal = paymentBreakdown.changeTotal;
  const promotionDiscountTotal = quoteMatchesCurrentInputs ? saleQuote?.promotionDiscountTotal ?? 0 : 0;
  const isTaxIncluded = taxIsIncludedInPrice;
  const showManualDiscount = manualDiscountTotal > 0;
  const showPromotionDiscount = promotionDiscountTotal > 0;
  const showTotalDiscount = showManualDiscount && showPromotionDiscount;
  const showTaxCharge = taxTotal > 0 && !isTaxIncluded;
  const showIncludedTax = taxTotal > 0 && isTaxIncluded;
  const showServiceCharge = serviceChargeTotal > 0;
  const showPaidTotal = hasEnteredPaymentAmount && paidTotal > 0;
  const showChangeTotal = changeTotal > 0;
  const expectedShiftCash = parseNumber(shift?.expectedCash ?? 0);
  const actualShiftCash = parseNumber(actualCash);
  const shiftCashVariance = actualShiftCash - expectedShiftCash;
  const hasShiftCashVariance = Math.abs(shiftCashVariance) >= 1;
  const shiftPaymentTotal = (shiftSummary?.paymentSummary ?? []).reduce(
    (sum, item) => sum + parseNumber(item.amount),
    0,
  );

  const categories = useMemo(
    () => [
      "Semua",
      ...Array.from(
        new Set(catalog.map((item) => item.category || "Tanpa kategori")),
      ).sort((a, b) => a.localeCompare(b)),
    ],
    [catalog],
  );
  const visibleCatalog = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return catalog.filter((item) => {
      const itemCategory = item.category || "Tanpa kategori";
      const matchesCategory = category === "Semua" || itemCategory === category;
      const matchesSearch =
        !keyword ||
        [item.productName, item.skuName, item.skuCode, item.barcode ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      return matchesCategory && matchesSearch;
    });
  }, [catalog, category, search]);
  const selectedWasteItem =
    catalog.find((item) => item.skuId === wasteForm.skuId) ?? catalog[0] ?? null;
  const selectedWasteAvailableQty = selectedWasteItem ? availableBaseQty(selectedWasteItem) : 0;
  const autoPromotionQuoteKey = useMemo(
    () =>
      JSON.stringify({
        outletId: activeOutlet?.id ?? "",
        customerId,
        items: cart.map((line) => ({
          skuId: line.item.skuId,
          quantity: line.quantity,
          unitId: line.unitId,
          unitPrice: line.unitPrice,
          discountTotal: lineDiscountTotal(line),
        })),
        discountTotal: manualDiscountTotal,
        taxTotal: manualTaxTotal,
        serviceChargeTotal: manualServiceChargeTotal,
        donationTotal,
      }),
    [
      activeOutlet?.id,
      cart,
      customerId,
      manualDiscountTotal,
      manualServiceChargeTotal,
      manualTaxTotal,
      donationTotal,
    ],
  );

  async function loadInitial() {
    setIsLoading(true);
    try {
      const [profileData, outletsData, settingsResponse] = await Promise.all([
        getProfile(),
        getOutlets({ force: true }),
        fetch("/api/settings"),
      ]);
      if (settingsResponse.status === 401) {
        window.location.assign("/admin/login");
        return;
      }
      if (settingsResponse.ok) {
        const settingsJson = (await settingsResponse.json()) as ApiResponse<ReceiptSettings>;
        applyReceiptSettings(settingsJson.data);
      }
      const availableOutlets = outletsData as Outlet[];
      setProfile(profileData as Profile);
      setOutlets(availableOutlets);
      if (!availableOutlets.length) {
        setOutletId("");
        setShift(null);
        setShiftSummary(null);
        setCatalog([]);
        setSalesSummary(null);
        setSalesDetails([]);
        notifyCashierError("Outlet tidak tersedia", "Tidak ada outlet aktif untuk kasir.");
        setIsLoading(false);
      }
    } catch {
      notifyCashierError("Data kasir gagal dimuat", "Gagal memuat profil atau outlet kasir.");
      setIsLoading(false);
    }
  }

  async function loadWorkspace(nextOutletId = outletId) {
    if (!nextOutletId) return;
    const requestId = ++workspaceRequestRef.current;
    setIsLoading(true);
    setMessage(null);
    const query = `outletId=${encodeURIComponent(nextOutletId)}`;
    const pendingVarianceRequest = canApproveShiftVariance
      ? fetch(`/api/shifts/pending-variance?${query}`)
      : Promise.resolve(null);
    const [shiftResponse, catalogResponse, summaryResponse, detailResponse, customerResponse, pendingVarianceResponse] =
      await Promise.all([
        fetch(`/api/shifts/current?${query}`),
        fetch(`/api/catalog?${query}`),
        fetch(`/api/reports/sales-summary?${query}`),
        fetch(`/api/reports/sales-detail?${query}`),
        fetch("/api/customers"),
        pendingVarianceRequest,
      ]);
    if ([shiftResponse, catalogResponse, summaryResponse, detailResponse, customerResponse, pendingVarianceResponse].some((r) => r?.status === 401)) {
      window.location.assign("/admin/login");
      return;
    }
    if (!shiftResponse.ok || !catalogResponse.ok) {
      if (requestId !== workspaceRequestRef.current) return;
      notifyCashierError("Workspace gagal dimuat", "Gagal memuat shift atau katalog outlet.");
      setIsLoading(false);
      return;
    }
    const shiftJson = (await shiftResponse.json()) as ApiResponse<Shift | null>;
    const catalogJson = (await catalogResponse.json()) as ApiResponse<{ items: CatalogItem[] }>;
    const nextSalesSummary = summaryResponse.ok
      ? ((await summaryResponse.json()) as ApiResponse<SalesSummary>).data
      : null;
    const nextSalesDetails = detailResponse.ok
      ? ((await detailResponse.json()) as ApiResponse<SalesDetail[]>).data
      : null;
    const nextCustomers = customerResponse.ok
      ? ((await customerResponse.json()) as ApiResponse<Customer[]>).data.filter((item) => item.isActive)
      : [];
    const nextPendingVarianceShifts = pendingVarianceResponse?.ok
      ? ((await pendingVarianceResponse.json()) as ApiResponse<PendingVarianceShift[]>).data
      : [];
    if (requestId !== workspaceRequestRef.current) return;
    setShift(shiftJson.data);
    if (!shiftJson.data) {
      setShiftSummary(null);
    }
    setActualCash(formatPlain(shiftJson.data?.expectedCash ?? 0));
    setCatalog(catalogJson.data.items);
    setWasteForm((current) => ({
      ...current,
      skuId:
        current.skuId && catalogJson.data.items.some((item) => item.skuId === current.skuId)
          ? current.skuId
          : catalogJson.data.items[0]?.skuId ?? "",
    }));
    setSalesSummary(nextSalesSummary);
    setSalesDetails(nextSalesDetails ?? []);
    setPendingVarianceShifts(nextPendingVarianceShifts);
    setCustomers(nextCustomers);
    setCustomerId((current) => (current && nextCustomers.some((item) => item.id === current) ? current : ""));
    setIsLoading(false);
  }

  async function loadShiftSummary(shiftId = shift?.id) {
    if (!shiftId) {
      setShiftSummary(null);
      return;
    }
    const response = await fetch(`/api/shifts/${shiftId}/summary`);
    if (response.status === 401) {
      window.location.assign("/admin/login");
      return;
    }
    if (!response.ok) {
      notifyCashierError("Ringkasan shift gagal dimuat", await readError(response, "Ringkasan shift gagal dimuat."));
      return;
    }
    const json = (await response.json()) as ApiResponse<ShiftSummary>;
    setShiftSummary(json.data);
  }

  useEffect(() => {
    window.localStorage.removeItem(pendingStorageKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!outlets.length) return;
    const selectedIsSpecificOutlet =
      selectedOutletId !== allOutletsValue &&
      outlets.some((item) => item.id === selectedOutletId);
    const nextOutletId = selectedIsSpecificOutlet ? selectedOutletId : outlets[0]?.id || "";
    if (!nextOutletId) return;
    if (outletId && nextOutletId !== outletId) {
      resetCarts();
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOutletId(nextOutletId);
    void loadWorkspace(nextOutletId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outlets, selectedOutletId]);

  useEffect(() => {
    if (!activeOutlet || !cart.length) return;
    const timer = window.setTimeout(() => {
      void quoteCurrentSale({
        silent: true,
        promotionCodes: promotionCode.trim() ? [promotionCode.trim()] : [],
      });
    }, 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPromotionQuoteKey, promotionCode]);

  useEffect(() => {
    if (activeModal !== "shift" || !shift?.id) return;
    const timer = window.setTimeout(() => {
      void loadShiftSummary(shift.id);
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModal, shift?.id]);

  useRealtimeEvents({
    topics: ["sales", "inventory", "shift", "sync", "waste", "customers", "settings", "promotions"],
    enabled: Boolean(outletId),
    debounceMs: 500,
    onEvent: (event) => {
      if (event.outletId && event.outletId !== outletId) return;
      if (event.topics.includes("settings") || event.topics.includes("promotions")) {
        void shouldAutoPrintReceipt();
      }
      void loadWorkspace(outletId);
      if (shift?.id) {
        void loadShiftSummary(shift.id);
      }
    },
  });

  async function runBusy(action: () => Promise<void>) {
    setIsBusy(true);
    try {
      await action();
    } finally {
      setIsBusy(false);
    }
  }

  async function openShift() {
    if (!outletId) return;
    await runBusy(async () => {
      const response = await fetch("/api/shifts/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outletId,
          openingCash: parseNumber(openingCash),
        }),
      });
      if (!response.ok) {
        notifyCashierError("Buka shift gagal", await readError(response, "Buka shift gagal."));
        return;
      }
      const json = (await response.json()) as ApiResponse<Shift>;
      setShift(json.data);
      setActualCash(formatPlain(json.data.expectedCash));
      setShiftSummary(null);
      await loadShiftSummary(json.data.id);
      notifyCashierSuccess("Shift dibuka");
      setActiveModal(null);
    });
  }

  async function saveCashMovement() {
    if (!shift) {
      notifyCashierError("Shift belum dibuka", "Buka shift sebelum mencatat kas masuk atau kas keluar.");
      return;
    }
    const amount = parseNumber(cashMovementForm.amount);
    if (amount <= 0) {
      notifyCashierError("Nominal belum valid", "Nominal kas masuk/keluar wajib lebih dari 0.");
      return;
    }
    if (cashMovementForm.reason.trim().length < 3) {
      notifyCashierError("Alasan wajib diisi", "Isi alasan kas masuk/keluar minimal 3 karakter.");
      return;
    }
    await runBusy(async () => {
      const response = await fetch("/api/shifts/cash-movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftId: shift.id,
          type: cashMovementForm.type,
          amount,
          reason: cashMovementForm.reason.trim(),
          note: cashMovementForm.note.trim() || undefined,
        }),
      });
      if (!response.ok) {
        notifyCashierError("Mutasi kas gagal", await readError(response, "Mutasi kas gagal."));
        return;
      }
      setCashMovementForm((current) => ({ ...current, amount: "", reason: "", note: "" }));
      notifyCashierSuccess(cashMovementForm.type === "cash_in" ? "Kas masuk dicatat" : "Kas keluar dicatat");
      await loadWorkspace(outletId);
      await loadShiftSummary(shift.id);
      setActiveModal(null);
    });
  }

  async function closeShift() {
    if (!shift) return;
    if (hasShiftCashVariance && !varianceReason.trim()) {
      notifyCashierError("Alasan selisih wajib diisi", "Isi alasan selisih sebelum tutup shift.");
      return;
    }
    await runBusy(async () => {
      const response = await fetch("/api/shifts/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftId: shift.id,
          actualCash: parseNumber(actualCash),
          varianceReason: hasShiftCashVariance ? varianceReason.trim() : undefined,
        }),
      });
      if (!response.ok) {
        notifyCashierError("Tutup shift gagal", await readError(response, "Tutup shift gagal."));
        return;
      }
      const json = (await response.json()) as ApiResponse<Shift>;
      setShift(null);
      setShiftSummary(null);
      setVarianceReason("");
      resetCarts();
      if (json.data.closeApprovalStatus === "variance_pending") {
        notifyCashierInfo("Shift menunggu approval", "Selisih kas sudah diajukan ke owner/admin outlet.");
      } else {
        notifyCashierSuccess("Shift ditutup");
      }
      await loadWorkspace(outletId);
      setActiveModal(null);
    });
  }

  async function approveShiftVariance(target: PendingVarianceShift) {
    if (!canApproveShiftVariance) return;
    await runBusy(async () => {
      const response = await fetch(`/api/shifts/${target.id}/approve-variance`, { method: "POST" });
      if (!response.ok) {
        notifyCashierError("Approve selisih gagal", await readError(response, "Approve selisih gagal."));
        return;
      }
      notifyCashierSuccess("Selisih kas diapprove");
      await loadWorkspace(outletId);
      setActiveModal(null);
    });
  }

  function notifyCashierError(title: string, description?: string) {
    setMessage(description ?? title);
    showToast({ tone: "error", title, description });
  }

  function notifyCashierInfo(title: string, description?: string) {
    setMessage(description ?? title);
    showToast({ tone: "info", title, description });
  }

  function notifyCashierSuccess(title: string, description?: string) {
    setMessage(description ?? title);
    showToast({ tone: "success", title, description });
  }

  function notifyStockError(message: string) {
    notifyCashierError("Stok tidak cukup", message);
  }

  function setActiveLines(nextLines: CartLine[]) {
    setSessions((current) =>
      current.map((session) =>
        session.id === activeSessionId ? { ...session, lines: nextLines } : session,
      ),
    );
  }

  function addToCart(item: CatalogItem, event?: MouseEvent<HTMLButtonElement>) {
    const existing = cart.find((line) => line.item.skuId === item.skuId);
    const unit = unitChoices(item)[0];
    const nextLine: CartLine = existing
      ? { ...existing, quantity: existing.quantity + 1 }
      : {
          item,
          quantity: 1,
          unitId: unit.id,
          unitLabel: unit.label,
          unitToBaseFactor: unit.toBaseFactor,
          unitPrice: unit.price,
          discount: "0",
        };
    const stockMessage = stockLimitMessage(nextLine, nextLine.quantity);
    if (stockMessage) {
      notifyStockError(stockMessage);
      return;
    }
    if (existing) {
      setActiveLines(
        cart.map((line) => (line.item.skuId === item.skuId ? nextLine : line)),
      );
    } else {
      setActiveLines([...cart, nextLine]);
    }
    animateProductToCart(item, event?.currentTarget ?? null);
  }

  function animateProductToCart(item: CatalogItem, source: HTMLElement | null) {
    const target = cartFabRef.current;
    if (!source || !target) return;
    const sourceRect = source.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const nextFlyer = {
      id: `${item.skuId}-${Date.now()}`,
      name: item.skuName,
      x: sourceRect.left + sourceRect.width / 2,
      y: sourceRect.top + sourceRect.height / 2,
      targetX: targetRect.left + targetRect.width / 2,
      targetY: targetRect.top + targetRect.height / 2,
      active: false,
    };
    setFlyingProduct(nextFlyer);
    window.requestAnimationFrame(() => {
      setFlyingProduct({ ...nextFlyer, active: true });
    });
    window.setTimeout(() => setFlyingProduct(null), 620);
  }

  function changeQuantity(line: CartLine, quantity: number) {
    if (quantity <= 0) {
      setActiveLines(cart.filter((item) => item.item.skuId !== line.item.skuId));
      return;
    }
    const stockMessage = stockLimitMessage(line, quantity);
    if (stockMessage) {
      notifyStockError(stockMessage);
      return;
    }
    setActiveLines(
      cart.map((item) =>
        item.item.skuId === line.item.skuId ? { ...item, quantity } : item,
      ),
    );
  }

  function changeUnit(line: CartLine, unitId: string) {
    const unit = unitChoices(line.item).find((item) => item.id === unitId);
    if (!unit) return;
    const nextLine = {
      ...line,
      unitId: unit.id,
      unitLabel: unit.label,
      unitToBaseFactor: unit.toBaseFactor,
      unitPrice: unit.price,
    };
    const stockMessage = stockLimitMessage(nextLine, nextLine.quantity);
    if (stockMessage) {
      notifyStockError(stockMessage);
      return;
    }
    setActiveLines(
      cart.map((item) => (item.item.skuId === line.item.skuId ? nextLine : item)),
    );
  }

  function changeLineDiscount(line: CartLine, value: string) {
    const nextDiscount = formatNumberInput(value);
    setActiveLines(
      cart.map((item) =>
        item.item.skuId === line.item.skuId ? { ...item, discount: nextDiscount } : item,
      ),
    );
  }

  function newSession() {
    const id = `session-${Date.now()}`;
    setSessions((current) => {
      const normalized = normalizeCartCustomerLabels(current);
      return [
        ...normalized,
        { id, label: `Pelanggan ${normalized.length + 1}`, lines: [] },
      ];
    });
    setActiveSessionId(id);
  }

  function closeSession() {
    if (sessions.length <= 1) {
      setSessions((current) => normalizeCartCustomerLabels([{ ...current[0], lines: [] }]));
      return;
    }
    const nextSessions = normalizeCartCustomerLabels(sessions.filter((item) => item.id !== activeSessionId));
    setSessions(nextSessions);
    setActiveSessionId(nextSessions[0].id);
  }

  function resetCarts() {
    setSessions([{ id: "main", label: "Pelanggan 1", lines: [] }]);
    setActiveSessionId("main");
    setDiscount("0");
    setTax("0");
    setServiceCharge("0");
    setDonation("0");
    setPromotionCode("");
    setSaleQuote(null);
    setPaymentLines([{ id: "payment-1", method: "cash", amount: "" }]);
    setActivePaymentLineId("payment-1");
    setIsPaymentModalOpen(false);
    setActiveLineDiscountSkuId(null);
  }

  async function checkout() {
    if (!activeOutlet) {
      notifyCashierError("Outlet belum dipilih", "Pilih outlet terlebih dahulu.");
      return;
    }
    if (!shift) {
      notifyCashierError("Shift belum dibuka", "Buka shift sebelum transaksi.");
      return;
    }
    if (!cart.length) {
      notifyCashierError("Keranjang kosong", "Keranjang masih kosong.");
      return;
    }
    if (hasReceivablePayment && !customerId) {
      notifyCashierError("Pelanggan wajib dipilih", "Pilih pelanggan terlebih dahulu untuk transaksi piutang.");
      return;
    }
    const realPaymentLines = paymentLines.filter((line) => line.method !== "receivable");
    if (!realPaymentLines.length && !hasReceivablePayment) {
      notifyCashierError("Pembayaran belum ada", "Tambahkan minimal satu pembayaran.");
      return;
    }
    const hasEmptySplitAmount =
      realPaymentLines.length > 1 || hasReceivablePayment
        ? realPaymentLines.some((line) => parseNumber(line.amount) <= 0)
        : false;
    if (hasEmptySplitAmount) {
      notifyCashierError("Nominal pembayaran belum valid", "Nominal setiap pembayaran split wajib lebih dari 0.");
      return;
    }
    if (paymentBreakdown.nonCashOverpaid > 0) {
      notifyCashierError(
        "Pembayaran non-tunai berlebih",
        "Kembalian hanya berlaku untuk tunai. Kurangi nominal QRIS, transfer, kartu, atau e-wallet sesuai total transaksi.",
      );
      return;
    }
    if (!hasReceivablePayment && paidTotal + 0.000001 < grandTotal) {
      notifyCashierError("Pembayaran kurang", "Total pembayaran masih kurang dari total transaksi.");
      return;
    }
    const stockMessage = cart.map((line) => stockLimitMessage(line, line.quantity)).find(Boolean);
    if (stockMessage) {
      notifyStockError(stockMessage);
      return;
    }
    saleCounter.current += 1;
    const payload = buildSalePayload(activeOutlet.id, shift.id, saleCounter.current);
    await runBusy(async () => {
      try {
        const response = await fetch("/api/sales", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          notifyCashierError("Transaksi gagal", await readError(response, "Transaksi gagal."));
          return;
        }
        if (await shouldAutoPrintReceipt()) {
          await printReceipt(payload.receiptNumber, activeOutlet.name, payload.payments, cashTenderedTotal, changeTotal, payload.allowReceivable ? receivableTotal : 0);
        }
        resetCarts();
        setActiveModal(null);
        notifyCashierSuccess("Transaksi selesai");
        await loadWorkspace(outletId);
      } catch {
        notifyCashierError("Transaksi gagal", "Koneksi ke server terputus. Kasir web tidak menyimpan transaksi offline.");
      }
    });
  }

  function buildSalePayload(nextOutletId: string, shiftId: string, counter: number) {
    const now = new Date();
    const breakdown = calculatePaymentBreakdown(paymentLines, grandTotal);
    const payments = breakdown.salePayments;
    const nextPaidTotal = payments.reduce((sum, current) => sum + current.amount, 0);
    const allowReceivable = hasReceivablePayment && nextPaidTotal < grandTotal;
    return {
      outletId: nextOutletId,
      shiftId,
      idempotencyKey: `web-${now.getTime()}-${counter}`,
      receiptNumber: `WEB-${now.getTime()}`,
      items: cart.map((line) => ({
        skuId: line.item.skuId,
        quantity: line.quantity,
        unitId: line.unitId,
        unitPrice: line.unitPrice,
        discountTotal: lineDiscountTotal(line),
      })),
      payments,
      cashTenderedTotal: breakdown.cashTenderedTotal,
      customerId: customerId || undefined,
      allowReceivable,
      receivableNote: allowReceivable ? "Piutang dari kasir web" : undefined,
      discountTotal: manualDiscountTotal,
      promotionCodes: promotionCode.trim() ? [promotionCode.trim()] : [],
      taxTotal,
      serviceChargeTotal,
      donationTotal,
      source: "web_cashier",
      clientCreatedAt: now.toISOString(),
    };
  }

  function applyReceiptSettings(settings: ReceiptSettings) {
    const layout = settings.receiptLayout;
    const sanitizedLayout = sanitizeReceiptLayout({
      paperWidth: layout?.paperWidth === "80" ? "80" : "58",
      header: layout?.header?.length ? layout.header : ["logo", "outlet", "address", "cashier", "receiptNumber"],
      body: layout?.body?.length ? layout.body : ["items", "totals", "payment"],
      footer: layout?.footer?.length ? layout.footer : ["note"],
    });
    const nextSettings = {
      autoPrint: Boolean(layout?.autoPrint),
      printMode: "browser" as const,
      paperWidth: sanitizedLayout.paperWidth,
      header: sanitizedLayout.header,
      body: sanitizedLayout.body,
      footer: sanitizedLayout.footer,
      defaultOutletLogoUrl: settings.defaultOutletLogoUrl ?? "",
      footerNote: layout?.footerNote?.trim() || "Terima kasih",
    };
    receiptSettingsRef.current = nextSettings;
    setReceiptAutoPrint(nextSettings.autoPrint);
    setReceiptPaperWidth(nextSettings.paperWidth);
    setReceiptHeader(nextSettings.header);
    setDefaultOutletLogoUrl(nextSettings.defaultOutletLogoUrl);
  }

  async function shouldAutoPrintReceipt() {
    try {
      const response = await fetch("/api/settings", { cache: "no-store" });
      if (!response.ok) return receiptAutoPrint;
      const settingsJson = (await response.json()) as ApiResponse<ReceiptSettings>;
      applyReceiptSettings(settingsJson.data);
      return Boolean(settingsJson.data.receiptLayout?.autoPrint);
    } catch {
      return receiptAutoPrint;
    }
  }

  async function quoteCurrentSale(options: { silent?: boolean; promotionCodes?: string[] } = {}) {
    if (!activeOutlet) {
      if (!options.silent) notifyCashierError("Outlet belum dipilih", "Pilih outlet terlebih dahulu.");
      return false;
    }
    if (!cart.length) {
      if (!options.silent) notifyCashierError("Keranjang kosong", "Keranjang masih kosong.");
      return false;
    }
    if (!options.silent) {
      setIsQuoting(true);
      setMessage(null);
    }
    const promotionCodes =
      options.promotionCodes ??
      (promotionCode.trim() ? [promotionCode.trim()] : []);
    const response = await fetch("/api/sales/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        outletId: activeOutlet.id,
        customerId: customerId || undefined,
        items: cart.map((line) => ({
          skuId: line.item.skuId,
          quantity: line.quantity,
          unitId: line.unitId,
          unitPrice: line.unitPrice,
          discountTotal: lineDiscountTotal(line),
        })),
        discountTotal: manualDiscountTotal,
        taxTotal: manualTaxTotal,
        serviceChargeTotal: manualServiceChargeTotal,
        donationTotal,
        promotionCodes,
      }),
    });
    if (!options.silent) setIsQuoting(false);
    if (!response.ok) {
      if (!options.silent) {
        notifyCashierError("Total gagal dihitung", await readError(response, "Promo atau total gagal dihitung."));
      }
      setSaleQuote(null);
      return false;
    }
    const json = (await response.json()) as ApiResponse<SaleQuote>;
    setSaleQuote(json.data);
    if (!options.silent) {
      const requestedCodes = promotionCodes.map((code) => code.toUpperCase());
      const matchedRequestedCode = json.data.appliedPromotions.some(
        (promo) => promo.code && requestedCodes.includes(promo.code.toUpperCase()),
      );
      const issueMessage = json.data.promotionIssues?.[0]?.message;
      if (requestedCodes.length && !matchedRequestedCode) {
        notifyCashierError(
          "Promo tidak dapat digunakan",
          issueMessage ?? "Kode promo tidak ditemukan atau syarat promo belum terpenuhi.",
        );
      }
      if (!(requestedCodes.length && !matchedRequestedCode)) {
        if (json.data.appliedPromotions.length) {
          notifyCashierSuccess("Promo berhasil diterapkan");
        } else {
          notifyCashierInfo("Total berhasil dihitung");
        }
      }
    }
    return true;
  }

  async function openPaymentModal() {
    if (!activeOutlet) {
      notifyCashierError("Outlet belum dipilih", "Pilih outlet terlebih dahulu.");
      return;
    }
    if (!cart.length) {
      notifyCashierError("Keranjang kosong", "Keranjang masih kosong.");
      return;
    }
    setIsPaymentModalOpen(true);
    await quoteCurrentSale({
      silent: true,
      promotionCodes: promotionCode.trim() ? [promotionCode.trim()] : [],
    });
  }

  async function submitWaste(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedWasteItem?.baseUnitId) {
      notifyCashierError("Satuan produk belum tersedia", "Satuan dasar produk belum tersedia.");
      return;
    }
    const quantity = parseNumber(wasteForm.quantity);
    if (quantity <= 0) {
      notifyCashierError("Qty belum valid", "Qty remahan harus lebih dari 0.");
      return;
    }
    if (quantity > selectedWasteAvailableQty + 0.000001) {
      notifyStockError(`Qty remahan maksimal ${qty(selectedWasteAvailableQty)} ${selectedWasteItem.baseUnitCode ?? "unit"}.`);
      return;
    }
    await runBusy(async () => {
      const response = await fetch("/api/waste-adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outletId,
          skuId: selectedWasteItem.skuId,
          quantity,
          unitId: selectedWasteItem.baseUnitId,
          reason: wasteForm.reason,
          note: wasteForm.note || undefined,
        }),
      });
      if (!response.ok) {
        notifyCashierError("Input remahan gagal", await readError(response, "Input remahan gagal."));
        return;
      }
      setWasteForm((current) => ({ ...current, quantity: "", note: "" }));
      notifyCashierSuccess("Remahan dicatat", "Stok diperbarui.");
      await loadWorkspace(outletId);
      setActiveModal(null);
    });
  }

  function changeWasteQuantity(value: string) {
    const nextValue = formatNumberInput(value);
    const parsed = parseNumber(nextValue);
    if (selectedWasteItem && parsed > selectedWasteAvailableQty) {
      setWasteForm({
        ...wasteForm,
        quantity: formatPlain(selectedWasteAvailableQty),
      });
      notifyStockError(`Qty remahan maksimal ${qty(selectedWasteAvailableQty)} ${selectedWasteItem.baseUnitCode ?? "unit"}.`);
      return;
    }
    setWasteForm({ ...wasteForm, quantity: nextValue });
  }

  function addPaymentLine() {
    const nextLine = {
      id: createPaymentLineId(),
      method: nextPaymentMethod(paymentLines),
      amount: "",
    };
    setPaymentLines([...paymentLines, nextLine]);
    setActivePaymentLineId(nextLine.id);
  }

  function updatePaymentLine(id: string, values: Partial<PaymentInput>) {
    setPaymentLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...values } : line)),
    );
  }

  function removePaymentLine(id: string) {
    const nextLines =
      paymentLines.length <= 1
        ? [{ id: "payment-1", method: "cash", amount: "" }]
        : paymentLines.filter((line) => line.id !== id);
    setPaymentLines(nextLines);
    if (!nextLines.some((line) => line.id === activePaymentLineId)) {
      setActivePaymentLineId(nextLines[0].id);
    }
  }

  async function printReceipt(
    receiptNumber: string,
    outletName: string,
    payments: SalePaymentInput[],
    cashTendered: number,
    change: number,
    receivableAmount: number,
  ) {
    const printSettings = receiptSettingsRef.current;
    const text = buildReceiptText({
      receiptNumber,
      outletName,
      outletAddress: activeOutlet?.address ?? "",
      cashierName: profile?.name ?? "Kasir",
      footerNote: printSettings.footerNote || "Terima kasih",
      layout: printSettings,
      lines: cart,
      subtotal,
      discount: discountTotal,
      tax: taxTotal,
      serviceCharge: serviceChargeTotal,
      donation: donationTotal,
      rounding: roundingTotal,
      total: grandTotal,
      payments,
      cashTenderedTotal: cashTendered,
      changeTotal: change,
      receivableAmount,
    });
    try {
      await printReceiptViaBrowser(text, {
        title: `Struk ${receiptNumber}`,
        paperWidth: printSettings.paperWidth || receiptPaperWidth,
        logoUrl: activeOutlet?.logoUrl || printSettings.defaultOutletLogoUrl || defaultOutletLogoUrl,
        showLogo: receiptLayoutHasBlock(printSettings, "logo") || receiptHeader.includes("logo"),
      });
      notifyCashierSuccess("Dialog print dibuka", "Pilih printer dari browser.");
    } catch {
      notifyCashierError("Print struk gagal", "Browser belum bisa membuka dialog print.");
    }
  }

  async function reprintSalesDetail(sale: SalesDetail) {
    const printSettings = receiptSettingsRef.current;
    const text = buildSalesDetailReprintText(
      sale,
      activeOutlet?.name ?? "Outlet",
      activeOutlet?.address ?? "",
      printSettings,
      printSettings.footerNote || "Terima kasih",
    );
    try {
      await printReceiptViaBrowser(text, {
        title: `Cetak ulang ${sale.receiptNumber}`,
        paperWidth: printSettings.paperWidth || receiptPaperWidth,
        logoUrl: sale.outletLogoUrl || activeOutlet?.logoUrl || printSettings.defaultOutletLogoUrl || defaultOutletLogoUrl,
        showLogo: receiptLayoutHasBlock(printSettings, "logo") || receiptHeader.includes("logo"),
      });
      notifyCashierSuccess("Dialog print dibuka", "Pilih printer dari browser.");
    } catch {
      notifyCashierError("Cetak ulang gagal", "Browser belum bisa membuka dialog print.");
    }
  }

  function renderPaymentBody() {
    return (
      <div className="grid gap-4">
        <div className="rounded-lg border bg-muted/10 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Total bayar</p>
              <p className="text-2xl font-bold text-[#1D3557]">{money(grandTotal)}</p>
            </div>
            <div className="text-right text-sm">
              {donationTotal > 0 ? <p>Donasi {money(donationTotal)}</p> : null}
              {roundingTotal > 0 ? <p>Pembulatan {money(roundingTotal)}</p> : null}
              {cashTenderedTotal > paidTotal ? <p>Tunai diterima {money(cashTenderedTotal)}</p> : null}
              {showPaidTotal ? <p>Dibayar {money(paidTotal)}</p> : null}
              {hasReceivablePayment ? <p>Piutang {money(receivableTotal)}</p> : null}
              {showChangeTotal ? <p>Kembali {money(changeTotal)}</p> : null}
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-background p-3">
          <div className="space-y-1.5">
            <Label>Donasi</Label>
            <Input
              className="h-10"
              value={donation}
              inputMode="decimal"
              onChange={(event) => setDonation(formatNumberInput(event.target.value))}
              placeholder="0"
              aria-label="Donasi"
            />
          </div>
        </div>

        <div className="rounded-lg border bg-background p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Pembayaran</p>
              <p className="text-xs text-muted-foreground">
                {paymentLines.length} metode, edit slot aktif.
              </p>
            </div>
            <div className="flex gap-1">
              <Button type="button" variant="outline" size="sm" className="h-9 w-9 p-0" onClick={addPaymentLine} aria-label="Tambah pembayaran">
                <Plus className="h-4 w-4" />
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-9 w-9 p-0" onClick={() => removePaymentLine(activePaymentLine.id)} aria-label="Hapus pembayaran aktif">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid gap-3">
            {paymentLines.length > 1 ? (
              <div className="space-y-1.5">
                <Label>Slot pembayaran</Label>
                <SearchableSelect
                  value={activePaymentLine.id}
                  onChange={setActivePaymentLineId}
                  ariaLabel="Pilih pembayaran yang diedit"
                  options={paymentLines.map((line, index) => ({
                    value: line.id,
                    label: `Pembayaran ${index + 1} - ${paymentMethodLabel(line.method)}`,
                    description:
                      line.method === "receivable"
                        ? `Sisa ${money(receivableTotal)}`
                        : line.amount
                          ? money(line.amount)
                          : undefined,
                    keywords: `${index + 1} ${paymentMethodLabel(line.method)} ${line.amount}`,
                  }))}
                  placeholder="Pilih slot pembayaran"
                  searchPlaceholder="Cari pembayaran..."
                  emptyText="Slot pembayaran tidak ditemukan."
                />
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Metode</Label>
                <select
                  className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={activePaymentLine.method}
                  onChange={(event) => updatePaymentLine(activePaymentLine.id, { method: event.target.value, amount: event.target.value === "receivable" ? "" : activePaymentLine.amount })}
                  aria-label="Metode pembayaran aktif"
                >
                  {paymentMethods.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Nominal</Label>
                {activePaymentLine.method === "receivable" ? (
                  <div className="flex h-10 items-center rounded-md border bg-background px-3 text-sm text-muted-foreground">
                    Sisa {money(receivableTotal)}
                  </div>
                ) : (
                  <Input
                    className="h-10"
                    value={activePaymentLine.amount}
                    inputMode="decimal"
                    placeholder={paymentLines.length === 1 ? money(grandTotal) : `Nominal ${activePaymentIndex + 1}`}
                    onChange={(event) => updatePaymentLine(activePaymentLine.id, { amount: formatNumberInput(event.target.value) })}
                    aria-label="Nominal pembayaran aktif"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        <Button
          type="button"
          className="h-12 w-full justify-between px-4 text-base"
          onClick={() => void checkout()}
          disabled={isBusy || !shift || !cart.length}
        >
          <span className="inline-flex items-center gap-2">
            <ReceiptText className="h-4 w-4" />
            Simpan transaksi
          </span>
          <span className="font-bold">{money(grandTotal)}</span>
        </Button>
      </div>
    );
  }

  function renderCartBody() {
    return (
      <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_410px]">
        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
          <section className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-sm">
            <div className="flex flex-wrap gap-2">
              {sessions.map((session) => (
                <button
                  type="button"
                  key={session.id}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all hover:-translate-y-0.5 hover:shadow-sm ${
                    session.id === activeSessionId
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-background hover:bg-muted/40"
                  }`}
                  onClick={() => setActiveSessionId(session.id)}
                >
                  {session.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={newSession}>
                <Plus className="h-4 w-4" />
                Pelanggan
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={closeSession}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </section>

          <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 [scrollbar-width:thin]">
            {cart.map((line) => {
              const lineDiscount = lineDiscountTotal(line);
              const imageUrl = line.item.skuImageUrl || line.item.productImageUrl;
              const showLineDiscount =
                activeLineDiscountSkuId === line.item.skuId || lineDiscount > 0;

              return (
                <div key={line.item.skuId} className="rounded-xl border bg-background p-3 shadow-sm transition-colors hover:border-primary/30 hover:bg-primary/5">
                  <div className="grid gap-3 lg:grid-cols-[minmax(15rem,1fr)_8rem_10rem_auto] lg:items-center">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border bg-muted/40">
                        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                          <LayoutGrid className="h-4 w-4" />
                        </div>
                        {imageUrl ? (
                          <Image
                            src={imageUrl}
                            alt={line.item.skuName}
                            width={48}
                            height={48}
                            unoptimized
                            className="relative h-full w-full object-cover"
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.style.opacity = "0";
                            }}
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="break-words font-medium leading-snug">
                          {line.item.skuName}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {money(line.unitPrice)} / {line.unitLabel}
                        </p>
                        {lineDiscount > 0 ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Diskon item {money(lineDiscount)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    {line.item.trackInventory === false ? null : (
                      <div className="flex items-center">
                        <SearchableSelect
                          value={line.unitId}
                          onChange={(value) => changeUnit(line, value)}
                          ariaLabel={`Satuan ${line.item.skuName}`}
                          options={unitChoices(line.item).map((unit) => ({
                            value: unit.id,
                            label: unit.label,
                          }))}
                          placeholder="Satuan"
                          searchPlaceholder="Cari satuan..."
                          emptyText="Satuan tidak ditemukan."
                          triggerClassName="h-9 px-2 py-1"
                        />
                      </div>
                    )}
                    <div className="flex items-center">
                      <div className="grid grid-cols-[2.25rem_1fr_2.25rem] items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 w-9 p-0"
                          onClick={() => changeQuantity(line, line.quantity - 1)}
                          aria-label="Kurangi qty"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          className="h-9 text-center"
                          inputMode="decimal"
                          value={formatPlain(line.quantity)}
                          onChange={(event) =>
                            changeQuantity(line, parseNumber(event.target.value))
                          }
                          aria-label={`Qty ${line.item.skuName}`}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 w-9 p-0"
                          onClick={() => changeQuantity(line, line.quantity + 1)}
                          aria-label="Tambah qty"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 lg:justify-end">
                      <div className="text-right">
                        <p className="whitespace-nowrap font-semibold">
                          {money(lineNetTotal(line))}
                        </p>
                      </div>
                      <button
                        type="button"
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-muted ${
                          showLineDiscount ? "border-primary bg-primary/10 text-primary" : "text-amber-700 hover:bg-amber-50"
                        }`}
                        onClick={() =>
                          setActiveLineDiscountSkuId(
                            showLineDiscount && lineDiscount <= 0 ? null : line.item.skuId,
                          )
                        }
                        aria-label={`Atur diskon item ${line.item.skuName}`}
                        title="Diskon item"
                      >
                        <BadgePercent className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => changeQuantity(line, 0)}
                        aria-label="Hapus item"
                        title="Hapus item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {showLineDiscount ? (
                    <div className="mt-3 grid gap-1.5 border-t pt-3 sm:max-w-xs">
                      <Label>Diskon item</Label>
                      <Input
                        className="h-9"
                        inputMode="decimal"
                        value={line.discount}
                        placeholder="0"
                        onChange={(event) =>
                          changeLineDiscount(line, event.target.value)
                        }
                        aria-label={`Diskon item ${line.item.skuName}`}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
            {!cart.length ? (
              <div className="flex min-h-72 items-center justify-center rounded-xl border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                Keranjang masih kosong.
              </div>
            ) : null}
          </div>
          </section>
        </div>

          <aside className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-3 overflow-hidden rounded-xl border bg-card p-3 shadow-sm">
          <div className="grid shrink-0 gap-2">
            <div className="space-y-1.5">
              <Label>Pelanggan</Label>
              <SearchableSelect
                value={customerId}
                onChange={setCustomerId}
                options={[
                  { value: "", label: hasReceivablePayment ? "Pilih pelanggan" : "Umum / tanpa pelanggan" },
                  ...customers.map((item) => ({
                    value: item.id,
                    label: `${item.name} (${item.code})`,
                    description: item.phone ?? undefined,
                    keywords: `${item.name} ${item.code} ${item.phone ?? ""}`,
                  })),
                ]}
                placeholder={hasReceivablePayment ? "Pilih pelanggan" : "Umum / tanpa pelanggan"}
                searchPlaceholder="Cari pelanggan..."
                emptyText="Pelanggan tidak ditemukan."
                allowClear
                triggerClassName="h-9 px-2 py-1"
              />
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.25rem] gap-2">
              <div className="space-y-1.5">
                <Label>Diskon</Label>
                <Input className="h-9" value={discount} inputMode="decimal" onChange={(event) => {
                  setDiscount(formatNumberInput(event.target.value));
                }} />
              </div>
              <div className="space-y-1.5">
                <Label>Kode promo</Label>
                <Input className="h-9 uppercase" value={promotionCode} onChange={(event) => {
                  setPromotionCode(event.target.value.toUpperCase());
                }} placeholder="Voucher" />
              </div>
              <div className="flex items-end">
                <Button type="button" variant="outline" size="sm" className="h-9 w-9 p-0" onClick={() => void quoteCurrentSale()} disabled={isQuoting || !cart.length} aria-label="Hitung kode promo">
                  <BadgePercent className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <div className="min-h-0 overflow-hidden">
            <div className="grid gap-2">
              <div className="rounded-xl border bg-background p-3 shadow-sm">
                <div className="mb-1.5">
                  <p className="text-sm font-semibold">Ringkasan</p>
                </div>
                <div className="grid gap-1 text-sm">
                  <TotalRow label="Subtotal" value={money(subtotal)} />
                  {showManualDiscount ? <TotalRow label="Diskon manual" value={`- ${money(manualDiscountTotal)}`} /> : null}
                  {showPromotionDiscount ? <TotalRow label="Promo" value={`- ${money(promotionDiscountTotal)}`} /> : null}
                  {showTotalDiscount ? <TotalRow label="Total potongan" value={`- ${money(discountTotal)}`} /> : null}
                  {showTaxCharge ? <TotalRow label="Pajak" value={`+ ${money(taxTotal)}`} /> : null}
                  {showServiceCharge ? <TotalRow label="Service" value={`+ ${money(serviceChargeTotal)}`} /> : null}
                  {donationTotal > 0 ? <TotalRow label="Donasi" value={`+ ${money(donationTotal)}`} /> : null}
                  {roundingTotal > 0 ? <TotalRow label="Pembulatan" value={`+ ${money(roundingTotal)}`} /> : null}
                  <div className="my-1 border-t" />
                  <TotalRow label="Total bayar" value={money(grandTotal)} strong />
                  {showIncludedTax ? (
                    <p className="text-xs text-muted-foreground">
                      Termasuk pajak {money(taxTotal)}
                    </p>
                  ) : null}
                  {saleQuote?.appliedPromotions.length ? (
                    <div className="rounded-md border bg-emerald-50 px-2 py-1.5 text-xs text-emerald-800">
                      <span className="font-medium text-foreground">Promo: </span>
                      {saleQuote.appliedPromotions.map((promo) => promo.name).join(", ")}
                    </div>
              ) : null}
            </div>
          </div>
            </div>
          </div>
          <div className="shrink-0">
            <Button
              type="button"
              className="h-12 w-full justify-between px-4 text-base"
              onClick={() => void openPaymentModal()}
              disabled={isBusy || !shift || !cart.length}
            >
              <span className="inline-flex items-center gap-2">
                <ReceiptText className="h-4 w-4" />
                Bayar
              </span>
              <span className="font-bold">{money(grandTotal)}</span>
            </Button>
          </div>
          </aside>
      </div>
    );
  }

  if (!access.canView && !access.isLoading) {
    return (
      <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        Akun ini belum memiliki akses ke menu Kasir.
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <CollapsibleSection
        title="Produk Kasir"
        description={`${visibleCatalog.length} dari ${catalog.length} SKU tersedia${activeOutlet ? ` di ${activeOutlet.name}` : ""}.`}
        collapsible={false}
        isLoading={isLoading || access.isLoading}
        loadingText="Memuat katalog produk kasir..."
        actions={
          <div className="flex max-w-full flex-wrap justify-end gap-2">
            <div
              className="flex h-10 max-w-[14rem] items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-800 shadow-sm"
              title={`Outlet aktif dari sidebar: ${activeOutlet?.name ?? "-"}`}
            >
              <Building2 className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">{activeOutlet?.name ?? "Pilih outlet"}</span>
            </div>
            <button
              type="button"
              className={`flex h-10 max-w-[12rem] items-center gap-2 rounded-full border px-3 text-sm font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${shift ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100" : "border-red-200 bg-red-50 text-red-800 hover:bg-red-100"}`}
              onClick={() => setActiveModal("shift")}
              title={`Shift ${shift ? "Open" : "Closed"} - kas ${money(shift?.expectedCash ?? 0)}`}
              aria-label="Buka setting shift kasir"
            >
              <span
                className={`h-3 w-3 shrink-0 rounded-full ${
                  shift ? "bg-emerald-500" : "bg-red-500"
                }`}
                aria-hidden="true"
              />
              <span className="truncate">{shift ? "Kasir Open" : "Kasir Close"}</span>
            </button>
          </div>
        }
      >
          <div data-tour="list-controls" className="rounded-xl border bg-background p-2 shadow-sm">
            <div className="grid gap-2 lg:grid-cols-[minmax(18rem,1fr)_11rem_11rem] lg:items-center">
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-9 rounded-lg border-muted-foreground/20 bg-muted/20 pl-9 text-sm shadow-none focus-visible:bg-background"
                  value={search}
                  placeholder="Cari produk, SKU, barcode..."
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <SearchableSelect
                className="h-9 rounded-lg bg-muted/20"
                value={category}
                onChange={setCategory}
                options={categories.map((item) => ({ value: item, label: item }))}
                placeholder="Kategori"
                searchPlaceholder="Cari kategori..."
                emptyText="Kategori tidak ditemukan."
              />
              <div className="relative min-w-0">
                <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <select
                  className="flex h-9 w-full rounded-lg border border-muted-foreground/20 bg-muted/20 py-1 pl-9 pr-3 text-sm font-medium outline-none focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring"
                  value="name"
                  onChange={() => undefined}
                >
                  <option value="name">Nama produk</option>
                </select>
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
            {visibleCatalog.map((item) => {
              const available = availableBaseQty(item);
              const imageUrl = item.skuImageUrl || item.productImageUrl;
              const stockTone = item.trackInventory === false ? "text-sky-700 bg-sky-50 border-sky-200" : available <= 0 ? "text-red-700 bg-red-50 border-red-200" : available <= 5 ? "text-amber-700 bg-amber-50 border-amber-200" : "text-emerald-700 bg-emerald-50 border-emerald-200";
              return (
                <button
                  type="button"
                  key={item.skuId}
                  className="group relative flex min-h-32 flex-col justify-between overflow-hidden rounded-lg border bg-background p-2.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                  onClick={(event) => addToCart(item, event)}
                  disabled={!shift || (item.trackInventory !== false && available <= 0)}
                >
                  <span className={`absolute inset-x-0 top-0 h-1 ${item.trackInventory === false ? "bg-sky-500" : available <= 0 ? "bg-red-500" : available <= 5 ? "bg-amber-500" : "bg-emerald-500"}`} />
                  <div className="flex items-start gap-2 pt-1">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border bg-muted/40">
                      <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                        <LayoutGrid className="h-5 w-5" />
                      </div>
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={item.skuName}
                          width={56}
                          height={56}
                          unoptimized
                          className="relative h-full w-full object-cover transition-transform group-hover:scale-105"
                          loading="lazy"
                          onError={(event) => {
                            event.currentTarget.style.opacity = "0";
                          }}
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-semibold leading-tight">{item.skuName}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {item.productName}
                      </p>
                    </div>
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#E63946] text-white shadow-sm transition-transform group-hover:scale-105">
                      <Plus className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">{item.skuCode}</span>
                      <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${stockTone}`}>
                        {item.trackInventory === false ? "Non-stok" : available <= 0 ? "Habis" : `${qty(available)} ${item.baseUnitCode || "unit"}`}
                      </span>
                    </div>
                    <p className="truncate text-sm font-bold text-[#1D3557]">{money(item.price)}</p>
                  </div>
                </button>
              );
            })}
            {!visibleCatalog.length ? (
              <p className="text-sm text-muted-foreground">Produk kasir tidak ditemukan.</p>
            ) : null}
          </div>
      </CollapsibleSection>

      <CashierModal
        title="Shift Outlet"
        open={activeModal === "shift"}
        onClose={() => setActiveModal(null)}
        maxWidthClassName="max-w-5xl"
      >
        <div className="space-y-4">
          <section className="grid gap-3 md:grid-cols-4">
            <div className={`rounded-xl border p-3 ${shift ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"}`}>
              <p className="text-xs font-medium opacity-75">Status</p>
              <p className="mt-1 text-lg font-bold">{shift ? "Open" : "Closed"}</p>
            </div>
            <div className="rounded-xl border bg-background p-3">
              <p className="text-xs text-muted-foreground">Kas Ekspektasi</p>
              <p className="mt-1 text-lg font-bold text-[#1D3557]">{money(shift?.expectedCash ?? 0)}</p>
            </div>
            <div className="rounded-xl border bg-background p-3">
              <p className="text-xs text-muted-foreground">Kas Masuk</p>
              <p className="mt-1 text-lg font-bold text-emerald-700">{money(shiftSummary?.shift.cashInTotal ?? shift?.cashInTotal ?? 0)}</p>
            </div>
            <div className="rounded-xl border bg-background p-3">
              <p className="text-xs text-muted-foreground">Kas Keluar</p>
              <p className="mt-1 text-lg font-bold text-amber-700">{money(shiftSummary?.shift.cashOutTotal ?? shift?.cashOutTotal ?? 0)}</p>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="space-y-4">
              <div className="rounded-xl border bg-background p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">Buka Shift</p>
                    <p className="text-xs text-muted-foreground">Isi kas awal sebelum transaksi.</p>
                  </div>
                  <Clock className="h-5 w-5 text-blue-700" />
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <Field label="Kas Awal" value={openingCash} onChange={(value) => setOpeningCash(formatNumberInput(value))} />
                  <Button type="button" onClick={() => void openShift()} disabled={isBusy || Boolean(shift)}>
                    <Clock className="h-4 w-4" />
                    Buka Shift
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border bg-background p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">Tutup Shift</p>
                    <p className="text-xs text-muted-foreground">Cocokkan kas fisik dengan kas sistem.</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${hasShiftCashVariance ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                    {hasShiftCashVariance ? "Ada selisih" : "Seimbang"}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
                  <Field label="Kas Aktual" value={actualCash} onChange={(value) => setActualCash(formatNumberInput(value))} />
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Selisih</p>
                    <p className={`mt-1 text-sm font-bold ${hasShiftCashVariance ? "text-amber-700" : "text-emerald-700"}`}>
                      {money(shiftCashVariance)}
                    </p>
                  </div>
                  <Button type="button" variant="secondary" onClick={() => void closeShift()} disabled={isBusy || !shift}>
                    <Clock className="h-4 w-4" />
                    Tutup
                  </Button>
                </div>
                {hasShiftCashVariance ? (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <p className="font-medium">
                      {canApproveShiftVariance
                        ? "Selisih akan ditutup dengan approval supervisor/admin."
                        : "Shift tetap bisa ditutup. Selisih akan menunggu approval owner/admin outlet."}
                    </p>
                    <div className="mt-2 space-y-1.5">
                      <Label>Alasan selisih</Label>
                      <Input value={varianceReason} onChange={(event) => setVarianceReason(event.target.value)} placeholder="Contoh: uang setor sudah diambil supervisor" />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border bg-background p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">Kas Masuk / Keluar</p>
                  <p className="text-xs text-muted-foreground">Untuk tambah uang laci, ambil uang setor, atau kebutuhan operasional.</p>
                </div>
                <Banknote className="h-5 w-5 text-emerald-700" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <SelectField
                  label="Jenis"
                  value={cashMovementForm.type}
                  onChange={(value) => setCashMovementForm((current) => ({ ...current, type: value as "cash_in" | "cash_out" }))}
                  options={[
                    { value: "cash_in", label: "Kas masuk" },
                    { value: "cash_out", label: "Kas keluar" },
                  ]}
                />
                <Field
                  label="Nominal"
                  value={cashMovementForm.amount}
                  onChange={(value) => setCashMovementForm((current) => ({ ...current, amount: formatNumberInput(value) }))}
                />
                <div className="space-y-2">
                  <Label>Alasan</Label>
                  <Input
                    value={cashMovementForm.reason}
                    onChange={(event) => setCashMovementForm((current) => ({ ...current, reason: event.target.value }))}
                    placeholder="Contoh: tambah modal kas"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Catatan</Label>
                  <Input
                    value={cashMovementForm.note}
                    onChange={(event) => setCashMovementForm((current) => ({ ...current, note: event.target.value }))}
                    placeholder="Opsional"
                  />
                </div>
              </div>
              <Button type="button" className="mt-3 w-full" onClick={() => void saveCashMovement()} disabled={isBusy || !shift}>
                <Banknote className="h-4 w-4" />
                Simpan Mutasi Kas
              </Button>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border bg-background p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-semibold">Pembayaran Shift</p>
                  <span className="text-sm font-semibold">{money(shiftPaymentTotal)}</span>
                </div>
                <div className="space-y-2">
                  {(shiftSummary?.paymentSummary ?? []).map((item) => (
                    <div key={item.method} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                      <span>{paymentMethodLabel(item.method)}</span>
                      <span className="text-right">
                        <span className="block font-semibold">{money(item.amount)}</span>
                        <span className="text-xs text-muted-foreground">{item.count} transaksi</span>
                      </span>
                    </div>
                  ))}
                  {!(shiftSummary?.paymentSummary ?? []).length ? (
                    <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">Belum ada pembayaran pada shift ini.</p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-xl border bg-background p-4">
                <p className="mb-3 font-semibold">Riwayat Mutasi Kas</p>
                <div className="max-h-64 space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
                  {(shiftSummary?.cashMovements ?? []).map((item) => (
                    <div key={item.id} className="rounded-md border px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{item.type === "cash_in" ? "Kas masuk" : "Kas keluar"}</span>
                        <span className={item.type === "cash_in" ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>
                          {item.type === "cash_in" ? "+" : "-"} {money(item.amount)}
                        </span>
                      </div>
                      <p className="mt-1 text-muted-foreground">{item.reason}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(item.createdAt)} oleh {item.actorName ?? "User"}
                      </p>
                    </div>
                  ))}
                  {!(shiftSummary?.cashMovements ?? []).length ? (
                    <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">Belum ada kas masuk atau kas keluar.</p>
                  ) : null}
                </div>
              </div>
          </section>
        </div>
      </CashierModal>

      <CashierModal
        title="Input Remahan"
        open={activeModal === "waste"}
        onClose={() => setActiveModal(null)}
      >
        <form className="grid gap-4 md:grid-cols-2" onSubmit={submitWaste}>
          <SelectField
            label="SKU"
            value={wasteForm.skuId}
            onChange={(value) => setWasteForm({ ...wasteForm, skuId: value })}
            className="md:col-span-2"
            options={catalog.map((item) => ({
              value: item.skuId,
              label: `${item.skuCode} - ${item.skuName}`,
            }))}
          />
          <Field
            label={`Qty (${selectedWasteItem?.baseUnitCode ?? "unit"})`}
            value={wasteForm.quantity}
            onChange={changeWasteQuantity}
            helperText={`Maksimal ${qty(selectedWasteAvailableQty)} ${selectedWasteItem?.baseUnitCode ?? "unit"}`}
          />
          <SelectField
            label="Alasan"
            value={wasteForm.reason}
            onChange={(value) => setWasteForm({ ...wasteForm, reason: value })}
            options={wasteReasons.map(([value, label]) => ({ value, label }))}
          />
          <Field
            label="Catatan"
            value={wasteForm.note}
            onChange={(value) => setWasteForm({ ...wasteForm, note: value })}
            className="md:col-span-2"
          />
          <div className="flex justify-end md:col-span-2">
            <Button type="submit" disabled={isBusy || !catalog.length || selectedWasteAvailableQty <= 0}>
            <Scale className="h-4 w-4" />
            Simpan Remahan
            </Button>
          </div>
        </form>
      </CashierModal>

      <CashierModal
        title="Laporan Hari Ini"
        open={activeModal === "reports"}
        onClose={() => setActiveModal(null)}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <Metric icon={ReceiptText} label="Transaksi" value={`${salesSummary?.transactionCount ?? 0}`} />
          <Metric icon={CreditCard} label="Net Sales" value={money(salesSummary?.netSales ?? 0)} />
          <Metric icon={Banknote} label="Gross Profit" value={money(salesSummary?.grossProfit ?? 0)} />
        </div>
        <div className="mt-4 grid gap-3">
          {salesDetails.slice(0, 10).map((sale) => (
            <div key={sale.id} className="grid gap-2 rounded-lg border p-3 text-sm md:grid-cols-[1fr_1fr_auto_auto] md:items-center">
              <div>
                <p className="font-medium">{sale.receiptNumber}</p>
                <p className="text-muted-foreground">{formatDate(sale.createdAt)}</p>
              </div>
              <div>
                <p>{sale.cashierName || "Kasir"}</p>
                <p className="text-muted-foreground">{sale.paymentMethods || "-"}</p>
              </div>
              <p className="font-semibold">{money(sale.grandTotal)}</p>
              <Button type="button" variant="outline" onClick={() => void reprintSalesDetail(sale)}>
                <Printer className="h-4 w-4" />
                Cetak ulang
              </Button>
            </div>
          ))}
          {!salesDetails.length ? (
            <p className="text-sm text-muted-foreground">Belum ada transaksi pada outlet ini.</p>
          ) : null}
        </div>
      </CashierModal>

      <CashierModal
        title="Menu Pendukung"
        open={activeModal === "tools"}
        onClose={() => setActiveModal(null)}
      >
        <div className="mb-4 rounded-xl border bg-muted/20 p-4">
          <p className="text-sm font-semibold text-foreground">Aksi Operasional Kasir</p>
          <p className="mt-1 text-xs text-muted-foreground">Buka shift, input remahan, dan laporan harian dari satu panel.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <ToolButton
            icon={Clock}
            title="Shift Outlet"
            subtitle={shift ? "Shift sedang open" : "Buka shift sebelum transaksi"}
            onClick={() => setActiveModal("shift")}
          />
          <ToolButton
            icon={Scale}
            title="Input Remahan"
            subtitle="Catat stok tidak layak jual"
            onClick={() => setActiveModal("waste")}
          />
          <ToolButton
            icon={ReceiptText}
            title="Laporan Hari Ini"
            subtitle={money(salesSummary?.netSales ?? 0)}
            onClick={() => setActiveModal("reports")}
          />
        </div>
        {canApproveShiftVariance && pendingVarianceShifts.length ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-amber-900">Approval Selisih Kas</p>
                <p className="mt-1 text-xs text-amber-800">Shift kasir dengan selisih menunggu approval owner/admin outlet.</p>
              </div>
              <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">{pendingVarianceShifts.length}</span>
            </div>
            <div className="space-y-2">
              {pendingVarianceShifts.map((item) => (
                <div key={item.id} className="rounded-lg border bg-background p-3 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{item.cashierName || "Kasir"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.closedAt ? formatDate(item.closedAt) : "-"}</p>
                      <p className="mt-2 text-xs text-muted-foreground">Alasan: {item.varianceReason || "-"}</p>
                    </div>
                    <div className="grid shrink-0 grid-cols-3 gap-2 text-right text-xs">
                      <div><p className="text-muted-foreground">Sistem</p><p className="font-semibold">{money(item.expectedCash)}</p></div>
                      <div><p className="text-muted-foreground">Aktual</p><p className="font-semibold">{money(item.actualCash ?? 0)}</p></div>
                      <div><p className="text-muted-foreground">Selisih</p><p className="font-semibold text-amber-700">{money(item.cashVariance ?? 0)}</p></div>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button type="button" size="sm" disabled={isBusy} onClick={() => void approveShiftVariance(item)}>Approve Selisih</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CashierModal>

      <CashierModal
        title="Keranjang"
        open={activeModal === "cart"}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setActiveModal(null);
        }}
        maxWidthClassName="h-[calc(100vh-2rem)] max-w-[96vw] xl:max-w-7xl sm:h-[calc(100vh-3rem)]"
        bodyClassName="overflow-y-auto lg:overflow-hidden"
      >
        {renderCartBody()}
      </CashierModal>

      <CashierModal
        title="Pembayaran"
        open={activeModal === "cart" && isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        maxWidthClassName="max-w-xl"
      >
        {renderPaymentBody()}
      </CashierModal>

      <div className="fixed bottom-4 left-4 right-4 z-40 flex items-end justify-end gap-2 sm:bottom-6 sm:right-6">
        <button
          type="button"
          className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#1D3557] text-white shadow-xl ring-1 ring-black/10 transition-all hover:-translate-y-0.5 hover:scale-105 hover:bg-[#25466f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setActiveModal("tools")}
          aria-label="Buka menu pendukung"
        >
          <LayoutGrid className="h-5 w-5" />
        </button>

      <div className="flex w-[min(23rem,calc(100vw-9rem))] min-w-0 flex-col items-stretch gap-2">
        <button
          ref={cartFabRef}
          type="button"
          className="flex h-14 items-center justify-between gap-3 rounded-full bg-[#E63946] px-4 text-white shadow-xl ring-1 ring-black/10 transition-all hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-[#d92f3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setActiveModal("cart")}
          aria-label="Buka keranjang"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
              <ShoppingCart className="h-5 w-5" />
            </span>
            <span className="min-w-0 text-left">
              <span className="block truncate text-sm font-semibold">
                {cart.length} item
              </span>
              <span className="block truncate text-xs text-white/85">
                {activeSession?.label ?? "Keranjang"}
              </span>
            </span>
          </span>
          <span className="shrink-0 text-sm font-bold">{money(grandTotal)}</span>
        </button>
      </div>
      </div>

      {flyingProduct ? (
        <div
          className="pointer-events-none fixed z-[60] max-w-44 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-2xl transition-all duration-500 ease-out"
          style={{
            left: 0,
            top: 0,
            opacity: flyingProduct.active ? 0 : 1,
            transform: flyingProduct.active
              ? `translate(${flyingProduct.targetX}px, ${flyingProduct.targetY}px) scale(0.35)`
              : `translate(${flyingProduct.x}px, ${flyingProduct.y}px) scale(1)`,
          }}
        >
          <span className="block max-w-40 truncate">{flyingProduct.name}</span>
        </div>
      ) : null}
    </div>
  );
}

function CashierModal(props: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidthClassName?: string;
  bodyClassName?: string;
}) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsMounted(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!props.open || !isMounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex min-h-[100dvh] w-[100dvw] items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-6">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={props.onClose}
        aria-label="Tutup modal"
      />
      <div
        className={[
          "relative flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-xl border bg-card shadow-2xl sm:max-h-[calc(100vh-3rem)]",
          props.maxWidthClassName ?? "max-w-4xl",
        ].join(" ")}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-card/95 px-4 py-3 backdrop-blur sm:px-6">
          <h2 className="text-lg font-semibold">{props.title}</h2>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background text-muted-foreground hover:bg-muted"
            onClick={props.onClose}
            aria-label="Tutup modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div
          className={[
            "min-h-0 flex-1 px-4 py-4 [scrollbar-width:thin] sm:px-6 sm:py-5",
            props.bodyClassName ?? "overflow-y-auto",
          ].join(" ")}
        >
          {props.children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ToolButton(props: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  const tone = toolTone(props.title);
  return (
    <button
      type="button"
      className={`group flex items-center gap-3 rounded-xl border bg-background p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${tone.border} ${tone.hover}`}
      onClick={props.onClick}
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors ${tone.icon}`}>
        <props.icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold">{props.title}</span>
        <span className="block truncate text-sm text-muted-foreground">
          {props.subtitle}
        </span>
      </span>
    </button>
  );
}

function toolTone(title: string) {
  if (title.includes("Shift")) return { border: "hover:border-blue-300", hover: "hover:bg-blue-50/60", icon: "bg-blue-100 text-blue-700 group-hover:bg-blue-600 group-hover:text-white" };
  if (title.includes("Sync")) return { border: "hover:border-violet-300", hover: "hover:bg-violet-50/60", icon: "bg-violet-100 text-violet-700 group-hover:bg-violet-600 group-hover:text-white" };
  if (title.includes("Remahan")) return { border: "hover:border-amber-300", hover: "hover:bg-amber-50/60", icon: "bg-amber-100 text-amber-700 group-hover:bg-amber-600 group-hover:text-white" };
  return { border: "hover:border-emerald-300", hover: "hover:bg-emerald-50/60", icon: "bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white" };
}

function Field(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  helperText?: string;
}) {
  return (
    <div className={["space-y-2", props.className].filter(Boolean).join(" ")}>
      <Label>{props.label}</Label>
      <Input value={props.value} inputMode="decimal" onChange={(event) => props.onChange(event.target.value)} />
      {props.helperText ? (
        <p className="text-xs text-muted-foreground">{props.helperText}</p>
      ) : null}
    </div>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
}) {
  return (
    <div className={["space-y-2", props.className].filter(Boolean).join(" ")}>
      <Label>{props.label}</Label>
      <SearchableSelect
        value={props.value}
        onChange={props.onChange}
        options={props.options}
        placeholder={`Pilih ${props.label.toLowerCase()}`}
        searchPlaceholder={`Cari ${props.label.toLowerCase()}...`}
        emptyText={`${props.label} tidak ditemukan.`}
      />
    </div>
  );
}

function Metric(props: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <span className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <props.icon className="h-5 w-5" />
      </span>
      <p className="text-sm text-muted-foreground">{props.label}</p>
      <p className="mt-1 text-xl font-semibold">{props.value}</p>
    </div>
  );
}

function CashierStat(props: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "blue" | "rose" | "emerald" | "amber";
}) {
  const tone = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
  }[props.tone];
  return (
    <div className="rounded-xl border bg-background p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{props.label}</p>
          <p className="mt-1 truncate text-base font-semibold text-foreground">{props.value}</p>
        </div>
        <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${tone}`}>
          <props.icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

function TotalRow(props: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${props.strong ? "text-lg font-semibold" : "text-sm"}`}>
      <span className="text-muted-foreground">{props.label}</span>
      <span className={props.strong ? "font-bold text-[#1D3557]" : "font-medium"}>{props.value}</span>
    </div>
  );
}

function unitChoices(item: CatalogItem): UnitChoice[] {
  const factor = parseDecimalNumber(item.saleUnitToBaseFactor) || 1;
  return [
    {
      id: item.saleUnitId,
      label: item.saleUnitCode || item.baseUnitCode || "unit",
      toBaseFactor: factor,
      price: parseDecimalNumber(item.price),
    },
  ];
}

function availableBaseQty(item: CatalogItem) {
  if (item.trackInventory === false) return Number.POSITIVE_INFINITY;
  return Math.max(
    0,
    parseDecimalNumber(item.onHandBaseQty ?? 0) -
      parseDecimalNumber(item.reservedBaseQty ?? 0) -
      parseDecimalNumber(item.holdBaseQty ?? 0),
  );
}

function stockLimitMessage(line: CartLine, quantity: number) {
  if (line.item.trackInventory === false) return null;
  if (quantity <= 0) return null;
  const available = availableBaseQty(line.item);
  if (quantity * line.unitToBaseFactor <= available + 0.000001) return null;
  if (available <= 0) return `Stok ${line.item.skuName} kosong.`;
  return `Qty ${line.item.skuName} melebihi stok tersedia (${qty(available / line.unitToBaseFactor)} ${line.unitLabel}).`;
}

function lineGrossTotal(line: CartLine) {
  return line.quantity * line.unitPrice;
}

function lineDiscountTotal(line: CartLine) {
  return Math.min(parseNumber(line.discount), lineGrossTotal(line));
}

function lineNetTotal(line: CartLine) {
  return Math.max(0, lineGrossTotal(line) - lineDiscountTotal(line));
}

function parseNumber(value: string | number | null | undefined) {
  if (typeof value === "number") return value;
  const raw = String(value ?? "0").trim();
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw) || raw.includes(",")) {
    return Number(raw.replace(/\./g, "").replace(",", ".")) || 0;
  }
  return Number(raw) || 0;
}

function parseDecimalNumber(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? "0").trim();
  if (!raw) return 0;
  if (raw.includes(",")) {
    return Number(raw.replace(/\./g, "").replace(",", ".")) || 0;
  }
  return Number(raw) || 0;
}

function formatNumberInput(value: string) {
  const cleaned = value.replace(/[^\d,]/g, "");
  const [wholeRaw, decimalRaw] = cleaned.split(",");
  const whole = wholeRaw.replace(/^0+(?=\d)/, "") || "0";
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return cleaned.includes(",") ? `${grouped},${decimalRaw ?? ""}` : grouped;
}

function createPaymentLineId() {
  return `payment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function nextPaymentMethod(current: PaymentInput[]) {
  const used = new Set(current.map((line) => line.method));
  return paymentMethods.find((item) => item.value !== "receivable" && !used.has(item.value))?.value ?? "cash";
}

function normalizePaymentLines(lines: PaymentInput[], grandTotal: number): SalePaymentInput[] {
  const hasReceivable = lines.some((line) => line.method === "receivable");
  const realLines = lines.filter((line) => line.method !== "receivable");
  return realLines
    .map((line) => {
      const typedAmount = parseNumber(line.amount);
      const amount = realLines.length === 1 && !hasReceivable && typedAmount <= 0 ? grandTotal : typedAmount;
      return {
        method: line.method,
        amount,
      };
    })
    .filter((line) => line.amount > 0);
}

function calculatePaymentBreakdown(lines: PaymentInput[], grandTotal: number) {
  const tenderedPayments = normalizePaymentLines(lines, grandTotal);
  const cashTenderedTotal = tenderedPayments
    .filter((line) => line.method === "cash")
    .reduce((sum, current) => sum + current.amount, 0);
  const nonCashPayments = tenderedPayments.filter((line) => line.method !== "cash");
  const nonCashTotal = nonCashPayments.reduce((sum, current) => sum + current.amount, 0);
  const nonCashOverpaid = Math.max(0, nonCashTotal - grandTotal);
  const cashDue = Math.max(0, grandTotal - nonCashTotal);
  const cashAppliedTotal = Math.min(cashTenderedTotal, cashDue);
  const salePayments = [
    ...nonCashPayments,
    ...(cashAppliedTotal > 0 ? [{ method: "cash", amount: cashAppliedTotal }] : []),
  ];
  const appliedTotal = salePayments.reduce((sum, current) => sum + current.amount, 0);
  const changeTotal = Math.max(0, cashTenderedTotal - cashAppliedTotal);

  return {
    tenderedPayments,
    salePayments,
    appliedTotal,
    cashTenderedTotal,
    cashAppliedTotal,
    changeTotal,
    nonCashOverpaid,
  };
}

function paymentMethodLabel(method: string) {
  return paymentMethods.find((item) => item.value === method)?.label ?? method;
}

function formatPlain(value: string | number) {
  const number = parseNumber(value);
  return number.toLocaleString("id-ID", { maximumFractionDigits: 3 });
}

function money(value: string | number) {
  return `Rp ${parseNumber(value).toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
}

function roundToCashHundred(value: number) {
  const amount = Number.isFinite(value) ? value : 0;
  if (amount <= 0) return 0;
  return Math.ceil(amount / 100) * 100;
}

function qty(value: string | number) {
  return parseDecimalNumber(value).toLocaleString("id-ID", { maximumFractionDigits: 3 });
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

function receiptDateLabel(value: string) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
}

async function readError(response: Response, fallback: string) {
  try {
    const json = (await response.json()) as { error?: { message?: string } };
    return json.error?.message ? `${fallback} ${json.error.message}` : fallback;
  } catch {
    return fallback;
  }
}

function buildReceiptText(input: {
  receiptNumber: string;
  outletName: string;
  outletAddress?: string | null;
  cashierName: string;
  footerNote?: string;
  layout: ReceiptPrintLayout;
  lines: CartLine[];
  subtotal: number;
  discount: number;
  tax: number;
  serviceCharge: number;
  donation: number;
  rounding: number;
  total: number;
  payments: SalePaymentInput[];
  cashTenderedTotal: number;
  changeTotal: number;
  receivableAmount: number;
}) {
  const width = receiptColumnWidth(input.layout.paperWidth);
  const { separator, row, center } = receiptTextFormatter(width);
  const receiptMoney = (value: string | number) => money(value);
  const cashAppliedTotal = input.payments
    .filter((payment) => payment.method === "cash")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const cashDisplayTotal = Math.max(input.cashTenderedTotal, cashAppliedTotal);
  const lines: string[] = [];
  const renderBlock = (block: ReceiptBlock) => {
    if (block === "outlet") lines.push(center(input.outletName));
    if (block === "address" && input.outletAddress?.trim()) lines.push(center(input.outletAddress.trim()));
    if (block === "cashier") lines.push(center(`Kasir: ${input.cashierName}`));
    if (block === "receiptNumber") lines.push(center(`No: ${input.receiptNumber}`), center(receiptDateLabel(new Date().toISOString())));
    if (block === "items") {
      lines.push(separator);
      lines.push(
        ...input.lines.flatMap((line) => [
          ...wrapReceiptLine(line.item.skuName, width),
          ...receiptItemLine(`${qty(line.quantity)} ${receiptUnitLabel(line.unitLabel)} x ${receiptMoney(line.unitPrice)}`, receiptMoney(lineGrossTotal(line)), width, row),
          ...(lineDiscountTotal(line) > 0 ? [row("Diskon item", receiptMoney(lineDiscountTotal(line)))] : []),
        ]),
      );
    }
    if (block === "totals") {
      lines.push(
        separator,
        ...(input.subtotal > 0 ? [row("Subtotal", receiptMoney(input.subtotal))] : []),
        ...(input.discount > 0 ? [row("Diskon", receiptMoney(input.discount))] : []),
        ...(input.tax > 0 ? [row("Pajak", receiptMoney(input.tax))] : []),
        ...(input.serviceCharge > 0 ? [row("Service", receiptMoney(input.serviceCharge))] : []),
        ...(input.donation > 0 ? [row("Donasi", receiptMoney(input.donation))] : []),
        ...(input.rounding > 0 ? [row("Pembulatan", receiptMoney(input.rounding))] : []),
        row("TOTAL", receiptMoney(input.total)),
      );
    }
    if (block === "payment") {
      lines.push(
        ...input.payments
          .filter((payment) => payment.amount > 0 && payment.method !== "cash")
          .map((payment) => row(paymentMethodLabel(payment.method), receiptMoney(payment.amount))),
        ...(cashDisplayTotal > 0
          ? [row(cashDisplayTotal > cashAppliedTotal ? "Tunai diterima" : "Tunai", receiptMoney(cashDisplayTotal))]
          : []),
        ...(input.receivableAmount > 0 ? [row("Piutang", receiptMoney(input.receivableAmount))] : []),
        ...(input.changeTotal > 0 ? [row("Kembali", receiptMoney(input.changeTotal))] : []),
      );
    }
    if (block === "note") lines.push(separator, ...receiptNoteLines(input.footerNote || "Terima kasih", width).map(center));
  };
  const layout = sanitizeReceiptLayout(input.layout);
  layout.header.forEach(renderBlock);
  layout.body.forEach(renderBlock);
  layout.footer.forEach(renderBlock);
  return `${lines.join("\n")}\n`;
}

function buildSalesDetailReprintText(
  sale: SalesDetail,
  fallbackOutletName: string,
  fallbackOutletAddress: string,
  layout: ReceiptPrintLayout,
  footerNote = "Terima kasih",
) {
  const width = receiptColumnWidth(layout.paperWidth);
  const { separator, row, center } = receiptTextFormatter(width);
  const payments = sale.payments ?? [];
  const cashAppliedTotal = payments
    .filter((payment) => payment.method === "cash")
    .reduce((sum, payment) => sum + parseNumber(payment.amount), 0);
  const cashDisplayTotal = Math.max(parseNumber(sale.cashTenderedTotal ?? 0), cashAppliedTotal);
  const change = parseNumber(sale.changeTotal ?? 0);
  const lines: string[] = [];
  const renderBlock = (block: ReceiptBlock) => {
    if (block === "outlet") lines.push(center(sale.outletName || fallbackOutletName));
    if (block === "address" && fallbackOutletAddress.trim()) lines.push(center(fallbackOutletAddress.trim()));
    if (block === "cashier") lines.push(center(`Kasir: ${sale.cashierName || "Kasir"}`));
    if (block === "receiptNumber") lines.push(center(`No: ${sale.receiptNumber}`), center(receiptDateLabel(sale.createdAt)), center("CETAK ULANG"));
    if (block === "items") {
      lines.push(separator);
      lines.push(
        ...sale.items.flatMap((item) => [
          ...wrapReceiptLine(item.name, width),
          ...receiptItemLine(`${qty(item.quantityInput)} ${receiptUnitLabel(item.unitCode)} x ${money(item.unitPrice)}`, money(item.lineTotal), width, row),
          ...(parseNumber(item.discountTotal ?? 0) > 0 ? [row("Diskon item", money(item.discountTotal ?? 0))] : []),
        ]),
      );
    }
    if (block === "totals") {
      lines.push(
        separator,
        ...(parseNumber(sale.subtotal ?? 0) > 0 ? [row("Subtotal", money(sale.subtotal ?? 0))] : []),
        ...(parseNumber(sale.discountTotal ?? 0) > 0 ? [row("Diskon", money(sale.discountTotal ?? 0))] : []),
        ...(parseNumber(sale.taxTotal ?? 0) > 0 ? [row("Pajak", money(sale.taxTotal ?? 0))] : []),
        ...(parseNumber(sale.serviceChargeTotal ?? 0) > 0 ? [row("Service", money(sale.serviceChargeTotal ?? 0))] : []),
        ...(parseNumber(sale.donationTotal ?? 0) > 0 ? [row("Donasi", money(sale.donationTotal ?? 0))] : []),
        ...(parseNumber(sale.roundingTotal ?? 0) > 0 ? [row("Pembulatan", money(sale.roundingTotal ?? 0))] : []),
        row("TOTAL", money(sale.grandTotal)),
      );
    }
    if (block === "payment") {
      lines.push(
        ...payments
          .filter((payment) => parseNumber(payment.amount) > 0 && payment.method !== "cash")
          .map((payment) => row(paymentMethodLabel(payment.method), money(payment.amount))),
        ...(cashDisplayTotal > 0
          ? [row(cashDisplayTotal > cashAppliedTotal ? "Tunai diterima" : "Tunai", money(cashDisplayTotal))]
          : []),
        ...(change > 0 ? [row("Kembali", money(change))] : []),
      );
    }
    if (block === "note") lines.push(separator, ...receiptNoteLines(footerNote, width).map(center));
  };
  const safeLayout = sanitizeReceiptLayout(layout);
  safeLayout.header.forEach(renderBlock);
  safeLayout.body.forEach(renderBlock);
  safeLayout.footer.forEach(renderBlock);
  return `${lines.join("\n")}\n`;
}

function receiptColumnWidth(paperWidth: "58" | "80") {
  return paperWidth === "80" ? 42 : 28;
}

function receiptTextFormatter(width: number) {
  const separator = "-".repeat(width);
  const row = (left: string, right: string) => {
    const rightSafe = normalizeReceiptText(right).slice(0, width);
    const leftSafe = normalizeReceiptText(left).slice(0, Math.max(0, width - rightSafe.length - 1));
    return `${leftSafe.padEnd(Math.max(0, width - rightSafe.length - 1))} ${rightSafe}`;
  };
  const center = (value: string) => {
    const safe = normalizeReceiptText(value).slice(0, width);
    const leftPad = Math.max(0, Math.floor((width - safe.length) / 2));
    return `${" ".repeat(leftPad)}${safe}`;
  };
  return { separator, row, center };
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

function normalizeReceiptText(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "?");
}

function receiptLayoutHasBlock(layout: ReceiptPrintLayout, block: ReceiptBlock) {
  const safeLayout = sanitizeReceiptLayout(layout);
  return safeLayout.header.includes(block) || safeLayout.body.includes(block) || safeLayout.footer.includes(block);
}

function sanitizeReceiptLayout(layout: ReceiptPrintLayout): ReceiptPrintLayout {
  const header = layout.header.filter((block) => block !== "note");
  const body = layout.body.filter((block) => block !== "note");
  const footer = layout.footer.filter((block) => block !== "logo" && block !== "note");
  return {
    paperWidth: layout.paperWidth,
    header,
    body,
    footer: [...footer, "note"],
  };
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
