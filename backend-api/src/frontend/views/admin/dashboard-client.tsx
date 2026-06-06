"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  Boxes,
  Building2,
  CircleAlert,
  LineChart,
  ReceiptText,
  RefreshCcw,
  Trophy,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/frontend/controllers/language-provider";
import { allOutletsValue, useSelectedOutlet } from "@/frontend/controllers/selected-outlet-provider";
import { useRealtimeEvents } from "@/frontend/controllers/use-realtime-events";

type ApiResponse<T> = { data: T };
type DashboardSummary = {
  stats: {
    outletsTotal: number;
    outletsActive: number;
    products: number;
    skus: number;
    usersTotal: number;
    usersActive: number;
    transactionsToday: number;
    netSalesToday: string;
  };
  alerts: {
    closedOutlets: Array<{ id: string; name: string; code: string }>;
    lowStock: StockAlert[];
    emptyStock: StockAlert[];
  };
  salesChart: { mode: string; label: string; rows: SalesChartPoint[] };
  topProductsByOutlet: TopProductsByOutlet[];
};
type ChartMode = "range" | "daily" | "monthly" | "yearly";
type StockAlert = {
  outletName: string;
  outletCode: string;
  skuCode: string;
  skuName: string;
  onHandBaseQty: string;
  availableBaseQty?: string;
  minStockBaseQty: string;
  baseUnitCode: string;
};
type SalesChartPoint = { label: string; transactionCount: number; netSales: string };
type TopProductsByOutlet = {
  outlet: { id: string; name: string; code: string };
  products: Array<{ skuId: string; skuName: string; quantitySold: string; unitCode: string; netSales: string }>;
};

const chartColors = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626"];

