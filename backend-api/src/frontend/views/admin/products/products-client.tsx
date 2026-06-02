"use client";

import { useEffect, useMemo, useState } from "react";
import { Edit3, Plus, Power, PowerOff, RefreshCw, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CollapsibleSection } from "../_components/collapsible-section";
import { ListControls } from "../_components/list-controls";
import { PaginationControls, pageItems } from "../_components/pagination-controls";
import { confirmAction, useToast } from "../_components/toast-provider";
import { useRolePermissions } from "../_components/use-role-permissions";
import { SearchableSelect } from "../_components/searchable-select";
import { allOutletsValue, useSelectedOutlet } from "@/frontend/controllers/selected-outlet-provider";
import { useLanguage } from "@/frontend/controllers/language-provider";
import { getOutlets, getUnits } from "@/frontend/controllers/admin-data-cache";

type Unit = {
  id: string;
  name: string;
  code: string;
  kind: UnitKind;
  toBaseFactor: string;
};

type UnitKind = "weight" | "count" | "package";

type Outlet = {
  id: string;
  name: string;
  code: string;
};

type Product = {
  id: string;
  name: string;
  category: string | null;
  voidWindowHours: number | null;
  refundWindowHours: number | null;
  isActive: boolean;
  skus: Array<{
    id: string;
    sku: string;
    name: string;
    barcode: string | null;
    baseUnitId: string;
    saleUnitId: string;
    price: string;
    cost: string;
    minStockBaseQty: string;
    saleUnitToBaseFactor: string;
    isActive: boolean;
    baseUnit?: { code: string; kind?: UnitKind | null } | null;
    saleUnit?: { code: string; kind?: UnitKind | null } | null;
  }>;
};

type ApiResponse<T> = { data: T };

const initialForm = {
  name: "",
  category: "",
  sku: "",
  skuName: "",
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
};

type EditProductForm = {
  name: string;
  category: string;
  voidWindowHours: string;
  refundWindowHours: string;
  isActive: boolean;
  skus: Array<Product["skus"][number] & {
    productType: UnitKind;
    price: string;
    cost: string;
    saleUnitToBaseFactor: string;
    minStockBaseQty: string;
  }>;
};

