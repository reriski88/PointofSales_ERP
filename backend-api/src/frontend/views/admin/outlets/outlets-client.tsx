"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type ComponentProps } from "react";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Edit3,
  Eye,
  ImageIcon,
  Plus,
  Power,
  PowerOff,
  Save,
  Trash2,
  Upload,
  X,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CollapsibleSection } from "../_components/collapsible-section";
import { AdminModal } from "../_components/admin-modal";
import { CodeInput } from "../_components/code-input";
import { pageItems } from "../_components/pagination-controls";
import { confirmAction, useToast } from "../_components/toast-provider";
import { useRolePermissions } from "../_components/use-role-permissions";
import { clearAdminDataCache } from "@/frontend/controllers/admin-data-cache";
import { saveSelectedOutlet } from "@/frontend/controllers/selected-outlet-provider";

type Outlet = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  logoUrl: string | null;
  isActive: boolean;
};

type ApiResponse<T> = { data: T };
type UploadResponse = { url: string; key: string };
type Settings = {
  defaultOutletLogoUrl: string | null;
};

type OutletIconButtonProps = ComponentProps<typeof Button> & { compact?: boolean };

function OutletIconButton({ className, compact, ...props }: OutletIconButtonProps) {
  return (
    <Button
      {...props}
      className={[compact ? "h-8 w-8" : "h-10 w-10", "shrink-0 p-0", className].filter(Boolean).join(" ")}
    />
  );
}

type ApiErrorBody = { error?: { code?: string; message?: string } };
const ignoredLogoUrls = new Set(["/images/login-pos-cartoon-transaction-transparent.png"]);

async function readApiError(response: Response, fallback: string) {
  try {
    const json = (await response.json()) as ApiErrorBody;
    const code = json.error?.code ? `${json.error.code}: ` : "";
    return json.error?.message ? `${code}${json.error.message}` : fallback;
  } catch {
    return fallback;
  }
}

function logoUrlForInput(value: string | null | undefined) {
  const url = value ?? "";
  return ignoredLogoUrls.has(url) ? "" : url;
}

function logoUrlForDisplay(value: string | null | undefined) {
  const url = value ?? "";
  return ignoredLogoUrls.has(url) ? "" : url;
}

