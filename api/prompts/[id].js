import { route, send, body, HttpError } from "../../server/http.js";
import { query } from "../../server/db.js";
import { columns, checkId, toPrompt } from "../../server/prompts.js";

export default route(["PATCH", "DELETE"], async (req, res) => {
  const id = checkId(req.query.id);

  if (req.method === "DELETE") {
    await query("delete from prompts where id = $1", [id]);
    return send(res, 200, { ok: true });
  }

  const input = body(req);
  const cols = columns(input);
  const sets = cols.map((c, i) => `${c[0]} = $${i + 2}` + (c[2] === "jsonb" ? "::jsonb" : ""));
  if (input.incrementUses === true) sets.push("uses = uses + 1");
  if (!sets.length) throw new HttpError(400, "nothing_to_update");

  const rows = await query(
    `update prompts set ${sets.join(", ")} where id = $1 returning *`,
    [id, ...cols.map(c => c[1])]
  );
  if (!rows.length) throw new HttpError(404, "not_found");
  send(res, 200, { prompt: toPrompt(rows[0]) });
});
