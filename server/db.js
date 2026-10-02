import { neon } from "@neondatabase/serverless";

// Runs one SQL statement with $1..$n params and resolves to the result rows.
// Tests swap the runner for a local Postgres through setRunner().
let runner = null;
let schemaReady = null;

export function setRunner(fn) {
  runner = fn;
  schemaReady = null;
}

function getRunner() {
  if (runner) return runner;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw Object.assign(new Error("DATABASE_URL is not set"), { code: "NO_DB" });
  const sql = neon(url);
  runner = (text, params) => sql.query(text, params);
  return runner;
}

const SCHEMA = `
create table if not exists prompts (
  id           text primary key,
  title        text not null,
  grp          text not null,
  body         text not null,
  tags         jsonb not null default '[]',
  note         text not null default '',
  favorite     boolean not null default false,
  uses         integer not null default 0,
  last_used_at bigint,
  last_values  jsonb not null default '{}',
  versions     jsonb not null default '[]',
  created_at   bigint not null,
  updated_at   bigint not null
)`;

export async function query(text, params = []) {
  const run = getRunner();
  if (!schemaReady) schemaReady = run(SCHEMA, []).catch(e => { schemaReady = null; throw e; });
  await schemaReady;
  return run(text, params);
}
