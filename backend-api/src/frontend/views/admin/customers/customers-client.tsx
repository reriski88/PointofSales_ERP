"use client";

import { useEffect, useMemo, useState } from "react";
import { CreditCard, History, Pencil, Plus, Power, PowerOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CollapsibleSection } from "../_components/collapsible-section";
import { ListControls } from "../_components/list-controls";
import { confirmAction, useToast } from "../_components/toast-provider";
import { useRolePermissions } from "../_components/use-role-permissions";
import { allOutletsValue, useSelectedOutlet } from "@/frontend/controllers/selected-outlet-provider";
import { useRealtimeEvents } from "@/frontend/controllers/use-realtime-events";

type Customer = {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  address: string | null;
  loyaltyPoints: number;
  totalSpent: string;
  receivableBalance: string;
  isActive: boolean;
};
type Receivable = {
  id: string;
  outletName: string;
  customerName: string;
  customerCode: string;
  receiptNumber: string;
  status: string;
  amount: string;
  paidTotal: string;
  dueDate: string | null;
  note: string | null;
  createdAt: string;
};
type CustomerSale = {
  id: string;
  receiptNumber: string;
  outletName: string;
  status: string;
  grandTotal: string;
  createdAt: string;
  receivableStatus: string | null;
};
type ApiResponse<T> = { data: T };

