"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Save, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CollapsibleSection } from "../_components/collapsible-section";
import { useToast } from "../_components/toast-provider";
import { useRolePermissions } from "../_components/use-role-permissions";

type ApiResponse<T> = { data: T };
type Profile = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export function ProfileClient() {
  const access = useRolePermissions("profile");
  const { showToast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
    setIsLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProfile();
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
      body: JSON.stringify({ name }),
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
        <form className="grid gap-4 lg:grid-cols-2" onSubmit={onSubmit}>
          <Field label="Nama" value={name} disabled={!access.canEdit} onChange={setName} />
          <Field label="Email" value={profile?.email ?? ""} disabled onChange={() => undefined} />
          <Field label="Role" value={profile?.role ?? ""} disabled onChange={() => undefined} />
          <div className="hidden lg:block" />
          {access.canEdit ? (
            <>
              <Field label="Password Lama" type="password" value={currentPassword} onChange={setCurrentPassword} />
              <Field label="Password Baru" type="password" value={newPassword} onChange={setNewPassword} />
              <Field label="Konfirmasi Password Baru" type="password" value={confirmPassword} onChange={setConfirmPassword} />
              <div className="flex items-end">
                <Button type="submit" disabled={isSubmitting || isLoading}>
                  {newPassword ? <KeyRound className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                  {isSubmitting ? "Menyimpan" : "Simpan Profil"}
                </Button>
              </div>
            </>
          ) : null}
          {message ? <p className="lg:col-span-2 text-sm text-muted-foreground">{message}</p> : null}
        </form>
    </CollapsibleSection>
  );
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
