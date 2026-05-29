import { dashboardRepository, type ChartUnit } from "@/backend/repositories/dashboard-repository";
import { handleRouteError, ok } from "@/lib/http";
import { accessibleOutletIds, requireActor, requireOutletAccess, requirePermission } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "dashboard", "view");
    const { searchParams } = new URL(request.url);
    const outletId = searchParams.get("outletId");
    const organizationId = actor.organizationId;
    const outletIds = outletId
      ? (await requireOutletAccess(actor, outletId), [outletId])
      : await accessibleOutletIds(actor);
    const chartConfig = buildChartConfig(searchParams);

    const summary = await dashboardRepository.getSummary({
      organizationId,
      actorRole: actor.role,
      outletIds,
      chart: chartConfig,
    });

    return ok(summary);
  } catch (error) {
    return handleRouteError(error);
  }
}

type ChartMode = "daily" | "weekly" | "monthly" | "yearly";
function buildChartConfig(searchParams: URLSearchParams): {
  mode: ChartMode;
  unit: ChartUnit;
  label: string;
  periods: Date[];
} {
  const requestedMode = searchParams.get("chartMode");
  const mode: ChartMode =
    requestedMode === "weekly" ||
    requestedMode === "monthly" ||
    requestedMode === "yearly"
      ? requestedMode
      : "daily";
  const now = new Date();

  if (mode === "weekly") {
    const month =
      parseMonth(searchParams.get("month")) ??
      new Date(now.getFullYear(), now.getMonth(), 1);
    const firstWeek = startOfWeek(month);
    const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const periods = [];
    for (
      let cursor = firstWeek;
      cursor <= lastDay;
      cursor = addPeriod(cursor, "week", 1)
    ) {
      periods.push(cursor);
    }
    return {
      mode,
      unit: "week",
      label: month.toLocaleDateString("id-ID", {
        timeZone: "Asia/Jakarta",
        month: "long",
        year: "numeric",
      }),
      periods,
    };
  }

  if (mode === "monthly") {
    const year = parseYear(searchParams.get("year")) ?? now.getFullYear();
    return {
      mode,
      unit: "month",
      label: year.toString(),
      periods: Array.from(
        { length: 12 },
        (_, index) => new Date(year, index, 1),
      ),
    };
  }

  if (mode === "yearly") {
    const currentYear = now.getFullYear();
    const startYear =
      parseYear(searchParams.get("startYear")) ?? currentYear - 4;
    const endYear = parseYear(searchParams.get("endYear")) ?? currentYear;
    const safeStart = Math.min(startYear, endYear);
    const safeEnd = Math.min(Math.max(startYear, endYear), safeStart + 9);
    return {
      mode,
      unit: "year",
      label: `${safeStart} - ${safeEnd}`,
      periods: Array.from(
        { length: safeEnd - safeStart + 1 },
        (_, index) => new Date(safeStart + index, 0, 1),
      ),
    };
  }

  const fallbackTo = startOfPeriod(now, "day");
  const parsedFrom = parseDate(searchParams.get("from"));
  const parsedTo = parseDate(searchParams.get("to"));
  const to = parsedTo ?? fallbackTo;
  const from = parsedFrom ?? addPeriod(to, "day", -6);
  const safeFrom = from <= to ? from : to;
  const safeTo = from <= to ? to : from;
  const periods = [];
  for (
    let cursor = safeFrom;
    cursor <= safeTo && periods.length < 62;
    cursor = addPeriod(cursor, "day", 1)
  ) {
    periods.push(cursor);
  }
  return {
    mode,
    unit: "day",
    label: `${periodLabel(safeFrom, "day")} - ${periodLabel(safeTo, "day")}`,
    periods,
  };
}

function startOfPeriod(value: Date, unit: "day" | "month" | "year") {
  if (unit === "year") return new Date(value.getFullYear(), 0, 1);
  if (unit === "month")
    return new Date(value.getFullYear(), value.getMonth(), 1);
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addPeriod(value: Date, unit: ChartUnit, amount: number) {
  const next = new Date(value);
  if (unit === "year") next.setFullYear(next.getFullYear() + amount);
  if (unit === "month") next.setMonth(next.getMonth() + amount);
  if (unit === "week") next.setDate(next.getDate() + amount * 7);
  if (unit === "day") next.setDate(next.getDate() + amount);
  return next;
}

function periodLabel(value: Date, unit: ChartUnit) {
  if (unit === "year") return value.getFullYear().toString();
  if (unit === "week") {
    const end = addPeriod(value, "day", 6);
    return `${value.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short" })} - ${end.toLocaleDateString(
      "id-ID",
      {
        timeZone: "Asia/Jakarta",
        day: "2-digit",
        month: "short",
      },
    )}`;
  }
  return value.toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: unit === "day" ? "2-digit" : undefined,
    month: "short",
    year: unit === "month" ? "numeric" : undefined,
  });
}

function parseDate(value: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function parseMonth(value: string | null) {
  if (!value) return null;
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return null;
  return new Date(year, month - 1, 1);
}

function parseYear(value: string | null) {
  if (!value) return null;
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null;
}

function startOfWeek(value: Date) {
  const start = new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
  );
  const day = start.getDay() || 7;
  start.setDate(start.getDate() - day + 1);
  return start;
}
