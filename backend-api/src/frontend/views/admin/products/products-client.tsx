"use client";

import Link from "next/link";
import Image from "next/image";
import { Fragment, useEffect, useMemo, useState, type ChangeEvent, type ComponentProps, type ComponentType, type ReactNode } from "react";
import { AlertTriangle, Building2, ChevronLeft, ChevronRight, ChevronsUpDown, Edit3, ImageIcon, Plus, Power, PowerOff, Ruler, Save, Search, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CollapsibleSection } from "../_components/collapsible-section";
import { AdminModal } from "../_components/admin-modal";
import { pageItems } from "../_components/pagination-controls";
import { confirmAction, useToast } from "../_components/toast-provider";
import { useRolePermissions } from "../_components/use-role-permissions";
import { SearchableSelect } from "../_components/searchable-select";
import { CodeInput, generateCode } from "../_components/code-input";
import { allOutletsValue, clearSelectedOutlet, useSelectedOutlet } from "@/frontend/controllers/selected-outlet-provider";
import { getOutlets, getUnits } from "@/frontend/controllers/admin-data-cache";
import { compressProductImage } from "@/frontend/lib/image-compression";

type Unit = {
  id: string;
  name: string;
  code: string;
  kind: UnitKind;
  toBaseFactor: string;
  isActive: boolean;
};

type UnitKind = "weight" | "count" | "package";
type ProductCreateTemplate = "pack_weight" | "weight" | "count" | "non_stock";

type Outlet = {
  id: string;
  name: string;
  code: string;
};

type Product = {
  id: string;
  name: string;
  category: string | null;
  imageUrl: string | null;
  voidWindowHours: number | null;
  refundWindowHours: number | null;
  isActive: boolean;
  skus: Array<{
    id: string;
    sku: string;
    name: string;
    imageUrl: string | null;
    barcode: string | null;
    baseUnitId: string;
    saleUnitId: string;
    price: string;
    cost: string;
    minStockBaseQty: string;
    saleUnitToBaseFactor: string;
    trackInventory: boolean;
    quantityMode: "required" | "fixed_one";
    isActive: boolean;
    baseUnit?: { code: string; kind?: UnitKind | null } | null;
    saleUnit?: { code: string; kind?: UnitKind | null } | null;
  }>;
};

type ApiResponse<T> = { data: T };
type UploadResponse = { url: string; key: string };

type ProductIconButtonProps = ComponentProps<typeof Button> & { compact?: boolean };

function ProductIconButton({ className, compact, ...props }: ProductIconButtonProps) {
  return <Button {...props} className={[compact ? "h-8 w-8" : "h-10 w-10", "shrink-0 p-0", className].filter(Boolean).join(" ")} />;
}

type ApiErrorBody = { error?: { code?: string; message?: string; details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] } } };
const productOutletRequiredMessage = "Pilih outlet spesifik terlebih dahulu untuk memuat produk.";

async function readApiError(response: Response, fallback: string) {
  try {
    const json = (await response.json()) as ApiErrorBody;
    const code = json.error?.code ? `${json.error.code}: ` : "";
    const fieldErrors = json.error?.details?.fieldErrors;
    const detail = fieldErrors
      ? Object.entries(fieldErrors)
          .flatMap(([field, messages]) => messages.map((message) => `${field}: ${message}`))
          .join("; ")
      : "";
    const message = json.error?.message ? `${code}${json.error.message}` : fallback;
    return detail ? `${message} (${detail})` : message;
  } catch {
    return fallback;
  }
}

const initialForm = {
  name: "",
  category: "",
  imageUrl: "",
  sku: "",
  skuName: "",
  skuImageUrl: "",
  barcode: "",
  voidWindowHours: "0",
  refundWindowHours: "0",
  productType: "weight" as UnitKind,
  baseUnitId: "",
  saleUnitId: "",
  saleUnitToBaseFactor: "1",
  price: "0",
  cost: "0",
  minStockBaseQty: "0",
  trackInventory: true,
  quantityMode: "required" as "required" | "fixed_one",
};

type EditSkuForm = Omit<Product["skus"][number], "id"> & {
  id?: string;
  productType: UnitKind;
  imageUrl: string | null;
  price: string;
  cost: string;
  saleUnitToBaseFactor: string;
  minStockBaseQty: string;
  trackInventory: boolean;
  quantityMode: "required" | "fixed_one";
  isNew?: boolean;
};

type EditProductForm = {
  name: string;
  category: string;
  imageUrl: string;
  voidWindowHours: string;
  refundWindowHours: string;
  isActive: boolean;
  skus: EditSkuForm[];
};

