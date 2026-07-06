"use client";

import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { ChevronLeft, ChevronRight, ChevronsUpDown, Edit3, Plus, Power, PowerOff, Save, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminModal } from "../_components/admin-modal";
import { CodeInput } from "../_components/code-input";
import { CollapsibleSection } from "../_components/collapsible-section";
import { pageItems } from "../_components/pagination-controls";
import { useRolePermissions } from "../_components/use-role-permissions";
import { useToast } from "../_components/toast-provider";
import { clearAdminDataCache, getUnits } from "@/frontend/controllers/admin-data-cache";

type UnitKind = "weight" | "count" | "package";
type Unit = {
  id: string;
  name: string;
  code: string;
  kind: UnitKind;
  toBaseFactor: string;
  isActive: boolean;
};
type ApiResponse<T> = { data: T };
type UnitIconButtonProps = ComponentProps<typeof Button> & { compact?: boolean };

const initialForm = {
  name: "",
  code: "",
  kind: "count" as UnitKind,
  toBaseFactor: "1",
};

const kindOptions = [
  { value: "count", label: "Pcs / Satuan" },
  { value: "weight", label: "Berat" },
  { value: "package", label: "Kemasan" },
];

function UnitIconButton({ className, compact, ...props }: UnitIconButtonProps) {
  return <Button {...props} className={[compact ? "h-8 w-8" : "h-10 w-10", "shrink-0 p-0", className].filter(Boolean).join(" ")} />;
}

