import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  inventoryBalance,
  outlet,
  product,
  sale,
  saleItem,
  shift,
  sku,
  unit,
  user,
  userOutlet,
} from "@/db/schema";
import type { Actor } from "@/lib/rbac";

export type ChartUnit = "day" | "week" | "month" | "year";

export const dashboardRepository = {
  async getSummary(input: {
    organizationId: string;
    actorRole: Actor["role"];
    outletIds: string[];
    chart: {
      unit: ChartUnit;
      periods: Date[];
      mode: string;
      label: string;
    };
  }) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const outletScope = input.outletIds.length > 0 ? inArray(outlet.id, input.outletIds) : sql`false`;
    const saleOutletScope = input.outletIds.length > 0 ? inArray(sale.outletId, input.outletIds) : sql`false`;
    const inventoryOutletScope =
      input.outletIds.length > 0 ? inArray(inventoryBalance.outletId, input.outletIds) : sql`false`;

    const [outletStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${outlet.isActive})::int`,
      })
      .from(outlet)
      .where(and(eq(outlet.organizationId, input.organizationId), outletScope));

    const [productStats] = await db
      .select({
        products: sql<number>`count(distinct ${product.id})::int`,
        skus: sql<number>`count(distinct ${sku.id})::int`,
      })
      .from(inventoryBalance)
      .innerJoin(sku, eq(sku.id, inventoryBalance.skuId))
      .innerJoin(product, eq(product.id, sku.productId))
      .where(
        and(
          inventoryOutletScope,
          eq(product.organizationId, input.organizationId),
          eq(product.isActive, true),
          eq(sku.isActive, true),
        ),
      );

    const [userStats] =
      input.actorRole === "owner"
        ? await db
            .select({
              total: sql<number>`count(*)::int`,
              active: sql<number>`count(*) filter (where ${user.isActive})::int`,
            })
            .from(user)
            .where(eq(user.organizationId, input.organizationId))
        : await db
            .select({
              total: sql<number>`count(distinct ${user.id})::int`,
              active: sql<number>`count(distinct ${user.id}) filter (where ${user.isActive})::int`,
            })
            .from(user)
            .innerJoin(userOutlet, eq(userOutlet.userId, user.id))
            .where(
              and(
                eq(user.organizationId, input.organizationId),
                input.outletIds.length > 0 ? inArray(userOutlet.outletId, input.outletIds) : sql`false`,
              ),
            );

    const [salesStats] = await db
      .select({
        transactionsToday: sql<number>`count(*)::int`,
        netSalesToday: sql<string>`coalesce(sum(${sale.grandTotal}), 0)::text`,
      })
      .from(sale)
      .where(
        and(
          eq(sale.organizationId, input.organizationId),
          saleOutletScope,
          gte(sale.createdAt, today),
          eq(sale.status, "completed"),
        ),
      );

    const closedOutlets = await db
      .select({
        id: outlet.id,
        name: outlet.name,
        code: outlet.code,
      })
      .from(outlet)
      .leftJoin(shift, and(eq(shift.outletId, outlet.id), eq(shift.status, "open")))
      .where(and(eq(outlet.organizationId, input.organizationId), outletScope, eq(outlet.isActive, true), sql`${shift.id} is null`))
      .limit(20);

    const lowStockRows = await db
      .select({
        outletName: outlet.name,
        outletCode: outlet.code,
        skuCode: sku.sku,
        skuName: sku.name,
        onHandBaseQty: inventoryBalance.onHandBaseQty,
        availableBaseQty: sql<string>`(${inventoryBalance.onHandBaseQty} - ${inventoryBalance.reservedBaseQty} - ${inventoryBalance.holdBaseQty})::text`,
        minStockBaseQty: sku.minStockBaseQty,
        baseUnitCode: unit.code,
      })
      .from(inventoryBalance)
      .innerJoin(outlet, eq(outlet.id, inventoryBalance.outletId))
      .innerJoin(sku, eq(sku.id, inventoryBalance.skuId))
      .innerJoin(unit, eq(unit.id, sku.baseUnitId))
      .where(
        and(
          eq(outlet.organizationId, input.organizationId),
          inventoryOutletScope,
          eq(outlet.isActive, true),
          sql`${inventoryBalance.onHandBaseQty} - ${inventoryBalance.reservedBaseQty} - ${inventoryBalance.holdBaseQty} <= ${sku.minStockBaseQty}`,
        ),
      )
      .limit(50);

    const emptyStock = lowStockRows.filter((item) => Number(item.availableBaseQty) <= 0);
    const lowStock = lowStockRows.filter((item) => Number(item.availableBaseQty) > 0);
    const activeOutlets = await db
      .select({
        id: outlet.id,
        name: outlet.name,
        code: outlet.code,
      })
      .from(outlet)
      .where(and(eq(outlet.organizationId, input.organizationId), outletScope, eq(outlet.isActive, true)))
      .orderBy(outlet.name);
    const salesChart = await salesChartForPeriods(
      input.chart.unit,
      input.chart.periods,
      input.organizationId,
      input.outletIds,
    );
    const topProductRows = await db
      .select({
        outletId: outlet.id,
        outletName: outlet.name,
        outletCode: outlet.code,
        skuId: saleItem.skuId,
        skuName: sql<string>`coalesce(${sku.name}, ${saleItem.nameSnapshot})`,
        quantitySold: sql<string>`sum(${saleItem.quantityBase})::text`,
        unitCode: unit.code,
        netSales: sql<string>`sum(${saleItem.lineTotal})::text`,
      })
      .from(saleItem)
      .innerJoin(sale, eq(sale.id, saleItem.saleId))
      .innerJoin(outlet, eq(outlet.id, sale.outletId))
      .leftJoin(sku, eq(sku.id, saleItem.skuId))
      .leftJoin(unit, eq(unit.id, sku.baseUnitId))
      .where(and(eq(sale.organizationId, input.organizationId), saleOutletScope, eq(sale.status, "completed"), eq(outlet.isActive, true)))
      .groupBy(outlet.id, outlet.name, outlet.code, saleItem.skuId, sku.name, unit.code, saleItem.nameSnapshot)
      .orderBy(outlet.name, sql`sum(${saleItem.quantityInput}) desc`, sql`sum(${saleItem.lineTotal}) desc`);
    const topProductsByOutlet = activeOutlets.map((item) => ({
      outlet: item,
      products: topProductRows
        .filter((row) => row.outletId === item.id)
        .slice(0, 5)
        .map((row) => ({
          skuId: row.skuId,
          skuName: row.skuName,
          quantitySold: row.quantitySold,
          unitCode: row.unitCode ?? "unit",
          netSales: row.netSales,
        })),
    }));

    return {
      stats: {
        outletsTotal: outletStats?.total ?? 0,
        outletsActive: outletStats?.active ?? 0,
        products: productStats?.products ?? 0,
        skus: productStats?.skus ?? 0,
        usersTotal: userStats?.total ?? 0,
        usersActive: userStats?.active ?? 0,
        transactionsToday: salesStats?.transactionsToday ?? 0,
        netSalesToday: salesStats?.netSalesToday ?? "0",
      },
      alerts: {
        closedOutlets,
        lowStock,
        emptyStock,
      },
      salesChart: {
        mode: input.chart.mode,
        label: input.chart.label,
        rows: salesChart,
      },
      topProductsByOutlet,
    };
  },
};

async function salesChartForPeriods(unit: ChartUnit, periods: Date[], organizationId: string, outletIds: string[]) {
  if (!outletIds.length) {
    return periods.map((period) => ({
      label: periodLabel(period, unit),
      transactionCount: 0,
      netSales: "0",
    }));
  }
  const first = periods[0];
  const last = addPeriod(periods[periods.length - 1], unit, 1);
  const rows = await db.execute<{
    periodKey: string;
    transactionCount: number;
    netSales: string;
  }>(salesChartQuery(unit, organizationId, outletIds, first, last));
  const byPeriod = new Map(rows.rows.map((row) => [row.periodKey, row]));

  return periods.map((period) => {
    const key = periodKey(period);
    const row = byPeriod.get(key);
    return {
      label: periodLabel(period, unit),
      transactionCount: row?.transactionCount ?? 0,
      netSales: row?.netSales ?? "0",
    };
  });
}

function salesChartQuery(unit: ChartUnit, organizationId: string, outletIds: string[], from: Date, to: Date) {
  const periodExpression =
    unit === "year"
      ? sql`date_trunc('year', ${sale.createdAt})`
      : unit === "month"
        ? sql`date_trunc('month', ${sale.createdAt})`
        : unit === "week"
          ? sql`date_trunc('week', ${sale.createdAt})`
          : sql`date_trunc('day', ${sale.createdAt})`;

  return sql`
    select
      to_char(${periodExpression}, 'YYYY-MM-DD') as "periodKey",
      count(*)::int as "transactionCount",
      coalesce(sum(${sale.grandTotal}), 0)::text as "netSales"
    from ${sale}
      where ${sale.organizationId} = ${organizationId}
      and ${sale.outletId} in (${sql.join(outletIds.map((id) => sql`${id}`), sql`, `)})
      and ${sale.status} = 'completed'
      and ${sale.createdAt} >= ${from}
      and ${sale.createdAt} < ${to}
    group by 1
    order by 1
  `;
}

function addPeriod(value: Date, unit: ChartUnit, amount: number) {
  const next = new Date(value);
  if (unit === "year") next.setFullYear(next.getFullYear() + amount);
  if (unit === "month") next.setMonth(next.getMonth() + amount);
  if (unit === "week") next.setDate(next.getDate() + amount * 7);
  if (unit === "day") next.setDate(next.getDate() + amount);
  return next;
}

function periodKey(value: Date) {
  const year = value.getFullYear().toString().padStart(4, "0");
  const month = (value.getMonth() + 1).toString().padStart(2, "0");
  const day = value.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
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
