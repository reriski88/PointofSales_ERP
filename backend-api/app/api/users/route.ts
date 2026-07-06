import { userRepository } from "@/backend/repositories/user-repository";
import type { AppRole } from "@/db/schema";
import { auth } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { ApiError, created, handleRouteError, ok, parseJson } from "@/lib/http";
import { accessibleOutletIds, canManageRole, requireActor, requirePermission, type Actor } from "@/lib/rbac";
import { enforceUserLimit } from "@/lib/subscription-limits";
import { createUserSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "users", "view");
    const visibleOutletIds =
      actor.role === "owner" ? null : new Set(await accessibleOutletIds(actor));
    const rows = await userRepository.findManyWithOutlets(actor.organizationId);
    const manageableRows = rows.filter((row) => row.id === actor.id || canManageRole(actor.role, row.role));
    if (!visibleOutletIds) {
      return ok(manageableRows);
    }
    const visibleRows = manageableRows
      .map((row) => ({
        ...row,
        outlets: row.outlets.filter((item) => visibleOutletIds.has(item.outletId)),
      }))
      .filter((row) => row.id === actor.id || (row.role !== "owner" && row.outlets.length > 0));
    return ok(visibleRows);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "users", "create");
    await enforceUserLimit(actor);
    const body = await parseJson(request, createUserSchema);
    await assertUserCreateAllowed(actor, body.role, body.outletIds);

    const signUp = await auth.api.signUpEmail({
      body: {
        name: body.name,
        email: body.email,
        image: body.image ?? undefined,
        password: body.password,
      },
    });

    const result = await userRepository.completeCreatedUser(
      signUp.user.id,
      {
        role: body.role,
        isActive: true,
        image: body.image ?? null,
        organizationId: actor.organizationId,
        updatedAt: new Date(),
      },
      body.outletIds,
    );

    await writeAudit({
      actor,
      action: "user.create",
      entityType: "user",
      entityId: result.id,
      after: {
        id: result.id,
        email: result.email,
        role: result.role,
        outletIds: body.outletIds,
      },
      request,
    });

    return created(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

async function assertUserCreateAllowed(
  actor: Actor,
  targetRole: AppRole,
  outletIds: string[],
) {
  if (!canManageRole(actor.role, targetRole)) {
    throw new ApiError("FORBIDDEN", "Role hanya boleh membuat user dengan role di bawahnya", 403);
  }

  if (actor.role !== "owner" && outletIds.length === 0) {
    throw new ApiError("BAD_REQUEST", "Pilih minimal satu outlet sesuai akses Admin Outlet", 400);
  }

  if (!outletIds.length) {
    return;
  }

  const validOutletIds =
    actor.role === "owner"
      ? await outletIdsInOrganization(outletIds, actor.organizationId)
      : new Set((await accessibleOutletIds(actor)).filter((id) => outletIds.includes(id)));

  for (const outletId of outletIds) {
    if (!validOutletIds.has(outletId)) {
      throw new ApiError("FORBIDDEN", "Outlet user harus sesuai akses pembuat", 403);
    }
  }
}

async function outletIdsInOrganization(outletIds: string[], organizationId: string) {
  const rows = await userRepository.findOutletIdsInOrganization(outletIds, organizationId);
  return new Set(rows.map((row) => row.id));
}
