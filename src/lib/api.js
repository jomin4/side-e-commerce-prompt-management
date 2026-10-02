async function call(method, path, body) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
    });
  } catch {
    throw Object.assign(new Error("network"), { code: "network" });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = res.status === 401 ? "unauthorized" : data.error || "request_failed";
    throw Object.assign(new Error(code), { code, status: res.status });
  }
  return data;
}

const path = id => `/api/prompts/${encodeURIComponent(id)}`;

export const api = {
  session: () => call("GET", "/api/session"),
  login: password => call("POST", "/api/login", { password }),
  logout: () => call("POST", "/api/logout"),
  list: () => call("GET", "/api/prompts"),
  create: prompt => call("POST", "/api/prompts", prompt),
  update: (id, patch) => call("PATCH", path(id), patch),
  remove: id => call("DELETE", path(id)),
};
