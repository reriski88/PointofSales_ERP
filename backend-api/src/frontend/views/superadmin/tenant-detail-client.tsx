"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Save, Building2, CreditCard, Wallet, Receipt,
  CheckCircle2, AlertCircle, Plus, Calendar, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

type TenantDetail = {
  tenant: {
    id: string; name: string;
    contactName: string | null; contactPhone: string | null;
    contactEmail: string | null; address: string | null;
    isActive: boolean; createdAt: string;
    subId: string | null; subPlanId: string | null;
    subPlanName: string | null; subPlanCode: string | null;
    subStatus: string | null; subTrialEndsAt: string | null;
    subPeriodStart: string | null; subPeriodEnd: string | null;
    subBillingCycle: string | null; subAutoRenew: boolean | null;
    subSuspendedReason: string | null;
  };
  payments: Array<{
    id: string; amount: string; method: string | null;
    reference: string | null; status: string;
    periodStart: string; periodEnd: string;
    paidAt: string; note: string | null;
  }>;
};

type Plan = { id: string; name: string; code: string; priceMonthly: string; priceYearly: string };

const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string; icon: React.ReactNode }> = {
  active:       { label: "Aktif",        bg: "bg-emerald-50",  text: "text-emerald-700",  dot: "bg-emerald-500", icon: <CheckCircle2 size={16} /> },
  trial:        { label: "Trial",        bg: "bg-sky-50",      text: "text-sky-700",      dot: "bg-sky-500",     icon: <Calendar size={16} /> },
  grace_period: { label: "Tenggang",     bg: "bg-amber-50",    text: "text-amber-700",    dot: "bg-amber-500",   icon: <AlertCircle size={16} /> },
  suspended:    { label: "Ditangguhkan", bg: "bg-rose-50",     text: "text-rose-700",     dot: "bg-rose-500",    icon: <AlertCircle size={16} /> },
  cancelled:    { label: "Dibatalkan",   bg: "bg-slate-100",   text: "text-slate-600",    dot: "bg-slate-400",   icon: <AlertCircle size={16} /> },
  expired:      { label: "Kadaluarsa",   bg: "bg-stone-100",   text: "text-stone-500",    dot: "bg-stone-400",   icon: <AlertCircle size={16} /> },
};

