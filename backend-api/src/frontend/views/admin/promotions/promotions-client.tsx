"use client";

import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { ChevronLeft, ChevronRight, ChevronsUpDown, Edit3, Plus, Power, PowerOff, Save, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminModal } from "../_components/admin-modal";
import { CodeInput } from "../_components/code-input";
import { pageItems } from "../_components/pagination-controls";
import { SearchableSelect } from "../_components/searchable-select";
import { confirmAction, useToast } from "../_components/toast-provider";
import { useRolePermissions } from "../_components/use-role-permissions";
import { allOutletsValue, useSelectedOutlet } from "@/frontend/controllers/selected-outlet-provider";
import { getOutlets } from "@/frontend/controllers/admin-data-cache";
import { useRealtimeEvents } from "@/frontend/controllers/use-realtime-events";

type ApiResponse<T> = { data: T };
type Outlet = { id: string; name: string; code: string };
type CatalogItem = {
  skuId: string;
  skuName: string;
  skuCode: string;
  category: string | null;
};
type PosSettings = {
  taxEnabled: boolean;
  taxRatePercent: number;
  taxIncluded: boolean;
  serviceChargeEnabled: boolean;
  serviceChargeRatePercent: number;
};
type Promotion = {
  id: string;
  name: string;
  code: string | null;
  type: "transaction_discount" | "item_discount" | "buy_x_get_y";
  discountType: "percent" | "amount";
  discountValue: string;
  scope: "all" | "sku" | "category";
  targetSkuId: string | null;
  targetSkuName: string | null;
  targetCategory: string | null;
  outletIds: string[] | null;
  minSubtotal: string;
  buyQty: string;
  getQty: string;
  maxRedemptions: number | null;
  redeemedCount: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
};

const defaultSettings: PosSettings = {
  taxEnabled: false,
  taxRatePercent: 0,
  taxIncluded: false,
  serviceChargeEnabled: false,
  serviceChargeRatePercent: 0,
};

const initialForm = {
  name: "",
  code: "",
  type: "transaction_discount",
  discountType: "amount",
  discountValue: "0",
  scope: "all",
  targetSkuId: "",
  targetCategory: "",
  outletIds: [] as string[],
  minSubtotal: "0",
  buyQty: "0",
  getQty: "0",
  maxRedemptions: "",
  startsAt: "",
  endsAt: "",
};

type PromoIconButtonProps = ComponentProps<typeof Button> & { compact?: boolean };

function PromoIconButton({ className, compact, ...props }: PromoIconButtonProps) {
  return <Button {...props} className={[compact ? "h-8 w-8" : "h-10 w-10", "shrink-0 p-0", className].filter(Boolean).join(" ")} />;
}

