import { z } from "zod";
import { userRepository } from "@/backend/repositories/user-repository";
import { handleRouteError, ok, parseJson } from "@/lib/http";
import { requireActor, requirePermission } from "@/lib/rbac";

export const runtime = "nodejs";

const updateProfileSchema = z.object({
  name: z.string().min(1).max(120),
});

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "profile", "view");
    return ok({
      id: actor.id,
      name: actor.name,
      email: actor.email,
      role: actor.role,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "profile", "edit");
    const body = await parseJson(request, updateProfileSchema);

    const [updated] = await userRepository.updateProfile(actor.id, body.name);

    return ok(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}
