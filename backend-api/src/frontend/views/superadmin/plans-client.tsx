"use client";

import { useEffect, useState } from "react";
import { CreditCard, RefreshCw, Sparkles, Building2, Users, Package, Check, X, Pencil, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

type Plan = {
  id: string;
  name: string;
  code: string;
  priceMonthly: string;
  priceYearly: string;
  maxOutlets: number;
  maxUsers: number;
  maxSkus: number;
  isActive: boolean;
};

const planGradients: Record<string, string> = {
  starter: "from-sky-400 via-blue-400 to-cyan-400",
  growth: "from-purple-400 via-fuchsia-400 to-pink-400",
  scale: "from-amber-400 via-orange-400 to-rose-400",
};

const planIcons: Record<string, React.ReactNode> = {
  starter: <Sparkles size={22} />,
  growth: <Building2 size={22} />,
  scale: <Package size={22} />,
};

export function SuperadminPlansClient() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ priceMonthly: 0, priceYearly: 0, maxOutlets: 1, maxUsers: 3, maxSkus: 50 });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/superadmin/plans");
      const json = await res.json();
      setPlans(json.data ?? []);
    } finally { setLoading(false); }
  }

  function startEdit(plan: Plan) {
    setEditingId(plan.id);
    setEditForm({
      priceMonthly: Number(plan.priceMonthly),
      priceYearly: Number(plan.priceYearly),
      maxOutlets: plan.maxOutlets,
      maxUsers: plan.maxUsers,
      maxSkus: plan.maxSkus,
    });
    setMessage("");
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(plan: Plan) {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`/api/superadmin/plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setMessage(`${plan.name} berhasil diperbarui.`);
        setEditingId(null);
        load();
      } else {
        const json = await res.json();
        setMessage(json.error?.message ?? "Gagal menyimpan.");
      }
    } finally { setSaving(false); }
  }

  async function togglePlan(plan: Plan) {
    await fetch(`/api/superadmin/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !plan.isActive }),
    });
    load();
  }

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-400 via-purple-400 to-fuchsia-300 p-7 text-white shadow-xl shadow-purple-200/40">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
        <div className="absolute -bottom-16 right-24 h-44 w-44 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-amber-300/15 blur-2xl" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white/90">
              <CreditCard size={14} /> Subscription Plans
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight">Plan Langganan</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/75">Atur harga dan limit resource untuk setiap paket subscription.</p>
          </div>
          <Button onClick={load} className="bg-white/20 text-white backdrop-blur hover:bg-white/30">
            <RefreshCw size={16} className="mr-2" /> Refresh
          </Button>
        </div>
      </div>

      {message && (
        <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</div>
      )}

      {/* Plan Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex justify-center py-10"><div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-200 border-t-purple-500" /></div>
        ) : plans.map((p, idx) => {
          const gradient = planGradients[p.code] ?? "from-slate-400 to-slate-600";
          const icon = planIcons[p.code] ?? <CreditCard size={22} />;
          const isFeatured = idx === 1;
          const isEditing = editingId === p.id;
          return (
            <Card key={p.id} className={`relative overflow-hidden border-0 bg-white shadow-lg shadow-slate-900/5 ${isFeatured ? "md:scale-105 ring-2 ring-purple-300" : ""}`}>
              {isFeatured && (
                <div className="absolute right-0 top-0 z-10 rounded-bl-2xl bg-gradient-to-r from-purple-500 to-fuchsia-400 px-3 py-1 text-xs font-bold text-white shadow-sm">
                  POPULER
                </div>
              )}
              <div className={`relative h-24 bg-gradient-to-br ${gradient} p-5`}>
                <div className="absolute right-3 top-3 opacity-30">{icon}</div>
                <div className="text-white">
                  <div className="text-lg font-black">{p.name}</div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-white/70">{p.code}</div>
                </div>
              </div>
              <div className="p-6">
                {isEditing ? (
                  /* Inline Edit Form */
                  <form onSubmit={(e) => { e.preventDefault(); saveEdit(p); }} className="space-y-3">
                    <EditField label="Harga Bulanan">
                      <Input type="number" value={editForm.priceMonthly} onChange={e => setEditForm({ ...editForm, priceMonthly: Number(e.target.value) })} className="h-9" />
                    </EditField>
                    <EditField label="Harga Tahunan">
                      <Input type="number" value={editForm.priceYearly} onChange={e => setEditForm({ ...editForm, priceYearly: Number(e.target.value) })} className="h-9" />
                    </EditField>
                    <div className="grid grid-cols-3 gap-2">
                      <EditField label="Outlet">
                        <Input type="number" value={editForm.maxOutlets} onChange={e => setEditForm({ ...editForm, maxOutlets: Number(e.target.value) })} className="h-9" />
                      </EditField>
                      <EditField label="User">
                        <Input type="number" value={editForm.maxUsers} onChange={e => setEditForm({ ...editForm, maxUsers: Number(e.target.value) })} className="h-9" />
                      </EditField>
                      <EditField label="SKU">
                        <Input type="number" value={editForm.maxSkus} onChange={e => setEditForm({ ...editForm, maxSkus: Number(e.target.value) })} className="h-9" />
                      </EditField>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button type="submit" disabled={saving} className="flex-1 bg-emerald-500 hover:bg-emerald-600">
                        <Save size={14} className="mr-1.5" /> {saving ? "..." : "Simpan"}
                      </Button>
                      <Button type="button" onClick={cancelEdit} className="bg-slate-100 text-slate-600 hover:bg-slate-200">
                        <X size={14} />
                      </Button>
                    </div>
                  </form>
                ) : (
                  /* Display Mode */
                  <>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-slate-900">Rp{Number(p.priceMonthly).toLocaleString("id-ID")}</span>
                      <span className="text-sm text-slate-400">/ bulan</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-400">Rp{Number(p.priceYearly).toLocaleString("id-ID")} / tahun</div>
                    <div className="mt-5 space-y-2.5">
                      <LimitRow icon={<Building2 size={16} />} label="Outlet" value={p.maxOutlets} color="text-sky-600 bg-sky-50" />
                      <LimitRow icon={<Users size={16} />} label="User" value={p.maxUsers} color="text-purple-600 bg-purple-50" />
                      <LimitRow icon={<Package size={16} />} label="SKU" value={p.maxSkus} color="text-amber-600 bg-amber-50" />
                    </div>
                    <div className="mt-5 flex gap-2">
                      <button
                        onClick={() => startEdit(p)}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-purple-50 py-2.5 text-sm font-bold text-purple-700 transition hover:bg-purple-100"
                      >
                        <Pencil size={16} /> Edit
                      </button>
                      <button
                        onClick={() => togglePlan(p)}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition ${
                          p.isActive
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}
                      >
                        {p.isActive ? <Check size={16} /> : <X size={16} />}
                        {p.isActive ? "Aktif" : "Nonaktif"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function LimitRow({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>{icon}</div>
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <span className="ml-auto font-black text-slate-900">{value}</span>
    </div>
  );
}

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs text-slate-400">{label}</Label>{children}</div>;
}
