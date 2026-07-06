import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "SUBSCRIPTION_REQUIRED"
  | "TRIAL_EXPIRED"
  | "SUBSCRIPTION_EXPIRED"
  | "SUBSCRIPTION_SUSPENDED"
  | "SUBSCRIPTION_ENDED"
  | "INTERNAL_ERROR";

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public status = 400,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function created<T>(data: T) {
  return ok(data, 201);
}

export type ListQuery = {
  limit?: number;
  offset?: number;
  page?: number;
  search?: string;
};

export function parseListQuery(searchParams: URLSearchParams, maxLimit = 500): ListQuery {
  const rawLimit = searchParams.get("limit");
  const rawPage = searchParams.get("page");
  const rawOffset = searchParams.get("offset");
  const search = searchParams.get("q")?.trim() || undefined;

  if (!rawLimit && !rawPage && !rawOffset && !search) return {};

  const parsedLimit = rawLimit ? Number(rawLimit) : 100;
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(Math.trunc(parsedLimit), 1), maxLimit) : 100;
  const parsedPage = rawPage ? Number(rawPage) : undefined;
  const page = parsedPage && Number.isFinite(parsedPage) ? Math.max(Math.trunc(parsedPage), 1) : undefined;
  const parsedOffset = rawOffset ? Number(rawOffset) : undefined;
  const offset = page ? (page - 1) * limit : parsedOffset && Number.isFinite(parsedOffset) ? Math.max(Math.trunc(parsedOffset), 0) : 0;

  return { limit, offset, page, search };
}

export async function parseJson<T>(request: Request, schema: ZodSchema<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError("BAD_REQUEST", "Request body must be valid JSON", 400);
  }
  return schema.parse(body);
}

export function handleRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "BAD_REQUEST",
          message: "Request validation failed",
          details: error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  if (error instanceof ApiError) {
    const response = NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.status },
    );
    // Tandai response subscription error dengan header khusus untuk client
    if (
      error.code === "SUBSCRIPTION_REQUIRED" ||
      error.code === "TRIAL_EXPIRED" ||
      error.code === "SUBSCRIPTION_EXPIRED" ||
      error.code === "SUBSCRIPTION_SUSPENDED" ||
      error.code === "SUBSCRIPTION_ENDED"
    ) {
      response.headers.set("X-Subscription-Error", "true");
    }
    return response;
  }

  console.error(error);
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected server error",
      },
    },
    { status: 500 },
  );
}
