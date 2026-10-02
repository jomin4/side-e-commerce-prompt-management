import { route, send, body } from "../server/http.js";
import { checkPassword, passwordSet, startSession } from "../server/auth.js";

const pause = ms => new Promise(r => setTimeout(r, ms));

export default route(["POST"], async (req, res) => {
  if (!passwordSet()) return send(res, 503, { error: "no_password" });
  if (!checkPassword(body(req).password)) {
    await pause(700); // slows down password guessing
    return send(res, 401, { error: "unauthorized" });
  }
  startSession(res);
  send(res, 200, { ok: true });
}, { auth: false });
