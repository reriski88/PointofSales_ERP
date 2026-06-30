"use client";

import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { BarChart3, BookOpenText, ChevronLeft, ChevronRight, Download, Landmark, LineChart, ListChecks, Search, Wallet } from "lucide-react";
import { useLanguage, type AppLanguage } from "@/frontend/controllers/language-provider";
import { allOutletsValue, useSelectedOutlet } from "@/frontend/controllers/selected-outlet-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRolePermissions } from "../_components/use-role-permissions";
import { useToast } from "../_components/toast-provider";
import { getOutlets, getProfile } from "@/frontend/controllers/admin-data-cache";
import { useRealtimeEvents } from "@/frontend/controllers/use-realtime-events";

type Outlet = {
  id: string;
  name: string;
  code: string;
};

type ApiResponse<T> = { data: T };
type Profile = { role: string };
type SalesSummary = {
  transactionCount: number;
  grossSales: string;
  netSales: string;
  cogs: string;
  grossProfit: string;
};

type InventorySummary = {
  skuCount: number;
  totalOnHandBaseQty: string;
  criticalStockCount: number;
};

type WasteSummary = {
  adjustmentCount: number;
  totalQuantityBase: string;
  totalEstimatedLoss: string;
};

type PaymentSummary = {
  method: string;
  amount: string;
};

type InventoryValuation = {
  inventoryValue: string;
  skuCount: number;
};

type FinancialSummary = {
  sales: SalesSummary;
  inventory: InventorySummary;
  waste: WasteSummary;
  payments: PaymentSummary[];
  valuation: InventoryValuation;
};

type ReportTab = "profitLoss" | "balanceSheet" | "cashFlow" | "equityChanges" | "notes";

const tabOrder: ReportTab[] = ["profitLoss", "balanceSheet", "cashFlow", "equityChanges", "notes"];
type FinancialIconButtonProps = ComponentProps<typeof Button> & { compact?: boolean };

function FinancialIconButton({ className, compact, ...props }: FinancialIconButtonProps) {
  return <Button {...props} className={[compact ? "h-8 w-8" : "h-10 w-10", "shrink-0 p-0", className].filter(Boolean).join(" ")} />;
}

