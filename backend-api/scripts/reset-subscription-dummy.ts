import "dotenv/config";
import { db, pool } from "@/db";
import { auth } from "@/lib/auth";
import { defaultRoleAccess } from "@/lib/role-access";
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
  subscriptionPlan,
  tenantSubscription,
  subscriptionPayment,
} from "@/db/schema";
import { eq } from "drizzle-orm";

// === TENANT DEFINITIONS ===
type TenantDef = {
  name: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  planCode: string;
  subStatus: "trial" | "active" | "grace_period" | "suspended" | "cancelled" | "expired";
  trialDays?: number;
  periodOffsetDays: number; // days from now for periodEnd
  suspendedReason?: string;
  outlets: string[];
  products: Array<{
    name: string;
    category: string;
    sku: string;
    skuName: string;
    baseUnitCode: string;
    saleUnitCode: string;
    saleFactor: string;
    price: string;
    cost: string;
    stock: string;
  }>;
  users: Array<{
    email: string;
    password: string;
    name: string;
    role: "owner" | "admin_outlet" | "cashier" | "warehouse";
  }>;
};

const tenants: TenantDef[] = [
  {
    name: "Toko Cemilan Jaya",
    contactName: "Budi Santoso",
    contactPhone: "081234567890",
    contactEmail: "budi@cemilanjaya.com",
    planCode: "pro",
    subStatus: "active",
    periodOffsetDays: 25, // expires in 25 days
    outlets: ["Outlet Pusat", "Cabang Mall"],
    products: [
      { name: "Keripik Singkong", category: "Keripik", sku: "KS-100", skuName: "Keripik Singkong 100g", baseUnitCode: "g", saleUnitCode: "pack-100g", saleFactor: "100", price: "12000", cost: "52", stock: "5000" },
      { name: "Basreng Pedas", category: "Snack Pedas", sku: "BP-100", skuName: "Basreng Pedas 100g", baseUnitCode: "g", saleUnitCode: "pack-100g", saleFactor: "100", price: "15000", cost: "68", stock: "4000" },
      { name: "Kacang Bawang", category: "Kacang", sku: "KB-250", skuName: "Kacang Bawang 250g", baseUnitCode: "g", saleUnitCode: "pack-250g", saleFactor: "250", price: "28000", cost: "75", stock: "3000" },
      { name: "Brownies Mini", category: "Kue", sku: "BM-PCS", skuName: "Brownies Mini Pcs", baseUnitCode: "pcs", saleUnitCode: "pcs", saleFactor: "1", price: "7000", cost: "3500", stock: "50" },
      { name: "Air Mineral", category: "Minuman", sku: "AM-600", skuName: "Air Mineral 600ml", baseUnitCode: "pcs", saleUnitCode: "pcs", saleFactor: "1", price: "5000", cost: "2500", stock: "100" },
      { name: "Makroni Pedas", category: "Snack Pedas", sku: "MP-100", skuName: "Makroni Pedas 100g", baseUnitCode: "g", saleUnitCode: "pack-100g", saleFactor: "100", price: "13000", cost: "58", stock: "3500" },
    ],
    users: [
      { email: "owner-jaya@email.com", password: "Pwd!12345", name: "Budi Santoso", role: "owner" },
      { email: "kasir1-jaya@email.com", password: "Pwd!12345", name: "Ani Cahyani", role: "cashier" },
      { email: "kasir2-jaya@email.com", password: "Pwd!12345", name: "Doni Prasetyo", role: "cashier" },
    ],
  },
  {
    name: "Warung Snack Sehat",
    contactName: "Siti Rahayu",
    contactPhone: "082198765432",
    contactEmail: "siti@snacksehat.com",
    planCode: "basic",
    subStatus: "trial",
    trialDays: 3, // trial expires in 3 days
    periodOffsetDays: 30,
    outlets: ["Warung Utama"],
    products: [
      { name: "Keripik Sayur", category: "Keripik", sku: "KSY-100", skuName: "Keripik Sayur 100g", baseUnitCode: "g", saleUnitCode: "pack-100g", saleFactor: "100", price: "18000", cost: "85", stock: "2000" },
      { name: "Granola Sehat", category: "Kue", sku: "GRS-250", skuName: "Granola Sehat 250g", baseUnitCode: "g", saleUnitCode: "pack-250g", saleFactor: "250", price: "35000", cost: "150", stock: "1500" },
      { name: "Teh Herbal", category: "Minuman", sku: "TH-PCS", skuName: "Teh Herbal Celup", baseUnitCode: "pcs", saleUnitCode: "pcs", saleFactor: "1", price: "8000", cost: "3000", stock: "80" },
      { name: "Kacang Almond", category: "Kacang", sku: "KA-100", skuName: "Kacang Almond 100g", baseUnitCode: "g", saleUnitCode: "pack-100g", saleFactor: "100", price: "25000", cost: "130", stock: "1200" },
    ],
    users: [
      { email: "owner-sehat@email.com", password: "Pwd!12345", name: "Siti Rahayu", role: "owner" },
      { email: "kasir-sehat@email.com", password: "Pwd!12345", name: "Rina Melati", role: "cashier" },
    ],
  },
  {
    name: "Grosir Cemilan Nusantara",
    contactName: "Hendra Wijaya",
    contactPhone: "083356789012",
    contactEmail: "hendra@grosirnusantara.com",
    planCode: "enterprise",
    subStatus: "active",
    periodOffsetDays: 180,
    outlets: ["Gudang Pusat", "Cabang Timur", "Cabang Barat"],
    products: [
      { name: "Keripik Singkong", category: "Keripik", sku: "KS-BOX", skuName: "Keripik Singkong Box 1kg", baseUnitCode: "kg", saleUnitCode: "box-1kg", saleFactor: "1", price: "85000", cost: "450", stock: "20000" },
      { name: "Basreng Pedas", category: "Snack Pedas", sku: "BP-BOX", skuName: "Basreng Pedas Box 1kg", baseUnitCode: "kg", saleUnitCode: "box-1kg", saleFactor: "1", price: "95000", cost: "520", stock: "15000" },
      { name: "Kacang Bawang", category: "Kacang", sku: "KB-BOX", skuName: "Kacang Bawang Box 1kg", baseUnitCode: "kg", saleUnitCode: "box-1kg", saleFactor: "1", price: "120000", cost: "580", stock: "12000" },
      { name: "Brownies Mini", category: "Kue", sku: "BM-BOX", skuName: "Brownies Mini Box 24pcs", baseUnitCode: "pcs", saleUnitCode: "box-24", saleFactor: "24", price: "120000", cost: "65000", stock: "500" },
      { name: "Air Mineral", category: "Minuman", sku: "AM-DUS", skuName: "Air Mineral Dus 24", baseUnitCode: "pcs", saleUnitCode: "dus-24", saleFactor: "24", price: "48000", cost: "40000", stock: "300" },
      { name: "Makroni Pedas", category: "Snack Pedas", sku: "MP-BOX", skuName: "Makroni Pedas Box 1kg", baseUnitCode: "kg", saleUnitCode: "box-1kg", saleFactor: "1", price: "88000", cost: "480", stock: "18000" },
      { name: "Coklat Batang", category: "Kue", sku: "CB-PCS", skuName: "Coklat Batang Pcs", baseUnitCode: "pcs", saleUnitCode: "pcs", saleFactor: "1", price: "15000", cost: "8000", stock: "200" },
      { name: "Permen Jelly", category: "Snack", sku: "PJ-100", skuName: "Permen Jelly 100g", baseUnitCode: "g", saleUnitCode: "pack-100g", saleFactor: "100", price: "10000", cost: "45", stock: "8000" },
    ],
    users: [
      { email: "owner-grosir@email.com", password: "Pwd!12345", name: "Hendra Wijaya", role: "owner" },
      { email: "admin-grosir@email.com", password: "Pwd!12345", name: "Linda Permata", role: "admin_outlet" },
      { email: "kasir1-grosir@email.com", password: "Pwd!12345", name: "Agus Salim", role: "cashier" },
      { email: "kasir2-grosir@email.com", password: "Pwd!12345", name: "Putri Anggraini", role: "cashier" },
      { email: "gudang-grosir@email.com", password: "Pwd!12345", name: "Rudi Hartono", role: "warehouse" },
    ],
  },
  {
    name: "Kedai Oleh-Oleh Kita",
    contactName: "Rina Mariana",
    contactPhone: "084412345678",
    contactEmail: "rina@oleholehkita.com",
    planCode: "basic",
    subStatus: "expired",
    periodOffsetDays: -5, // expired 5 days ago
    outlets: ["Kedai Utama"],
    products: [
      { name: "Keripik Pisang", category: "Keripik", sku: "KP-100", skuName: "Keripik Pisang 100g", baseUnitCode: "g", saleUnitCode: "pack-100g", saleFactor: "100", price: "10000", cost: "48", stock: "800" },
      { name: "Sale Pisang", category: "Kue", sku: "SP-PCS", skuName: "Sale Pisang Pcs", baseUnitCode: "pcs", saleUnitCode: "pcs", saleFactor: "1", price: "5000", cost: "2000", stock: "30" },
      { name: "Dodol Garut", category: "Kue", sku: "DG-250", skuName: "Dodol Garut 250g", baseUnitCode: "g", saleUnitCode: "pack-250g", saleFactor: "250", price: "20000", cost: "90", stock: "600" },
    ],
    users: [
      { email: "owner-oleh@email.com", password: "Pwd!12345", name: "Rina Mariana", role: "owner" },
    ],
  },
  {
    name: "Camilan Premium Indo",
    contactName: "Anton Kusuma",
    contactPhone: "085598765432",
    contactEmail: "anton@camilanpremium.com",
    planCode: "pro",
    subStatus: "suspended",
    suspendedReason: "Menunggu konfirmasi pembayaran",
    periodOffsetDays: 15,
    outlets: ["Premium Store"],
    products: [
      { name: "Keripik Truffle", category: "Keripik", sku: "KT-50", skuName: "Keripik Truffle 50g", baseUnitCode: "g", saleUnitCode: "pack-50g", saleFactor: "50", price: "45000", cost: "220", stock: "1500" },
      { name: "Coklat Premium", category: "Kue", sku: "CP-PCS", skuName: "Coklat Premium Pcs", baseUnitCode: "pcs", saleUnitCode: "pcs", saleFactor: "1", price: "25000", cost: "12000", stock: "40" },
      { name: "Kacang Mete", category: "Kacang", sku: "KM-100", skuName: "Kacang Mete 100g", baseUnitCode: "g", saleUnitCode: "pack-100g", saleFactor: "100", price: "35000", cost: "180", stock: "2000" },
      { name: "Matcha Latte", category: "Minuman", sku: "ML-PCS", skuName: "Matcha Latte Sachet", baseUnitCode: "pcs", saleUnitCode: "pcs", saleFactor: "1", price: "12000", cost: "5000", stock: "60" },
    ],
    users: [
      { email: "owner-camilan@email.com", password: "Pwd!12345", name: "Anton Kusuma", role: "owner" },
      { email: "kasir-camilan@email.com", password: "Pwd!12345", name: "Sari Dewi", role: "cashier" },
    ],
  },
];

