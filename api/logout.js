import { route, send } from "../server/http.js";
import { endSession } from "../server/auth.js";

export default route(["POST"], (req, res) => {
  endSession(res);
  send(res, 200, { ok: true });
}, { auth: false });
