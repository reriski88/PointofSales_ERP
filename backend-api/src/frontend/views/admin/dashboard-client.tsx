"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  Building2,
  CircleAlert,
  ReceiptText,
  Trophy,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/frontend/controllers/language-provider";
import { allOutletsValue, useSelectedOutlet } from "@/frontend/controllers/selected-outlet-provider";
import { CollapsibleSection } from "./_components/collapsible-section";

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
  salesChart: {
    mode: ChartMode;
    label: string;
    rows: SalesChartPoint[];
  };
  topProductsByOutlet: TopProductsByOutlet[];
};
type ChartMode = "daily" | "weekly" | "monthly" | "yearly";
type StockAlert = {
  outletName: string;
  outletCode: string;
  skuCode: string;
  skuName: string;
  onHandBaseQty: string;
  minStockBaseQty: string;
  baseUnitCode: string;
};
type SalesChartPoint = {
  label: string;
  transactionCount: number;
  netSales: string;
};
type TopProductsByOutlet = {
  outlet: { id: string; name: string; code: string };
  products: Array<{
    skuId: string;
    skuName: string;
    quantitySold: string;
    unitCode: string;
    netSales: string;
  }>;
};

export function DashboardClient() {
  const { language, t } = useLanguage();
  const { selectedOutletId } = useSelectedOutlet();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const today = new Date();
  const todayInput = toDateInput(today);
  const [chartMode, setChartMode] = useState<ChartMode>("daily");
  const [chartFrom, setChartFrom] = useState(toDateInput(addDays(today, -6)));
  const [chartTo, setChartTo] = useState(todayInput);
  const [chartMonth, setChartMonth] = useState(toMonthInput(today));
  const [chartYear, setChartYear] = useState(today.getFullYear().toString());
  const [chartStartYear, setChartStartYear] = useState(
    (today.getFullYear() - 4).toString(),
  );
  const [chartEndYear, setChartEndYear] = useState(
    today.getFullYear().toString(),
  );

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
      const query = new URLSearchParams({ chartMode });
      if (chartMode === "daily") {
        query.set("from", chartFrom);
        query.set("to", chartTo);
      }
      if (chartMode === "weekly") query.set("month", chartMonth);
      if (chartMode === "monthly") query.set("year", chartYear);
      if (chartMode === "yearly") {
        query.set("startYear", chartStartYear);
        query.set("endYear", chartEndYear);
      }
      if (selectedOutletId !== allOutletsValue) {
        query.set("outletId", selectedOutletId);
      }

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

  return (
    <>
      <CollapsibleSection
        title={t("operationalStats")}
        description={t("operationalStatsDesc")}
        collapsible={false}
        isLoading={isLoading}
        loadingText={t("loadingStats")}
      >
        {message ? (
          <p className="mb-4 text-sm text-destructive">{message}</p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={Building2}
            label={t("activeOutlets")}
            value={`${summary?.stats.outletsActive ?? 0}/${summary?.stats.outletsTotal ?? 0}`}
          />
          <StatTile
            icon={Boxes}
            label={t("productsSku")}
            value={`${summary?.stats.products ?? 0}/${summary?.stats.skus ?? 0}`}
          />
          <StatTile
            icon={Users}
            label={t("activeUsers")}
            value={`${summary?.stats.usersActive ?? 0}/${summary?.stats.usersTotal ?? 0}`}
          />
          <StatTile
            icon={ReceiptText}
            label={t("netSalesToday")}
            value={currency(summary?.stats.netSalesToday, language)}
            detail={`${summary?.stats.transactionsToday ?? 0} ${t("transactions")}`}
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={t("salesChart")}
        description={t("salesChartDesc")}
        isLoading={isLoading}
        loadingText={t("loadingSalesChart")}
      >
        <SalesChartControls
          mode={chartMode}
          onModeChange={setChartMode}
          from={chartFrom}
          onFromChange={setChartFrom}
          to={chartTo}
          onToChange={setChartTo}
          month={chartMonth}
          onMonthChange={setChartMonth}
          year={chartYear}
          onYearChange={setChartYear}
          startYear={chartStartYear}
          onStartYearChange={setChartStartYear}
          endYear={chartEndYear}
          onEndYearChange={setChartEndYear}
          onApply={() => void loadSummary()}
        />
        <div className="mt-4">
          <SalesChartPanel
            title={summary?.salesChart.label ?? ""}
            rows={summary?.salesChart.rows ?? []}
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={t("topProductsByOutlet")}
        description={t("topProductsDesc")}
        isLoading={isLoading}
        loadingText={t("loadingTopProducts")}
      >
        <div className="grid gap-3 xl:grid-cols-2">
          {(summary?.topProductsByOutlet ?? []).map((item) => (
            <TopProductsPanel key={item.outlet.id} item={item} />
          ))}
          {summary && !summary.topProductsByOutlet.length ? (
            <p className="text-sm text-muted-foreground">
              {t("noActiveOutlets")}
            </p>
          ) : null}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={t("operationalAlerts")}
        description={t("operationalAlertsDesc")}
        isLoading={isLoading}
        loadingText={t("loadingAlerts")}
      >
        <div className="grid gap-3 xl:grid-cols-3">
          <AlertPanel
            icon={CircleAlert}
            title={t("closedOutlets")}
            tone="danger"
            rows={(summary?.alerts.closedOutlets ?? []).map((item) => ({
              key: item.id,
              title: item.name,
              detail: item.code,
            }))}
            emptyText={t("noClosedOutlets")}
          />
          <AlertPanel
            icon={AlertTriangle}
            title={t("lowStock")}
            tone="warning"
            rows={(summary?.alerts.lowStock ?? []).map((item) =>
              stockAlertRow(item, t),
            )}
            emptyText={t("noLowStock")}
          />
          <AlertPanel
            icon={Boxes}
            title={t("emptyStock")}
            tone="danger"
            rows={(summary?.alerts.emptyStock ?? []).map((item) =>
              stockAlertRow(item, t),
            )}
            emptyText={t("noEmptyStock")}
          />
        </div>
      </CollapsibleSection>
    </>
  );
}

function SalesChartControls(props: {
  mode: ChartMode;
  onModeChange: (value: ChartMode) => void;
  from: string;
  onFromChange: (value: string) => void;
  to: string;
  onToChange: (value: string) => void;
  month: string;
  onMonthChange: (value: string) => void;
  year: string;
  onYearChange: (value: string) => void;
  startYear: string;
  onStartYearChange: (value: string) => void;
  endYear: string;
  onEndYearChange: (value: string) => void;
  onApply: () => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-[160px_repeat(2,minmax(160px,1fr))_auto] lg:items-end">
      <div className="space-y-2">
        <label className="text-sm font-medium">{t("period")}</label>
        <select
          className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={props.mode}
          onChange={(event) =>
            props.onModeChange(event.target.value as ChartMode)
          }
        >
          <option value="daily">{t("daily")}</option>
          <option value="weekly">{t("weekly")}</option>
          <option value="monthly">{t("monthly")}</option>
          <option value="yearly">{t("yearly")}</option>
        </select>
      </div>
      {props.mode === "daily" ? (
        <>
          <InputLike
            label={t("fromDate")}
            type="date"
            value={props.from}
            onChange={props.onFromChange}
          />
          <InputLike
            label={t("toDate")}
            type="date"
            value={props.to}
            onChange={props.onToChange}
          />
        </>
      ) : null}
      {props.mode === "weekly" ? (
        <InputLike
          label={t("month")}
          type="month"
          value={props.month}
          onChange={props.onMonthChange}
        />
      ) : null}
      {props.mode === "monthly" ? (
        <InputLike
          label={t("year")}
          type="number"
          value={props.year}
          onChange={props.onYearChange}
        />
      ) : null}
      {props.mode === "yearly" ? (
        <>
          <InputLike
            label={t("startYear")}
            type="number"
            value={props.startYear}
            onChange={props.onStartYearChange}
          />
          <InputLike
            label={t("endYear")}
            type="number"
            value={props.endYear}
            onChange={props.onEndYearChange}
          />
        </>
      ) : null}
      <Button type="button" onClick={props.onApply} className="w-full lg:w-auto lg:self-end">
        {t("apply")}
      </Button>
    </div>
  );
}

function InputLike(props: {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-2 text-sm font-medium">
      {props.label}
      <input
        className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
        type={props.type}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </label>
  );
}

function SalesChartPanel(props: { title: string; rows: SalesChartPoint[] }) {
  const { language, t } = useLanguage();
  const maxValue = Math.max(
    ...props.rows.map((row) => Number(row.netSales)),
    1,
  );
  const height = 260;
  const chartRows = props.rows.filter(
    (row) => Number(row.netSales) > 0 || row.transactionCount > 0,
  );

  return (
    <div className="rounded-lg border p-3 sm:p-4">
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-primary/10 p-2 text-primary">
          <BarChart3 className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold">{props.title || t("salesChart")}</p>
          <p className="text-sm text-muted-foreground">
            {props.rows.length} {t("period")}
          </p>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto pb-1">
        {chartRows.length ? (
          <div
            className="flex min-w-[420px] items-end gap-2 border-b border-l px-2 pt-4 sm:min-w-[560px] sm:gap-3 sm:px-3"
            style={{ height }}
          >
            {props.rows.map((row) => {
              const value = Number(row.netSales);
              const barHeight = Math.max(2, (value / maxValue) * (height - 82));
              return (
                <div
                  key={row.label}
                  className="flex min-w-12 flex-1 flex-col items-center justify-end gap-2 sm:min-w-16"
                >
                  <div className="max-w-16 truncate text-center text-[11px] font-medium sm:max-w-none sm:text-xs">
                    {currency(row.netSales, language)}
                  </div>
                  <div
                    className="w-full max-w-10 rounded-t-md bg-primary sm:max-w-14"
                    style={{ height: `${barHeight}px` }}
                    title={`${row.label}: ${currency(row.netSales, language)} (${row.transactionCount} ${t("transactions")})`}
                  />
                  <div className="h-10 text-center text-[11px] text-muted-foreground sm:text-xs">
                    <span className="line-clamp-2">{row.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground sm:p-6">
            {t("noSalesChartData")}
          </div>
        )}
      </div>
    </div>
  );
}

function TopProductsPanel(props: { item: TopProductsByOutlet }) {
  const { language, t } = useLanguage();
  const maxQty = Math.max(
    ...props.item.products.map((product) => Number(product.quantitySold)),
    1,
  );
  return (
    <div className="rounded-lg border p-3 sm:p-4">
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-amber-50 p-2 text-amber-700">
          <Trophy className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{props.item.outlet.name}</p>
          <p className="text-sm text-muted-foreground">
            {props.item.outlet.code}
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {props.item.products.length ? (
          props.item.products.map((product, index) => {
            const percent = Math.max(
              6,
              (Number(product.quantitySold) / maxQty) * 100,
            );
            return (
              <div
                key={product.skuId}
                className="rounded-md border bg-muted/20 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {index + 1}. {product.skuName}
                    </p>
                    <p className="text-sm leading-5 text-muted-foreground">
                      {formatNumber(product.quantitySold, 3, language)}{" "}
                      {product.unitCode || "unit"} {t("sold")} -{" "}
                      {currency(product.netSales, language)}
                    </p>
                  </div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-amber-500"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-muted-foreground">{t("noProductsSold")}</p>
        )}
      </div>
    </div>
  );
}

function StatTile(props: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
        <props.icon className="h-5 w-5 text-primary" />
        {props.detail ? (
          <p className="truncate text-xs text-muted-foreground sm:hidden">{props.detail}</p>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">{props.label}</p>
      <p className="mt-1 break-words text-xl font-semibold sm:text-2xl">{props.value}</p>
      {props.detail ? (
        <p className="mt-2 hidden text-sm text-muted-foreground sm:block">{props.detail}</p>
      ) : null}
    </div>
  );
}

function AlertPanel(props: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tone: "danger" | "warning";
  rows: Array<{ key: string; title: string; detail: string }>;
  emptyText: string;
}) {
  const { t } = useLanguage();
  const toneClass =
    props.tone === "danger"
      ? "text-destructive bg-red-50"
      : "text-amber-700 bg-amber-50";
  return (
    <div className="rounded-lg border p-3 sm:p-4">
      <div className="flex items-center gap-2">
        <span className={`rounded-md p-2 ${toneClass}`}>
          <props.icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold">{props.title}</p>
          <p className="text-sm text-muted-foreground">
            {props.rows.length} {t("alert")}
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {props.rows.length ? (
          props.rows.slice(0, 8).map((row) => (
            <div key={row.key} className="rounded-md border bg-muted/25 p-3">
              <p className="font-medium">{row.title}</p>
              <p className="text-sm text-muted-foreground">{row.detail}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">{props.emptyText}</p>
        )}
      </div>
    </div>
  );
}

function stockAlertRow(item: StockAlert, t: (key: string) => string) {
  return {
    key: `${item.outletCode}-${item.skuCode}`,
    title: `${item.skuName} (${item.skuCode})`,
    detail: `${item.outletName} - ${t("stock")} ${formatNumber(item.onHandBaseQty)} ${item.baseUnitCode || "unit"} / ${t("min")} ${formatNumber(item.minStockBaseQty)} ${item.baseUnitCode || "unit"}`,
  };
}

function currency(value?: string | number, language: "id" = "id") {
  return `Rp ${formatNumber(value, 0, language)}`;
}

function formatNumber(
  value?: string | number,
  maximumFractionDigits = 3,
  language: "id" = "id",
) {
  return Number(value ?? 0).toLocaleString(
    "id-ID",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits,
    },
  );
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