// === UNIT TEMPLATES ===
const unitTemplates = [
  { name: "Gram", code: "g", kind: "weight" as const, toBaseFactor: "1.000000" },
  { name: "Kilogram", code: "kg", kind: "weight" as const, toBaseFactor: "1.000000" },
  { name: "Pack 50g", code: "pack-50g", kind: "package" as const, toBaseFactor: "50.000000" },
  { name: "Pack 100g", code: "pack-100g", kind: "package" as const, toBaseFactor: "100.000000" },
  { name: "Pack 250g", code: "pack-250g", kind: "package" as const, toBaseFactor: "250.000000" },
  { name: "Box 1kg", code: "box-1kg", kind: "package" as const, toBaseFactor: "1.000000" },
  { name: "Box 24", code: "box-24", kind: "package" as const, toBaseFactor: "24.000000" },
  { name: "Dus 24", code: "dus-24", kind: "package" as const, toBaseFactor: "24.000000" },
  { name: "Pcs", code: "pcs", kind: "count" as const, toBaseFactor: "1.000000" },
];

async function main() {
  // 1. TRUNCATE ALL
  await resetPublicTables();

  // 2. Superadmin
  const saEmail = "it@email.com";
  const saPassword = "Pwd!12345.";
  await auth.api.signUpEmail({
    body: { email: saEmail, password: saPassword, name: "IT Support" },
  });
  await pool.query(
    `UPDATE "user" SET role = 'superadmin', is_active = true, email_verified = true, updated_at = now() WHERE email = $1`,
    [saEmail],
  );

  // 3. Plans
  const plans = [
    { name: "Basic", code: "basic", priceMonthly: "0", priceYearly: "0", maxOutlets: 1, maxUsers: 3, maxSkus: 50 },
    { name: "Pro", code: "pro", priceMonthly: "150000", priceYearly: "1500000", maxOutlets: 5, maxUsers: 20, maxSkus: 500 },
    { name: "Enterprise", code: "enterprise", priceMonthly: "500000", priceYearly: "5000000", maxOutlets: 999, maxUsers: 999, maxSkus: 99999 },
  ];
  const [planBasic, planPro, planEnterprise] = await db.insert(subscriptionPlan).values(plans).returning();

  // 4. Create each tenant
  for (const t of tenants) {
    console.log(`\n=== Creating: ${t.name} ===`);
    await createTenant(t, planBasic, planPro, planEnterprise);
  }

  console.log("\n═══ DUMMY DATA COMPLETE ═══");
  console.log(`Superadmin: ${saEmail} / ${saPassword}`);
  console.log(`\n--- Tenant Accounts ---`);
  for (const t of tenants) {
    console.log(`[${t.subStatus.toUpperCase()}] ${t.name} | Plan: ${t.planCode}`);
    for (const u of t.users) {
      console.log(`  ${u.role}: ${u.email} / ${u.password}`);
    }
  }
}

