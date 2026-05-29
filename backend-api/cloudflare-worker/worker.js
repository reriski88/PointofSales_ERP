const TARGET_KEY = "current-url";

const worker = {
  async fetch(request, env) {
    const targetBaseUrl = await getTargetBaseUrl(env);

    if (!targetBaseUrl) {
      return json(
        {
          error: "TARGET_NOT_CONFIGURED",
          message:
            "Tunnel target belum diisi. Jalankan npm run dev:public dari backend agar worker mendapat URL trycloudflare terbaru.",
        },
        503,
      );
    }

    const incomingUrl = new URL(request.url);

    if (incomingUrl.pathname === "/__target") {
      return json({ target: targetBaseUrl });
    }

    const targetUrl = new URL(targetBaseUrl);
    targetUrl.pathname = incomingUrl.pathname;
    targetUrl.search = incomingUrl.search;

    const headers = new Headers(request.headers);
    headers.set("x-forwarded-host", incomingUrl.host);
    headers.set("x-forwarded-proto", "https");
    headers.delete("host");

    const upstreamRequest = new Request(targetUrl.toString(), {
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      headers,
      method: request.method,
      redirect: "manual",
    });

    const upstreamResponse = await fetch(upstreamRequest);
    const responseHeaders = rewriteResponseHeaders(
      upstreamResponse.headers,
      targetUrl,
      incomingUrl,
    );

    return new Response(upstreamResponse.body, {
      headers: responseHeaders,
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
    });
  },
};

export default worker;

async function getTargetBaseUrl(env) {
  const key = env.TUNNEL_TARGET_KEY || TARGET_KEY;
  const kvTarget = env.TUNNEL_TARGETS ? await env.TUNNEL_TARGETS.get(key) : null;
  return normalizeTargetUrl(kvTarget || env.FALLBACK_TARGET_URL);
}

function normalizeTargetUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    url.pathname = "";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function rewriteResponseHeaders(headers, targetUrl, incomingUrl) {
  const nextHeaders = new Headers(headers);
  const location = nextHeaders.get("location");

  if (location) {
    const rewrittenLocation = rewriteLocation(location, targetUrl, incomingUrl);
    nextHeaders.set("location", rewrittenLocation);
  }

  const setCookie = nextHeaders.get("set-cookie");
  if (setCookie) {
    const targetHost = escapeRegExp(targetUrl.hostname);
    nextHeaders.set(
      "set-cookie",
      setCookie.replace(new RegExp(`;?\\s*Domain=${targetHost}`, "gi"), ""),
    );
  }

  return nextHeaders;
}

function rewriteLocation(location, targetUrl, incomingUrl) {
  try {
    const nextLocation = new URL(location, targetUrl);
    if (nextLocation.origin === targetUrl.origin) {
      nextLocation.protocol = incomingUrl.protocol;
      nextLocation.host = incomingUrl.host;
    }
    return nextLocation.toString();
  } catch {
    return location;
  }
}

function json(body, status = 200) {
  return Response.json(body, {
    headers: {
      "cache-control": "no-store",
    },
    status,
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