export function DashboardClient() {
  const { language, t } = useLanguage();
  const { selectedOutletId } = useSelectedOutlet();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const today = new Date();
  const [chartMode, setChartMode] = useState<ChartMode>("range");
  const [chartDate, setChartDate] = useState(toDateInput(today));
  const [chartFrom, setChartFrom] = useState(toDateInput(addDays(today, -6)));
  const [chartTo, setChartTo] = useState(toDateInput(today));
  const [chartMonth, setChartMonth] = useState(toMonthInput(today));
  const [chartYear, setChartYear] = useState(today.getFullYear().toString());

  async function loadSummary() {
    if (!selectedOutletId) {
      setSummary(null);
      setMessage(t("outletRequired"));
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setMessage(null);
    try {
      const query = new URLSearchParams({ chartMode: chartModeToApiMode(chartMode) });
      if (chartMode === "range") {
        query.set("from", chartFrom);
        query.set("to", chartTo);
      }
      if (chartMode === "daily") {
        query.set("from", chartDate);
        query.set("to", chartDate);
      }
      if (chartMode === "monthly") query.set("month", chartMonth);
      if (chartMode === "yearly") query.set("year", chartYear);
      if (selectedOutletId !== allOutletsValue) query.set("outletId", selectedOutletId);
      const response = await fetch(`/api/dashboard/summary?${query.toString()}`);
      if (response.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      if (!response.ok) {
        setMessage(t("dashboardStatsError"));
        return;
      }
      const json = (await response.json()) as ApiResponse<DashboardSummary>;
      setSummary(json.data);
    } catch {
      setMessage(t("dashboardStatsError"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOutletId]);

  useRealtimeEvents({
    topics: ["dashboard", "inventory", "sales", "shift", "purchases", "waste"],
    enabled: Boolean(selectedOutletId),
    debounceMs: 700,
    onEvent: () => void loadSummary(),
  });

  const topProducts = useMemo(
    () => (summary?.topProductsByOutlet ?? []).flatMap((item) => item.products.map((product) => ({ ...product, outletName: item.outlet.name }))).slice(0, 8),
    [summary],
  );
  const totalAlerts = (summary?.alerts.closedOutlets.length ?? 0) + (summary?.alerts.lowStock.length ?? 0) + (summary?.alerts.emptyStock.length ?? 0);
  const activeOutletPercent = percent(summary?.stats.outletsActive ?? 0, summary?.stats.outletsTotal ?? 0);
  const activeUserPercent = percent(summary?.stats.usersActive ?? 0, summary?.stats.usersTotal ?? 0);

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="h-1.5 bg-[linear-gradient(90deg,#2563eb,#16a34a,#f59e0b,#dc2626)]" />
        <div className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold leading-tight">Dashboard Statistik</h2>
            <p className="mt-1 text-sm text-muted-foreground">Ringkasan penjualan, operasional outlet, produk, user, dan alert stok.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-9 items-center rounded-md border bg-background px-3 text-xs font-medium text-muted-foreground">
              {summary?.salesChart.label ?? "Periode aktif"}
            </span>
            <Button type="button" variant="outline" className="h-9 gap-2" onClick={() => void loadSummary()} disabled={isLoading}>
              <RefreshCcw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
        {message ? <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p> : null}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={ReceiptText} label="Penjualan Hari Ini" value={currency(summary?.stats.netSalesToday, language)} detail={`${summary?.stats.transactionsToday ?? 0} transaksi`} tone="blue" />
        <MetricCard icon={Building2} label="Outlet Aktif" value={`${summary?.stats.outletsActive ?? 0}/${summary?.stats.outletsTotal ?? 0}`} detail={`${activeOutletPercent}% aktif`} tone="green" />
        <MetricCard icon={Boxes} label="Produk / SKU" value={`${summary?.stats.products ?? 0}/${summary?.stats.skus ?? 0}`} detail="Produk aktif dan varian" tone="amber" />
        <MetricCard icon={Users} label="User Aktif" value={`${summary?.stats.usersActive ?? 0}/${summary?.stats.usersTotal ?? 0}`} detail={`${activeUserPercent}% aktif`} tone="violet" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <ChartTitle icon={LineChart} title="Grafik Penjualan" detail="Nilai penjualan bersih per periode" />
            <SalesChartControls mode={chartMode} onModeChange={setChartMode} date={chartDate} onDateChange={setChartDate} from={chartFrom} onFromChange={setChartFrom} to={chartTo} onToChange={setChartTo} month={chartMonth} onMonthChange={setChartMonth} year={chartYear} onYearChange={setChartYear} onApply={() => void loadSummary()} />
          </div>
          <SalesAreaChart rows={summary?.salesChart.rows ?? []} />
        </div>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
          <DonutPanel title="Outlet" label={`${activeOutletPercent}%`} detail="Outlet aktif" segments={[{ label: "Aktif", value: summary?.stats.outletsActive ?? 0, color: chartColors[1] }, { label: "Nonaktif", value: Math.max(0, (summary?.stats.outletsTotal ?? 0) - (summary?.stats.outletsActive ?? 0)), color: chartColors[3] }]} />
          <DonutPanel title="Alert Operasional" label={formatNumber(totalAlerts, 0, language)} detail="Alert aktif" segments={[{ label: "Stok kosong", value: summary?.alerts.emptyStock.length ?? 0, color: chartColors[3] }, { label: "Stok rendah", value: summary?.alerts.lowStock.length ?? 0, color: chartColors[2] }, { label: "Outlet tutup", value: summary?.alerts.closedOutlets.length ?? 0, color: "#64748b" }]} />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
          <ChartTitle icon={Trophy} title="Produk Terlaris" detail="Ranking produk berdasarkan qty terjual" />
          <TopProductBars products={topProducts} />
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
          <ChartTitle icon={CircleAlert} title="Ringkasan Alert" detail="Stok kosong, stok rendah, dan outlet tutup" />
          <AlertSummary summary={summary} />
        </div>
      </section>
    </div>
  );
}

function SalesChartControls(props: {
  mode: ChartMode;
  onModeChange: (value: ChartMode) => void;
  date: string;
  onDateChange: (value: string) => void;
  from: string;
  onFromChange: (value: string) => void;
  to: string;
  onToChange: (value: string) => void;
  month: string;
  onMonthChange: (value: string) => void;
  year: string;
  onYearChange: (value: string) => void;
  onApply: () => void;
}) {
  const modes: Array<{ value: ChartMode; label: string }> = [
    { value: "range", label: "Range" },
    { value: "daily", label: "Harian" },
    { value: "monthly", label: "Bulanan" },
    { value: "yearly", label: "Tahunan" },
  ];
  return (
    <div className="flex w-full justify-end lg:w-auto">
      <div className="flex max-w-full flex-col items-end gap-2 rounded-lg border bg-muted/30 p-2">
        <div className="inline-flex h-9 overflow-hidden rounded-md border bg-background p-0.5">
        {modes.map((mode) => (
          <button
            key={mode.value}
            type="button"
            className={`rounded px-3 text-xs font-semibold transition-colors ${props.mode === mode.value ? "bg-blue-600 text-white shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            onClick={() => props.onModeChange(mode.value)}
          >
            {mode.label}
          </button>
        ))}
        </div>
        <div className="thin-x-scroll flex max-w-full items-center justify-end gap-2 overflow-x-auto">
          {props.mode === "range" ? <><MiniInput type="date" value={props.from} onChange={props.onFromChange} /><MiniInput type="date" value={props.to} onChange={props.onToChange} /></> : null}
          {props.mode === "daily" ? <MiniInput type="date" value={props.date} onChange={props.onDateChange} /> : null}
          {props.mode === "monthly" ? <MiniInput type="month" value={props.month} onChange={props.onMonthChange} /> : null}
          {props.mode === "yearly" ? <MiniInput type="number" value={props.year} onChange={props.onYearChange} /> : null}
          <Button type="button" className="h-9 shrink-0 px-4" onClick={props.onApply}>Apply</Button>
        </div>
      </div>
    </div>
  );
}

function MiniInput(props: { type: string; value: string; onChange: (value: string) => void }) {
  return <input className="h-9 w-[9.25rem] rounded-md border bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" type={props.type} value={props.value} onChange={(event) => props.onChange(event.target.value)} />;
}

function SalesAreaChart(props: { rows: SalesChartPoint[] }) {
  const { language } = useLanguage();
  const rows = props.rows;
  const values = rows.map((row) => Number(row.netSales));
  const maxValue = Math.max(...values, 1);
  const width = 720;
  const height = 260;
  const padX = 34;
  const padY = 24;
  const points = rows.map((row, index) => {
    const x = rows.length <= 1 ? width / 2 : padX + (index / (rows.length - 1)) * (width - padX * 2);
    const y = height - padY - (Number(row.netSales) / maxValue) * (height - padY * 2);
    return { x, y, row };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = points.length ? `${padX},${height - padY} ${line} ${width - padX},${height - padY}` : "";

  return (
    <div className="mt-4 thin-x-scroll overflow-x-auto">
      {rows.length ? (
        <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[680px] overflow-visible rounded-lg bg-[linear-gradient(180deg,#eff6ff_0%,#ffffff_55%,#f8fafc_100%)]">
          <defs>
            <linearGradient id="salesArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="salesLine" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#2563eb" />
              <stop offset="45%" stopColor="#16a34a" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3].map((lineIndex) => <line key={lineIndex} x1={padX} x2={width - padX} y1={padY + lineIndex * 54} y2={padY + lineIndex * 54} stroke="#e5e7eb" strokeDasharray="4 4" />)}
          <polygon points={area} fill="url(#salesArea)" />
          <polyline points={line} fill="none" stroke="url(#salesLine)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((point, index) => (
            <g key={point.row.label} className="cursor-pointer">
              <circle cx={point.x} cy={point.y} r="10" fill={chartColors[index % chartColors.length]} opacity="0.12" />
              <circle cx={point.x} cy={point.y} r="4.5" fill={chartColors[index % chartColors.length]} stroke="#ffffff" strokeWidth="2">
                <title>{`${point.row.label}: ${currency(point.row.netSales, language)} (${point.row.transactionCount} transaksi)`}</title>
              </circle>
            </g>
          ))}
          {points.map((point, index) => index % Math.ceil(points.length / 6 || 1) === 0 ? <text key={point.row.label} x={point.x} y={height - 6} textAnchor="middle" className="fill-slate-500 text-[11px]">{point.row.label}</text> : null)}
        </svg>
      ) : (
        <div className="rounded-lg border bg-muted/20 p-6 text-sm text-muted-foreground">Belum ada data penjualan pada periode ini.</div>
      )}
    </div>
  );
}

function DonutPanel(props: { title: string; label: string; detail: string; segments: Array<{ label: string; value: number; color: string }> }) {
  const total = props.segments.reduce((sum, item) => sum + item.value, 0);
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const segments = props.segments.map((segment, index) => {
    const previous = props.segments.slice(0, index).reduce((sum, item) => sum + item.value, 0);
    const dash = total ? (segment.value / total) * circumference : 0;
    const offset = total ? -(previous / total) * circumference : 0;
    return { ...segment, dash, offset };
  });
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{props.title}</p>
          <p className="text-xs text-muted-foreground">{props.detail}</p>
        </div>
        <svg viewBox="0 0 100 100" className="h-28 w-28 shrink-0 -rotate-90 rounded-full bg-muted/25 p-1">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="12" />
          {segments.map((segment) => <circle key={segment.label} cx="50" cy="50" r={radius} fill="none" stroke={segment.color} strokeWidth="12" strokeDasharray={`${segment.dash} ${circumference - segment.dash}`} strokeDashoffset={segment.offset} strokeLinecap="round"><title>{`${segment.label}: ${segment.value}`}</title></circle>)}
          <text x="50" y="51" textAnchor="middle" dominantBaseline="middle" className="rotate-90 fill-slate-900 text-[13px] font-semibold">{props.label}</text>
        </svg>
      </div>
      <div className="mt-3 grid gap-2">
        {props.segments.map((segment) => <div key={segment.label} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs transition-colors hover:bg-muted/50"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />{segment.label}</span><span className="font-semibold">{segment.value}</span></div>)}
      </div>
    </div>
  );
}

function TopProductBars(props: { products: Array<TopProductsByOutlet["products"][number] & { outletName: string }> }) {
  const { language } = useLanguage();
  const maxQty = Math.max(...props.products.map((item) => Number(item.quantitySold)), 1);
  const barColors = ["bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-violet-500", "bg-cyan-500", "bg-lime-500", "bg-orange-500"];
  if (!props.products.length) return <p className="mt-4 rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">Belum ada produk terjual.</p>;
  return (
    <div className="mt-4 space-y-3">
      {props.products.map((product, index) => {
        const value = Number(product.quantitySold);
        return (
          <div key={`${product.skuId}-${index}`} className="grid gap-2 rounded-lg border border-transparent p-2 transition-colors hover:border-slate-200 hover:bg-muted/30">
            <div className="flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0"><p className="truncate font-medium">{index + 1}. {product.skuName}</p><p className="truncate text-xs text-muted-foreground">{product.outletName} - {formatNumber(product.quantitySold, 3, language)} {product.unitCode}</p></div>
              <span className="shrink-0 font-semibold">{currency(product.netSales, language)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full transition-all ${barColors[index % barColors.length]}`} style={{ width: `${Math.max(4, (value / maxQty) * 100)}%` }} /></div>
          </div>
        );
      })}
    </div>
  );
}

function AlertSummary(props: { summary: DashboardSummary | null }) {
  const lowStock = props.summary?.alerts.lowStock ?? [];
  const emptyStock = props.summary?.alerts.emptyStock ?? [];
  const closed = props.summary?.alerts.closedOutlets ?? [];
  const rows = [
    ...emptyStock.slice(0, 4).map((item) => ({ tone: "danger" as const, title: item.skuName, detail: `${item.outletName} - stok kosong` })),
    ...lowStock.slice(0, 4).map((item) => ({ tone: "warning" as const, title: item.skuName, detail: `${item.outletName} - stok ${formatNumber(item.availableBaseQty ?? item.onHandBaseQty)} ${item.baseUnitCode}` })),
    ...closed.slice(0, 3).map((item) => ({ tone: "slate" as const, title: item.name, detail: `${item.code} - outlet nonaktif` })),
  ].slice(0, 8);
  if (!rows.length) return <p className="mt-4 rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">Tidak ada alert operasional.</p>;
  return (
    <div className="mt-4 space-y-2">
      {rows.map((row, index) => <div key={`${row.title}-${index}`} className="flex items-start gap-3 rounded-lg border bg-background p-3 transition-colors hover:bg-muted/35"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${row.tone === "danger" ? "bg-red-500" : row.tone === "warning" ? "bg-amber-500" : "bg-slate-400"}`} /><div className="min-w-0"><p className="truncate text-sm font-medium">{row.title}</p><p className="truncate text-xs text-muted-foreground">{row.detail}</p></div></div>)}
    </div>
  );
}

function MetricCard(props: { icon: ComponentType<{ className?: string }>; label: string; value: string; detail: string; tone: "blue" | "green" | "amber" | "violet" }) {
  const theme = {
    blue: { icon: "border-blue-100 bg-blue-50 text-blue-700", bar: "bg-blue-500", shell: "hover:border-blue-200 hover:bg-blue-50/35" },
    green: { icon: "border-emerald-100 bg-emerald-50 text-emerald-700", bar: "bg-emerald-500", shell: "hover:border-emerald-200 hover:bg-emerald-50/35" },
    amber: { icon: "border-amber-100 bg-amber-50 text-amber-700", bar: "bg-amber-500", shell: "hover:border-amber-200 hover:bg-amber-50/35" },
    violet: { icon: "border-violet-100 bg-violet-50 text-violet-700", bar: "bg-violet-500", shell: "hover:border-violet-200 hover:bg-violet-50/35" },
  }[props.tone];
  return (
    <div className={`group rounded-lg border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${theme.shell}`}>
      <div className="flex items-center justify-between gap-3"><span className={`rounded-lg border p-2 transition-transform group-hover:scale-105 ${theme.icon}`}><props.icon className="h-5 w-5" /></span><span className="rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground">Live</span></div>
      <p className="mt-4 text-sm text-muted-foreground">{props.label}</p>
      <p className="mt-1 break-words text-2xl font-semibold tracking-normal">{props.value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{props.detail}</p>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted"><div className={`h-full w-2/3 rounded-full transition-all group-hover:w-full ${theme.bar}`} /></div>
    </div>
  );
}

function ChartTitle(props: { icon: ComponentType<{ className?: string }>; title: string; detail: string }) {
  return <div className="flex items-center gap-3"><span className="rounded-lg bg-primary/10 p-2 text-primary"><props.icon className="h-5 w-5" /></span><div><p className="font-semibold">{props.title}</p><p className="text-sm text-muted-foreground">{props.detail}</p></div></div>;
}

function percent(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

function chartModeToApiMode(mode: ChartMode) {
  if (mode === "monthly") return "weekly";
  if (mode === "yearly") return "monthly";
  return "daily";
}

function currency(value?: string | number, language: "id" = "id") {
  return `Rp ${formatNumber(value, 0, language)}`;
}

function formatNumber(value?: string | number, maximumFractionDigits = 3, language: "id" = "id") {
  return Number(value ?? 0).toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits });
}

function toDateInput(value: Date) {
  const year = value.getFullYear().toString().padStart(4, "0");
  const month = (value.getMonth() + 1).toString().padStart(2, "0");
  const day = value.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toMonthInput(value: Date) {
  const year = value.getFullYear().toString().padStart(4, "0");
  const month = (value.getMonth() + 1).toString().padStart(2, "0");
  return `${year}-${month}`;
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}
