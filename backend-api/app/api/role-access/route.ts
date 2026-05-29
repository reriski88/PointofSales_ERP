import { organizationRepository } from "@/backend/repositories/organization-repository";
import { handleRouteError, ok, parseJson } from "@/lib/http";
import {
  normalizeRoleAccess,
  roleAccessActions,
  roleAccessMenus,
  roleDescriptions,
  roleLabels,
} from "@/lib/role-access";
import { requireActor, requireMinimumRole } from "@/lib/rbac";
import { updateRoleAccessSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    requireMinimumRole(actor, "owner");
    await organizationRepository.ensureRolePermissionsColumn();

    const [row] = await organizationRepository.findRolePermissions(actor.organizationId);

    return ok({
      menus: roleAccessMenus,
      actions: roleAccessActions,
      roleLabels,
      roleDescriptions,
      permissions: normalizeRoleAccess(row?.rolePermissions),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await requireActor(request);
    requireMinimumRole(actor, "owner");
    await organizationRepository.ensureRolePermissionsColumn();
    const body = await parseJson(request, updateRoleAccessSchema);
    const permissions = normalizeRoleAccess(body.permissions);

    await organizationRepository.updateRolePermissions(actor.organizationId, permissions);

    return ok({
      menus: roleAccessMenus,
      actions: roleAccessActions,
      roleLabels,
      roleDescriptions,
      permissions,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
