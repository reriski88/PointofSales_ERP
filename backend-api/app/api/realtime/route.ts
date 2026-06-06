import { handleRouteError } from "@/lib/http";
import { accessibleOutletIds, requireActor } from "@/lib/rbac";
import { subscribeRealtime, type RealtimeEvent } from "@/lib/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const allowedOutletIds = new Set(await accessibleOutletIds(actor));
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (payload: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        };
        const canReceive = (event: RealtimeEvent) =>
          event.organizationId === actor.organizationId &&
          (!event.outletId || allowedOutletIds.has(event.outletId));

        send({
          id: "connected",
          type: "realtime.connected",
          topics: [],
          createdAt: new Date().toISOString(),
        });

        const unsubscribe = subscribeRealtime((event) => {
          if (canReceive(event)) {
            send(event);
          }
        });
        const keepAlive = setInterval(() => {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        }, 25_000);
        const maxLifetime = setTimeout(() => {
          send({
            id: "reconnect",
            type: "realtime.reconnect",
            topics: [],
            createdAt: new Date().toISOString(),
          });
          abort();
        }, 240_000);
        const abort = () => {
          clearInterval(keepAlive);
          clearTimeout(maxLifetime);
          unsubscribe();
          try {
            controller.close();
          } catch {
            // Stream may already be closed by the client.
          }
        };

        request.signal.addEventListener("abort", abort, { once: true });
      },
    });

    return new Response(stream, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/event-stream; charset=utf-8",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
