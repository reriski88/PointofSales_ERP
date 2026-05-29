"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { allOutletsValue, saveSelectedOutlet } from "@/frontend/controllers/selected-outlet-provider";
import type { RoleAccessAction, RoleAccessMenuKey } from "@/lib/role-access";

type CurrentAccessResponse = {
  data: {
    permissions: Record<RoleAccessMenuKey, RoleAccessAction[]>;
  };
};
type Outlet = { id: string; name: string; code: string };
type Profile = { role: string };
type ApiResponse<T> = { data: T };

const routeOrder: Array<{ menuKey: RoleAccessMenuKey; href: string }> = [
  { menuKey: "dashboard", href: "/admin" },
  { menuKey: "outlets", href: "/admin/outlets" },
  { menuKey: "users", href: "/admin/users" },
  { menuKey: "products", href: "/admin/products" },
  { menuKey: "inventory", href: "/admin/inventory" },
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

    const response = await fetch("/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
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
    if (outletSelection.options.length <= 1) {
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
      <div className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-8 px-6 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <section className="flex min-h-[34rem] flex-col justify-between overflow-hidden rounded-lg px-1 sm:min-h-[36rem] lg:min-h-[32rem]">
          <div className="max-w-xl space-y-4">
            <div className="inline-flex items-center rounded-full border border-[#A8DADC]/70 bg-white/80 px-3 py-1 text-sm font-medium text-[#1D3557] shadow-sm">
              Point of Sales
            </div>
            <div className="space-y-3">
              <h1 className="max-w-lg text-3xl font-semibold leading-tight tracking-normal text-[#1D3557] sm:text-4xl">
                Satu tempat untuk kasir, stok, dan laporan outlet.
              </h1>
              <p className="max-w-lg text-base leading-7 text-[#1D3557]/75">
                Masuk ke panel admin untuk memantau transaksi cemilan dan menjaga operasional toko tetap rapi.
              </p>
            </div>
          </div>
          <div className="relative mt-6 min-h-[18rem] flex-1 sm:min-h-[21rem] lg:min-h-0">
            <Image
              src="/images/login-pos-cartoon-transaction-transparent.png"
              alt="Ilustrasi kartun kasir dan pelanggan sedang transaksi POS di toko cemilan"
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
            <CardDescription>Gunakan akun admin POS Cemilan.</CardDescription>
          </CardHeader>
          <CardContent className="pb-6">
            {!isMounted ? (
              <LoginFormSkeleton />
            ) : postLoginRoute ? (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="login-outlet">Pilih Outlet</Label>
                  <select
                    id="login-outlet"
                    className="flex h-11 w-full rounded-md border border-[#DDE7DF] bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#457B9D]"
                    value={selectedOutletId}
                    onChange={(event) => setSelectedOutletId(event.target.value)}
                  >
                    {outletOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
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
                  className="h-11 border-[#DDE7DF] focus-visible:ring-[#457B9D]"
                  autoComplete="email"
                  data-form-type="email"
                  data-lpignore="true"
                  // value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
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

async function loadOutletSelection() {
  const [profileResponse, outletsResponse] = await Promise.all([
    fetch("/api/profile"),
    fetch("/api/outlets"),
  ]);
  if (!profileResponse.ok || !outletsResponse.ok) {
    return { options: [], defaultOutletId: "" };
  }
  const profileJson = (await profileResponse.json()) as ApiResponse<Profile>;
  const outletsJson = (await outletsResponse.json()) as ApiResponse<Outlet[]>;
  const canSelectAll = ["owner", "auditor"].includes(profileJson.data.role);
  const options = [
    ...(canSelectAll ? [{ value: allOutletsValue, label: "Semua Outlet" }] : []),
    ...outletsJson.data.map((outlet) => ({
      value: outlet.id,
      label: `${outlet.name} (${outlet.code})`,
    })),
  ];
  return {
    options,
    defaultOutletId: options[0]?.value ?? "",
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