export function OutletsClient() {
  const access = useRolePermissions("outlets");
  const { showToast } = useToast();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [settings, setSettings] = useState<Settings>({
    defaultOutletLogoUrl: null,
  });
  const [defaultLogoUrl, setDefaultLogoUrl] = useState("");
  const [useDefaultLogo, setUseDefaultLogo] = useState(true);
  const [form, setForm] = useState({
    name: "",
    code: "",
    address: "",
    logoUrl: "",
  });
  const [editingOutletId, setEditingOutletId] = useState<string | null>(null);
  const [modalEditingOutletId, setModalEditingOutletId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    address: "",
    logoUrl: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name-asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [previewLogoUrl, setPreviewLogoUrl] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDefaultLogoOpen, setIsDefaultLogoOpen] = useState(false);

  const visibleOutlets = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return outlets
      .filter((outlet) => {
        const matchesSearch =
          !keyword ||
          [outlet.name, outlet.code, outlet.address ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(keyword);
        return matchesSearch;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "name-desc":
            return b.name.localeCompare(a.name);
          case "code-asc":
            return a.code.localeCompare(b.code);
          case "code-desc":
            return b.code.localeCompare(a.code);
          case "status":
            return (
              Number(b.isActive) - Number(a.isActive) ||
              a.name.localeCompare(b.name)
            );
          default:
            return a.name.localeCompare(b.name);
        }
      });
  }, [outlets, search, sortBy]);
  const pagedOutlets = pageItems(visibleOutlets, page, pageSize);
  const isFirstRunSetup = !isLoading && outlets.length === 0 && access.canCreate;
  const settingsDefaultLogoUrl = useDefaultLogo ? logoUrlForDisplay(settings.defaultOutletLogoUrl) : "";
  const defaultLogoPreviewUrl = useDefaultLogo ? logoUrlForDisplay(defaultLogoUrl) : "";

  async function loadData() {
    setIsLoading(true);
    const [outletResponse, settingsResponse] = await Promise.all([
      fetch("/api/outlets"),
      fetch("/api/settings"),
    ]);
    if (outletResponse.status === 401 || settingsResponse.status === 401) {
      window.location.href = "/admin/login";
      return;
    }
    if (!outletResponse.ok || !settingsResponse.ok) {
      setMessage("Gagal memuat outlet.");
      setIsLoading(false);
      return;
    }
    const outletJson = (await outletResponse.json()) as ApiResponse<Outlet[]>;
    const settingsJson =
      (await settingsResponse.json()) as ApiResponse<Settings>;
    setOutlets(outletJson.data);
    setSettings(settingsJson.data);
    setDefaultLogoUrl(logoUrlForDisplay(settingsJson.data.defaultOutletLogoUrl));
    setUseDefaultLogo(settingsJson.data.defaultOutletLogoUrl !== "");
    setIsLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    const isCreatingFirstOutlet = outlets.length === 0;
    const response = await fetch("/api/outlets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        code: form.code,
        address: form.address || undefined,
        logoUrl: form.logoUrl || undefined,
      }),
    });
    if (!response.ok) {
      setMessage("Outlet gagal dibuat. Pastikan kode outlet unik.");
      showToast({
        tone: "error",
        title: "Outlet gagal dibuat",
        description: "Pastikan kode outlet unik dan data wajib terisi.",
      });
      setIsSubmitting(false);
      return;
    }
    const json = (await response.json()) as ApiResponse<Outlet>;
    clearAdminDataCache(["outlets"]);
    if (isCreatingFirstOutlet) {
      saveSelectedOutlet(json.data.id);
    }
    setForm({ name: "", code: "", address: "", logoUrl: "" });
    setIsCreateOpen(false);
    setMessage("Outlet berhasil dibuat.");
    showToast({ tone: "success", title: "Outlet berhasil dibuat" });
    await loadData();
    setIsSubmitting(false);
  }

  async function updateDefaultLogo() {
    if (!(await confirmAction("Simpan perubahan logo default outlet?"))) return;
    setIsUpdating(true);
    setMessage(null);
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        defaultOutletLogoUrl: useDefaultLogo ? defaultLogoUrl : "",
      }),
    });
    if (!response.ok) {
      setMessage("Logo default gagal diperbarui.");
      showToast({ tone: "error", title: "Logo default gagal diperbarui" });
      setIsUpdating(false);
      return;
    }
    const json = (await response.json()) as ApiResponse<Settings>;
    setSettings(json.data);
    setDefaultLogoUrl(logoUrlForDisplay(json.data.defaultOutletLogoUrl));
    setUseDefaultLogo(json.data.defaultOutletLogoUrl !== "");
    setIsDefaultLogoOpen(false);
    setMessage("Logo default outlet berhasil diperbarui.");
    showToast({ tone: "success", title: "Logo default outlet diperbarui" });
    setIsUpdating(false);
  }

  async function clearDefaultLogo() {
    if (!(await confirmAction("Hapus logo default outlet?"))) return;
    setIsUpdating(true);
    setMessage(null);
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultOutletLogoUrl: "" }),
    });
    if (!response.ok) {
      setMessage("Logo default gagal dihapus.");
      showToast({ tone: "error", title: "Logo default gagal dihapus" });
      setIsUpdating(false);
      return;
    }
    setSettings({ defaultOutletLogoUrl: null });
    setDefaultLogoUrl("");
    setUseDefaultLogo(false);
    setMessage("Logo default outlet berhasil dihapus.");
    showToast({ tone: "success", title: "Logo default outlet dihapus" });
    setIsUpdating(false);
  }

  async function uploadLocalLogo(
    file: File | undefined,
    onChange: (value: string) => void,
  ) {
    if (!file) return;
    setIsUpdating(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("scope", "outlets");
      formData.append("file", file);
      const response = await fetch("/api/uploads/images", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const errorMessage = await readApiError(response, "Upload logo outlet gagal.");
        setMessage(errorMessage);
        showToast({ tone: "error", title: "Upload logo gagal", description: errorMessage });
        return;
      }
      const json = (await response.json()) as ApiResponse<UploadResponse>;
      onChange(json.data.url);
      setUseDefaultLogo(true);
      setMessage("Logo berhasil diunggah ke storage lokal.");
      showToast({ tone: "success", title: "Logo berhasil diunggah" });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Upload logo outlet gagal.";
      setMessage(errorMessage);
      showToast({ tone: "error", title: "Upload logo gagal", description: errorMessage });
    } finally {
      setIsUpdating(false);
    }
  }

  function startEdit(outlet: Outlet) {
    setEditingOutletId(null);
    setModalEditingOutletId(outlet.id);
    setEditForm({
      name: outlet.name,
      address: outlet.address ?? "",
      logoUrl: logoUrlForDisplay(outlet.logoUrl),
    });
  }

  function cancelEdit() {
    setEditingOutletId(null);
    setModalEditingOutletId(null);
    setEditForm({ name: "", address: "", logoUrl: "" });
  }

  function openCreateOutlet() {
    setForm({ name: "", code: "", address: "", logoUrl: "" });
    setMessage(null);
    setIsCreateOpen(true);
  }

  async function updateOutlet(outletId: string) {
    setIsUpdating(true);
    setMessage(null);
    const response = await fetch(`/api/outlets/${outletId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name,
        address: editForm.address || null,
        logoUrl: editForm.logoUrl || null,
      }),
    });
    if (!response.ok) {
      setMessage("Outlet gagal diperbarui. Pastikan nama outlet terisi.");
      showToast({
        tone: "error",
        title: "Outlet gagal diperbarui",
        description: "Pastikan nama outlet terisi.",
      });
      setIsUpdating(false);
      return;
    }
    setMessage("Outlet berhasil diperbarui.");
    showToast({ tone: "success", title: "Outlet berhasil diperbarui" });
    clearAdminDataCache(["outlets"]);
    cancelEdit();
    await loadData();
    setIsUpdating(false);
  }

  async function clearOutletLogo(outletId: string) {
    if (!(await confirmAction("Hapus logo khusus outlet ini?"))) return;
    setIsUpdating(true);
    setMessage(null);
    const response = await fetch(`/api/outlets/${outletId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logoUrl: null }),
    });
    if (!response.ok) {
      setMessage("Logo outlet gagal dihapus.");
      showToast({ tone: "error", title: "Logo outlet gagal dihapus" });
      setIsUpdating(false);
      return;
    }
    if (editingOutletId === outletId) {
      setEditForm((current) => ({ ...current, logoUrl: "" }));
    }
    setMessage("Logo outlet berhasil dihapus.");
    showToast({ tone: "success", title: "Logo outlet berhasil dihapus" });
    clearAdminDataCache(["outlets"]);
    await loadData();
    setIsUpdating(false);
  }

  async function toggleOutlet(outletItem: Outlet) {
    const nextActive = !outletItem.isActive;
    const actionLabel = nextActive ? "mengaktifkan" : "menonaktifkan";
    if (
      !(await confirmAction(
        `Yakin ingin ${actionLabel} outlet ${outletItem.name}?`,
      ))
    ) {
      return;
    }

    setIsUpdating(true);
    setMessage(null);
    const response = await fetch(`/api/outlets/${outletItem.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: nextActive }),
    });
    if (!response.ok) {
      setMessage("Status outlet gagal diperbarui.");
      showToast({ tone: "error", title: "Status outlet gagal diperbarui" });
      setIsUpdating(false);
      return;
    }
    setMessage(
      nextActive
        ? "Outlet berhasil diaktifkan."
        : "Outlet berhasil dinonaktifkan.",
    );
    showToast({
      tone: "success",
      title: nextActive ? "Outlet diaktifkan" : "Outlet dinonaktifkan",
      description: outletItem.name,
    });
    clearAdminDataCache(["outlets"]);
    await loadData();
    setIsUpdating(false);
  }

  return (
    <div className="space-y-6">
      {isFirstRunSetup ? <FirstRunSetupPanel /> : null}

      <CollapsibleSection
        title="Daftar Outlet"
        description="Dipakai untuk akses kasir, stok, laporan, dan katalog tiap cabang."
        showDescription
        isLoading={isLoading}
        loadingText="Memuat daftar outlet..."
        actions={(
          <div className="flex items-center gap-2">
            {access.canEdit ? (
              <Button type="button" variant="outline" className="h-10 gap-2" onClick={() => setIsDefaultLogoOpen(true)}>
                <ImageIcon className="h-4 w-4" />
                Logo Default
              </Button>
            ) : null}
            {access.canCreate ? (
              <OutletIconButton type="button" onClick={openCreateOutlet} aria-label="Tambah outlet" title="Tambah outlet"><Plus className="h-4 w-4" /></OutletIconButton>
            ) : null}
          </div>
        )}
      >
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="flex flex-col gap-3 border-b px-4 py-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>Show</span>
              <select
                className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
              >
                {[5, 10, 20, 50, 100].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <span>entries</span>
            </div>
            <div className="relative md:w-80">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-11 rounded-lg pl-11"
                value={search}
                placeholder="Search..."
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
          <div className="thin-x-scroll overflow-x-auto">
            <div className="min-w-[900px]">
              <div className="grid grid-cols-[minmax(180px,1.2fr)_minmax(120px,0.8fr)_minmax(220px,1.4fr)_minmax(110px,0.8fr)_minmax(170px,1fr)_96px] gap-3 border-b bg-background px-4 py-3 text-xs font-semibold text-foreground">
                <button type="button" className="flex items-center justify-between gap-2 text-left" onClick={() => setSortBy(sortBy === "name-asc" ? "name-desc" : "name-asc")}>Outlet <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" /></button>
                <button type="button" className="flex items-center justify-between gap-2 text-left" onClick={() => setSortBy(sortBy === "code-asc" ? "code-desc" : "code-asc")}>Kode <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" /></button>
                <span>Alamat</span>
                <button type="button" className="flex items-center justify-between gap-2 text-left" onClick={() => setSortBy("status")}>Status <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" /></button>
                <span>Logo</span>
                <span className="data-action-head">Aksi</span>
              </div>
          {pagedOutlets.map((outlet) => {
            const outletLogoUrl = logoUrlForDisplay(outlet.logoUrl);
            const effectiveLogoUrl = outletLogoUrl || settingsDefaultLogoUrl;
            return (
            <div key={outlet.id} className="border-b bg-background text-sm last:border-b-0">
              <div className="grid grid-cols-[minmax(180px,1.2fr)_minmax(120px,0.8fr)_minmax(220px,1.4fr)_minmax(110px,0.8fr)_minmax(170px,1fr)_96px] items-center gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                {effectiveLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={effectiveLogoUrl}
                    alt={outlet.name}
                    className="h-10 w-10 rounded-lg border object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-muted">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                )}
                  <div className="min-w-0">
                    <p className="truncate font-medium">{outlet.name}</p>
                    <p className="truncate text-xs text-muted-foreground">Outlet</p>
                  </div>
                </div>
                <p className="font-medium">{outlet.code}</p>
                <p className="truncate text-justify text-muted-foreground">{outlet.address || "-"}</p>
                <div>
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${outlet.isActive ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{outlet.isActive ? "Aktif" : "Nonaktif"}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                        <ImageIcon className="h-3.5 w-3.5" />
                        <span>
                          {outletLogoUrl
                            ? "Logo khusus tersedia"
                            : settingsDefaultLogoUrl
                              ? "Memakai logo default"
                              : "Logo belum diisi"}
                        </span>
                        {effectiveLogoUrl ? (
                          <OutletIconButton
                            type="button"
                            variant="ghost"
                            size="sm"
                            compact
                            className="text-sky-600 hover:bg-sky-50 hover:text-sky-700"
                            onClick={() =>
                              setPreviewLogoUrl(
                                effectiveLogoUrl,
                              )
                            }
                            aria-label={`Preview logo ${outlet.name}`}
                            title="Preview"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </OutletIconButton>
                        ) : null}
                        {outletLogoUrl && access.canEdit ? (
                          <OutletIconButton
                            type="button"
                            variant="ghost"
                            size="sm"
                            compact
                            className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            onClick={() => void clearOutletLogo(outlet.id)}
                            disabled={isUpdating}
                            aria-label={`Hapus logo ${outlet.name}`}
                            title="Hapus logo"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </OutletIconButton>
                        ) : null}
                </div>
                      <div className="data-action-cell gap-1">
                        {access.canEdit ? (
                          <>
                          <OutletIconButton
                            type="button"
                            variant="outline"
                            compact
                            className="border-sky-200 text-sky-600 hover:bg-sky-50 hover:text-sky-700"
                            onClick={() => startEdit(outlet)}
                            aria-label={`Edit ${outlet.name}`}
                            title="Edit"
                          >
                            <Edit3 className="h-4 w-4" />
                          </OutletIconButton>
                          <OutletIconButton
                            type="button"
                            variant="secondary"
                            compact
                            className={outlet.isActive ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}
                            onClick={() => void toggleOutlet(outlet)}
                            disabled={isUpdating}
                            aria-label={`${outlet.isActive ? "Nonaktifkan" : "Aktifkan"} ${outlet.name}`}
                            title={outlet.isActive ? "Nonaktifkan" : "Aktifkan"}
                          >
                            {outlet.isActive ? (
                              <PowerOff className="h-4 w-4" />
                            ) : (
                              <Power className="h-4 w-4" />
                            )}
                          </OutletIconButton>
                          </>
                        ) : null}
                        </div>
              </div>
            </div>
          );
          })}
              {!visibleOutlets.length && !isLoading ? <p className="px-4 py-6 text-sm text-muted-foreground">Data outlet tidak ditemukan.</p> : null}
            </div>
          </div>
          <div className="flex flex-col gap-3 border-t px-4 py-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-muted-foreground">Showing {visibleOutlets.length ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, visibleOutlets.length)} of {visibleOutlets.length} entries</p>
            <div className="flex items-center gap-3">
              <OutletIconButton type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="Sebelumnya"><ChevronLeft className="h-4 w-4" /></OutletIconButton>
              <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-lg bg-primary/10 px-3 text-sm font-semibold text-primary">{page}</span>
              <OutletIconButton type="button" variant="outline" disabled={page >= Math.max(1, Math.ceil(visibleOutlets.length / pageSize))} onClick={() => setPage((current) => Math.min(Math.max(1, Math.ceil(visibleOutlets.length / pageSize)), current + 1))} aria-label="Berikutnya"><ChevronRight className="h-4 w-4" /></OutletIconButton>
            </div>
          </div>
        </div>
      </CollapsibleSection>
      {previewLogoUrl ? (
        <LogoPreviewModal
          url={previewLogoUrl}
          onClose={() => setPreviewLogoUrl(null)}
        />
      ) : null}
      <AdminModal
        open={isDefaultLogoOpen}
        title="Logo Default Outlet"
        description="Dipakai semua outlet yang belum punya logo khusus."
        size="lg"
        onClose={() => setIsDefaultLogoOpen(false)}
      >
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="grid gap-0 lg:grid-cols-[220px_1fr]">
            <div className="flex min-h-48 items-center justify-center border-b bg-muted/30 p-4 lg:border-b-0 lg:border-r">
              {defaultLogoPreviewUrl ? (
                <button
                  type="button"
                  className="group relative flex h-40 w-full items-center justify-center overflow-hidden rounded-lg border bg-background"
                  onClick={() => setPreviewLogoUrl(defaultLogoPreviewUrl)}
                  aria-label="Preview logo default outlet"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={defaultLogoPreviewUrl}
                    alt="Logo default outlet"
                    className="h-full w-full object-contain p-3 transition-transform group-hover:scale-[1.03]"
                  />
                  <span className="absolute bottom-2 rounded-md bg-background/90 px-2 py-1 text-xs font-medium shadow-sm">
                    Preview
                  </span>
                </button>
              ) : (
                <div className="flex h-40 w-full flex-col items-center justify-center rounded-lg border bg-background text-muted-foreground">
                  <ImageIcon className="h-8 w-8" />
                  <p className="mt-2 text-sm font-medium">Belum ada logo</p>
                </div>
              )}
            </div>
            <div className="space-y-4 p-4">
              <label className="flex items-start gap-3 rounded-lg border bg-background p-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={useDefaultLogo}
                  onChange={(event) => setUseDefaultLogo(event.target.checked)}
                />
                <span>
                  <span className="block text-sm font-semibold">Gunakan logo default outlet</span>
                  <span className="block text-sm text-muted-foreground">
                    Matikan kalau usaha tidak membutuhkan logo di outlet, struk, dan tampilan kasir.
                  </span>
                </span>
              </label>
              <LogoField
                label="URL Logo Default"
                value={defaultLogoUrl}
                onChange={(value) => {
                  setDefaultLogoUrl(value);
                  setUseDefaultLogo(Boolean(value));
                }}
                onPreview={setPreviewLogoUrl}
                onClear={() => void clearDefaultLogo()}
                iconOnly
              />
              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <FileField
                  label="Upload File"
                  onChange={(file) => void uploadLocalLogo(file, setDefaultLogoUrl)}
                />
                <Button
                  type="button"
                  className="h-11 gap-2 px-5"
                  onClick={() => void updateDefaultLogo()}
                  disabled={isUpdating}
                >
                  <Save className="h-4 w-4" />
                  {isUpdating ? "Menyimpan" : "Simpan Logo"}
                </Button>
              </div>
              <div className="rounded-lg border bg-muted/25 px-3 py-2 text-sm text-muted-foreground">
                {!useDefaultLogo
                  ? "Logo default dimatikan. Outlet tanpa logo khusus tidak akan memakai logo apapun."
                  : defaultLogoPreviewUrl
                  ? isUploadedImageUrl(defaultLogoPreviewUrl)
                  ? "Logo dipilih dari upload file lokal dan disimpan di storage lokal. Field URL manual sengaja dikosongkan."
                    : "Logo memakai URL manual yang tertulis di field URL."
                  : "Upload file logo atau tempel URL manual, lalu simpan sebagai logo default outlet."}
              </div>
            </div>
          </div>
        </div>
      </AdminModal>
      <AdminModal
        open={isCreateOpen}
        title={isFirstRunSetup ? "Setup Awal: Outlet Pertama" : "Tambah Outlet"}
        description="Outlet dipakai untuk akses kasir, stok, laporan, dan katalog."
        size="xl"
        onClose={() => setIsCreateOpen(false)}
      >
        <form className="space-y-5" onSubmit={onSubmit}>
          <div className="grid overflow-hidden rounded-xl border bg-card md:grid-cols-[240px_1fr]">
            <div className="border-b bg-muted/25 p-4 md:border-b-0 md:border-r">
              <div className="space-y-3">
                <p className="text-sm font-semibold">Logo Outlet</p>
                <button
                  type="button"
                  className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border bg-background text-muted-foreground"
                  onClick={() => form.logoUrl && setPreviewLogoUrl(form.logoUrl)}
                  disabled={!form.logoUrl}
                  aria-label="Preview logo outlet"
                >
                  {form.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.logoUrl} alt="Logo outlet" className="h-full w-full object-contain p-4" />
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <ImageIcon className="h-8 w-8" />
                      <span className="text-sm font-medium">Belum ada logo khusus</span>
                    </div>
                  )}
                </button>
                <div className="rounded-lg border bg-background px-3 py-2 text-xs text-muted-foreground">
                  {form.logoUrl
                    ? isUploadedImageUrl(form.logoUrl)
                  ? "Logo dari upload storage lokal."
                      : "Logo dari URL manual."
                    : "Opsional. Jika kosong, outlet akan memakai logo default bila aktif."}
                </div>
              </div>
            </div>
            <div className="space-y-4 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Nama Outlet" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
                <CodeInput label="Kode Outlet" value={form.code} prefix="OUT" onChange={(value) => setForm({ ...form, code: value })} />
              </div>
              <LogoField label="URL Logo Khusus" value={form.logoUrl} onChange={(value) => setForm({ ...form, logoUrl: value })} onPreview={setPreviewLogoUrl} onClear={() => setForm({ ...form, logoUrl: "" })} showInlinePreview={false} />
              <FileField label="Upload Logo dari Lokal" onChange={(file) => void uploadLocalLogo(file, (value) => setForm({ ...form, logoUrl: value }))} />
              <Field label="Alamat" value={form.address} onChange={(value) => setForm({ ...form, address: value })} />
            </div>
          </div>
          {message ? <p className="text-sm text-muted-foreground md:col-span-2">{message}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Batal</Button>
            <Button type="submit" disabled={isSubmitting}>
              <Plus className="h-4 w-4" />
              {isSubmitting ? "Menyimpan" : "Simpan Outlet"}
            </Button>
          </div>
        </form>
      </AdminModal>
      <AdminModal
        open={Boolean(modalEditingOutletId)}
        title="Edit Outlet"
        description="Ubah nama, alamat, dan logo outlet."
        size="xl"
        onClose={cancelEdit}
      >
        {modalEditingOutletId ? (
          <div className="space-y-5">
            <div className="grid overflow-hidden rounded-xl border bg-card md:grid-cols-[240px_1fr]">
              <div className="border-b bg-muted/25 p-4 md:border-b-0 md:border-r">
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Logo Outlet</p>
                  <button
                    type="button"
                    className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border bg-background text-muted-foreground"
                    onClick={() => editForm.logoUrl && setPreviewLogoUrl(editForm.logoUrl)}
                    disabled={!editForm.logoUrl}
                    aria-label="Preview logo outlet"
                  >
                    {editForm.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={editForm.logoUrl} alt="Logo outlet" className="h-full w-full object-contain p-4" />
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <ImageIcon className="h-8 w-8" />
                        <span className="text-sm font-medium">Tanpa logo khusus</span>
                      </div>
                    )}
                  </button>
                  <div className="rounded-lg border bg-background px-3 py-2 text-xs text-muted-foreground">
                    {editForm.logoUrl
                      ? isUploadedImageUrl(editForm.logoUrl)
                  ? "Logo dari upload storage lokal."
                        : "Logo dari URL manual."
                      : "Jika kosong, outlet akan memakai logo default bila aktif."}
                  </div>
                </div>
              </div>
              <div className="space-y-4 p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Nama Outlet" value={editForm.name} onChange={(value) => setEditForm({ ...editForm, name: value })} />
                  <LogoField
                    label="URL Logo Khusus"
                    value={editForm.logoUrl}
                    onChange={(value) => setEditForm({ ...editForm, logoUrl: value })}
                    onPreview={setPreviewLogoUrl}
                    onClear={() => setEditForm({ ...editForm, logoUrl: "" })}
                    showInlinePreview={false}
                  />
                </div>
                <FileField label="Upload Logo dari Lokal" onChange={(file) => void uploadLocalLogo(file, (value) => setEditForm({ ...editForm, logoUrl: value }))} />
                <Field label="Alamat" value={editForm.address} onChange={(value) => setEditForm({ ...editForm, address: value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={cancelEdit} disabled={isUpdating}>
                <X className="h-4 w-4" />
                Batal
              </Button>
              <Button type="button" onClick={() => void updateOutlet(modalEditingOutletId)} disabled={isUpdating}>
                <Save className="h-4 w-4" />
                {isUpdating ? "Menyimpan" : "Simpan"}
              </Button>
            </div>
          </div>
        ) : null}
      </AdminModal>
    </div>
  );
}

function FirstRunSetupPanel() {
  return (
    <section className="lg:col-span-2 rounded-lg border border-[#A8DADC] bg-[#F6FBF8] p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1D3557] text-white">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-normal text-[#457B9D]">
              First-run setup
            </p>
            <h2 className="text-xl font-semibold text-[#1D3557]">
              Buat outlet pertama untuk mulai memakai POS.
            </h2>
            <p className="max-w-3xl text-sm leading-6 text-[#1D3557]/75">
              Dashboard, kasir, stok, dan laporan akan aktif setelah outlet
              pertama tersimpan.
            </p>
          </div>
        </div>
        <div className="grid shrink-0 grid-cols-3 gap-2 text-center text-xs font-medium text-[#1D3557]">
          <span className="rounded-md border border-[#A8DADC] bg-white px-3 py-2">
            1. Outlet
          </span>
          <span className="rounded-md border border-[#DDE7DF] bg-white/70 px-3 py-2 text-[#1D3557]/65">
            2. Produk
          </span>
          <span className="rounded-md border border-[#DDE7DF] bg-white/70 px-3 py-2 text-[#1D3557]/65">
            3. Stok
          </span>
        </div>
      </div>
    </section>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{props.label}</Label>
      <Input
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </div>
  );
}

function FileField(props: {
  label: string;
  onChange: (file: File | undefined) => void;
}) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    props.onChange(event.target.files?.[0]);
    event.target.value = "";
  }

  return (
    <div className="space-y-2">
      <Label>{props.label}</Label>
      <label className="group flex min-h-20 cursor-pointer items-center gap-3 rounded-lg border border-dashed bg-muted/20 px-4 py-3 text-sm shadow-sm transition-colors hover:border-primary/50 hover:bg-primary/5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-background text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          <Upload className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block font-semibold text-foreground">Pilih file</span>
          <span className="block text-xs text-muted-foreground">JPG, PNG, WebP, atau GIF</span>
        </span>
        <input type="file" accept="image/*" className="sr-only" onChange={handleChange} />
      </label>
    </div>
  );
}

function LogoField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onPreview: (value: string) => void;
  onClear?: () => void;
  iconOnly?: boolean;
  showInlinePreview?: boolean;
}) {
  const isUploadedImage = isUploadedImageUrl(props.value);
  const isIgnoredUrl = ignoredLogoUrls.has(props.value);
  const urlInputValue = isUploadedImage || isIgnoredUrl ? "" : props.value;
  const previewUrl = props.value;
  return (
    <div className="space-y-2">
      <Label>{props.label}</Label>
      <div className={props.showInlinePreview === false ? "" : "grid gap-3 sm:grid-cols-[72px_1fr]"}>
        {props.showInlinePreview === false ? null : (
          <LogoInlinePreview url={previewUrl} onPreview={props.onPreview} />
        )}
        <div className="min-w-0 space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={urlInputValue}
              placeholder={
                isUploadedImage
                  ? "Logo hasil upload tersimpan"
                  : isIgnoredUrl
                    ? "Logo bawaan tersimpan"
                  : "Tempel URL logo atau upload dari lokal"
              }
              onChange={(event) => props.onChange(event.target.value)}
            />
            {props.value ? (
              <>
                <OutletIconButton
                  type="button"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={props.onClear ?? (() => props.onChange(""))}
                  aria-label="Hapus logo"
                  title="Hapus logo"
                >
                  <Trash2 className="h-4 w-4" />
                </OutletIconButton>
              </>
            ) : null}
          </div>
        </div>
      </div>
      {isUploadedImage || isIgnoredUrl ? (
        <p className="text-xs text-muted-foreground">
          {isUploadedImage
            ? "Logo ini berasal dari upload file lokal. URL manual dikosongkan."
            : "Logo bawaan ditampilkan, tetapi path direktori tidak ditampilkan di input URL."}
        </p>
      ) : null}
    </div>
  );
}

function LogoInlinePreview(props: { url: string; onPreview: (value: string) => void }) {
  return (
    <button
      type="button"
      className="flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-lg border bg-muted/30 text-muted-foreground disabled:cursor-default"
      onClick={() => props.url && props.onPreview(props.url)}
      disabled={!props.url}
      aria-label="Preview logo"
      title={props.url ? "Preview logo" : "Belum ada logo"}
    >
      {props.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={props.url} alt="Preview logo" className="h-full w-full object-contain p-1.5" />
      ) : (
        <ImageIcon className="h-6 w-6" />
      )}
    </button>
  );
}

function isUploadedImageUrl(value: string) {
  return value.startsWith("/api/uploads/images");
}

function LogoPreviewModal(props: { url: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-lg border bg-background p-4 shadow-lg">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold">Preview Logo</p>
            <p className="text-sm text-muted-foreground">
              Logo outlet yang akan dipakai di dashboard dan kasir.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={props.onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex min-h-56 items-center justify-center overflow-hidden rounded-lg border bg-muted/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={props.url}
            alt="Preview logo outlet"
            className="max-h-72 w-full object-contain p-4"
          />
        </div>
      </div>
    </div>
  );
}
