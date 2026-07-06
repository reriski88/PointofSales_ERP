"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Building2, RefreshCw, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

type Tenant = {
  id: string;
  name: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  ownerEmail: string | null;
  isActive: boolean;
  createdAt: string;
  subPlanName: string | null;
  subPlanCode: string | null;
  subStatus: string | null;
  subPeriodEnd: string | null;
  subTrialEndsAt: string | null;
};

const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  active:       { label: "Aktif",        bg: "bg-emerald-50",  text: "text-emerald-700",  dot: "bg-emerald-500" },
  trial:        { label: "Trial",        bg: "bg-sky-50",      text: "text-sky-700",      dot: "bg-sky-500" },
  grace_period: { label: "Tenggang",     bg: "bg-amber-50",    text: "text-amber-700",    dot: "bg-amber-500" },
  suspended:    { label: "Ditangguhkan", bg: "bg-rose-50",     text: "text-rose-700",     dot: "bg-rose-500" },
  cancelled:    { label: "Dibatalkan",   bg: "bg-slate-100",   text: "text-slate-600",    dot: "bg-slate-400" },
  expired:      { label: "Kadaluarsa",   bg: "bg-stone-100",   text: "text-stone-500",    dot: "bg-stone-400" },
};

export function SuperadminTenantsClient() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  useEffect(() => { fetchTenants(); }, []);

  async function fetchTenants(q?: string) {
    (q === undefined ? loading : true) ? setLoading(true) : setSearching(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      const res = await fetch(`/api/superadmin/tenants?${params.toString()}`);
      const json = await res.json();
      setTenants(json.data ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); setSearching(false); }
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchTenants(search || undefined);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-200 border-t-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-teal-400 via-cyan-400 to-sky-300 p-7 text-white shadow-xl shadow-cyan-200/40">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
        <div className="absolute -bottom-16 left-20 h-44 w-44 rounded-full bg-purple-300/20 blur-3xl" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white/90">
              <Building2 size={14} /> Tenant Management
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight">Daftar Tenant</h1>
            <p className="mt-2 text-sm text-white/75">Kelola seluruh organization dan subscription tenant.</p>
          </div>
          <Link href="/superadmin/tenants/create">
            <Button className="bg-white text-cyan-700 hover:bg-cyan-50">
              <Plus size={16} className="mr-2" /> Tambah Tenant
            </Button>
          </Link>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={onSearch} className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama tenant, email, telepon..."
            className="rounded-xl border-slate-200 bg-white/70 pl-10 backdrop-blur"
          />
        </div>
        <Button type="submit" disabled={searching} className="rounded-xl bg-cyan-600 hover:bg-cyan-700">
          {searching ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
        </Button>
      </form>

      {/* Empty State */}
      {tenants.length === 0 ? (
        <Card className="border-0 bg-gradient-to-br from-slate-50 to-cyan-50 p-12 text-center shadow-lg shadow-slate-900/5">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 to-sky-400 text-white shadow-lg shadow-cyan-300/40">
            <Inbox size={36} />
          </div>
          <h2 className="mt-6 text-xl font-black text-slate-700">Belum Ada Tenant</h2>
          <p className="mt-2 text-sm text-slate-500">Belum ada tenant yang terdaftar. Mulai dengan menambahkan tenant pertama.</p>
          <Link href="/superadmin/tenants/create">
            <Button className="mt-5 bg-cyan-600 hover:bg-cyan-700"><Plus size={16} className="mr-2" /> Tambah Tenant Pertama</Button>
          </Link>
        </Card>
      ) : (
        <Card className="overflow-hidden border-0 bg-white/80 shadow-lg shadow-slate-900/5 backdrop-blur">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 text-left text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-3.5 font-bold">Nama Tenant</th>
                  <th className="px-5 py-3.5 font-bold">Owner Email</th>
                  <th className="px-5 py-3.5 font-bold">Plan</th>
                  <th className="px-5 py-3.5 font-bold">Status</th>
                  <th className="px-5 py-3.5 font-bold">Berakhir</th>
                  <th className="px-5 py-3.5 font-bold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => {
                  const cfg = statusConfig[t.subStatus ?? "trial"] ?? statusConfig.trial;
                  return (
                    <tr key={t.id} className="border-t border-slate-50 transition hover:bg-cyan-50/30">
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-800">{t.name}</div>
                        {!t.isActive && <span className="text-xs font-semibold text-rose-500">● Nonaktif</span>}
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-500">{t.ownerEmail ?? t.contactEmail ?? "-"}</td>
                      <td className="px-5 py-4 text-slate-600">{t.subPlanName ?? "-"}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${cfg.bg} ${cfg.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-500">
                        {t.subPeriodEnd ? new Date(t.subPeriodEnd).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-"}
                      </td>
                      <td className="px-5 py-4">
                        <Link href={`/superadmin/tenants/${t.id}`} className="text-sm font-semibold text-cyan-600 hover:text-cyan-700">
                          Detail →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
