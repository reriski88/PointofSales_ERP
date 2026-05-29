import { accessRepository } from "@/backend/repositories/access-repository";
import { organizationRepository } from "@/backend/repositories/organization-repository";
import type { AppRole } from "@/db/schema";
import { auth } from "@/lib/auth";
import { ApiError } from "@/lib/http";
import {
  normalizeRoleAccess,
  type RoleAccessAction,
  type RoleAccessMenuKey,
} from "@/lib/role-access";

export type Actor = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  organizationId: string;
};

export const roleRank: Record<AppRole, number> = {
  cashier: 10,
  warehouse: 20,
  auditor: 30,
  admin_outlet: 40,
  owner: 50,
};

export function canManageRole(actorRole: AppRole, targetRole: AppRole) {
  return roleRank[actorRole] > roleRank[targetRole];
}

export async function requireActor(request: Request): Promise<Actor> {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user?.id) {
    throw new ApiError("UNAUTHORIZED", "Authentication required", 401);
  }

  const [actor] = await accessRepository.findUserById(session.user.id);

  if (!actor) {
    throw new ApiError("UNAUTHORIZED", "User not found", 401);
  }

  if (!actor.isActive) {
    throw new ApiError("FORBIDDEN", "User is inactive", 403);
  }

  if (!actor.organizationId) {
    throw new ApiError("FORBIDDEN", "User is not assigned to an organization", 403);
  }

  return {
    id: actor.id,
    name: actor.name,
    email: actor.email,
    role: actor.role,
    organizationId: actor.organizationId,
  };
}

export function requireRole(actor: Actor, allowed: AppRole[]) {
  if (!allowed.includes(actor.role)) {
    throw new ApiError("FORBIDDEN", "Role is not allowed for this operation", 403);
  }
}

export function requireMinimumRole(actor: Actor, minimum: AppRole) {
  if (roleRank[actor.role] < roleRank[minimum]) {
    throw new ApiError("FORBIDDEN", "Insufficient role", 403);
  }
}

export async function actorHasPermission(
  actor: Actor,
  menu: RoleAccessMenuKey,
  action: RoleAccessAction,
) {
  await organizationRepository.ensureRolePermissionsColumn();
  const [row] = await accessRepository.findRolePermissions(actor.organizationId);
  const permissions = normalizeRoleAccess(row?.rolePermissions);
  return permissions[actor.role]?.[menu]?.includes(action) ?? false;
}

export async function requirePermission(
  actor: Actor,
  menu: RoleAccessMenuKey,
  action: RoleAccessAction,
) {
  if (!(await actorHasPermission(actor, menu, action))) {
    throw new ApiError("FORBIDDEN", "Role permission is not allowed for this operation", 403);
  }
}

export async function requireOutletAccess(actor: Actor, outletId: string) {
  if (actor.role === "owner") {
    return;
  }

  if (actor.role === "cashier") {
    const [targetOutlet] = await accessRepository.findOutletActiveState(outletId, actor.organizationId);

    if (!targetOutlet?.isActive) {
      throw new ApiError("FORBIDDEN", "Outlet is inactive", 403);
    }
  }

  const [access] = await accessRepository.findUserOutletAccess(actor.id, outletId);

  if (!access) {
    throw new ApiError("FORBIDDEN", "User does not have access to this outlet", 403);
  }
}

export async function accessibleOutletIds(actor: Actor) {
  if (actor.role === "owner") {
    const rows = await accessRepository.findOutletIdsByOrganization(actor.organizationId);
    return rows.map((row) => row.id);
  }

  const rows = await accessRepository.findActiveOutletIdsByUser(actor.id, actor.organizationId);
  return rows.map((row) => row.id);
}
