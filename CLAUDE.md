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
  - `(student)/` - Student pages (`/dashboard`, `/today`, `/plan`, `/scores`, etc.)
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
- Use `getCurrentUser()` and `getCurrentUserRole()` from `lib/auth/`

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

## Agent Workflow Rules (자동 서브에이전트 활용)

Claude가 작업 수행 시 **반드시** 아래 워크플로우를 따른다.

### Phase 1: 작업 시작 전 (필수)

```
[ ] Explore 에이전트 → 관련 코드/패턴 탐색
[ ] 기존 코드 패턴 파악 (비슷한 기능이 어떻게 구현되어 있는지)
[ ] 복잡한 작업(3개 이상 파일 수정)일 경우 → Plan 에이전트로 계획 수립
```

### Phase 2: 코드 작성 후 (필수)

작성한 코드에 대해 자체 리뷰 수행:

```
[ ] TypeScript: any 사용 금지, null 처리 확인
[ ] 보안: 사용자 입력 검증, SQL injection/XSS 방지
[ ] 패턴 준수: 프로젝트 기존 패턴과 일관성 유지
[ ] 에러 처리: try-catch, 에러 메시지 명확성
[ ] 불필요한 코드 없음: 과도한 추상화, 미사용 변수 제거
```

### Phase 3: 기능 완성 후 (필수)

```
[ ] pnpm lint → 린트 에러 확인 및 수정
[ ] pnpm build → 빌드 성공 확인
[ ] 관련 테스트가 있다면 pnpm test 실행
[ ] 변경사항 요약 제공 (어떤 파일을, 왜 수정했는지)
```

### 에러 발생 시 자동 디버깅 프로세스

```
1. 에러 메시지 분석
2. 관련 코드 위치 탐색 (Explore 에이전트)
3. 유사 패턴 검색 (프로젝트 내 비슷한 케이스)
4. 단계별 해결책 제시 + 적용
5. 수정 후 재검증 (lint/build)
```

### 서브에이전트 활용 기준

| 상황 | 사용할 에이전트 |
|------|----------------|
| 코드 위치/패턴 모를 때 | `Explore` (thoroughness: medium) |
| 복잡한 기능 구현 전 | `Plan` |
| 여러 파일 동시 검색 | `Explore` (thoroughness: very thorough) |
| 에러 원인 추적 | `Explore` + 자체 분석 |

### 사용자 피드백 루프

작업 완료 후 항상 확인:
- "의도한 대로 동작하나요?"
- "추가로 수정할 부분이 있나요?"
