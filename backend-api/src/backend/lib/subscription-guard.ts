/**
 * Subscription Guard — thin wrapper around SubscriptionService.
 * Kept as plain functions for backward compatibility with requireActor().
 * Internally delegates to SubscriptionService (OOP).
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenantSubscription } from "@/db/schema";
import { ApiError } from "@/lib/http";
import type { Actor } from "@/lib/rbac";

type CachedSubscription = {
  value: typeof tenantSubscription.$inferSelect | null;
  expiresAt: number;
};

const cacheTtlMs = 60_000;
const subscriptionCache = getSubscriptionCache();

export async function requireActiveSubscription(actor: Actor) {
  if (actor.role === "superadmin") return;

  const subscription = await getSubscriptionForOrganization(actor.organizationId);

  if (!subscription) {
    throw new ApiError("SUBSCRIPTION_REQUIRED", "Organisasi belum memiliki langganan aktif. Hubungi IT Support.", 402);
  }

  const status = subscription.status;
  const now = new Date();

  if (status === "suspended") {
    throw new ApiError("SUBSCRIPTION_SUSPENDED", subscription.suspendedReason ?? "Langganan ditangguhkan. Hubungi IT Support.", 403);
  }

  if (status === "cancelled" || status === "expired") {
    throw new ApiError("SUBSCRIPTION_ENDED", "Langganan telah berakhir. Hubungi IT Support untuk perpanjangan.", 402);
  }

  if (status === "trial" && subscription.trialEndsAt && new Date(subscription.trialEndsAt) < now) {
    throw new ApiError("TRIAL_EXPIRED", "Masa uji coba telah berakhir. Hubungi IT Support untuk berlangganan.", 402);
  }

  if (status === "active" && new Date(subscription.currentPeriodEnd) < now) {
    const graceEnd = addDays(subscription.currentPeriodEnd, 7);
    if (now > graceEnd) {
      throw new ApiError("SUBSCRIPTION_EXPIRED", "Langganan telah berakhir dan masa tenggang habis. Hubungi IT Support.", 402);
    }
  }

  if (status === "grace_period") {
    const graceEnd = addDays(subscription.currentPeriodEnd, 7);
    if (now > graceEnd) {
      throw new ApiError("SUBSCRIPTION_EXPIRED", "Langganan telah berakhir dan masa tenggang habis. Hubungi IT Support.", 402);
    }
  }
}

export function invalidateSubscriptionCache(organizationId?: string) {
  if (organizationId) { subscriptionCache.delete(organizationId); }
  else { subscriptionCache.clear(); }
}

async function getSubscriptionForOrganization(organizationId: string) {
  const cached = subscriptionCache.get(organizationId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const [subscription] = await db
    .select()
    .from(tenantSubscription)
    .where(eq(tenantSubscription.organizationId, organizationId))
    .limit(1);

  const value = subscription ?? null;
  subscriptionCache.set(organizationId, { value, expiresAt: Date.now() + cacheTtlMs });
  return value;
}

function addDays(value: Date | string, days: number) {
  const d = new Date(value);
  d.setDate(d.getDate() + days);
  return d;
}

function getSubscriptionCache() {
  const key = "__pos_cemilan_subscription_cache__";
  const store = globalThis as typeof globalThis & { [key]?: Map<string, CachedSubscription> };
  store[key] ??= new Map<string, CachedSubscription>();
  return store[key];
}
