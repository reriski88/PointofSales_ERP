import "dotenv/config";
import { db, pool } from "@/db";
import { auth } from "@/lib/auth";
import { defaultRoleAccess } from "@/lib/role-access";
import { financeRepository } from "@/backend/repositories/finance-repository";
import {
  customer,
  inventoryBalance,
  inventoryBatch,
  organization,
  outlet,
  product,
  promotion,
  shift,
  sku,
  stockMovement,
  unit,
  userOutlet,
} from "@/db/schema";

const ownerEmail = process.env.SEED_OWNER_EMAIL ?? "admin@email.com";
const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? "Pwd!12345";
const cashierEmail = "kasir@email.com";
const cashierPassword = "Pwd!12345";

async function main() {
  await resetPublicTables();

  const [org] = await db
    .insert(organization)
    .values({
      name: "POS Cemilan Dummy",
      logoUrl: "/images/login-pos-cartoon-transaction-transparent.png",
      receiptLayout: {
        autoPrint: false,
        printerName: "Thermal Bluetooth RPP02N",
        paperWidth: "58",
        header: ["logo", "outlet", "address", "cashier", "receiptNumber"],
        body: ["items", "totals", "payment"],
        footer: ["note"],
        footerNote: "Terima kasih sudah jajan di POS Cemilan",
      },
      posSettings: {
        taxEnabled: false,
        taxRatePercent: 0,
        taxIncluded: false,
        serviceChargeEnabled: false,
        serviceChargeRatePercent: 0,
      },
      rolePermissions: defaultRoleAccess,
    })
    .returning();

  const [mainOutlet, tabletOutlet] = await db
    .insert(outlet)
    .values([
      {
        organizationId: org.id,
        name: "Cemilan Pusat",
        code: "PUSAT",
        address: "Jl. Demo Raya No. 1",
        logoUrl: "/images/login-pos-cartoon-transaction-transparent.png",
      },
      {
        organizationId: org.id,
        name: "Cemilan Tablet",
        code: "TABLET",
        address: "Outlet dummy untuk tes tablet",
        logoUrl: "/images/login-pos-cartoon-transaction-transparent.png",
      },
    ])
    .returning();

  const owner = await createUser({
    email: ownerEmail,
    password: ownerPassword,
    name: "Admin POS Cemilan",
    role: "owner",
    organizationId: org.id,
  });
  const cashier = await createUser({
    email: cashierEmail,
    password: cashierPassword,
    name: "Kasir Dummy",
    role: "cashier",
    organizationId: org.id,
  });

  await db.insert(userOutlet).values([
    { userId: owner.id, outletId: mainOutlet.id },
    { userId: owner.id, outletId: tabletOutlet.id },
    { userId: cashier.id, outletId: mainOutlet.id },
  ]);

  const units = await db
    .insert(unit)
    .values([
      { organizationId: org.id, name: "Gram", code: "g", kind: "weight", toBaseFactor: "1.000000" },
      { organizationId: org.id, name: "Pack 100g", code: "pack-100g", kind: "package", toBaseFactor: "100.000000" },
      { organizationId: org.id, name: "Pack 250g", code: "pack-250g", kind: "package", toBaseFactor: "250.000000" },
      { organizationId: org.id, name: "Pcs", code: "pcs", kind: "count", toBaseFactor: "1.000000" },
    ])
    .returning();
  const gram = units.find((item) => item.code === "g")!;
  const pack100 = units.find((item) => item.code === "pack-100g")!;
  const pack250 = units.find((item) => item.code === "pack-250g")!;
  const pcs = units.find((item) => item.code === "pcs")!;

  const products = await db
    .insert(product)
    .values([
      { organizationId: org.id, name: "Keripik Singkong", category: "Keripik" },
      { organizationId: org.id, name: "Basreng Pedas", category: "Snack Pedas" },
      { organizationId: org.id, name: "Kacang Bawang", category: "Kacang" },
      { organizationId: org.id, name: "Brownies Mini", category: "Kue" },
      { organizationId: org.id, name: "Air Mineral", category: "Minuman" },
    ])
    .returning();

  const productByName = new Map(products.map((item) => [item.name, item]));
  const skus = await db
    .insert(sku)
    .values([
      {
        organizationId: org.id,
        productId: productByName.get("Keripik Singkong")!.id,
        sku: "KSO-100",
        barcode: "899700100001",
        name: "Keripik Singkong Original 100g",
        baseUnitId: gram.id,
        saleUnitId: pack100.id,
        saleUnitToBaseFactor: "100.000000",
        price: "12000.00",
        cost: "52.000000",
        minStockBaseQty: "1000.000",
      },
      {
        organizationId: org.id,
        productId: productByName.get("Basreng Pedas")!.id,
        sku: "BSP-100",
        barcode: "899700100002",
        name: "Basreng Pedas 100g",
        baseUnitId: gram.id,
        saleUnitId: pack100.id,
        saleUnitToBaseFactor: "100.000000",
        price: "15000.00",
        cost: "68.000000",
        minStockBaseQty: "800.000",
      },
      {
        organizationId: org.id,
        productId: productByName.get("Kacang Bawang")!.id,
        sku: "KCB-250",
        barcode: "899700100003",
        name: "Kacang Bawang 250g",
        baseUnitId: gram.id,
        saleUnitId: pack250.id,
        saleUnitToBaseFactor: "250.000000",
        price: "28000.00",
        cost: "75.000000",
        minStockBaseQty: "1000.000",
      },
      {
        organizationId: org.id,
        productId: productByName.get("Brownies Mini")!.id,
        sku: "BRM-PCS",
        barcode: "899700100004",
        name: "Brownies Mini Pcs",
        baseUnitId: pcs.id,
        saleUnitId: pcs.id,
        saleUnitToBaseFactor: "1.000000",
        price: "7000.00",
        cost: "3500.000000",
        minStockBaseQty: "20.000",
      },
      {
        organizationId: org.id,
        productId: productByName.get("Air Mineral")!.id,
        sku: "AM-600",
        barcode: "899700100005",
        name: "Air Mineral 600ml",
        baseUnitId: pcs.id,
        saleUnitId: pcs.id,
        saleUnitToBaseFactor: "1.000000",
        price: "5000.00",
        cost: "2500.000000",
        minStockBaseQty: "24.000",
      },
    ])
    .returning();

  await db.insert(inventoryBalance).values(
    skus.flatMap((item, index) => [
      {
        outletId: mainOutlet.id,
        skuId: item.id,
        onHandBaseQty: index < 3 ? "8000.000" : "80.000",
      },
      {
        outletId: tabletOutlet.id,
        skuId: item.id,
        onHandBaseQty: index < 3 ? "2500.000" : "32.000",
      },
    ]),
  );

  await db.insert(inventoryBatch).values(
    skus.map((item, index) => ({
      organizationId: org.id,
      outletId: mainOutlet.id,
      skuId: item.id,
      lotCode: `DUMMY-${index + 1}`,
      initialBaseQty: index < 3 ? "8000.000" : "80.000",
      onHandBaseQty: index < 3 ? "8000.000" : "80.000",
      unitCost: item.cost,
      sourceType: "dummy_reset",
      note: "Dummy stock batch",
    })),
  );

  await db.insert(stockMovement).values(
    skus.flatMap((item, index) => [
      {
        organizationId: org.id,
        outletId: mainOutlet.id,
        skuId: item.id,
        type: "opening" as const,
        quantityBase: index < 3 ? "8000.000" : "80.000",
        unitId: item.baseUnitId,
        quantityInput: index < 3 ? "8000.000" : "80.000",
        referenceType: "dummy_reset",
        note: "Dummy opening stock",
        actorUserId: owner.id,
      },
      {
        organizationId: org.id,
        outletId: tabletOutlet.id,
        skuId: item.id,
        type: "opening" as const,
        quantityBase: index < 3 ? "2500.000" : "32.000",
        unitId: item.baseUnitId,
        quantityInput: index < 3 ? "2500.000" : "32.000",
        referenceType: "dummy_reset",
        note: "Dummy opening stock tablet",
        actorUserId: owner.id,
      },
    ]),
  );

  await db.insert(customer).values([
    { organizationId: org.id, code: "CUST-001", name: "Pelanggan Umum", phone: "081200000001" },
    { organizationId: org.id, code: "CUST-002", name: "Rina Snack Lover", phone: "081200000002" },
  ]);

  await db.insert(promotion).values([
    {
      organizationId: org.id,
      name: "Voucher Dummy 5K",
      code: "DUMMY5",
      type: "transaction_discount",
      discountType: "amount",
      discountValue: "5000.00",
      scope: "all",
      minSubtotal: "30000.00",
      outletIds: [mainOutlet.id, tabletOutlet.id],
    },
  ]);

  await db.insert(shift).values([
    {
      organizationId: org.id,
      outletId: mainOutlet.id,
      cashierUserId: owner.id,
      openingCash: "200000.00",
      expectedCash: "200000.00",
      note: "Shift dummy admin",
    },
    {
      organizationId: org.id,
      outletId: mainOutlet.id,
      cashierUserId: cashier.id,
      openingCash: "100000.00",
      expectedCash: "100000.00",
      note: "Shift dummy kasir",
    },
  ]);

  await db.transaction(async (tx) => {
    await financeRepository.ensureDefaultAccounts(tx, org.id);
  });

  console.log("Dummy reset completed");
  console.log(`Admin: ${ownerEmail} / ${ownerPassword}`);
  console.log(`Kasir: ${cashierEmail} / ${cashierPassword}`);
  console.log(`Outlet utama: ${mainOutlet.name}`);
}

async function resetPublicTables() {
  const result = await pool.query<{ tablename: string }>(
    "select tablename from pg_tables where schemaname = 'public'",
  );
  if (!result.rows.length) return;
  const names = result.rows
    .map((row) => `"public"."${row.tablename.replaceAll('"', '""')}"`)
    .join(", ");
  await pool.query(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
}

async function createUser(input: {
  email: string;
  password: string;
  name: string;
  role: "owner" | "cashier";
  organizationId: string;
}) {
  await auth.api.signUpEmail({
    body: {
      email: input.email,
      password: input.password,
      name: input.name,
    },
  });
  const rows = await pool.query<{ id: string }>(
    'update "user" set role = $1, is_active = true, organization_id = $2, email_verified = true, updated_at = now() where email = $3 returning *',
    [input.role, input.organizationId, input.email],
  );
  if (!rows.rows[0]) {
    throw new Error(`Failed to create user ${input.email}`);
  }
  return rows.rows[0];
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
