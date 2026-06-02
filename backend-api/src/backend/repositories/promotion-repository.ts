import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { organization, promotion, salePromotion, sku } from "@/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const promotionRepository = {
  transaction<T>(callback: (tx: Tx) => Promise<T>) {
    return db.transaction(callback);
  },

  findMany(organizationId: string) {
    return db
      .select({
        id: promotion.id,
        organizationId: promotion.organizationId,
        name: promotion.name,
        code: promotion.code,
        type: promotion.type,
        discountType: promotion.discountType,
        discountValue: promotion.discountValue,
        scope: promotion.scope,
        targetSkuId: promotion.targetSkuId,
        targetSkuName: sku.name,
        targetCategory: promotion.targetCategory,
        outletIds: promotion.outletIds,
        minSubtotal: promotion.minSubtotal,
        buyQty: promotion.buyQty,
        getQty: promotion.getQty,
        maxRedemptions: promotion.maxRedemptions,
        redeemedCount: promotion.redeemedCount,
        startsAt: promotion.startsAt,
        endsAt: promotion.endsAt,
        isActive: promotion.isActive,
        createdAt: promotion.createdAt,
        updatedAt: promotion.updatedAt,
      })
      .from(promotion)
      .leftJoin(sku, eq(sku.id, promotion.targetSkuId))
      .where(eq(promotion.organizationId, organizationId))
      .orderBy(promotion.name);
  },

  findActiveMany(organizationId: string) {
    const now = new Date();

    return db
      .select({
        id: promotion.id,
        organizationId: promotion.organizationId,
        name: promotion.name,
        code: promotion.code,
        type: promotion.type,
        discountType: promotion.discountType,
        discountValue: promotion.discountValue,
        scope: promotion.scope,
        targetSkuId: promotion.targetSkuId,
        targetSkuName: sku.name,
        targetCategory: promotion.targetCategory,
        outletIds: promotion.outletIds,
        minSubtotal: promotion.minSubtotal,
        buyQty: promotion.buyQty,
        getQty: promotion.getQty,
        maxRedemptions: promotion.maxRedemptions,
        redeemedCount: promotion.redeemedCount,
        startsAt: promotion.startsAt,
        endsAt: promotion.endsAt,
        isActive: promotion.isActive,
        createdAt: promotion.createdAt,
        updatedAt: promotion.updatedAt,
      })
      .from(promotion)
      .leftJoin(sku, eq(sku.id, promotion.targetSkuId))
      .where(
        and(
          eq(promotion.organizationId, organizationId),
          eq(promotion.isActive, true),
          sql`(${promotion.startsAt} is null or ${promotion.startsAt} <= ${now})`,
          sql`(${promotion.endsAt} is null or ${promotion.endsAt} >= ${now})`,
          sql`(${promotion.maxRedemptions} is null or ${promotion.redeemedCount} < ${promotion.maxRedemptions})`,
        ),
      )
      .orderBy(promotion.name);
  },

  findById(tx: Tx, id: string, organizationId: string) {
    return tx
      .select()
      .from(promotion)
      .where(and(eq(promotion.id, id), eq(promotion.organizationId, organizationId)))
      .limit(1);
  },

  findByCode(tx: Tx, organizationId: string, code: string) {
    return tx
      .select()
      .from(promotion)
      .where(and(eq(promotion.organizationId, organizationId), eq(promotion.code, code.trim().toUpperCase())))
      .limit(1);
  },

  findActiveForSale(tx: Tx, organizationId: string, codes: string[]) {
    const now = new Date();
    void codes;

    return tx
      .select()
      .from(promotion)
      .where(
        and(
          eq(promotion.organizationId, organizationId),
          eq(promotion.isActive, true),
          sql`(${promotion.startsAt} is null or ${promotion.startsAt} <= ${now})`,
          sql`(${promotion.endsAt} is null or ${promotion.endsAt} >= ${now})`,
          sql`(${promotion.maxRedemptions} is null or ${promotion.redeemedCount} < ${promotion.maxRedemptions})`,
        ),
      );
  },

  create(values: typeof promotion.$inferInsert) {
    return db.insert(promotion).values(values).returning();
  },

  update(id: string, organizationId: string, values: Partial<typeof promotion.$inferInsert>) {
    return db
      .update(promotion)
      .set(values)
      .where(and(eq(promotion.id, id), eq(promotion.organizationId, organizationId)))
      .returning();
  },

  delete(id: string, organizationId: string) {
    return db
      .delete(promotion)
      .where(and(eq(promotion.id, id), eq(promotion.organizationId, organizationId)))
      .returning();
  },

  createSalePromotion(tx: Tx, values: typeof salePromotion.$inferInsert) {
    return tx.insert(salePromotion).values(values);
  },

  incrementRedemption(tx: Tx, promotionId: string) {
    return tx
      .update(promotion)
      .set({
        redeemedCount: sql`${promotion.redeemedCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(promotion.id, promotionId));
  },

  findPosSettings(tx: Tx, organizationId: string) {
    return tx
      .select({ posSettings: organization.posSettings })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1);
  },
};
