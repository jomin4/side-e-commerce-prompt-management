import { HttpError } from "./http.js";

export const GROUP_IDS = ["sourcing", "listing", "marketing", "cs", "ops"];

const LIMITS = { title: 200, body: 50000, note: 5000, tag: 50, tags: 30, versions: 20 };

export function toPrompt(r) {
  return {
    id: r.id,
    title: r.title,
    group: r.grp,
    body: r.body,
    tags: r.tags || [],
    note: r.note || "",
    favorite: !!r.favorite,
    uses: Number(r.uses) || 0,
    lastUsedAt: r.last_used_at == null ? null : Number(r.last_used_at),
    lastValues: r.last_values || {},
    versions: r.versions || [],
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  };
}

const bad = field => new HttpError(400, `invalid_${field}`);
const isObj = v => v && typeof v === "object" && !Array.isArray(v);
const str = (v, max, field) => {
  if (typeof v !== "string" || v.length > max) throw bad(field);
  return v;
};
const ts = (v, field) => {
  if (!Number.isFinite(v) || v < 0) throw bad(field);
  return Math.floor(v);
};

// Each editable field: its column, and how to validate the incoming value.
const FIELDS = {
  title: ["title", v => { const t = str(v, LIMITS.title, "title").trim(); if (!t) throw bad("title"); return t; }],
  group: ["grp", v => { if (!GROUP_IDS.includes(v)) throw bad("group"); return v; }],
  body: ["body", v => { if (!str(v, LIMITS.body, "body").trim()) throw bad("body"); return v; }],
  note: ["note", v => str(v, LIMITS.note, "note")],
  tags: ["tags", v => {
    if (!Array.isArray(v) || v.length > LIMITS.tags) throw bad("tags");
    return JSON.stringify(v.map(t => str(t, LIMITS.tag, "tags").trim()).filter(Boolean));
  }, "jsonb"],
  favorite: ["favorite", v => { if (typeof v !== "boolean") throw bad("favorite"); return v; }],
  uses: ["uses", v => { if (!Number.isInteger(v) || v < 0) throw bad("uses"); return v; }],
  lastUsedAt: ["last_used_at", v => (v == null ? null : ts(v, "lastUsedAt"))],
  lastValues: ["last_values", v => {
    if (!isObj(v)) throw bad("lastValues");
    const out = {};
    for (const [k, val] of Object.entries(v)) out[str(k, 100, "lastValues")] = str(val, LIMITS.body, "lastValues");
    return JSON.stringify(out);
  }, "jsonb"],
  versions: ["versions", v => {
    if (!Array.isArray(v)) throw bad("versions");
    return JSON.stringify(v.slice(0, LIMITS.versions).map(x => {
      if (!isObj(x)) throw bad("versions");
      return { body: str(x.body, LIMITS.body, "versions"), savedAt: ts(x.savedAt, "versions") };
    }));
  }, "jsonb"],
  updatedAt: ["updated_at", v => ts(v, "updatedAt")],
};

// Turns a request body into [column, value, cast] triples, rejecting unknown or invalid fields.
export function columns(input, { require = [] } = {}) {
  if (!isObj(input)) throw new HttpError(400, "bad_body");
  for (const f of require) if (input[f] === undefined) throw bad(f);
  const out = [];
  for (const [key, value] of Object.entries(input)) {
    if (key === "id" || key === "createdAt" || key === "incrementUses") continue;
    const spec = FIELDS[key];
    if (!spec) throw new HttpError(400, `unknown_field_${key}`);
    out.push([spec[0], spec[1](value), spec[2]]);
  }
  return out;
}

export function checkId(id) {
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw bad("id");
  return id;
}
