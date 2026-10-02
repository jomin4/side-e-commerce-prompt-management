import { test, expect } from "@playwright/test";

const PASSWORD = "test-pass";
let page;

// One signed-in session walks through the whole app in order, like a real user would.
test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser, request }) => {
  await request.get("/__test/reset");
  const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"], viewport: { width: 1280, height: 860 } });
  page = await context.newPage();
});
test.afterAll(async () => { await page.context().close(); });

const rows = () => page.locator(".row .row-title");
const sidebar = label => page.locator(".sidebar .nav-item", { hasText: label });
const stored = async title => {
  const { prompts } = await (await page.request.get("/api/prompts")).json();
  return prompts.find(p => p.title === title);
};

async function addPrompt(title, body, { tags = "", group } = {}) {
  await page.getByRole("button", { name: "새 프롬프트" }).first().click();
  await page.fill("#m-name", title);
  await page.locator("#m-body").fill(body);
  if (tags) await page.fill("#m-tags", tags);
  if (group) await page.selectOption("#m-group", group);
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await expect(page.getByText("프롬프트를 추가했어요")).toBeVisible();
}

test("틀린 비밀번호는 거부하고 맞는 비밀번호로 들어간다", async () => {
  await page.goto("/");
  await page.fill("#password", "wrong");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByRole("alert")).toHaveText("비밀번호가 맞지 않아요.");
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.locator(".list-pane")).toContainText("상품 소싱 프롬프트가 없어요");
});

test("모달로 추가하면 서버에 저장되고 새로고침해도 남는다", async () => {
  await addPrompt("1688 검색어 변환", '"{{상품명}}" 1688 검색어 10개\n스펙: {{스펙}}', { tags: "1688, 중국소싱" });
  await addPrompt("견적 요청 메시지", "{{상품명}} {{수량}}개 견적 요청", { tags: "1688" });
  expect((await stored("1688 검색어 변환")).tags).toEqual(["1688", "중국소싱"]);
  await page.reload();
  await expect(rows()).toHaveText(["견적 요청 메시지", "1688 검색어 변환"]);
});

test("모달은 빈 제목·본문을 막고, Esc로 닫으면 작성 내용을 기억한다", async () => {
  await page.getByRole("button", { name: "새 프롬프트" }).first().click();
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await expect(page.locator(".modal")).toContainText("제목을 입력하세요");
  await page.fill("#m-name", "임시");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "새 프롬프트" }).first().click();
  await expect(page.locator("#m-name")).toHaveValue("임시");
  await page.getByRole("button", { name: "취소" }).click();
  await expect(page.locator(".modal")).toHaveCount(0);
});

test("변수를 채워 복사하면 클립보드에 치환된 본문이 들어가고 사용 기록이 저장된다", async () => {
  await page.locator(".row", { hasText: "1688 검색어 변환" }).click();
  await page.locator(".vars input").first().fill("실리콘 집게");
  await page.getByRole("button", { name: "복사", exact: true }).click();
  await expect(page.getByText("복사됨")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^"실리콘 집게" 1688/);
  await expect.poll(async () => (await stored("1688 검색어 변환")).uses).toBe(1);
  expect((await stored("1688 검색어 변환")).lastValues).toEqual({ 상품명: "실리콘 집게" });
});

test("비우기 후 복사하면 저장된 마지막 값도 비워진다", async () => {
  await page.getByRole("button", { name: "비우기" }).click();
  await page.getByRole("button", { name: "복사", exact: true }).click();
  await expect.poll(async () => (await stored("1688 검색어 변환")).lastValues).toEqual({});
});

test("즐겨찾기는 새로고침 후에도 유지되고 즐겨찾기 화면에 모인다", async () => {
  await page.locator(".detail-head").getByRole("button", { name: "즐겨찾기" }).click();
  await expect.poll(async () => (await stored("1688 검색어 변환")).favorite).toBe(true);
  await page.reload();
  await sidebar("즐겨찾기").click();
  await expect(rows()).toHaveText(["1688 검색어 변환"]);
  await sidebar("상품 소싱").click();
});

test("본문을 고치면 이전 버전이 기록되고 되돌릴 수 있다", async () => {
  await page.locator(".row", { hasText: "견적 요청 메시지" }).click();
  await page.getByRole("tab", { name: "편집" }).click();
  await page.locator("#f-body").press("Control+End");
  await page.keyboard.type("\n샘플 요청 포함");
  await page.locator("#f-body").press("Control+s");
  await expect(page.getByText("저장했어요")).toBeVisible();
  await expect.poll(async () => (await stored("견적 요청 메시지")).versions.length).toBe(1);
  await page.getByRole("tab", { name: "기록" }).click();
  await page.locator(".ver-head").nth(1).click();
  await page.getByRole("button", { name: "이 버전으로 되돌리기" }).click();
  await expect.poll(async () => (await stored("견적 요청 메시지")).body).not.toContain("샘플 요청");
});

