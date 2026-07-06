"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Building2, UserCircle, CreditCard, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

type Plan = { id: string; name: string; code: string; priceMonthly: string; priceYearly: string; maxOutlets: number; maxUsers: number; maxSkus: number };

const planAccents: Record<string, string> = {
  starter: "from-sky-400 to-blue-500",
  growth: "from-purple-400 to-indigo-500",
  scale: "from-amber-400 to-orange-500",
};

export function SuperadminCreateTenantClient() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error">("error");

  const [tenantName, setTenantName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [planId, setPlanId] = useState("");
  const [trialDays, setTrialDays] = useState(14);

  useEffect(() => { fetchPlans(); }, []);

  async function fetchPlans() {
    try {
      const res = await fetch("/api/superadmin/plans");
      const json = await res.json();
      const p = json.data as Plan[];
      setPlans(p);
      if (p.length > 0) setPlanId(p[0].id);
    } catch { /* ignore */ }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/superadmin/tenants/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantName, contactName, contactPhone, contactEmail,
          ownerName, ownerEmail, ownerPassword, planId, trialDays,
          billingCycle: "monthly",
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setMsgType("success");
        setMessage("Tenant berhasil dibuat! Mengalihkan...");
        setTimeout(() => router.push("/superadmin/tenants"), 1200);
      } else {
        setMsgType("error");
        setMessage(json.error?.message ?? "Gagal membuat tenant.");
      }
    } finally { setSaving(false); }
  }

  const selectedPlan = plans.find(p => p.id === planId);
  const selectedAccent = planAccents[selectedPlan?.code ?? ""] ?? "from-slate-400 to-slate-600";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="rounded-xl bg-white p-2.5 text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-700">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-900">Tambah Tenant Baru</h1>
          <p className="text-sm text-slate-400">Buat organization, owner, subscription, dan outlet default dalam satu langkah.</p>
        </div>
      </div>

      {message && (
        <div className={`rounded-2xl px-4 py-3 text-sm font-semibold ${msgType === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
          {message}
        </div>
      )}

      <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-3">
        {/* Left: Forms */}
        <div className="space-y-6 lg:col-span-2">
          {/* Tenant Info */}
          <Card className="border-0 bg-white p-6 shadow-lg shadow-slate-900/5">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-600"><Building2 size={20} /></div>
              <h2 className="text-lg font-black text-slate-800">Info Tenant</h2>
            </div>
            <div className="space-y-4">
              <Field label="Nama Tenant *"><Input required value={tenantName} onChange={e => setTenantName(e.target.value)} placeholder="Toko Cemilan Jaya" /></Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Nama Kontak"><Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Budi" /></Field>
                <Field label="Telepon"><Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="0812..." /></Field>
              </div>
              <Field label="Email Kontak"><Input value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="toko@email.com" /></Field>
            </div>
          </Card>

          {/* Owner Account */}
          <Card className="border-0 bg-white p-6 shadow-lg shadow-slate-900/5">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-600"><UserCircle size={20} /></div>
              <h2 className="text-lg font-black text-slate-800">Akun Owner</h2>
            </div>
            <div className="space-y-4">
              <Field label="Nama Owner *"><Input required value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Budi Santoso" /></Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Email *"><Input required type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} placeholder="budi@email.com" /></Field>
                <Field label="Password *"><Input required type="password" value={ownerPassword} onChange={e => setOwnerPassword(e.target.value)} placeholder="Min 8 karakter" /></Field>
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Plan Selection */}
        <div className="space-y-6">
          <Card className="sticky top-4 border-0 bg-white p-6 shadow-lg shadow-slate-900/5">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600"><CreditCard size={20} /></div>
              <h2 className="text-lg font-black text-slate-800">Paket Langganan</h2>
            </div>
            <div className="space-y-3">
              {plans.map(p => {
                const accent = planAccents[p.code] ?? "from-slate-400 to-slate-600";
                const isSelected = planId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlanId(p.id)}
                    className={`w-full rounded-2xl border-2 p-4 text-left transition ${isSelected ? "border-purple-300 bg-purple-50 shadow-md shadow-purple-200/50" : "border-slate-200 bg-white hover:border-purple-200"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className={`font-black ${isSelected ? "text-purple-700" : "text-slate-900"}`}>{p.name}</div>
                        <div className={`text-xs ${isSelected ? "text-purple-400" : "text-slate-400"}`}>{p.maxOutlets} outlet · {p.maxUsers} user · {p.maxSkus} SKU</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-black ${isSelected ? "text-purple-700" : "text-slate-900"}`}>Rp{Number(p.priceMonthly).toLocaleString("id-ID")}</div>
                        <div className={`text-xs ${isSelected ? "text-purple-400" : "text-slate-400"}`}>/bulan</div>
                      </div>
                    </div>
                    {isSelected && <div className={`mt-3 h-1 rounded-full bg-gradient-to-r ${accent}`} />}
                  </button>
                );
              })}
            </div>
            <div className="mt-5">
              <Field label="Masa Trial (hari)">
                <Input type="number" min={0} max={90} value={trialDays} onChange={e => setTrialDays(Number(e.target.value))} className="w-32" />
              </Field>
            </div>
          </Card>

          <Button type="submit" disabled={saving} className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 py-6 text-base font-bold shadow-lg shadow-purple-300/40 hover:from-purple-600 hover:to-indigo-600">
            {saving ? <RefreshCw size={18} className="mr-2 animate-spin" /> : <Plus size={18} className="mr-2" />}
            {saving ? "Membuat..." : "Buat Tenant"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
