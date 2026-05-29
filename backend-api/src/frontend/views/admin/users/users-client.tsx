"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  Eye,
  EyeOff,
  ImageUp,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Save,
  UserCircle,
  Users,
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
import { getOutlets, getProfile } from "@/frontend/controllers/admin-data-cache";

type Outlet = { id: string; name: string; code: string };
type UserRow = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  isActive: boolean;
  outlets: Array<{ outlet: Outlet }>;
};
type ApiResponse<T> = { data: T };
type Profile = { role: string };
type EditUserForm = {
  name: string;
  email: string;
  image: string;
  password: string;
  role: string;
  isActive: boolean;
  outletIds: string[];
};

const roleOptions = [
  { value: "cashier", label: "Kasir" },
  { value: "warehouse", label: "Staff Gudang" },
  { value: "auditor", label: "Auditor" },
  { value: "admin_outlet", label: "Admin Outlet" },
  { value: "owner", label: "Owner" },
];

const roleRank: Record<string, number> = {
  cashier: 10,
  warehouse: 20,
  auditor: 30,
  admin_outlet: 40,
  owner: 50,
};

export function UsersClient() {
  const access = useRolePermissions("users");
  const { showToast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    image: "",
    password: "Pwd!12345",
    role: "cashier",
    outletIds: [] as string[],
  });
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditUserForm | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name-asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const visibleUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return users
      .filter((user) => {
        const outletNames = user.outlets
          .map((item) => `${item.outlet.name} ${item.outlet.code}`)
          .join(" ");
        const matchesSearch =
          !keyword ||
          [user.name, user.email, user.role, outletNames]
            .join(" ")
            .toLowerCase()
            .includes(keyword);
        const matchesRole = roleFilter === "all" || user.role === roleFilter;
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "active" && user.isActive) ||
          (statusFilter === "inactive" && !user.isActive);
        return matchesSearch && matchesRole && matchesStatus;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "name-desc":
            return b.name.localeCompare(a.name);
          case "email-asc":
            return a.email.localeCompare(b.email);
          case "role-asc":
            return a.role.localeCompare(b.role) || a.name.localeCompare(b.name);
          case "status":
            return (
              Number(b.isActive) - Number(a.isActive) ||
              a.name.localeCompare(b.name)
            );
          default:
            return a.name.localeCompare(b.name);
        }
      });
  }, [roleFilter, search, sortBy, statusFilter, users]);
  const availableRoleOptions = useMemo(
    () =>
      currentRole
        ? roleOptions.filter((role) => roleRank[currentRole] > roleRank[role.value])
        : [],
    [currentRole],
  );
  const pagedUsers = pageItems(visibleUsers, page, pageSize);

  async function loadData() {
    setIsLoading(true);
    try {
      const [profile, usersResponse, cachedOutlets] = await Promise.all([
        getProfile(),
        fetch("/api/users"),
        getOutlets(),
      ]);
      if (usersResponse.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      if (!usersResponse.ok) {
        setMessage("Gagal memuat user/outlet.");
        setIsLoading(false);
        return;
      }
      const usersJson = (await usersResponse.json()) as ApiResponse<UserRow[]>;
      const outletRows = cachedOutlets as Outlet[];
      setCurrentRole(profile.role);
      setUsers(usersJson.data);
      setOutlets(outletRows);
      setForm((current) => ({
        ...current,
        role:
          roleRank[profile.role] > roleRank[current.role]
            ? current.role
            : firstRoleBelow(profile.role),
        outletIds: current.outletIds.length
          ? current.outletIds
          : outletRows[0]
            ? [outletRows[0].id]
            : [],
      }));
      setIsLoading(false);
    } catch {
      setMessage("Gagal memuat user/outlet.");
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentRole || roleRank[currentRole] <= roleRank[form.role]) {
      setMessage("Role hanya boleh membuat user dengan role di bawahnya.");
      showToast({ tone: "error", title: "Role tidak diizinkan" });
      return;
    }
    const validationError = validateUserForm(form, true);
    if (validationError) {
      setMessage(validationError);
      showToast({ tone: "error", title: validationError });
      return;
    }
    setIsSubmitting(true);
    setMessage(null);
    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!response.ok) {
      setMessage(await readErrorMessage(response, "User gagal dibuat."));
      showToast({
        tone: "error",
        title: "User gagal dibuat",
        description: "Periksa email unik, password, role, dan akses outlet.",
      });
      setIsSubmitting(false);
      return;
    }
    setForm({
      name: "",
      email: "",
      image: "",
      password: "Pwd!12345",
      role: "cashier",
      outletIds: form.outletIds,
    });
    setMessage("User berhasil dibuat.");
    showToast({ tone: "success", title: "User berhasil dibuat" });
    await loadData();
    setIsSubmitting(false);
  }

  function toggleOutlet(outletId: string) {
    setForm((current) => ({
      ...current,
      outletIds: current.outletIds.includes(outletId)
        ? current.outletIds.filter((id) => id !== outletId)
        : [...current.outletIds, outletId],
    }));
  }

  function startEdit(user: UserRow) {
    setEditingUserId(user.id);
    const nextRole = currentRole && roleRank[currentRole] > roleRank[user.role]
      ? user.role
      : firstRoleBelow(currentRole);
    setEditForm({
      name: user.name,
      email: user.email,
      image: user.image ?? "",
      password: "",
      role: nextRole,
      isActive: user.isActive,
      outletIds: user.outlets.map((item) => item.outlet.id),
    });
  }

  function cancelEdit() {
    setEditingUserId(null);
    setEditForm(null);
  }

  function toggleEditOutlet(outletId: string) {
    setEditForm((current) =>
      current
        ? {
            ...current,
            outletIds: current.outletIds.includes(outletId)
              ? current.outletIds.filter((id) => id !== outletId)
              : [...current.outletIds, outletId],
          }
        : current,
    );
  }

  async function updateUser(
    userId: string,
    nextForm = editForm,
    options: { skipStatusConfirm?: boolean; showSuccessToast?: boolean } = {},
  ) {
    if (!nextForm) return false;
    if (!currentRole || roleRank[currentRole] <= roleRank[nextForm.role]) {
      setMessage("Role hanya boleh mengelola user dengan role di bawahnya.");
      showToast({ tone: "error", title: "Role tidak diizinkan" });
      return false;
    }
    const validationError = validateUserForm(nextForm, false);
    if (validationError) {
      setMessage(validationError);
      showToast({ tone: "error", title: validationError });
      return false;
    }
    const existing = users.find((user) => user.id === userId);
    if (existing && currentRole && roleRank[currentRole] <= roleRank[existing.role]) {
      setMessage("Role hanya boleh mengelola user dengan role di bawahnya.");
      showToast({ tone: "error", title: "Role tidak diizinkan" });
      return false;
    }
    if (
      existing &&
      existing.isActive !== nextForm.isActive &&
      !options.skipStatusConfirm &&
      !(await confirmAction(
        `Yakin ingin ${nextForm.isActive ? "mengaktifkan" : "menonaktifkan"} user ${existing.name}?`,
      ))
    ) {
      return false;
    }
    setIsUpdating(true);
    setMessage(null);

    const response = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: nextForm.name,
        email: nextForm.email,
        image: nextForm.image || null,
        password: nextForm.password || undefined,
        role: nextForm.role,
        isActive: nextForm.isActive,
        outletIds: nextForm.outletIds,
      }),
    });

    if (!response.ok) {
      setMessage(await readErrorMessage(response, "User gagal diperbarui."));
      showToast({
        tone: "error",
        title: "User gagal diperbarui",
        description: "Periksa email unik, password, role, dan akses outlet.",
      });
      setIsUpdating(false);
      return false;
    }

    setMessage("User berhasil diperbarui.");
    if (options.showSuccessToast !== false) {
      showToast({ tone: "success", title: "User berhasil diperbarui" });
    }
    cancelEdit();
    await loadData();
    setIsUpdating(false);
    return true;
  }

  async function toggleUser(userItem: UserRow) {
    if (!currentRole || roleRank[currentRole] <= roleRank[userItem.role]) {
      showToast({ tone: "info", title: "Role tidak diizinkan" });
      return;
    }
    const nextActive = !userItem.isActive;
    if (
      !(await confirmAction(
        `Yakin ingin ${nextActive ? "mengaktifkan" : "menonaktifkan"} user ${userItem.name}?`,
      ))
    ) {
      return;
    }
    const nextForm: EditUserForm = {
      name: userItem.name,
      email: userItem.email,
      image: userItem.image ?? "",
      password: "",
      role: userItem.role,
      isActive: nextActive,
      outletIds: userItem.outlets.map((item) => item.outlet.id),
    };
    const success = await updateUser(userItem.id, nextForm, {
      skipStatusConfirm: true,
      showSuccessToast: false,
    });
    if (!success) return;
    showToast({
      tone: "success",
      title: nextActive ? "User diaktifkan" : "User dinonaktifkan",
      description: userItem.name,
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
      {access.canCreate ? (
      <CollapsibleSection
      title="Buat User / Kasir"
        description="Role yang memiliki akses User hanya dapat membuat role di bawah levelnya."
      >
        <form className="space-y-4" onSubmit={onSubmit}>
          <Field
            label="Nama"
            value={form.name}
            onChange={(value) => setForm({ ...form, name: value })}
          />
          <Field
            label="Email"
            type="email"
            value={form.email}
            onChange={(value) => setForm({ ...form, email: value })}
          />
          <ImageUploadField
            label="Foto User"
            value={form.image}
            onChange={(value) => setForm({ ...form, image: value })}
            onError={setMessage}
          />
          <PasswordField
            label="Password Awal"
            value={form.password}
            onChange={(value) => setForm({ ...form, password: value })}
          />
          <div className="space-y-2">
            <Label>Role</Label>
            <select
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={form.role}
              onChange={(event) =>
                setForm({ ...form, role: event.target.value })
              }
            >
              {availableRoleOptions.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Akses Outlet</Label>
            <div className="grid gap-2 rounded-md border p-3">
              {outlets.map((outlet) => (
                <label
                  key={outlet.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={form.outletIds.includes(outlet.id)}
                    onChange={() => toggleOutlet(outlet.id)}
                  />
                  {outlet.name} ({outlet.code})
                </label>
              ))}
            </div>
          </div>
          <AlertMessage message={message} />
          <Button type="submit" disabled={isSubmitting || isLoading}>
            <Plus className="h-4 w-4" />
            {isSubmitting ? "Menyimpan" : "Simpan User"}
          </Button>
        </form>
      </CollapsibleSection>
      ) : null}

      <CollapsibleSection
        className="lg:col-span-2"
        title="Daftar User"
        description={`${visibleUsers.length} dari ${users.length} user terdaftar.`}
        isLoading={isLoading}
        loadingText="Memuat daftar user dan akses outlet..."
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
          searchPlaceholder="Cari nama, email, outlet..."
          filters={[
            {
              label: "Role",
              value: roleFilter,
              onChange: setRoleFilter,
              options: [{ value: "all", label: "Semua role" }, ...availableRoleOptions],
            },
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
            { value: "email-asc", label: "Email A-Z" },
            { value: "role-asc", label: "Role" },
            { value: "status", label: "Status aktif" },
          ]}
        />
        <div className="mt-4">
          <PaginationControls
            page={page}
            pageSize={pageSize}
            total={visibleUsers.length}
            onPageChange={setPage}
            onPageSizeChange={(value) => {
              setPageSize(value);
              setPage(1);
            }}
          />
        </div>
        <div className="mt-4 space-y-3">
          {pagedUsers.map((user) => (
            <div key={user.id} className="rounded-lg border p-4">
              {editingUserId === user.id && editForm ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field
                      label="Nama"
                      value={editForm.name}
                      onChange={(value) =>
                        setEditForm({ ...editForm, name: value })
                      }
                    />
                    <Field
                      label="Email"
                      type="email"
                      value={editForm.email}
                      onChange={(value) =>
                        setEditForm({ ...editForm, email: value })
                      }
                    />
                    <Field
                      label="Foto / URL Gambar"
                      value={editForm.image}
                      onChange={(value) =>
                        setEditForm({ ...editForm, image: value })
                      }
                    />
                    <PasswordField
                      label="Password Baru"
                      value={editForm.password}
                      placeholder="Kosongkan jika tidak diganti"
                      onChange={(value) =>
                        setEditForm({ ...editForm, password: value })
                      }
                    />
                    <ImageUploadField
                      label="Upload Foto Lokal"
                      value={editForm.image}
                      onChange={(value) =>
                        setEditForm({ ...editForm, image: value })
                      }
                      onError={setMessage}
                    />
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <select
                        className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={editForm.role}
                        onChange={(event) =>
                          setEditForm({
                            ...editForm,
                            role: event.target.value,
                          })
                        }
                      >
                        {availableRoleOptions.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editForm.isActive}
                        onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          isActive: event.target.checked,
                        })
                      }
                    />
                    User aktif dan bisa login
                  </label>
                  <div className="space-y-2">
                    <Label>Akses Outlet</Label>
                    <div className="grid gap-2 rounded-md border p-3 md:grid-cols-2">
                      {outlets.map((outlet) => (
                        <label
                          key={outlet.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={editForm.outletIds.includes(outlet.id)}
                            onChange={() => toggleEditOutlet(outlet.id)}
                          />
                          {outlet.name} ({outlet.code})
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => void updateUser(user.id)}
                      disabled={isUpdating}
                    >
                      <Save className="h-4 w-4" />
                      {isUpdating ? "Menyimpan" : "Simpan Perubahan"}
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
                <div className="flex flex-col justify-between gap-3 md:flex-row">
                  <div className="flex min-w-0 items-start gap-3">
                    {user.image ? (
                      <div
                        className="h-12 w-12 shrink-0 rounded-md border object-cover"
                        style={{
                          backgroundImage: `url("${user.image.replaceAll('"', "%22")}")`,
                          backgroundPosition: "center",
                          backgroundSize: "cover",
                        }}
                        aria-hidden="true"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border bg-muted">
                        <UserCircle className="h-6 w-6 text-primary" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {user.email}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {user.role} - {user.isActive ? "Aktif" : "Nonaktif"}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Outlet:{" "}
                        {user.outlets
                          .map((item) => item.outlet.name)
                          .join(", ") || "Belum ada akses"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {access.canEdit ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => startEdit(user)}
                        >
                          <Edit3 className="h-4 w-4" />
                          Edit
                        </Button>
                        {user.role !== "owner" ? (
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => void toggleUser(user)}
                            disabled={isUpdating}
                          >
                            {user.isActive ? (
                              <PowerOff className="h-4 w-4" />
                            ) : (
                              <Power className="h-4 w-4" />
                            )}
                            {user.isActive ? "Nonaktifkan" : "Aktifkan"}
                          </Button>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          ))}
          {!visibleUsers.length && !isLoading ? (
            <p className="text-sm text-muted-foreground">
              Data user tidak ditemukan.
            </p>
          ) : null}
        </div>
      </CollapsibleSection>
    </div>
  );
}

function AlertMessage(props: { message: string | null }) {
  if (!props.message) return null;
  const isSuccess = props.message.toLowerCase().includes("berhasil");
  const tone = isSuccess
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-destructive/30 bg-red-50 text-destructive";
  const Icon = isSuccess ? CheckCircle2 : AlertCircle;

  return (
    <div className={`flex items-start gap-2 rounded-md border p-3 text-sm ${tone}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{props.message}</p>
    </div>
  );
}

function PasswordField(props: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="space-y-2">
      <Label>{props.label}</Label>
      <div className="relative">
        <Input
          type={isVisible ? "text" : "password"}
          className="pr-10"
          value={props.value}
          placeholder={props.placeholder}
          onChange={(event) => props.onChange(event.target.value)}
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => setIsVisible((current) => !current)}
          aria-label={isVisible ? "Sembunyikan password" : "Lihat password"}
        >
          {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function ImageUploadField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onError: (message: string) => void;
}) {
  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      props.onError("File foto harus berupa gambar.");
      return;
    }
    if (file.size > 1024 * 1024) {
      props.onError("Ukuran foto maksimal 1 MB agar dashboard tetap ringan.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        props.onChange(reader.result);
      }
    };
    reader.onerror = () => props.onError("Gagal membaca file foto lokal.");
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-2">
      <Label>{props.label}</Label>
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
        <ImageUp className="h-4 w-4" />
        Pilih gambar lokal
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={onFileChange}
        />
      </label>
      {props.value ? (
        <div className="flex items-center gap-3">
          <div
            className="h-16 w-16 rounded-md border bg-muted"
            style={{
              backgroundImage: `url("${props.value.replaceAll('"', "%22")}")`,
              backgroundPosition: "center",
              backgroundSize: "cover",
            }}
            aria-label="Preview foto user"
          />
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              if (await confirmAction("Hapus foto user ini?")) {
                props.onChange("");
              }
            }}
          >
            <X className="h-4 w-4" />
            Hapus foto
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function validateUserForm(
  form: {
    name: string;
    email: string;
    password?: string;
    role: string;
    outletIds: string[];
  },
  requiresPassword: boolean,
) {
  if (!form.name.trim()) return "Nama wajib diisi.";
  if (!form.email.trim()) return "Email wajib diisi.";
  if (!/^\S+@\S+\.\S+$/.test(form.email)) return "Format email belum valid.";
  if (requiresPassword && !form.password) return "Password wajib diisi.";
  if (form.password && form.password.length < 8) {
    return "Password minimal 8 karakter.";
  }
  if (!roleOptions.some((role) => role.value === form.role)) {
    return "Role wajib dipilih dengan benar.";
  }
  if (!form.outletIds.length && !["owner", "auditor"].includes(form.role)) {
    return "Pilih minimal satu akses outlet untuk role ini.";
  }
  return null;
}

function firstRoleBelow(role: string | null) {
  if (!role) return "cashier";
  return roleOptions.find((option) => roleRank[role] > roleRank[option.value])?.value ?? "cashier";
}

async function readErrorMessage(response: Response, fallback: string) {
  try {
    const json = (await response.json()) as {
      error?: { message?: string; details?: { fieldErrors?: Record<string, string[]> } };
    };
    const fieldErrors = json.error?.details?.fieldErrors;
    const firstFieldError = fieldErrors
      ? Object.entries(fieldErrors).find(([, errors]) => errors.length)
      : null;
    if (firstFieldError) {
      return `${fallback} ${firstFieldError[0]}: ${firstFieldError[1][0]}`;
    }
    if (json.error?.message) {
      return `${fallback} ${json.error.message}`;
    }
  } catch {
    // Use fallback below.
  }
  return `${fallback} Periksa email unik, password, role, dan akses outlet.`;
}

function Field(props: {
  label: string;
  value: string;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{props.label}</Label>
      <Input
        type={props.type ?? "text"}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </div>
  );
}
