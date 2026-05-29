import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db, pool } from "@/db";
import { auth } from "@/lib/auth";
import { inventoryBalance, organization, outlet, product, sku, stockMovement, unit, user, userOutlet } from "@/db/schema";

async function main() {
  const ownerEmail = process.env.SEED_OWNER_EMAIL ?? "admin@email.com";
  const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? "Pwd!12345.";
  const ownerName = process.env.SEED_OWNER_NAME ?? "Admin POS Cemilan";

  const [existingOrg] = await db.select().from(organization).limit(1);
  const [org] = existingOrg
    ? [existingOrg]
    : await db
        .insert(organization)
        .values({
          name: "POS Cemilan",
        })
        .returning();

  const [existingOutlet] = await db.select().from(outlet).where(eq(outlet.organizationId, org.id)).limit(1);
  const [mainOutlet] = existingOutlet
    ? [existingOutlet]
    : await db
        .insert(outlet)
        .values({
          organizationId: org.id,
          name: "Outlet Utama",
          code: "OUTLET-UTAMA",
          address: "PC lokal owner",
        })
        .returning();

  let [owner] = await db.select().from(user).where(eq(user.email, ownerEmail)).limit(1);

  if (!owner) {
    await auth.api.signUpEmail({
      body: {
        email: ownerEmail,
        password: ownerPassword,
        name: ownerName,
      },
    });
    [owner] = await db.select().from(user).where(eq(user.email, ownerEmail)).limit(1);
  }

  if (!owner) {
    throw new Error("Seed owner could not be created");
  }

  await db
    .update(user)
    .set({
      role: "owner",
      isActive: true,
      organizationId: org.id,
      updatedAt: new Date(),
    })
    .where(eq(user.id, owner.id));

  await db
    .insert(userOutlet)
    .values({
      userId: owner.id,
      outletId: mainOutlet.id,
    })
    .onConflictDoNothing();

  const unitDefinitions = [
    { name: "Gram", code: "g", kind: "weight" as const, toBaseFactor: "1.000000" },
    { name: "Kilogram", code: "kg", kind: "weight" as const, toBaseFactor: "1000.000000" },
    { name: "Pack 100g", code: "pack-100g", kind: "package" as const, toBaseFactor: "100.000000" },
    { name: "Pcs", code: "pcs", kind: "count" as const, toBaseFactor: "1.000000" },
  ];

  const units = [];
  for (const item of unitDefinitions) {
    const [existingUnit] = await db
      .select()
      .from(unit)
      .where(eq(unit.code, item.code))
      .limit(1);

    if (existingUnit) {
      units.push(existingUnit);
      continue;
    }

    const [createdUnit] = await db
      .insert(unit)
      .values({
        organizationId: org.id,
        ...item,
      })
      .returning();
    units.push(createdUnit);
  }

  const gram = units.find((item) => item.code === "g");
  const pack100 = units.find((item) => item.code === "pack-100g");

  if (gram && pack100) {
    const [existingProduct] = await db.select().from(product).where(eq(product.name, "Keripik Singkong Original")).limit(1);
    if (!existingProduct) {
      const [createdProduct] = await db
        .insert(product)
        .values({
          organizationId: org.id,
          name: "Keripik Singkong Original",
          category: "Keripik",
        })
        .returning();

      const [createdSku] = await db
        .insert(sku)
        .values({
          organizationId: org.id,
          productId: createdProduct.id,
          sku: "KSO-100",
          name: "Keripik Singkong Original 100g",
          baseUnitId: gram.id,
          saleUnitId: pack100.id,
          saleUnitToBaseFactor: "100.000000",
          price: "12000.00",
          cost: "55.000000",
          minStockBaseQty: "1000.000",
        })
        .returning();

      await db
        .insert(inventoryBalance)
        .values({
          outletId: mainOutlet.id,
          skuId: createdSku.id,
          onHandBaseQty: "5000.000",
        })
        .onConflictDoNothing();

      await db
        .insert(stockMovement)
        .values({
          organizationId: org.id,
          outletId: mainOutlet.id,
          skuId: createdSku.id,
          type: "opening",
          quantityBase: "5000.000",
          unitId: gram.id,
          quantityInput: "5000.000",
          referenceType: "seed_opening_stock",
          note: "Initial seed stock",
          actorUserId: owner.id,
        })
        .onConflictDoNothing();
    }
  }

  await reconcileOpeningMovements(org.id, owner.id);

  console.log("Seed completed");
  console.log(`Owner email: ${ownerEmail}`);
  console.log(`Owner password: ${ownerPassword}`);
  console.log(`Outlet ID: ${mainOutlet.id}`);
}

async function reconcileOpeningMovements(organizationId: string, actorUserId: string) {
  const balances = await db.select().from(inventoryBalance);
  for (const balance of balances) {
    const [targetSku] = await db
      .select()
      .from(sku)
      .where(and(eq(sku.id, balance.skuId), eq(sku.organizationId, organizationId)))
      .limit(1);
    if (!targetSku) continue;

    const movements = await db
      .select()
      .from(stockMovement)
      .where(
        and(
          eq(stockMovement.organizationId, organizationId),
          eq(stockMovement.outletId, balance.outletId),
          eq(stockMovement.skuId, balance.skuId),
        ),
      );
    const movementTotal = movements.reduce((sum, item) => sum + Number(item.quantityBase), 0);
    const diff = Number(balance.onHandBaseQty) - movementTotal;
    if (Math.abs(diff) < 0.0005) continue;

    await db.insert(stockMovement).values({
      organizationId,
      outletId: balance.outletId,
      skuId: balance.skuId,
      type: diff >= 0 ? "opening" : "adjustment",
      quantityBase: diff.toFixed(3),
      unitId: targetSku.baseUnitId,
      quantityInput: diff.toFixed(3),
      referenceType: "ledger_reconciliation",
      note: "Reconcile existing balance with stock movement ledger",
      actorUserId,
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
