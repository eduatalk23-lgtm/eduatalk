# TimeLevelUp 프로젝트 구조 분석

## 📋 프로젝트 개요

**프로젝트명**: TimeLevelUp  
**설명**: 효율적인 학습 계획 및 성적 관리 시스템  
**프레임워크**: Next.js 16.0.3 (App Router)  
**언어**: TypeScript 5  
**스타일링**: Tailwind CSS 4

---

## 🏗 프로젝트 구조

### 루트 디렉토리 구조

```
project/
├── app/                    # Next.js App Router 페이지 및 라우트
├── components/             # 재사용 가능한 UI 컴포넌트
├── lib/                    # 유틸리티, 설정, 타입 정의
├── public/                 # 정적 파일 (이미지, 아이콘 등)
├── scripts/                # 유틸리티 스크립트
├── supabase/               # Supabase 마이그레이션 파일
├── doc/                    # 프로젝트 문서
├── timetable/              # 시간표 관련 문서 및 설계
├── package.json            # 프로젝트 의존성 및 스크립트
├── tsconfig.json           # TypeScript 설정
├── next.config.ts          # Next.js 설정
└── eslint.config.mjs       # ESLint 설정
```

---

## 🚀 애플리케이션 시작

### 진입점

**루트 레이아웃**: `app/layout.tsx`
- Next.js App Router의 최상위 레이아웃
- QueryProvider로 React Query 설정
- Geist 폰트 적용

**홈 페이지**: `app/page.tsx`
- 역할 기반 리다이렉트 로직
- 인증되지 않은 사용자 → `/login`
- 학생 → `/dashboard`
- 관리자/컨설턴트 → `/admin/dashboard`
- 부모 → `/parent/dashboard`

### 개발 서버 실행

```bash
npm run dev      # 개발 서버 시작 (포트 3000)
npm run build    # 프로덕션 빌드
npm run start    # 프로덕션 서버 시작
npm run lint     # ESLint 실행
npm run analyze  # 번들 분석 (ANALYZE=true next build)
```

---

## 📦 주요 의존성

### 핵심 프레임워크
- **next**: 16.0.3 - React 프레임워크
- **react**: 19.2.0 - UI 라이브러리
- **react-dom**: 19.2.0 - React DOM 렌더러
- **typescript**: 5 - 타입 안전성

### 상태 관리
- **@tanstack/react-query**: 5.90.10 - 서버 상태 관리 (설정 완료)
- **@tanstack/react-query-devtools**: 5.90.2 - 개발 도구

### 백엔드 및 인증
- **@supabase/supabase-js**: 2.81.1 - Supabase 클라이언트
- **@supabase/ssr**: 0.7.0 - SSR 지원
- **@supabase/auth-helpers-nextjs**: 0.10.0 - Next.js 인증 헬퍼

### 스타일링
- **tailwindcss**: 4 - 유틸리티 CSS 프레임워크
- **@tailwindcss/postcss**: 4 - PostCSS 플러그인
- **clsx**: 2.1.1 - 조건부 클래스명
- **tailwind-merge**: 3.4.0 - Tailwind 클래스 병합

### 유틸리티
- **lucide-react**: 0.554.0 - 아이콘 라이브러리
- **recharts**: 3.4.1 - 차트 라이브러리
- **zod**: 4.1.12 - 스키마 검증

---

## 🔄 상태 관리 아키텍처

### 1. React Query (서버 상태)

**설정 위치**: `lib/providers/QueryProvider.tsx`

**주요 설정**:
- `staleTime`: 1분 (서버 상태 동기화)
- `gcTime`: 5분 (캐시 유지 시간)
- `retry`: 1회 (재시도 횟수)
- `refetchOnWindowFocus`: false (서버 컴포넌트 사용 시)
- `refetchOnReconnect`: true (네트워크 재연결 시)

**사용 예시**:
```typescript
// 클라이언트 컴포넌트에서 사용
"use client";
import { useQuery } from "@tanstack/react-query";

const { data, isLoading } = useQuery({
  queryKey: ["courses"],
  queryFn: fetchCourses,
});
```

### 2. Context API (클라이언트 상태)

**ToastProvider**: `components/ui/ToastProvider.tsx`
- 전역 토스트 알림 관리
- `showToast`, `showSuccess`, `showError`, `showInfo` 메서드 제공

**사용 예시**:
```typescript
import { useToast } from "@/components/ui/ToastProvider";

const { showSuccess, showError } = useToast();
showSuccess("작업이 완료되었습니다.");
```

### 3. 로컬 상태 (useState, useReducer)

- 컴포넌트 내부 상태는 React의 기본 훅 사용
- 복잡한 상태는 `useReducer` 활용

---

## 🗄 데이터베이스 및 백엔드

### Supabase 설정

