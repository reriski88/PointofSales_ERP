"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  CheckCircle2,
  Edit3,
  Eye,
  EyeOff,
  ImageUp,
  KeyRound,
  Plus,
  Power,
  PowerOff,
  Save,
  Search,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CollapsibleSection } from "../_components/collapsible-section";
import { AdminModal } from "../_components/admin-modal";
import { ListControls } from "../_components/list-controls";
import {
  PaginationControls,
  pageItems,
} from "../_components/pagination-controls";
import { confirmAction, useToast } from "../_components/toast-provider";
import { useRolePermissions } from "../_components/use-role-permissions";
import { SearchableSelect } from "../_components/searchable-select";
import { clearAdminDataCache, getOutlets, getProfile } from "@/frontend/controllers/admin-data-cache";
import { compressProfileImage } from "@/frontend/lib/image-compression";

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
type UploadResponse = { url: string; key: string };
type Profile = { id?: string; role: string };
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
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
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [modalEditingUserId, setModalEditingUserId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditUserForm | null>(null);
  const [passwordUser, setPasswordUser] = useState<UserRow | null>(null);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [isPasswordUpdating, setIsPasswordUpdating] = useState(false);
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
      setCurrentUserId(profile.id ?? null);
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
    setIsCreateOpen(false);
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
    setEditingUserId(null);
    setModalEditingUserId(user.id);
    const isSelf = user.id === currentUserId;
    const nextRole = isSelf
      ? user.role
      : currentRole && roleRank[currentRole] > roleRank[user.role]
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
    setModalEditingUserId(null);
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
    const isSelf = userId === currentUserId;
    if (!isSelf && (!currentRole || roleRank[currentRole] <= roleRank[nextForm.role])) {
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
    if (!isSelf && existing && currentRole && roleRank[currentRole] <= roleRank[existing.role]) {
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
      body: JSON.stringify(
        isSelf
          ? {
              name: nextForm.name,
              image: nextForm.image || null,
            }
          : {
              name: nextForm.name,
              email: nextForm.email,
              image: nextForm.image || null,
              role: nextForm.role,
              isActive: nextForm.isActive,
              outletIds: nextForm.outletIds,
            },
      ),
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
    if (isSelf) {
      clearAdminDataCache(["profile"]);
      window.dispatchEvent(new Event("pos-profile-updated"));
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

  function openPasswordModal(userItem: UserRow) {
    setPasswordUser(userItem);
    setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setMessage(null);
  }

  function closePasswordModal() {
    setPasswordUser(null);
    setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setIsPasswordUpdating(false);
  }

  async function updatePassword() {
    if (!passwordUser) return;
    if (!passwordForm.currentPassword) {
      setMessage(passwordUser.id === currentUserId ? "Password lama wajib diisi." : "Password admin wajib diisi sebagai konfirmasi.");
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setMessage("Password baru minimal 8 karakter.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage("Re-enter password baru tidak sama.");
      return;
    }

    setIsPasswordUpdating(true);
    setMessage(null);
    const response = await fetch(`/api/users/${passwordUser.id}/password`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(passwordForm),
    });
    if (!response.ok) {
      const errorText = await readErrorMessage(response, "Password gagal diperbarui.");
      setMessage(errorText);
      showToast({ tone: "error", title: "Password gagal diperbarui", description: errorText });
      setIsPasswordUpdating(false);
      return;
    }
    showToast({ tone: "success", title: "Password berhasil diperbarui", description: passwordUser.name });
    closePasswordModal();
  }

  return (
    <div className="space-y-6">
      {false && access.canCreate ? (
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
            <SearchableSelect
              value={form.role}
              onChange={(value) => setForm({ ...form, role: value })}
              options={availableRoleOptions}
              placeholder="Pilih role"
              searchPlaceholder="Cari role..."
              emptyText="Role tidak tersedia."
            />
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
        title="Daftar User"
        description="Pengguna dipakai untuk login dashboard, kasir, akses outlet, dan pembagian role kerja."
        showDescription
        isLoading={isLoading}
        loadingText="Memuat daftar user dan akses outlet..."
        actions={access.canCreate ? <Button type="button" className="h-10 w-10 p-0" onClick={() => setIsCreateOpen(true)} aria-label="Tambah user" title="Tambah user"><Plus className="h-4 w-4" /></Button> : null}
      >
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="flex flex-col gap-3 border-b px-4 py-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span>Show</span>
              <select className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
                {[5, 10, 20, 50, 100].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <span>entries</span>
              <select className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setPage(1); }}>
                <option value="all">Semua role</option>{availableRoleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <select className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}>
                <option value="all">Semua</option><option value="active">Aktif</option><option value="inactive">Nonaktif</option>
              </select>
            </div>
            <div className="relative md:w-80"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" /><Input className="h-11 rounded-lg pl-11" value={search} placeholder="Search..." onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></div>
          </div>
          <div className="thin-x-scroll overflow-x-auto">
            <table className="min-w-[1040px] table-fixed border-collapse text-sm">
              <colgroup><col className="w-[260px]" /><col className="w-[240px]" /><col className="w-[140px]" /><col className="w-[260px]" /><col className="w-[120px]" /><col className="w-[190px]" /></colgroup>
              <thead className="border-b bg-background text-xs font-semibold text-foreground"><tr><th className="px-4 py-3 text-left"><button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setSortBy(sortBy === "name-asc" ? "name-desc" : "name-asc")}>User <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" /></button></th><th className="px-4 py-3 text-left"><button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setSortBy("email-asc")}>Email <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" /></button></th><th className="px-4 py-3 text-left"><button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setSortBy("role-asc")}>Role <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" /></button></th><th className="px-4 py-3 text-left">Outlet</th><th className="px-4 py-3 text-left"><button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setSortBy("status")}>Status <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" /></button></th><th className="px-4 py-3 text-right">Aksi</th></tr></thead>
              <tbody className="bg-background">
                {pagedUsers.map((user) => (
                  <tr key={user.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3 align-middle"><div className="flex min-w-0 items-center gap-3">{user.image ? <Image src={user.image} alt={`Foto ${user.name}`} width={40} height={40} unoptimized className="h-10 w-10 shrink-0 rounded-md border bg-muted object-cover" /> : <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-muted"><UserCircle className="h-5 w-5 text-primary" /></div>}<p className="truncate font-medium">{user.name}</p></div></td>
                    <td className="truncate px-4 py-3 align-middle text-muted-foreground">{user.email}</td>
                    <td className="truncate px-4 py-3 align-middle text-muted-foreground">{user.role}</td>
                    <td className="truncate px-4 py-3 align-middle text-muted-foreground">{user.outlets.map((item) => item.outlet.name).join(", ") || "Belum ada akses"}</td>
                    <td className="px-4 py-3 align-middle"><span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${user.isActive ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{user.isActive ? "Aktif" : "Nonaktif"}</span></td>
                    <td className="px-4 py-3 align-middle"><div className="flex justify-end gap-1">{access.canEdit ? <><Button type="button" variant="outline" className="h-8 w-8 border-sky-200 p-0 text-sky-600 hover:bg-sky-50 hover:text-sky-700" onClick={() => startEdit(user)} aria-label={`Edit ${user.name}`} title="Edit"><Edit3 className="h-4 w-4" /></Button><Button type="button" variant="outline" className="h-8 w-8 border-violet-200 p-0 text-violet-600 hover:bg-violet-50 hover:text-violet-700" onClick={() => openPasswordModal(user)} aria-label={`Ubah password ${user.name}`} title="Ubah password"><KeyRound className="h-4 w-4" /></Button>{user.role !== "owner" ? <Button type="button" variant="secondary" className={user.isActive ? "h-8 w-8 border-amber-200 bg-amber-50 p-0 text-amber-700 hover:bg-amber-100" : "h-8 w-8 border-emerald-200 bg-emerald-50 p-0 text-emerald-700 hover:bg-emerald-100"} onClick={() => void toggleUser(user)} disabled={isUpdating} aria-label={`${user.isActive ? "Nonaktifkan" : "Aktifkan"} ${user.name}`} title={user.isActive ? "Nonaktifkan" : "Aktifkan"}>{user.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}</Button> : null}</> : null}</div></td>
                  </tr>
                ))}
                {!visibleUsers.length && !isLoading ? <tr><td colSpan={6} className="px-4 py-6 text-sm text-muted-foreground">Data user tidak ditemukan.</td></tr> : null}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t px-4 py-4 md:flex-row md:items-center md:justify-between"><p className="text-sm text-muted-foreground">Showing {visibleUsers.length ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, visibleUsers.length)} of {visibleUsers.length} entries</p><div className="flex items-center gap-3"><Button type="button" variant="outline" className="h-10 w-10 p-0" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="Sebelumnya"><ChevronLeft className="h-4 w-4" /></Button><span className="inline-flex h-10 min-w-10 items-center justify-center rounded-lg bg-primary/10 px-3 text-sm font-semibold text-primary">{page}</span><Button type="button" variant="outline" className="h-10 w-10 p-0" disabled={page >= Math.max(1, Math.ceil(visibleUsers.length / pageSize))} onClick={() => setPage((current) => Math.min(Math.max(1, Math.ceil(visibleUsers.length / pageSize)), current + 1))} aria-label="Berikutnya"><ChevronRight className="h-4 w-4" /></Button></div></div>
        </div>
        {false ? <>
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
                      <SearchableSelect
                        value={editForm.role}
                        onChange={(value) =>
                          setEditForm({
                            ...editForm,
                            role: value,
                          })
                        }
                        options={availableRoleOptions}
                        placeholder="Pilih role"
                        searchPlaceholder="Cari role..."
                        emptyText="Role tidak tersedia."
                      />
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
                      <Image src={user.image} alt={`Foto ${user.name}`} width={48} height={48} unoptimized className="h-12 w-12 shrink-0 rounded-md border bg-muted object-cover" />
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
                          className="h-9 w-9 p-0"
                          onClick={() => startEdit(user)}
                          aria-label={`Edit ${user.name}`}
                          title="Edit"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        {user.role !== "owner" ? (
                          <Button
                            type="button"
                            variant="secondary"
                            className="h-9 w-9 p-0"
                            onClick={() => void toggleUser(user)}
                            disabled={isUpdating}
                            aria-label={`${user.isActive ? "Nonaktifkan" : "Aktifkan"} ${user.name}`}
                            title={user.isActive ? "Nonaktifkan" : "Aktifkan"}
                          >
                            {user.isActive ? (
                              <PowerOff className="h-4 w-4" />
                            ) : (
                              <Power className="h-4 w-4" />
                            )}
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
        </> : null}
      </CollapsibleSection>

      <AdminModal open={isCreateOpen} title="Tambah User" description="Buat akun dashboard, kasir, gudang, atau auditor dengan akses outlet yang sesuai." size="xl" onClose={() => setIsCreateOpen(false)}>
        <form className="space-y-5" onSubmit={onSubmit}>
          <UserFormSummary name={form.name} email={form.email} image={form.image} role={form.role} />
          <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
            <div className="rounded-lg border bg-background p-4">
              <ImageUploadField label="Foto User" value={form.image} onChange={(value) => setForm({ ...form, image: value })} onError={setMessage} />
            </div>
            <div className="rounded-lg border bg-background p-4">
              <p className="mb-3 text-sm font-semibold">Informasi Login</p>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Nama" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
                <Field label="Email" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
                <PasswordField label="Password Awal" value={form.password} onChange={(value) => setForm({ ...form, password: value })} />
                <div className="space-y-2"><Label>Role</Label><SearchableSelect value={form.role} onChange={(value) => setForm({ ...form, role: value })} options={availableRoleOptions} placeholder="Pilih role" searchPlaceholder="Cari role..." emptyText="Role tidak tersedia." /></div>
              </div>
            </div>
          </div>
          <OutletAccessPanel outlets={outlets} selectedIds={form.outletIds} disabled={false} onToggle={toggleOutlet} />
          <AlertMessage message={message} />
          <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting}><X className="h-4 w-4" />Batal</Button><Button type="submit" disabled={isSubmitting || isLoading}><Plus className="h-4 w-4" />{isSubmitting ? "Menyimpan" : "Simpan User"}</Button></div>
        </form>
      </AdminModal>

      <AdminModal
        open={Boolean(modalEditingUserId && editForm)}
        title="Edit User"
        description="Ubah profil, role, status, foto, dan akses outlet. Password diubah lewat tombol kunci pada daftar user."
        size="xl"
        onClose={cancelEdit}
      >
        {modalEditingUserId && editForm ? (
          <div className="space-y-5">
            <UserFormSummary name={editForm.name} email={editForm.email} image={editForm.image} role={editForm.role} isActive={editForm.isActive} />
            <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
              <div className="rounded-lg border bg-background p-4">
                <ImageUploadField label="Upload Foto Lokal" value={editForm.image} onChange={(value) => setEditForm({ ...editForm, image: value })} onError={setMessage} />
              </div>
              <div className="rounded-lg border bg-background p-4">
                <p className="mb-3 text-sm font-semibold">Informasi Login</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Nama" value={editForm.name} onChange={(value) => setEditForm({ ...editForm, name: value })} />
                  <Field label="Email" type="email" value={editForm.email} disabled={modalEditingUserId === currentUserId} onChange={(value) => setEditForm({ ...editForm, email: value })} />
                  <Field label="Foto / URL Gambar" value={editForm.image} onChange={(value) => setEditForm({ ...editForm, image: value })} />
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <SearchableSelect value={editForm.role} disabled={modalEditingUserId === currentUserId} onChange={(value) => setEditForm({ ...editForm, role: value })} options={availableRoleOptions} placeholder="Pilih role" searchPlaceholder="Cari role..." emptyText="Role tidak tersedia." />
                  </div>
                  <label className="flex h-10 items-center gap-2 rounded-md border bg-muted/30 px-3 text-sm">
                    <input type="checkbox" checked={editForm.isActive} disabled={modalEditingUserId === currentUserId} onChange={(event) => setEditForm({ ...editForm, isActive: event.target.checked })} />
                    User aktif dan bisa login
                  </label>
                </div>
              </div>
            </div>
            <OutletAccessPanel outlets={outlets} selectedIds={editForm.outletIds} disabled={modalEditingUserId === currentUserId} onToggle={toggleEditOutlet} />
            <AlertMessage message={message} />
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={cancelEdit} disabled={isUpdating}>
                <X className="h-4 w-4" />
                Batal
              </Button>
              <Button type="button" onClick={() => void updateUser(modalEditingUserId)} disabled={isUpdating}>
                <Save className="h-4 w-4" />
                {isUpdating ? "Menyimpan" : "Simpan Perubahan"}
              </Button>
            </div>
          </div>
        ) : null}
      </AdminModal>

      <AdminModal
        open={Boolean(passwordUser)}
        title="Ubah Password"
        description={passwordUser?.id === currentUserId ? "Masukkan password lama dan password baru akun ini." : "Masukkan password admin sebagai konfirmasi, lalu isi password baru user."}
        size="lg"
        onClose={closePasswordModal}
      >
        {passwordUser ? (
          <div className="space-y-5">
            <UserFormSummary name={passwordUser.name} email={passwordUser.email} image={passwordUser.image ?? ""} role={passwordUser.role} isActive={passwordUser.isActive} />
            <div className="rounded-lg border bg-background p-4">
              <p className="mb-3 text-sm font-semibold">Keamanan Password</p>
              <div className="grid gap-4">
                <PasswordField label={passwordUser.id === currentUserId ? "Password Lama" : "Password Admin"} value={passwordForm.currentPassword} onChange={(value) => setPasswordForm({ ...passwordForm, currentPassword: value })} />
                <PasswordField label="Password Baru" value={passwordForm.newPassword} onChange={(value) => setPasswordForm({ ...passwordForm, newPassword: value })} />
                <PasswordField label="Re-enter Password Baru" value={passwordForm.confirmPassword} onChange={(value) => setPasswordForm({ ...passwordForm, confirmPassword: value })} />
              </div>
            </div>
            <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-900">Password baru minimal 8 karakter. Untuk reset user lain, password admin dipakai sebagai konfirmasi keamanan.</p>
            <AlertMessage message={message} />
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={closePasswordModal} disabled={isPasswordUpdating}><X className="h-4 w-4" />Batal</Button>
              <Button type="button" onClick={() => void updatePassword()} disabled={isPasswordUpdating}><KeyRound className="h-4 w-4" />{isPasswordUpdating ? "Menyimpan" : "Simpan Password"}</Button>
            </div>
          </div>
        ) : null}
      </AdminModal>
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

function UserFormSummary(props: { name: string; email: string; image: string; role: string; isActive?: boolean }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-sky-100 bg-sky-50/70 p-4 sm:flex-row sm:items-center">
      {props.image ? (
        <Image src={props.image} alt="Preview user" width={56} height={56} unoptimized className="h-14 w-14 shrink-0 rounded-lg border bg-background object-cover" />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border bg-background">
          <UserCircle className="h-7 w-7 text-sky-600" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-foreground">{props.name || "Nama user"}</p>
        <p className="truncate text-sm text-muted-foreground">{props.email || "Email login"}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex h-8 items-center rounded-full border border-sky-200 bg-white px-3 text-xs font-semibold text-sky-700">{props.role || "Role"}</span>
        {props.isActive !== undefined ? <span className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-semibold ${props.isActive ? "border-emerald-200 bg-white text-emerald-700" : "border-slate-200 bg-white text-slate-600"}`}>{props.isActive ? "Aktif" : "Nonaktif"}</span> : null}
      </div>
    </div>
  );
}

function OutletAccessPanel(props: { outlets: Outlet[]; selectedIds: string[]; disabled: boolean; onToggle: (outletId: string) => void }) {
  return (
    <div className="space-y-3 rounded-lg border bg-background p-4">
      <div>
        <Label>Akses Outlet</Label>
        <p className="mt-1 text-xs text-muted-foreground">Pilih outlet yang boleh diakses user untuk kasir, persediaan, transaksi, dan laporan.</p>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {props.outlets.map((outlet) => (
          <label key={outlet.id} className={`flex items-start gap-3 rounded-md border px-3 py-2 text-sm ${props.selectedIds.includes(outlet.id) ? "border-sky-200 bg-sky-50" : "bg-muted/20"} ${props.disabled ? "opacity-60" : "cursor-pointer hover:bg-muted"}`}>
            <input type="checkbox" className="mt-1" checked={props.selectedIds.includes(outlet.id)} disabled={props.disabled} onChange={() => props.onToggle(outlet.id)} />
            <span className="min-w-0"><span className="block truncate font-medium">{outlet.name}</span><span className="block text-xs text-muted-foreground">{outlet.code}</span></span>
          </label>
        ))}
      </div>
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
  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressProfileImage(file);
      const uploadFile = dataUrlToFile(compressed, "user.jpg");
      const formData = new FormData();
      formData.append("scope", "profiles");
      formData.append("file", uploadFile);
      const response = await fetch("/api/uploads/images", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        props.onError(await readUploadError(response, "Foto user gagal diunggah."));
        return;
      }
      const json = (await response.json()) as ApiResponse<UploadResponse>;
      props.onChange(json.data.url);
    } catch (error) {
      props.onError(error instanceof Error ? error.message : "Foto gagal diproses.");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <Label>{props.label}</Label>
      <p className="text-xs text-muted-foreground">Maksimal 5 MB. Foto otomatis dikompres sebelum disimpan.</p>
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
          <Image src={props.value} alt="Preview foto user" width={64} height={64} unoptimized className="h-16 w-16 rounded-md border bg-muted object-cover" />
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

async function readUploadError(response: Response, fallback: string) {
  try {
    const json = (await response.json()) as { error?: { message?: string } };
    return json.error?.message ?? fallback;
  } catch {
    return fallback;
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
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{props.label}</Label>
      <Input
        type={props.type ?? "text"}
        disabled={props.disabled}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </div>
  );
}
