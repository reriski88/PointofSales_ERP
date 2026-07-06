import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptionPlan } from "@/db/schema";
import { handleRouteError, ok, ApiError, parseJson } from "@/lib/http";
import { requireActor } from "@/lib/rbac";
import { z } from "zod";

export const runtime = "nodejs";

const updatePlanSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  priceMonthly: z.coerce.number().min(0).optional(),
  priceYearly: z.coerce.number().min(0).optional(),
  maxOutlets: z.coerce.number().int().min(1).optional(),
  maxUsers: z.coerce.number().int().min(1).optional(),
  maxSkus: z.coerce.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor(request);
    if (actor.role !== "superadmin") throw new ApiError("FORBIDDEN", "", 403);
    const { id } = await params;
    const body = await parseJson(request, updatePlanSchema);
    const values: Partial<typeof subscriptionPlan.$inferInsert> = { updatedAt: new Date() };
    if (body.name !== undefined) values.name = body.name;
    if (body.priceMonthly !== undefined) values.priceMonthly = body.priceMonthly.toFixed(2);
    if (body.priceYearly !== undefined) values.priceYearly = body.priceYearly.toFixed(2);
    if (body.maxOutlets !== undefined) values.maxOutlets = body.maxOutlets;
    if (body.maxUsers !== undefined) values.maxUsers = body.maxUsers;
    if (body.maxSkus !== undefined) values.maxSkus = body.maxSkus;
    if (body.isActive !== undefined) values.isActive = body.isActive;

    const [updated] = await db.update(subscriptionPlan).set(values).where(eq(subscriptionPlan.id, id)).returning();
    if (!updated) throw new ApiError("NOT_FOUND", "Plan tidak ditemukan", 404);
    return ok(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}
