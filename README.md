# TimeLevelUp

생기부(학교생활기록부) 기반 학종 컨설팅 플랫폼

## 📋 프로젝트 개요

**TimeLevelUp**은 학생 생기부를 **멀티 에이전트 AI 파이프라인**으로 분석·설계·전략 제시하는 학종(학생부 종합전형) 컨설팅 SaaS입니다.

학원·컨설턴트가 AI의 1차 분석을 검토·교정하는 **Human-in-the-loop 협업 모델**로 동작하며, 생기부의 역량 태깅·품질 진단·보완 전략·면접 예상질문·학기별 로드맵까지 자동 생성합니다.

### 핵심 기능

- **생기부 AI 분석 파이프라인**: 3-Tier 구조 (Grade 9태스크×8Phase + Synthesis 10태스크×6Phase)
- **품질 보증 루프(L4-D)**: L1 Deterministic → L2 Coherence(LLM-judge) → L3 Targeted Repair
- **50건 골든 데이터셋 + CI 회귀**: 파이프라인 변경 시 자동 품질 점수 리포트
- **4-Provider 실측**: Gemini 2.5 Pro / GPT-4o / GPT-5.4 / 로컬 Gemma 비교
- **학습 플랜 관리·Cold Start 추천**: 생기부 분석을 지탱하는 주변 기능

### 사용자 3주체

- **학원(관리자·컨설턴트)** — 생기부 분석, 방향 가이드, 전략 생성 및 검토
- **학생** — 약점·보완 방향 확인 (AI 라벨 비노출)
- **학부모** — 자녀 학습·생기부 현황 모니터링

### 아키텍처 한눈에

```
┌─────────────────────────────────────────────────────────┐
│ ⑤ UI Layer         4단계 탭(기록→진단→설계→전략), RQ    │
│ ④ Data Layer       Supabase + RLS(initplan), 3중 저장   │
│ ③ AgentOps Layer   티어·쿼터·재시도·폴백                │
│ ② Harness Layer    골든셋 50건, LLM-judge, CI 회귀      │
│ ① Agent Layer      3-Tier 파이프라인, L4-D 검증 루프     │
└─────────────────────────────────────────────────────────┘
```

**👉 상세는 [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) 참조 (15분 통독 권장).**

---

## 🚀 시작하기

### 필수 요구사항

- Node.js 20.x 이상
- pnpm 9.x 이상 (권장)
- Supabase 프로젝트

### 설치 및 실행

```bash
pnpm install              # 의존성 설치
pnpm dev                  # 개발 서버 (port 3000)
pnpm build                # 프로덕션 빌드
pnpm lint                 # ESLint
pnpm test                 # Vitest
pnpm test:watch           # 테스트 감시 모드
pnpm analyze              # 번들 분석
```

### 환경 변수

`.env.local` 파일:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# LLM 프로바이더
GOOGLE_GENERATIVE_AI_API_KEY=...   # Gemini (primary)
OPENAI_API_KEY=...                 # GPT 계열 (optional fallback)
```

상세 환경 설정: [`docs/env-setup-guide.md`](./docs/env-setup-guide.md)

---

## 🏗 프로젝트 구조

```
eduatalk/
├── app/                  # Next.js App Router (역할별 route group)
│   ├── (admin)/         # 관리자·컨설턴트 (/admin/*)
│   ├── (student)/       # 학생 (/dashboard, /plan, /scores, ...)
│   ├── (parent)/        # 학부모
│   ├── (superadmin)/
│   └── api/             # API Routes
├── components/          # atoms · molecules · organisms
├── lib/
│   ├── domains/         # 50+ 도메인 (record-analysis 중심)
│   │   ├── record-analysis/   # ⭐ AI 분석 파이프라인
│   │   ├── student-record/    # 생기부 CRUD/도메인 모델
│   │   ├── plan/              # 학습 플랜 + Cold Start
│   │   ├── admission/ · guide/ · admin-plan/
│   │   └── ...
│   ├── supabase/        # Supabase 클라이언트 (server/browser/admin)
│   ├── auth/            # Auth 캐시 + 전략 패턴
│   └── data/ · hooks/
├── supabase/migrations/ # RLS, 트리거, RPC
├── scripts/             # 배치·평가·마이그레이션 스크립트
│   └── eval-*.ts        # 골든셋 평가, 4-Provider 비교
├── docs/                # 프로젝트 문서 (ARCHITECTURE.md 중심)
└── .github/workflows/   # CI (eval-golden-dataset 포함)
```

도메인별 상세 규칙: `lib/domains/*/CLAUDE.md` (Claude Code 서브에이전트가 자동 참조)

---

## 📦 기술 스택

| 계층 | 스택 |
|---|---|
| **프레임워크** | Next.js 16 (App Router), React 19, TypeScript 5 |
| **스타일** | Tailwind CSS 4, `cn()` 유틸 |
| **상태** | @tanstack/react-query, Context API |
| **DB·Auth** | Supabase (PostgreSQL + RLS + Realtime) |
| **AI SDK** | Vercel AI SDK, Google Generative AI, OpenAI |
| **검증·폼** | Zod, React Hook Form |
| **차트** | Recharts (LazyRecharts로 지연 로딩) |
| **테스트** | Vitest |
| **배포** | Vercel (Hobby — daily cron only) |

---

## 📚 문서

### 🧭 중심축

- **[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)** — 전체 구조·5계층·도메인 지도·로드맵
- **[`CLAUDE.md`](./CLAUDE.md)** — 코드 규칙·Auth·DB·배포 (Claude Code 용)

### 주요 상세 문서

- [`lib/domains/record-analysis/CLAUDE.md`](./lib/domains/record-analysis/CLAUDE.md) — AI 파이프라인
- [`docs/student-record-blueprint.md`](./docs/student-record-blueprint.md) — Mermaid 다이어그램
- [`docs/llm-comparison-2026-04-13.md`](./docs/llm-comparison-2026-04-13.md) — 4-Provider 실측
- [`docs/COMPONENT_GUIDE.md`](./docs/COMPONENT_GUIDE.md) — 컴포넌트 사용법
- [`docs/README.md`](./docs/README.md) — 전체 문서 인덱스 (Diátaxis 분류)

---

## 🧪 품질 보증

```bash
pnpm test                                     # 단위 테스트
npx tsx scripts/eval-student-record.ts ...    # 골든셋 평가
npx tsx scripts/docs-triage.ts                # 문서 트리아지
```

CI: `.github/workflows/eval-golden-dataset.yml` — PR마다 골든셋 점수 리포트

---

## 📝 라이선스

비공개 프로젝트

---

**마지막 업데이트**: 2026-04-13 — 정체성 재정의 (생기부 AI 컨설팅 플랫폼)
