"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { useLanguage, type AppLanguage } from "@/frontend/controllers/language-provider";
import { allOutletsValue, useSelectedOutlet } from "@/frontend/controllers/selected-outlet-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRolePermissions } from "../_components/use-role-permissions";
import { useToast } from "../_components/toast-provider";
import { getOutlets, getProfile } from "@/frontend/controllers/admin-data-cache";

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

export function FinancialReportsClient() {
  const { language, t } = useLanguage();
  const { selectedOutletId } = useSelectedOutlet();
  const access = useRolePermissions("financialReports");
  const { showToast } = useToast();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [outletId, setOutletId] = useState("");
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [activeTab, setActiveTab] = useState<ReportTab>("profitLoss");
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

  const activeRows = report?.sheets[activeTab] ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <CardTitle>{t("financialReports")}</CardTitle>
            <CardDescription>{t("financialReportsDesc")}</CardDescription>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <Button type="button" variant="outline" onClick={() => void loadFinancialSummary()}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              type="button"
              className="w-10 px-0"
              onClick={exportActiveReport}
              disabled={isLoading || isExporting || access.isLoading}
              aria-label={t("exportSelectedReport")}
              title={t("exportSelectedReport")}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {message ? <p className="text-sm text-destructive">{message}</p> : null}
          {isLoading ? (
            <div className="rounded-lg border bg-muted/25 p-4 text-sm text-muted-foreground">
              {t("financialLoading")}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex gap-2 overflow-x-auto rounded-lg border bg-card p-2">
        {tabOrder.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`h-10 shrink-0 rounded-md px-4 text-sm font-medium transition-colors ${
              activeTab === tab ? "bg-[#E63946] text-white shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {report?.labels[tab] ?? tab}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{report?.labels[activeTab] ?? t("financialReports")}</CardTitle>
          <CardDescription>{t(`${activeTab}Desc`)}</CardDescription>
        </CardHeader>
        <CardContent>
          <FinancialTable rows={activeRows} />
        </CardContent>
      </Card>
    </div>
  );
}

function FinancialTable(props: { rows: Array<[string, string | number]> }) {
  if (!props.rows.length) {
    return <p className="text-sm text-muted-foreground">-</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      {props.rows.map(([label, value], index) => (
        <div
          key={`${label}-${index}`}
          className={`grid gap-3 border-b px-4 py-3 text-sm last:border-b-0 sm:grid-cols-[1fr_220px] ${
            index === props.rows.length - 1 ? "bg-muted/35 font-semibold" : "bg-background"
          }`}
        >
          <span className="text-muted-foreground">{label}</span>
          <span className="text-left font-medium sm:text-right">{value}</span>
        </div>
      ))}
    </div>
  );
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
