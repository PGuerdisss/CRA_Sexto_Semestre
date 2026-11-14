const BACKEND_ORIGIN = "https://deploy-backend-5-semestre.onrender.com";

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
        },
      });
    }

    const incomingUrl = new URL(request.url);
    const rewrittenPath = incomingUrl.searchParams.get("__path");
    let backendPath = rewrittenPath
      ? rewrittenPath.startsWith("/")
        ? rewrittenPath
        : `/${rewrittenPath}`
      : incomingUrl.pathname.replace(/^\/api/, "") || "/";

    incomingUrl.searchParams.delete("__path");
    const query = incomingUrl.searchParams.toString();
    const targetUrl = `${BACKEND_ORIGIN}${backendPath}${query ? `?${query}` : ""}`;

    // Envia apenas os cabeçalhos necessários (sem Origin/Referer) para evitar 403 CORS no Spring Boot
    const forwardHeaders = new Headers();
    forwardHeaders.set("Accept", request.headers.get("accept") || "application/json");
    const contentType = request.headers.get("content-type");
    if (contentType) {
      forwardHeaders.set("Content-Type", contentType);
    }
    const auth = request.headers.get("authorization");
    if (auth) {
      forwardHeaders.set("Authorization", auth);
    }

    const method = request.method.toUpperCase();
    const hasBody = method !== "GET" && method !== "HEAD";
    const bodyBuffer = hasBody ? await request.arrayBuffer() : undefined;

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
      console.error("Erro no proxy Vercel -> Render:", err);
      return Response.json(
        {
          error: "Falha ao conectar ao servidor backend do CRA",
          details: err?.message || String(err),
        },
        { status: 502 }
      );
    }
  },
};
