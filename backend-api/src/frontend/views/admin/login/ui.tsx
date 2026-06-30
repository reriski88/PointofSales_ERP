"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "../_components/searchable-select";
import { allOutletsValue, clearSelectedOutlet, saveSelectedOutlet } from "@/frontend/controllers/selected-outlet-provider";
import type { RoleAccessAction, RoleAccessMenuKey } from "@/lib/role-access";

type CurrentAccessResponse = {
  data: {
    permissions: Record<RoleAccessMenuKey, RoleAccessAction[]>;
  };
};
type Outlet = { id: string; name: string; code: string };
type Profile = { role: string };
type ApiResponse<T> = { data: T };
type OutletSelection = {
  options: Array<{ value: string; label: string }>;
  defaultOutletId: string;
  requiresFirstRunSetup: boolean;
  requiresOutletAssignment: boolean;
};

const routeOrder: Array<{ menuKey: RoleAccessMenuKey; href: string }> = [
  { menuKey: "dashboard", href: "/admin" },
  { menuKey: "outlets", href: "/admin/outlets" },
  { menuKey: "users", href: "/admin/users" },
  { menuKey: "products", href: "/admin/products" },
  { menuKey: "customers", href: "/admin/customers" },
  { menuKey: "inventory", href: "/admin/inventory" },
  { menuKey: "stockOpname", href: "/admin/stock-opname" },
  { menuKey: "suppliers", href: "/admin/suppliers" },
  { menuKey: "purchases", href: "/admin/purchases" },
  { menuKey: "reports", href: "/admin/reports" },
  { menuKey: "financialReports", href: "/admin/financial-reports" },
  { menuKey: "receipt", href: "/admin/receipt" },
  { menuKey: "profile", href: "/admin/profile" },
];

