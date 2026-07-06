import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptionPlan } from "@/db/schema";
import { ok, created, handleRouteError, ApiError, parseJson } from "@/lib/http";
import { requireActor } from "@/lib/rbac";
import { z } from "zod";

export const runtime = "nodejs";

const planSchema = z.object({
  name: z.string().min(1).max(80),
  code: z.string().trim().min(1).max(40).regex(/^[a-z0-9_-]+$/),
  priceMonthly: z.coerce.number().min(0),
  priceYearly: z.coerce.number().min(0),
  maxOutlets: z.coerce.number().int().min(1),
  maxUsers: z.coerce.number().int().min(1),
  maxSkus: z.coerce.number().int().min(1),
  features: z.record(z.string(), z.unknown()).default({}),
  isActive: z.boolean().default(true),
});

const defaultPlans = [
  { name: "Starter", code: "starter", priceMonthly: "99000", priceYearly: "990000", maxOutlets: 1, maxUsers: 3, maxSkus: 50, features: { reports: true, mobileCashier: true } },
  { name: "Growth", code: "growth", priceMonthly: "249000", priceYearly: "2490000", maxOutlets: 3, maxUsers: 10, maxSkus: 250, features: { reports: true, mobileCashier: true, multiOutlet: true } },
  { name: "Scale", code: "scale", priceMonthly: "599000", priceYearly: "5990000", maxOutlets: 10, maxUsers: 50, maxSkus: 2000, features: { reports: true, mobileCashier: true, multiOutlet: true, prioritySupport: true } },
];

export async function GET(request: NextRequest) {
  try {
    const actor = await requireActor(request);
    if (actor.role !== "superadmin") throw new ApiError("FORBIDDEN", "", 403);
    await ensureDefaultPlans();
    const plans = await db.select().from(subscriptionPlan).orderBy(subscriptionPlan.priceMonthly);
    return ok(plans);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireActor(request);
    if (actor.role !== "superadmin") throw new ApiError("FORBIDDEN", "", 403);
    const body = await parseJson(request, planSchema);
    const [existing] = await db.select().from(subscriptionPlan).where(eq(subscriptionPlan.code, body.code)).limit(1);
    if (existing) throw new ApiError("CONFLICT", "Kode plan sudah digunakan", 409);
    const [plan] = await db.insert(subscriptionPlan).values({
      ...body,
      priceMonthly: body.priceMonthly.toFixed(2),
      priceYearly: body.priceYearly.toFixed(2),
    }).returning();
    return created(plan);
  } catch (error) {
    return handleRouteError(error);
  }
}

async function ensureDefaultPlans() {
  const [existing] = await db.select({ id: subscriptionPlan.id }).from(subscriptionPlan).limit(1);
  if (existing) return;
  await db.insert(subscriptionPlan).values(defaultPlans);
}
