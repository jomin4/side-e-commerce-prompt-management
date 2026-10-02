import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "./lib/api.js";

// Loads prompts from the API and applies writes optimistically.
// A failed write reloads the list from the server, then rethrows so the caller can tell the user.
export function useStore(onUnauthorized) {
  const [prompts, setPrompts] = useState([]);
  const [status, setStatus] = useState("loading");
  const authRef = useRef(onUnauthorized);
  authRef.current = onUnauthorized;

  const fail = useCallback(e => {
    if (e.code === "unauthorized") authRef.current();
    return e;
  }, []);

  const reload = useCallback(async () => {
    try {
      const { prompts } = await api.list();
      setPrompts(prompts);
      setStatus("ready");
    } catch (e) {
      fail(e);
      setStatus(e.code === "no_db" ? "no_db" : "error");
    }
  }, [fail]);

  useEffect(() => { reload(); }, [reload]);

  const write = useCallback(async (id, body, mode) => {
    setPrompts(ps => {
      if (mode === "delete") return ps.filter(p => p.id !== id);
      const i = ps.findIndex(p => p.id === id);
      if (mode === "set" || i < 0) return [...ps.filter(p => p.id !== id), { id, ...body }];
      const { incrementUses, ...rest } = body;
      const next = ps.slice();
      next[i] = { ...ps[i], ...rest, ...(incrementUses ? { uses: (ps[i].uses || 0) + 1 } : {}) };
      return next;
    });
    try {
      if (mode === "set") await api.create({ id, ...body });
      else if (mode === "update") await api.update(id, body);
      else await api.remove(id);
    } catch (e) {
      fail(e);
      if (e.code !== "unauthorized") reload();
      throw e;
    }
  }, [fail, reload]);

  return { prompts, status, write, reload };
}