export function ProductsClient() {
  const access = useRolePermissions("products");
  const { selectedOutletId } = useSelectedOutlet();
  const { showToast } = useToast();
  const [productOutletId, setProductOutletId] = useState("");
  const [hasOutletReady, setHasOutletReady] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(initialForm);
  const [createTemplate, setCreateTemplate] = useState<ProductCreateTemplate>("pack_weight");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingVariant, setEditingVariant] = useState<{ product: Product; sku: EditSkuForm } | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditProductForm | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name-asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  const unitCode = (unitId: string) =>
    units.find((unit) => unit.id === unitId)?.code || "unit";
  const productToEditForm = (productItem: Product, skuOverride?: EditSkuForm): EditProductForm => ({
    name: productItem.name,
    category: productItem.category ?? "",
    imageUrl: productItem.imageUrl ?? "",
    voidWindowHours: optionalNumberForInput(productItem.voidWindowHours),
    refundWindowHours: optionalNumberForInput(productItem.refundWindowHours),
    isActive: productItem.isActive,
    skus: productItem.skus.map((item) => {
      if (skuOverride?.id === item.id) return skuOverride;
      return {
        ...item,
        productType: unitKindForUnit(units, item.saleUnitId) ?? "weight",
        barcode: item.barcode ?? "",
        imageUrl: item.imageUrl ?? null,
        price: formatNumberForInput(item.price),
        cost: formatNumberForInput(item.cost),
        saleUnitToBaseFactor: formatNumberForInput(item.saleUnitToBaseFactor),
        minStockBaseQty: formatNumberForInput(item.minStockBaseQty),
        trackInventory: item.trackInventory !== false,
        quantityMode: item.quantityMode === "fixed_one" ? "fixed_one" : "required",
      };
    }),
  });
  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          products
            .map((item) => item.category?.trim())
            .filter((category): category is string => Boolean(category)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [products],
  );
  const categoryOptions = useMemo(
    () => [
      ...categories.map((category) => ({
        value: category,
        label: category,
      })),
      { value: "Tanpa kategori", label: "Tanpa kategori" },
    ],
    [categories],
  );
  const visibleProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return products
      .filter((item) => {
        const matchesSearch =
          !keyword ||
          [item.name, item.category ?? "", ...item.skus.flatMap((sku) => [sku.sku, sku.name, sku.barcode ?? ""])]
            .join(" ")
            .toLowerCase()
            .includes(keyword);
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "active" && item.isActive) ||
          (statusFilter === "inactive" && !item.isActive);
        const matchesCategory = categoryFilter === "all" || (item.category || "Tanpa kategori") === categoryFilter;
        return matchesSearch && matchesStatus && matchesCategory;
      })
      .sort((a, b) => {
        const firstSkuA = a.skus[0];
        const firstSkuB = b.skus[0];
        switch (sortBy) {
          case "name-desc":
            return b.name.localeCompare(a.name);
          case "category-asc":
            return (a.category || "").localeCompare(b.category || "") || a.name.localeCompare(b.name);
          case "price-desc":
            return Number(firstSkuB?.price ?? 0) - Number(firstSkuA?.price ?? 0);
          case "price-asc":
            return Number(firstSkuA?.price ?? 0) - Number(firstSkuB?.price ?? 0);
          case "status":
            return Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name);
          default:
            return a.name.localeCompare(b.name);
        }
      });
  }, [categoryFilter, products, search, sortBy, statusFilter]);
  const pagedProducts = pageItems(visibleProducts, page, pageSize);
  const productTypeOptions = useMemo(
    () =>
      (["weight", "count", "package"] as UnitKind[]).map((kind) => ({
        value: kind,
        label: unitKindLabel(kind),
      })),
    [],
  );
  const createUnitOptions = useMemo(
    () => unitOptionsForKind(units, form.productType),
    [form.productType, units],
  );
  const createBaseUnitOptions = useMemo(
    () => unitOptionsForKind(units, createTemplate === "pack_weight" ? "weight" : form.productType, [form.baseUnitId]),
    [createTemplate, form.baseUnitId, form.productType, units],
  );
  const createSaleUnitOptions = useMemo(
    () => unitOptionsForKind(units, createTemplate === "pack_weight" ? "package" : form.productType, [form.saleUnitId]),
    [createTemplate, form.productType, form.saleUnitId, units],
  );
  const hasAnyUnit = units.length > 0;
  const hasSelectableUnit = createBaseUnitOptions.length > 0 && createSaleUnitOptions.length > 0;
  const hasUnitSelection =
    hasSelectableUnit && Boolean(form.baseUnitId && form.saleUnitId);
  const canSubmitProduct =
    !isSubmitting &&
    !isLoading &&
    Boolean(productOutletId) &&
    hasOutletReady &&
    selectedOutletId !== allOutletsValue &&
    hasUnitSelection;

  function applyCreateTemplate(template: ProductCreateTemplate) {
    setCreateTemplate(template);
    setForm((current) => {
      const next = { ...current };
      if (template === "pack_weight") {
        const baseUnitId = preferredUnitId(units, "weight", ["g", "gr", "gram"]) || next.baseUnitId;
        const saleUnitId = preferredUnitId(units, "package", ["pack", "pak", "pouch"]) || next.saleUnitId;
        next.productType = "package";
        next.baseUnitId = baseUnitId;
        next.saleUnitId = saleUnitId;
        next.saleUnitToBaseFactor = next.saleUnitToBaseFactor === "1" ? "250" : next.saleUnitToBaseFactor;
        next.trackInventory = true;
        next.quantityMode = "required";
        next.skuName = next.skuName || (next.name ? `${next.name} 250g` : "");
      }
      if (template === "weight") {
        const baseUnitId = preferredUnitId(units, "weight", ["g", "gr", "gram"]) || next.baseUnitId;
        const saleUnitId = preferredUnitId(units, "weight", ["kg", "kilo", "kilogram"]) || baseUnitId;
        next.productType = "weight";
        next.baseUnitId = baseUnitId;
        next.saleUnitId = saleUnitId;
        next.saleUnitToBaseFactor = conversionInput(units, baseUnitId, saleUnitId);
        next.trackInventory = true;
        next.quantityMode = "required";
      }
      if (template === "count") {
        const unitId = preferredUnitId(units, "count", ["pcs", "pc", "buah"]) || next.baseUnitId;
        next.productType = "count";
        next.baseUnitId = unitId;
        next.saleUnitId = unitId;
        next.saleUnitToBaseFactor = "1";
        next.trackInventory = true;
        next.quantityMode = "required";
      }
      if (template === "non_stock") {
        const unitId = preferredUnitId(units, "count", ["pcs", "pc", "buah"]) || preferredUnitId(units, "package", ["pack", "pak"]) || next.baseUnitId;
        next.productType = unitKindForUnit(units, unitId) ?? "count";
        next.baseUnitId = unitId;
        next.saleUnitId = unitId;
        next.saleUnitToBaseFactor = "1";
        next.trackInventory = false;
        next.quantityMode = "required";
        next.minStockBaseQty = "0";
      }
      return next;
    });
  }

  async function loadOutlets() {
    try {
      const outlets = await getOutlets({ force: true });
      if (!selectedOutletId) {
        setProductOutletId("");
        setHasOutletReady(false);
        setProducts([]);
        setUnits([]);
        setIsLoading(false);
        setMessage(productOutletRequiredMessage);
        return;
      }
      if (!outlets.length) {
        clearSelectedOutlet();
        setProductOutletId("");
        setHasOutletReady(false);
        setProducts([]);
        setUnits([]);
        setIsLoading(false);
        setMessage("Buat outlet terlebih dahulu sebelum membuat produk.");
        return;
      }
      if (selectedOutletId === allOutletsValue) {
        setProductOutletId("");
        setHasOutletReady(false);
        setProducts([]);
        setUnits([]);
        setIsLoading(false);
        setMessage(productOutletRequiredMessage);
        return;
      }
      const selectedIsSpecificOutlet =
        selectedOutletId !== allOutletsValue &&
        outlets.some((outlet) => outlet.id === selectedOutletId);
      if (!selectedIsSpecificOutlet) {
        clearSelectedOutlet();
        setProductOutletId("");
        setHasOutletReady(false);
        setProducts([]);
        setUnits([]);
        setIsLoading(false);
        setMessage("Outlet aktif sudah tidak tersedia. Pilih atau buat outlet terlebih dahulu.");
        return;
      }
      setHasOutletReady(true);
      setProductOutletId(selectedOutletId);
    } catch {
      setHasOutletReady(false);
      setIsLoading(false);
      setMessage("Gagal memuat pilihan outlet.");
    }
  }

  async function loadData() {
    if (selectedOutletId === allOutletsValue) {
      setHasOutletReady(false);
      setProducts([]);
      setUnits([]);
      setIsLoading(false);
      setMessage(productOutletRequiredMessage);
      return;
    }
    if (!productOutletId) {
      setHasOutletReady(false);
      setProducts([]);
      setIsLoading(false);
      setMessage(productOutletRequiredMessage);
      return;
    }
    setIsLoading(true);
    setMessage(null);
    const productUrl = `/api/products?outletId=${encodeURIComponent(productOutletId)}`;
    let unitData: Unit[];
    let productResponse: Response;
    try {
      [unitData, productResponse] = await Promise.all([getUnits({ force: true }) as Promise<Unit[]>, fetch(productUrl)]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal memuat satuan.";
      if (message.includes("401") || message.includes("UNAUTHORIZED")) {
        window.location.href = "/admin/login";
        return;
      }
      setUnits([]);
      setProducts([]);
      setMessage(message);
      setIsLoading(false);
      return;
    }
    if (productResponse.status === 401) {
      window.location.href = "/admin/login";
      return;
    }
    if (!productResponse.ok) {
      setMessage(await readApiError(productResponse, "Gagal memuat data produk. Pastikan sudah login sebagai admin."));
      setIsLoading(false);
      return;
    }
    const productJson = (await productResponse.json()) as ApiResponse<Product[]>;
    setUnits(unitData);
    setProducts(productJson.data);
    setForm((current) => ({
      ...current,
      ...(current.baseUnitId || current.saleUnitId
        ? normalizeUnitSelection(unitData, current)
        : {
            productType: "package" as UnitKind,
            baseUnitId: preferredUnitId(unitData, "weight", ["g", "gr", "gram"]),
            saleUnitId: preferredUnitId(unitData, "package", ["pack", "pak", "pouch"]),
            saleUnitToBaseFactor: "250",
          }),
    }));
    setIsLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOutlets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOutletId]);

  useEffect(() => {
    if (!productOutletId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productOutletId]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    if (!productOutletId) {
      setMessage(productOutletRequiredMessage);
      setIsSubmitting(false);
      return;
    }
    if (!hasUnitSelection) {
      setMessage("Buat dan pilih satuan stok serta satuan jual sebelum menyimpan produk.");
      showToast({
        tone: "error",
        title: "Satuan belum siap",
        description: "Buat satuan dahulu, lalu pilih satuan stok dan satuan jual.",
      });
      setIsSubmitting(false);
      return;
    }

    const skuCode = form.sku.trim().toUpperCase() || generateCode("PRD");
    const skuName = form.skuName.trim() || form.name.trim();
    const response = await fetch(`/api/products?outletId=${encodeURIComponent(productOutletId)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: form.name,
        category: form.category || undefined,
        imageUrl: form.imageUrl || null,
        voidWindowHours: optionalInteger(form.voidWindowHours),
        refundWindowHours: optionalInteger(form.refundWindowHours),
        sku: {
          sku: skuCode,
          barcode: form.barcode || undefined,
          name: skuName,
          imageUrl: form.skuImageUrl || null,
          baseUnitId: form.baseUnitId,
          saleUnitId: form.saleUnitId,
          saleUnitToBaseFactor: parseIndonesianNumber(form.saleUnitToBaseFactor),
          price: parseIndonesianNumber(form.price),
          cost: parseIndonesianNumber(form.cost),
          minStockBaseQty: parseIndonesianNumber(form.minStockBaseQty),
          trackInventory: form.trackInventory,
          quantityMode: form.quantityMode,
        },
      }),
    });

    if (!response.ok) {
      const errorMessage = await readApiError(response, "Produk gagal dibuat. Periksa data satuan, kode SKU, harga, dan role admin.");
      setMessage(errorMessage);
      showToast({
        tone: "error",
        title: "Produk gagal dibuat",
        description: errorMessage,
      });
      setIsSubmitting(false);
      return;
    }

    setForm({
      ...initialForm,
      productType: form.productType,
      baseUnitId: form.baseUnitId,
      saleUnitId: form.saleUnitId,
      saleUnitToBaseFactor: form.saleUnitToBaseFactor,
    });
    setMessage("Produk berhasil dibuat dari dashboard backend.");
    setIsCreateOpen(false);
    showToast({ tone: "success", title: "Produk berhasil dibuat" });
    await loadData();
    setIsSubmitting(false);
  }

  function startEdit(product: Product) {
    setEditingProductId(product.id);
    setEditForm(productToEditForm(product));
  }

  function cancelEdit() {
    setEditingProductId(null);
    setEditForm(null);
  }

  function startVariantEdit(productItem: Product, skuItem: Product["skus"][number]) {
    setEditingVariant({
      product: productItem,
      sku: {
        ...skuItem,
        productType: unitKindForUnit(units, skuItem.saleUnitId) ?? "weight",
        barcode: skuItem.barcode ?? "",
        imageUrl: skuItem.imageUrl ?? null,
        price: formatNumberForInput(skuItem.price),
        cost: formatNumberForInput(skuItem.cost),
        saleUnitToBaseFactor: formatNumberForInput(skuItem.saleUnitToBaseFactor),
        minStockBaseQty: formatNumberForInput(skuItem.minStockBaseQty),
        trackInventory: skuItem.trackInventory !== false,
        quantityMode: skuItem.quantityMode === "fixed_one" ? "fixed_one" : "required",
      },
    });
  }

  function startVariantCreate(productItem: Product) {
    const productType: UnitKind = "weight";
    const normalized = normalizeUnitSelection(units, {
      productType,
      baseUnitId: "",
      saleUnitId: "",
      saleUnitToBaseFactor: "1",
    });
    setEditingVariant({
      product: productItem,
      sku: {
        sku: "",
        name: "",
        barcode: "",
        imageUrl: null,
        price: "",
        cost: "",
        minStockBaseQty: "",
        isActive: true,
        baseUnit: null,
        saleUnit: null,
        productType,
        baseUnitId: normalized.baseUnitId,
        saleUnitId: normalized.saleUnitId,
        saleUnitToBaseFactor: normalized.saleUnitToBaseFactor,
        trackInventory: true,
        quantityMode: "required",
        isNew: true,
      },
    });
  }

  async function saveVariantEdit() {
    if (!editingVariant) return;
    const currentForm = productToEditForm(editingVariant.product);
    const nextForm = editingVariant.sku.isNew
      ? {
          ...currentForm,
          skus: [...currentForm.skus, editingVariant.sku],
        }
      : productToEditForm(editingVariant.product, editingVariant.sku);
    const success = await updateProduct(editingVariant.product.id, nextForm, { showSuccessToast: false });
    if (!success) return;
    showToast({
      tone: "success",
      title: editingVariant.sku.isNew ? "Varian berhasil ditambahkan" : "Varian berhasil diperbarui",
      description: editingVariant.sku.name,
    });
    setEditingVariant(null);
  }

  async function toggleVariant(productItem: Product, skuItem: Product["skus"][number]) {
    const nextActive = !skuItem.isActive;
    if (!(await confirmAction(`${nextActive ? "Aktifkan" : "Nonaktifkan"} varian ${skuItem.name}?`))) return;
    const nextSku: EditSkuForm = {
      ...skuItem,
      productType: unitKindForUnit(units, skuItem.saleUnitId) ?? "weight",
      barcode: skuItem.barcode ?? "",
      imageUrl: skuItem.imageUrl ?? null,
      price: formatNumberForInput(skuItem.price),
      cost: formatNumberForInput(skuItem.cost),
      saleUnitToBaseFactor: formatNumberForInput(skuItem.saleUnitToBaseFactor),
      minStockBaseQty: formatNumberForInput(skuItem.minStockBaseQty),
      trackInventory: skuItem.trackInventory !== false,
      quantityMode: skuItem.quantityMode === "fixed_one" ? "fixed_one" : "required",
      isActive: nextActive,
    };
    const success = await updateProduct(productItem.id, productToEditForm(productItem, nextSku), {
      skipStatusConfirm: true,
      showSuccessToast: false,
    });
    if (!success) return;
    showToast({ tone: "success", title: nextActive ? "Varian diaktifkan" : "Varian dinonaktifkan", description: skuItem.name });
  }

  async function deleteVariant(productItem: Product, skuItem: Product["skus"][number]) {
    if (!(await confirmAction("Hapus varian ini? Jika sudah punya transaksi atau stok, sistem akan menolak dan varian sebaiknya dinonaktifkan."))) {
      return;
    }
    setIsUpdating(true);
    const response = await fetch(`/api/products/${productItem.id}/skus/${skuItem.id}?outletId=${encodeURIComponent(productOutletId)}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const errorMessage = await readApiError(response, "Varian gagal dihapus. Nonaktifkan varian jika sudah dipakai transaksi atau stok.");
      setMessage(errorMessage);
      showToast({ tone: "error", title: "Varian gagal dihapus", description: errorMessage });
      setIsUpdating(false);
      return;
    }
    showToast({ tone: "success", title: "Varian dihapus" });
    await loadData();
    setIsUpdating(false);
  }

  async function updateProduct(
    productId: string,
    nextForm = editForm,
    options: { skipStatusConfirm?: boolean; showSuccessToast?: boolean } = {},
  ) {
    if (!nextForm) return false;
    const existing = products.find((item) => item.id === productId);
    const productStatusChanged =
      existing && existing.isActive !== nextForm.isActive;
    const skuStatusChanged = Boolean(
      existing?.skus.some((skuItem) => {
        const nextSku = nextForm.skus.find((item) => item.id === skuItem.id);
        return nextSku && nextSku.isActive !== skuItem.isActive;
      }),
    );
    if (
      (productStatusChanged || skuStatusChanged) &&
      !options.skipStatusConfirm &&
      !(await confirmAction(
        "Simpan perubahan status aktif/nonaktif produk atau SKU?",
      ))
    ) {
      return false;
    }
    const validationMessage = validateEditProductForm(nextForm);
    if (validationMessage) {
      setMessage(validationMessage);
      showToast({
        tone: "error",
        title: "Produk gagal diperbarui",
        description: validationMessage,
      });
      return false;
    }
    setIsUpdating(true);
    setMessage(null);

    const response = await fetch(`/api/products/${productId}?outletId=${encodeURIComponent(productOutletId)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: nextForm.name,
        category: nextForm.category || null,
        imageUrl: nextForm.imageUrl || null,
        voidWindowHours: optionalInteger(nextForm.voidWindowHours),
        refundWindowHours: optionalInteger(nextForm.refundWindowHours),
        isActive: nextForm.isActive,
        skus: nextForm.skus.map((item) => ({
          ...(item.id ? { id: item.id } : {}),
          sku: item.sku,
          barcode: item.barcode || null,
          name: item.name,
          imageUrl: item.imageUrl || null,
          baseUnitId: item.baseUnitId,
          saleUnitId: item.saleUnitId,
          saleUnitToBaseFactor: parseIndonesianNumber(item.saleUnitToBaseFactor),
          trackInventory: item.trackInventory,
          quantityMode: item.quantityMode,
          price: parseIndonesianNumber(item.price),
          cost: parseIndonesianNumber(item.cost),
          minStockBaseQty: parseIndonesianNumber(item.minStockBaseQty),
          isActive: item.isActive,
        })),
      }),
    });

    if (!response.ok) {
      const errorMessage = await readApiError(response, "Produk gagal diperbarui. Periksa kode tampil, harga, satuan, dan role admin.");
      setMessage(errorMessage);
      showToast({
        tone: "error",
        title: "Produk gagal diperbarui",
        description: errorMessage,
      });
      setIsUpdating(false);
      return false;
    }

    setMessage("Produk berhasil diperbarui.");
    if (options.showSuccessToast !== false) {
      showToast({ tone: "success", title: "Produk berhasil diperbarui" });
    }
    cancelEdit();
    await loadData();
    setIsUpdating(false);
    return true;
  }

  async function toggleProduct(productItem: Product) {
    const nextActive = !productItem.isActive;
    if (
      !(await confirmAction(
        `Yakin ingin ${nextActive ? "mengaktifkan" : "menonaktifkan"} produk ${productItem.name}?`,
      ))
    ) {
      return;
    }
    const nextForm: EditProductForm = {
      ...productToEditForm(productItem),
      isActive: nextActive,
      skus: productToEditForm(productItem).skus.map((item) => ({ ...item, isActive: nextActive })),
    };
    const success = await updateProduct(productItem.id, nextForm, {
      skipStatusConfirm: true,
      showSuccessToast: false,
    });
    if (!success) return;
    showToast({
      tone: "success",
      title: nextActive ? "Produk diaktifkan" : "Produk dinonaktifkan",
      description: productItem.name,
    });
  }

  return (
    <div className="space-y-6">
      {message === productOutletRequiredMessage ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{message}</p>
          </div>
        </div>
      ) : message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      {access.canCreate ? (
      <AdminModal
        open={isCreateOpen}
        title="Tambah Produk"
        description={hasOutletReady ? "Lengkapi identitas, gambar, harga, dan satuan produk." : "Selesaikan outlet pertama sebelum membuat produk."}
        size="xl"
        onClose={() => setIsCreateOpen(false)}
      >
          <form className="space-y-4" onSubmit={onSubmit}>
            {!hasOutletReady ? (
              <ProductSetupNotice
                icon={Building2}
                title="Outlet belum siap"
                description="Produk membutuhkan outlet untuk katalog, stok awal, dan tampilan kasir."
                actionHref="/admin/outlets?setup=first-run"
                actionLabel="Buat Outlet"
              />
            ) : !hasAnyUnit ? (
              <ProductSetupNotice
                icon={Ruler}
                title="Satuan belum dibuat"
                description="Buat minimal satu satuan, lalu pilih satuan stok dan satuan jual sebelum menyimpan produk."
                actionHref="/admin/units"
                actionLabel="Buat Satuan"
              />
            ) : !hasUnitSelection ? (
              <ProductSetupNotice
                icon={Ruler}
                title="Satuan belum dipilih"
                description="Pilih satuan stok dan satuan jual yang sesuai dengan tipe jual produk."
              />
            ) : null}
            <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
              <ProductCreatePreview form={form} saleUnitCode={unitCode(form.saleUnitId)} baseUnitCode={unitCode(form.baseUnitId)} />
              <div className="space-y-4">
                <div className="rounded-xl border bg-background p-4">
                  <FormSectionHeading icon={Ruler} title="Pilih Cara Jual" />
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <ProductTemplateButton active={createTemplate === "pack_weight"} title="Kemasan Berat" description="Keripik 250g dijual per pack" onClick={() => applyCreateTemplate("pack_weight")} />
                    <ProductTemplateButton active={createTemplate === "weight"} title="Berat Curah" description="Gula dijual per kg atau ons" onClick={() => applyCreateTemplate("weight")} />
                    <ProductTemplateButton active={createTemplate === "count"} title="Pcs / Satuan" description="Roti dijual per pcs" onClick={() => applyCreateTemplate("count")} />
                    <ProductTemplateButton active={createTemplate === "non_stock"} title="Non-stok" description="Jasa atau biaya tambahan" onClick={() => applyCreateTemplate("non_stock")} />
                  </div>
                </div>

                <div className="rounded-xl border bg-background p-4">
                  <FormSectionHeading icon={Building2} title="Identitas Produk" />
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <Field label="Nama Produk" value={form.name} placeholder="Contoh: Keripik Pisang" helperText="Nama induk produk. Ukuran kemasan masuk ke nama varian." onChange={(value) => setForm({ ...form, name: value })} />
                    <CategoryField
                      id="product-category"
                      label="Kategori"
                      value={form.category}
                      categories={categories}
                      onChange={(value) => setForm({ ...form, category: value })}
                    />
                    <Field label="Nama Varian Awal" value={form.skuName} placeholder={form.name ? `${form.name} 250g` : "Contoh: Keripik Pisang 250g"} helperText="Contoh: 250g, 500g, original, pedas. Struk memakai nama ini + satuan jual." onChange={(value) => setForm({ ...form, skuName: value })} />
                    <Field label="Barcode" value={form.barcode} placeholder="Opsional, isi bila ada barcode fisik" onChange={(value) => setForm({ ...form, barcode: value })} />
                  </div>
                </div>

                <div className="rounded-xl border bg-background p-4">
                  <FormSectionHeading icon={ImageIcon} title="Gambar" />
                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <ProductImageField
                      label="Foto Produk Utama"
                      value={form.imageUrl}
                      compact
                      onChange={(value) => setForm({ ...form, imageUrl: value })}
                      onError={(error) => {
                        setMessage(error);
                        showToast({ tone: "error", title: "Foto produk gagal diproses", description: error });
                      }}
                    />
                    <ProductImageField
                      label="Foto Varian"
                      value={form.skuImageUrl}
                      compact
                      onChange={(value) => setForm({ ...form, skuImageUrl: value })}
                      onError={(error) => {
                        setMessage(error);
                        showToast({ tone: "error", title: "Foto varian gagal diproses", description: error });
                      }}
                    />
                  </div>
                </div>

                <div className="rounded-xl border bg-background p-4">
                  <FormSectionHeading icon={Ruler} title="Satuan, Kemasan, dan Stok" />
                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4 xl:items-start">
                <SelectField
                  label="Tipe Jual"
                  value={form.productType}
                  options={productTypeOptions}
                  onChange={(value) => {
                    const productType = value as UnitKind;
                    setForm((current) => ({
                      ...current,
                      ...normalizeUnitSelection(units, {
                        ...current,
                        productType,
                        baseUnitId: "",
                        saleUnitId: "",
                      }),
                    }));
                  }}
                />
                <SelectField
                  label={createTemplate === "count" || createTemplate === "non_stock" ? "Satuan" : "Satuan dasar stok"}
                  value={form.baseUnitId}
                  options={createBaseUnitOptions}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      baseUnitId: value,
                      saleUnitId: createTemplate === "count" || createTemplate === "non_stock" ? value : current.saleUnitId,
                      saleUnitToBaseFactor: createTemplate === "count" || createTemplate === "non_stock" ? "1" : (createTemplate === "pack_weight" ? current.saleUnitToBaseFactor : conversionInput(units, value, current.saleUnitId)),
                    }))
                  }
                />
                {createTemplate !== "count" && createTemplate !== "non_stock" ? (
                  <SelectField
                    label="Satuan jual"
                    value={form.saleUnitId}
                    options={createSaleUnitOptions}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        saleUnitId: value,
                        saleUnitToBaseFactor: createTemplate === "pack_weight" ? current.saleUnitToBaseFactor : conversionInput(units, current.baseUnitId, value),
                      }))
                    }
                  />
                ) : null}
                {createTemplate !== "count" && createTemplate !== "non_stock" ? (
                  <Field
                    label={createTemplate === "pack_weight" ? `Isi per ${unitCode(form.saleUnitId)}` : "Konversi stok"}
                    numeric
                    value={form.saleUnitToBaseFactor}
                    helperText={createTemplate === "pack_weight" ? `Contoh: 250 berarti 1 ${unitCode(form.saleUnitId)} berisi 250 ${unitCode(form.baseUnitId)}.` : `1 ${unitCode(form.saleUnitId)} = ... ${unitCode(form.baseUnitId)}`}
                    onChange={(value) => setForm({ ...form, saleUnitToBaseFactor: value })}
                  />
                ) : null}
                <div className="rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground md:col-span-2 xl:col-span-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <UnitSummaryTile label="Tampil struk" value={`${displayVariantName(form)} - ${unitCode(form.saleUnitId)}`} />
                    <UnitSummaryTile label="Potong stok" value={form.trackInventory ? conversionSummary(form.saleUnitToBaseFactor, unitCode(form.baseUnitId), unitCode(form.saleUnitId)) : "Tidak potong stok"} />
                    <UnitSummaryTile label="Tipe" value={unitKindDescription(form.productType)} />
                  </div>
                </div>
                <label className="flex items-start gap-3 rounded-lg border bg-[#F6FBF8] px-3 py-3 text-sm md:col-span-2 xl:col-span-4">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-primary"
                    checked={!form.trackInventory}
                    onChange={(event) => setForm({
                      ...form,
                      trackInventory: !event.target.checked,
                      quantityMode: "required",
                      minStockBaseQty: event.target.checked ? "0" : form.minStockBaseQty,
                    })}
                  />
                  <span>
                    <span className="block font-medium text-foreground">Non-stok</span>
                    <span className="text-muted-foreground">Tidak muncul di kontrol stok, tidak memotong inventory, dan qty tetap bisa lebih dari 1.</span>
                  </span>
                </label>
                {!hasSelectableUnit ? (
                  <p className="text-sm text-muted-foreground xl:col-span-4">
                    Satuan untuk tipe ini belum ada. <Link className="font-medium text-primary hover:underline" href="/admin/units">Klik di sini</Link> untuk membuat satuan.
                  </p>
                ) : null}
                  </div>
                </div>

                <div className="rounded-xl border bg-background p-4">
                  <FormSectionHeading icon={Search} title="Harga & Kode" />
                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <Field label="Harga Jual" numeric value={form.price} onChange={(value) => setForm({ ...form, price: value })} />
                    <Field label="Harga Beli (Modal)" numeric value={form.cost} helperText="Harga beli per satuan stok. Digunakan untuk menghitung laba kotor." onChange={(value) => setForm({ ...form, cost: value })} />
                    <Field
                      label={`Stok Minimum (${unitCode(form.baseUnitId)})`}
                      numeric
                      helperText="Sistem akan memberi notifikasi saat stok di bawah angka ini. Isi 0 bila tidak perlu."
                      readOnly={!form.trackInventory}
                      value={form.trackInventory ? form.minStockBaseQty : "0"}
                      onChange={(value) => setForm({ ...form, minStockBaseQty: value })}
                    />
                    <CodeInput label="Kode SKU" value={form.sku} prefix="PRD" onChange={(value) => setForm({ ...form, sku: value })} helperText="Opsional. Kosongkan bila tidak perlu kode manual." />
                    <Field
                      label="Maks Pembatalan (jam)"
                      numeric
                      value={form.voidWindowHours}
                      onChange={(value) => setForm({ ...form, voidWindowHours: value })}
                    />
                    <Field
                      label="Maks Retur/Pengembalian Dana (jam)"
                      numeric
                      value={form.refundWindowHours}
                      onChange={(value) => setForm({ ...form, refundWindowHours: value })}
                    />
                  </div>
                  <ProductNote tone="sky" className="mt-4">
                    Kode SKU dipakai untuk pencarian kasir, laporan, dan audit stok. Barcode terpisah; isi hanya jika produk punya barcode fisik.
                  </ProductNote>
                </div>
              </div>
            </div>
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
            {!canSubmitProduct ? (
              <p className="text-sm text-muted-foreground">
                Simpan produk aktif setelah outlet dan satuan produk siap.
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting}><X className="h-4 w-4" />Batal</Button>
              <Button type="submit" disabled={!canSubmitProduct}><Plus className="h-4 w-4" />{isSubmitting ? "Menyimpan" : "Simpan"}</Button>
            </div>
          </form>
      </AdminModal>
      ) : null}

      <CollapsibleSection
        title="Daftar Produk"
        description="Produk dan varian dipakai untuk katalog kasir, harga, stok minimum, dan laporan penjualan."
        showDescription
        isLoading={isLoading}
        loadingText="Memuat daftar produk dan satuan..."
        actions={access.canCreate ? <ProductIconButton type="button" onClick={() => setIsCreateOpen(true)} aria-label="Tambah produk" title="Tambah produk"><Plus className="h-4 w-4" /></ProductIconButton> : null}
      >
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="flex flex-col gap-3 border-b px-4 py-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>Show</span>
                <select className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
                  {[5, 10, 20, 50, 100].map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
                <span>entries</span>
                <select className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}>
                  <option value="all">Semua</option>
                  <option value="active">Aktif</option>
                  <option value="inactive">Nonaktif</option>
                </select>
                <select className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1); }}>
                  <option value="all">Semua kategori</option>
                  {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div className="relative md:w-80">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input className="h-11 rounded-lg pl-11" value={search} placeholder="Search..." onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
              </div>
            </div>
            <div className="thin-x-scroll overflow-x-auto">
              <table className="min-w-[960px] table-fixed border-collapse text-sm">
                <colgroup>
                  <col className="w-12" />
                  <col className="w-[340px]" />
                  <col className="w-[160px]" />
                  <col className="w-[150px]" />
                  <col className="w-[116px]" />
                  <col className="w-[72px]" />
                  <col className="w-[130px]" />
                </colgroup>
                <thead className="border-b bg-background text-xs font-semibold text-foreground">
                  <tr>
                    <th className="px-4 py-3" aria-label="Detail" />
                    <th className="px-4 py-3 text-left"><button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setSortBy(sortBy === "name-asc" ? "name-desc" : "name-asc")}>Produk <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" /></button></th>
                    <th className="px-4 py-3 text-left"><button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setSortBy("category-asc")}>Kategori <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" /></button></th>
                    <th className="px-4 py-3 text-left"><button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setSortBy(sortBy === "price-desc" ? "price-asc" : "price-desc")}>Harga <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" /></button></th>
                    <th className="px-4 py-3 text-left">Varian</th>
                    <th className="px-4 py-3 text-left"><button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setSortBy("status")}>Status <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" /></button></th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="bg-background">
            {pagedProducts.map((item) => {
              const expanded = expandedProductId === item.id;
              const activeSkus = item.skus.filter((skuItem) => skuItem.isActive).length;
              return (
                <Fragment key={item.id}>
                  <tr className="border-b text-sm last:border-b-0">
                    <td className="px-4 py-3 align-middle">
                      <ProductIconButton type="button" variant="ghost" compact className="text-slate-600 hover:bg-slate-100 hover:text-slate-800" onClick={() => setExpandedProductId(expanded ? null : item.id)} aria-label={`${expanded ? "Tutup" : "Lihat"} detail ${item.name}`} title={expanded ? "Tutup detail" : "Lihat detail"}>
                        <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`} />
                      </ProductIconButton>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex min-w-0 items-center gap-3">
                        <ProductThumb imageUrl={item.imageUrl} name={item.name} />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.name}</p>
                          <p className="truncate text-xs text-muted-foreground">Batal {correctionWindowLabel(item.voidWindowHours)} / Retur {correctionWindowLabel(item.refundWindowHours)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="truncate px-4 py-3 align-middle text-muted-foreground">{item.category || "Tanpa kategori"}</td>
                    <td className="px-4 py-3 align-middle font-medium">{priceRange(item.skus)}</td>
                    <td className="px-4 py-3 align-middle">
                      <div className="min-w-0">
                      <p className="font-medium">{item.skus.length.toLocaleString("id-ID")} varian</p>
                      <p className="truncate text-xs text-muted-foreground">{activeSkus.toLocaleString("id-ID")} aktif</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${item.isActive ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{item.isActive ? "Aktif" : "Nonaktif"}</span>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex justify-end gap-1">
                        {access.canEdit ? (
                        <>
                          <ProductIconButton type="button" variant="outline" compact className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800" onClick={() => startVariantCreate(item)} aria-label={`Tambah varian produk ${item.name}`} title="Tambah varian produk">
                            <Plus className="h-4 w-4" />
                          </ProductIconButton>
                          <ProductIconButton type="button" variant="outline" compact className="border-sky-200 text-sky-600 hover:bg-sky-50 hover:text-sky-700" onClick={() => startEdit(item)} aria-label={`Edit ${item.name}`} title="Edit">
                            <Edit3 className="h-4 w-4" />
                          </ProductIconButton>
                          <ProductIconButton type="button" variant="secondary" compact className={item.isActive ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"} onClick={() => void toggleProduct(item)} disabled={isUpdating} aria-label={`${item.isActive ? "Nonaktifkan" : "Aktifkan"} ${item.name}`} title={item.isActive ? "Nonaktifkan" : "Aktifkan"}>
                            {item.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                          </ProductIconButton>
                        </>
                      ) : null}
                      </div>
                    </td>
                  </tr>
                  {expanded ? (
                    <tr className="border-b bg-muted/15">
                      <td colSpan={7} className="px-4 py-3">
                      <div className="grid grid-cols-[minmax(0,1.5fr)_0.9fr_0.9fr_0.85fr_0.85fr_112px] gap-3 rounded-lg border bg-background px-3 py-2 text-xs font-semibold text-foreground">
                        <span>Varian</span>
                        <span>Harga</span>
                        <span>Stok Min</span>
                        <span>Satuan</span>
                        <span>Status</span>
                        <span className="text-right">Aksi</span>
                      </div>
                      <div className="divide-y rounded-b-lg border-x border-b bg-background">
                        {item.skus.map((skuItem) => {
                          const minStock = `${quantity(skuItem.minStockBaseQty)} ${skuItem.baseUnit?.code || unitCode(skuItem.baseUnitId)}`;
                          return (
                            <div key={skuItem.id} className="grid grid-cols-[minmax(0,1.5fr)_0.9fr_0.9fr_0.85fr_0.85fr_112px] gap-3 px-3 py-2 text-sm">
                              <div className="flex min-w-0 items-center gap-2">
                                <ProductThumb imageUrl={skuItem.imageUrl || item.imageUrl} name={skuItem.name} />
                                <div className="min-w-0">
                                  <p className="truncate font-medium">{skuItem.name}</p>
                                  <p className="truncate text-xs text-muted-foreground">{skuItem.sku}</p>
                                </div>
                              </div>
                              <p className="font-medium">{rupiah(skuItem.price)}</p>
                              <p className="truncate text-muted-foreground">{minStock}</p>
                              <p className="truncate text-muted-foreground">{skuItem.saleUnit?.code || unitCode(skuItem.saleUnitId)}</p>
                              <div>
                                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${skuItem.isActive ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{skuItem.isActive ? "Aktif" : "Nonaktif"}</span>
                              </div>
                              <div className="flex justify-end gap-1">
                                {access.canEdit ? (
                                  <>
                                    <ProductIconButton type="button" variant="outline" compact className="border-sky-200 text-sky-600 hover:bg-sky-50 hover:text-sky-700" onClick={() => startVariantEdit(item, skuItem)} aria-label={`Edit varian ${skuItem.name}`} title="Edit varian">
                                      <Edit3 className="h-4 w-4" />
                                    </ProductIconButton>
                                    <ProductIconButton type="button" variant="secondary" compact className={skuItem.isActive ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"} onClick={() => void toggleVariant(item, skuItem)} disabled={isUpdating} aria-label={`${skuItem.isActive ? "Nonaktifkan" : "Aktifkan"} varian ${skuItem.name}`} title={skuItem.isActive ? "Nonaktifkan" : "Aktifkan"}>
                                      {skuItem.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                                    </ProductIconButton>
                                  </>
                                ) : null}
                                {access.canDelete ? (
                                  <ProductIconButton type="button" variant="ghost" compact className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => void deleteVariant(item, skuItem)} disabled={isUpdating || item.skus.length <= 1} aria-label={`Hapus varian ${skuItem.name}`} title="Hapus varian">
                                    <Trash2 className="h-4 w-4" />
                                  </ProductIconButton>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
                {!visibleProducts.length ? <tr><td colSpan={7} className="px-4 py-6 text-sm text-muted-foreground">Data produk tidak ditemukan.</td></tr> : null}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t px-4 py-4 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-muted-foreground">Showing {visibleProducts.length ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, visibleProducts.length)} of {visibleProducts.length} entries</p>
              <div className="flex items-center gap-3">
                <ProductIconButton type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="Sebelumnya"><ChevronLeft className="h-4 w-4" /></ProductIconButton>
                <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-lg bg-primary/10 px-3 text-sm font-semibold text-primary">{page}</span>
                <ProductIconButton type="button" variant="outline" disabled={page >= Math.max(1, Math.ceil(visibleProducts.length / pageSize))} onClick={() => setPage((current) => Math.min(Math.max(1, Math.ceil(visibleProducts.length / pageSize)), current + 1))} aria-label="Berikutnya"><ChevronRight className="h-4 w-4" /></ProductIconButton>
              </div>
            </div>
          </div>
      </CollapsibleSection>
      <AdminModal
        open={Boolean(editingProductId && editForm)}
        title="Edit Produk"
        description="Ubah nama, kategori, foto, aturan pembatalan, dan status produk."
        size="xl"
        onClose={cancelEdit}
      >
        {editingProductId && editForm ? (
          <div className="space-y-4">
            <ProductImageField
              label="Foto Produk"
              value={editForm.imageUrl}
              onChange={(value) => setEditForm({ ...editForm, imageUrl: value })}
              onError={(error) => {
                setMessage(error);
                showToast({ tone: "error", title: "Foto produk gagal diproses", description: error });
              }}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nama Produk" value={editForm.name} onChange={(value) => setEditForm({ ...editForm, name: value })} />
              <CategoryField id={`edit-product-category-${editingProductId}`} label="Kategori" value={editForm.category} categories={categories} onChange={(value) => setEditForm({ ...editForm, category: value })} />
              <Field label="Maks Pembatalan (jam)" numeric value={editForm.voidWindowHours} onChange={(value) => setEditForm({ ...editForm, voidWindowHours: value })} />
              <Field label="Maks Retur/Pengembalian Dana (jam)" numeric value={editForm.refundWindowHours} onChange={(value) => setEditForm({ ...editForm, refundWindowHours: value })} />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={editForm.isActive} onChange={(event) => setEditForm({ ...editForm, isActive: event.target.checked })} />
                Produk aktif
              </label>
              <ProductNote tone="amber">
                Matikan ini kalau produk tidak dijual lagi. Varian bisa diatur dari detail daftar produk.
              </ProductNote>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={cancelEdit} disabled={isUpdating}><X className="h-4 w-4" />Batal</Button>
              <Button type="button" onClick={() => void updateProduct(editingProductId)} disabled={isUpdating}><Save className="h-4 w-4" />{isUpdating ? "Menyimpan" : "Simpan Perubahan"}</Button>
            </div>
          </div>
        ) : null}
      </AdminModal>
      <AdminModal
        open={Boolean(editingVariant)}
        title={editingVariant?.sku.isNew ? "Tambah Varian" : "Edit Varian"}
        description={editingVariant?.sku.isNew ? "Buat varian/SKU baru untuk produk ini." : "Ubah foto, nama, kode, harga, satuan, stok minimum, dan status varian."}
        size="xl"
        onClose={() => setEditingVariant(null)}
      >
        {editingVariant ? (
          <div className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
              <aside className="space-y-3 rounded-lg border bg-muted/20 p-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Preview Varian</p>
                  <p className="text-xs leading-5 text-muted-foreground">Tampilan yang dipakai kasir dan daftar produk.</p>
                </div>
                <div className="overflow-hidden rounded-lg border bg-background">
                  <div className="relative aspect-square bg-muted/40">
                    {editingVariant.sku.imageUrl ? (
                      <Image src={editingVariant.sku.imageUrl} alt={`Foto ${editingVariant.sku.name || editingVariant.product.name}`} fill unoptimized className="object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <ImageIcon className="h-12 w-12" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 p-3">
                    <p className="line-clamp-2 text-sm font-semibold text-foreground">{editingVariant.sku.name || "Nama varian belum diisi"}</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-md border bg-background px-2 py-1 text-muted-foreground">SKU {editingVariant.sku.sku || "-"}</span>
                      <span className="rounded-md border bg-background px-2 py-1 text-muted-foreground">{unitCode(editingVariant.sku.saleUnitId)}</span>
                    </div>
                    <p className="text-base font-bold text-foreground">{rupiah(parseIndonesianNumber(editingVariant.sku.price || "0"))}</p>
                  </div>
                </div>
                <ProductImageField
                  label="Foto Varian"
                  value={editingVariant.sku.imageUrl ?? ""}
                  compact
                  onChange={(value) => setEditingVariant({ ...editingVariant, sku: { ...editingVariant.sku, imageUrl: value || null } })}
                  onError={(error) => {
                    setMessage(error);
                    showToast({ tone: "error", title: "Foto varian gagal diproses", description: error });
                  }}
                />
              </aside>

              <div className="space-y-4">
                <section className="rounded-lg border bg-background p-4">
                  <div className="mb-4 flex flex-col gap-1">
                    <h3 className="text-sm font-semibold text-foreground">Identitas Varian</h3>
                    <p className="text-xs text-muted-foreground">Ukuran kemasan ditulis di nama varian; satuan tetap memakai kode seperti pack, g, ons, kg.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Nama Varian" value={editingVariant.sku.name} placeholder={`${editingVariant.product.name} 250g`} helperText="Contoh: 250g, 500g, original, pedas. Struk memakai nama ini + satuan jual." onChange={(value) => setEditingVariant({ ...editingVariant, sku: { ...editingVariant.sku, name: value } })} />
                    <CodeInput label="Kode SKU" value={editingVariant.sku.sku} prefix="PRD" showRandomButton={Boolean(editingVariant.sku.isNew)} helperText="Kode internal untuk kasir, laporan, dan pencarian." onChange={(value) => setEditingVariant({ ...editingVariant, sku: { ...editingVariant.sku, sku: value } })} />
                    <Field label="Barcode" value={editingVariant.sku.barcode ?? ""} onChange={(value) => setEditingVariant({ ...editingVariant, sku: { ...editingVariant.sku, barcode: value } })} />
                    <SelectField label="Tipe Jual" value={editingVariant.sku.productType} options={productTypeOptions} onChange={(value) => {
                      const productType = value as UnitKind;
                      const normalized = normalizeUnitSelection(units, { ...editingVariant.sku, productType, baseUnitId: "", saleUnitId: "" });
                      setEditingVariant({ ...editingVariant, sku: { ...editingVariant.sku, ...normalized } });
                    }} />
                  </div>
                </section>

                <section className="rounded-lg border bg-background p-4">
                  <div className="mb-4 flex flex-col gap-1">
                    <h3 className="text-sm font-semibold text-foreground">Harga, Satuan, dan Konversi Stok</h3>
                    <p className="text-xs text-muted-foreground">Pack 250g dan 500g tetap tampil pack; ukuran dibedakan dari nama varian.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 xl:items-start">
                    <Field label="Harga Jual" numeric value={editingVariant.sku.price} onChange={(value) => setEditingVariant({ ...editingVariant, sku: { ...editingVariant.sku, price: value } })} />
                    <Field label="Harga Beli (Modal)" numeric value={editingVariant.sku.cost} onChange={(value) => setEditingVariant({ ...editingVariant, sku: { ...editingVariant.sku, cost: value } })} />
                    <Field label={`Stok Minimum (${unitCode(editingVariant.sku.baseUnitId)})`} numeric readOnly={!editingVariant.sku.trackInventory} value={editingVariant.sku.trackInventory ? editingVariant.sku.minStockBaseQty : "0"} onChange={(value) => setEditingVariant({ ...editingVariant, sku: { ...editingVariant.sku, minStockBaseQty: value } })} />
                    <SelectField label="Satuan dasar stok" value={editingVariant.sku.baseUnitId} options={unitOptionsForKind(units, editingVariant.sku.productType, [editingVariant.sku.baseUnitId])} onChange={(value) => setEditingVariant({ ...editingVariant, sku: { ...editingVariant.sku, baseUnitId: value, saleUnitToBaseFactor: conversionInput(units, value, editingVariant.sku.saleUnitId) } })} />
                    <SelectField label="Satuan jual" value={editingVariant.sku.saleUnitId} options={unitOptionsForKind(units, editingVariant.sku.productType, [editingVariant.sku.saleUnitId])} onChange={(value) => setEditingVariant({ ...editingVariant, sku: { ...editingVariant.sku, saleUnitId: value, saleUnitToBaseFactor: conversionInput(units, editingVariant.sku.baseUnitId, value) } })} />
                    <Field label="Konversi ke Stok" numeric value={editingVariant.sku.saleUnitToBaseFactor} onChange={(value) => setEditingVariant({ ...editingVariant, sku: { ...editingVariant.sku, saleUnitToBaseFactor: value } })} />
                    <div className="rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground xl:col-span-3">
                      <div className="grid gap-3 md:grid-cols-3">
                        <UnitSummaryTile label="Tampil struk" value={`${editingVariant.sku.name || editingVariant.product.name} - ${unitCode(editingVariant.sku.saleUnitId)}`} />
                        <UnitSummaryTile label="Potong stok" value={editingVariant.sku.trackInventory ? conversionSummary(editingVariant.sku.saleUnitToBaseFactor, unitCode(editingVariant.sku.baseUnitId), unitCode(editingVariant.sku.saleUnitId)) : "Tidak potong stok"} />
                        <UnitSummaryTile label="Tipe" value={unitKindDescription(editingVariant.sku.productType)} />
                      </div>
                    </div>
                    <label className="flex items-start gap-3 rounded-lg border bg-[#F6FBF8] px-3 py-3 text-sm xl:col-span-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 accent-primary"
                        checked={!editingVariant.sku.trackInventory}
                        onChange={(event) => setEditingVariant({
                          ...editingVariant,
                          sku: {
                            ...editingVariant.sku,
                            trackInventory: !event.target.checked,
                            quantityMode: "required",
                            minStockBaseQty: event.target.checked ? "0" : editingVariant.sku.minStockBaseQty,
                          },
                        })}
                      />
                      <span>
                        <span className="block font-medium text-foreground">Non-stok</span>
                        <span className="text-muted-foreground">Tidak dicek stok, tidak memotong inventory, dan qty tetap bisa lebih dari 1.</span>
                      </span>
                    </label>
                  </div>
                </section>

                <section className="flex flex-col gap-3 rounded-lg border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Status Kasir</p>
                    <p className="mt-1 text-xs text-muted-foreground">Nonaktifkan varian jika tidak dijual, tanpa menghapus histori stok/transaksi.</p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" checked={editingVariant.sku.isActive} onChange={(event) => setEditingVariant({ ...editingVariant, sku: { ...editingVariant.sku, isActive: event.target.checked } })} />
                    Varian aktif
                  </label>
                </section>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <ProductNote tone="sky">
                Delete hanya untuk varian yang belum punya histori. Untuk varian lama, gunakan nonaktif.
              </ProductNote>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditingVariant(null)} disabled={isUpdating}><X className="h-4 w-4" />Batal</Button>
                <Button type="button" onClick={() => void saveVariantEdit()} disabled={isUpdating}><Save className="h-4 w-4" />{isUpdating ? "Menyimpan" : editingVariant.sku.isNew ? "Simpan Varian Baru" : "Simpan Varian"}</Button>
              </div>
            </div>
          </div>
        ) : null}
      </AdminModal>
    </div>
  );
}

function ProductThumb(props: { imageUrl?: string | null; name: string }) {
  if (props.imageUrl) {
    return (
      <Image
        src={props.imageUrl}
        alt={`Foto ${props.name}`}
        width={40}
        height={40}
        unoptimized
        className="h-10 w-10 shrink-0 rounded-lg border bg-muted object-cover"
      />
    );
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
      <ImageIcon className="h-5 w-5" />
    </div>
  );
}

function ProductCreatePreview(props: { form: typeof initialForm; saleUnitCode: string; baseUnitCode: string }) {
  const productName = props.form.name.trim() || "Nama produk";
  const variantName = displayVariantName(props.form);
  const category = props.form.category.trim() || "Tanpa kategori";
  const imageUrl = props.form.imageUrl || props.form.skuImageUrl;
  const skuCode = props.form.sku.trim().toUpperCase() || "Auto";
  const saleUnitCode = props.saleUnitCode || "unit";
  const baseUnitCode = props.baseUnitCode || "unit";
  const price = parseIndonesianNumber(props.form.price || "0");

  return (
    <aside className="h-fit rounded-xl border bg-[#F6FBF8] p-4 shadow-sm lg:sticky lg:top-4">
      <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
        {imageUrl ? (
          <Image src={imageUrl} alt={`Preview ${productName}`} width={480} height={360} unoptimized className="aspect-[4/3] w-full object-cover" />
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted text-muted-foreground">
            <ImageIcon className="h-10 w-10" />
          </div>
        )}
        <div className="space-y-3 p-4">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">{productName}</p>
            <p className="truncate text-sm text-muted-foreground">{variantName}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-lg border bg-background px-2 py-1 text-muted-foreground">{category}</span>
            <span className="rounded-lg border bg-background px-2 py-1 text-muted-foreground">SKU {skuCode}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs text-muted-foreground">Harga</p>
              <p className="mt-1 font-semibold">{rupiah(price)}</p>
            </div>
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs text-muted-foreground">Satuan jual</p>
              <p className="mt-1 font-semibold">{saleUnitCode}</p>
            </div>
          </div>
          <div className="rounded-lg border border-dashed bg-[#F9FAFB] p-3 font-mono text-xs text-slate-700">
            <div className="mb-2 text-center font-semibold text-slate-900">PREVIEW STRUK</div>
            <div className="border-t border-dashed pt-2">
              <p className="break-words">{variantName}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span>1 {saleUnitCode} x {rupiah(price)}</span>
                <span>{rupiah(price)}</span>
              </div>
            </div>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            {props.form.trackInventory
              ? conversionSummary(props.form.saleUnitToBaseFactor, baseUnitCode, saleUnitCode)
              : "Produk non-stok tidak memotong inventory."}
          </p>
        </div>
      </div>
    </aside>
  );
}

function UnitSummaryTile(props: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border bg-[#F6FBF8] px-3 py-2">
      <p className="truncate text-xs font-medium text-[#1D3557]/70">{props.label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-[#1D3557]">{props.value}</p>
    </div>
  );
}

function ProductImageField(props: {
  label: string;
  value: string;
  compact?: boolean;
  onChange: (value: string) => void;
  onError: (message: string) => void;
}) {
  const urlInputValue = isUploadedProductImageUrl(props.value) ? "" : props.value;
  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    await uploadProductImageFromInput(event, props.onChange, props.onError);
  }

  if (props.compact) {
    return (
      <div className="rounded-lg border border-dashed bg-background p-3">
        <div className="mb-3 space-y-1">
          <Label>{props.label}</Label>
          <p className="text-xs leading-5 text-muted-foreground">Upload dari device atau tempel URL manual.</p>
        </div>
        <div className="grid gap-2">
          <label className="flex min-h-16 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border bg-muted/30 px-3 py-4 text-center text-sm font-medium transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-background shadow-sm">
              <Upload className="h-4 w-4" />
            </span>
            <span>{props.value ? "Ganti Foto" : "Upload Foto"}</span>
            <span className="text-xs font-normal text-muted-foreground">JPG/PNG/WebP/GIF maks 5 MB</span>
            <input type="file" accept="image/*" className="sr-only" onChange={onFileChange} />
          </label>
          {props.value ? (
            <Button type="button" variant="outline" className="h-9 justify-center border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => props.onChange("")}> 
              <Trash2 className="h-4 w-4" />
              Hapus Foto
            </Button>
          ) : null}
        </div>
        <div className="mt-3 space-y-2">
          <Label>URL Foto Manual</Label>
          <Input value={urlInputValue} placeholder="Opsional: tempel URL gambar" onChange={(event) => props.onChange(event.target.value)} />
          {isUploadedProductImageUrl(props.value) ? (
            <p className="text-xs text-muted-foreground">Foto dari upload device. URL manual tidak ditampilkan.</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-background p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {props.value ? (
            <Image src={props.value} alt="Preview produk" width={64} height={64} unoptimized className={`${props.compact ? "h-12 w-12" : "h-16 w-16"} shrink-0 rounded-xl border bg-muted object-cover`} />
          ) : (
            <div className={`flex ${props.compact ? "h-12 w-12" : "h-16 w-16"} shrink-0 items-center justify-center rounded-xl border bg-muted text-muted-foreground`}>
              <ImageIcon className="h-7 w-7" />
            </div>
          )}
          <div className="min-w-0">
            <Label>{props.label}</Label>
            <p className="mt-1 text-xs text-muted-foreground">Upload JPG/PNG/WebP/GIF maksimal 5 MB. Gambar dikompres otomatis.</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-muted">
            <Upload className="h-4 w-4" />
            Upload
            <input type="file" accept="image/*" className="sr-only" onChange={onFileChange} />
          </label>
          {props.value ? (
            <ProductIconButton type="button" variant="ghost" compact className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => props.onChange("")} aria-label="Hapus foto produk" title="Hapus foto produk">
              <Trash2 className="h-4 w-4" />
            </ProductIconButton>
          ) : null}
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <Label>URL Foto</Label>
        <Input value={urlInputValue} placeholder="Opsional: tempel URL gambar" onChange={(event) => props.onChange(event.target.value)} />
        {isUploadedProductImageUrl(props.value) ? (
          <p className="text-xs text-muted-foreground">Foto ini dari upload device. URL manual dikosongkan.</p>
        ) : null}
      </div>
    </div>
  );
}

function isUploadedProductImageUrl(value: string) {
  return value.startsWith("/api/uploads/product-images") || value.startsWith("/api/uploads/images");
}

async function uploadProductImageFromInput(
  event: ChangeEvent<HTMLInputElement>,
  onChange: (value: string) => void,
  onError: (message: string) => void,
) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  try {
    const compressed = await compressProductImage(file);
    const compressedFile = dataUrlToFile(compressed, "product.jpg");
    const formData = new FormData();
    formData.append("scope", "products");
    formData.append("file", compressedFile);
    const response = await fetch("/api/uploads/images", {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      onError(await readApiError(response, "Upload foto produk gagal."));
      return;
    }
    const json = (await response.json()) as ApiResponse<UploadResponse>;
    onChange(json.data.url);
  } catch (error) {
    onError(error instanceof Error ? error.message : "Foto produk gagal diproses.");
  }
}

function dataUrlToFile(dataUrl: string, fileName: string) {
  const [meta, content] = dataUrl.split(",");
  const mime = meta.match(/data:(.*?);base64/)?.[1] || "image/jpeg";
  const binary = window.atob(content ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new File([bytes], fileName, { type: mime });
}

function ProductNote(props: {
  children: ReactNode;
  tone: "amber" | "sky";
  className?: string;
}) {
  const toneClass =
    props.tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-sky-200 bg-sky-50 text-sky-800";
  return (
    <p className={`rounded-lg border px-3 py-2 text-sm leading-5 ${toneClass} ${props.className ?? ""}`}>
      {props.children}
    </p>
  );
}

function ProductTemplateButton(props: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`min-h-[92px] rounded-lg border px-3 py-3 text-left transition hover:border-primary/60 hover:bg-primary/5 ${
        props.active ? "border-primary bg-primary/10 text-primary shadow-sm" : "bg-background text-foreground"
      }`}
    >
      <span className="block text-sm font-semibold">{props.title}</span>
      <span className="mt-1 block text-xs leading-5 text-muted-foreground">{props.description}</span>
    </button>
  );
}

function ProductSetupNotice(props: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  const Icon = props.icon;
  return (
    <div className="rounded-lg border border-[#A8DADC] bg-[#F6FBF8] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1D3557] text-white">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-[#1D3557]">{props.title}</p>
            <p className="mt-1 text-sm leading-6 text-[#1D3557]/75">
              {props.description}
            </p>
          </div>
        </div>
        {props.actionHref && props.actionLabel ? (
          <Button asChild type="button" variant="outline" className="shrink-0 bg-white">
            <Link href={props.actionHref}>
              <Building2 className="h-4 w-4" />
              {props.actionLabel}
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  type?: string;
  numeric?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  helperText?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="flex min-h-5 items-end leading-5">{props.label}</Label>
      <Input
        type={props.type ?? "text"}
        inputMode={props.numeric ? "decimal" : undefined}
        value={props.value}
        readOnly={props.readOnly}
        placeholder={props.placeholder}
        onChange={(event) =>
          props.onChange(
            props.numeric
              ? event.target.value.trim()
                ? formatNumberInput(event.target.value)
                : ""
              : event.target.value,
          )
        }
      />
      {props.helperText ? <p className="text-xs leading-5 text-muted-foreground">{props.helperText}</p> : null}
    </div>
  );
}

function FormSectionHeading(props: { icon: ComponentType<{ className?: string }>; title: string }) {
  const Icon = props.icon;
  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      {props.title}
    </div>
  );
}

function CategoryField(props: {
  id: string;
  label: string;
  value: string;
  categories: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="flex min-h-5 items-end leading-5">{props.label}</Label>
      <Input
        list={`${props.id}-options`}
        value={props.value}
        placeholder="Pilih atau ketik kategori baru"
        onChange={(event) => props.onChange(event.target.value)}
      />
      <datalist id={`${props.id}-options`}>
        {props.categories.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>
    </div>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="flex min-h-5 items-end leading-5">{props.label}</Label>
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

function unitKindLabel(kind: UnitKind) {
  const labels: Record<UnitKind, string> = {
    weight: "Berat",
    count: "Pcs / Satuan",
    package: "Kemasan",
  };
  return labels[kind];
}

function unitKindDescription(kind: UnitKind) {
  const descriptions: Record<UnitKind, string> = {
    weight: "Produk dijual berdasarkan berat seperti gram atau kilogram.",
    count: "Produk dijual berdasarkan jumlah seperti pcs.",
    package: "Produk dijual sebagai kemasan seperti pack atau pouch.",
  };
  return descriptions[kind];
}

function unitOptionsForKind(units: Unit[], kind: UnitKind, includeUnitIds: string[] = []) {
  return units
    .filter((unit) => (unit.isActive && unit.kind === kind) || includeUnitIds.includes(unit.id))
    .map((unit) => ({
      value: unit.id,
      label: `${unit.name} (${unit.code})${unit.isActive ? "" : " - nonaktif"}`,
    }));
}

function unitKindForUnit(units: Unit[], unitId: string) {
  return units.find((unit) => unit.id === unitId)?.kind;
}

function preferredUnitId(units: Unit[], kind: UnitKind, preferredCodes: string[]) {
  const activeUnits = units.filter((unit) => unit.isActive && unit.kind === kind);
  const preferred = activeUnits.find((unit) => preferredCodes.includes(unit.code.trim().toLowerCase()));
  return preferred?.id ?? activeUnits[0]?.id ?? "";
}

function normalizeUnitSelection<T extends { productType: UnitKind; baseUnitId: string; saleUnitId: string }>(
  units: Unit[],
  current: T,
) {
  const kindUnits = units.filter((unit) => unit.isActive && unit.kind === current.productType);
  if (!kindUnits.length) {
    return {
      productType: current.productType,
      baseUnitId: "",
      saleUnitId: "",
      saleUnitToBaseFactor: "1",
    };
  }
  const fallbackKind = current.productType;
  const options = kindUnits;
  const baseUnitId = options.some((unit) => unit.id === current.baseUnitId)
    ? current.baseUnitId
    : options[0]?.id ?? "";
  const saleUnitId = options.some((unit) => unit.id === current.saleUnitId)
    ? current.saleUnitId
    : baseUnitId;

  return {
    productType: fallbackKind,
    baseUnitId,
    saleUnitId,
    saleUnitToBaseFactor: conversionInput(units, baseUnitId, saleUnitId),
  };
}

function conversionInput(units: Unit[], baseUnitId: string, saleUnitId: string) {
  const baseUnit = units.find((unit) => unit.id === baseUnitId);
  const saleUnit = units.find((unit) => unit.id === saleUnitId);
  if (!baseUnit || !saleUnit || baseUnit.kind !== saleUnit.kind) {
    return "1";
  }
  const baseFactor = Number(baseUnit.toBaseFactor || 1);
  const saleFactor = Number(saleUnit.toBaseFactor || 1);
  const factor = baseFactor > 0 ? saleFactor / baseFactor : 1;
  return factor.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  });
}

function displayVariantName(form: typeof initialForm) {
  return form.skuName.trim() || form.name.trim() || "Nama varian";
}

function conversionSummary(factorInput: string, baseUnitCode: string, saleUnitCode: string) {
  const factor = parseIndonesianNumber(factorInput || "1");
  const safeFactor = Number.isFinite(factor) && factor > 0 ? factor : 1;
  return `1 ${saleUnitCode || "unit"} = ${safeFactor.toLocaleString("id-ID", { maximumFractionDigits: 6 })} ${baseUnitCode || "unit"}`;
}

function parseIndonesianNumber(value: string) {
  return Number(value.replace(/\./g, "").replace(",", "."));
}

function validNumber(value: string) {
  return Number.isFinite(parseIndonesianNumber(value));
}

function validateEditProductForm(form: EditProductForm) {
  if (!form.name.trim()) return "Nama produk wajib diisi.";
  if (!form.skus.length) return "Produk wajib punya minimal 1 varian.";
  const seenBarcodes = new Set<string>();
  for (const [index, item] of form.skus.entries()) {
    const label = `Varian ${index + 1}`;
    const skuCode = item.sku.trim().toUpperCase();
    const barcode = (item.barcode ?? "").trim().toUpperCase();
    if (!skuCode) return `${label}: kode SKU wajib diisi.`;
    if (!item.name.trim()) return `${label}: nama varian wajib diisi.`;
    if (!item.baseUnitId) return `${label}: satuan stok wajib dipilih.`;
    if (!item.saleUnitId) return `${label}: satuan jual kasir wajib dipilih.`;
    if (!validNumber(item.saleUnitToBaseFactor) || parseIndonesianNumber(item.saleUnitToBaseFactor) <= 0) return `${label}: faktor konversi harus lebih dari 0.`;
    if (!validNumber(item.price) || parseIndonesianNumber(item.price) < 0) return `${label}: harga tidak boleh negatif.`;
    if (!validNumber(item.cost) || parseIndonesianNumber(item.cost) < 0) return `${label}: HPP tidak boleh negatif.`;
    if (!validNumber(item.minStockBaseQty) || parseIndonesianNumber(item.minStockBaseQty) < 0) return `${label}: stok minimum tidak boleh negatif.`;
    if (barcode) {
      if (seenBarcodes.has(barcode)) return `${label}: barcode duplikat.`;
      seenBarcodes.add(barcode);
    }
  }
  return null;
}

function optionalInteger(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return Math.max(0, Math.floor(parseIndonesianNumber(trimmed)));
}

function optionalNumberForInput(value: number | null) {
  return formatNumberForInput(value ?? 0);
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

function formatNumberForInput(value: string | number) {
  return Number(value ?? 0).toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function rupiah(value: string | number) {
  return `Rp ${formatNumber(value, 0)}`;
}

function priceRange(skus: Product["skus"]) {
  if (!skus.length) return "-";
  const prices = skus.map((item) => Number(item.price ?? 0));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? rupiah(min) : `${rupiah(min)} - ${rupiah(max)}`;
}

function quantity(value: string | number) {
  return formatNumber(value, 3);
}

function formatNumber(value: string | number, maximumFractionDigits: number) {
  return Number(value ?? 0).toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
}

function correctionWindowLabel(value: number | null) {
  if (value === null) return "tidak dibatasi";
  if (value <= 0) return "nonaktif";
  if (value % 24 === 0) return `${value / 24} hari`;
  return `${value} jam`;
}
