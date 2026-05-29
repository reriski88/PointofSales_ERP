import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { inventoryBalance, outlet, payment, sale, saleItem, sku, unit, user, wasteAdjustment } from "@/db/schema";

export const reportRepository = {
  inventorySummary(organizationId: string, outletId?: string | null) {
    const conditions = [eq(sku.organizationId, organizationId)];
    if (outletId) conditions.push(eq(inventoryBalance.outletId, outletId));

    return db
      .select({
        skuCount: sql<number>`count(*)::int`,
        totalOnHandBaseQty: sql<string>`coalesce(sum(${inventoryBalance.onHandBaseQty}), 0)::text`,
        criticalStockCount: sql<number>`count(*) filter (where ${inventoryBalance.onHandBaseQty} <= ${sku.minStockBaseQty})::int`,
      })
      .from(inventoryBalance)
      .innerJoin(sku, eq(sku.id, inventoryBalance.skuId))
      .innerJoin(outlet, eq(outlet.id, inventoryBalance.outletId))
      .where(and(...conditions, eq(outlet.organizationId, organizationId)));
  },

  salesSummary(organizationId: string, outletId?: string | null, from?: string | null, to?: string | null) {
    const conditions = [eq(sale.organizationId, organizationId)];
    if (outletId) conditions.push(eq(sale.outletId, outletId));
    if (from) conditions.push(gte(sale.createdAt, new Date(from)));
    if (to) conditions.push(lte(sale.createdAt, new Date(to)));
    conditions.push(eq(sale.status, "completed"));

    return db
      .select({
        transactionCount: sql<number>`count(*)::int`,
        grossSales: sql<string>`coalesce(sum(${sale.subtotal}), 0)::text`,
        netSales: sql<string>`coalesce(sum(${sale.grandTotal}), 0)::text`,
        cogs: sql<string>`coalesce(sum(${sale.cogsTotal}), 0)::text`,
        grossProfit: sql<string>`coalesce(sum(${sale.grandTotal} - ${sale.cogsTotal}), 0)::text`,
      })
      .from(sale)
      .where(and(...conditions));
  },

  wasteSummary(organizationId: string, outletId?: string | null, from?: string | null, to?: string | null) {
    const conditions = [eq(wasteAdjustment.organizationId, organizationId)];
    if (outletId) conditions.push(eq(wasteAdjustment.outletId, outletId));
    if (from) conditions.push(gte(wasteAdjustment.createdAt, new Date(from)));
    if (to) conditions.push(lte(wasteAdjustment.createdAt, new Date(to)));
    conditions.push(inArray(wasteAdjustment.status, ["posted", "approved"]));

    return db
      .select({
        adjustmentCount: sql<number>`count(*)::int`,
        totalQuantityBase: sql<string>`coalesce(sum(${wasteAdjustment.quantityBase}), 0)::text`,
        totalEstimatedLoss: sql<string>`coalesce(sum(${wasteAdjustment.estimatedLoss}), 0)::text`,
      })
      .from(wasteAdjustment)
      .where(and(...conditions));
  },

  salesDetail(organizationId: string, outletId?: string | null, from?: string | null, to?: string | null) {
    const conditions = [eq(sale.organizationId, organizationId)];
    if (outletId) conditions.push(eq(sale.outletId, outletId));
    if (from) conditions.push(gte(sale.createdAt, new Date(from)));
    if (to) conditions.push(lte(sale.createdAt, new Date(to)));
    conditions.push(eq(sale.status, "completed"));

    return db
      .select({
        id: sale.id,
        receiptNumber: sale.receiptNumber,
        status: sale.status,
        source: sale.source,
        cashierName: user.name,
        subtotal: sale.subtotal,
        discountTotal: sale.discountTotal,
        grandTotal: sale.grandTotal,
        cogsTotal: sale.cogsTotal,
        grossProfit: sql<string>`(${sale.grandTotal} - ${sale.cogsTotal})::text`,
        itemCount: sql<number>`(
          select count(*)::int
          from ${saleItem}
          where ${saleItem.saleId} = ${sale.id}
        )`,
        paymentMethods: sql<string>`coalesce((
          select string_agg(${payment.method}::text, ', ')
          from ${payment}
          where ${payment.saleId} = ${sale.id}
        ), '')`,
        items: sql`coalesce((
          select json_agg(json_build_object(
            'skuId', line.sku_id,
            'skuCode', item_sku.sku,
            'name', line.name_snapshot,
            'quantityInput', line.quantity_input,
            'quantityBase', line.quantity_base,
            'unitCode', input_unit.code,
            'baseUnitCode', base_unit.code,
            'unitPrice', line.unit_price,
            'discountTotal', line.discount_total,
            'lineTotal', line.line_total
          ) order by line.created_at)
          from ${saleItem} line
          left join ${sku} item_sku on item_sku.id = line.sku_id
          left join ${unit} input_unit on input_unit.id = line.unit_id
          left join ${unit} base_unit on base_unit.id = item_sku.base_unit_id
          where line.sale_id = ${sale.id}
        ), '[]'::json)`,
        payments: sql`coalesce((
          select json_agg(json_build_object(
            'method', ${payment.method},
            'amount', ${payment.amount},
            'reference', ${payment.reference}
          ) order by ${payment.createdAt})
          from ${payment}
          where ${payment.saleId} = ${sale.id}
        ), '[]'::json)`,
        createdAt: sale.createdAt,
      })
      .from(sale)
      .leftJoin(user, eq(user.id, sale.cashierUserId))
      .where(and(...conditions))
      .orderBy(desc(sale.createdAt))
      .limit(100);
  },

  wasteDetail(organizationId: string, outletId?: string | null, from?: string | null, to?: string | null) {
    const conditions = [eq(wasteAdjustment.organizationId, organizationId)];
    if (outletId) conditions.push(eq(wasteAdjustment.outletId, outletId));
    if (from) conditions.push(gte(wasteAdjustment.createdAt, new Date(from)));
    if (to) conditions.push(lte(wasteAdjustment.createdAt, new Date(to)));
    conditions.push(inArray(wasteAdjustment.status, ["posted", "approved"]));

    return db
      .select({
        id: wasteAdjustment.id,
        outletName: outlet.name,
        outletCode: outlet.code,
        skuName: sku.name,
        skuCode: sku.sku,
        status: wasteAdjustment.status,
        reason: wasteAdjustment.reason,
        quantityBase: wasteAdjustment.quantityBase,
        unitCode: unit.code,
        estimatedLoss: wasteAdjustment.estimatedLoss,
        note: wasteAdjustment.note,
        requestedByName: user.name,
        createdAt: wasteAdjustment.createdAt,
      })
      .from(wasteAdjustment)
      .innerJoin(outlet, eq(outlet.id, wasteAdjustment.outletId))
      .innerJoin(sku, eq(sku.id, wasteAdjustment.skuId))
      .innerJoin(unit, eq(unit.id, sku.baseUnitId))
      .leftJoin(user, eq(user.id, wasteAdjustment.requestedByUserId))
      .where(and(...conditions))
      .orderBy(desc(wasteAdjustment.createdAt))
      .limit(200);
  },

  paymentSummary(organizationId: string, outletId?: string | null, from?: string | null, to?: string | null) {
    const conditions = [eq(sale.organizationId, organizationId)];
    if (outletId) conditions.push(eq(sale.outletId, outletId));
    if (from) conditions.push(gte(sale.createdAt, new Date(from)));
    if (to) conditions.push(lte(sale.createdAt, new Date(to)));
    conditions.push(eq(sale.status, "completed"));

    return db
      .select({
        method: payment.method,
        amount: sql<string>`coalesce(sum(${payment.amount}), 0)::text`,
      })
      .from(payment)
      .innerJoin(sale, eq(sale.id, payment.saleId))
      .where(and(...conditions))
      .groupBy(payment.method)
      .orderBy(payment.method);
  },

  inventoryValuation(organizationId: string, outletId?: string | null) {
    const conditions = [eq(outlet.organizationId, organizationId)];
    if (outletId) conditions.push(eq(inventoryBalance.outletId, outletId));

    return db
      .select({
        inventoryValue: sql<string>`coalesce(sum(${inventoryBalance.onHandBaseQty} * ${sku.cost}), 0)::text`,
        skuCount: sql<number>`count(distinct ${sku.id})::int`,
      })
      .from(inventoryBalance)
      .innerJoin(outlet, eq(outlet.id, inventoryBalance.outletId))
      .innerJoin(sku, eq(sku.id, inventoryBalance.skuId))
      .where(and(...conditions, eq(sku.organizationId, organizationId)));
  },
};