export function FinancialReportsClient() {
  const { language, t } = useLanguage();
  const { selectedOutletId } = useSelectedOutlet();
  const access = useRolePermissions("financialReports");
  const { showToast } = useToast();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [outletId, setOutletId] = useState("");
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [activeTab, setActiveTab] = useState<ReportTab>("profitLoss");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const report = useMemo(
    () =>
      summary
        ? buildFinancialReport({
            language,
            summary,
            outletLabel: currentOutletLabel(outlets, outletId, t("allOutlets")),
            generatedAt: new Date(),
          })
        : null,
    [language, outletId, outlets, summary, t],
  );

  async function loadOutlets() {
    try {
      const [profile, outlets] = await Promise.all([getProfile(), getOutlets()]);
      const nextCanViewAll = ["owner", "auditor"].includes(profile.role);
      const selectedIsAllowed =
        selectedOutletId === allOutletsValue
          ? nextCanViewAll
          : outlets.some((outlet) => outlet.id === selectedOutletId);
      const nextOutletId =
        (selectedIsAllowed ? selectedOutletId : "") ||
        (nextCanViewAll ? allOutletsValue : outlets[0]?.id || "");
      setOutlets(outlets);
      setOutletId(nextOutletId);
      if (nextOutletId) {
        await loadFinancialSummary(nextOutletId);
      } else {
        setIsLoading(false);
      }
    } catch {
      setMessage(t("financialLoadFailed"));
      setIsLoading(false);
      return;
    }
  }

  function reportQuery(nextOutletId = outletId) {
    if (nextOutletId === allOutletsValue) return "";
    return `outletId=${encodeURIComponent(nextOutletId)}`;
  }

  function reportUrl(path: string, nextOutletId = outletId) {
    const query = reportQuery(nextOutletId);
    return query ? `${path}?${query}` : path;
  }

  async function loadFinancialSummary(nextOutletId = outletId) {
    if (!nextOutletId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setMessage(null);
    const response = await fetch(reportUrl("/api/reports/financial-summary", nextOutletId));
    if (response.status === 401) {
      window.location.href = "/admin/login";
      return;
    }
    if (!response.ok) {
      setMessage(t("financialLoadFailed"));
      setIsLoading(false);
      return;
    }

    const json = (await response.json()) as ApiResponse<FinancialSummary>;
    setSummary(json.data);
    setIsLoading(false);
  }

  function exportActiveReport() {
    if (!report || isExporting) return;
    if (!access.canExport) {
      showToast({
        tone: "error",
        title: t("financialExportDenied"),
        description: t("financialExportDeniedDesc"),
      });
      return;
    }

    setIsExporting(true);
    try {
      downloadSheet({
        language,
        title: report.labels[activeTab],
        filePrefix: report.filePrefix,
        rows: report.sheets[activeTab],
        generatedAt: new Date(),
      });
      showToast({
        tone: "success",
        title: t("financialExportSuccess"),
        description: t("financialSingleExportSuccessDesc"),
      });
    } catch {
      showToast({
        tone: "error",
        title: t("financialExportFailed"),
        description: t("financialExportFailedDesc"),
      });
    } finally {
      window.setTimeout(() => setIsExporting(false), 200);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOutlets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOutletId]);

  useRealtimeEvents({
    topics: ["sales", "inventory", "waste", "purchases", "customers"],
    enabled: Boolean(outletId),
    debounceMs: 800,
    onEvent: (event) => {
      if (outletId !== allOutletsValue && event.outletId && event.outletId !== outletId) return;
      void loadFinancialSummary(outletId);
    },
  });

  const activeRows = useMemo(() => report?.sheets[activeTab] ?? [], [activeTab, report]);
  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return activeRows;
    return activeRows.filter(([label, value]) => `${label} ${value}`.toLowerCase().includes(keyword));
  }, [activeRows, search]);
  const pagedRows = pageItems(filteredRows, page, pageSize);

  function selectTab(tab: ReportTab) {
    setActiveTab(tab);
    setSearch("");
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div className="thin-x-scroll overflow-x-auto border-b bg-card">
        <div className="flex min-w-max gap-3 px-4 sm:gap-8">
          {tabOrder.map((tab) => (
            <FinancialTabButton key={tab} active={activeTab === tab} icon={tabIcon(tab)} onClick={() => selectTab(tab)}>
              {report?.labels[tab] ?? tab}
            </FinancialTabButton>
          ))}
        </div>
      </div>

      <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="border-b px-5 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold leading-snug text-foreground">{report?.labels[activeTab] ?? t("financialReports")}</h2>
              <p className="mt-1 text-xs leading-4 text-muted-foreground">{t(`${activeTab}Desc`)}</p>
            </div>
            <FinancialIconButton
              type="button"
              className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
              variant="outline"
              onClick={exportActiveReport}
              disabled={isLoading || isExporting || access.isLoading}
              aria-label={t("exportSelectedReport")}
              title={t("exportSelectedReport")}
            >
              <Download className="h-4 w-4" />
            </FinancialIconButton>
          </div>
          {message ? <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p> : null}
          {isLoading ? (
            <div className="mt-3 rounded-lg border bg-muted/25 p-4 text-sm text-muted-foreground">
              {t("financialLoading")}
            </div>
          ) : null}
        </div>
        <FinancialMetrics summary={summary} language={language} />
        <div className="p-4">
          <FinancialTableControls search={search} setSearch={setSearch} pageSize={pageSize} setPageSize={setPageSize} setPage={setPage} />
          <FinancialTable rows={pagedRows} />
          <FinancialPager page={page} pageSize={pageSize} total={filteredRows.length} setPage={setPage} />
        </div>
      </section>
    </div>
  );
}

