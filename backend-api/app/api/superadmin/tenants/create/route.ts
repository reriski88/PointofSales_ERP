import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { organization, tenantSubscription, subscriptionPlan, outlet, user, userOutlet, unit } from "@/db/schema";
import { ok, handleRouteError, ApiError, parseJson } from "@/lib/http";
import { requireActor } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";

const DEFAULT_UNITS = [
  { name: "Pcs", code: "PCS", kind: "count" as const, toBaseFactor: "1" },
  { name: "Pack", code: "PACK", kind: "package" as const, toBaseFactor: "1" },
  { name: "Dus", code: "DUS", kind: "package" as const, toBaseFactor: "1" },
  { name: "Lusin", code: "LSN", kind: "count" as const, toBaseFactor: "1" },
  { name: "Gram", code: "GR", kind: "weight" as const, toBaseFactor: "1" },
  { name: "Kilogram", code: "KG", kind: "weight" as const, toBaseFactor: "1000" },
  { name: "Ons", code: "ONS", kind: "weight" as const, toBaseFactor: "100" },
  { name: "Mililiter", code: "ML", kind: "weight" as const, toBaseFactor: "1" },
  { name: "Liter", code: "LTR", kind: "weight" as const, toBaseFactor: "1000" },
  { name: "Meter", code: "MTR", kind: "count" as const, toBaseFactor: "1" },
];

const createTenantSchema = z.object({
  tenantName: z.string().min(1, "Nama tenant wajib diisi").max(200),
  contactName: z.string().max(200).optional(),
  contactPhone: z.string().max(30).optional(),
  contactEmail: z.string().max(200).optional(),
  address: z.string().max(500).optional(),
  ownerEmail: z.string().email("Email owner tidak valid"),
  ownerPassword: z.string().min(8, "Password owner minimal 8 karakter"),
  planId: z.string().uuid("Plan ID harus berupa UUID yang valid"),
  billingCycle: z.enum(["monthly", "yearly"]).default("monthly"),
  trialDays: z.coerce.number().int().min(0).default(14),
});

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let ownerId: string | null = null;

  try {
    // 0. Auth
    const actor = await requireActor(request);
    if (actor.role !== "superadmin") {
      throw new ApiError("FORBIDDEN", "Hanya superadmin yang dapat membuat tenant", 403);
    }

    const body = await parseJson(request, createTenantSchema);

    // 0.1 Validate plan exists
    const [targetPlan] = await db.select().from(subscriptionPlan).where(eq(subscriptionPlan.id, body.planId)).limit(1);
    if (!targetPlan) {
      throw new ApiError("NOT_FOUND", "Plan langganan tidak ditemukan. Pilih plan yang tersedia.", 404);
    }

    // 1. Create user via Better Auth (OUTSIDE transaction)
    await auth.api.signUpEmail({
      body: {
        email: body.ownerEmail,
        password: body.ownerPassword,
        name: body.contactName || body.tenantName,
      },
    });

    // Lookup user ID after signUpEmail (Better Auth tidak return user)
    const [ownerUser] = await db.select().from(user).where(eq(user.email, body.ownerEmail)).limit(1);
    ownerId = ownerUser?.id ?? null;
    if (!ownerId) throw new ApiError("INTERNAL_ERROR", "Gagal membuat akun owner", 500);

    // 2. Transaction: create org, update user, subscription, outlet, units
    const result = await db.transaction(async (tx) => {
      const [org] = await tx
        .insert(organization)
        .values({
          name: body.tenantName,
          contactName: body.contactName,
          contactPhone: body.contactPhone,
          contactEmail: body.contactEmail,
          address: body.address,
        })
        .returning();

      await tx
        .update(user)
        .set({ role: "owner", isActive: true, organizationId: org.id, updatedAt: new Date() })
        .where(eq(user.id, ownerId!));

      const isTrial = body.trialDays > 0;
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + body.trialDays);
      const periodEnd = new Date();
      if (body.billingCycle === "yearly") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      else periodEnd.setMonth(periodEnd.getMonth() + 1);

      const [sub] = await tx
        .insert(tenantSubscription)
        .values({
          organizationId: org.id,
          planId: body.planId,
          status: isTrial ? "trial" : "active",
          trialEndsAt: isTrial ? trialEnd : null,
          currentPeriodStart: new Date(),
          currentPeriodEnd: periodEnd,
          billingCycle: body.billingCycle,
        })
        .returning();

      const [defaultOutlet] = await tx
        .insert(outlet)
        .values({
          organizationId: org.id,
          name: "Outlet Utama",
          code: "OUTLET-UTAMA",
        })
        .returning();

      await tx.insert(userOutlet).values({
        userId: ownerId!,
        outletId: defaultOutlet.id,
      });

      // Insert default units untuk user awam
      await tx.insert(unit).values(
        DEFAULT_UNITS.map((u) => ({
          organizationId: org.id,
          name: u.name,
          code: u.code,
          kind: u.kind,
          toBaseFactor: u.toBaseFactor,
        })),
      );

      return { org, sub, outlet: defaultOutlet };
    });

    await writeAudit({
      actor,
      organizationId: result.org.id,
      action: "tenant.create",
      entityType: "organization",
      entityId: result.org.id,
      after: {
        organization: result.org,
        ownerId: ownerId!,
        subscription: result.sub,
        outlet: result.outlet,
        plan: targetPlan,
      },
      request,
    });

    return ok({ success: true, tenantId: result.org.id });
  } catch (error) {
    if (ownerId) {
      await db.delete(user).where(eq(user.id, ownerId)).catch(() => {});
    }
    return handleRouteError(error);
  }
}