export function CustomersClient() {
  const access = useRolePermissions("customers");
  const { selectedOutletId } = useSelectedOutlet();
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [customerSales, setCustomerSales] = useState<CustomerSale[]>([]);
  const [form, setForm] = useState({ name: "", code: "", phone: "", address: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [historyCustomerId, setHistoryCustomerId] = useState<string | null>(null);
  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name-asc");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const visibleCustomers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return customers
      .filter((item) => {
        const matchesSearch =
          !keyword ||
          [item.name, item.code, item.phone ?? "", item.address ?? ""].join(" ").toLowerCase().includes(keyword);
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "active" && item.isActive) ||
          (statusFilter === "inactive" && !item.isActive) ||
          (statusFilter === "receivable" && Number(item.receivableBalance) > 0);
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "name-desc":
            return b.name.localeCompare(a.name);
          case "debt-desc":
            return Number(b.receivableBalance) - Number(a.receivableBalance);
          case "spent-desc":
            return Number(b.totalSpent) - Number(a.totalSpent);
          case "points-desc":
            return b.loyaltyPoints - a.loyaltyPoints;
          default:
            return a.name.localeCompare(b.name);
        }
      });
  }, [customers, search, sortBy, statusFilter]);

  const historyCustomer = useMemo(
    () => customers.find((item) => item.id === historyCustomerId) ?? null,
    [customers, historyCustomerId],
  );

  async function loadData() {
    setIsLoading(true);
    setMessage(null);
    const receivableUrl =
      selectedOutletId && selectedOutletId !== allOutletsValue
        ? `/api/customer-receivables?outletId=${selectedOutletId}`
        : "/api/customer-receivables";
    const [customerResponse, receivableResponse] = await Promise.all([
      fetch("/api/customers"),
      fetch(receivableUrl),
    ]);
    if (customerResponse.status === 401 || receivableResponse.status === 401) {
      window.location.assign("/admin/login");
      return;
    }
    if (!customerResponse.ok || !receivableResponse.ok) {
      setMessage((await apiErrorMessage(customerResponse)) ?? (await apiErrorMessage(receivableResponse)) ?? "Data pelanggan gagal dimuat.");
      setIsLoading(false);
      return;
    }
    setCustomers(((await customerResponse.json()) as ApiResponse<Customer[]>).data);
    setReceivables(((await receivableResponse.json()) as ApiResponse<Receivable[]>).data);
    setIsLoading(false);
  }

  async function loadCustomerSales(customerId: string) {
    setHistoryCustomerId(customerId);
    setIsHistoryLoading(true);
    const response = await fetch(`/api/customers/${customerId}/sales`);
    if (response.status === 401) {
      window.location.assign("/admin/login");
      return;
    }
    if (!response.ok) {
      showToast({ tone: "error", title: "Histori pembelian gagal dimuat", description: (await apiErrorMessage(response)) ?? undefined });
      setCustomerSales([]);
      setIsHistoryLoading(false);
      return;
    }
    setCustomerSales(((await response.json()) as ApiResponse<CustomerSale[]>).data);
    setIsHistoryLoading(false);
  }

  useEffect(() => {
    queueMicrotask(() => {
      void loadData();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOutletId]);

  useRealtimeEvents({
    topics: ["customers", "sales"],
    debounceMs: 700,
    onEvent: (event) => {
      if (
        selectedOutletId &&
        selectedOutletId !== allOutletsValue &&
        event.outletId &&
        event.outletId !== selectedOutletId
      ) {
        return;
      }
      void loadData();
      if (historyCustomerId) {
        void loadCustomerSales(historyCustomerId);
      }
    },
  });

  async function submitCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    const response = await fetch(editingId ? `/api/customers/${editingId}` : "/api/customers", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        code: form.code || undefined,
        phone: form.phone || null,
        address: form.address || null,
      }),
    });
    if (!response.ok) {
      const errorText = (await apiErrorMessage(response)) ?? "Pelanggan gagal disimpan.";
      setMessage(errorText);
      showToast({ tone: "error", title: "Pelanggan gagal disimpan", description: errorText });
      setIsSubmitting(false);
      return;
    }
    resetForm();
    showToast({ tone: "success", title: editingId ? "Pelanggan diperbarui" : "Pelanggan dibuat" });
    await loadData();
    setIsSubmitting(false);
  }

  function editCustomer(item: Customer) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      code: item.code,
      phone: item.phone ?? "",
      address: item.address ?? "",
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm({ name: "", code: "", phone: "", address: "" });
  }

  async function toggleCustomer(item: Customer) {
    const nextActive = !item.isActive;
    if (!(await confirmAction(`Yakin ingin ${nextActive ? "aktifkan" : "nonaktifkan"} pelanggan ${item.name}?`))) return;
    setIsSubmitting(true);
    const response = await fetch(`/api/customers/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: nextActive }),
    });
    if (!response.ok) {
      showToast({ tone: "error", title: "Status pelanggan gagal diperbarui" });
    } else {
      showToast({ tone: "success", title: `Pelanggan berhasil di${nextActive ? "aktifkan" : "nonaktifkan"}` });
      await loadData();
    }
    setIsSubmitting(false);
  }

  async function payReceivable(item: Receivable) {
    const amount = parseNumber(paymentInputs[item.id] ?? "0");
    if (amount <= 0) {
      showToast({ tone: "error", title: "Nominal pembayaran wajib lebih dari 0" });
      return;
    }
    setIsSubmitting(true);
    const response = await fetch(`/api/customer-receivables/${item.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, method: "cash", note: `Pembayaran piutang ${item.receiptNumber}` }),
    });
    if (!response.ok) {
      const errorText = (await apiErrorMessage(response)) ?? "Pembayaran piutang gagal.";
      showToast({ tone: "error", title: "Pembayaran piutang gagal", description: errorText });
      setIsSubmitting(false);
      return;
    }
    setPaymentInputs((current) => ({ ...current, [item.id]: "" }));
    showToast({ tone: "success", title: "Pembayaran piutang dicatat" });
    await loadData();
    setIsSubmitting(false);
  }

  if (!access.canView && !access.isLoading) {
    return <p className="rounded-lg border p-4 text-sm text-muted-foreground">Akses pelanggan belum diizinkan.</p>;
  }

  return (
    <div className="space-y-6">
      <CollapsibleSection title="Pelanggan" description="Master pelanggan, loyalty, histori total belanja, dan saldo piutang." isLoading={isLoading}>
        {message ? <p className="mb-4 text-sm text-destructive">{message}</p> : null}
        {access.canCreate || (access.canEdit && editingId) ? (
          <form className="grid gap-4 lg:grid-cols-[1fr_0.7fr_0.8fr_1.2fr_auto]" onSubmit={submitCustomer}>
            <Field label="Nama" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
            <Field label="Kode" value={form.code} onChange={(value) => setForm({ ...form, code: value })} />
            <Field label="Telepon" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
            <Field label="Alamat" value={form.address} onChange={(value) => setForm({ ...form, address: value })} />
            <div className="flex items-end gap-2">
              <Button type="submit" disabled={isSubmitting || (editingId ? !access.canEdit : !access.canCreate)}>
                {editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {editingId ? "Perbarui" : "Simpan"}
              </Button>
              {editingId ? (
                <Button type="button" variant="outline" className="h-10 w-10 p-0" onClick={resetForm} aria-label="Batal edit">
                  <X className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </form>
        ) : null}
        <div className="mt-4">
          <ListControls
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Cari nama, kode, telepon..."
            filters={[
              {
                label: "Status",
                value: statusFilter,
                onChange: setStatusFilter,
                options: [
                  { value: "all", label: "Semua" },
                  { value: "active", label: "Aktif" },
                  { value: "inactive", label: "Nonaktif" },
                  { value: "receivable", label: "Ada piutang" },
                ],
              },
            ]}
            sort={sortBy}
            onSortChange={setSortBy}
            sortOptions={[
              { value: "name-asc", label: "Nama A-Z" },
              { value: "name-desc", label: "Nama Z-A" },
              { value: "debt-desc", label: "Piutang terbesar" },
              { value: "spent-desc", label: "Belanja terbesar" },
              { value: "points-desc", label: "Poin tertinggi" },
            ]}
          />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleCustomers.map((item) => (
            <div key={item.id} className="rounded-lg border p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-muted-foreground">{item.code}</p>
                </div>
                <span className={item.isActive ? "text-primary" : "text-muted-foreground"}>
                  {item.isActive ? "Aktif" : "Nonaktif"}
                </span>
              </div>
              <p className="mt-2 text-muted-foreground">{item.phone || "-"}</p>
              <p className="text-muted-foreground">{item.address || "-"}</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Metric label="Poin" value={String(item.loyaltyPoints)} />
                <Metric label="Belanja" value={rupiah(item.totalSpent)} />
                <Metric label="Piutang" value={rupiah(item.receivableBalance)} />
              </div>
              <div className="mt-3 flex gap-2">
                <Button type="button" variant="outline" size="sm" className="h-9 w-9 p-0" onClick={() => void loadCustomerSales(item.id)} aria-label={`Lihat histori pembelian ${item.name}`}>
                  <History className="h-4 w-4" />
                </Button>
                {access.canEdit ? (
                  <>
                  <Button type="button" variant="outline" size="sm" className="h-9 w-9 p-0" onClick={() => editCustomer(item)} aria-label={`Edit pelanggan ${item.name}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant={item.isActive ? "outline" : "secondary"} size="sm" className="h-9 w-9 p-0" onClick={() => void toggleCustomer(item)} aria-label={`${item.isActive ? "Nonaktifkan" : "Aktifkan"} pelanggan ${item.name}`}>
                    {item.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                  </Button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Histori Pembelian" description="Riwayat transaksi pelanggan yang dipilih dari master pelanggan." isLoading={isHistoryLoading}>
        {historyCustomer ? (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
            <div>
              <p className="font-medium">{historyCustomer.name}</p>
              <p className="text-muted-foreground">{historyCustomer.code}</p>
            </div>
            <Button type="button" variant="outline" size="sm" className="h-9 w-9 p-0" onClick={() => {
              setHistoryCustomerId(null);
              setCustomerSales([]);
            }} aria-label="Tutup histori pembelian">
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
        <div className="grid gap-3">
          {customerSales.map((item) => (
            <div key={item.id} className="grid gap-3 rounded-lg border p-4 text-sm md:grid-cols-[1fr_1fr_0.8fr_0.8fr] md:items-center">
              <div>
                <p className="font-medium">{item.receiptNumber}</p>
                <p className="text-muted-foreground">{formatDate(item.createdAt)}</p>
              </div>
              <div>
                <p>{item.outletName}</p>
                <p className="text-muted-foreground">{saleStatusLabel(item.status)}</p>
              </div>
              <Metric label="Total" value={rupiah(item.grandTotal)} />
              <Metric label="Piutang" value={item.receivableStatus ? receivableStatusLabel(item.receivableStatus) : "-"} />
            </div>
          ))}
          {historyCustomer && !customerSales.length && !isHistoryLoading ? (
            <p className="text-sm text-muted-foreground">Belum ada histori pembelian untuk pelanggan ini.</p>
          ) : null}
          {!historyCustomer ? (
            <p className="text-sm text-muted-foreground">Klik ikon histori pada kartu pelanggan untuk melihat riwayat pembelian.</p>
          ) : null}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Piutang Pelanggan" description="Daftar piutang dari transaksi kasir yang belum lunas." isLoading={isLoading}>
        <div className="grid gap-3">
          {receivables.map((item) => {
            const remaining = Math.max(0, Number(item.amount) - Number(item.paidTotal));
            return (
              <div key={item.id} className="rounded-lg border p-4 text-sm">
                <div className="grid gap-3 lg:grid-cols-[1fr_1fr_0.7fr_0.7fr_1.2fr] lg:items-center">
                  <div>
                    <p className="font-medium">{item.customerName}</p>
                    <p className="text-muted-foreground">{item.customerCode}</p>
                  </div>
                  <div>
                    <p>{item.receiptNumber}</p>
                    <p className="text-muted-foreground">{item.outletName}</p>
                  </div>
                  <Metric label="Status" value={receivableStatusLabel(item.status)} />
                  <Metric label="Sisa" value={rupiah(remaining)} />
                  {remaining > 0 && access.canCreate ? (
                    <div className="flex gap-2">
                      <input
                        className="flex h-9 min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        inputMode="decimal"
                        placeholder={`Maks ${rupiah(remaining)}`}
                        value={paymentInputs[item.id] ?? ""}
                        onChange={(event) => setPaymentInputs({ ...paymentInputs, [item.id]: formatNumberInput(event.target.value) })}
                      />
                      <Button type="button" variant="outline" size="sm" className="h-9 w-9 p-0" onClick={() => void payReceivable(item)} disabled={isSubmitting}>
                        <CreditCard className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
          {!receivables.length ? <p className="text-sm text-muted-foreground">Belum ada piutang pelanggan.</p> : null}
        </div>
      </CollapsibleSection>
    </div>
  );
}

function Field(props: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{props.label}</Label>
      <input className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" value={props.value} onChange={(event) => props.onChange(event.target.value)} />
    </div>
  );
}

function Metric(props: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{props.label}</p>
      <p className="font-medium">{props.value}</p>
    </div>
  );
}

function rupiah(value: string | number) {
  return `Rp ${Number(value ?? 0).toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
}

function parseNumber(value: string) {
  return Number(value.replace(/\./g, "").replace(",", ".")) || 0;
}

function formatNumberInput(value: string) {
  const cleaned = value.replace(/[^\d,]/g, "");
  const [wholeRaw, decimalRaw] = cleaned.split(",");
  const whole = wholeRaw.replace(/^0+(?=\d)/, "") || "0";
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return cleaned.includes(",") ? `${grouped},${decimalRaw ?? ""}` : grouped;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function saleStatusLabel(status: string) {
  return {
    completed: "Selesai",
    voided: "Dibatalkan",
    refunded: "Refund",
    sync_review: "Perlu review",
  }[status] ?? status;
}

function receivableStatusLabel(status: string) {
  return {
    open: "Terbuka",
    partial: "Sebagian",
    paid: "Lunas",
    voided: "Dibatalkan",
  }[status] ?? status;
}

async function apiErrorMessage(response: Response) {
  try {
    const json = (await response.json()) as { error?: { message?: string } };
    return json.error?.message ?? null;
  } catch {
    return null;
  }
}