export function AdminLoginForm() {
  const [isMounted, setIsMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [postLoginRoute, setPostLoginRoute] = useState<string | null>(null);
  const [outletOptions, setOutletOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [selectedOutletId, setSelectedOutletId] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage(null);

    const formData = new FormData(event.currentTarget);
    const nextEmail = String(formData.get("email") ?? "").trim();
    const nextPassword = String(formData.get("password") ?? "");

    const response = await fetch("/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: nextEmail,
        password: nextPassword,
      }),
    });

    if (!response.ok) {
      setMessage("Login gagal. Periksa email dan password admin.");
      setIsLoading(false);
      return;
    }

    const [nextRoute, outletSelection] = await Promise.all([
      firstAllowedAdminRoute(),
      loadOutletSelection(),
    ]);
    setPostLoginRoute(nextRoute);
    setOutletOptions(outletSelection.options);
    setSelectedOutletId(outletSelection.defaultOutletId);
    setIsLoading(false);
    if (outletSelection.requiresFirstRunSetup) {
      clearSelectedOutlet();
      window.location.href = "/admin/outlets?setup=first-run";
      return;
    }
    if (outletSelection.requiresOutletAssignment) {
      clearSelectedOutlet();
      window.location.href = "/admin/profile?notice=no-outlet";
      return;
    }
    if (outletSelection.options.length <= 1) {
      if (!outletSelection.defaultOutletId) {
        window.location.href = nextRoute;
        return;
      }
      saveSelectedOutlet(outletSelection.defaultOutletId);
      window.location.href = nextRoute;
    }
  }

  function continueAfterOutletSelection() {
    if (!postLoginRoute || !selectedOutletId) return;
    saveSelectedOutlet(selectedOutletId);
    window.location.href = postLoginRoute;
  }

  return (
    <main className="min-h-screen bg-[#F6FBF8]">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-6 px-4 py-6 sm:px-6 sm:py-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <section className="flex min-h-0 flex-col justify-between overflow-hidden rounded-lg px-1 sm:min-h-[32rem] lg:min-h-[32rem]">
          <div className="max-w-xl space-y-4">
            <div className="inline-flex items-center rounded-full border border-[#A8DADC]/70 bg-white/80 px-3 py-1 text-sm font-medium text-[#1D3557] shadow-sm">
              Point of Sales
            </div>
            <div className="space-y-3">
              <h1 className="max-w-lg text-2xl font-semibold leading-tight tracking-normal text-[#1D3557] sm:text-4xl">
                Satu tempat untuk kasir, stok, dan laporan outlet.
              </h1>
              <p className="max-w-lg text-base leading-7 text-[#1D3557]/75">
                Masuk ke panel admin untuk memantau transaksi, stok, dan operasional outlet tetap rapi.
              </p>
            </div>
          </div>
          <div className="relative mt-4 min-h-[12rem] flex-1 sm:mt-6 sm:min-h-[18rem] lg:min-h-0">
            <Image
              src="/images/login-pos-cartoon-transaction-transparent.png"
              alt="Ilustrasi kartun kasir dan pelanggan sedang transaksi POS"
              fill
              priority
              sizes="(min-width: 1024px) 58vw, 100vw"
              className="object-contain object-bottom"
            />
          </div>
        </section>

        <Card className="w-full max-w-md justify-self-center rounded-lg border-[#DDE7DF] bg-white/95 shadow-xl shadow-[#1D3557]/10">
          <CardHeader className="space-y-2 pb-6">
            <CardTitle className="text-2xl text-[#1D3557]">Login Admin</CardTitle>
            <CardDescription>Gunakan akun admin POS ERP.</CardDescription>
          </CardHeader>
          <CardContent className="pb-6">
            {!isMounted ? (
              <LoginFormSkeleton />
            ) : postLoginRoute ? (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="login-outlet">Pilih Outlet</Label>
                  <SearchableSelect
                    value={selectedOutletId}
                    onChange={setSelectedOutletId}
                    options={outletOptions}
                    placeholder="Pilih outlet"
                    searchPlaceholder="Cari outlet..."
                    emptyText="Outlet tidak ditemukan."
                    triggerClassName="h-11 border-[#DDE7DF] focus-visible:ring-[#457B9D]"
                    ariaLabel="Pilih Outlet"
                  />
                </div>
                <Button
                  className="h-11 w-full bg-[#E63946] hover:bg-[#C92F3A]"
                  type="button"
                  onClick={continueAfterOutletSelection}
                  disabled={!selectedOutletId}
                >
                  Lanjutkan
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <form className="space-y-5" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  className="h-11 border-[#DDE7DF] focus-visible:ring-[#457B9D]"
                  autoComplete="email"
                  data-form-type="email"
                  data-lpignore="true"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={isPasswordVisible ? "text" : "password"}
                    className="h-11 border-[#DDE7DF] pr-10 focus-visible:ring-[#457B9D]"
                    autoComplete="current-password"
                    data-form-type="password"
                    data-lpignore="true"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() =>
                      setIsPasswordVisible((current) => !current)
                    }
                    aria-label={
                      isPasswordVisible
                        ? "Sembunyikan password"
                        : "Lihat password"
                    }
                  >
                    {isPasswordVisible ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              {message ? <p className="text-sm text-destructive">{message}</p> : null}
              <Button
                className="h-11 w-full bg-[#E63946] hover:bg-[#C92F3A]"
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? "Memproses" : "Masuk"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function LoginFormSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <div className="space-y-2">
        <div className="h-4 w-16 rounded bg-muted" />
        <div className="h-10 w-full rounded-md border bg-muted/50" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-24 rounded bg-muted" />
        <div className="h-10 w-full rounded-md border bg-muted/50" />
      </div>
      <div className="h-10 w-full rounded-md bg-[#E63946]/80" />
    </div>
  );
}

async function loadOutletSelection(): Promise<OutletSelection> {
  const [profileResponse, outletsResponse] = await Promise.all([
    fetch("/api/profile"),
    fetch("/api/outlets"),
  ]);
  if (!profileResponse.ok || !outletsResponse.ok) {
    return { options: [], defaultOutletId: "", requiresFirstRunSetup: false, requiresOutletAssignment: false };
  }
  const profileJson = (await profileResponse.json()) as ApiResponse<Profile>;
  const outletsJson = (await outletsResponse.json()) as ApiResponse<Outlet[]>;
  const canSelectAll = ["owner", "auditor"].includes(profileJson.data.role);
  const requiresFirstRunSetup =
    profileJson.data.role === "owner" && outletsJson.data.length === 0;
  const requiresOutletAssignment =
    profileJson.data.role !== "owner" && outletsJson.data.length === 0;
  const options = [
    ...(canSelectAll && outletsJson.data.length > 0
      ? [{ value: allOutletsValue, label: "Semua Outlet" }]
      : []),
    ...outletsJson.data.map((outlet) => ({
      value: outlet.id,
      label: `${outlet.name} (${outlet.code})`,
    })),
  ];
  return {
    options,
    defaultOutletId: options[0]?.value ?? "",
    requiresFirstRunSetup,
    requiresOutletAssignment,
  };
}

async function firstAllowedAdminRoute() {
  try {
    const response = await fetch("/api/role-access/me");
    if (!response.ok) return "/admin";
    const json = (await response.json()) as CurrentAccessResponse;
    return (
      routeOrder.find((route) =>
        json.data.permissions[route.menuKey]?.includes("view"),
      )?.href ?? "/admin/profile"
    );
  } catch {
    return "/admin";
  }
}