export function SuperadminTenantDetailClient() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [data, setData] = useState<TenantDetail | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error">("error");

  // Payment form
  const [showPayForm, setShowPayForm] = useState(false);
  const [payAmount, setPayAmount] = useState(0);
  const [payMonths, setPayMonths] = useState(1);
  const [payMethod, setPayMethod] = useState("manual");
  const [payReference, setPayReference] = useState("");
  const [payNote, setPayNote] = useState("");
  const [paySaving, setPaySaving] = useState(false);

  // Editable fields
  const [tenantName, setTenantName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [address, setAddress] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [subStatus, setSubStatus] = useState("trial");
  const [subPlanId, setSubPlanId] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [suspendedReason, setSuspendedReason] = useState("");

  useEffect(() => { fetchData(); fetchPlans(); }, [id]);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/superadmin/tenants/${id}`);
      const json = await res.json();
      const d = json.data as TenantDetail;
      setData(d);
      setTenantName(d.tenant.name);
      setContactName(d.tenant.contactName ?? "");
      setContactPhone(d.tenant.contactPhone ?? "");
      setContactEmail(d.tenant.contactEmail ?? "");
      setAddress(d.tenant.address ?? "");
      setIsActive(d.tenant.isActive);
      setSubStatus(d.tenant.subStatus ?? "trial");
      setSubPlanId(d.tenant.subPlanId ?? "");
      setPeriodEnd(d.tenant.subPeriodEnd ? new Date(d.tenant.subPeriodEnd).toISOString().slice(0, 10) : "");
      setSuspendedReason(d.tenant.subSuspendedReason ?? "");
    } finally { setLoading(false); }
  }

  async function fetchPlans() {
    try {
      const res = await fetch("/api/superadmin/plans");
      const json = await res.json();
      setPlans(json.data ?? []);
    } catch { /* ignore */ }
  }

  async function onSave() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`/api/superadmin/tenants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant: { name: tenantName, contactName: contactName || null, contactPhone: contactPhone || null, contactEmail: contactEmail || null, address: address || null, isActive },
          subscription: {
            planId: subPlanId || undefined,
            status: subStatus,
            currentPeriodEnd: periodEnd ? new Date(periodEnd).toISOString() : undefined,
            suspendedReason: subStatus === "suspended" ? suspendedReason : undefined,
          },
        }),
      });
      if (res.ok) {
        setMsgType("success");
        setMessage("Berhasil disimpan.");
        fetchData();
      } else {
        const err = await res.json();
        setMsgType("error");
        setMessage(err.error?.message ?? "Gagal menyimpan.");
      }
    } finally { setSaving(false); }
  }

  async function onAddPayment(e: React.FormEvent) {
    e.preventDefault();
    setPaySaving(true);
    setMessage("");
    try {
      const res = await fetch(`/api/superadmin/tenants/${id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: payAmount, method: payMethod, reference: payReference, months: payMonths, note: payNote }),
      });
      if (res.ok) {
        setMsgType("success");
        setMessage("Pembayaran berhasil dikonfirmasi. Subscription diperpanjang & diaktifkan.");
        setShowPayForm(false);
        setPayAmount(0); setPayReference(""); setPayNote("");
        fetchData();
      } else {
        const err = await res.json();
        setMsgType("error");
        setMessage(err.error?.message ?? "Gagal menambah pembayaran.");
      }
    } finally { setPaySaving(false); }
  }

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-200 border-t-purple-500" /></div>;
  if (!data) return <div className="p-6 text-rose-500">Tenant tidak ditemukan.</div>;

  const t = data.tenant;
  const cfg = statusConfig[t.subStatus ?? "trial"] ?? statusConfig.trial;
  const selectedPlan = plans.find(p => p.id === subPlanId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="rounded-xl bg-white p-2.5 text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-700">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900">{t.name}</h1>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${cfg.bg} ${cfg.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
          </div>
          <p className="text-sm text-slate-400">Dibuat {new Date(t.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
      </div>

      {message && (
        <div className={`rounded-2xl px-4 py-3 text-sm font-semibold ${msgType === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{message}</div>
      )}

      {/* Subscription Summary Card */}
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-purple-600 via-indigo-500 to-sky-400 p-6 text-white shadow-xl shadow-purple-300/30">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/20 blur-2xl" />
        <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-amber-200/30 blur-2xl" />
        <div className="relative grid gap-6 md:grid-cols-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-white/50">Plan</div>
            <div className="mt-1 text-2xl font-black">{t.subPlanName ?? "-"}</div>
            <div className="text-xs text-white/40">{selectedPlan ? `Rp${Number(selectedPlan.priceMonthly).toLocaleString("id-ID")}/bln` : ""}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-white/50">Status</div>
            <div className="mt-1 inline-flex items-center gap-2 text-lg font-bold">{cfg.icon} {cfg.label}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-white/50">Periode Berakhir</div>
            <div className="mt-1 text-lg font-bold">{t.subPeriodEnd ? new Date(t.subPeriodEnd).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-"}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-white/50">Trial Berakhir</div>
            <div className="mt-1 text-lg font-bold">{t.subTrialEndsAt ? new Date(t.subTrialEndsAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-"}</div>
          </div>
        </div>
        <div className="relative mt-6">
          <Button onClick={() => setShowPayForm(s => !s)} className="bg-white text-purple-900 hover:bg-purple-50">
            <Wallet size={16} className="mr-2" /> {showPayForm ? "Tutup Form" : "Tambah Pembayaran"}
          </Button>
        </div>
      </Card>

      {/* Payment Form */}
      {showPayForm && (
        <Card className="border-2 border-purple-200 bg-purple-50/40 p-6 shadow-lg shadow-purple-900/5">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-600"><Receipt size={20} /></div>
            <div>
              <h2 className="text-lg font-black text-slate-800">Konfirmasi Pembayaran</h2>
              <p className="text-xs text-slate-400">Perpanjang periode & aktifkan subscription otomatis</p>
            </div>
          </div>
          <form onSubmit={onAddPayment} className="grid gap-4 md:grid-cols-4">
            <Field label="Jumlah (Rp)"><Input type="number" min={0} value={payAmount} onChange={e => setPayAmount(Number(e.target.value))} placeholder="Otomatis dari plan" /></Field>
            <Field label="Bulan"><Input type="number" min={1} max={36} value={payMonths} onChange={e => setPayMonths(Number(e.target.value))} /></Field>
            <Field label="Metode"><select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="manual">Manual</option><option value="transfer">Transfer</option><option value="cash">Cash</option><option value="qris">QRIS</option></select></Field>
            <Field label="Referensi"><Input value={payReference} onChange={e => setPayReference(e.target.value)} placeholder="INV-001" /></Field>
            <div className="md:col-span-4">
              <Field label="Catatan"><Input value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="Catatan internal..." /></Field>
            </div>
            <div className="md:col-span-4">
              <Button type="submit" disabled={paySaving} className="bg-purple-600 hover:bg-purple-700">
                {paySaving ? <RefreshCw size={16} className="mr-2 animate-spin" /> : <CheckCircle2 size={16} className="mr-2" />}
                {paySaving ? "Memproses..." : "Konfirmasi & Perpanjang"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Edit Forms */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tenant Info */}
        <Card className="border-0 bg-white p-6 shadow-lg shadow-slate-900/5">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-600"><Building2 size={20} /></div>
            <h2 className="text-lg font-black text-slate-800">Info Tenant</h2>
          </div>
          <div className="space-y-4">
            <Field label="Nama Tenant"><Input value={tenantName} onChange={e => setTenantName(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nama Kontak"><Input value={contactName} onChange={e => setContactName(e.target.value)} /></Field>
              <Field label="Telepon"><Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} /></Field>
            </div>
            <Field label="Email"><Input value={contactEmail} onChange={e => setContactEmail(e.target.value)} /></Field>
            <Field label="Alamat"><Input value={address} onChange={e => setAddress(e.target.value)} /></Field>
            <div className="flex items-center gap-3">
              <Label>Status Tenant</Label>
              <select value={isActive ? "active" : "inactive"} onChange={e => setIsActive(e.target.value === "active")} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm">
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Subscription */}
        <Card className="border-0 bg-white p-6 shadow-lg shadow-slate-900/5">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600"><CreditCard size={20} /></div>
            <h2 className="text-lg font-black text-slate-800">Langganan</h2>
          </div>
          <div className="space-y-4">
            <Field label="Plan">
              <select value={subPlanId} onChange={e => setSubPlanId(e.target.value)} className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
                <option value="">Pilih plan...</option>
                {plans.map(p => <option key={p.id} value={p.id}>{p.name} (Rp{Number(p.priceMonthly).toLocaleString("id-ID")}/bln)</option>)}
              </select>
            </Field>
            <Field label="Status Langganan">
              <select value={subStatus} onChange={e => setSubStatus(e.target.value)} className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
                {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
            {subStatus === "suspended" && (
              <Field label="Alasan Suspended"><Input value={suspendedReason} onChange={e => setSuspendedReason(e.target.value)} /></Field>
            )}
            <Field label="Periode Berakhir"><Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} /></Field>
          </div>
        </Card>
      </div>

      {/* Save Button */}
      <div className="flex gap-3">
        <Button onClick={onSave} disabled={saving} className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600">
          {saving ? <RefreshCw size={16} className="mr-2 animate-spin" /> : <Save size={16} className="mr-2" />}
          {saving ? "Menyimpan..." : "Simpan Perubahan"}
        </Button>
      </div>

      {/* Payment History */}
      <Card className="overflow-hidden border-0 bg-white shadow-lg shadow-slate-900/5">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-black text-slate-800">Riwayat Pembayaran</h2>
        </div>
        {data.payments.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Receipt size={26} /></div>
            <p className="mt-3 text-sm text-slate-400">Belum ada pembayaran tercatat.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 text-left text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-bold">Tanggal</th>
                  <th className="px-6 py-3 font-bold">Jumlah</th>
                  <th className="px-6 py-3 font-bold">Periode</th>
                  <th className="px-6 py-3 font-bold">Metode</th>
                  <th className="px-6 py-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map(p => (
                  <tr key={p.id} className="border-t border-slate-50 transition hover:bg-emerald-50/30">
                    <td className="px-6 py-3.5 text-slate-600">{new Date(p.paidAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td className="px-6 py-3.5 font-bold text-emerald-700">Rp{Number(p.amount).toLocaleString("id-ID")}</td>
                    <td className="px-6 py-3.5 text-xs text-slate-500">
                      {new Date(p.periodStart).toLocaleDateString("id-ID")} - {new Date(p.periodEnd).toLocaleDateString("id-ID")}
                    </td>
                    <td className="px-6 py-3.5 text-slate-600">{p.method ?? "-"}</td>
                    <td className="px-6 py-3.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                        <CheckCircle2 size={12} /> {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
