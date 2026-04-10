# Podwrite.ai

POD(Print on Demand) 작가를 위한 AI 기반 원고 집필 SaaS 플랫폼입니다.
원고 작성부터 플랫폼별(부크크, 교보문고, Amazon KDP) 출간 준비까지 하나의 워크플로우로 지원합니다.

## 주요 기능

- **AI 집필 보조** — Claude API 기반 챕터 작성, 문장 제안, 스타일 교정
- **원고 진단** — 업로드된 원고(.txt/.md)를 Claude로 분석해 피드백 제공 (비회원 사용 가능)
- **플랫폼별 파일 출력** — 부크크·교보문고·KDP 규격에 맞는 EPUB 3.0 / DOCX 자동 생성
- **KDP 메타데이터 & 번역** — Amazon KDP 등록용 메타데이터 작성 및 영어 번역
- **셀링 페이지 카피** — 플랫폼별 마케팅 문구 AI 생성
- **구독 결제** — TossPayments 빌링키 기반 월정액 자동결제
- **맞춤법 검사** — CLOVA 맞춤법 검사기 연동 (선택)

## 기술 스택

| 분류 | 기술 |
|------|------|
| 프레임워크 | Next.js 14 (App Router) |
| 데이터베이스 | Supabase (PostgreSQL + Row Level Security) |
| 인증 | Supabase Auth |
| AI | Claude API (Anthropic) · Perplexity Sonar |
| 리치 텍스트 에디터 | TipTap v2 |
| 결제 | TossPayments (빌링키 자동결제) |
| 백그라운드 잡 | Inngest |
| 이메일 | Resend |
| Rate Limiting | Upstash Redis |
| 에러 추적 | Sentry |
| 배포 | Vercel |

## 로컬 개발 환경 설정

### 사전 요구사항

- Node.js 20+
- npm 또는 pnpm
- Supabase CLI (로컬 DB 사용 시 선택 사항)

### 1. 레포지토리 클론

```bash
git clone https://github.com/hdj82-bot/Podwrite.ai.git
cd Podwrite.ai
npm install
```

### 2. 환경변수 설정

```bash
cp .env.local.example .env.local
```

`.env.local`을 열고 아래 값을 채워주세요:

| 변수 | 설명 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key (서버 전용) |
| `ANTHROPIC_API_KEY` | Claude API 키 (`sk-ant-...`) |
| `PERPLEXITY_API_KEY` | Perplexity Sonar API 키 |
| `TOSS_PAYMENTS_SECRET_KEY` | 토스페이먼츠 시크릿 키 |
| `TOSS_PAYMENTS_CLIENT_KEY` | 토스페이먼츠 클라이언트 키 |
| `TOSS_PAYMENTS_WEBHOOK_SECRET` | 웹훅 서명 검증 시크릿 |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis 토큰 |
| `SECRET_RESEND_API_KEY` | Resend 이메일 API 키 |
| `INNGEST_EVENT_KEY` | Inngest 이벤트 키 |
| `INNGEST_SIGNING_KEY` | Inngest 서명 키 |
| `NEXT_PUBLIC_APP_URL` | 앱 URL (로컬: `http://localhost:3000`) |

### 3. 폰트 설치

EPUB 생성 시 나눔고딕 폰트가 필요합니다:

```bash
bash font-install.sh
```

설치 후 `public/fonts/NanumGothic.otf` 파일이 생성됩니다.

### 4. Supabase 스키마 적용

```bash
# Supabase CLI 사용 시
supabase db reset

# 또는 Supabase 대시보드 > SQL Editor에서 실행
# 1. supabase/schema.sql
# 2. supabase/migrations/ 하위 파일을 001 → 004 순서대로 실행
```

### 5. 개발 서버 실행

```bash
# Next.js 개발 서버 (터미널 1)
npm run dev

# Inngest 개발 서버 (터미널 2)
npm run inngest:dev
```

`http://localhost:3000`에서 앱을 확인합니다.

## 디렉토리 구조

