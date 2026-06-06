import { hashPassword } from "better-auth/crypto";
import { userRepository } from "@/backend/repositories/user-repository";
import { writeAudit } from "@/lib/audit";
import { ApiError, handleRouteError, ok, parseJson } from "@/lib/http";
import { deleteReplacedImageObject } from "@/lib/local-image-storage";
import { accessibleOutletIds, canManageRole, requireActor, requirePermission } from "@/lib/rbac";
import { updateUserSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "users", "edit");
    const { id } = await params;
    const body = await parseJson(request, updateUserSchema);

    const [existing] = await userRepository.findById(id, actor.organizationId);

    if (!existing) {
      throw new ApiError("NOT_FOUND", "User not found", 404);
    }

    if (id === actor.id) {
      const updated = await userRepository.updateUserWithAccess(
        id,
        {
          name: body.name ?? existing.name,
          image: body.image !== undefined ? body.image : existing.image,
          updatedAt: new Date(),
        },
        undefined,
        null,
        body.password ? await hashPassword(body.password) : undefined,
      );

      await writeAudit({
        actor,
        action: "user.self_update",
        entityType: "user",
        entityId: id,
        before: existing,
        after: updated,
        request,
      });

      await deleteReplacedImageObject(existing.image, updated.image);

      return ok(updated);
    }

    const targetRole = body.role ?? existing.role;
    if (!canManageRole(actor.role, existing.role) || !canManageRole(actor.role, targetRole)) {
      throw new ApiError("FORBIDDEN", "Role hanya boleh mengelola user dengan role di bawahnya", 403);
    }

    const actorOutletIds = actor.role === "owner" ? null : new Set(await accessibleOutletIds(actor));
    if (actor.role !== "owner") {
      if (!actorOutletIds?.size) {
        throw new ApiError("FORBIDDEN", "Admin Outlet belum memiliki akses outlet", 403);
      }
      const [sharedAccess] = await userRepository.findSharedOutlet(id, [...actorOutletIds]);
      if (!sharedAccess) {
        throw new ApiError("FORBIDDEN", "User tidak berada pada outlet yang dapat dikelola", 403);
      }
      if (body.outletIds) {
        if (!body.outletIds.length) {
          throw new ApiError("BAD_REQUEST", "Pilih minimal satu outlet sesuai akses Admin Outlet", 400);
        }
        for (const outletId of body.outletIds) {
          if (!actorOutletIds.has(outletId)) {
            throw new ApiError("FORBIDDEN", "Outlet user harus sesuai akses Admin Outlet", 403);
          }
        }
      }
    }

    if (actor.role === "owner" && body.outletIds?.length) {
      const validOutlets = await userRepository.findOutletIdsInOrganization(body.outletIds, actor.organizationId);
      const validOutletIds = new Set(validOutlets.map((row) => row.id));
      for (const outletId of body.outletIds) {
        if (!validOutletIds.has(outletId)) {
          throw new ApiError("FORBIDDEN", "Outlet user harus berada dalam organisasi yang sama", 403);
        }
      }
    }

    if (body.email && body.email !== existing.email) {
      const [emailOwner] = await userRepository.findEmailOwner(body.email, id);

      if (emailOwner) {
        throw new ApiError("CONFLICT", "Email sudah dipakai user lain", 409);
      }
    }

    const updated = await userRepository.updateUserWithAccess(
      id,
      {
        name: body.name ?? existing.name,
        email: body.email ?? existing.email,
        image: body.image !== undefined ? body.image : existing.image,
        role: body.role ?? existing.role,
        isActive: targetRole === "owner" ? true : (body.isActive ?? existing.isActive),
        updatedAt: new Date(),
      },
      body.outletIds,
      actorOutletIds ? [...actorOutletIds] : null,
      body.password ? await hashPassword(body.password) : undefined,
    );

    await writeAudit({
      actor,
      action: "user.update",
      entityType: "user",
      entityId: id,
      before: existing,
      after: {
        ...updated,
        outletIds: body.outletIds,
      },
      request,
    });

    await deleteReplacedImageObject(existing.image, updated.image);

    return ok(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}
