import { organizationRepository } from "@/backend/repositories/organization-repository";
import { handleRouteError, ok } from "@/lib/http";
import { normalizeRoleAccess } from "@/lib/role-access";
import { requireActor } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
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
