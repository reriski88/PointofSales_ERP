"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgePercent, Edit3, Power, PowerOff, RefreshCw, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CollapsibleSection } from "../_components/collapsible-section";
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
  outletId: allOutletsValue,
  minSubtotal: "0",
  buyQty: "0",
  getQty: "0",
  maxRedemptions: "",
  startsAt: "",
  endsAt: "",
};

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
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const activeOutletId =
    selectedOutletId !== allOutletsValue && outlets.some((item) => item.id === selectedOutletId)
      ? selectedOutletId
      : outlets[0]?.id ?? "";
  const categories = useMemo(
    () => Array.from(new Set(catalog.map((item) => item.category).filter(Boolean) as string[])).sort(),
    [catalog],
  );

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
        outletIds: form.outletId === allOutletsValue ? [] : [form.outletId],
        minSubtotal: parseNumber(form.minSubtotal),
        buyQty: parseNumber(form.buyQty),
        getQty: parseNumber(form.getQty),
        maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : null,
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
      outletId: item.outletIds?.[0] ?? allOutletsValue,
      minSubtotal: numberInput(item.minSubtotal),
      buyQty: numberInput(item.buyQty),
      getQty: numberInput(item.getQty),
      maxRedemptions: item.maxRedemptions?.toString() ?? "",
      startsAt: dateOnlyInput(item.startsAt),
      endsAt: dateOnlyInput(item.endsAt),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function clearEdit() {
    setEditingPromotionId(null);
    setForm(initialForm);
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
    return <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">Akun ini belum memiliki akses ke menu Promo.</div>;
  }

  return (
    <div className="space-y-4">
      <CollapsibleSection
        title="Pengaturan dan Form Promo"
        description="Pajak, service charge, voucher, diskon item, buy X get Y, jadwal, dan kuota promo."
        isLoading={isLoading || access.isLoading}
        loadingText="Memuat setting promo..."
        actions={<BadgePercent className="h-6 w-6 text-primary" />}
      >
        <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr] xl:items-start">
          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Pajak dan Service</p>
                <p className="text-xs text-muted-foreground">Dihitung backend saat quote dan checkout.</p>
              </div>
              <Button type="button" size="sm" onClick={() => void saveSettings()} disabled={!access.canEdit || isSubmitting}>
                <Save className="h-4 w-4" />
                Simpan
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <Toggle label="Pajak aktif" checked={settings.taxEnabled} onChange={(value) => setSettings({ ...settings, taxEnabled: value })} />
              <CompactNumberField label="Pajak %" value={settings.taxRatePercent.toString()} onChange={(value) => setSettings({ ...settings, taxRatePercent: parseNumber(value) })} />
              <Toggle label="Harga termasuk pajak" checked={settings.taxIncluded} onChange={(value) => setSettings({ ...settings, taxIncluded: value })} />
              <Toggle label="Service aktif" checked={settings.serviceChargeEnabled} onChange={(value) => setSettings({ ...settings, serviceChargeEnabled: value })} />
              <CompactNumberField label="Service %" value={settings.serviceChargeRatePercent.toString()} onChange={(value) => setSettings({ ...settings, serviceChargeRatePercent: parseNumber(value) })} />
            </div>
          </div>

          <form className="rounded-lg border p-4" onSubmit={submitPromotion}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{editingPromotionId ? "Edit Promo" : "Buat Promo"}</p>
                <p className="text-xs text-muted-foreground">Isi aturan promo dalam form ringkas.</p>
              </div>
              {editingPromotionId ? (
                <Button type="button" variant="outline" size="sm" onClick={clearEdit}>
                  <X className="h-4 w-4" />
                  Batal
                </Button>
              ) : null}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <TextField label="Nama Promo" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
              <TextField label="Kode Voucher" value={form.code} onChange={(value) => setForm({ ...form, code: value.toUpperCase() })} placeholder="Kosong = otomatis" />
              <SelectField label="Outlet" value={form.outletId} onChange={(value) => setForm({ ...form, outletId: value })} options={[
                [allOutletsValue, "Semua Outlet"],
                ...outlets.map((item) => [item.id, `${item.name} (${item.code})`]),
              ]} />
              <SelectField label="Tipe" value={form.type} onChange={(value) => setForm({ ...form, type: value })} options={[
                ["transaction_discount", "Diskon transaksi"],
                ["item_discount", "Diskon item"],
                ["buy_x_get_y", "Buy X Get Y"],
              ]} />
              <SelectField label="Jenis Diskon" value={form.discountType} onChange={(value) => setForm({
                ...form,
                discountType: value,
                discountValue: value === "percent" ? clampPercentInput(form.discountValue) : form.discountValue,
              })} options={[
                ["amount", "Nominal"],
                ["percent", "Persen"],
              ]} />
              <NumberField label="Nilai Diskon" value={form.discountValue} onChange={(value) => setForm({
                ...form,
                discountValue: form.discountType === "percent" ? clampPercentInput(value) : value,
              })} />
              <SelectField label="Target" value={form.scope} onChange={(value) => setForm({ ...form, scope: value })} options={[
                ["all", "Semua item"],
                ["sku", "SKU tertentu"],
                ["category", "Kategori tertentu"],
              ]} />
              {form.scope === "sku" ? (
                <SelectField label="SKU" value={form.targetSkuId} onChange={(value) => setForm({ ...form, targetSkuId: value })} options={catalog.map((item) => [item.skuId, `${item.skuName} (${item.skuCode})`])} />
              ) : null}
              {form.scope === "category" ? (
                <SelectField label="Kategori" value={form.targetCategory} onChange={(value) => setForm({ ...form, targetCategory: value })} options={categories.map((item) => [item, item])} />
              ) : null}
              <NumberField label="Minimal Belanja" value={form.minSubtotal} onChange={(value) => setForm({ ...form, minSubtotal: value })} />
              <NumberField label="Beli Qty" value={form.buyQty} onChange={(value) => setForm({ ...form, buyQty: value })} />
              <NumberField label="Gratis Qty" value={form.getQty} onChange={(value) => setForm({ ...form, getQty: value })} />
              <NumberField label="Kuota" value={form.maxRedemptions} onChange={(value) => setForm({ ...form, maxRedemptions: value })} />
              <TextField label="Tanggal Mulai" type="date" value={form.startsAt} onChange={(value) => setForm({ ...form, startsAt: value })} />
              <TextField label="Tanggal Selesai" type="date" value={form.endsAt} onChange={(value) => setForm({ ...form, endsAt: value })} />
              <div className="flex items-end md:justify-end">
                <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting || (editingPromotionId ? !access.canEdit : !access.canCreate)}>
                  <Save className="h-4 w-4" />
                  {editingPromotionId ? "Update Promo" : "Simpan Promo"}
                </Button>
              </div>
            </div>
          </form>
        </div>
        {message ? <p className="mt-4 text-sm text-destructive">{message}</p> : null}
      </CollapsibleSection>

      <CollapsibleSection title="Daftar Promo" description={`${promotions.length} promo tersimpan.`} isLoading={isLoading || access.isLoading} loadingText="Memuat daftar promo...">
        <div className="grid gap-3">
          {promotions.map((item) => (
            <div key={item.id} className="grid gap-3 rounded-lg border p-4 text-sm lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.7fr_auto] lg:items-center">
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-muted-foreground">{item.code || "Otomatis"} - {promotionTypeLabel(item.type)}</p>
              </div>
              <Metric label="Diskon" value={item.type === "buy_x_get_y" ? `${number(item.buyQty)} + ${number(item.getQty)}` : `${number(item.discountValue)} ${item.discountType === "percent" ? "%" : "Rp"}`} />
              <Metric label="Target" value={targetLabel(item)} />
              <Metric label="Terpakai" value={`${item.redeemedCount}${item.maxRedemptions ? `/${item.maxRedemptions}` : ""}`} />
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" size="sm" disabled={!access.canEdit || isSubmitting} onClick={() => startEdit(item)}>
                  <Edit3 className="h-4 w-4" />
                  Edit
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={!access.canEdit || isSubmitting} onClick={() => void togglePromotion(item)}>
                  {item.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                  {item.isActive ? "Nonaktifkan" : "Aktifkan"}
                </Button>
                <Button type="button" variant="destructive" size="sm" disabled={!access.canDelete || isSubmitting} onClick={() => void deletePromotion(item)}>
                  <Trash2 className="h-4 w-4" />
                  Hapus
                </Button>
              </div>
            </div>
          ))}
          {!promotions.length && !isLoading ? <p className="text-sm text-muted-foreground">Belum ada promo.</p> : null}
        </div>
        <div className="mt-4">
          <Button type="button" variant="outline" onClick={() => void loadData()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </CollapsibleSection>
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

function Toggle(props: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex h-10 items-center gap-2 rounded-md border bg-background px-3 text-sm">
      <input type="checkbox" checked={props.checked} onChange={(event) => props.onChange(event.target.checked)} />
      {props.label}
    </label>
  );
}

function Metric(props: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{props.label}</p>
      <p className="font-medium">{props.value}</p>
    </div>
  );
}

function promotionTypeLabel(value: string) {
  if (value === "item_discount") return "Diskon item";
  if (value === "buy_x_get_y") return "Buy X Get Y";
  return "Diskon transaksi";
}

function targetLabel(item: Promotion) {
  if (item.scope === "sku") return item.targetSkuName || "SKU";
  if (item.scope === "category") return item.targetCategory || "Kategori";
  return "Semua item";
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
  return value.replace(/[^0-9.,]/g, "");
}

function number(value: string | number) {
  return parseNumber(value).toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

function numberInput(value: string | number | null) {
  if (value === null) return "";
  return parseNumber(value).toLocaleString("id-ID", {
    maximumFractionDigits: 2,
    useGrouping: false,
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
