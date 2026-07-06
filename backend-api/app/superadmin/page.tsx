"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Building2, Users, CreditCard, AlertTriangle, Sparkles,
  ArrowRight, RefreshCw, Zap, TrendingUp, Clock, XCircle,
} from "lucide-react";

type Stats = {
  orgCount: number;
  userCount: number;
  activeSubs: number;
  trialSubs: number;
  overdueActive: number;
  expiringSoon: number;
  graceExpiring: number;
  recentTenants: Array<{
    id: string; name: string; contactPhone: string | null;
    ownerEmail: string | null;
    planName: string | null; status: string | null;
    periodEnd: string | null;
  }>;
};

const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  active:       { label: "Aktif",        bg: "bg-emerald-50",  text: "text-emerald-700",  dot: "bg-emerald-500" },
  trial:        { label: "Trial",        bg: "bg-sky-50",      text: "text-sky-700",      dot: "bg-sky-500" },
  grace_period: { label: "Tenggang",     bg: "bg-amber-50",    text: "text-amber-700",    dot: "bg-amber-500" },
  suspended:    { label: "Ditangguhkan", bg: "bg-rose-50",     text: "text-rose-700",     dot: "bg-rose-500" },
  cancelled:    { label: "Dibatalkan",   bg: "bg-slate-100",   text: "text-slate-600",    dot: "bg-slate-400" },
  expired:      { label: "Kadaluarsa",   bg: "bg-stone-100",   text: "text-stone-500",    dot: "bg-stone-400" },
};

