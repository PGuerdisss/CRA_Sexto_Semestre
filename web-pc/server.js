const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const PORT = process.env.PORT || 3000;
const BACKEND_HOST = "deploy-backend-5-semestre.onrender.com";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  // CORS headers for local requests
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Accept"
  );

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Proxy requests starting with /api/ to https://deploy-backend-5-semestre.onrender.com
  if (req.url.startsWith("/api/")) {
    const targetPath = req.url.replace(/^\/api/, "");
    const headers = {
      host: BACKEND_HOST,
      accept: req.headers["accept"] || "application/json",
    };

    if (req.headers["content-type"]) {
      headers["content-type"] = req.headers["content-type"];
    }
    if (req.headers["authorization"]) {
      headers["authorization"] = req.headers["authorization"];
    }

    const bodyChunks = [];
    req.on("data", (chunk) => bodyChunks.push(chunk));
    req.on("end", () => {
      const bodyBuffer = Buffer.concat(bodyChunks);
      if (bodyBuffer.length > 0) {
        headers["content-length"] = bodyBuffer.length;
      }

      const proxyReq = https.request(
        {
          hostname: BACKEND_HOST,
          port: 443,
          path: targetPath,
          method: req.method,
          headers,
          timeout: 60000,
        },
        (proxyRes) => {
          res.writeHead(proxyRes.statusCode || 500, {
            "Content-Type":
              proxyRes.headers["content-type"] || "application/json",
            "Access-Control-Allow-Origin": "*",
          });
          proxyRes.pipe(res);
        }
      );

      proxyReq.on("error", (err) => {
        console.error("Erro no proxy para o backend:", err.message);
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Falha ao conectar com o servidor do CRA",
            details: err.message,
          })
        );
      });

      if (bodyBuffer.length > 0) {
        proxyReq.write(bodyBuffer);
      }
      proxyReq.end();
    });
    return;
  }

  // Serve static files from web-pc/
  let cleanUrl = req.url.split("?")[0];
  if (cleanUrl === "/" || cleanUrl === "" || cleanUrl === "/pc" || cleanUrl === "/mobile" || cleanUrl === "/celular") {
    cleanUrl = "/index.html";
  }

  const filePath = path.join(__dirname, cleanUrl);
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Arquivo não encontrado");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(content);
  });
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log("=========================================================");
  console.log("  CRA DESKTOP / WEB PC - CHILD RESCUE ALERT");
  console.log(`  Rodando em: ${url}`);
  console.log("  Sincronizado em tempo real com o App Mobile!");
  console.log("=========================================================");

  // Abre automaticamente no navegador padrão no Windows
  if (process.platform === "win32" && !process.env.NO_OPEN) {
    exec(`start "" "${url}"`);
  }
});