async function createTenant(
  t: TenantDef,
  planBasic: Record<string, any>,
  planPro: Record<string, any>,
  planEnterprise: Record<string, any>,
) {
  const plan = t.planCode === "pro" ? planPro : t.planCode === "enterprise" ? planEnterprise : planBasic;

  // Organization
  const [org] = await db
    .insert(organization)
    .values({
      name: t.name,
      contactName: t.contactName,
      contactPhone: t.contactPhone,
      contactEmail: t.contactEmail,
      address: t.outlets[0],
      rolePermissions: defaultRoleAccess,
      posSettings: { taxEnabled: false, taxRatePercent: 0, taxIncluded: false, serviceChargeEnabled: false, serviceChargeRatePercent: 0 },
    })
    .returning();

  // Subscription
  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + (t.trialDays ?? 14));
  const periodStart = new Date(now);
  const periodEnd = new Date(now);
  periodEnd.setDate(periodEnd.getDate() + t.periodOffsetDays);

  await db.insert(tenantSubscription).values({
    organizationId: org.id,
    planId: plan.id,
    status: t.subStatus,
    trialEndsAt: t.trialDays ? trialEnd : null,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    billingCycle: "monthly",
    suspendedReason: t.suspendedReason,
    suspendedAt: t.subStatus === "suspended" ? now : null,
  });

  // Get the actual subscription row for its UUID
  const [subRow] = await db
    .select({ id: tenantSubscription.id })
    .from(tenantSubscription)
    .where(eq(tenantSubscription.organizationId, org.id))
    .limit(1);
  const subId = subRow?.id ?? org.id;

  // Record payment for active tenants
  if (t.subStatus === "active") {
    await db.insert(subscriptionPayment).values({
      tenantSubscriptionId: subId,
      organizationId: org.id,
      amount: plan.priceMonthly,
      method: "transfer",
      reference: `PAY-${t.name.slice(0, 3).toUpperCase()}-001`,
      periodStart,
      periodEnd,
      status: "confirmed",
      paidAt: now,
    });
  }

  // Units
  const units = await db.insert(unit).values(unitTemplates.map(u => ({ ...u, organizationId: org.id }))).returning();
  const unitByCode = new Map(units.map(u => [u.code, u]));

  // Outlets
  const outletRows = await db.insert(outlet).values(
    t.outlets.map((name, i) => ({
      organizationId: org.id,
      name,
      code: `${name.slice(0, 4).toUpperCase()}-${i + 1}`,
      address: `Alamat ${name}`,
    })),
  ).returning();

  // Users
  const userRows = [];
  for (const u of t.users) {
    const row = await createUser({ ...u, organizationId: org.id });
    userRows.push(row);
  }
  const owner = userRows.find(u => true)!; // first user is owner

  // Assign owner to all outlets, cashiers to first outlet
  for (const u of userRows) {
    const outletIds = u === owner ? outletRows.map(o => o.id) : [outletRows[0].id];
    await db.insert(userOutlet).values(outletIds.map(oid => ({ userId: u.id, outletId: oid })));
  }

  // Products + SKUs
  for (const p of t.products) {
    const [prod] = await db.insert(product).values({ organizationId: org.id, name: p.name, category: p.category }).returning();
    const baseUnit = unitByCode.get(p.baseUnitCode)!;
    const saleUnit = unitByCode.get(p.saleUnitCode)!;
    const [s] = await db.insert(sku).values({
      organizationId: org.id,
      productId: prod.id,
      sku: p.sku,
      name: p.skuName,
      baseUnitId: baseUnit.id,
      saleUnitId: saleUnit.id,
      saleUnitToBaseFactor: p.saleFactor + "00000",
      price: p.price + ".00",
      cost: p.cost + ".000000",
      minStockBaseQty: "500.000",
    }).returning();

    // Inventory balances for each outlet
    for (const o of outletRows) {
      const qty = (parseFloat(p.stock) / outletRows.length).toFixed(3);
      await db.insert(inventoryBalance).values({
        outletId: o.id,
        skuId: s.id,
        onHandBaseQty: qty,
      }).onConflictDoNothing();

      await db.insert(inventoryBatch).values({
        organizationId: org.id,
        outletId: o.id,
        skuId: s.id,
        lotCode: `INIT-${t.name.slice(0, 4).toUpperCase()}-${p.sku}`,
        initialBaseQty: qty,
        onHandBaseQty: qty,
        unitCost: p.cost + ".000000",
        sourceType: "dummy_init",
        note: "Initial stock",
      });

      await db.insert(stockMovement).values({
        organizationId: org.id,
        outletId: o.id,
        skuId: s.id,
        type: "opening",
        quantityBase: qty,
        unitId: baseUnit.id,
        quantityInput: qty,
        referenceType: "dummy_init",
        note: "Opening stock",
        actorUserId: owner.id,
      });
    }
  }

  // Customers
  await db.insert(customer).values([
    { organizationId: org.id, code: `CUST-${t.name.slice(0, 3).toUpperCase()}-01`, name: "Pelanggan Umum", phone: t.contactPhone },
  ]);
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
  email: string; password: string; name: string;
  role: "owner" | "admin_outlet" | "cashier" | "warehouse";
  organizationId: string;
}) {
  await auth.api.signUpEmail({
    body: { email: input.email, password: input.password, name: input.name },
  });
  const rows = await pool.query<{ id: string }>(
    `UPDATE "user" SET role = $1, is_active = true, organization_id = $2, email_verified = true, updated_at = now() WHERE email = $3 RETURNING *`,
    [input.role, input.organizationId, input.email],
  );
  if (!rows.rows[0]) throw new Error(`Failed to create user ${input.email}`);
  return rows.rows[0];
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => { await pool.end(); });
