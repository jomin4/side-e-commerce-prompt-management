import { route, send, body, HttpError } from "../../server/http.js";
import { query } from "../../server/db.js";
import { columns, checkId, toPrompt } from "../../server/prompts.js";

export default route(["GET", "POST"], async (req, res) => {
  if (req.method === "GET") {
    const rows = await query("select * from prompts order by updated_at desc", []);
    return send(res, 200, { prompts: rows.map(toPrompt) });
  }

  const input = body(req);
  const id = checkId(input.id);
  const now = Date.now();
  const cols = columns(input, { require: ["title", "group", "body"] });
  const createdAt = Number.isFinite(input.createdAt) ? Math.floor(input.createdAt) : now;
  cols.push(["created_at", createdAt]);
  if (!cols.some(c => c[0] === "updated_at")) cols.push(["updated_at", now]);

  const names = ["id", ...cols.map(c => c[0])];
  const values = [id, ...cols.map(c => c[1])];
  const marks = ["$1", ...cols.map((c, i) => `$${i + 2}` + (c[2] === "jsonb" ? "::jsonb" : ""))];
  const rows = await query(
    `insert into prompts (${names.join(", ")}) values (${marks.join(", ")}) on conflict (id) do nothing returning *`,
    values
  );
  if (!rows.length) throw new HttpError(409, "exists");
  send(res, 201, { prompt: toPrompt(rows[0]) });
});
