import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer, TEST_PASSWORD } from "./server.js";

let srv, base, cookie = "";

before(async () => {
  srv = await startServer(0);
  base = `http://localhost:${srv.port}`;
});
after(async () => { srv.server.close(); await srv.pg.close(); });

async function call(method, path, body, { auth = true } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body ? { "content-type": "application/json" } : {}), ...(auth && cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

const sample = (id, extra = {}) => ({
  id, title: "1688 검색어 변환", group: "sourcing", body: "{{상품명}} 검색어", tags: ["1688"], note: "",
  favorite: false, uses: 0, versions: [], lastValues: {}, createdAt: 1, updatedAt: 2, ...extra,
});

test("세션: 로그인 전에는 authed=false, 비밀번호 설정됨", async () => {
  const { status, data } = await call("GET", "/api/session", null, { auth: false });
  assert.equal(status, 200);
  assert.deepEqual(data, { authed: false, passwordSet: true });
});

test("로그인 없이 프롬프트 API 접근 → 401", async () => {
  assert.equal((await call("GET", "/api/prompts", null, { auth: false })).status, 401);
  assert.equal((await call("POST", "/api/prompts", sample("x"), { auth: false })).status, 401);
});

test("틀린 비밀번호 → 401, 맞는 비밀번호 → 세션 쿠키", async () => {
  assert.equal((await call("POST", "/api/login", { password: "nope" }, { auth: false })).status, 401);
  const ok = await call("POST", "/api/login", { password: TEST_PASSWORD });
  assert.equal(ok.status, 200);
  assert.match(cookie, /^pl_session=/);
  assert.equal((await call("GET", "/api/session")).data.authed, true);
});

test("생성 → 목록 조회, 같은 id 재생성 → 409", async () => {
  const created = await call("POST", "/api/prompts", sample("p-1"));
  assert.equal(created.status, 201);
  assert.equal(created.data.prompt.group, "sourcing");
  assert.equal((await call("POST", "/api/prompts", sample("p-1"))).status, 409);
  const list = await call("GET", "/api/prompts");
  assert.deepEqual(list.data.prompts.map(p => p.id), ["p-1"]);
});

test("입력 검증: 잘못된 카테고리·빈 본문·모르는 필드·잘못된 id → 400", async () => {
  assert.equal((await call("POST", "/api/prompts", sample("p-2", { group: "nope" }))).status, 400);
  assert.equal((await call("POST", "/api/prompts", sample("p-3", { body: "   " }))).status, 400);
  assert.equal((await call("PATCH", "/api/prompts/p-1", { hack: 1 })).status, 400);
  assert.equal((await call("POST", "/api/prompts", sample("bad id!"))).status, 400);
});

test("사용 횟수는 서버에서 1씩 증가, lastValues는 합치지 않고 통째로 교체", async () => {
  await call("PATCH", "/api/prompts/p-1", { incrementUses: true, lastValues: { 상품명: "집게", 스펙: "실리콘" }, lastUsedAt: 5 });
  const r = await call("PATCH", "/api/prompts/p-1", { incrementUses: true, lastValues: { 상품명: "국자" } });
  assert.equal(r.data.prompt.uses, 2);
  assert.deepEqual(r.data.prompt.lastValues, { 상품명: "국자" });
});

test("수정 기록은 최대 20개만 저장", async () => {
  const versions = Array.from({ length: 25 }, (_, i) => ({ body: `v${i}`, savedAt: i }));
  const r = await call("PATCH", "/api/prompts/p-1", { versions });
  assert.equal(r.data.prompt.versions.length, 20);
});

test("없는 프롬프트 수정 → 404, 삭제 후 목록에서 사라짐", async () => {
  assert.equal((await call("PATCH", "/api/prompts/nope", { favorite: true })).status, 404);
  assert.equal((await call("DELETE", "/api/prompts/p-1")).status, 200);
  assert.deepEqual((await call("GET", "/api/prompts")).data.prompts, []);
});

test("허용하지 않는 메서드 → 405", async () => {
  assert.equal((await call("PUT", "/api/prompts", {})).status, 405);
});

test("APP_PASSWORD 미설정 → 로그인 503, DB 미연결 → 503 no_db", async () => {
  await fetch(base + "/__test/nopassword");
  assert.equal((await call("POST", "/api/login", { password: "x" }, { auth: false })).status, 503);
  await fetch(base + "/__test/password");
  await fetch(base + "/__test/nodb");
  const r = await call("GET", "/api/prompts");
  assert.deepEqual([r.status, r.data.error], [503, "no_db"]);
  await fetch(base + "/__test/db");
});

test("로그아웃 → 세션 해제", async () => {
  await call("POST", "/api/logout");
  assert.equal((await call("GET", "/api/session")).data.authed, false);
});
