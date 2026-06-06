import { hashPassword, verifyPassword } from "better-auth/crypto";
import { z } from "zod";
import { userRepository } from "@/backend/repositories/user-repository";
import { writeAudit } from "@/lib/audit";
import { ApiError, handleRouteError, ok, parseJson } from "@/lib/http";
import { canManageRole, requireActor, requirePermission } from "@/lib/rbac";

export const runtime = "nodejs";

const updateUserPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Password lama wajib diisi"),
    newPassword: z.string().min(8, "Password baru minimal 8 karakter"),
    confirmPassword: z.string().min(8, "Konfirmasi password minimal 8 karakter"),
  })
  .refine((body) => body.newPassword === body.confirmPassword, {
    message: "Konfirmasi password baru tidak sama",
    path: ["confirmPassword"],
  });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "users", "edit");
    const { id } = await params;
    const body = await parseJson(request, updateUserPasswordSchema);

    const [target] = await userRepository.findById(id, actor.organizationId);
    if (!target) {
      throw new ApiError("NOT_FOUND", "User tidak ditemukan", 404);
    }

    const isSelf = id === actor.id;
    if (!isSelf && !canManageRole(actor.role, target.role)) {
      throw new ApiError("FORBIDDEN", "Role hanya boleh mengubah password user di bawahnya", 403);
    }

    const accountUserId = isSelf ? id : actor.id;
    const [credential] = await userRepository.findCredentialAccount(accountUserId);
    if (!credential?.password) {
      throw new ApiError("BAD_REQUEST", "Akun tidak memiliki password credential", 400);
    }

    const validPassword = await verifyPassword({ hash: credential.password, password: body.currentPassword });
    if (!validPassword) {
      throw new ApiError("BAD_REQUEST", isSelf ? "Password lama salah" : "Password admin salah", 400);
    }

    await userRepository.updatePassword(id, await hashPassword(body.newPassword));

    await writeAudit({
      actor,
      action: isSelf ? "user.password.change" : "user.password.reset",
      entityType: "user",
      entityId: id,
      after: { id, email: target.email, self: isSelf },
      request,
    });

    return ok({ id });
  } catch (error) {
    return handleRouteError(error);
  }
}