export function UnitsClient() {
  const access = useRolePermissions("products");
  const { showToast } = useToast();
  const [units, setUnits] = useState<Unit[]>([]);
  const [form, setForm] = useState(initialForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(initialForm);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name-asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const visibleUnits = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return units
      .filter((item) => {
        const matchesSearch = !keyword || [item.name, item.code, unitKindLabel(item.kind)].join(" ").toLowerCase().includes(keyword);
        const matchesStatus = statusFilter === "all" || (statusFilter === "active" && item.isActive) || (statusFilter === "inactive" && !item.isActive);
        const matchesKind = kindFilter === "all" || item.kind === kindFilter;
        return matchesSearch && matchesStatus && matchesKind;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "name-desc":
            return b.name.localeCompare(a.name);
          case "code-asc":
            return a.code.localeCompare(b.code) || a.name.localeCompare(b.name);
          case "code-desc":
            return b.code.localeCompare(a.code) || a.name.localeCompare(b.name);
          case "kind":
            return unitKindLabel(a.kind).localeCompare(unitKindLabel(b.kind)) || a.name.localeCompare(b.name);
          case "status":
            return Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name);
          default:
            return a.name.localeCompare(b.name);
        }
      });
  }, [kindFilter, search, sortBy, statusFilter, units]);
  const pagedUnits = pageItems(visibleUnits, page, pageSize);
  const pageCount = Math.max(1, Math.ceil(visibleUnits.length / pageSize));

  async function loadUnits() {
    setIsLoading(true);
    setMessage(null);
    try {
      const rows = await getUnits({ force: true }) as Unit[];
      setUnits(rows);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Satuan gagal dimuat.";
      if (errorMessage.includes("UNAUTHORIZED")) {
        window.location.href = "/admin/login";
        return;
      }
      setMessage(errorMessage);
    }
    setIsLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUnits();
  }, []);

  async function createUnit() {
    setIsSaving(true);
    setMessage(null);
    const response = await fetch("/api/units", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        code: normalizeUnitCode(form.code || form.name),
        kind: form.kind,
        toBaseFactor: parseIndonesianNumber(form.toBaseFactor || "1"),
      }),
    });
    if (!response.ok) {
      const errorMessage = await readApiError(response, "Satuan gagal dibuat.");
      setMessage(errorMessage);
      showToast({ tone: "error", title: "Satuan gagal dibuat", description: errorMessage });
      setIsSaving(false);
      return;
    }
    const json = await response.json() as ApiResponse<Unit>;
    clearAdminDataCache(["units"]);
    setForm({ ...initialForm, kind: json.data.kind });
    setIsCreateOpen(false);
    showToast({ tone: "success", title: "Satuan berhasil dibuat", description: `${json.data.name} (${json.data.code})` });
    await loadUnits();
    setIsSaving(false);
  }

  function startEdit(item: Unit) {
    setEditId(item.id);
    setEditForm({
      name: item.name,
      code: item.code,
      kind: item.kind,
      toBaseFactor: formatNumberForInput(item.toBaseFactor),
    });
  }

  async function updateUnit(id: string, patch: Partial<typeof initialForm> & { isActive?: boolean }) {
    setIsSaving(true);
    setMessage(null);
    const response = await fetch(`/api/units/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
        ...(patch.code !== undefined ? { code: normalizeUnitCode(patch.code || patch.name || editForm.name) } : {}),
        ...(patch.kind !== undefined ? { kind: patch.kind } : {}),
        ...(patch.toBaseFactor !== undefined ? { toBaseFactor: parseIndonesianNumber(patch.toBaseFactor || "1") } : {}),
        ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
      }),
    });
    if (!response.ok) {
      const errorMessage = await readApiError(response, "Satuan gagal diperbarui.");
      setMessage(errorMessage);
      showToast({ tone: "error", title: "Satuan gagal diperbarui", description: errorMessage });
      setIsSaving(false);
      return;
    }
    clearAdminDataCache(["units"]);
    setEditId(null);
    showToast({ tone: "success", title: "Satuan berhasil diperbarui" });
    await loadUnits();
    setIsSaving(false);
  }

  return (
    <div className="space-y-6">
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <CollapsibleSection
        title="Daftar Satuan"
        description="Satuan dipakai untuk stok, varian produk, kasir, dan kode yang tampil pada struk."
        showDescription
        isLoading={isLoading || access.isLoading}
        loadingText="Memuat daftar satuan..."
        actions={access.canCreate ? <UnitIconButton type="button" onClick={() => setIsCreateOpen(true)} aria-label="Tambah satuan" title="Tambah satuan"><Plus className="h-4 w-4" /></UnitIconButton> : null}
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
              <select className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" value={kindFilter} onChange={(event) => { setKindFilter(event.target.value); setPage(1); }}>
                <option value="all">Semua jenis</option>
                {kindOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className="relative md:w-80">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-11 rounded-lg pl-11" value={search} placeholder="Search..." onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
            </div>
          </div>
          <div className="thin-x-scroll overflow-x-auto">
            <div className="min-w-[820px]">
              <div className="grid grid-cols-[minmax(180px,1.2fr)_minmax(120px,0.8fr)_minmax(140px,0.9fr)_minmax(110px,0.8fr)_minmax(110px,0.8fr)_80px] gap-3 border-b bg-background px-4 py-3 text-xs font-semibold text-foreground">
                <button type="button" className="flex items-center justify-between gap-2 text-left" onClick={() => setSortBy(sortBy === "name-asc" ? "name-desc" : "name-asc")}>Satuan <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" /></button>
                <button type="button" className="flex items-center justify-between gap-2 text-left" onClick={() => setSortBy(sortBy === "code-asc" ? "code-desc" : "code-asc")}>Kode <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" /></button>
                <button type="button" className="flex items-center justify-between gap-2 text-left" onClick={() => setSortBy("kind")}>Jenis <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" /></button>
                <span>Faktor</span>
                <button type="button" className="flex items-center justify-between gap-2 text-left" onClick={() => setSortBy("status")}>Status <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" /></button>
                <span className="data-action-head">Aksi</span>
              </div>
              {pagedUnits.map((item) => (
                <div key={item.id} className="border-b bg-background text-sm last:border-b-0">
                  <div className="grid grid-cols-[minmax(180px,1.2fr)_minmax(120px,0.8fr)_minmax(140px,0.9fr)_minmax(110px,0.8fr)_minmax(110px,0.8fr)_80px] items-center gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.name}</p>
                      <p className="truncate text-xs text-muted-foreground">Kode ini tampil pada struk dan kasir.</p>
                    </div>
                    <p className="truncate font-medium">{item.code}</p>
                    <p className="truncate text-muted-foreground">{unitKindLabel(item.kind)}</p>
                    <p className="truncate text-muted-foreground">{formatNumberForInput(item.toBaseFactor)}</p>
                    <div>
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${item.isActive ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{item.isActive ? "Aktif" : "Nonaktif"}</span>
                    </div>
                    <div className="data-action-cell gap-1">
                      {access.canEdit ? (
                        <>
                          <UnitIconButton type="button" variant="outline" compact className="border-sky-200 text-sky-600 hover:bg-sky-50 hover:text-sky-700" onClick={() => startEdit(item)} disabled={isSaving} aria-label={`Edit ${item.name}`} title="Edit"><Edit3 className="h-4 w-4" /></UnitIconButton>
                          <UnitIconButton type="button" variant="secondary" compact className={item.isActive ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"} onClick={() => void updateUnit(item.id, { isActive: !item.isActive })} disabled={isSaving} aria-label={`${item.isActive ? "Nonaktifkan" : "Aktifkan"} ${item.name}`} title={item.isActive ? "Nonaktifkan" : "Aktifkan"}>{item.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}</UnitIconButton>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
              {!visibleUnits.length && !isLoading ? <p className="px-4 py-6 text-sm text-muted-foreground">Data satuan tidak ditemukan.</p> : null}
            </div>
          </div>
          <div className="flex flex-col gap-3 border-t px-4 py-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-muted-foreground">Showing {visibleUnits.length ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, visibleUnits.length)} of {visibleUnits.length} entries</p>
            <div className="flex items-center gap-3">
              <UnitIconButton type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="Sebelumnya"><ChevronLeft className="h-4 w-4" /></UnitIconButton>
              <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-lg bg-primary/10 px-3 text-sm font-semibold text-primary">{Math.min(page, pageCount)}</span>
              <UnitIconButton type="button" variant="outline" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} aria-label="Berikutnya"><ChevronRight className="h-4 w-4" /></UnitIconButton>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      <AdminModal open={isCreateOpen} title="Tambah Satuan" description="Kode satuan akan tampil di kasir dan struk." onClose={() => setIsCreateOpen(false)}>
        <UnitFormFields form={form} onChange={setForm} units={units} />
        {message ? <p className="mt-3 text-sm text-muted-foreground">{message}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isSaving}><X className="h-4 w-4" />Batal</Button>
          <Button type="button" onClick={() => void createUnit()} disabled={isSaving}><Save className="h-4 w-4" />{isSaving ? "Menyimpan" : "Simpan"}</Button>
        </div>
      </AdminModal>
      <AdminModal open={Boolean(editId)} title="Edit Satuan" description="Perubahan kode akan memengaruhi tampilan kasir dan struk berikutnya." onClose={() => setEditId(null)}>
        <UnitFormFields form={editForm} onChange={setEditForm} units={units} />
        {message ? <p className="mt-3 text-sm text-muted-foreground">{message}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setEditId(null)} disabled={isSaving}><X className="h-4 w-4" />Batal</Button>
          <Button type="button" onClick={() => editId ? void updateUnit(editId, editForm) : undefined} disabled={isSaving}><Save className="h-4 w-4" />{isSaving ? "Menyimpan" : "Simpan"}</Button>
        </div>
      </AdminModal>
    </div>
  );
}

function UnitFormFields(props: { form: typeof initialForm; onChange: (form: typeof initialForm) => void; units: Unit[] }) {
  const { form, onChange } = props;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Field label="Nama Satuan" value={form.name} onChange={(value) => onChange({ ...form, name: value })} />
      <CodeInput label="Kode Struk" value={form.code} placeholder="Kosong = otomatis dari nama" showRandomButton={false} helperText="Contoh: PCS, GR, KG." onChange={(value) => onChange({ ...form, code: normalizeUnitCode(value) })} />
      <SelectField label="Jenis" value={form.kind} options={kindOptions} onChange={(value) => onChange({ ...form, kind: value as UnitKind })} />
      <div className="space-y-2 md:col-span-2">
        <Label>Konversi Satuan</Label>
        <div className="flex items-center gap-2">
          <span className="text-sm whitespace-nowrap text-muted-foreground">1 {form.name || "Satuan"} =</span>
          <Input className="w-24" inputMode="decimal" value={form.toBaseFactor} onChange={(event) => onChange({ ...form, toBaseFactor: formatNumberInput(event.target.value) })} />
          <span className="text-sm whitespace-nowrap text-muted-foreground">satuan dasar</span>
        </div>
        {form.name && form.toBaseFactor && Number(parseIndonesianNumber(form.toBaseFactor || "1")) > 0 ? (
          <p className="text-xs font-medium text-sky-700">
            1 {form.name} = {formatNumberForInput(parseIndonesianNumber(form.toBaseFactor || "1"))} satuan dasar
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Field(props: { label: string; value: string; numeric?: boolean; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{props.label}</Label>
      <Input inputMode={props.numeric ? "decimal" : undefined} value={props.value} onChange={(event) => props.onChange(props.numeric ? formatNumberInput(event.target.value) : event.target.value)} />
    </div>
  );
}

function SelectField(props: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{props.label}</Label>
      <select className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" value={props.value} onChange={(event) => props.onChange(event.target.value)}>
        {props.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}

function unitKindLabel(kind: UnitKind) {
  return kindOptions.find((item) => item.value === kind)?.label ?? kind;
}

function parseIndonesianNumber(value: string) {
  return Number(value.replace(/\./g, "").replace(",", "."));
}

function normalizeUnitCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
}

function formatNumberInput(value: string) {
  const cleaned = value.replace(/[^\d,]/g, "");
  const [wholeRaw, decimalRaw] = cleaned.split(",");
  const whole = wholeRaw.replace(/^0+(?=\d)/, "") || "0";
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return cleaned.includes(",") ? `${grouped},${decimalRaw ?? ""}` : grouped;
}

function formatNumberForInput(value: string | number) {
  return Number(value ?? 0).toLocaleString("id-ID", { maximumFractionDigits: 3 });
}

async function readApiError(response: Response, fallback: string) {
  try {
    const json = await response.json() as { error?: { message?: string } };
    return json.error?.message || fallback;
  } catch {
    return fallback;
  }
}
