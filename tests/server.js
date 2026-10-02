// Local stand-in for Vercel used by the tests: serves dist/ and routes /api/* to the real
// handler files, with an in-memory Postgres (PGlite) behind server/db.js.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { setRunner } from "../server/db.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const load = async rel => (await import(pathToFileURL(path.join(ROOT, rel)).href)).default;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };
export const TEST_PASSWORD = "test-pass";

export async function startServer(port = 0) {
  process.env.APP_PASSWORD = TEST_PASSWORD;
  const pg = new PGlite();
  const runner = (text, params) => pg.query(text, params).then(r => r.rows);
  setRunner(runner);

  const routes = {
    "/api/session": await load("api/session.js"),
    "/api/login": await load("api/login.js"),
    "/api/logout": await load("api/logout.js"),
    "/api/prompts": await load("api/prompts/index.js"),
  };
  const byId = await load("api/prompts/[id].js");

  // Switches that let tests simulate a missing password or database.
  const controls = {
    "/__test/nopassword": () => { delete process.env.APP_PASSWORD; },
    "/__test/password": () => { process.env.APP_PASSWORD = TEST_PASSWORD; },
    "/__test/nodb": () => { setRunner(null); delete process.env.DATABASE_URL; },
    "/__test/db": () => setRunner(runner),
    "/__test/reset": () => pg.query("delete from prompts").catch(() => {}),
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (controls[url.pathname]) { await controls[url.pathname](); return res.end("ok"); }

    if (url.pathname.startsWith("/api/")) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const raw = Buffer.concat(chunks).toString();
      req.body = raw && (req.headers["content-type"] || "").includes("json") ? JSON.parse(raw) : raw || undefined;
      req.query = Object.fromEntries(url.searchParams);
      let handler = routes[url.pathname];
      const m = url.pathname.match(/^\/api\/prompts\/([^/]+)$/);
      if (!handler && m) { handler = byId; req.query.id = decodeURIComponent(m[1]); }
      if (!handler) { res.statusCode = 404; return res.end("{}"); }
      return handler(req, res);
    }

    let file = path.join(ROOT, "dist", url.pathname === "/" ? "index.html" : url.pathname);
    if (!file.startsWith(path.join(ROOT, "dist")) || !fs.existsSync(file)) file = path.join(ROOT, "dist", "index.html");
    res.setHeader("Content-Type", TYPES[path.extname(file)] || "application/octet-stream");
    fs.createReadStream(file).pipe(res);
  });

  await new Promise(r => server.listen(port, r));
  return { server, port: server.address().port, pg };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { port } = await startServer(Number(process.env.PORT || 5199));
  console.log(`test server on http://localhost:${port}`);
}
