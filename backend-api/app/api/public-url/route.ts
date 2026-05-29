import { z } from "zod";
import { organizationRepository } from "@/backend/repositories/organization-repository";
import { ApiError, handleRouteError, ok, parseJson } from "@/lib/http";

export const runtime = "nodejs";

const updatePublicUrlSchema = z.object({
  publicApiUrl: z.string().url(),
});

export async function GET() {
  try {
    const [row] = await organizationRepository.findLatestPublicUrl();

    return ok({
      publicApiUrl: row?.publicApiUrl ?? null,
      updatedAt: row?.updatedAt ?? null,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertUpdateToken(request);
    const body = await parseJson(request, updatePublicUrlSchema);
    const updatedAt = new Date();

    const rows = await organizationRepository.updatePublicUrl(body.publicApiUrl, updatedAt);

    return ok({
      publicApiUrl: body.publicApiUrl,
      updatedAt,
      updatedOrganizations: rows.length,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

function assertUpdateToken(request: Request) {
  const expectedToken = process.env.PUBLIC_URL_UPDATE_TOKEN || process.env.BETTER_AUTH_SECRET;

  if (!expectedToken) {
    throw new ApiError("FORBIDDEN", "Public URL update token is not configured", 403);
  }

  const receivedToken = request.headers.get("x-public-url-update-token");
  if (receivedToken !== expectedToken) {
    throw new ApiError("UNAUTHORIZED", "Invalid public URL update token", 401);
  }
}
