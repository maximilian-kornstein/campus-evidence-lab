import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT } from "./build-static.mjs";

const types = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".pdf": "application/pdf",
  ".woff2": "font/woff2",
};

export function createSiteServer(dist = path.join(ROOT, "dist")) {
  const root = path.resolve(dist);
  return createServer(async (request, response) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "no-store");
    if (!["GET", "HEAD"].includes(request.method)) {
      response.writeHead(405, { Allow: "GET, HEAD" });
      response.end();
      return;
    }
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      if (pathname.includes("\0") || pathname.includes("\\")) throw new URIError("Invalid path");
      const relative = pathname.replace(/^\/+/, "");
      let file = path.resolve(root, relative || "index.html");
      if (!file.startsWith(`${root}${path.sep}`)) throw new URIError("Invalid path");
      let status = 200;
      try {
        if ((await stat(file)).isDirectory()) {
          if (!pathname.endsWith("/")) {
            const search = new URL(request.url, "http://localhost").search;
            response.writeHead(308, { Location: `${pathname}/${search}` });
            response.end();
            return;
          }
          file = path.join(file, "index.html");
        }
        if (!(await stat(file)).isFile()) throw new Error("Not a file");
        if (path.basename(file).startsWith("_")) throw new Error("Not a route");
      } catch {
        file = path.join(root, "404.html");
        status = 404;
      }
      const body = await readFile(file);
      response.writeHead(status, {
        "Content-Type": types[path.extname(file)] || "application/octet-stream",
        "Content-Length": body.byteLength,
      });
      response.end(request.method === "HEAD" ? undefined : body);
    } catch (error) {
      response.writeHead(error instanceof URIError ? 400 : 500);
      response.end(error instanceof URIError ? "Invalid request" : "Unable to serve page");
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 5173);
  const server = createSiteServer();
  server.listen(port, "0.0.0.0", () => console.log(`Kornstein Lab: http://localhost:${port}`));
  server.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
}
