import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "Smart POS ERP",
      version: "0.1.0",
      description: "Smart POS ERP untuk web admin, Flutter APK, PostgreSQL, Drizzle ORM, dan Better Auth.",
    },
    servers: [
      {
        url: process.env.APP_ORIGIN ?? "http://localhost:3000",
        description: process.env.VERCEL ? "Production API" : "Development API",
      },
    ],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
        },
      },
    },
    paths: {
      "/api/health": { get: { summary: "Health check" } },
      "/api/auth/sign-in/email": { post: { summary: "Better Auth email/password sign-in" } },
      "/api/auth/sign-out": { post: { summary: "Better Auth sign-out" } },
      "/api/auth/get-session": { get: { summary: "Better Auth current session" } },
      "/api/outlets": { get: { summary: "List outlets" }, post: { summary: "Create outlet" } },
      "/api/users": { get: { summary: "List users and cashier accounts" }, post: { summary: "Create user/cashier account" } },
      "/api/users/{id}": { patch: { summary: "Update user role, status, and outlet access" } },
      "/api/units": { get: { summary: "List units" }, post: { summary: "Create unit" } },
      "/api/products": { get: { summary: "List products and SKUs" }, post: { summary: "Create product with first SKU" } },
      "/api/catalog": { get: { summary: "Pull catalog snapshot for Flutter cache" } },
      "/api/customers": { get: { summary: "Daftar pelanggan beserta saldo piutang" }, post: { summary: "Tambah pelanggan/member" } },
      "/api/customers/{id}": { patch: { summary: "Ubah data, kode, kontak, atau status aktif pelanggan" } },
      "/api/customers/{id}/sales": { get: { summary: "Histori pembelian pelanggan" } },
      "/api/customer-receivables": { get: { summary: "Daftar piutang pelanggan, dapat difilter outlet" } },
      "/api/customer-receivables/{id}/payments": { post: { summary: "Catat pembayaran piutang pelanggan" } },
      "/api/suppliers": { get: { summary: "Daftar supplier" }, post: { summary: "Tambah supplier" } },
      "/api/suppliers/{id}": { patch: { summary: "Ubah supplier" } },
      "/api/purchases": { get: { summary: "Daftar pesanan pembelian" }, post: { summary: "Buat pesanan pembelian" } },
      "/api/purchases/{id}": { get: { summary: "Detail pesanan pembelian untuk invoice" } },
      "/api/purchases/{id}/receive": { post: { summary: "Terima barang pesanan pembelian dan tambah stok" } },
      "/api/purchases/{id}/payments": { post: { summary: "Catat pembayaran supplier" } },
      "/api/shifts/open": { post: { summary: "Open cashier shift" } },
      "/api/shifts/close": { post: { summary: "Close cashier shift" } },
      "/api/shifts/current": { get: { summary: "Get current cashier shift" } },
      "/api/shifts/cash-movements": { post: { summary: "Create shift cash in/out movement" } },
      "/api/shifts/{id}/summary": { get: { summary: "Get shift closing summary" } },
      "/api/sales": { post: { summary: "Create POS sale with idempotency key" } },
      "/api/sales/{id}": { get: { summary: "Get sale detail" } },
      "/api/sales/{id}/void": { post: { summary: "Batalkan transaksi selesai dan koreksi stok/kas" } },
      "/api/sales/{id}/refund": { post: { summary: "Retur/pengembalian dana transaksi dengan opsi stok kembali" } },
      "/api/inventory/balances": { get: { summary: "List inventory balances by outlet" } },
      "/api/inventory/batches": { get: { summary: "List inventory batches, lot codes, and expiry dates by outlet" } },
      "/api/inventory/movements": { get: { summary: "List stock movements by outlet" } },
      "/api/inventory/adjustments": { post: { summary: "Create opening, purchase, or stock adjustment movement" } },
      "/api/inventory/transfers": { post: { summary: "Transfer stok antar outlet" } },
      "/api/waste-adjustments": { get: { summary: "List waste adjustments" }, post: { summary: "Create waste/shrinkage adjustment" } },
      "/api/waste-adjustments/{id}/approve": { post: { summary: "Approve or reject pending waste adjustment" } },
      "/api/sync/push": { post: { summary: "Push offline Flutter transactions" } },
      "/api/sync/pull": { get: { summary: "Pull changed master data and balances" } },
      "/api/reports/sales-summary": { get: { summary: "Sales summary report" } },
      "/api/reports/inventory-summary": { get: { summary: "Inventory summary report" } },
      "/api/reports/waste-summary": { get: { summary: "Waste summary report" } },
      "/api/finance/accounts": { get: { summary: "Daftar chart of accounts default ERP" } },
      "/api/finance/journals": { get: { summary: "Daftar jurnal akuntansi posted" } },
      "/api/finance/cash-ledger": { get: { summary: "Daftar kas/bank ledger dari pembayaran transaksi" } },
      "/api/finance/expenses": { get: { summary: "Daftar biaya operasional" }, post: { summary: "Catat biaya operasional dan jurnal otomatis" } },
      "/api/openapi.json": { get: { summary: "OpenAPI document" } },
    },
  });
}
