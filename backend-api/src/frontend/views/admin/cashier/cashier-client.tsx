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
import {
  Banknote,
  Building2,
  Clock,
  CreditCard,
  LayoutGrid,
  Minus,
  PackageSearch,
  Plus,
  Printer,
  ReceiptText,
  RefreshCw,
  Scale,
  ShoppingCart,
  Trash2,
  Wifi,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CollapsibleSection } from "../_components/collapsible-section";
import { ListControls } from "../_components/list-controls";
import { useRolePermissions } from "../_components/use-role-permissions";
import { useToast } from "../_components/toast-provider";
import { allOutletsValue, useSelectedOutlet } from "@/frontend/controllers/selected-outlet-provider";
import { getOutlets, getProfile } from "@/frontend/controllers/admin-data-cache";

type ApiResponse<T> = { data: T };
type Outlet = { id: string; name: string; code: string; isActive?: boolean };
type Profile = { id: string; name: string; email: string; role: string };
type Shift = {
  id: string;
  status: string;
  openingCash: string;
  expectedCash: string;
};
type CatalogItem = {
  productId: string;
  productName: string;
  category: string | null;
  skuId: string;
  skuCode: string;
  barcode: string | null;
  skuName: string;
  price: string;
  baseUnitId: string | null;
  saleUnitId: string;
  saleUnitToBaseFactor: string;
  baseUnitCode: string | null;
  saleUnitCode: string | null;
  onHandBaseQty: string | null;
  reservedBaseQty: string | null;
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
};
type CartSession = { id: string; label: string; lines: CartLine[] };
type PendingSale = Record<string, unknown> & {
  outletId?: string;
  idempotencyKey?: string;
};
type SalesSummary = {
  transactionCount: number;
  netSales: string;
  grossProfit: string;
};
type SalesDetail = {
  id: string;
  receiptNumber: string;
  cashierName: string | null;
  grandTotal: string;
  paymentMethods: string;
  createdAt: string;
  items: Array<{
    name: string;
    quantityInput: string;
    unitCode: string | null;
    unitPrice: string;
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
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [sessions, setSessions] = useState<CartSession[]>([
    { id: "main", label: "Pelanggan 1", lines: [] },
  ]);
  const [activeSessionId, setActiveSessionId] = useState("main");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Semua");
  const [openingCash, setOpeningCash] = useState("0");
  const [actualCash, setActualCash] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [paid, setPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [pendingSales, setPendingSales] = useState<PendingSale[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const parsed = JSON.parse(
        window.localStorage.getItem(pendingStorageKey) ?? "[]",
      ) as PendingSale[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [salesSummary, setSalesSummary] = useState<SalesSummary | null>(null);
  const [salesDetails, setSalesDetails] = useState<SalesDetail[]>([]);
  const [wasteForm, setWasteForm] = useState({
    skuId: "",
    quantity: "",
    reason: "crumbs_unsellable",
    note: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [activeModal, setActiveModal] = useState<
    | "shift"
    | "waste"
    | "reports"
    | "sync"
    | "tools"
    | "cart"
    | null
  >(null);
  const [flyingProduct, setFlyingProduct] = useState<FlyingProduct | null>(null);

  const activeOutlet = outlets.find((item) => item.id === outletId) ?? null;
  const activeSession =
    sessions.find((item) => item.id === activeSessionId) ?? sessions[0];
  const cart = activeSession?.lines ?? [];
  const subtotal = cart.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const discountTotal = Math.min(parseNumber(discount), subtotal);
  const grandTotal = Math.max(0, subtotal - discountTotal);
  const paidTotal =
    paymentMethod === "cash" ? Math.max(parseNumber(paid), grandTotal) : grandTotal;
  const changeTotal = Math.max(0, paidTotal - grandTotal);

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

  async function loadInitial() {
    setIsLoading(true);
    try {
      const [profileData, outletsData] = await Promise.all([
        getProfile(),
        getOutlets(),
      ]);
      const availableOutlets = outletsData as Outlet[];
      setProfile(profileData as Profile);
      setOutlets(availableOutlets);
      if (!availableOutlets.length) {
        setOutletId("");
        setShift(null);
        setCatalog([]);
        setSalesSummary(null);
        setSalesDetails([]);
        setMessage("Tidak ada outlet aktif untuk kasir.");
        setIsLoading(false);
      }
    } catch {
      setMessage("Gagal memuat profil atau outlet kasir.");
      setIsLoading(false);
    }
  }

  async function loadWorkspace(nextOutletId = outletId) {
    if (!nextOutletId) return;
    const requestId = ++workspaceRequestRef.current;
    setIsLoading(true);
    setMessage(null);
    const query = `outletId=${encodeURIComponent(nextOutletId)}`;
    const [shiftResponse, catalogResponse, summaryResponse, detailResponse] =
      await Promise.all([
        fetch(`/api/shifts/current?${query}`),
        fetch(`/api/catalog?${query}`),
        fetch(`/api/reports/sales-summary?${query}`),
        fetch(`/api/reports/sales-detail?${query}`),
      ]);
    if ([shiftResponse, catalogResponse, summaryResponse, detailResponse].some((r) => r.status === 401)) {
      window.location.assign("/admin/login");
      return;
    }
    if (!shiftResponse.ok || !catalogResponse.ok) {
      if (requestId !== workspaceRequestRef.current) return;
      setMessage("Gagal memuat shift atau katalog outlet.");
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
    if (requestId !== workspaceRequestRef.current) return;
    setShift(shiftJson.data);
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
    setIsLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadInitial();
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

  function persistPending(next: PendingSale[]) {
    setPendingSales(next);
    window.localStorage.setItem(pendingStorageKey, JSON.stringify(next));
  }

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
        setMessage(await readError(response, "Buka shift gagal."));
        return;
      }
      const json = (await response.json()) as ApiResponse<Shift>;
      setShift(json.data);
      setActualCash(formatPlain(json.data.expectedCash));
      setMessage("Shift dibuka.");
      showToast({ tone: "success", title: "Shift dibuka" });
    });
  }

  async function closeShift() {
    if (!shift) return;
    await runBusy(async () => {
      const response = await fetch("/api/shifts/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftId: shift.id,
          actualCash: parseNumber(actualCash),
        }),
      });
      if (!response.ok) {
        setMessage(await readError(response, "Tutup shift gagal."));
        return;
      }
      setShift(null);
      resetCarts();
      setMessage("Shift ditutup.");
      showToast({ tone: "success", title: "Shift ditutup" });
      await loadWorkspace(outletId);
    });
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
        };
    const stockMessage = stockLimitMessage(nextLine, nextLine.quantity);
    if (stockMessage) {
      setMessage(stockMessage);
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
      setMessage(stockMessage);
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
      setMessage(stockMessage);
      return;
    }
    setActiveLines(
      cart.map((item) => (item.item.skuId === line.item.skuId ? nextLine : item)),
    );
  }

  function newSession() {
    const id = `session-${Date.now()}`;
    setSessions((current) => [
      ...current,
      { id, label: `Pelanggan ${current.length + 1}`, lines: [] },
    ]);
    setActiveSessionId(id);
  }

  function closeSession() {
    if (sessions.length <= 1) {
      setActiveLines([]);
      return;
    }
    const nextSessions = sessions.filter((item) => item.id !== activeSessionId);
    setSessions(nextSessions);
    setActiveSessionId(nextSessions[0].id);
  }

  function resetCarts() {
    setSessions([{ id: "main", label: "Pelanggan 1", lines: [] }]);
    setActiveSessionId("main");
    setDiscount("0");
    setPaid("");
  }

  async function checkout() {
    if (!activeOutlet) {
      setMessage("Pilih outlet terlebih dahulu.");
      return;
    }
    if (!shift) {
      setMessage("Buka shift sebelum transaksi.");
      return;
    }
    if (!cart.length) {
      setMessage("Keranjang masih kosong.");
      return;
    }
    const stockMessage = cart.map((line) => stockLimitMessage(line, line.quantity)).find(Boolean);
    if (stockMessage) {
      setMessage(stockMessage);
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
          setMessage(await readError(response, "Transaksi gagal."));
          return;
        }
        printReceipt(payload.receiptNumber, activeOutlet.name);
        resetCarts();
        setMessage("Transaksi selesai.");
        showToast({ tone: "success", title: "Transaksi selesai" });
        await loadWorkspace(outletId);
      } catch {
        persistPending([...pendingSales, payload]);
        printReceipt(payload.receiptNumber, activeOutlet.name);
        resetCarts();
        setMessage("Koneksi putus, transaksi disimpan ke antrean sync.");
        showToast({ tone: "info", title: "Transaksi masuk antrean sync" });
      }
    });
  }

  function buildSalePayload(nextOutletId: string, shiftId: string, counter: number) {
    const now = new Date();
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
        discountTotal: 0,
      })),
      payments: [{ method: paymentMethod, amount: paidTotal }],
      discountTotal,
      taxTotal: 0,
      serviceChargeTotal: 0,
      source: "web_cashier",
      clientCreatedAt: now.toISOString(),
    };
  }

  async function syncPending() {
    if (!pendingSales.length) {
      setMessage("Tidak ada antrean sync.");
      return;
    }
    await runBusy(async () => {
      const completedKeys = new Set<string>();
      const byOutlet = new Map<string, PendingSale[]>();
      for (const sale of pendingSales) {
        if (!sale.outletId) continue;
        byOutlet.set(sale.outletId, [...(byOutlet.get(sale.outletId) ?? []), sale]);
      }
      for (const [nextOutletId, transactions] of byOutlet) {
        const response = await fetch("/api/sync/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ outletId: nextOutletId, transactions }),
        });
        if (!response.ok) continue;
        const json = (await response.json()) as ApiResponse<{
          results: Array<{ idempotencyKey: string; status: string }>;
        }>;
        for (const result of json.data.results) {
          if (result.status === "processed") {
            completedKeys.add(result.idempotencyKey);
          }
        }
      }
      const nextPending = pendingSales.filter(
        (sale) => !completedKeys.has(sale.idempotencyKey ?? ""),
      );
      persistPending(nextPending);
      setMessage(
        nextPending.length
          ? `${completedKeys.size} transaksi tersync, ${nextPending.length} masih antre.`
          : "Semua antrean sync selesai.",
      );
      await loadWorkspace(outletId);
    });
  }

  async function submitWaste(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedWasteItem?.baseUnitId) {
      setMessage("Satuan dasar produk belum tersedia.");
      return;
    }
    const quantity = parseNumber(wasteForm.quantity);
    if (quantity <= 0) {
      setMessage("Qty remahan harus lebih dari 0.");
      return;
    }
    if (quantity > availableBaseQty(selectedWasteItem) + 0.000001) {
      setMessage("Qty remahan melebihi stok tersedia.");
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
        setMessage(await readError(response, "Input remahan gagal."));
        return;
      }
      setWasteForm((current) => ({ ...current, quantity: "", note: "" }));
      setMessage("Remahan dicatat dan stok diperbarui.");
      showToast({ tone: "success", title: "Remahan dicatat" });
      await loadWorkspace(outletId);
    });
  }

  function printReceipt(receiptNumber: string, outletName: string) {
    const text = buildReceiptText({
      receiptNumber,
      outletName,
      cashierName: profile?.name ?? "Kasir",
      lines: cart,
      subtotal,
      discount: discountTotal,
      total: grandTotal,
      paymentMethod,
      paid: paidTotal,
    });
    const popup = window.open("", "_blank", "width=420,height=680");
    if (!popup) {
      setMessage("Struk selesai dibuat, tetapi popup print diblokir browser.");
      return;
    }
    popup.document.write(`<pre style="font:14px monospace;white-space:pre-wrap">${escapeHtml(text)}</pre>`);
    popup.document.close();
    popup.print();
  }

  function renderCartBody() {
    return (
      <div className="grid min-h-0 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-h-0 rounded-lg border bg-background">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
            <div className="flex flex-wrap gap-2">
              {sessions.map((session) => (
                <button
                  type="button"
                  key={session.id}
                  className={`rounded-md border px-3 py-2 text-sm font-medium ${
                    session.id === activeSessionId
                      ? "bg-primary text-primary-foreground"
                      : "bg-card"
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
          </div>

          <div className="max-h-[58vh] min-h-72 space-y-3 overflow-y-auto p-3 [scrollbar-width:thin]">
            {cart.map((line) => (
              <div key={line.item.skuId} className="rounded-lg border bg-card p-3">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_150px_120px_auto] md:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{line.item.skuName}</p>
                    <p className="text-sm text-muted-foreground">
                      {money(line.unitPrice)} / {line.unitLabel}
                    </p>
                  </div>
                  <select
                    className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={line.unitId}
                    onChange={(event) => changeUnit(line, event.target.value)}
                  >
                    {unitChoices(line.item).map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.label}
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-[2.25rem_1fr_2.25rem] items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 p-0"
                      onClick={() => changeQuantity(line, line.quantity - 1)}
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
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 p-0"
                      onClick={() => changeQuantity(line, line.quantity + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-2 md:justify-end">
                    <p className="font-semibold">
                      {money(line.quantity * line.unitPrice)}
                    </p>
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-muted"
                      onClick={() => changeQuantity(line, 0)}
                      aria-label="Hapus item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {!cart.length ? (
              <div className="flex min-h-72 items-center justify-center rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                Keranjang masih kosong.
              </div>
            ) : null}
          </div>
        </section>

        <aside className="h-fit rounded-lg border bg-background p-4">
          <div className="grid gap-3">
          <Field
            label="Diskon"
            value={discount}
            onChange={(value) => setDiscount(formatNumberInput(value))}
          />
          <SelectField
            label="Pembayaran"
            value={paymentMethod}
            onChange={setPaymentMethod}
            options={paymentMethods}
          />
          {paymentMethod === "cash" ? (
            <Field
              label="Dibayar"
              value={paid}
              onChange={(value) => setPaid(formatNumberInput(value))}
            />
          ) : null}
          </div>
          <div className="mt-4 space-y-3 border-t pt-4">
            <TotalRow label="Subtotal" value={money(subtotal)} />
            <TotalRow label="Diskon" value={money(discountTotal)} />
            <TotalRow label="Total" value={money(grandTotal)} strong />
            <TotalRow label="Kembali" value={money(changeTotal)} />
          </div>
          <Button
            type="button"
            className="mt-4 w-full"
            onClick={() => void checkout()}
            disabled={isBusy || !shift || !cart.length}
          >
            <ReceiptText className="h-4 w-4" />
            Bayar
          </Button>
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
              className="flex h-10 max-w-[14rem] items-center gap-2 rounded-full border bg-background px-3 text-sm font-semibold shadow-sm"
              title={`Outlet aktif dari sidebar: ${activeOutlet?.name ?? "-"}`}
            >
              <Building2 className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">{activeOutlet?.name ?? "Pilih outlet"}</span>
            </div>
            <button
              type="button"
              className="flex h-10 max-w-[12rem] items-center gap-2 rounded-full border bg-background px-3 text-sm font-semibold shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        {message ? <p className="mb-4 text-sm text-destructive">{message}</p> : null}
          <ListControls
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Cari produk, SKU, barcode..."
            filters={[
              {
                label: "Kategori",
                value: category,
                onChange: setCategory,
                options: categories.map((item) => ({ value: item, label: item })),
              },
            ]}
            sort="name"
            onSortChange={() => undefined}
            sortOptions={[{ value: "name", label: "Nama produk" }]}
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {visibleCatalog.map((item) => {
              const available = availableBaseQty(item);
              return (
                <button
                  type="button"
                  key={item.skuId}
                  className="flex min-h-40 flex-col justify-between rounded-lg border bg-background p-4 text-left transition-colors hover:border-primary hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={(event) => addToCart(item, event)}
                  disabled={!shift || available <= 0}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{item.skuName}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {item.skuCode} - {item.productName}
                      </p>
                    </div>
                    <PackageSearch className="h-5 w-5 shrink-0 text-primary" />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <span>{money(item.price)}</span>
                    <span className="text-right text-muted-foreground">
                      {qty(available)} {item.baseUnitCode || "unit"}
                    </span>
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
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric icon={Clock} label="Status Shift" value={shift ? "Open" : "Closed"} />
            <Metric icon={Banknote} label="Kas Ekspektasi" value={money(shift?.expectedCash ?? 0)} />
          </div>
          <div className="rounded-lg border bg-background p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Kas Awal" value={openingCash} onChange={(value) => setOpeningCash(formatNumberInput(value))} />
              <Field label="Kas Aktual Tutup" value={actualCash} onChange={(value) => setActualCash(formatNumberInput(value))} />
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Button type="button" onClick={() => void openShift()} disabled={isBusy || Boolean(shift)}>
            <Clock className="h-4 w-4" />
            Buka Shift
              </Button>
              <Button type="button" variant="secondary" onClick={() => void closeShift()} disabled={isBusy || !shift}>
            <Clock className="h-4 w-4" />
            Tutup Shift
              </Button>
            </div>
          </div>
        </div>
      </CashierModal>

      <CashierModal
        title="Sync Transaksi Offline"
        open={activeModal === "sync"}
        onClose={() => setActiveModal(null)}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Metric icon={Wifi} label="Antrean" value={`${pendingSales.length} transaksi`} />
          <Metric icon={ShoppingCart} label="Outlet Aktif" value={activeOutlet?.name ?? "-"} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={() => void syncPending()} disabled={isBusy || !pendingSales.length}>
            <RefreshCw className="h-4 w-4" />
            Sync Sekarang
          </Button>
        </div>
        <div className="mt-4 space-y-2">
          {pendingSales.slice(0, 8).map((sale, index) => (
            <div key={`${sale.idempotencyKey ?? index}`} className="rounded-md border p-3 text-sm">
              <p className="font-medium">{sale.receiptNumber?.toString() ?? sale.idempotencyKey ?? "Pending sale"}</p>
              <p className="text-muted-foreground">{sale.outletId ?? "-"}</p>
            </div>
          ))}
          {!pendingSales.length ? (
            <p className="text-sm text-muted-foreground">Tidak ada antrean sync.</p>
          ) : null}
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
            onChange={(value) => setWasteForm({ ...wasteForm, quantity: formatNumberInput(value) })}
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
            <Button type="submit" disabled={isBusy || !catalog.length}>
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
              <Button type="button" variant="outline" onClick={() => printSalesDetail(sale, activeOutlet?.name ?? "Outlet")}>
                <Printer className="h-4 w-4" />
                Cetak
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
        <div className="grid gap-3 sm:grid-cols-2">
          <ToolButton
            icon={Clock}
            title="Shift Outlet"
            subtitle={shift ? "Shift sedang open" : "Buka shift sebelum transaksi"}
            onClick={() => setActiveModal("shift")}
          />
          <ToolButton
            icon={Wifi}
            title="Sync Offline"
            subtitle={`${pendingSales.length} transaksi antre`}
            onClick={() => setActiveModal("sync")}
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
      </CashierModal>

      <CashierModal
        title="Keranjang"
        open={activeModal === "cart"}
        onClose={() => setActiveModal(null)}
        maxWidthClassName="max-w-6xl"
        bodyClassName="overflow-hidden"
      >
        {renderCartBody()}
      </CashierModal>

      <div className="fixed bottom-4 left-4 right-4 z-40 flex items-end justify-end gap-2 sm:bottom-6 sm:right-6">
        <button
          type="button"
          className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#1D3557] text-white shadow-xl ring-1 ring-black/10 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setActiveModal("tools")}
          aria-label="Buka menu pendukung"
        >
          <LayoutGrid className="h-5 w-5" />
        </button>

      <div className="flex w-[min(23rem,calc(100vw-9rem))] min-w-0 flex-col items-stretch gap-2">
        {cart.length ? (
          <div className="max-h-[42vh] space-y-2 overflow-y-auto rounded-2xl border bg-card/95 p-2 shadow-xl backdrop-blur [scrollbar-width:thin]">
            {cart.map((line) => (
              <button
                type="button"
                key={`fab-${line.item.skuId}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-xl bg-background px-3 py-2 text-left text-sm shadow-sm ring-1 ring-border transition-colors hover:bg-muted"
                onClick={() => setActiveModal("cart")}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {line.item.skuName}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {qty(line.quantity)} {line.unitLabel}
                  </span>
                </span>
                <span className="self-center font-semibold">
                  {money(line.quantity * line.unitPrice)}
                </span>
              </button>
            ))}
          </div>
        ) : null}
        <button
          ref={cartFabRef}
          type="button"
          className="flex h-14 items-center justify-between gap-3 rounded-full bg-[#E63946] px-4 text-white shadow-xl ring-1 ring-black/10 transition-all hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          "relative flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-lg border bg-card shadow-2xl sm:max-h-[calc(100vh-3rem)]",
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
  return (
    <button
      type="button"
      className="flex items-center gap-3 rounded-lg border bg-background p-4 text-left transition-colors hover:border-primary hover:bg-muted/30"
      onClick={props.onClick}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
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

function Field(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={["space-y-2", props.className].filter(Boolean).join(" ")}>
      <Label>{props.label}</Label>
      <Input value={props.value} inputMode="decimal" onChange={(event) => props.onChange(event.target.value)} />
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
      <select
        className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      >
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Metric(props: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <props.icon className="mb-3 h-5 w-5 text-primary" />
      <p className="text-sm text-muted-foreground">{props.label}</p>
      <p className="mt-1 text-xl font-semibold">{props.value}</p>
    </div>
  );
}

function TotalRow(props: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${props.strong ? "text-lg font-semibold" : "text-sm"}`}>
      <span className="text-muted-foreground">{props.label}</span>
      <span>{props.value}</span>
    </div>
  );
}

function unitChoices(item: CatalogItem): UnitChoice[] {
  const factor = parseNumber(item.saleUnitToBaseFactor) || 1;
  return [
    {
      id: item.saleUnitId,
      label: item.saleUnitCode || item.baseUnitCode || "unit",
      toBaseFactor: factor,
      price: parseNumber(item.price),
    },
  ];
}

function availableBaseQty(item: CatalogItem) {
  return Math.max(0, parseNumber(item.onHandBaseQty ?? 0) - parseNumber(item.reservedBaseQty ?? 0));
}

function stockLimitMessage(line: CartLine, quantity: number) {
  if (quantity <= 0) return null;
  const available = availableBaseQty(line.item);
  if (quantity * line.unitToBaseFactor <= available + 0.000001) return null;
  if (available <= 0) return `Stok ${line.item.skuName} kosong.`;
  return `Qty ${line.item.skuName} melebihi stok tersedia (${qty(available / line.unitToBaseFactor)} ${line.unitLabel}).`;
}

function parseNumber(value: string | number | null | undefined) {
  if (typeof value === "number") return value;
  const raw = String(value ?? "0").trim();
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw) || raw.includes(",")) {
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

function formatPlain(value: string | number) {
  const number = parseNumber(value);
  return number.toLocaleString("id-ID", { maximumFractionDigits: 3 });
}

function money(value: string | number) {
  return `Rp ${parseNumber(value).toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
}

function qty(value: string | number) {
  return parseNumber(value).toLocaleString("id-ID", { maximumFractionDigits: 3 });
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
  cashierName: string;
  lines: CartLine[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  paid: number;
}) {
  const width = 32;
  const separator = "-".repeat(width);
  const row = (left: string, right: string) => {
    const rightSafe = right.slice(0, width);
    const leftSafe = left.slice(0, Math.max(0, width - rightSafe.length - 1));
    return `${leftSafe.padEnd(Math.max(0, width - rightSafe.length - 1))} ${rightSafe}`;
  };
  const lines = [
    input.outletName,
    `Kasir: ${input.cashierName}`,
    `No: ${input.receiptNumber}`,
    formatDate(new Date().toISOString()),
    separator,
    ...input.lines.flatMap((line) => [
      line.item.skuName.slice(0, width),
      row(`${qty(line.quantity)} ${line.unitLabel} x ${formatPlain(line.unitPrice)}`, formatPlain(line.quantity * line.unitPrice)),
    ]),
    separator,
    row("Subtotal", formatPlain(input.subtotal)),
    row("Diskon", formatPlain(input.discount)),
    row("TOTAL", formatPlain(input.total)),
    row(input.paymentMethod, formatPlain(input.paid)),
    row("Kembali", formatPlain(Math.max(0, input.paid - input.total))),
    separator,
    "Terima kasih",
  ];
  return `${lines.join("\n")}\n`;
}

function printSalesDetail(sale: SalesDetail, outletName: string) {
  const text = [
    outletName,
    `Kasir: ${sale.cashierName || "Kasir"}`,
    `No: ${sale.receiptNumber}`,
    formatDate(sale.createdAt),
    "-".repeat(32),
    ...sale.items.flatMap((item) => [
      item.name.slice(0, 32),
      `${qty(item.quantityInput)} ${item.unitCode || "unit"} x ${formatPlain(item.unitPrice)} = ${formatPlain(item.lineTotal)}`,
    ]),
    "-".repeat(32),
    `TOTAL ${formatPlain(sale.grandTotal)}`,
    sale.paymentMethods || "-",
    "Terima kasih",
  ].join("\n");
  const popup = window.open("", "_blank", "width=420,height=680");
  if (!popup) return;
  popup.document.write(`<pre style="font:14px monospace;white-space:pre-wrap">${escapeHtml(text)}</pre>`);
  popup.document.close();
  popup.print();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