test("편집 중 이동하면 확인창이 뜨고, 카테고리를 바꿔 저장하면 그 카테고리로 따라간다", async () => {
  await page.getByRole("tab", { name: "편집" }).click();
  await page.fill("#f-title", "고친 제목");
  await page.locator(".row", { hasText: "1688 검색어 변환" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "계속 편집" }).click();
  await expect(page.locator("#f-title")).toHaveValue("고친 제목");
  await page.fill("#f-title", "견적 요청 메시지");
  await page.selectOption("#f-cat", "marketing");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.locator(".crumb")).toContainText("마케팅");
  expect((await stored("견적 요청 메시지")).group).toBe("marketing");
  await sidebar("상품 소싱").click();
});

test("태그를 누르면 같은 태그만 걸러지고, 검색 결과가 없으면 안내한다", async () => {
  await page.locator(".row", { hasText: "1688 검색어 변환" }).click();
  await page.locator(".detail-head .tag", { hasText: "중국소싱" }).click();
  await expect(page.locator("#search")).toHaveValue("#중국소싱");
  await expect(rows()).toHaveText(["1688 검색어 변환"]);
  await page.fill("#search", "없는말");
  await expect(page.locator(".list-pane")).toContainText("맞는 프롬프트가 없어요");
  await page.fill("#search", "");
});

test("복제와 삭제가 서버에 반영된다", async () => {
  await page.locator(".row", { hasText: "1688 검색어 변환" }).click();
  await page.getByRole("button", { name: "더보기" }).click();
  await page.getByRole("menuitem", { name: "복제" }).click();
  await expect(page.locator(".detail-title")).toHaveText("1688 검색어 변환 사본");
  await page.getByRole("button", { name: "더보기" }).click();
  await page.getByRole("menuitem", { name: "삭제" }).click();
  await page.locator(".confirm").getByRole("button", { name: "삭제" }).click();
  await expect.poll(async () => await stored("1688 검색어 변환 사본")).toBeUndefined();
});

test("저장이 실패하면 오류를 알리고 화면을 서버 상태로 되돌린다", async () => {
  await page.route("**/api/prompts/*", route =>
    route.request().method() === "PATCH" ? route.fulfill({ status: 500, body: '{"error":"server_error"}' }) : route.continue());
  await page.locator(".row", { hasText: "1688 검색어 변환" }).click();
  const star = page.locator(".detail-head").getByRole("button", { name: "즐겨찾기" });
  const before = await star.getAttribute("aria-pressed");
  await star.click();
  await expect(page.locator(".toast-error")).toContainText("즐겨찾기를 저장하지 못했어요");
  await expect(star).toHaveAttribute("aria-pressed", before);
  await page.unroute("**/api/prompts/*");
});

test("세션이 만료되면 로그인 화면으로 돌아가고, 로그아웃하면 새로고침해도 로그아웃 상태다", async () => {
  await page.context().clearCookies();
  await page.getByRole("button", { name: "복사", exact: true }).click();
  await expect(page.locator("#password")).toBeVisible();
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page.locator("#password")).toBeVisible();
  await page.reload();
  await expect(page.locator("#password")).toBeVisible();
});

test("모바일 폭에서도 가로로 넘치지 않는다", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const m = await ctx.newPage();
  await m.goto("/");
  await m.fill("#password", PASSWORD);
  await m.getByRole("button", { name: "로그인" }).click();
  await m.locator(".row").first().click();
  expect(await m.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await m.getByRole("button", { name: "메뉴" }).click();
  await m.locator(".sidebar .nav-item", { hasText: "마케팅" }).click();
  await expect(m.locator(".crumb")).toContainText("마케팅");
  await ctx.close();
});

test("비밀번호나 DB가 설정되지 않으면 무엇을 설정할지 안내한다", async ({ browser, request }) => {
  await request.get("/__test/nopassword");
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto("/");
  await expect(p.locator(".auth-card")).toContainText("APP_PASSWORD");
  await request.get("/__test/password");
  await request.get("/__test/nodb");
  await p.reload();
  await p.fill("#password", PASSWORD);
  await p.getByRole("button", { name: "로그인" }).click();
  await expect(p.locator(".notice")).toContainText("데이터베이스가 연결되지 않았어요");
  await request.get("/__test/db");
  await ctx.close();
});
