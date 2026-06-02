import { healthRepository } from "@/backend/repositories/health-repository";
import { handleRouteError, ok } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    await healthRepository.ping();
    return ok({
      status: "ok",
      service: "pos-erp-backend",
      mode: process.env.VERCEL ? "production" : "development",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