export function PromotionsClient() {
  const access = useRolePermissions("promotions");
  const { selectedOutletId } = useSelectedOutlet();
  const { showToast } = useToast();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [settings, setSettings] = useState<PosSettings>(defaultSettings);
  const [form, setForm] = useState(initialForm);
  const [editingPromotionId, setEditingPromotionId] = useState<string | null>(null);
  const [isPromotionModalOpen, setIsPromotionModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name-asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const activeOutletId =
    selectedOutletId !== allOutletsValue && outlets.some((item) => item.id === selectedOutletId)
      ? selectedOutletId
      : outlets[0]?.id ?? "";
  const categories = useMemo(
    () => Array.from(new Set(catalog.map((item) => item.category).filter(Boolean) as string[])).sort(),
    [catalog],
  );
  const visiblePromotions = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return promotions
      .filter((item) => {
        const matchesSearch = !keyword || [item.name, item.code ?? "", promotionTypeLabel(item.type), targetLabel(item)].join(" ").toLowerCase().includes(keyword);
        const matchesStatus = statusFilter === "all" || (statusFilter === "active" && item.isActive) || (statusFilter === "inactive" && !item.isActive);
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "name-desc":
            return b.name.localeCompare(a.name);
          case "type":
            return promotionTypeLabel(a.type).localeCompare(promotionTypeLabel(b.type)) || a.name.localeCompare(b.name);
          case "discount-desc":
            return parseNumber(b.discountValue) - parseNumber(a.discountValue) || a.name.localeCompare(b.name);
          case "used-desc":
            return b.redeemedCount - a.redeemedCount || a.name.localeCompare(b.name);
          case "status":
            return Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name);
          default:
            return a.name.localeCompare(b.name);
        }
      });
  }, [promotions, search, sortBy, statusFilter]);
  const pagedPromotions = pageItems(visiblePromotions, page, pageSize);
  const pageCount = Math.max(1, Math.ceil(visiblePromotions.length / pageSize));

  async function loadData() {
    setIsLoading(true);
    setMessage(null);
    try {
      const nextOutlets = await getOutlets();
      setOutlets(nextOutlets);
      const catalogQuery = activeOutletId || nextOutlets[0]?.id;
      const [promotionResponse, settingsResponse, catalogResponse] = await Promise.all([
        fetch("/api/promotions"),
        fetch("/api/settings"),
        catalogQuery ? fetch(`/api/catalog?outletId=${encodeURIComponent(catalogQuery)}`) : Promise.resolve(null),
      ]);
      if (promotionResponse.status === 401 || settingsResponse.status === 401 || catalogResponse?.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      if (!promotionResponse.ok || !settingsResponse.ok || catalogResponse?.ok === false) {
        setMessage("Gagal memuat promo atau setting POS.");
        setIsLoading(false);
        return;
      }
      setPromotions(((await promotionResponse.json()) as ApiResponse<Promotion[]>).data);
      const settingsJson = (await settingsResponse.json()) as ApiResponse<{ posSettings?: Partial<PosSettings> | null }>;
      setSettings({ ...defaultSettings, ...(settingsJson.data.posSettings ?? {}) });
      if (catalogResponse) {
        const catalogJson = (await catalogResponse.json()) as ApiResponse<{ items: CatalogItem[] }>;
        setCatalog(catalogJson.data.items);
      }
      setIsLoading(false);
    } catch {
      setMessage("Koneksi server tidak tersedia.");
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOutletId]);

  useRealtimeEvents({
    topics: ["promotions", "settings"],
    debounceMs: 700,
    onEvent: () => void loadData(),
  });

  async function saveSettings() {
    setIsSubmitting(true);
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ posSettings: settings }),
    });
    setIsSubmitting(false);
    if (!response.ok) {
      setMessage(await readError(response, "Setting pajak/service gagal disimpan."));
      return;
    }
    showToast({ tone: "success", title: "Setting POS disimpan" });
  }

  async function submitPromotion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const isEditing = Boolean(editingPromotionId);
    setIsSubmitting(true);
    const response = await fetch(isEditing ? `/api/promotions/${editingPromotionId}` : "/api/promotions", {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        code: form.code || null,
        type: form.type,
        discountType: form.discountType,
        discountValue: parseNumber(form.discountValue),
        scope: form.scope,
        targetSkuId: form.scope === "sku" ? form.targetSkuId : null,
        targetCategory: form.scope === "category" ? form.targetCategory : null,
        outletIds: form.outletIds,
        minSubtotal: parseNumber(form.minSubtotal),
        buyQty: parseNumber(form.buyQty),
        getQty: parseNumber(form.getQty),
        maxRedemptions: form.maxRedemptions ? Math.floor(parseNumber(form.maxRedemptions)) : null,
        startsAt: form.startsAt ? dateStartIso(form.startsAt) : null,
        endsAt: form.endsAt ? dateEndIso(form.endsAt) : null,
        ...(isEditing ? {} : { isActive: true }),
      }),
    });
    setIsSubmitting(false);
    if (!response.ok) {
      setMessage(await readError(response, isEditing ? "Promo gagal diperbarui." : "Promo gagal dibuat."));
      return;
    }
    clearEdit();
    showToast({ tone: "success", title: isEditing ? "Promo diperbarui" : "Promo dibuat" });
    await loadData();
  }

  function startEdit(item: Promotion) {
    setEditingPromotionId(item.id);
    setMessage(null);
    setForm({
      name: item.name,
      code: item.code ?? "",
      type: item.type,
      discountType: item.discountType,
      discountValue: numberInput(item.discountValue),
      scope: item.scope,
      targetSkuId: item.targetSkuId ?? "",
      targetCategory: item.targetCategory ?? "",
      outletIds: item.outletIds ?? [],
      minSubtotal: numberInput(item.minSubtotal),
      buyQty: numberInput(item.buyQty),
      getQty: numberInput(item.getQty),
      maxRedemptions: item.maxRedemptions?.toLocaleString("id-ID") ?? "",
      startsAt: dateOnlyInput(item.startsAt),
      endsAt: dateOnlyInput(item.endsAt),
    });
    setIsPromotionModalOpen(true);
  }

  function clearEdit() {
    setEditingPromotionId(null);
    setForm(initialForm);
    setIsPromotionModalOpen(false);
  }

  function openCreatePromotion() {
    setEditingPromotionId(null);
    setForm(initialForm);
    setIsPromotionModalOpen(true);
  }

  async function togglePromotion(item: Promotion) {
    setIsSubmitting(true);
    const response = await fetch(`/api/promotions/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !item.isActive }),
    });
    setIsSubmitting(false);
    if (!response.ok) {
      setMessage(await readError(response, "Status promo gagal diubah."));
      return;
    }
    await loadData();
  }

  async function deletePromotion(item: Promotion) {
    const confirmed = await confirmAction(`Hapus promo ${item.name}? Promo yang sudah pernah dipakai tetap tersimpan sebagai riwayat transaksi.`);
    if (!confirmed) return;
    setIsSubmitting(true);
    const response = await fetch(`/api/promotions/${item.id}`, {
      method: "DELETE",
    });
    setIsSubmitting(false);
    if (!response.ok) {
      setMessage(await readError(response, "Promo gagal dihapus."));
      return;
    }
    if (editingPromotionId === item.id) {
      clearEdit();
    }
    showToast({ tone: "success", title: "Promo dihapus" });
    await loadData();
  }

  if (!access.canView && !access.isLoading) {
    return <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">Akun ini belum memiliki akses ke menu Pajak & Promo.</div>;
  }

  return (
    <div className="space-y-4">
      <section data-tour="section" className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="border-b px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-base font-semibold leading-snug text-foreground">Pengaturan Pajak & Service</h2>
              <p className="mt-1 text-xs leading-4 text-muted-foreground">Nilai ini dipakai backend saat kasir menghitung total, pajak, dan service charge.</p>
            </div>
            <PromoIconButton type="button" onClick={() => void saveSettings()} disabled={!access.canEdit || isSubmitting} aria-label="Simpan pengaturan pajak" title="Simpan pengaturan">
              <Save className="h-4 w-4" />
            </PromoIconButton>
          </div>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">
          <Toggle label="Pajak aktif" checked={settings.taxEnabled} onChange={(value) => setSettings({ ...settings, taxEnabled: value })} />
          <CompactNumberField label="Pajak %" value={settings.taxRatePercent.toString()} onChange={(value) => setSettings({ ...settings, taxRatePercent: parseNumber(value) })} />
          <Toggle label="Harga termasuk pajak" checked={settings.taxIncluded} onChange={(value) => setSettings({ ...settings, taxIncluded: value })} />
          <Toggle label="Service aktif" checked={settings.serviceChargeEnabled} onChange={(value) => setSettings({ ...settings, serviceChargeEnabled: value })} />
          <CompactNumberField label="Service %" value={settings.serviceChargeRatePercent.toString()} onChange={(value) => setSettings({ ...settings, serviceChargeRatePercent: parseNumber(value) })} />
        </div>
      </section>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <section data-tour="section" className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="border-b px-5 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold leading-snug text-foreground">Daftar Promo</h2>
              <p className="mt-1 text-xs leading-4 text-muted-foreground">Kelola voucher, diskon transaksi, diskon item, kuota, jadwal, dan target promo kasir.</p>
            </div>
            {access.canCreate ? <PromoIconButton type="button" onClick={openCreatePromotion} aria-label="Tambah promo" title="Tambah promo"><Plus className="h-4 w-4" /></PromoIconButton> : null}
          </div>
        </div>
        <div className="p-4">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
            </div>
            <div className="relative md:w-80">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-11 rounded-lg pl-11" value={search} placeholder="Search..." onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
            </div>
          </div>
          <div className="thin-x-scroll overflow-x-auto rounded-xl border bg-card">
            <table className="min-w-[1080px] table-fixed border-collapse text-sm">
              <colgroup>
                <col className="w-[220px]" />
                <col className="w-[150px]" />
                <col className="w-[150px]" />
                <col className="w-[190px]" />
                <col className="w-[120px]" />
                <col className="w-[190px]" />
                <col className="w-[120px]" />
                <col className="w-[130px]" />
              </colgroup>
              <thead className="border-b bg-background text-xs font-semibold text-foreground">
                <tr>
                  <th className="px-4 py-3 text-left"><button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setSortBy(sortBy === "name-asc" ? "name-desc" : "name-asc")}>Promo <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" /></button></th>
                  <th className="px-4 py-3 text-left"><button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setSortBy("type")}>Tipe <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" /></button></th>
                  <th className="px-4 py-3 text-left"><button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setSortBy("discount-desc")}>Diskon <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" /></button></th>
                  <th className="px-4 py-3 text-left">Target</th>
                  <th className="px-4 py-3 text-left"><button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setSortBy("used-desc")}>Terpakai <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" /></button></th>
                  <th className="px-4 py-3 text-left">Jadwal</th>
                  <th className="px-4 py-3 text-left"><button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setSortBy("status")}>Status <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" /></button></th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="bg-background">
                {pagedPromotions.map((item) => (
                  <tr key={item.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3 align-middle"><div className="min-w-0"><p className="truncate font-medium">{item.name}</p><p className="truncate text-xs text-muted-foreground">{item.code || "Tanpa kode"}</p></div></td>
                    <td className="truncate px-4 py-3 align-middle text-muted-foreground">{promotionTypeLabel(item.type)}</td>
                    <td className="px-4 py-3 align-middle font-medium">{discountLabel(item)}</td>
                    <td className="truncate px-4 py-3 align-middle text-muted-foreground">{targetLabel(item)}</td>
                    <td className="px-4 py-3 align-middle text-muted-foreground">{item.redeemedCount.toLocaleString("id-ID")}{item.maxRedemptions ? `/${item.maxRedemptions.toLocaleString("id-ID")}` : ""}</td>
                    <td className="truncate px-4 py-3 align-middle text-muted-foreground">{scheduleLabel(item)}</td>
                    <td className="px-4 py-3 align-middle"><span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${item.isActive ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{item.isActive ? "Aktif" : "Nonaktif"}</span></td>
                    <td className="px-4 py-3 align-middle"><div className="flex justify-end gap-1">
                      <PromoIconButton type="button" variant="outline" compact className="border-sky-200 text-sky-600 hover:bg-sky-50 hover:text-sky-700" disabled={!access.canEdit || isSubmitting} onClick={() => startEdit(item)} aria-label={`Edit ${item.name}`} title="Edit"><Edit3 className="h-4 w-4" /></PromoIconButton>
                      <PromoIconButton type="button" variant="secondary" compact className={item.isActive ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"} disabled={!access.canEdit || isSubmitting} onClick={() => void togglePromotion(item)} aria-label={`${item.isActive ? "Nonaktifkan" : "Aktifkan"} ${item.name}`} title={item.isActive ? "Nonaktifkan" : "Aktifkan"}>{item.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}</PromoIconButton>
                      <PromoIconButton type="button" variant="destructive" compact disabled={!access.canDelete || isSubmitting} onClick={() => void deletePromotion(item)} aria-label={`Hapus ${item.name}`} title="Hapus"><Trash2 className="h-4 w-4" /></PromoIconButton>
                    </div></td>
                  </tr>
                ))}
                {!visiblePromotions.length && !isLoading ? <tr><td colSpan={8} className="px-4 py-6 text-sm text-muted-foreground">Data promo tidak ditemukan.</td></tr> : null}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-muted-foreground">Showing {visiblePromotions.length ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, visiblePromotions.length)} of {visiblePromotions.length} entries</p>
            <div className="flex items-center gap-3">
              <PromoIconButton type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="Sebelumnya"><ChevronLeft className="h-4 w-4" /></PromoIconButton>
              <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-lg bg-primary/10 px-3 text-sm font-semibold text-primary">{Math.min(page, pageCount)}</span>
              <PromoIconButton type="button" variant="outline" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} aria-label="Berikutnya"><ChevronRight className="h-4 w-4" /></PromoIconButton>
            </div>
          </div>
        </div>
      </section>

      <AdminModal
        open={isPromotionModalOpen}
        title={editingPromotionId ? "Edit Promo" : "Buat Promo"}
        description="Aturan promo, target, jadwal, dan kuota."
        size="xl"
        onClose={clearEdit}
      >
        <form className="grid gap-3 md:grid-cols-3" onSubmit={submitPromotion}>
          <TextField label="Nama Promo" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
          <CodeInput label="Kode Voucher" value={form.code} prefix="VCR" onChange={(value) => setForm({ ...form, code: value.toUpperCase() })} placeholder="Kosong = otomatis" />
          <OutletMultiSelectField outlets={outlets} value={form.outletIds} onChange={(outletIds) => setForm({ ...form, outletIds })} />
          <SelectField label="Tipe" value={form.type} onChange={(value) => setForm({ ...form, type: value })} options={[
            ["transaction_discount", "Diskon transaksi"],
            ["item_discount", "Diskon item"],
            ["buy_x_get_y", "Buy X Get Y"],
          ]} />
          <SelectField label="Jenis Diskon" value={form.discountType} onChange={(value) => setForm({ ...form, discountType: value, discountValue: value === "percent" ? clampPercentInput(form.discountValue) : form.discountValue })} options={[["amount", "Nominal"], ["percent", "Persen"]]} />
          <NumberField label="Nilai Diskon" value={form.discountValue} onChange={(value) => setForm({ ...form, discountValue: form.discountType === "percent" ? clampPercentInput(value) : value })} />
          <SelectField label="Target" value={form.scope} onChange={(value) => setForm({ ...form, scope: value })} options={[["all", "Semua item"], ["sku", "SKU tertentu"], ["category", "Kategori tertentu"]]} />
          {form.scope === "sku" ? <SelectField label="SKU" value={form.targetSkuId} onChange={(value) => setForm({ ...form, targetSkuId: value })} options={catalog.map((item) => [item.skuId, `${item.skuName} (${item.skuCode})`])} /> : null}
          {form.scope === "category" ? <SelectField label="Kategori" value={form.targetCategory} onChange={(value) => setForm({ ...form, targetCategory: value })} options={categories.map((item) => [item, item])} /> : null}
          <NumberField label="Minimal Belanja" value={form.minSubtotal} onChange={(value) => setForm({ ...form, minSubtotal: value })} />
          <NumberField label="Beli Qty" value={form.buyQty} onChange={(value) => setForm({ ...form, buyQty: value })} />
          <NumberField label="Gratis Qty" value={form.getQty} onChange={(value) => setForm({ ...form, getQty: value })} />
          <IntegerField label="Kuota" value={form.maxRedemptions} onChange={(value) => setForm({ ...form, maxRedemptions: value })} />
          <TextField label="Tanggal Mulai" type="date" value={form.startsAt} onChange={(value) => setForm({ ...form, startsAt: value })} />
          <TextField label="Tanggal Selesai" type="date" value={form.endsAt} onChange={(value) => setForm({ ...form, endsAt: value })} />
          <div className="flex justify-end gap-2 md:col-span-3">
            <Button type="button" variant="outline" onClick={clearEdit}>Batal</Button>
            <Button type="submit" disabled={isSubmitting || (editingPromotionId ? !access.canEdit : !access.canCreate)}>
              <Save className="h-4 w-4" />
              {editingPromotionId ? "Update Promo" : "Simpan Promo"}
            </Button>
          </div>
        </form>
      </AdminModal>
    </div>
  );
}

function TextField(props: { label: string; value: string; type?: string; placeholder?: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{props.label}</Label>
      <Input type={props.type ?? "text"} value={props.value} placeholder={props.placeholder} onChange={(event) => props.onChange(event.target.value)} />
    </div>
  );
}

function NumberField(props: { label: string; value: string; onChange: (value: string) => void }) {
  return <TextField label={props.label} value={props.value} onChange={(value) => props.onChange(formatNumberInput(value))} />;
}

function IntegerField(props: { label: string; value: string; onChange: (value: string) => void }) {
  return <TextField label={props.label} value={props.value} onChange={(value) => props.onChange(formatIntegerInput(value))} />;
}

function CompactNumberField(props: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)] items-center gap-2">
      <Label className="text-sm">{props.label}</Label>
      <Input
        className="h-9"
        value={props.value}
        inputMode="decimal"
        onChange={(event) => props.onChange(formatNumberInput(event.target.value))}
      />
    </div>
  );
}

function SelectField(props: { label: string; value: string; options: Array<string[]>; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{props.label}</Label>
      <SearchableSelect
        value={props.value}
        onChange={props.onChange}
        options={[
          { value: "", label: "Pilih" },
          ...props.options.map(([value, label]) => ({
            value,
            label,
          })),
        ]}
        placeholder={`Pilih ${props.label.toLowerCase()}`}
        searchPlaceholder={`Cari ${props.label.toLowerCase()}...`}
        emptyText={`${props.label} tidak ditemukan.`}
        allowClear
      />
    </div>
  );
}

function OutletMultiSelectField(props: { outlets: Outlet[]; value: string[]; onChange: (value: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const allSelected = props.value.length === 0;
  const filteredOutlets = props.outlets.filter((outlet) =>
    [outlet.name, outlet.code].join(" ").toLowerCase().includes(query.trim().toLowerCase()),
  );
  const selectedLabel = allSelected
    ? "Semua Outlet"
    : props.value.length === 1
      ? props.outlets.find((outlet) => outlet.id === props.value[0])?.name ?? "1 outlet dipilih"
      : `${props.value.length} outlet dipilih`;
  return (
    <div className="relative space-y-2">
      <Label>Outlet</Label>
      <button
        type="button"
        className="flex h-10 w-full items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="min-w-0 truncate">{selectedLabel}</span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      <p className="text-xs text-muted-foreground">Pilih beberapa outlet atau biarkan semua.</p>
      {open ? (
        <div className="absolute left-0 right-0 top-full z-[60] mt-1 overflow-hidden rounded-md border bg-card text-card-foreground shadow-lg">
          <div className="relative border-b">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-10 rounded-none border-0 bg-transparent px-9 focus-visible:ring-0" value={query} placeholder="Cari outlet..." onChange={(event) => setQuery(event.target.value)} />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            <label className="flex cursor-pointer items-start gap-2 px-3 py-2 text-sm hover:bg-muted">
              <input type="checkbox" className="mt-1" checked={allSelected} onChange={() => props.onChange([])} />
              <span className="min-w-0"><span className="block truncate font-medium">Semua Outlet</span><span className="block truncate text-xs text-muted-foreground">Promo berlaku di seluruh outlet.</span></span>
            </label>
            {filteredOutlets.map((outlet) => {
              const checked = props.value.includes(outlet.id);
              return (
                <label key={outlet.id} className="flex cursor-pointer items-start gap-2 px-3 py-2 text-sm hover:bg-muted">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={checked}
                    onChange={(event) => {
                      if (event.target.checked) {
                        props.onChange([...props.value, outlet.id]);
                        return;
                      }
                      props.onChange(props.value.filter((id) => id !== outlet.id));
                    }}
                  />
                  <span className="min-w-0"><span className="block truncate font-medium">{outlet.name}</span><span className="block truncate text-xs text-muted-foreground">{outlet.code}</span></span>
                </label>
              );
            })}
            {!filteredOutlets.length ? <p className="px-3 py-3 text-sm text-muted-foreground">Outlet tidak ditemukan.</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Toggle(props: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex h-10 items-center gap-2 rounded-md border bg-background px-3 text-sm">
      <input type="checkbox" checked={props.checked} onChange={(event) => props.onChange(event.target.checked)} />
      {props.label}
    </label>
  );
}

function promotionTypeLabel(value: string) {
  if (value === "item_discount") return "Diskon item";
  if (value === "buy_x_get_y") return "Buy X Get Y";
  return "Diskon transaksi";
}

function discountLabel(item: Promotion) {
  if (item.type === "buy_x_get_y") return `${number(item.buyQty)} + ${number(item.getQty)}`;
  return item.discountType === "percent" ? `${number(item.discountValue)}%` : rupiah(item.discountValue);
}

function targetLabel(item: Promotion) {
  if (item.scope === "sku") return item.targetSkuName || "SKU";
  if (item.scope === "category") return item.targetCategory || "Kategori";
  return "Semua item";
}

function scheduleLabel(item: Promotion) {
  const start = dateOnlyInput(item.startsAt);
  const end = dateOnlyInput(item.endsAt);
  if (start && end) return `${start} - ${end}`;
  if (start) return `Mulai ${start}`;
  if (end) return `Sampai ${end}`;
  return "Tanpa jadwal";
}

function parseNumber(value: string | number) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const trimmed = value.trim();
  const hasComma = trimmed.includes(",");
  const hasDot = trimmed.includes(".");
  const normalized =
    hasComma
      ? trimmed.replace(/\./g, "").replace(",", ".")
      : hasDot && /^\d+\.\d{1,2}$/.test(trimmed)
        ? trimmed
        : trimmed.replace(/\./g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumberInput(value: string) {
  const cleaned = value.replace(/[^0-9,]/g, "");
  const [wholeRaw, decimalRaw] = cleaned.split(",");
  const whole = wholeRaw.replace(/^0+(?=\d)/, "") || "0";
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (cleaned.includes(",")) {
    return `${grouped},${decimalRaw ?? ""}`;
  }
  return grouped;
}

function formatIntegerInput(value: string) {
  const cleaned = value.replace(/\D/g, "");
  if (!cleaned) return "";
  return cleaned.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function number(value: string | number) {
  return parseNumber(value).toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

function rupiah(value: string | number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(parseNumber(value));
}

function numberInput(value: string | number | null) {
  if (value === null) return "";
  return parseNumber(value).toLocaleString("id-ID", {
    maximumFractionDigits: 2,
    useGrouping: true,
  });
}

function clampPercentInput(value: string) {
  const parsed = parseNumber(value);
  if (parsed > 100) return "100";
  return value;
}

function dateOnlyInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear().toString().padStart(4, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateStartIso(value: string) {
  return new Date(`${value}T00:00:00`).toISOString();
}

function dateEndIso(value: string) {
  return new Date(`${value}T23:59:59.999`).toISOString();
}

async function readError(response: Response, fallback: string) {
  try {
    const json = (await response.json()) as { error?: { message?: string } };
    return json.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}