export function ProductsClient() {
  const access = useRolePermissions("products");
  const { t } = useLanguage();
  const { selectedOutletId } = useSelectedOutlet();
  const { showToast } = useToast();
  const [productOutletId, setProductOutletId] = useState("");
  const [units, setUnits] = useState<Unit[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(initialForm);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
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

  const unitCode = (unitId: string) =>
    units.find((unit) => unit.id === unitId)?.code || "unit";
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
      (["weight", "count", "package"] as UnitKind[])
        .filter((kind) => units.some((unit) => unit.kind === kind))
        .map((kind) => ({ value: kind, label: unitKindLabel(kind) })),
    [units],
  );
  const createUnitOptions = useMemo(
    () => unitOptionsForKind(units, form.productType),
    [form.productType, units],
  );

  async function loadOutlets() {
    try {
      const outlets = await getOutlets();
      const selectedIsSpecificOutlet =
        selectedOutletId !== allOutletsValue &&
        outlets.some((outlet) => outlet.id === selectedOutletId);
      const nextOutletId = selectedIsSpecificOutlet
        ? selectedOutletId
        : outlets[0]?.id || "";
      setProductOutletId(nextOutletId);
    } catch {
      setMessage("Gagal memuat pilihan outlet.");
    }
  }

  async function loadData() {
    if (!productOutletId) {
      setProducts([]);
      setIsLoading(false);
      setMessage(t("outletRequired"));
      return;
    }
    setIsLoading(true);
    setMessage(null);
    const productUrl = `/api/products?outletId=${encodeURIComponent(productOutletId)}`;
    const [unitData, productResponse] = await Promise.all([getUnits(), fetch(productUrl)]);
    if (productResponse.status === 401) {
      window.location.href = "/admin/login";
      return;
    }
    if (!productResponse.ok) {
      setMessage("Gagal memuat data produk. Pastikan sudah login sebagai admin.");
      setIsLoading(false);
      return;
    }
    const productJson = (await productResponse.json()) as ApiResponse<Product[]>;
    setUnits(unitData as Unit[]);
    setProducts(productJson.data);
    setForm((current) => ({
      ...current,
      ...normalizeUnitSelection(unitData as Unit[], current),
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
      setMessage(t("outletRequired"));
      setIsSubmitting(false);
      return;
    }

    const response = await fetch(`/api/products?outletId=${encodeURIComponent(productOutletId)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: form.name,
        category: form.category || undefined,
        voidWindowHours: optionalInteger(form.voidWindowHours),
        refundWindowHours: optionalInteger(form.refundWindowHours),
        sku: {
          sku: form.sku,
          barcode: form.barcode || undefined,
          name: form.skuName,
          baseUnitId: form.baseUnitId,
          saleUnitId: form.saleUnitId,
          saleUnitToBaseFactor: parseIndonesianNumber(form.saleUnitToBaseFactor),
          price: parseIndonesianNumber(form.price),
          cost: parseIndonesianNumber(form.cost),
          minStockBaseQty: parseIndonesianNumber(form.minStockBaseQty),
        },
      }),
    });

    if (!response.ok) {
      setMessage("Produk gagal dibuat. Periksa data satuan, SKU unik, harga, dan role admin.");
      showToast({
        tone: "error",
        title: "Produk gagal dibuat",
        description: "Periksa satuan, SKU unik, dan harga.",
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
    showToast({ tone: "success", title: "Produk berhasil dibuat" });
    await loadData();
    setIsSubmitting(false);
  }

  function startEdit(product: Product) {
    setEditingProductId(product.id);
    setEditForm({
      name: product.name,
      category: product.category ?? "",
      voidWindowHours: optionalNumberForInput(product.voidWindowHours),
      refundWindowHours: optionalNumberForInput(product.refundWindowHours),
      isActive: product.isActive,
      skus: product.skus.map((item) => ({
        ...item,
        productType: unitKindForUnit(units, item.saleUnitId) ?? "weight",
        barcode: item.barcode ?? "",
        price: formatNumberForInput(item.price),
        cost: formatNumberForInput(item.cost),
        saleUnitToBaseFactor: formatNumberForInput(item.saleUnitToBaseFactor),
        minStockBaseQty: formatNumberForInput(item.minStockBaseQty),
      })),
    });
  }

  function cancelEdit() {
    setEditingProductId(null);
    setEditForm(null);
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
    setIsUpdating(true);
    setMessage(null);

    const response = await fetch(`/api/products/${productId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: nextForm.name,
        category: nextForm.category || null,
        voidWindowHours: optionalInteger(nextForm.voidWindowHours),
        refundWindowHours: optionalInteger(nextForm.refundWindowHours),
        isActive: nextForm.isActive,
        skus: nextForm.skus.map((item) => ({
          id: item.id,
          sku: item.sku,
          barcode: item.barcode || null,
          name: item.name,
          baseUnitId: item.baseUnitId,
          saleUnitId: item.saleUnitId,
          saleUnitToBaseFactor: parseIndonesianNumber(item.saleUnitToBaseFactor),
          price: parseIndonesianNumber(item.price),
          cost: parseIndonesianNumber(item.cost),
          minStockBaseQty: parseIndonesianNumber(item.minStockBaseQty),
          isActive: item.isActive,
        })),
      }),
    });

    if (!response.ok) {
      setMessage("Produk gagal diperbarui. Periksa SKU unik, harga, satuan, dan role admin.");
      showToast({
        tone: "error",
        title: "Produk gagal diperbarui",
        description: "Periksa SKU unik, harga, dan satuan.",
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
      name: productItem.name,
      category: productItem.category ?? "",
      voidWindowHours: optionalNumberForInput(productItem.voidWindowHours),
      refundWindowHours: optionalNumberForInput(productItem.refundWindowHours),
      isActive: nextActive,
      skus: productItem.skus.map((item) => ({
        ...item,
        productType: unitKindForUnit(units, item.saleUnitId) ?? "weight",
        barcode: item.barcode ?? "",
        isActive: nextActive,
      })),
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
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      {access.canCreate ? (
      <CollapsibleSection title="Tambah Produk" description="Master produk dan SKU hanya dibuat dari backend dashboard.">
          <form className="space-y-6" onSubmit={onSubmit}>
            <div className="rounded-lg border p-4">
              <p className="mb-4 text-sm font-semibold text-primary">Data Produk</p>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Nama Produk" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
                <CategoryField
                  id="product-category"
                  label="Kategori"
                  value={form.category}
                  categories={categories}
                  onChange={(value) => setForm({ ...form, category: value })}
                />
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
              <p className="mt-3 text-sm text-muted-foreground">
                Kosong berarti tidak dibatasi. Isi 0 untuk menonaktifkan aksi. 24 jam = 1 hari.
              </p>
            </div>

            <div className="rounded-lg border p-4">
              <p className="mb-4 text-sm font-semibold text-primary">Data SKU & Harga</p>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Kode SKU" value={form.sku} onChange={(value) => setForm({ ...form, sku: value })} />
                <Field label="Nama SKU" value={form.skuName} onChange={(value) => setForm({ ...form, skuName: value })} />
                <Field label="Barcode" value={form.barcode} onChange={(value) => setForm({ ...form, barcode: value })} />
                <Field label="Harga Jual" numeric value={form.price} onChange={(value) => setForm({ ...form, price: value })} />
                <Field label="HPP per Satuan Stok" numeric value={form.cost} onChange={(value) => setForm({ ...form, cost: value })} />
                <Field
                  label={`Stok Minimum (${unitCode(form.baseUnitId)})`}
                  numeric
                  value={form.minStockBaseQty}
                  onChange={(value) => setForm({ ...form, minStockBaseQty: value })}
                />
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <p className="mb-4 text-sm font-semibold text-primary">Satuan & Stok</p>
              <div className="grid gap-4 md:grid-cols-4">
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
                  label="Satuan Stok"
                  value={form.baseUnitId}
                  options={createUnitOptions}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      baseUnitId: value,
                      saleUnitToBaseFactor: conversionInput(units, value, current.saleUnitId),
                    }))
                  }
                />
                <SelectField
                  label="Satuan Jual Kasir"
                  value={form.saleUnitId}
                  options={createUnitOptions}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      saleUnitId: value,
                      saleUnitToBaseFactor: conversionInput(units, current.baseUnitId, value),
                    }))
                  }
                />
                <Field
                  label="Konversi ke Dasar"
                  numeric
                  readOnly
                  value={form.saleUnitToBaseFactor}
                  onChange={(value) => setForm({ ...form, saleUnitToBaseFactor: value })}
                />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {unitKindDescription(form.productType)} Satuan jual inilah yang tampil di kasir.
              </p>
            </div>
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
            <Button type="submit" disabled={isSubmitting || isLoading}>
              <Plus className="h-4 w-4" />
              {isSubmitting ? "Menyimpan" : "Simpan Produk"}
            </Button>
          </form>
      </CollapsibleSection>
      ) : null}

      <CollapsibleSection
        title="Daftar Produk"
        description={`${visibleProducts.length} dari ${products.length} produk tersedia untuk kasir Flutter.`}
        isLoading={isLoading}
        loadingText="Memuat daftar produk dan satuan..."
        actions={
          <Button type="button" variant="outline" onClick={() => void loadData()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        }
      >
          <ListControls
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Cari produk, SKU, barcode..."
            filters={[
              {
                label: "Status",
                value: statusFilter,
                onChange: setStatusFilter,
                options: [
                  { value: "all", label: "Semua" },
                  { value: "active", label: "Aktif" },
                  { value: "inactive", label: "Nonaktif" },
                ],
              },
              {
                label: "Kategori",
                value: categoryFilter,
                onChange: setCategoryFilter,
                options: [{ value: "all", label: "Semua kategori" }, ...categoryOptions],
              },
            ]}
            sort={sortBy}
            onSortChange={setSortBy}
            sortOptions={[
              { value: "name-asc", label: "Nama A-Z" },
              { value: "name-desc", label: "Nama Z-A" },
              { value: "category-asc", label: "Kategori" },
              { value: "price-desc", label: "Harga tertinggi" },
              { value: "price-asc", label: "Harga terendah" },
              { value: "status", label: "Status aktif" },
            ]}
          />
          <div className="mt-4">
            <PaginationControls
              page={page}
              pageSize={pageSize}
              total={visibleProducts.length}
              onPageChange={setPage}
              onPageSizeChange={(value) => {
                setPageSize(value);
                setPage(1);
              }}
            />
          </div>
          <div className="mt-4 space-y-3">
            {pagedProducts.map((item) => (
              <div key={item.id} className="rounded-lg border p-4">
                {editingProductId === item.id && editForm ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Nama Produk" value={editForm.name} onChange={(value) => setEditForm({ ...editForm, name: value })} />
                      <CategoryField
                        id={`edit-product-category-${item.id}`}
                        label="Kategori"
                        value={editForm.category}
                        categories={categories}
                        onChange={(value) => setEditForm({ ...editForm, category: value })}
                      />
                      <Field
                        label="Maks Pembatalan (jam)"
                        numeric
                        value={editForm.voidWindowHours}
                        onChange={(value) => setEditForm({ ...editForm, voidWindowHours: value })}
                      />
                      <Field
                        label="Maks Retur/Pengembalian Dana (jam)"
                        numeric
                        value={editForm.refundWindowHours}
                        onChange={(value) => setEditForm({ ...editForm, refundWindowHours: value })}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Kosong berarti tidak dibatasi. Isi 0 untuk menonaktifkan aksi. 24 jam = 1 hari.
                    </p>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editForm.isActive}
                        onChange={(event) => setEditForm({ ...editForm, isActive: event.target.checked })}
                      />
                      Produk aktif dan tampil di kasir
                    </label>
                    <div className="space-y-3">
                      {editForm.skus.map((skuItem, index) => (
                        <div key={skuItem.id} className="rounded-md bg-muted p-3">
                          <div className="grid gap-3 md:grid-cols-3">
                            <SelectField
                              label="Tipe Jual"
                              value={skuItem.productType}
                              options={productTypeOptions}
                              onChange={(value) => {
                                const productType = value as UnitKind;
                                const normalized = normalizeUnitSelection(units, {
                                  ...skuItem,
                                  productType,
                                  baseUnitId: "",
                                  saleUnitId: "",
                                });
                                setEditForm({
                                  ...editForm,
                                  skus: editForm.skus.map((sku, skuIndex) =>
                                    skuIndex === index
                                      ? { ...sku, ...normalized }
                                      : sku,
                                  ),
                                });
                              }}
                            />
                            <Field
                              label="Kode SKU"
                              value={skuItem.sku}
                              onChange={(value) =>
                                setEditForm({
                                  ...editForm,
                                  skus: editForm.skus.map((sku, skuIndex) =>
                                    skuIndex === index ? { ...sku, sku: value } : sku,
                                  ),
                                })
                              }
                            />
                            <Field
                              label="Nama SKU"
                              value={skuItem.name}
                              onChange={(value) =>
                                setEditForm({
                                  ...editForm,
                                  skus: editForm.skus.map((sku, skuIndex) =>
                                    skuIndex === index ? { ...sku, name: value } : sku,
                                  ),
                                })
                              }
                            />
                            <Field
                              label="Barcode"
                              value={skuItem.barcode ?? ""}
                              onChange={(value) =>
                                setEditForm({
                                  ...editForm,
                                  skus: editForm.skus.map((sku, skuIndex) =>
                                    skuIndex === index ? { ...sku, barcode: value } : sku,
                                  ),
                                })
                              }
                            />
                            <Field
                              label="Harga"
                              numeric
                              value={skuItem.price}
                              onChange={(value) =>
                                setEditForm({
                                  ...editForm,
                                  skus: editForm.skus.map((sku, skuIndex) =>
                                    skuIndex === index ? { ...sku, price: value } : sku,
                                  ),
                                })
                              }
                            />
                            <Field
                              label="HPP"
                              numeric
                              value={skuItem.cost}
                              onChange={(value) =>
                                setEditForm({
                                  ...editForm,
                                  skus: editForm.skus.map((sku, skuIndex) =>
                                    skuIndex === index ? { ...sku, cost: value } : sku,
                                  ),
                                })
                              }
                            />
                            <Field
                              label="Konversi"
                              numeric
                              readOnly
                              value={skuItem.saleUnitToBaseFactor}
                              onChange={(value) =>
                                setEditForm({
                                  ...editForm,
                                  skus: editForm.skus.map((sku, skuIndex) =>
                                    skuIndex === index ? { ...sku, saleUnitToBaseFactor: value } : sku,
                                  ),
                                })
                              }
                            />
                            <SelectField
                              label="Satuan Stok"
                              value={skuItem.baseUnitId}
                              options={unitOptionsForKind(units, skuItem.productType, [skuItem.baseUnitId])}
                              onChange={(value) =>
                                setEditForm({
                                  ...editForm,
                                  skus: editForm.skus.map((sku, skuIndex) =>
                                    skuIndex === index
                                      ? {
                                          ...sku,
                                          baseUnitId: value,
                                          saleUnitToBaseFactor: conversionInput(units, value, sku.saleUnitId),
                                        }
                                      : sku,
                                  ),
                                })
                              }
                            />
                            <SelectField
                              label="Satuan Jual Kasir"
                              value={skuItem.saleUnitId}
                              options={unitOptionsForKind(units, skuItem.productType, [skuItem.saleUnitId])}
                              onChange={(value) =>
                                setEditForm({
                                  ...editForm,
                                  skus: editForm.skus.map((sku, skuIndex) =>
                                    skuIndex === index
                                      ? {
                                          ...sku,
                                          saleUnitId: value,
                                          saleUnitToBaseFactor: conversionInput(units, sku.baseUnitId, value),
                                        }
                                      : sku,
                                  ),
                                })
                              }
                            />
                            <Field
                              label={`Stok Minimum (${unitCode(skuItem.baseUnitId)})`}
                              numeric
                              value={skuItem.minStockBaseQty}
                              onChange={(value) =>
                                setEditForm({
                                  ...editForm,
                                  skus: editForm.skus.map((sku, skuIndex) =>
                                    skuIndex === index ? { ...sku, minStockBaseQty: value } : sku,
                                  ),
                                })
                              }
                            />
                          </div>
                          <label className="mt-3 flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={skuItem.isActive}
                              onChange={(event) =>
                                setEditForm({
                                  ...editForm,
                                  skus: editForm.skus.map((sku, skuIndex) =>
                                    skuIndex === index ? { ...sku, isActive: event.target.checked } : sku,
                                  ),
                                })
                              }
                            />
                            SKU aktif
                          </label>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" onClick={() => void updateProduct(item.id)} disabled={isUpdating}>
                        <Save className="h-4 w-4" />
                        {isUpdating ? "Menyimpan" : "Simpan Perubahan"}
                      </Button>
                      <Button type="button" variant="outline" onClick={cancelEdit} disabled={isUpdating}>
                        <X className="h-4 w-4" />
                        Batal
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col justify-between gap-3 md:flex-row">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{item.name}</p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs ${
                              item.isActive ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {item.isActive ? "Aktif" : "Nonaktif"}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{item.category || "Tanpa kategori"}</p>
                        <p className="text-sm text-muted-foreground">
                          Pembatalan {correctionWindowLabel(item.voidWindowHours)} - Retur/Pengembalian Dana{" "}
                          {correctionWindowLabel(item.refundWindowHours)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {access.canEdit ? (
                          <>
                            <Button type="button" variant="outline" onClick={() => startEdit(item)}>
                              <Edit3 className="h-4 w-4" />
                              Edit
                            </Button>
                            <Button type="button" variant="secondary" onClick={() => void toggleProduct(item)} disabled={isUpdating}>
                              {item.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                              {item.isActive ? "Nonaktifkan" : "Aktifkan"}
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2">
                      {item.skus.map((skuItem) => (
                        <div key={skuItem.id} className="grid gap-2 rounded-md bg-muted px-3 py-2 text-sm md:grid-cols-7">
                          <span>{skuItem.sku}</span>
                          <span>{skuItem.name}</span>
                          <span>{rupiah(skuItem.price)}</span>
                          <span>{unitKindLabel(unitKindForUnit(units, skuItem.saleUnitId) ?? "weight")}</span>
                          <span>
                            Konversi {quantity(skuItem.saleUnitToBaseFactor)}{" "}
                            {skuItem.baseUnit?.code || unitCode(skuItem.baseUnitId)}
                            /{skuItem.saleUnit?.code || unitCode(skuItem.saleUnitId)}
                          </span>
                          <span>
                            Min {quantity(skuItem.minStockBaseQty)}{" "}
                            {skuItem.baseUnit?.code || unitCode(skuItem.baseUnitId)}
                          </span>
                          <span>{skuItem.isActive ? "SKU aktif" : "SKU nonaktif"}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
            {!visibleProducts.length ? <p className="text-sm text-muted-foreground">Data produk tidak ditemukan.</p> : null}
          </div>
      </CollapsibleSection>
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  type?: string;
  numeric?: boolean;
  readOnly?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{props.label}</Label>
      <Input
        type={props.type ?? "text"}
        inputMode={props.numeric ? "decimal" : undefined}
        value={props.value}
        readOnly={props.readOnly}
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
      <Label>{props.label}</Label>
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
    .filter((unit) => unit.kind === kind || includeUnitIds.includes(unit.id))
    .map((unit) => ({
      value: unit.id,
      label: `${unit.name} (${unit.code})`,
    }));
}

function unitKindForUnit(units: Unit[], unitId: string) {
  return units.find((unit) => unit.id === unitId)?.kind;
}

function normalizeUnitSelection<T extends { productType: UnitKind; baseUnitId: string; saleUnitId: string }>(
  units: Unit[],
  current: T,
) {
  const kindUnits = units.filter((unit) => unit.kind === current.productType);
  const fallbackKind = kindUnits.length ? current.productType : units[0]?.kind ?? current.productType;
  const options = units.filter((unit) => unit.kind === fallbackKind);
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

function parseIndonesianNumber(value: string) {
  return Number(value.replace(/\./g, "").replace(",", "."));
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
