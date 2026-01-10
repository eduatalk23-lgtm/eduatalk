# TimeLevelUp 프로젝트 종합 분석 문서

**작성 일자**: 2026-01-15  
**프로젝트명**: TimeLevelUp  
**버전**: 0.1.0  
**프레임워크**: Next.js 16.0.10 (App Router)

---

## 📋 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택](#2-기술-스택)
3. [아키텍처 패턴](#3-아키텍처-패턴)
4. [디렉토리 구조 분석](#4-디렉토리-구조-분석)
5. [주요 기능 모듈](#5-주요-기능-모듈)
6. [데이터베이스 구조](#6-데이터베이스-구조)
7. [인증 및 보안](#7-인증-및-보안)
8. [상태 관리](#8-상태-관리)
9. [성능 최적화](#9-성능-최적화)
10. [개발 가이드](#10-개발-가이드)

---

## 1. 프로젝트 개요

### 1.1 프로젝트 목적

**TimeLevelUp**은 학생의 성적 분석을 기반으로 맞춤형 학습 플랜을 자동 생성하는 AI 기반 통합 학습 관리 시스템입니다.

### 1.2 핵심 기능

- **AI 기반 맞춤형 학습 플랜**: 학생 성적 분석을 통한 개인화된 학습 경로 제공
- **자동 스케줄링**: 복잡한 시간 제약 조건을 고려한 최적 학습 스케줄 자동 생성
- **실시간 모니터링**: 학습 진행 상황 실시간 추적 및 피드백
- **멀티테넌트 지원**: 여러 프렌차이즈 지점이 독립적으로 사용 가능
- **역할 기반 접근 제어**: 학생, 관리자, 학부모, 슈퍼 관리자 등 다양한 역할 지원

### 1.3 사용자 역할

| 역할           | 설명        | 주요 기능                                   |
| -------------- | ----------- | ------------------------------------------- |
| **student**    | 학생        | 학습 플랜 확인, 성적 입력, 오늘의 학습 계획 |
| **admin**      | 관리자      | 학생 관리, 플랜 생성, 성적 분석, 출석 관리  |
| **consultant** | 담당자      | 학생 상담, 플랜 조정, 리포트 작성           |
| **parent**     | 학부모      | 자녀 학습 현황 확인, 리포트 조회            |
| **superadmin** | 슈퍼 관리자 | 시스템 전체 관리, 테넌트 관리               |

---

## 2. 기술 스택

### 2.1 핵심 프레임워크

| 기술             | 버전    | 용도                          |
| ---------------- | ------- | ----------------------------- |
| **Next.js**      | 16.0.10 | React 프레임워크 (App Router) |
| **React**        | 19.2.0  | UI 라이브러리                 |
| **TypeScript**   | 5       | 타입 안전성                   |
| **Tailwind CSS** | 4       | 유틸리티 CSS 프레임워크       |

### 2.2 상태 관리

| 라이브러리                | 버전    | 용도                                      |
| ------------------------- | ------- | ----------------------------------------- |
| **@tanstack/react-query** | 5.90.10 | 서버 상태 관리 (캐싱, 동기화)             |
| **Zustand**               | 5.0.9   | 클라이언트 글로벌 상태 관리 (선택적 사용) |
| **React Context**         | 내장    | 테마, 인증, 사이드바 등 컨텍스트 관리     |

### 2.3 백엔드 및 인증

| 기술                              | 버전   | 용도                                      |
| --------------------------------- | ------ | ----------------------------------------- |
| **Supabase**                      | 2.81.1 | 백엔드 서비스 (PostgreSQL, Auth, Storage) |
| **@supabase/ssr**                 | 0.7.0  | SSR 지원                                  |
| **@supabase/auth-helpers-nextjs** | 0.10.0 | Next.js 인증 헬퍼                         |

### 2.4 UI 라이브러리

| 라이브러리          | 버전     | 용도                                |
| ------------------- | -------- | ----------------------------------- |
| **recharts**        | 3.5.1    | 차트 라이브러리 (Lazy Loading 적용) |
| **lucide-react**    | 0.554.0  | 아이콘 라이브러리 (최적화됨)        |
| **framer-motion**   | 12.23.25 | 애니메이션 라이브러리               |
| **react-hook-form** | 7.68.0   | 폼 상태 관리                        |
| **zod**             | 3.23.8   | 스키마 검증                         |

### 2.5 개발 도구

| 도구                      | 버전   | 용도           |
| ------------------------- | ------ | -------------- |
| **Vitest**                | 4.0.15 | 단위 테스트    |
| **Playwright**            | 1.48.0 | E2E 테스트     |
| **ESLint**                | 9      | 코드 품질 검사 |
| **@next/bundle-analyzer** | 16.0.3 | 번들 분석      |

---

## 3. 아키텍처 패턴

### 3.1 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│              Presentation Layer (Next.js App Router)         │
│  ┌──────────────┬──────────────┬──────────────┐            │
│  │ (admin)/     │ (student)/    │ (parent)/    │            │
│  │ 관리자 페이지│ 학생 페이지   │ 학부모 페이지 │            │
│  └──────────────┴──────────────┴──────────────┘            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ (Server Actions, API Routes)
                       │
┌──────────────────────▼──────────────────────────────────────┐
│           Business Logic Layer (lib/domains/*)              │
│  ┌──────────────┬──────────────┬──────────────┐            │
│  │  Service      │  Repository   │  Actions      │            │
│  │  (검증,규칙)  │  (쿼리 작성)  │  (UI 호출)   │            │
│  └──────────────┴──────────────┴──────────────┘            │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│           Data Access Layer (lib/data/*)                    │
│              Supabase 클라이언트 호출                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    Supabase (PostgreSQL)                    │
│              데이터베이스 + 인증 + 스토리지                  │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 설계 패턴

#### Domain-Driven Design (DDD)

프로젝트는 **25개의 도메인**으로 분리되어 있으며, 각 도메인은 독립적인 비즈니스 로직을 포함합니다.

**주요 도메인**:

- `plan/` - 학습 계획 생성 및 관리 (가장 복잡)
- `camp/` - 캠프 관리 (가장 큰 도메인)
- `today/` - 컨테이너 기반 일일 플랜
- `content/` - 마스터/학생 콘텐츠 관리
- `score/` - 성적 관리 (모의고사, 학교시험, 내신)
- `student/` - 학생 관리
- `attendance/` - 출석 관리
- `school/` - 학교/대학/지역 관리
- 기타 17개 도메인

#### Repository Pattern

각 도메인은 `repository.ts` 파일을 통해 데이터 접근을 추상화합니다.

```typescript
// lib/domains/plan/repository.ts
export class PlanRepository {
  async createPlanGroup(data: CreatePlanGroupInput): Promise<PlanGroup> {
    // Supabase 쿼리 작성
  }

  async getPlanGroupById(id: string): Promise<PlanGroup | null> {
    // 데이터 조회
  }
}
```

#### Service Layer Pattern

비즈니스 로직은 `services/` 디렉토리에서 관리됩니다.

```typescript
// lib/domains/plan/services/planCreationService.ts
export class PlanCreationService {
  async createPlanGroup(input: CreatePlanGroupInput): Promise<PlanGroup> {
    // 1. 검증
    // 2. 비즈니스 규칙 적용
    // 3. Repository 호출
    // 4. 트랜잭션 처리
  }
}
```

#### Server Actions Pattern

Next.js Server Actions를 사용하여 서버 사이드 로직을 처리합니다.

```typescript
// app/(student)/actions/planActions.ts
"use server";

export async function createPlanGroup(formData: FormData) {
  const service = createPlanCreationService();
  return await service.createPlanGroup(parseFormData(formData));
}
```

### 3.3 데이터 흐름

```
1. 사용자 액션 (클라이언트)
   ↓
2. Server Action 호출
   ↓
3. Service Layer (비즈니스 로직)
   ↓
4. Repository Layer (데이터 접근)
   ↓
5. Supabase 클라이언트
   ↓
6. PostgreSQL 데이터베이스
   ↓
7. 응답 반환 (클라이언트)
```

---

## 4. 디렉토리 구조 분석

### 4.1 루트 디렉토리

```
project/
├── app/                    # Next.js App Router 페이지 및 라우트
├── components/             # 재사용 가능한 UI 컴포넌트
├── lib/                    # 유틸리티, 설정, 타입 정의
├── public/                 # 정적 파일 (이미지, 아이콘 등)
├── scripts/                # 유틸리티 스크립트
├── supabase/               # Supabase 마이그레이션 파일
├── docs/                   # 프로젝트 문서
├── tests/                  # E2E 테스트
└── __tests__/              # 단위 테스트
```

### 4.2 app/ 디렉토리 구조

```
app/
├── (admin)/                # 관리자 전용 페이지
│   └── admin/
│       ├── dashboard/      # 관리자 대시보드
│       ├── students/       # 학생 관리
│       ├── plan-creation/  # 플랜 생성
│       ├── camp-templates/ # 캠프 템플릿
│       └── ...
├── (student)/              # 학생 전용 페이지
│   ├── dashboard/          # 학생 대시보드
│   ├── today/              # 오늘의 학습 계획
│   ├── plan/               # 학습 계획 관리
│   ├── scores/             # 성적 관리
│   ├── contents/           # 학습 콘텐츠
│   └── ...
├── (parent)/               # 학부모 전용 페이지
│   └── parent/
│       ├── dashboard/      # 학부모 대시보드
│       ├── scores/         # 자녀 성적 조회
│       └── ...
├── (superadmin)/           # 슈퍼 관리자 전용 페이지
│   └── superadmin/
│       ├── dashboard/      # 슈퍼 관리자 대시보드
│       ├── tenants/        # 테넌트 관리
│       └── ...
├── actions/                # Server Actions
├── api/                    # API Routes
├── login/                  # 로그인 페이지
├── signup/                 # 회원가입 페이지
└── layout.tsx              # 루트 레이아웃
```

### 4.3 components/ 디렉토리 구조

```
components/
├── atoms/                  # 기본 원자 컴포넌트
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Badge.tsx
│   └── ...
├── molecules/              # 분자 컴포넌트
│   ├── Card.tsx
│   ├── FormField.tsx
│   ├── SectionHeader.tsx
│   └── ...
├── organisms/              # 유기체 컴포넌트
│   ├── DataTable.tsx
│   ├── Pagination.tsx
│   └── ...
├── forms/                  # 폼 관련 컴포넌트
│   ├── BaseBookSelector.tsx
│   └── book-selector/
├── ui/                     # UI 라이브러리 컴포넌트
│   ├── Dialog.tsx
│   ├── ToastProvider.tsx
│   └── ...
├── layout/                 # 레이아웃 컴포넌트
│   ├── RoleBasedLayout.tsx
│   └── ...
└── navigation/             # 네비게이션 컴포넌트
    ├── global/
    └── student/
```

### 4.4 lib/ 디렉토리 구조

```
lib/
├── domains/                # 도메인별 비즈니스 로직 (25개 도메인)
│   ├── plan/               # 학습 계획 도메인
│   │   ├── services/       # 서비스 레이어
│   │   ├── repository.ts   # 데이터 접근
│   │   ├── types.ts        # 타입 정의
│   │   └── ...
│   ├── camp/               # 캠프 도메인
│   ├── today/              # 오늘의 학습 도메인
│   └── ...
├── data/                   # 데이터 페칭 함수
│   ├── students.ts
│   ├── studentPlans.ts
│   └── ...
├── hooks/                  # 커스텀 React 훅 (50개)
│   ├── useStudent.ts
│   ├── usePlanGroup.ts
│   └── ...
├── supabase/               # Supabase 클라이언트
│   ├── client.ts           # 브라우저 클라이언트
│   ├── server.ts           # 서버 클라이언트
│   └── admin.ts            # 관리자 클라이언트
├── auth/                   # 인증 유틸리티
│   ├── getCurrentUser.ts
│   ├── getCurrentUserRole.ts
│   └── ...
├── utils/                  # 유틸리티 함수 (83개)
│   ├── formatNumber.ts
│   ├── dateUtils.ts
│   └── ...
├── types/                  # 타입 정의 (35개)
│   ├── plan.ts
│   ├── student.ts
│   └── ...
└── providers/              # React Provider
    ├── QueryProvider.tsx
    └── ThemeProvider.tsx
```

---

## 5. 주요 기능 모듈

### 5.1 학습 계획 관리 (Plan Management)

**위치**: `lib/domains/plan/`, `app/(student)/plan/`, `app/(admin)/admin/plan-creation/`

**주요 기능**:

- 학습 계획 그룹 생성 및 관리
- 자동 스케줄링 (시간 제약 조건 고려)
- 플랜 위자드 (단계별 생성)
- 플랜 캘린더 뷰
- 플랜 통계 및 분석

**핵심 컴포넌트**:

- `PlanGroupSelector` - 플랜 그룹 선택
- `PlannerSelector` - 플래너 선택
- `PlanCalendar` - 캘린더 뷰
- `PlanWizard` - 플랜 생성 위자드

### 5.2 오늘의 학습 계획 (Today Plans)

**위치**: `lib/domains/today/`, `app/(student)/today/`

**주요 기능**:

- 컨테이너 기반 일일 플랜 관리
- 드래그 앤 드롭으로 플랜 이동
- 실시간 진행 상황 추적
- 미완료 플랜 자동 처리

**컨테이너 시스템**:

- `Today` - 오늘 할 일
- `Unfinished` - 미완료 항목
- `Weekly` - 주간 계획
- `Completed` - 완료된 항목

### 5.3 성적 관리 (Score Management)

**위치**: `lib/domains/score/`, `app/(student)/scores/`

**주요 기능**:

- 모의고사 성적 입력 및 분석
- 학교 시험 성적 관리
- 내신 성적 관리
- 성적 대시보드 (통계 및 차트)

**성적 종류**:

- `mock_scores` - 모의고사
- `school_scores` - 학교 시험
- `internal_scores` - 내신

### 5.4 캠프 관리 (Camp Management)

**위치**: `lib/domains/camp/`, `app/(admin)/admin/camp-templates/`

**주요 기능**:

- 캠프 템플릿 생성 및 관리
- 캠프 초대 및 참가자 관리
- 캠프 학습 계획 자동 생성
- 캠프 출석 관리
- 캠프 통계 및 리포트

### 5.5 출석 관리 (Attendance Management)

**위치**: `lib/domains/attendance/`, `app/(admin)/admin/attendance/`

**주요 기능**:

- QR 코드 기반 출석 체크
- 출석 기록 관리
- 출석 통계 및 리포트
- SMS 알림 (선택적)

### 5.6 콘텐츠 관리 (Content Management)

**위치**: `lib/domains/content/`, `app/(student)/contents/`

**주요 기능**:

- 마스터 콘텐츠 관리 (교재, 강의)
- 학생 콘텐츠 등록
- 콘텐츠 검색 및 필터링
- 콘텐츠 상세 정보

**콘텐츠 종류**:

- `master_books` - 마스터 교재
- `master_lectures` - 마스터 강의
- `master_custom_contents` - 마스터 커스텀 콘텐츠
- `student_books` - 학생 교재
- `student_lectures` - 학생 강의

---

## 6. 데이터베이스 구조

### 6.1 멀티테넌트 구조

시스템은 **멀티테넌트 아키텍처**를 기반으로 설계되어 있으며, 모든 주요 테이블에 `tenant_id`가 포함되어 있습니다.

```
tenants (기관)
  ├── users (통합 사용자)
  ├── students (학생)
  ├── admin_users (관리자)
  ├── parent_users (학부모)
  └── ... (모든 하위 테이블)
```

### 6.2 핵심 테이블

#### 사용자 및 인증

| 테이블                 | 설명             | 주요 필드                          |
| ---------------------- | ---------------- | ---------------------------------- |
| `tenants`              | 기관 정보        | id, name, type, status             |
| `users`                | 통합 사용자      | id, email, role, tenant_id         |
| `students`             | 학생 정보        | id, name, grade, school_id         |
| `parent_users`         | 학부모 정보      | id, name, phone                    |
| `parent_student_links` | 학생-학부모 연결 | parent_id, student_id, is_approved |

#### 학습 계획

| 테이블                | 설명             | 주요 필드                                        |
| --------------------- | ---------------- | ------------------------------------------------ |
| `plan_groups`         | 플랜 그룹        | id, student_id, period_start, period_end, status |
| `student_plan`        | 개별 플랜        | id, plan_group_id, plan_date, progress, status   |
| `plan_group_contents` | 플랜 그룹 콘텐츠 | plan_group_id, content_id, display_order         |
| `plan_group_items`    | 논리 플랜 아이템 | plan_group_id, content_id, subject_type          |
| `plan_exclusions`     | 플랜 제외일      | plan_group_id, exclusion_date                    |

#### 성적

| 테이블            | 설명           | 주요 필드                             |
| ----------------- | -------------- | ------------------------------------- |
| `mock_scores`     | 모의고사 성적  | student_id, exam_date, subject, score |
| `school_scores`   | 학교 시험 성적 | student_id, exam_date, subject, score |
| `internal_scores` | 내신 성적      | student_id, term, subject, score      |

#### 콘텐츠

| 테이블             | 설명        | 주요 필드                           |
| ------------------ | ----------- | ----------------------------------- |
| `master_books`     | 마스터 교재 | id, title, publisher_id, subject_id |
| `master_lectures`  | 마스터 강의 | id, title, platform_id, subject_id  |
| `student_books`    | 학생 교재   | id, student_id, master_book_id      |
| `student_lectures` | 학생 강의   | id, student_id, master_lecture_id   |

#### 캠프

| 테이블             | 설명           | 주요 필드                                |
| ------------------ | -------------- | ---------------------------------------- |
| `camp_templates`   | 캠프 템플릿    | id, name, tenant_id, block_set_id        |
| `camp_invitations` | 캠프 초대      | id, camp_template_id, student_id, status |
| `camp_learning`    | 캠프 학습 기록 | camp_invitation_id, date, content_id     |

### 6.3 테이블 관계도

```
plan_groups (1) ──┬── (N) student_plan
                  ├── (N) plan_group_contents
                  ├── (N) plan_group_exclusions
                  └── (N) academy_schedules

student_plan ──── content_id ──── student_contents
                                        │
                                        └── master_contents (복사 원본)

students (1) ──── (N) plan_groups
              └── (N) mock_scores
              └── (N) school_scores
              └── (N) student_books
```

### 6.4 마이그레이션 관리

**위치**: `supabase/migrations/`

- 총 **126개** 마이그레이션 파일
- 타임스탬프 기반 버전 관리
- 최신 스키마: `20260108100001_migrate_adhoc_to_student_plan.sql`

---

## 7. 인증 및 보안

### 7.1 인증 시스템

**Supabase Auth**를 사용하여 인증을 처리합니다.

**인증 흐름**:

1. 사용자 로그인 (`/login`)
2. Supabase Auth 인증
3. 세션 쿠키 저장
4. 역할 기반 리다이렉트

**인증 유틸리티**:

- `lib/auth/getCurrentUser.ts` - 현재 사용자 정보
- `lib/auth/getCurrentUserRole.ts` - 사용자 역할 확인
- `lib/auth/sessionManager.ts` - 세션 관리

### 7.2 역할 기반 접근 제어 (RBAC)

**역할**:

- `superadmin` - 시스템 관리자
- `admin` - 테넌트 관리자
- `consultant` - 담당자
- `student` - 학생
- `parent` - 학부모

**권한 확인**:

```typescript
// lib/auth/getCurrentUserRole.ts
export async function getCurrentUserRole() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // user.user_metadata.role 또는 users 테이블에서 조회
  return { userId: user?.id, role: user?.role };
}
```

### 7.3 Row Level Security (RLS)

Supabase의 RLS 정책을 사용하여 데이터 접근을 제어합니다.

**RLS 정책 예시**:

```sql
-- 학생은 자신의 플랜만 조회 가능
CREATE POLICY "Students can view their own plans"
ON student_plan
FOR SELECT
USING (auth.uid() = student_id);

-- 관리자는 같은 테넌트의 모든 플랜 조회 가능
CREATE POLICY "Admins can view plans in their tenant"
ON student_plan
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE id = auth.uid()
    AND tenant_id = (SELECT tenant_id FROM students WHERE id = student_plan.student_id)
  )
);
```

### 7.4 Rate Limiting

API 요청 제한을 처리합니다.

**위치**: `lib/auth/rateLimitHandler.ts`

```typescript
export async function retryWithBackoff(
  fn: () => Promise<Response>,
  maxRetries: number,
  initialDelay: number
): Promise<Response> {
  // Rate limit 에러 시 백오프 전략으로 재시도
}
```

---

## 8. 상태 관리

### 8.1 서버 상태 관리 (React Query)

**위치**: `lib/providers/QueryProvider.tsx`

**설정**:

- `staleTime`: 1분 (동적 데이터 기준)
- `gcTime`: 10분 (캐시 유지 시간)
- `retry`: 1회
- `refetchOnWindowFocus`: false
- `refetchOnReconnect`: true

**사용 예시**:

```typescript
import { useQuery } from "@tanstack/react-query";

const { data, isLoading } = useQuery({
  queryKey: ["students"],
  queryFn: () => fetchStudents(),
});
```

### 8.2 클라이언트 상태 관리

#### React Context

**주요 Context**:

- `ThemeProvider` - 다크모드 관리
- `AuthContext` - 인증 상태
- `SidebarContext` - 사이드바 상태
- `SubjectHierarchyContext` - 과목 계층 구조

#### Zustand (선택적 사용)

글로벌 상태가 필요한 경우 Zustand를 사용합니다.

```typescript
import { create } from "zustand";

interface Store {
  count: number;
  increment: () => void;
}

export const useStore = create<Store>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));
```

### 8.3 폼 상태 관리

**React Hook Form**을 사용하여 폼 상태를 관리합니다.

```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const form = useForm({
  resolver: zodResolver(schema),
  defaultValues: { name: "" },
});
```

---

## 9. 성능 최적화

### 9.1 코드 스플리팅

**동적 Import**:

```typescript
const HeavyComponent = dynamic(() => import("./HeavyComponent"), {
  loading: () => <LoadingSkeleton />,
});
```

**Lazy Loading**:

- `LazyRecharts` - 차트 라이브러리 지연 로딩
- `ReactQueryDevtools` - 개발 환경에서만 로드

### 9.2 이미지 최적화

**Next.js Image 컴포넌트**:

```typescript
<Image
  src="/image.jpg"
  alt="설명"
  width={300}
  height={200}
  priority={isAboveFold}
/>
```

**설정** (`next.config.ts`):

- AVIF, WebP 포맷 지원
- 자동 크기 조정
- 외부 이미지 도메인 허용

### 9.3 캐싱 전략

**React Query 캐싱**:

- 쿼리 결과 자동 캐싱
- `staleTime` 및 `gcTime` 설정

**서버 사이드 캐싱**:

```typescript
import { unstable_cache } from "next/cache";

const getCachedData = unstable_cache(async () => fetchData(), ["cache-key"], {
  revalidate: 3600,
});
```

### 9.4 번들 최적화

**패키지 최적화** (`next.config.ts`):

```typescript
optimizePackageImports: [
  "lucide-react",
  "recharts",
  "@supabase/supabase-js",
  // ...
];
```

**번들 분석**:

```bash
npm run analyze  # ANALYZE=true next build
```

### 9.5 PWA 지원

**위치**: `next.config.ts`

**기능**:

- 오프라인 지원
- 설치 프롬프트
- 서비스 워커
- 캐싱 전략

---

## 10. 개발 가이드

### 10.1 개발 환경 설정

**필수 요구사항**:

- Node.js 18.x 이상
- npm 또는 pnpm
- Supabase 계정 및 프로젝트

**환경 변수** (`.env.local`):

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 10.2 개발 서버 실행

```bash
npm run dev      # 개발 서버 시작 (포트 3000)
npm run build    # 프로덕션 빌드
npm run start    # 프로덕션 서버 시작
npm run lint     # ESLint 실행
npm run analyze  # 번들 분석
```

### 10.3 테스트

```bash
npm run test        # 단위 테스트 (Vitest)
npm run test:watch  # 테스트 감시 모드
npm run test:e2e    # E2E 테스트 (Playwright)
```

### 10.4 코딩 컨벤션

#### 컴포넌트 네이밍

- **형식**: PascalCase
- **패턴**: `[Domain][Role][Variant|State]`
- **예시**: `ProductList`, `AiToolsSidebar`, `AuthLoginForm`

#### Export 규칙

- **단일 export**: `export default`
- **다중 export**: named export
- **페이지 컴포넌트**: 항상 `export default`

#### 스타일링 규칙

- **Tailwind CSS 우선 사용**
- **인라인 style 금지**
- **Spacing-First 정책** (gap 우선, margin 금지)

```jsx
// ✅ 좋은 예
<div className="p-6">
  <div className="flex flex-col gap-4">
    <Card />
    <Card />
  </div>
</div>

// ❌ 나쁜 예
<div>
  <Card className="mb-4" />
  <Card />
</div>
```

### 10.5 타입 안전성

#### `any` 타입 사용 금지

```typescript
// ❌ 나쁜 예
function processData(data: any) {
  return data.map((item: any) => item.id);
}

// ✅ 좋은 예
interface DataItem {
  id: string;
  name: string;
}

function processData(data: DataItem[]) {
  return data.map((item) => item.id);
}
```

#### Null 처리

```typescript
// ✅ Optional Chaining 사용
const studentName = student?.name ?? "이름 없음";

// ✅ Null-safe 배열 처리
const students = (data ?? []) as StudentRow[];
```

### 10.6 파일 구조 규칙

```
components/
├── CourseCard.tsx           # 단일 컴포넌트
├── CourseList.tsx          # 리스트 컴포넌트
└── CourseDetailModal.tsx   # 모달 컴포넌트

hooks/
├── useCourses.ts           # 데이터 페칭 훅
└── useCourseFilter.ts     # 필터링 로직 훅

utils/
├── courseTransform.ts      # 데이터 변환 함수
└── dateFormat.ts           # 날짜 포맷팅
```

### 10.7 주요 개발 가이드라인

자세한 개발 가이드라인은 다음 파일을 참고하세요:

- `.cursor/rules/project_rule.mdc` - 코딩 컨벤션 및 규칙
- `docs/COMPONENT_GUIDE.md` - 컴포넌트 사용 가이드
- `README.md` - 프로젝트 개요

---

## 11. 주요 통계

### 11.1 코드베이스 규모

| 항목                  | 수량      |
| --------------------- | --------- |
| **도메인**            | 25개      |
| **커스텀 훅**         | 50개      |
| **유틸리티 함수**     | 83개      |
| **타입 정의**         | 35개      |
| **마이그레이션 파일** | 126개     |
| **테이블**            | 50개 이상 |

### 11.2 주요 디렉토리 크기

| 디렉토리                      | 파일 수 | 설명                         |
| ----------------------------- | ------- | ---------------------------- |
| `lib/domains/plan/`           | 114개   | 학습 계획 도메인 (가장 복잡) |
| `lib/domains/camp/`           | 28개    | 캠프 도메인 (가장 큰 도메인) |
| `app/(admin)/admin/students/` | 169개   | 학생 관리 페이지             |
| `app/(student)/plan/`         | 221개   | 학생 플랜 페이지             |

---

## 12. 향후 개선 사항

### 12.1 아키텍처 개선

- [ ] 에러 바운더리 추가
- [ ] 로딩 상태 통합 관리
- [ ] 접근성 개선 (ARIA 속성)

### 12.2 성능 최적화

- [ ] 서버 컴포넌트 활용 확대
- [ ] 데이터베이스 쿼리 최적화
- [ ] 번들 크기 추가 최적화

### 12.3 기능 개선

- [ ] 실시간 알림 시스템 강화
- [ ] AI 추천 엔진 개선
- [ ] 모바일 앱 지원 (PWA 확장)

---

## 13. 참고 문서

### 13.1 프로젝트 문서

- `README.md` - 프로젝트 개요
- `AGENTS.md` - 프로젝트 구조 상세 설명
- `docs/COMPONENT_GUIDE.md` - 컴포넌트 사용 가이드
- `.cursor/rules/project_rule.mdc` - 개발 가이드라인

### 13.2 분석 문서

- `docs/business-logic-analysis.md` - 비즈니스 로직 분석
- `docs/supabase-schema-analysis.md` - 데이터베이스 스키마 분석
- `docs/domain-based-architecture-guide.md` - 도메인 기반 아키텍처 가이드

### 13.3 외부 문서

- [Next.js 공식 문서](https://nextjs.org/docs)
- [Supabase 공식 문서](https://supabase.com/docs)
- [React Query 공식 문서](https://tanstack.com/query/latest)

---

**마지막 업데이트**: 2026-01-15  
**작성자**: AI Assistant  
**버전**: 1.0.0
