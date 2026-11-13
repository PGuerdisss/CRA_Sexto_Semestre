const BACKEND_ORIGIN = "https://deploy-backend-5-semestre.onrender.com";

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
      },
    });
  }

  const incomingUrl = new URL(req.url);
  const backendPath = incomingUrl.pathname.replace(/^\/api/, "") || "/";
  const targetUrl = `${BACKEND_ORIGIN}${backendPath}${incomingUrl.search}`;

  // Encaminha apenas cabeçalhos necessários e omite Origin/Referer para evitar 403 CORS no Spring Boot
  const forwardHeaders = new Headers();
  forwardHeaders.set("Accept", req.headers.get("accept") || "application/json");
  const contentType = req.headers.get("content-type");
  if (contentType) {
    forwardHeaders.set("Content-Type", contentType);
  }
  const auth = req.headers.get("authorization");
  if (auth) {
    forwardHeaders.set("Authorization", auth);
  }

  const method = req.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const bodyBuffer = hasBody ? await req.arrayBuffer() : undefined;

  try {
    const upstream = await fetch(targetUrl, {
      method,
      headers: forwardHeaders,
      body: bodyBuffer && bodyBuffer.byteLength > 0 ? bodyBuffer : undefined,
    });

    const responseBytes = await upstream.arrayBuffer();
    const responseHeaders = new Headers();
    const resType = upstream.headers.get("content-type");
    if (resType) {
      responseHeaders.set("Content-Type", resType);
    }
    responseHeaders.set("Cache-Control", "no-store");

    return new Response(responseBytes, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (err) {
    return Response.json(
      {
        error: "Falha ao conectar ao servidor backend do CRA",
        details: err?.message || String(err),
      },
      { status: 502 }
    );
  }
};

export const config = {
  path: "/api/*",
};
