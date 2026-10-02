import { route, send } from "../server/http.js";
import { isAuthed, passwordSet } from "../server/auth.js";

export default route(["GET"], (req, res) => {
  send(res, 200, { authed: isAuthed(req), passwordSet: passwordSet() });
}, { auth: false });
