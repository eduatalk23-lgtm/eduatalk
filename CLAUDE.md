# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TimeLevelUp** - A learning plan and grade management system built with Next.js 16 (App Router), TypeScript 5, Tailwind CSS 4, and Supabase.

## Common Commands

```bash
pnpm dev          # Start development server (port 3000)
pnpm build        # Production build
pnpm lint         # Run ESLint
pnpm test         # Run Vitest tests
pnpm test:watch   # Run tests in watch mode
pnpm analyze      # Bundle analysis (ANALYZE=true next build)
```

## Architecture

### Directory Structure

- `app/` - Next.js App Router pages with role-based route groups
  - `(admin)/` - Admin pages (`/admin/*`)
  - `(parent)/` - Parent pages (`/parent/*`)
  - `(student)/` - Student pages (`/dashboard`, `/plan`, `/scores`, etc.)
  - `actions/` - Server Actions
  - `api/` - API routes
- `components/` - Reusable UI components (atoms, molecules, organisms pattern)
- `lib/` - Core utilities and business logic
  - `supabase/` - Supabase clients (client.ts, server.ts, admin.ts)
  - `auth/` - Authentication utilities and strategies (`strategies/` for role-based auth)
  - `domains/` - Domain-specific logic (plan, school, score, student, etc.)
  - `data/` - Data fetching functions
  - `hooks/` - Custom React hooks
- `supabase/migrations/` - Database migrations

### Key Patterns

**Supabase Clients:**
- `createSupabaseServerClient()` - For Server Components/Actions (rate-limit aware)
- `createSupabaseBrowserClient()` - For Client Components
- `createSupabaseAdminClient()` - For bypassing RLS (server-only)

**State Management:**
- React Query for server state (`lib/providers/QueryProvider.tsx`)
- Context API for client state (ToastProvider)

**Authentication Flow:**
- Role-based routing: student → `/dashboard`, admin → `/admin/dashboard`, parent → `/parent/dashboard`
- Use `getCurrentUser()` and `getCachedUserRole()` from `lib/auth/`

**Auth Caching Rules (1-Request, 1-Query 원칙):**
- **`getCachedAuthUser()`** — `supabase.auth.getUser()`를 직접 호출하지 말 것. 반드시 이 함수를 사용 (`lib/auth/cachedGetUser.ts`)
- **`getCachedUserRole()`** — `getCurrentUserRole()`을 직접 호출하지 말 것. 반드시 캐시된 버전 사용 (`lib/auth/getCurrentUserRole.ts`)
- **`getCurrentUser()`** — 이미 캐시 적용됨, 직접 사용 OK (`lib/auth/getCurrentUser.ts`)
- **proxy.ts** — Edge Runtime이므로 `React.cache()` 공유 불가. DB 쿼리 없이 `user_metadata`만 사용
- **가드 함수** (`requireAdminOrConsultant`, `requireAdmin` 등) — 내부적으로 `getCachedUserRole()` 사용
- **원본 함수(`getCurrentUserRole`)는 `getCachedUserRole` 내부에서만 호출** — 외부에서 직접 import/호출 금지

**Auth Strategy Pattern (Server Actions):**
Use `resolveAuthContext()` for role-based authentication in Server Actions:
```typescript
import { resolveAuthContext, isAdminContext } from '@/lib/auth/strategies';

async function createPlan(data: FormData, options?: { studentId?: string }) {
  // Auto-resolves to Student/Admin/Parent context based on role
  const auth = await resolveAuthContext({ studentId: options?.studentId });

  // studentId is always available (self or target student)
  const studentId = auth.studentId;

  // Role-specific logic when needed
  if (isAdminContext(auth)) {
    logAudit(`Admin ${auth.userId} for student ${auth.studentId}`);
  }
}
```
See `docs/auth-strategy-pattern.md` for full documentation.

### Next.js 15+ Specifics

**`"use server"` 모듈에서 type re-export 금지:**
```typescript
// ❌ FORBIDDEN: 런타임 ReferenceError 유발
"use server";
import type { Foo } from "./types";
export type { Foo };

// ✅ OK: 타입은 원본 파일에서 직접 import
// types.ts (별도 파일)에서 export interface Foo { ... }
// 소비자: import type { Foo } from "./types"
```
Next.js가 `"use server"` 모듈의 모든 export를 런타임 참조로 처리하여, `import type`으로 지워진 값을 참조 시 크래시.

Dynamic route params are Promises:
```typescript
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // ...
}
```

## Code Style Guidelines

### TypeScript
- **Never use `any`** - Use `unknown`, generics, or explicit types
- Handle `null` properly with optional chaining (`?.`) and nullish coalescing (`??`)
- Use type assertions (`as`) only after null checks

### Components
- PascalCase naming: `[Domain][Role][Variant]` (e.g., `CourseCard`, `StudentList`)
- Avoid: `Common`, `Base`, `Util` prefixes
- Single component → `export default`; utilities/hooks → named exports
- No unnecessary wrapper components (avoid div+className-only containers)

### Styling (Tailwind)
- **Spacing-First Policy**: Use `gap` for siblings, `padding` for containers; avoid `margin` for layout
- No inline `style={}` or styled-jsx
- Use `cn()` from `lib/cn.ts` for conditional classes
- Follow design system tokens for colors/typography

### File Structure
- Path alias: `@/*` → project root
- Prefer editing existing files over creating new ones
- No barrel exports (`index.ts`) for small component folders

## Database

Supabase with PostgreSQL. Migrations in `supabase/migrations/`. Uses Row Level Security (RLS).

