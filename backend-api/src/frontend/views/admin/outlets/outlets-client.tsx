"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Edit3,
  Eye,
  ImageIcon,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CollapsibleSection } from "../_components/collapsible-section";
import { ListControls } from "../_components/list-controls";
import {
  PaginationControls,
  pageItems,
} from "../_components/pagination-controls";
import { confirmAction, useToast } from "../_components/toast-provider";
import { useRolePermissions } from "../_components/use-role-permissions";
import { clearAdminDataCache } from "@/frontend/controllers/admin-data-cache";

type Outlet = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  logoUrl: string | null;
  isActive: boolean;
};

type ApiResponse<T> = { data: T };
type Settings = {
  defaultOutletLogoUrl: string | null;
};

export function OutletsClient() {
  const access = useRolePermissions("outlets");
  const { showToast } = useToast();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [settings, setSettings] = useState<Settings>({
    defaultOutletLogoUrl: null,
  });
  const [defaultLogoUrl, setDefaultLogoUrl] = useState("");
  const [form, setForm] = useState({
    name: "",
    code: "",
    address: "",
    logoUrl: "",
  });
  const [editingOutletId, setEditingOutletId] = useState<string | null>(null);
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
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name-asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [previewLogoUrl, setPreviewLogoUrl] = useState<string | null>(null);

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
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "active" && outlet.isActive) ||
          (statusFilter === "inactive" && !outlet.isActive);
        return matchesSearch && matchesStatus;
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
  }, [outlets, search, sortBy, statusFilter]);
  const pagedOutlets = pageItems(visibleOutlets, page, pageSize);

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
    setDefaultLogoUrl(settingsJson.data.defaultOutletLogoUrl ?? "");
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
    setForm({ name: "", code: "", address: "", logoUrl: "" });
    setMessage("Outlet berhasil dibuat.");
    showToast({ tone: "success", title: "Outlet berhasil dibuat" });
    clearAdminDataCache(["outlets"]);
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
        defaultOutletLogoUrl: defaultLogoUrl || null,
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
    setDefaultLogoUrl(json.data.defaultOutletLogoUrl ?? "");
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
      body: JSON.stringify({ defaultOutletLogoUrl: null }),
    });
    if (!response.ok) {
      setMessage("Logo default gagal dihapus.");
      showToast({ tone: "error", title: "Logo default gagal dihapus" });
      setIsUpdating(false);
      return;
    }
    setSettings({ defaultOutletLogoUrl: null });
    setDefaultLogoUrl("");
    setMessage("Logo default outlet berhasil dihapus.");
    showToast({ tone: "success", title: "Logo default outlet dihapus" });
    setIsUpdating(false);
  }

  async function applyLocalLogo(
    file: File | undefined,
    onChange: (value: string) => void,
  ) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("File logo harus berupa gambar.");
      return;
    }
    if (file.size > 1024 * 1024) {
      setMessage("Ukuran logo maksimal 1 MB.");
      return;
    }
    const dataUrl = await readImageFile(file);
    onChange(dataUrl);
    setMessage("Logo lokal siap disimpan.");
  }

  function startEdit(outlet: Outlet) {
    setEditingOutletId(outlet.id);
    setEditForm({
      name: outlet.name,
      address: outlet.address ?? "",
      logoUrl: outlet.logoUrl ?? "",
    });
  }

  function cancelEdit() {
    setEditingOutletId(null);
    setEditForm({ name: "", address: "", logoUrl: "" });
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
    <div className="grid items-start gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      {access.canCreate ? (
        <CollapsibleSection
          title="Tambah Outlet"
          description="Outlet dipakai untuk akses kasir, stok, laporan, dan katalog."
        >
          <form className="space-y-4" onSubmit={onSubmit}>
            <Field
              label="Nama Outlet"
              value={form.name}
              onChange={(value) => setForm({ ...form, name: value })}
            />
            <Field
              label="Kode Outlet"
              value={form.code}
              onChange={(value) => setForm({ ...form, code: value })}
            />
            <Field
              label="Alamat"
              value={form.address}
              onChange={(value) => setForm({ ...form, address: value })}
            />
            <LogoField
              label="Logo Khusus"
              value={form.logoUrl}
              onChange={(value) => setForm({ ...form, logoUrl: value })}
              onPreview={setPreviewLogoUrl}
              onClear={() => setForm({ ...form, logoUrl: "" })}
            />
            <FileField
              label="Ambil Logo dari Lokal"
              onChange={(file) =>
                void applyLocalLogo(file, (value) =>
                  setForm({ ...form, logoUrl: value }),
                )
              }
            />
            {message ? (
              <p className="text-sm text-muted-foreground">{message}</p>
            ) : null}
            <Button type="submit" disabled={isSubmitting}>
              <Plus className="h-4 w-4" />
              {isSubmitting ? "Menyimpan" : "Simpan Outlet"}
            </Button>
          </form>
        </CollapsibleSection>
      ) : null}

      {access.canEdit ? (
        <CollapsibleSection
          title="Logo Default Outlet"
          description="Dipakai semua outlet yang belum punya logo khusus."
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border bg-muted">
              {settings.defaultOutletLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={settings.defaultOutletLogoUrl}
                  alt="Logo default outlet"
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <LogoField
                label="Logo Default"
                value={defaultLogoUrl}
                onChange={setDefaultLogoUrl}
                onPreview={setPreviewLogoUrl}
                onClear={() => void clearDefaultLogo()}
              />
              <div className="mt-3">
                <FileField
                  label="Ambil Logo Default dari Lokal"
                  onChange={(file) =>
                    void applyLocalLogo(file, setDefaultLogoUrl)
                  }
                />
              </div>
            </div>
            <Button
              type="button"
              onClick={() => void updateDefaultLogo()}
              disabled={isUpdating}
            >
              <Save className="h-4 w-4" />
              Simpan Logo
            </Button>
          </div>
        </CollapsibleSection>
      ) : null}

      <CollapsibleSection
        className="lg:col-span-2"
        title="Daftar Outlet"
        description={`${visibleOutlets.length} dari ${outlets.length} outlet terdaftar.`}
        isLoading={isLoading}
        loadingText="Memuat daftar outlet..."
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadData()}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        }
      >
        <ListControls
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Cari nama, kode, alamat..."
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
          ]}
          sort={sortBy}
          onSortChange={setSortBy}
          sortOptions={[
            { value: "name-asc", label: "Nama A-Z" },
            { value: "name-desc", label: "Nama Z-A" },
            { value: "code-asc", label: "Kode A-Z" },
            { value: "code-desc", label: "Kode Z-A" },
            { value: "status", label: "Status aktif" },
          ]}
        />
        <div className="mt-4">
          <PaginationControls
            page={page}
            pageSize={pageSize}
            total={visibleOutlets.length}
            onPageChange={setPage}
            onPageSizeChange={(value) => {
              setPageSize(value);
              setPage(1);
            }}
          />
        </div>
        <div className="mt-4 grid gap-3">
          {pagedOutlets.map((outlet) => (
            <div key={outlet.id} className="rounded-lg border p-4">
              <div className="flex items-start gap-3">
                {outlet.logoUrl || settings.defaultOutletLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={outlet.logoUrl || settings.defaultOutletLogoUrl || ""}
                    alt={outlet.name}
                    className="h-12 w-12 rounded-lg border object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg border bg-muted">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {editingOutletId === outlet.id ? (
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field
                          label="Nama Outlet"
                          value={editForm.name}
                          onChange={(value) =>
                            setEditForm({ ...editForm, name: value })
                          }
                        />
                        <div className="space-y-3">
                          <LogoField
                            label="Logo"
                            value={editForm.logoUrl}
                            onChange={(value) =>
                              setEditForm({ ...editForm, logoUrl: value })
                            }
                            onPreview={setPreviewLogoUrl}
                            onClear={() =>
                              outlet.logoUrl
                                ? void clearOutletLogo(outlet.id)
                                : setEditForm({ ...editForm, logoUrl: "" })
                            }
                          />
                          <FileField
                            label="Ambil Logo dari Lokal"
                            onChange={(file) =>
                              void applyLocalLogo(file, (value) =>
                                setEditForm({ ...editForm, logoUrl: value }),
                              )
                            }
                          />
                        </div>
                        <div className="md:col-span-2">
                          <Field
                            label="Alamat"
                            value={editForm.address}
                            onChange={(value) =>
                              setEditForm({ ...editForm, address: value })
                            }
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          onClick={() => void updateOutlet(outlet.id)}
                          disabled={isUpdating}
                        >
                          <Save className="h-4 w-4" />
                          {isUpdating ? "Menyimpan" : "Simpan"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={cancelEdit}
                          disabled={isUpdating}
                        >
                          <X className="h-4 w-4" />
                          Batal
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{outlet.name}</p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            outlet.isActive
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {outlet.isActive ? "Aktif" : "Nonaktif"}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {outlet.code}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {outlet.address || "Alamat belum diisi"}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <ImageIcon className="h-3.5 w-3.5" />
                        <span>
                          {outlet.logoUrl
                            ? "Logo khusus tersedia"
                            : settings.defaultOutletLogoUrl
                              ? "Memakai logo default"
                              : "Logo belum diisi"}
                        </span>
                        {outlet.logoUrl || settings.defaultOutletLogoUrl ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() =>
                              setPreviewLogoUrl(
                                outlet.logoUrl || settings.defaultOutletLogoUrl,
                              )
                            }
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Preview
                          </Button>
                        ) : null}
                        {outlet.logoUrl && access.canEdit ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-destructive hover:text-destructive"
                            onClick={() => void clearOutletLogo(outlet.id)}
                            disabled={isUpdating}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Hapus Logo
                          </Button>
                        ) : null}
                      </div>
                      {access.canEdit ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => startEdit(outlet)}
                          >
                            <Edit3 className="h-4 w-4" />
                            Edit Outlet
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => void toggleOutlet(outlet)}
                            disabled={isUpdating}
                          >
                            {outlet.isActive ? (
                              <PowerOff className="h-4 w-4" />
                            ) : (
                              <Power className="h-4 w-4" />
                            )}
                            {outlet.isActive ? "Nonaktifkan" : "Aktifkan"}
                          </Button>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
          {!visibleOutlets.length && !isLoading ? (
            <p className="text-sm text-muted-foreground">
              Data outlet tidak ditemukan.
            </p>
          ) : null}
        </div>
      </CollapsibleSection>
      {previewLogoUrl ? (
        <LogoPreviewModal
          url={previewLogoUrl}
          onClose={() => setPreviewLogoUrl(null)}
        />
      ) : null}
    </div>
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
  return (
    <div className="space-y-2">
      <Label>{props.label}</Label>
      <Input
        type="file"
        accept="image/*"
        onChange={(event) => props.onChange(event.target.files?.[0])}
      />
    </div>
  );
}

function LogoField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onPreview: (value: string) => void;
  onClear?: () => void;
}) {
  const isLocalImage = props.value.startsWith("data:image/");
  return (
    <div className="space-y-2">
      <Label>{props.label}</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={isLocalImage ? "" : props.value}
          placeholder={
            isLocalImage
              ? "Logo lokal siap disimpan"
              : "Tempel URL logo atau upload dari lokal"
          }
          onChange={(event) => props.onChange(event.target.value)}
        />
        {props.value ? (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => props.onPreview(props.value)}
            >
              <Eye className="h-4 w-4" />
              Preview Logo
            </Button>
            <Button
              type="button"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={props.onClear ?? (() => props.onChange(""))}
            >
              <Trash2 className="h-4 w-4" />
              Hapus Logo
            </Button>
          </>
        ) : null}
      </div>
      {isLocalImage ? (
        <p className="text-xs text-muted-foreground">
          Data logo lokal disembunyikan agar form tetap rapi.
        </p>
      ) : null}
    </div>
  );
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

function readImageFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result?.toString() ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