function FinancialTabButton(props: {
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const Icon = props.icon;
  return (
    <button
      type="button"
      className={`relative flex h-12 items-center gap-2 whitespace-nowrap border-b-2 px-1 text-sm font-medium transition-colors sm:h-14 sm:px-1.5 ${
        props.active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
      onClick={props.onClick}
    >
      <Icon className="h-4 w-4" />
      {props.children}
    </button>
  );
}

function FinancialMetrics(props: { summary: FinancialSummary | null; language: AppLanguage }) {
  const summary = props.summary;
  const payments = summary?.payments.reduce((sum, item) => sum + moneyValue(item.amount), 0) ?? 0;
  const metrics = [
    { icon: BarChart3, label: "Net Sales", value: formatCurrencyByLanguage(summary?.sales.netSales ?? 0, props.language), tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    { icon: LineChart, label: "Laba Kotor", value: formatCurrencyByLanguage(summary?.sales.grossProfit ?? 0, props.language), tone: "bg-violet-50 text-violet-700 border-violet-200" },
    { icon: Wallet, label: "Kas Masuk", value: formatCurrencyByLanguage(payments, props.language), tone: "bg-sky-50 text-sky-700 border-sky-200" },
    { icon: Landmark, label: "Nilai Persediaan", value: formatCurrencyByLanguage(summary?.valuation.inventoryValue ?? 0, props.language), tone: "bg-amber-50 text-amber-700 border-amber-200" },
  ];

  return (
    <div className="grid gap-3 border-b p-4 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="rounded-lg border bg-background p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-1 truncate text-base font-semibold text-foreground">{item.value}</p>
              </div>
              <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${item.tone}`}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FinancialTableControls(props: {
  search: string;
  setSearch: (value: string) => void;
  pageSize: number;
  setPageSize: (value: number) => void;
  setPage: (value: number) => void;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>Show</span>
        <select className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" value={props.pageSize} onChange={(event) => { props.setPageSize(Number(event.target.value)); props.setPage(1); }}>
          {[5, 10, 20, 50, 100].map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <span>entries</span>
      </div>
      <div className="relative md:w-80">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input className="h-11 rounded-lg pl-11" value={props.search} placeholder="Search..." onChange={(event) => { props.setSearch(event.target.value); props.setPage(1); }} />
      </div>
    </div>
  );
}

function FinancialTable(props: { rows: Array<[string, string | number]> }) {
  return (
    <div className="thin-x-scroll overflow-x-auto rounded-xl border bg-card">
      <table className="min-w-[760px] table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-[420px]" />
          <col className="w-[220px]" />
          <col className="w-[120px]" />
        </colgroup>
        <thead className="border-b bg-background text-xs font-semibold text-foreground">
          <tr>
            <th className="px-4 py-3 text-left">Item</th>
            <th className="px-4 py-3 text-right">Nilai</th>
            <th className="px-4 py-3 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="bg-background">
          {props.rows.map(([label, value], index) => (
            <tr key={`${label}-${index}`} className={`border-b text-sm last:border-b-0 ${index === props.rows.length - 1 ? "bg-muted/35 font-semibold" : ""}`}>
              <td className="truncate px-4 py-3 align-middle text-muted-foreground">{label}</td>
              <td className="truncate px-4 py-3 text-right align-middle font-medium text-foreground">{value}</td>
              <td className="px-4 py-3 align-middle">
                <div className="flex justify-end gap-1">
                  <FinancialIconButton type="button" variant="outline" compact className="border-sky-200 text-sky-600 hover:bg-sky-50 hover:text-sky-700" title="Baris laporan" aria-label={`Baris laporan ${label}`}>
                    <ListChecks className="h-4 w-4" />
                  </FinancialIconButton>
                </div>
              </td>
            </tr>
          ))}
          {!props.rows.length ? <tr><td colSpan={3} className="px-4 py-6 text-sm text-muted-foreground">Data laporan tidak ditemukan.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

function FinancialPager(props: {
  page: number;
  pageSize: number;
  total: number;
  setPage: (value: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(props.total / props.pageSize));
  const currentPage = Math.min(props.page, pageCount);
  const start = props.total ? (currentPage - 1) * props.pageSize + 1 : 0;
  const end = Math.min(currentPage * props.pageSize, props.total);
  return (
    <div className="flex flex-col gap-3 border-t px-4 py-4 md:flex-row md:items-center md:justify-between">
      <p className="text-sm text-muted-foreground">Showing {start} to {end} of {props.total} entries</p>
      <div className="flex items-center gap-3">
        <FinancialIconButton type="button" variant="outline" disabled={currentPage <= 1} onClick={() => props.setPage(currentPage - 1)} aria-label="Sebelumnya"><ChevronLeft className="h-4 w-4" /></FinancialIconButton>
        <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-lg bg-primary/10 px-3 text-sm font-semibold text-primary">{currentPage}</span>
        <FinancialIconButton type="button" variant="outline" disabled={currentPage >= pageCount} onClick={() => props.setPage(currentPage + 1)} aria-label="Berikutnya"><ChevronRight className="h-4 w-4" /></FinancialIconButton>
      </div>
    </div>
  );
}

function pageItems<T>(items: T[], page: number, pageSize: number) {
  const start = Math.max(0, (page - 1) * pageSize);
  return items.slice(start, start + pageSize);
}

function tabIcon(tab: ReportTab) {
  const icons: Record<ReportTab, React.ComponentType<{ className?: string }>> = {
    profitLoss: BarChart3,
    balanceSheet: Landmark,
    cashFlow: Wallet,
    equityChanges: LineChart,
    notes: BookOpenText,
  };
  return icons[tab];
}

type BuiltFinancialReport = {
  filePrefix: string;
  labels: Record<ReportTab, string>;
  sheets: Record<ReportTab, Array<[string, string | number]>>;
};

function buildFinancialReport(input: {
  language: AppLanguage;
  summary: FinancialSummary;
  outletLabel: string;
  generatedAt: Date;
}): BuiltFinancialReport {
  const label = labelsByLanguage[input.language];
  const sales = input.summary.sales;
  const waste = input.summary.waste;
  const grossSales = moneyValue(sales.grossSales);
  const netSales = moneyValue(sales.netSales);
  const cogs = moneyValue(sales.cogs);
  const grossProfit = moneyValue(sales.grossProfit);
  const wasteLoss = moneyValue(waste.totalEstimatedLoss);
  const operatingProfit = grossProfit - wasteLoss;
  const paymentTotal = input.summary.payments.reduce((sum, item) => sum + moneyValue(item.amount), 0);
  const cashPayment = input.summary.payments
    .filter((item) => item.method === "cash")
    .reduce((sum, item) => sum + moneyValue(item.amount), 0);
  const cashlessPayment = paymentTotal - cashPayment;
  const inventoryValue = moneyValue(input.summary.valuation.inventoryValue);
  const totalAssets = paymentTotal + inventoryValue;
  const liabilities = 0;
  const equity = totalAssets - liabilities;

  const money = (value: string | number) => formatCurrencyByLanguage(value, input.language);
  const meta: Array<[string, string | number]> = [
    [label.outlet, input.outletLabel],
    [label.generatedAt, formatDateByLanguage(input.generatedAt, input.language)],
  ];

  return {
    filePrefix: label.filePrefix,
    labels: {
      profitLoss: label.profitLoss,
      balanceSheet: label.balanceSheet,
      cashFlow: label.cashFlow,
      equityChanges: label.equityChanges,
      notes: label.notes,
    },
    sheets: {
      profitLoss: [
        ...meta,
        [label.grossSales, money(grossSales)],
        [label.netSales, money(netSales)],
        [label.cogs, money(cogs)],
        [label.grossProfit, money(grossProfit)],
        [label.wasteLoss, money(wasteLoss)],
        [label.operatingProfit, money(operatingProfit)],
      ],
      balanceSheet: [
        ...meta,
        [label.cashAndBank, money(paymentTotal)],
        [label.inventoryAsset, money(inventoryValue)],
        [label.totalAssets, money(totalAssets)],
        [label.liabilities, money(liabilities)],
        [label.equity, money(equity)],
      ],
      cashFlow: [
        ...meta,
        [label.cashIn, money(paymentTotal)],
        [label.cashSales, money(cashPayment)],
        [label.cashlessSales, money(cashlessPayment)],
        ...input.summary.payments.map((item) => [`${label.paymentMethod}: ${item.method}`, money(item.amount)] as [string, string]),
        [label.total, money(paymentTotal)],
      ],
      equityChanges: [
        ...meta,
        [label.beginningCapital, money(0)],
        [label.additionalCapital, money(0)],
        [label.operatingProfit, money(operatingProfit)],
        [label.ownerWithdrawal, money(0)],
        [label.endingCapital, money(operatingProfit)],
      ],
      notes: [
        [label.note, label.note1],
        [label.note, label.note2],
        [label.note, label.note3],
      ],
    },
  };
}

const labelsByLanguage = {
  id: {
    filePrefix: "laporan-keuangan",
    generatedAt: "Dibuat pada",
    outlet: "Outlet",
    profitLoss: "Laba Rugi",
    balanceSheet: "Neraca",
    cashFlow: "Arus Kas",
    equityChanges: "Perubahan Ekuitas",
    notes: "Catatan",
    grossSales: "Penjualan Kotor",
    netSales: "Penjualan Bersih",
    cogs: "Harga Pokok Penjualan",
    grossProfit: "Laba Kotor",
    wasteLoss: "Estimasi Kerugian Waste",
    operatingProfit: "Laba Operasional Sederhana",
    cashAndBank: "Kas dan Setara Kas",
    inventoryAsset: "Persediaan",
    totalAssets: "Total Aset",
    liabilities: "Kewajiban",
    equity: "Ekuitas",
    cashIn: "Kas Masuk",
    cashSales: "Penjualan Tunai",
    cashlessSales: "Penjualan Non Tunai",
    paymentMethod: "Metode Pembayaran",
    total: "Total",
    beginningCapital: "Modal Awal",
    additionalCapital: "Tambahan Modal",
    ownerWithdrawal: "Prive / Penarikan Owner",
    endingCapital: "Modal Akhir",
    note: "Catatan",
    note1: "Neraca dan perubahan ekuitas masih versi sederhana dari data POS.",
    note2: "Modul hutang, piutang, modal tambahan, dan prive belum tersedia sehingga nilainya dicatat 0.",
    note3: "Nilai persediaan dihitung dari stok on hand dikali biaya SKU.",
  },
} satisfies Record<AppLanguage, Record<string, string>>;

function currentOutletLabel(outlets: Outlet[], outletId: string, allOutletsLabel: string) {
  if (outletId === allOutletsValue) return allOutletsLabel;
  const outlet = outlets.find((item) => item.id === outletId);
  return outlet ? `${outlet.name} (${outlet.code})` : "-";
}

function downloadSheet(input: {
  language: AppLanguage;
  title: string;
  filePrefix: string;
  rows: Array<[string, string | number]>;
  generatedAt: Date;
}) {
  const workbook = createExcelXml(input.title, input.rows);
  const blob = new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `${input.filePrefix}-${sheetName(input.title).toLowerCase().replace(/\s+/g, "-")}-${dateFileStamp(input.generatedAt)}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function createExcelXml(title: string, rows: Array<[string, string | number]>) {
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Title"><Font ss:Bold="1" ss:Size="14"/><Interior ss:Color="#F1FAEE" ss:Pattern="Solid"/></Style>
  <Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#A8DADC" ss:Pattern="Solid"/></Style>
 </Styles>
 <Worksheet ss:Name="${escapeXml(sheetName(title))}">
  <Table>
   <Row><Cell ss:StyleID="Title"><Data ss:Type="String">${escapeXml(title)}</Data></Cell></Row>
   <Row><Cell ss:StyleID="Header"><Data ss:Type="String">Item</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Value</Data></Cell></Row>
   ${rows
     .map(
       ([label, value]) =>
         `<Row><Cell><Data ss:Type="String">${escapeXml(String(label))}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(String(value))}</Data></Cell></Row>`,
     )
     .join("")}
  </Table>
 </Worksheet>
</Workbook>`;
}

function sheetName(value: string) {
  return value.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function dateFileStamp(value: Date) {
  const year = value.getFullYear().toString().padStart(4, "0");
  const month = (value.getMonth() + 1).toString().padStart(2, "0");
  const day = value.getDate().toString().padStart(2, "0");
  const hour = value.getHours().toString().padStart(2, "0");
  const minute = value.getMinutes().toString().padStart(2, "0");
  return `${year}${month}${day}-${hour}${minute}`;
}

function moneyValue(value?: string | number) {
  return Number(value ?? 0);
}

function formatCurrencyByLanguage(value: string | number, language: AppLanguage) {
  return new Intl.NumberFormat(language === "id" ? "id-ID" : "id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(moneyValue(value));
}

function formatDateByLanguage(value: Date, language: AppLanguage) {
  return value.toLocaleString(language === "id" ? "id-ID" : "id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