```
podwrite-ai/
├── app/
│   ├── (auth)/              # 로그인·회원가입·비밀번호 재설정
│   ├── (dashboard)/         # 인증 필요 페이지 (에디터, 설정, 진단 등)
│   ├── api/
│   │   ├── chapters/        # 챕터 CRUD + 버전 관리
│   │   ├── chat/ai/         # AI 채팅 (Claude 스트리밍)
│   │   ├── diagnostics/     # 원고 진단 (비회원 허용)
│   │   ├── generate-epub/   # EPUB 3.0 생성
│   │   ├── generate-docx/   # DOCX 생성
│   │   ├── kdp/             # KDP 메타데이터·번역·패키지
│   │   ├── projects/        # 프로젝트 CRUD
│   │   ├── search/          # 자료 검색 (Perplexity Sonar)
│   │   ├── selling/copy/    # 셀링 카피 생성
│   │   ├── subscriptions/   # TossPayments 결제·웹훅
│   │   └── user/            # 프로필·사용량 조회
│   └── diagnostics/         # 공개 진단 랜딩 페이지
├── components/
│   ├── dashboard/           # 대시보드 카드·차트·모달
│   ├── editor/              # TipTap 에디터 + AI 사이드바
│   ├── kdp/                 # KDP 메타데이터 폼·번역 패널
│   ├── payment/             # 결제·구독 UI
│   ├── selling/             # 셀링 페이지 카피 컴포넌트
│   └── ui/                  # 공통 UI (Toast, Spinner, Modal)
├── inngest/                 # 백그라운드 잡
│   ├── analyze-diagnostic.ts    # 원고 진단 분석
│   ├── billing-cycle.ts         # 자동 결제 주기 처리
│   ├── generate-epub.ts         # EPUB 비동기 생성
│   ├── generate-docx.ts         # DOCX 비동기 생성
│   └── translate.ts             # KDP 번역
├── lib/
│   ├── claude.ts            # Claude API 클라이언트
│   ├── epub-generator.ts    # TipTap JSON → EPUB 3.0
│   ├── docx-generator.ts    # TipTap JSON → DOCX
│   ├── plan-guard.ts        # 플랜별 기능 접근 제어
│   ├── rate-limit.ts        # Upstash Redis 레이트 리밋
│   ├── toss-payments.ts     # TossPayments HMAC 검증
│   └── supabase-server.ts   # Supabase 서버 클라이언트
├── supabase/
│   ├── schema.sql           # 전체 DB 스키마
│   ├── migrations/          # 증분 마이그레이션 (001~004)
│   └── seed.sql             # 초기 데이터
├── types/
│   ├── index.ts             # 플랜 정의·PLAN_LIMITS 등 공통 타입
│   └── database.ts          # Supabase 자동 생성 타입
└── public/
    └── fonts/               # NanumGothic.otf (font-install.sh로 설치)
```

## 플랜 구조

| 기능 | Free | Basic | Pro |
|------|------|-------|-----|
| 프로젝트 수 | 1개 | 3개 | 무제한 |
| Amazon KDP 출판 | ✗ | ✗ | ✓ |
| 셀링 페이지 | ✗ | ✗ | ✓ |
| 자료 검색 | 5회/월 | 20회/월 | 무제한 |
| 챕터 버전 보관 | 3개 | 10개 | 무제한 |

## 배포

### Vercel

1. GitHub 레포를 [Vercel](https://vercel.com)에 연결합니다.
2. **Settings > Environment Variables**에 `.env.local`의 모든 변수를 추가합니다.
3. 배포합니다. Build Command(`npm run build`)와 Output Directory(`.next`)는 자동 감지됩니다.

> `NODE_ENV=production` 환경에서는 TossPayments HMAC 웹훅 서명 검증이 자동으로 활성화됩니다.

### Supabase

1. [Supabase 대시보드](https://supabase.com)에서 새 프로젝트를 생성합니다.
2. **SQL Editor**에서 `supabase/schema.sql`을 실행합니다.
3. `supabase/migrations/` 하위 파일을 `001 → 004` 순서대로 실행합니다.
4. **Storage**에서 `diagnostics` 버킷을 생성합니다 (Public: false).
5. **Database > Webhooks**에서 Auth 웹훅 시크릿(`SUPABASE_WEBHOOK_SECRET`)을 설정합니다.

### Inngest

1. [Inngest 대시보드](https://www.inngest.com)에서 앱을 생성하고 Event Key / Signing Key를 발급합니다.
2. Vercel 환경변수에 `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`를 추가합니다.
3. Inngest 대시보드에서 Webhook URL을 다음과 같이 설정합니다:
   ```
   https://your-domain.vercel.app/api/inngest
   ```

### TossPayments

1. [토스페이먼츠 개발자센터](https://developers.tosspayments.com)에서 앱을 등록합니다.
2. 웹훅 URL을 아래와 같이 설정합니다:
   ```
   https://your-domain.vercel.app/api/subscriptions/webhook
   ```
3. 웹훅 시크릿(`TOSS_PAYMENTS_WEBHOOK_SECRET`)을 복사해 환경변수에 추가합니다.

## 테스트

```bash
npm test            # Vitest 전체 실행
npm run test:ui     # Vitest UI 모드
npm run type-check  # TypeScript 타입 검사만
```

## 라이선스

Private — All rights reserved.