export default function SuperadminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/superadmin/dashboard");
      const j = await res.json();
      setStats(j.data ?? j);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  if (loading) return <LoadingState />;
  if (!stats) return <ErrorState onRetry={load} />;

  const hasTenants = stats.orgCount > 0;
  const hasAlerts = stats.overdueActive > 0 || stats.expiringSoon > 0 || stats.graceExpiring > 0;

  return (
    <div className="space-y-7">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-400 via-purple-400 to-pink-300 p-7 text-white shadow-xl shadow-purple-200/40">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
        <div className="absolute -bottom-16 right-24 h-44 w-44 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-amber-300/15 blur-2xl" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white/90">
              <Sparkles size={14} /> SaaS Control Center
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">Dashboard Superadmin</h1>
            <p className="mt-2 max-w-xl text-sm text-white/75">Pantau seluruh tenant, subscription, dan kesehatan sistem POS Cemilan dari satu tempat.</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={load} className="bg-white/20 text-white backdrop-blur hover:bg-white/30">
              <RefreshCw size={16} className="mr-2" /> Refresh
            </Button>
            <Link href="/superadmin/tenants/create">
              <Button className="bg-white text-purple-700 hover:bg-purple-50">
                <Building2 size={16} className="mr-2" /> Tambah Tenant
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {!hasTenants && (
        <Card className="border-0 bg-gradient-to-br from-sky-50 via-white to-purple-50 p-10 text-center shadow-lg shadow-sky-900/5">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-purple-400 text-white shadow-lg shadow-purple-300/40">
            <Building2 size={36} />
          </div>
          <h2 className="mt-6 text-xl font-black text-slate-800">Belum Ada Tenant</h2>
          <p className="mt-2 text-sm text-slate-500">Mulai onboarding tenant pertama Anda. Buat organization, owner, dan subscription dalam satu langkah.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/superadmin/tenants/create">
              <Button className="bg-purple-600 hover:bg-purple-700"><Building2 size={16} className="mr-2" /> Buat Tenant Pertama</Button>
            </Link>
            <Link href="/superadmin/plans">
              <Button className="bg-sky-100 text-sky-700 hover:bg-sky-200"><CreditCard size={16} className="mr-2" /> Kelola Plan</Button>
            </Link>
          </div>
        </Card>
      )}

      {/* KPI Cards */}
      {hasTenants && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={<Building2 size={22} />} label="Total Tenant" value={stats.orgCount} gradient="from-sky-400 to-blue-500" bg="bg-sky-50" iconBg="bg-sky-100 text-sky-600" />
          <KpiCard icon={<Users size={22} />} label="Total User" value={stats.userCount} gradient="from-purple-400 to-indigo-500" bg="bg-purple-50" iconBg="bg-purple-100 text-purple-600" />
          <KpiCard icon={<CreditCard size={22} />} label="Langganan Aktif" value={stats.activeSubs} gradient="from-emerald-400 to-teal-500" bg="bg-emerald-50" iconBg="bg-emerald-100 text-emerald-600" />
          <KpiCard icon={<Zap size={22} />} label="Masa Trial" value={stats.trialSubs} gradient="from-amber-400 to-orange-500" bg="bg-amber-50" iconBg="bg-amber-100 text-amber-600" />
        </div>
      )}

      {/* Alert Cards */}
      {hasTenants && hasAlerts && (
        <div>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-400">Subscription Alerts</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <AlertCard icon={<XCircle size={18} />} label="Active Lewat Tempo" value={stats.overdueActive} tone="rose" subtitle="Perlu ditindaklanjuti" />
            <AlertCard icon={<Clock size={18} />} label="Berakhir ≤ 7 Hari" value={stats.expiringSoon} tone="amber" subtitle="Hubungi tenant" />
            <AlertCard icon={<AlertTriangle size={18} />} label="Grace Hampir Habis" value={stats.graceExpiring} tone="orange" subtitle="Akan expired" />
          </div>
        </div>
      )}

      {/* Recent Tenants */}
      {hasTenants && (
        <Card className="overflow-hidden border-0 bg-white/80 shadow-lg shadow-slate-900/5 backdrop-blur">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h2 className="text-lg font-black text-slate-800">Tenant Terbaru</h2>
            <Link href="/superadmin/tenants" className="text-sm font-semibold text-purple-600 hover:text-purple-700">
              Lihat semua <ArrowRight size={14} className="inline" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/70 text-left text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-bold">Tenant</th>
                  <th className="px-6 py-3 font-bold">Email</th>
                  <th className="px-6 py-3 font-bold">Plan</th>
                  <th className="px-6 py-3 font-bold">Status</th>
                  <th className="px-6 py-3 font-bold">Berakhir</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentTenants.map((t) => {
                  const cfg = statusConfig[t.status ?? "trial"] ?? statusConfig.trial;
                  return (
                    <tr key={t.id} className="border-t border-slate-50 transition hover:bg-purple-50/40">
                      <td className="px-6 py-3.5 font-bold text-slate-800">{t.name}</td>
                      <td className="px-6 py-3.5 text-xs text-slate-500">{t.ownerEmail ?? "-"}</td>
                      <td className="px-6 py-3.5 text-slate-600">{t.planName ?? "-"}</td>
                      <td className="px-6 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${cfg.bg} ${cfg.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-xs text-slate-500">
                        {t.periodEnd ? new Date(t.periodEnd).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-"}
                      </td>
                    </tr>
                  );
                })}
                {stats.recentTenants.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-400">Belum ada tenant.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, gradient, iconBg }: { icon: React.ReactNode; label: string; value: number; gradient: string; bg: string; iconBg: string }) {
  return (
    <Card className="relative overflow-hidden border-0 bg-white shadow-lg shadow-slate-900/5">
      <div className={`absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-gradient-to-br ${gradient} opacity-10`} />
      <div className="p-5">
        <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${iconBg}`}>{icon}</div>
        <div className="mt-4 text-3xl font-black text-slate-900">{value}</div>
        <div className="text-sm font-medium text-slate-400">{label}</div>
      </div>
    </Card>
  );
}

function AlertCard({ icon, label, value, tone, subtitle }: { icon: React.ReactNode; label: string; value: number; tone: "rose" | "amber" | "orange"; subtitle: string }) {
  const tones = {
    rose:   { border: "border-rose-200/60",   bg: "from-rose-50 to-white",   iconBg: "bg-rose-100 text-rose-600",   value: "text-rose-700" },
    amber:  { border: "border-amber-200/60",  bg: "from-amber-50 to-white",  iconBg: "bg-amber-100 text-amber-600",  value: "text-amber-700" },
    orange: { border: "border-orange-200/60", bg: "from-orange-50 to-white", iconBg: "bg-orange-100 text-orange-600", value: "text-orange-700" },
  };
  const t = tones[tone];
  return (
    <Card className={`border ${t.border} bg-gradient-to-br ${t.bg} p-5 shadow-sm`}>
      <div className="flex items-start justify-between">
        <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${t.iconBg}`}>{icon}</div>
        <div className={`text-3xl font-black ${t.value}`}>{value}</div>
      </div>
      <div className="mt-3 text-sm font-bold text-slate-700">{label}</div>
      <div className="text-xs text-slate-400">{subtitle}</div>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-200 border-t-purple-500" />
        <p className="text-sm text-slate-400">Memuat dashboard...</p>
      </div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="border-0 bg-rose-50 p-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-500"><XCircle size={28} /></div>
      <h2 className="mt-4 text-lg font-bold text-rose-800">Gagal memuat dashboard</h2>
      <Button onClick={onRetry} className="mt-4 bg-rose-600 hover:bg-rose-700"><RefreshCw size={16} className="mr-2" /> Coba lagi</Button>
    </Card>
  );
}
