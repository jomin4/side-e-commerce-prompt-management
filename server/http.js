import { isAuthed } from "./auth.js";

export class HttpError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

export function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

export function body(req) {
  const b = req.body;
  if (b && typeof b === "object") return b;
  if (typeof b === "string" && b) {
    try { return JSON.parse(b); } catch { throw new HttpError(400, "bad_json"); }
  }
  return {};
}

// Wraps an API route: method check, session check, and one place that turns errors into JSON.
export function route(methods, fn, { auth = true } = {}) {
  return async (req, res) => {
    try {
      if (!methods.includes(req.method)) {
        res.setHeader("Allow", methods.join(", "));
        return send(res, 405, { error: "method_not_allowed" });
      }
      if (auth && !isAuthed(req)) return send(res, 401, { error: "unauthorized" });
      await fn(req, res);
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, { error: e.code });
      if (e && e.code === "NO_DB") return send(res, 503, { error: "no_db" });
      console.error(e);
      send(res, 500, { error: "server_error" });
    }
  };
}
