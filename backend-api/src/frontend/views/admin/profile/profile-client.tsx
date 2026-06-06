"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Eye, EyeOff, ImageUp, KeyRound, Mail, Save, ShieldCheck, UserCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CollapsibleSection } from "../_components/collapsible-section";
import { useToast } from "../_components/toast-provider";
import { useRolePermissions } from "../_components/use-role-permissions";
import { clearAdminDataCache } from "@/frontend/controllers/admin-data-cache";
import { compressProfileImage } from "@/frontend/lib/image-compression";

type ApiResponse<T> = { data: T };
type UploadResponse = { url: string; key: string };
type Profile = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
};

export function ProfileClient() {
  const access = useRolePermissions("profile");
  const { showToast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [noOutletNotice, setNoOutletNotice] = useState(false);

  async function loadProfile() {
    setIsLoading(true);
    const response = await fetch("/api/profile");
    if (response.status === 401) {
      window.location.href = "/admin/login";
      return;
    }
    if (!response.ok) {
      setMessage("Gagal memuat profil.");
      setIsLoading(false);
      return;
    }
    const json = (await response.json()) as ApiResponse<Profile>;
    setProfile(json.data);
    setName(json.data.name);
    setImage(json.data.image ?? "");
    setIsLoading(false);
  }

  useEffect(() => {
    queueMicrotask(() => {
      setNoOutletNotice(new URLSearchParams(window.location.search).get("notice") === "no-outlet");
      void loadProfile();
    });
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    if (!name.trim()) {
      setMessage("Nama wajib diisi.");
      setIsSubmitting(false);
      return;
    }
    if (newPassword) {
      if (newPassword.length < 8) {
        setMessage("Password baru minimal 8 karakter.");
        setIsSubmitting(false);
        return;
      }
      if (!currentPassword) {
        setMessage("Password lama wajib diisi.");
        setIsSubmitting(false);
        return;
      }
      if (newPassword !== confirmPassword) {
        setMessage("Konfirmasi password tidak sama.");
        setIsSubmitting(false);
        return;
      }
    }

    const profileResponse = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, image: image || null }),
    });
    if (!profileResponse.ok) {
      setMessage("Nama profil gagal diperbarui.");
      showToast({ tone: "error", title: "Nama profil gagal diperbarui" });
      setIsSubmitting(false);
      return;
    }

    if (newPassword) {
      const passwordResponse = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          revokeOtherSessions: false,
        }),
      });
      if (!passwordResponse.ok) {
        setMessage("Password gagal diperbarui. Periksa password lama.");
        showToast({
          tone: "error",
          title: "Password gagal diperbarui",
          description: "Periksa password lama.",
        });
        setIsSubmitting(false);
        return;
      }
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    clearAdminDataCache(["profile"]);
    window.dispatchEvent(new Event("pos-profile-updated"));
    setMessage(newPassword ? "Profil dan password berhasil diperbarui." : "Profil berhasil diperbarui.");
    showToast({
      tone: "success",
      title: newPassword
        ? "Profil dan password diperbarui"
        : "Profil berhasil diperbarui",
    });
    await loadProfile();
    setIsSubmitting(false);
  }

  return (
    <CollapsibleSection
      title="Profil Dashboard"
      description="Ubah nama akun dashboard dan password login."
      isLoading={isLoading}
      loadingText="Memuat profil dashboard..."
      actions={<UserCircle className="h-6 w-6 text-primary" />}
    >
        {noOutletNotice ? (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Akun ini belum memiliki outlet yang bisa diakses. Minta Owner atau Admin untuk mengaktifkan akses outlet sebelum memakai modul operasional.
          </div>
        ) : null}
        <form className="space-y-5" onSubmit={onSubmit}>
          <div className="flex flex-col gap-4 rounded-xl border bg-gradient-to-br from-emerald-50 via-background to-sky-50 p-4 sm:flex-row sm:items-center">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border bg-white shadow-sm">
              {image ? (
                <Image src={image} alt="Foto profil" width={80} height={80} unoptimized className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-primary/10">
                  <UserCircle className="h-10 w-10 text-primary" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Akun dashboard</p>
              <h2 className="mt-1 truncate text-2xl font-bold text-foreground">{profile?.name || name || "Profil"}</h2>
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium">
                <span className="inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-1 text-muted-foreground"><Mail className="h-3.5 w-3.5" />{profile?.email ?? "-"}</span>
                <span className="inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-1 text-primary"><ShieldCheck className="h-3.5 w-3.5" />{profile?.role ?? "-"}</span>
              </div>
            </div>
            {access.canEdit ? (
              <Button type="submit" disabled={isSubmitting || isLoading} className="sm:self-end">
                {newPassword ? <KeyRound className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {isSubmitting ? "Menyimpan" : "Simpan"}
              </Button>
            ) : null}
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <ProfileImageField value={image} disabled={!access.canEdit} onChange={setImage} onError={setMessage} />

            <div className="rounded-xl border bg-background p-4">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><UserCircle className="h-5 w-5" /></div>
                <div>
                  <p className="font-semibold">Informasi Akun</p>
                  <p className="text-xs text-muted-foreground">Nama tampil pada audit, transaksi, dan laporan.</p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Nama" value={name} disabled={!access.canEdit} onChange={setName} />
                <Field label="Email" value={profile?.email ?? ""} disabled onChange={() => undefined} />
                <Field label="Role" value={profile?.role ?? ""} disabled onChange={() => undefined} />
              </div>
            </div>
          </div>

          {access.canEdit ? (
            <div className="rounded-xl border bg-background p-4">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700"><KeyRound className="h-5 w-5" /></div>
                <div>
                  <p className="font-semibold">Keamanan Login</p>
                  <p className="text-xs text-muted-foreground">Kosongkan password baru jika hanya ingin ubah profil.</p>
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <Field label="Password Lama" type="password" value={currentPassword} onChange={setCurrentPassword} />
                <Field label="Password Baru" type="password" value={newPassword} onChange={setNewPassword} />
                <Field label="Konfirmasi Password Baru" type="password" value={confirmPassword} onChange={setConfirmPassword} />
              </div>
            </div>
          ) : null}

          {message ? <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{message}</p> : null}
        </form>
    </CollapsibleSection>
  );
}

function ProfileImageField(props: {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onError: (message: string) => void;
}) {
  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressProfileImage(file);
      const uploadFile = dataUrlToFile(compressed, "profile.jpg");
      const formData = new FormData();
      formData.append("scope", "profiles");
      formData.append("file", uploadFile);
      const response = await fetch("/api/uploads/images", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        props.onError(await readApiError(response, "Foto profil gagal diunggah."));
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
    <div className="space-y-2 rounded-xl border bg-background p-4">
      <Label>Foto Profil</Label>
      <p className="text-xs text-muted-foreground">Maksimal 5 MB. Foto otomatis dikompres sebelum disimpan.</p>
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center">
        {props.value ? (
          <Image src={props.value} alt="Preview foto profil" width={64} height={64} unoptimized className="h-16 w-16 shrink-0 rounded-lg border bg-muted object-cover" />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border bg-muted">
            <UserCircle className="h-8 w-8 text-primary" />
          </div>
        )}
        <div className="flex flex-1 flex-wrap gap-2">
          <label className={`inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium ${props.disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-muted"}`}>
            <ImageUp className="h-4 w-4" />
            Pilih Foto
            <input type="file" accept="image/*" className="sr-only" disabled={props.disabled} onChange={onFileChange} />
          </label>
          {props.value && !props.disabled ? (
            <Button type="button" variant="outline" onClick={() => props.onChange("")}> 
              <X className="h-4 w-4" />
              Hapus
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

async function readApiError(response: Response, fallback: string) {
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

function Field(props: {
  label: string;
  value: string;
  type?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const isPassword = props.type === "password";

  return (
    <div className="space-y-2">
      <Label>{props.label}</Label>
      <div className="relative">
        <Input
          type={isPassword && isPasswordVisible ? "text" : props.type ?? "text"}
          className={isPassword ? "pr-10" : undefined}
          disabled={props.disabled}
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
        />
        {isPassword ? (
          <button
            type="button"
            className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => setIsPasswordVisible((current) => !current)}
            aria-label={
              isPasswordVisible ? "Sembunyikan password" : "Lihat password"
            }
          >
            {isPasswordVisible ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        ) : null}
      </div>
    </div>
  );
}