Key tables: `students`, `student_plans`, `scores`, `plan_groups`, `blocks`, `tenants`

### RLS Policy Rules (initplan 최적화)

RLS 정책에서 `auth.uid()`, `auth.role()`, `auth.jwt()`는 반드시 `(SELECT ...)` 로 감싸야 한다.
감싸지 않으면 PostgreSQL이 **행마다 재평가**하여 성능이 크게 저하된다.

```sql
-- ❌ FORBIDDEN: 행마다 auth.uid() 재평가
CREATE POLICY "example" ON table USING (student_id = auth.uid());

-- ✅ REQUIRED: 쿼리당 1회만 평가 (initplan)
CREATE POLICY "example" ON table USING (student_id = (SELECT auth.uid()));
```

**헬퍼 함수 내부도 동일 규칙 적용:**
```sql
-- ✅ 함수 내부에서도 (SELECT auth.uid()) 사용
CREATE FUNCTION rls_check_example(p_id uuid) RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM table WHERE id = (SELECT auth.uid()) AND col = p_id);
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

## AI & Cold Start System

### Cold Start 콘텐츠 추천

신규 사용자(학습 이력 없음)에게 교과/과목/난이도 기반으로 콘텐츠를 추천하는 시스템.

**핵심 파일:**
```
lib/domains/plan/llm/actions/coldStart/
├── pipeline.ts           # 메인 파이프라인
├── types.ts              # 타입 정의
├── persistence/          # DB 저장 모듈
└── batch/                # 배치 처리 모듈
```

**사용법:**
```typescript
import { runColdStartPipeline } from "@/lib/domains/plan/llm/actions/coldStart";

const result = await runColdStartPipeline({
  subjectCategory: "수학",
  subject: "미적분",
  difficulty: "개념",
  contentType: "book",
}, {
  saveToDb: true,      // DB에 저장
  enableFallback: true // Rate limit 시 DB 캐시 사용
});
```

**Rate Limit 보호:**
- Gemini Free Tier: 일 20회, 분 15회 제한
- 자동 DB fallback: API 한도 초과 시 캐시된 콘텐츠 반환
- 할당량 추적: `getGeminiQuotaStatus()` 함수

**관련 API:**
- `POST /api/plan/content-recommendation` - 콘텐츠 추천
- `GET /api/admin/gemini-quota` - Gemini 할당량 확인
- `GET /api/admin/cache-stats` - 캐시 통계

**문서:** `docs/cold-start-system-guide.md`

### 배치 처리 (GitHub Actions)

```bash
# CLI 스크립트
npx tsx scripts/cold-start-batch.ts core --dry-run  # 드라이런
npx tsx scripts/cold-start-batch.ts math --limit=5  # 수학 5개만
```

**자동 실행:** 매일 새벽 3시 (KST) - `.github/workflows/cold-start-batch.yml`

**수동 실행:** GitHub Actions → "Cold Start Batch Processing" → Run workflow

## Deployment & Hosting

**Vercel (Hobby Plan)**으로 배포. 자동 배포: `main` 브랜치 push 시 트리거.

**주의사항:**
- **패키지 설치 시 반드시 `pnpm add`로 설치** — `node_modules`에만 존재하고 `package.json`에 없으면 로컬은 동작하지만 Vercel 빌드 실패
- **Cron 제한**: Hobby 플랜은 **하루 1회(daily) cron만 허용** — `*/5 * * * *`, `0 * * * *` 등 sub-daily 스케줄 사용 불가 (`vercel.json`)
- 빌드 실패 시 Vercel 대시보드에서 에러 로그 확인 필요

## Agent Workflow Rules

### 작업 전 탐색
- 코드 위치를 모를 때만 Explore 에이전트 사용 (이미 아는 위치는 Grep/Read 직접 사용)
- Plan 에이전트는 사용자가 요청하거나, 10개 이상 파일 수정이 예상될 때만

### 코드 작성 후 검증
- 여러 파일 수정, 새 기능, 타입 변경 시: `pnpm lint` → `pnpm build`
- 단순 수정(1~3파일, 로직 변경 없음)은 빌드 검증 생략 가능

### 도메인 에이전트
사용자가 명시적으로 요청하거나, 대규모 작업(5파일 이상 + 도메인 깊은 이해 필요)일 때만 spawn. 일반적으로는 도메인 CLAUDE.md 참조만으로 충분.

| 도메인 | 에이전트 | CLAUDE.md 위치 |
|--------|----------|----------------|
| plan | `plan-dev` | `lib/domains/plan/CLAUDE.md` |
| student-record | `record-dev` | `lib/domains/student-record/CLAUDE.md` |
| admin-plan | `admin-plan-dev` | `lib/domains/admin-plan/CLAUDE.md` |
| chat | `chat-dev` | `lib/domains/chat/CLAUDE.md` |
| admission | `admission-dev` | `lib/domains/admission/CLAUDE.md` |
| guide | `guide-dev` | `lib/domains/guide/CLAUDE.md` |
| payment/notification/sms/push/enrollment | `ops-dev` | 해당 도메인 CLAUDE.md |
| content/master-content/drive | `content-dev` | 해당 도메인 CLAUDE.md |
| calendar/attendance/block/camp | `scheduling-dev` | 해당 도메인 CLAUDE.md |
| DB 마이그레이션/RLS/RPC | `/project:db` | `supabase/migrations/` |

### 전문가 자문단
사용자가 "자문단 소집" 요청 시에만 → `docs/expert-panel-personas.md` 참조
