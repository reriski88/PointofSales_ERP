import { eq, and, count } from "drizzle-orm";
import { db } from "@/db";
import { outlet, user, sku, tenantSubscription, subscriptionPlan } from "@/db/schema";
import { ApiError } from "@/lib/http";
import type { Actor } from "@/lib/rbac";

export async function enforceOutletLimit(actor: Actor) {
  if (actor.role === "superadmin") return;
  const limit = await getPlanLimit(actor.organizationId, "maxOutlets");
  if (!limit || limit >= 999) return; // null = no subscription, >= 999 = unlimited

  const [current] = await db
    .select({ value: count() })
    .from(outlet)
    .where(
      and(eq(outlet.organizationId, actor.organizationId), eq(outlet.isActive, true)),
    );

  if ((current?.value ?? 0) >= limit) {
    throw new ApiError(
      "FORBIDDEN",
      `Batas maksimal outlet (${limit}) untuk plan Anda sudah tercapai. Upgrade plan untuk menambah outlet.`,
      403,
    );
  }
}

export async function enforceUserLimit(actor: Actor) {
  if (actor.role === "superadmin") return;
  const limit = await getPlanLimit(actor.organizationId, "maxUsers");
  if (!limit || limit >= 999) return; // null = no subscription, >= 999 = unlimited

  const [current] = await db
    .select({ value: count() })
    .from(user)
    .where(
      and(eq(user.organizationId, actor.organizationId), eq(user.isActive, true)),
    );

  if ((current?.value ?? 0) >= limit) {
    throw new ApiError(
      "FORBIDDEN",
      `Batas maksimal user (${limit}) untuk plan Anda sudah tercapai. Upgrade plan untuk menambah user.`,
      403,
    );
  }
}

export async function enforceSkuLimit(actor: Actor) {
  if (actor.role === "superadmin") return;
  const limit = await getPlanLimit(actor.organizationId, "maxSkus");
  if (!limit || limit >= 999) return; // null = no subscription, >= 999 = unlimited

  const [current] = await db
    .select({ value: count() })
    .from(sku)
    .where(eq(sku.organizationId, actor.organizationId));

  if ((current?.value ?? 0) >= limit) {
    throw new ApiError(
      "FORBIDDEN",
      `Batas maksimal SKU (${limit}) untuk plan Anda sudah tercapai. Upgrade plan untuk menambah produk.`,
      403,
    );
  }
}

async function getPlanLimit(organizationId: string, field: "maxOutlets" | "maxUsers" | "maxSkus") {
  const [sub] = await db
    .select({ [field]: subscriptionPlan[field] })
    .from(tenantSubscription)
    .innerJoin(subscriptionPlan, eq(subscriptionPlan.id, tenantSubscription.planId))
    .where(eq(tenantSubscription.organizationId, organizationId))
    .limit(1);

  if (!sub) return null;
  return (sub as Record<string, number>)[field] as number;
}