**환경 변수** (`lib/env.ts`):
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase 프로젝트 URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: 공개 API 키
- `SUPABASE_SERVICE_ROLE_KEY`: 서비스 역할 키 (서버 전용)

**클라이언트 타입**:

1. **Browser Client** (`lib/supabase/client.ts`)
   - 클라이언트 컴포넌트에서 사용
   - 쿠키 자동 관리

2. **Server Client** (`lib/supabase/server.ts`)
   - 서버 컴포넌트, Server Actions, Route Handlers에서 사용
   - Rate limit 처리 포함
   - Next.js 15 쿠키 제약사항 고려

3. **Admin Client** (`lib/supabase/admin.ts`)
   - RLS 우회 (서버 전용)
   - Service Role Key 사용

**사용 예시**:
```typescript
// 서버 컴포넌트
import { createSupabaseServerClient } from "@/lib/supabase/server";

const supabase = await createSupabaseServerClient();
const { data } = await supabase.from("students").select("*");
```

---

## 🔐 인증 시스템

### 인증 흐름

1. **로그인**: `app/login/page.tsx`
2. **회원가입**: `app/signup/page.tsx`
3. **학생 설정**: `app/student-setup/page.tsx`

### 인증 유틸리티

**현재 사용자 정보**: `lib/auth/getCurrentUser.ts`
- `getCurrentUser()`: 현재 로그인한 사용자 정보 반환

**역할 확인**: `lib/auth/getCurrentUserRole.ts`
- `getCurrentUserRole()`: 사용자 역할 (student, admin, parent, consultant) 반환

**세션 관리**: `lib/auth/sessionManager.ts`
- 세션 생성 및 관리

**Rate Limit 처리**: `lib/auth/rateLimitHandler.ts`
- API 요청 제한 처리

---

## 📁 주요 디렉토리 상세

### `app/` - Next.js App Router

**라우트 그룹**:
- `(admin)/` - 관리자 전용 페이지
- `(parent)/` - 부모 전용 페이지
- `(student)/` - 학생 전용 페이지

**주요 페이지**:
- `/login` - 로그인
- `/signup` - 회원가입
- `/dashboard` - 학생 대시보드
- `/admin/dashboard` - 관리자 대시보드
- `/parent/dashboard` - 부모 대시보드
- `/today` - 오늘의 학습 계획
- `/plan` - 학습 계획 관리
- `/scores` - 성적 관리
- `/contents` - 학습 콘텐츠
- `/analysis` - 학습 분석
- `/settings` - 설정

**Server Actions**: `app/actions/`
- `auth.ts` - 인증 관련 액션
- `blocks.ts` - 블록 관리
- `scores.ts` - 성적 관리
- `student.ts` - 학생 정보 관리
- 등등...

**API Routes**: `app/api/`
- RESTful API 엔드포인트
- 외부 시스템 연동

### `components/` - 재사용 가능한 컴포넌트

**UI 컴포넌트** (`components/ui/`):
- `Badge.tsx` - 배지 컴포넌트
- `Card.tsx` - 카드 컴포넌트
- `Dialog.tsx` - 다이얼로그
- `Toast.tsx` / `ToastProvider.tsx` - 토스트 알림
- `LoadingSkeleton.tsx` - 로딩 스켈레톤
- `ProgressBar.tsx` - 진행률 표시
- 등등...

**레이아웃 컴포넌트** (`components/layout/`):
- `RoleBasedLayout.tsx` - 역할 기반 레이아웃

**네비게이션** (`components/navigation/`):
- `global/` - 전역 네비게이션
- `student/` - 학생 전용 네비게이션

### `lib/` - 유틸리티 및 설정

**인증** (`lib/auth/`):
- `getCurrentUser.ts` - 현재 사용자 정보
- `getCurrentUserRole.ts` - 사용자 역할 확인
- `sessionManager.ts` - 세션 관리
- `rateLimitHandler.ts` - Rate limit 처리

**Supabase** (`lib/supabase/`):
- `client.ts` - 브라우저 클라이언트
- `server.ts` - 서버 클라이언트
- `admin.ts` - 관리자 클라이언트
- `queryHelpers.ts` - 쿼리 헬퍼 함수

**데이터 페칭** (`lib/data/`):
- `students.ts` - 학생 데이터
- `studentScores.ts` - 성적 데이터
- `studentPlans.ts` - 학습 계획 데이터
- `planGroups.ts` - 계획 그룹 데이터
- 등등...

**비즈니스 로직**:
- `lib/plan/` - 학습 계획 로직
- `lib/metrics/` - 학습 지표 계산
- `lib/recommendations/` - 추천 엔진
- `lib/coaching/` - 코칭 로직
- `lib/risk/` - 리스크 분석

**유틸리티** (`lib/utils/`):
- `cache.ts` - 캐싱 유틸리티
- `formatNumber.ts` - 숫자 포맷팅
- `performance.ts` - 성능 측정
- 등등...

