# 프롬프트

네이버 스마트스토어 운영용 개인 프롬프트 관리 앱.
상품 소싱, 상품 등록, 마케팅, 고객 응대, 운영·분석으로 나눠 프롬프트를 저장하고, `{{변수}}`만 채워서 복사해 쓴다.

## 기능

- 카테고리별 목록, 즐겨찾기, 제목·본문·태그 검색, 태그 클릭 필터
- `{{변수}}` 자동 인식 → 입력 칸 생성 → 미리보기 → 복사 (마지막 입력값 기억, 사용 횟수 기록)
- 편집, 본문 수정 기록 20개 보관과 되돌리기, 복제, 삭제
- 비밀번호 로그인 (30일 유지)

## 구성

| 경로 | 내용 |
|---|---|
| `src/` | React 화면 (Vite) |
| `api/` | Vercel 서버리스 함수: 로그인, 프롬프트 CRUD |
| `server/` | DB 연결, 인증, 입력 검증 |

데이터는 Postgres(Neon)의 `prompts` 테이블 하나에 저장한다. 테이블은 첫 요청 때 자동으로 만들어진다.

## Vercel 배포

1. **프로젝트 가져오기**: vercel.com → Add New → Project → 이 GitHub 레포 Import. Framework는 Vite로 자동 인식된다.
2. **환경변수**: Configure Project → Environment Variables에 `APP_PASSWORD`를 추가한다. 로그인할 때 쓸 비밀번호다.
3. **Deploy**를 누른다. 이 시점에는 DB가 없어서 로그인 후 "데이터베이스가 연결되지 않았어요" 문구가 보이는 게 정상이다.
4. **DB 연결**: 프로젝트 → Storage → Create Database → Neon(Postgres) → 이 프로젝트에 연결. `DATABASE_URL`이 자동으로 추가된다.
5. **다시 배포**: Deployments → 최신 배포의 ⋯ → Redeploy.

이후 `main`에 푸시하면 자동으로 다시 배포된다.

비밀번호를 바꾸려면 `APP_PASSWORD`를 수정하고 다시 배포한다. 기존 로그인은 모두 풀린다.

## 로컬 실행

```bash
npm install
npx vercel dev   # API까지 함께 실행. .env에 APP_PASSWORD, DATABASE_URL 필요
```

화면만 볼 때는 `npm run dev`.
