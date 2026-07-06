import { organizationRepository } from "@/backend/repositories/organization-repository";
import { handleRouteError, ok } from "@/lib/http";
import { normalizeRoleAccess } from "@/lib/role-access";
import { requireActor } from "@/lib/rbac";
import { requireActiveSubscription } from "@/lib/subscription-guard";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request, { skipSubscriptionCheck: true });
    if (actor.role === "superadmin") {
      return ok({
        role: actor.role,
        permissions: {},
      });
    }

    // Login flow uses this endpoint to surface tenant subscription errors before redirecting.
    await requireActiveSubscription(actor);

    await organizationRepository.ensureRolePermissionsColumn();
    const [row] = await organizationRepository.findRolePermissions(actor.organizationId);
    const permissions = normalizeRoleAccess(row?.rolePermissions);

    return ok({
      role: actor.role,
      permissions: permissions[actor.role],
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