**타입 정의** (`lib/types/`):
- `plan.ts` - 학습 계획 타입
- `wizard.ts` - 위저드 타입

**검증** (`lib/validation/`):
- `schemas.ts` - Zod 스키마
- `planValidator.ts` - 계획 검증
- `wizardValidator.ts` - 위저드 검증

**프로바이더** (`lib/providers/`):
- `QueryProvider.tsx` - React Query 프로바이더

---

## ⚙️ 설정 파일

### `tsconfig.json`
- TypeScript 컴파일러 설정
- 경로 별칭: `@/*` → `./*`
- 엄격 모드 활성화
- Next.js 플러그인 포함

### `next.config.ts`
- 이미지 최적화 설정 (AVIF, WebP)
- 번들 분석기 통합
- 패키지 최적화 (lucide-react, recharts, @supabase/supabase-js)
- Turbopack 설정 (Next.js 16 기본)

### `package.json`
- 프로젝트 메타데이터
- 의존성 관리
- 스크립트 정의

---

## 🎨 스타일링 시스템

### Tailwind CSS 4
- 유틸리티 우선 접근
- 커스텀 디자인 토큰 사용
- 반응형 디자인 (모바일 우선)

### 폰트
- **Geist Sans**: 기본 폰트
- **Geist Mono**: 모노스페이스 폰트

### 아이콘
- **Lucide React**: 아이콘 라이브러리

---

## 🔄 데이터 흐름

### 서버 컴포넌트 → 클라이언트 컴포넌트

1. **서버 컴포넌트**에서 데이터 페칭
2. **props**로 클라이언트 컴포넌트에 전달
3. **클라이언트 컴포넌트**에서 인터랙티브 UI 렌더링

### Server Actions

```typescript
// app/actions/example.ts
"use server";

export async function createStudent(data: FormData) {
  const supabase = await createSupabaseServerClient();
  // 데이터베이스 작업
}
```

### React Query (클라이언트 사이드)

```typescript
// 클라이언트 컴포넌트에서
const { data, mutate } = useMutation({
  mutationFn: async (data) => {
    const response = await fetch("/api/endpoint", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return response.json();
  },
});
```

---

## 🛡 보안 고려사항

### 인증
- Supabase Auth 사용
- RLS (Row Level Security) 활성화
- 서버 사이드 인증 확인

### Rate Limiting
- API 요청 제한 처리
- 자동 재시도 및 백오프 전략

### 환경 변수
- Zod를 통한 환경 변수 검증
- 서버 전용 키 보호

---

## 📊 성능 최적화

### 이미지 최적화
- Next.js Image 컴포넌트 사용
- AVIF, WebP 포맷 지원
- 자동 크기 조정

### 코드 스플리팅
- 동적 import 사용
- React Query Devtools는 개발 환경에서만 로드

### 캐싱
- React Query 캐싱
- 서버 사이드 캐싱 (`unstable_cache`)

### 번들 최적화
- 패키지 최적화 (`optimizePackageImports`)
- 번들 분석기 통합

---

## 🧪 개발 도구

### TypeScript
- 엄격 모드 활성화
- 타입 안전성 보장

### ESLint
- Next.js 기본 규칙
- 코드 품질 검사

### React Query Devtools
- 개발 환경에서만 활성화
- 쿼리 상태 디버깅

---

## 📝 주요 패턴 및 컨벤션

### 컴포넌트 네이밍
- PascalCase 사용
- 도메인 + 역할 패턴 (예: `StudentCard`, `PlanList`)

### 파일 구조
- 단일 컴포넌트 파일: `ComponentName.tsx`
- 관련 타입은 같은 파일 또는 `types/` 디렉토리

### Export 규칙
- 단일 컴포넌트: `export default`
- 유틸리티 함수: `export function`
- 타입: `export type` 또는 `export interface`

### 스타일링 규칙
- Tailwind 유틸리티 우선
- Spacing-First 정책 (gap 우선, margin 금지)
- 인라인 스타일 금지

---

## 🚧 향후 개선 사항

### 설치되었으나 미사용
- **Zustand**: 글로벌 상태 관리 (필요 시 도입)
- **React Hook Form**: 폼 상태 관리
- **Axios**: HTTP 클라이언트
- **Framer Motion**: 애니메이션
- **date-fns**: 날짜 처리

### 아키텍처 개선
- 에러 바운더리 추가
- 로딩 상태 통합 관리
- 접근성 개선 (ARIA 속성)

---

## 📚 참고 문서

- 프로젝트 가이드라인: `.cursor/rules/project_rule.mdc`
- 시간표 설계: `timetable/1730Timetable-PRD.md`
- 마이그레이션 가이드: `doc/supabase-migration-reset-guide.md`

---

**마지막 업데이트**: 2024년 11월

