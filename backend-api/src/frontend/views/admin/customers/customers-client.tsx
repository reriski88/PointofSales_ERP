"use client";

import { useEffect, useMemo, useState, type ComponentProps, type ComponentType } from "react";
import { ChevronLeft, ChevronRight, ChevronsUpDown, CreditCard, Edit3, History, MapPin, Phone, Plus, Power, PowerOff, Search, UserCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminModal } from "../_components/admin-modal";
import { CodeInput } from "../_components/code-input";
import { pageItems } from "../_components/pagination-controls";
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
type CustomerIconButtonProps = ComponentProps<typeof Button> & { compact?: boolean };

const initialForm = { name: "", code: "", phone: "", address: "" };

function CustomerIconButton({ className, compact, ...props }: CustomerIconButtonProps) {
  return <Button {...props} className={[compact ? "h-8 w-8" : "h-10 w-10", "shrink-0 p-0", className].filter(Boolean).join(" ")} />;
}

export function CustomersClient() {
  const access = useRolePermissions("customers");
  const { selectedOutletId } = useSelectedOutlet();
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [customerSales, setCustomerSales] = useState<CustomerSale[]>([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [historyCustomerId, setHistoryCustomerId] = useState<string | null>(null);
  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name-asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [receivablePage, setReceivablePage] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const visibleCustomers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return customers
      .filter((item) => {
        const matchesSearch = !keyword || [item.name, item.code, item.phone ?? "", item.address ?? ""].join(" ").toLowerCase().includes(keyword);
        const matchesStatus = statusFilter === "all" || (statusFilter === "active" && item.isActive) || (statusFilter === "inactive" && !item.isActive) || (statusFilter === "receivable" && Number(item.receivableBalance) > 0);
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
          case "status":
            return Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name);
          default:
            return a.name.localeCompare(b.name);
        }
      });
  }, [customers, search, sortBy, statusFilter]);
  const pagedCustomers = pageItems(visibleCustomers, page, pageSize);
  const pagedReceivables = pageItems(receivables, receivablePage, pageSize);
  const pageCount = Math.max(1, Math.ceil(visibleCustomers.length / pageSize));
  const receivablePageCount = Math.max(1, Math.ceil(receivables.length / pageSize));
  const historyCustomer = useMemo(() => customers.find((item) => item.id === historyCustomerId) ?? null, [customers, historyCustomerId]);

  async function loadData() {
    setIsLoading(true);
    setMessage(null);
    const receivableUrl = selectedOutletId && selectedOutletId !== allOutletsValue ? `/api/customer-receivables?outletId=${selectedOutletId}` : "/api/customer-receivables";
    const [customerResponse, receivableResponse] = await Promise.all([fetch("/api/customers"), fetch(receivableUrl)]);
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
    queueMicrotask(() => void loadData());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOutletId]);

  useRealtimeEvents({
    topics: ["customers", "sales"],
    debounceMs: 700,
    onEvent: (event) => {
      if (selectedOutletId && selectedOutletId !== allOutletsValue && event.outletId && event.outletId !== selectedOutletId) return;
      void loadData();
      if (historyCustomerId) void loadCustomerSales(historyCustomerId);
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
        code: normalizeCustomerCode(form.code || form.name) || undefined,
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
    setIsCustomerModalOpen(true);
    setForm({ name: item.name, code: item.code, phone: item.phone ?? "", address: item.address ?? "" });
  }

  function resetForm() {
    setEditingId(null);
    setIsCustomerModalOpen(false);
    setForm(initialForm);
  }

  function openCreateCustomer() {
    setEditingId(null);
    setForm(initialForm);
    setIsCustomerModalOpen(true);
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
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <section data-tour="section" className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="border-b px-5 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold leading-snug text-foreground">Daftar Pelanggan</h2>
              <p className="mt-1 text-xs leading-4 text-muted-foreground">Pelanggan dipakai untuk loyalty, histori belanja, dan piutang kasir.</p>
            </div>
            {access.canCreate ? <CustomerIconButton type="button" onClick={openCreateCustomer} aria-label="Tambah pelanggan" title="Tambah pelanggan"><Plus className="h-4 w-4" /></CustomerIconButton> : null}
          </div>
        </div>
        <div className="p-4">
          <CustomerTableControls search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} pageSize={pageSize} setPageSize={setPageSize} setPage={setPage} />
          <div className="thin-x-scroll overflow-x-auto rounded-xl border bg-card">
            <div className="min-w-[1040px]">
              <div className="grid grid-cols-[minmax(180px,1.1fr)_minmax(130px,0.85fr)_minmax(200px,1.2fr)_minmax(90px,0.75fr)_minmax(120px,0.85fr)_minmax(110px,0.75fr)_128px] gap-3 border-b bg-background px-4 py-3 text-xs font-semibold text-foreground">
                <button type="button" className="flex items-center justify-between gap-2 text-left" onClick={() => setSortBy(sortBy === "name-asc" ? "name-desc" : "name-asc")}>Pelanggan <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" /></button>
                <span>Kontak</span>
                <span>Alamat</span>
                <button type="button" className="flex items-center justify-between gap-2 text-left" onClick={() => setSortBy("points-desc")}>Poin <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" /></button>
                <button type="button" className="flex items-center justify-between gap-2 text-left" onClick={() => setSortBy("debt-desc")}>Piutang <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" /></button>
                <button type="button" className="flex items-center justify-between gap-2 text-left" onClick={() => setSortBy("status")}>Status <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" /></button>
                <span className="data-action-head">Aksi</span>
              </div>
              {pagedCustomers.map((item) => (
                <div key={item.id} className="border-b bg-background text-sm last:border-b-0">
                  <div className="grid grid-cols-[minmax(180px,1.1fr)_minmax(130px,0.85fr)_minmax(200px,1.2fr)_minmax(90px,0.75fr)_minmax(120px,0.85fr)_minmax(110px,0.75fr)_128px] items-center gap-3 px-4 py-3">
                    <div className="min-w-0"><p className="truncate font-medium">{item.name}</p><p className="truncate text-xs text-muted-foreground">{item.code}</p></div>
                    <p className="truncate text-muted-foreground">{item.phone || "-"}</p>
                    <p className="truncate text-muted-foreground">{item.address || "-"}</p>
                    <p className="font-medium">{item.loyaltyPoints.toLocaleString("id-ID")}</p>
                    <p className={Number(item.receivableBalance) > 0 ? "font-medium text-amber-700" : "text-muted-foreground"}>{rupiah(item.receivableBalance)}</p>
                    <div><span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${item.isActive ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{item.isActive ? "Aktif" : "Nonaktif"}</span></div>
                    <div className="data-action-cell gap-1">
                      <CustomerIconButton type="button" variant="outline" compact className="border-violet-200 text-violet-600 hover:bg-violet-50 hover:text-violet-700" onClick={() => void loadCustomerSales(item.id)} aria-label={`Histori ${item.name}`} title="Histori"><History className="h-4 w-4" /></CustomerIconButton>
                      {access.canEdit ? <><CustomerIconButton type="button" variant="outline" compact className="border-sky-200 text-sky-600 hover:bg-sky-50 hover:text-sky-700" onClick={() => editCustomer(item)} aria-label={`Edit ${item.name}`} title="Edit"><Edit3 className="h-4 w-4" /></CustomerIconButton><CustomerIconButton type="button" variant="secondary" compact className={item.isActive ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"} onClick={() => void toggleCustomer(item)} disabled={isSubmitting} aria-label={`${item.isActive ? "Nonaktifkan" : "Aktifkan"} ${item.name}`} title={item.isActive ? "Nonaktifkan" : "Aktifkan"}>{item.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}</CustomerIconButton></> : null}
                    </div>
                  </div>
                </div>
              ))}
              {!visibleCustomers.length && !isLoading ? <p className="px-4 py-6 text-sm text-muted-foreground">Data pelanggan tidak ditemukan.</p> : null}
            </div>
          </div>
          <TablePagination page={page} pageCount={pageCount} pageSize={pageSize} total={visibleCustomers.length} setPage={setPage} />
        </div>
      </section>

      <ReceivableSection receivables={pagedReceivables} total={receivables.length} page={receivablePage} pageCount={receivablePageCount} pageSize={pageSize} setPage={setReceivablePage} paymentInputs={paymentInputs} setPaymentInputs={setPaymentInputs} payReceivable={payReceivable} isSubmitting={isSubmitting} canCreate={access.canCreate} />

      <AdminModal open={isCustomerModalOpen} title={editingId ? "Edit Pelanggan" : "Tambah Pelanggan"} description="Data pelanggan dipakai untuk loyalty, piutang, dan histori transaksi." size="lg" onClose={resetForm}>
        <form className="space-y-5" onSubmit={submitCustomer}>
          <CustomerFormSummary name={form.name} code={form.code} phone={form.phone} />
          <div className="rounded-lg border bg-background p-4">
            <p className="mb-3 text-sm font-semibold">Identitas Pelanggan</p>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nama" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
              <CodeInput label="Kode" value={form.code} prefix="CST" showRandomButton={false} helperText="Kosongkan untuk memakai kode dari nama." onChange={(value) => setForm({ ...form, code: normalizeCustomerCode(value) })} />
            </div>
          </div>
          <div className="rounded-lg border bg-background p-4">
            <p className="mb-3 text-sm font-semibold">Kontak</p>
            <div className="grid gap-4 md:grid-cols-2">
              <IconField icon={Phone} label="Telepon" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
              <IconField icon={MapPin} label="Alamat" value={form.address} onChange={(value) => setForm({ ...form, address: value })} />
            </div>
          </div>
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Kode pelanggan tampil di pencarian kasir, histori pembelian, piutang, dan laporan.</p>
          <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={resetForm}><X className="h-4 w-4" />Batal</Button><Button type="submit" disabled={isSubmitting || (editingId ? !access.canEdit : !access.canCreate)}><Plus className="h-4 w-4" />{editingId ? "Perbarui" : "Simpan"}</Button></div>
        </form>
      </AdminModal>

      <AdminModal open={Boolean(historyCustomerId)} title="Histori Pembelian" description={historyCustomer ? `${historyCustomer.name} (${historyCustomer.code})` : undefined} size="xl" onClose={() => { setHistoryCustomerId(null); setCustomerSales([]); }}>
        {isHistoryLoading ? <p className="text-sm text-muted-foreground">Memuat histori...</p> : <HistoryTable rows={customerSales} />}
      </AdminModal>
    </div>
  );
}

function CustomerTableControls(props: { search: string; setSearch: (value: string) => void; statusFilter: string; setStatusFilter: (value: string) => void; pageSize: number; setPageSize: (value: number) => void; setPage: (value: number) => void }) {
  return <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground"><span>Show</span><select className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" value={props.pageSize} onChange={(event) => { props.setPageSize(Number(event.target.value)); props.setPage(1); }}>{[5, 10, 20, 50, 100].map((value) => <option key={value} value={value}>{value}</option>)}</select><span>entries</span><select className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" value={props.statusFilter} onChange={(event) => { props.setStatusFilter(event.target.value); props.setPage(1); }}><option value="all">Semua</option><option value="active">Aktif</option><option value="inactive">Nonaktif</option><option value="receivable">Ada piutang</option></select></div><div className="relative md:w-80"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" /><Input className="h-11 rounded-lg pl-11" value={props.search} placeholder="Search..." onChange={(event) => { props.setSearch(event.target.value); props.setPage(1); }} /></div></div>;
}

function TablePagination(props: { page: number; pageCount: number; pageSize: number; total: number; setPage: (updater: number | ((current: number) => number)) => void }) {
  return <div className="mt-4 flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:justify-between"><p className="text-sm text-muted-foreground">Showing {props.total ? (props.page - 1) * props.pageSize + 1 : 0} to {Math.min(props.page * props.pageSize, props.total)} of {props.total} entries</p><div className="flex items-center gap-3"><CustomerIconButton type="button" variant="outline" disabled={props.page <= 1} onClick={() => props.setPage((current) => Math.max(1, current - 1))} aria-label="Sebelumnya"><ChevronLeft className="h-4 w-4" /></CustomerIconButton><span className="inline-flex h-10 min-w-10 items-center justify-center rounded-lg bg-primary/10 px-3 text-sm font-semibold text-primary">{Math.min(props.page, props.pageCount)}</span><CustomerIconButton type="button" variant="outline" disabled={props.page >= props.pageCount} onClick={() => props.setPage((current) => Math.min(props.pageCount, current + 1))} aria-label="Berikutnya"><ChevronRight className="h-4 w-4" /></CustomerIconButton></div></div>;
}

function ReceivableSection(props: { receivables: Receivable[]; total: number; page: number; pageCount: number; pageSize: number; setPage: (updater: number | ((current: number) => number)) => void; paymentInputs: Record<string, string>; setPaymentInputs: (value: Record<string, string>) => void; payReceivable: (item: Receivable) => Promise<void>; isSubmitting: boolean; canCreate: boolean }) {
  return <section data-tour="section" className="overflow-hidden rounded-lg border bg-card shadow-sm"><div className="border-b px-5 py-4"><h2 className="text-base font-semibold leading-snug text-foreground">Piutang Pelanggan</h2><p className="mt-1 text-xs leading-4 text-muted-foreground">Daftar piutang dari transaksi kasir yang belum lunas.</p></div><div className="p-4"><div className="thin-x-scroll overflow-x-auto rounded-xl border"><div className="min-w-[860px]"><div className="grid grid-cols-[1fr_1fr_0.8fr_0.8fr_1fr] gap-3 border-b bg-background px-4 py-3 text-xs font-semibold"><span>Pelanggan</span><span>Struk</span><span>Status</span><span>Sisa</span><span className="text-right">Bayar</span></div>{props.receivables.map((item) => { const remaining = Math.max(0, Number(item.amount) - Number(item.paidTotal)); return <div key={item.id} className="grid grid-cols-[1fr_1fr_0.8fr_0.8fr_1fr] items-center gap-3 border-b bg-background px-4 py-3 text-sm last:border-b-0"><div><p className="font-medium">{item.customerName}</p><p className="text-xs text-muted-foreground">{item.customerCode}</p></div><div><p>{item.receiptNumber}</p><p className="text-xs text-muted-foreground">{item.outletName}</p></div><p className="text-muted-foreground">{receivableStatusLabel(item.status)}</p><p className="font-medium text-amber-700">{rupiah(remaining)}</p><div className="flex justify-end gap-2">{remaining > 0 && props.canCreate ? <><Input className="h-9 max-w-40" inputMode="decimal" placeholder={`Maks ${rupiah(remaining)}`} value={props.paymentInputs[item.id] ?? ""} onChange={(event) => props.setPaymentInputs({ ...props.paymentInputs, [item.id]: formatNumberInput(event.target.value) })} /><CustomerIconButton type="button" variant="outline" compact className="border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700" onClick={() => void props.payReceivable(item)} disabled={props.isSubmitting} aria-label="Bayar piutang" title="Bayar piutang"><CreditCard className="h-4 w-4" /></CustomerIconButton></> : null}</div></div>; })}{!props.total ? <p className="px-4 py-6 text-sm text-muted-foreground">Belum ada piutang pelanggan.</p> : null}</div></div><TablePagination page={props.page} pageCount={props.pageCount} pageSize={props.pageSize} total={props.total} setPage={props.setPage} /></div></section>;
}

function HistoryTable(props: { rows: CustomerSale[] }) {
  if (!props.rows.length) return <p className="text-sm text-muted-foreground">Belum ada histori pembelian untuk pelanggan ini.</p>;
  return <div className="thin-x-scroll overflow-x-auto rounded-xl border"><div className="min-w-[720px]"><div className="grid grid-cols-[1fr_1fr_0.8fr_0.8fr] gap-3 border-b bg-background px-4 py-3 text-xs font-semibold"><span>Struk</span><span>Outlet</span><span>Total</span><span>Status</span></div>{props.rows.map((item) => <div key={item.id} className="grid grid-cols-[1fr_1fr_0.8fr_0.8fr] gap-3 border-b bg-background px-4 py-3 text-sm last:border-b-0"><div><p className="font-medium">{item.receiptNumber}</p><p className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</p></div><p>{item.outletName}</p><p className="font-medium">{rupiah(item.grandTotal)}</p><p className="text-muted-foreground">{saleStatusLabel(item.status)}</p></div>)}</div></div>;
}

function CustomerFormSummary(props: { name: string; code: string; phone: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-emerald-100 bg-emerald-50/70 p-4 sm:flex-row sm:items-center">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border bg-white">
        <UserCircle className="h-7 w-7 text-emerald-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-foreground">{props.name || "Nama pelanggan"}</p>
        <p className="truncate text-sm text-muted-foreground">{props.phone || "Telepon belum diisi"}</p>
      </div>
      <span className="inline-flex h-8 w-fit items-center rounded-full border border-emerald-200 bg-white px-3 text-xs font-semibold text-emerald-700">{props.code || "Kode otomatis"}</span>
    </div>
  );
}

function IconField(props: { icon: ComponentType<{ className?: string }>; label: string; value: string; onChange: (value: string) => void }) {
  const Icon = props.icon;
  return (
    <div className="space-y-2">
      <Label>{props.label}</Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" value={props.value} onChange={(event) => props.onChange(event.target.value)} />
      </div>
    </div>
  );
}

function Field(props: { label: string; value: string; onChange: (value: string) => void }) {
  return <div className="space-y-2"><Label>{props.label}</Label><Input value={props.value} onChange={(event) => props.onChange(event.target.value)} /></div>;
}

function rupiah(value: string | number) {
  return `Rp ${Number(value ?? 0).toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
}

function parseNumber(value: string) {
  return Number(value.replace(/\./g, "").replace(",", ".")) || 0;
}

function normalizeCustomerCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32);
}

function formatNumberInput(value: string) {
  const cleaned = value.replace(/[^\d,]/g, "");
  const [wholeRaw, decimalRaw] = cleaned.split(",");
  const whole = wholeRaw.replace(/^0+(?=\d)/, "") || "0";
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return cleaned.includes(",") ? `${grouped},${decimalRaw ?? ""}` : grouped;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function saleStatusLabel(status: string) {
  return { completed: "Selesai", voided: "Dibatalkan", refunded: "Refund", sync_review: "Perlu review" }[status] ?? status;
}

function receivableStatusLabel(status: string) {
  return { open: "Terbuka", partial: "Sebagian", paid: "Lunas", voided: "Dibatalkan" }[status] ?? status;
}

async function apiErrorMessage(response: Response) {
  try {
    const json = (await response.json()) as { error?: { message?: string } };
    return json.error?.message ?? null;
  } catch {
    return null;
  }
}
