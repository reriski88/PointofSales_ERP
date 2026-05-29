import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "POS Cemilan API",
      version: "0.1.0",
      description: "Backend lokal POS Cemilan untuk Flutter APK, PostgreSQL, Drizzle ORM, Better Auth, dan Cloudflare Tunnel.",
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Local PC backend",
      },
      {
        url: "https://{cloudflareTunnelHost}",
        description: "Cloudflare Tunnel public HTTPS URL",
        variables: {
          cloudflareTunnelHost: {
            default: "api.poscemilan.example",
          },
        },
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
      "/api/shifts/open": { post: { summary: "Open cashier shift" } },
      "/api/shifts/close": { post: { summary: "Close cashier shift" } },
      "/api/shifts/current": { get: { summary: "Get current cashier shift" } },
      "/api/sales": { post: { summary: "Create POS sale with idempotency key" } },
      "/api/sales/{id}": { get: { summary: "Get sale detail" } },
      "/api/inventory/balances": { get: { summary: "List inventory balances by outlet" } },
      "/api/inventory/movements": { get: { summary: "List stock movements by outlet" } },
      "/api/inventory/adjustments": { post: { summary: "Create opening, purchase, or stock adjustment movement" } },
      "/api/waste-adjustments": { get: { summary: "List waste adjustments" }, post: { summary: "Create waste/shrinkage adjustment" } },
      "/api/waste-adjustments/{id}/approve": { post: { summary: "Approve or reject pending waste adjustment" } },
      "/api/sync/push": { post: { summary: "Push offline Flutter transactions" } },
      "/api/sync/pull": { get: { summary: "Pull changed master data and balances" } },
      "/api/reports/sales-summary": { get: { summary: "Sales summary report" } },
      "/api/reports/inventory-summary": { get: { summary: "Inventory summary report" } },
      "/api/reports/waste-summary": { get: { summary: "Waste summary report" } },
      "/api/openapi.json": { get: { summary: "OpenAPI document" } },
    },
  });
}
