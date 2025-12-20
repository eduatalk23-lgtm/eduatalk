# Phase 9: 아키텍처 일관성 및 기술 부채 분석 보고서

**작성일**: 2025-01-15  
**분석 범위**: 전체 코드베이스 아키텍처 심층 분석  
**상태**: 🔍 분석 완료

---

## 📋 Executive Summary

이 보고서는 Next.js 14+ App Router 기반 교육 플랫폼의 아키텍처적 일관성, 성능 최적화, 유지보수성 관점에서 기술 부채를 분석하고 개선 방안을 제시합니다.

### 핵심 발견 사항

1. **Server Actions 구조 혼재 및 비즈니스 로직 혼재**: 레거시 Actions와 새로운 도메인 기반 Actions가 공존하며, 일부 Actions에 비즈니스 로직이 직접 포함됨
2. **과도한 동적 렌더링**: 90개 이상의 페이지와 모든 레이아웃 파일이 `force-dynamic`으로 인해 캐싱 이점 상실
3. **RBAC 중복 검증 및 Layout 레벨 검증 누락**: 416회의 `getCurrentUserRole` 호출, Layout에서 권한 검증 미수행으로 인한 중복 로직

---

## 🔴 Top 3 기술 부채 및 해결 방안

### 1. Server Actions 구조 혼재 및 마이그레이션 불완전

#### 문제점

**현재 상태**:

- ✅ 완전 마이그레이션: `school`, `score`, `attendance` 도메인
- 🔄 부분 마이그레이션: `plan` 도메인 (repository, service만 존재, actions는 분산)
- ❌ 미마이그레이션: `content`, `goal`, `auth`, `student`, `block`, `camp`, `tenant`, `subject`

**구조적 문제**:

```
app/actions/
├── scores.ts                    # ⚠️ DEPRECATED (레거시 student_scores 테이블)
├── scores-internal.ts           # 🔄 중간 단계 (lib/domains/score로 마이그레이션 필요)
│                                 # ⚠️ FormData 파싱 로직이 Actions에 있음 (적절함)
├── planActions.ts               # ❌ 비즈니스 로직 혼재 (날짜/요일 검증 등)
├── blocks.ts                     # ❌ 비즈니스 로직 혼재 (중복 확인, 개수 제한)
├── blockSets.ts                  # ❌ 비즈니스 로직 혼재 (중복 이름 확인)
├── smsActions.ts                 # ❌ 비즈니스 로직 혼재 (determineRecipientPhones)
├── students.ts                   # ❌ 도메인 구조 없음
└── ...

lib/domains/
├── school/                       # ✅ 완전 구현 (repository, service, actions)
├── score/                        # ✅ 완전 구현 (일부만 - 모의고사만)
├── attendance/                  # ✅ 완전 구현
├── plan/                        # 🔄 repository, service만 존재
│   ├── repository.ts
│   ├── service.ts
│   └── ❌ actions.ts 없음 (app/(student)/actions/planActions.ts에 분산)
└── ... (나머지는 index.ts만 존재)
```

**비즈니스 로직 혼재 문제**:

- `planActions.ts`: 날짜/요일 검증 로직이 Actions에 직접 포함
- `blocks.ts`, `blockSets.ts`: 중복 확인, 개수 제한 등 비즈니스 규칙이 Actions에 포함
- `smsActions.ts`: `determineRecipientPhones` 함수가 Actions 파일 내부에 정의됨
- 이상적인 구조: Actions는 FormData 파싱과 Service 호출만, 비즈니스 로직은 Service 레이어에

**영향**:

- 개발자가 어디서 함수를 찾아야 할지 혼란
- 동일한 도메인의 로직이 여러 위치에 분산
- 테스트 및 유지보수 어려움
- 타입 안전성 저하

#### 해결 방안

**Phase 1: Deprecated 코드 정리 (즉시 실행 가능)**

```typescript
// app/actions/scores.ts
// ✅ 이미 @deprecated 주석 있음
// ❌ 하지만 실제로 사용되지 않음 확인 필요
// → 완전히 제거 또는 사용처 확인 후 제거
```

**Phase 2: 중간 단계 Actions 마이그레이션 (우선순위: 높음)**

```typescript
// app/actions/scores-internal.ts → lib/domains/score/actions.ts로 통합
// 현재 scores-internal.ts는 7개 파일에서 사용 중:
// - app/(student)/scores/_components/ScoreFormModal.tsx
// - app/(student)/scores/school/.../DeleteSchoolScoreButton.tsx
// - app/(student)/scores/input/_components/MockScoreInput.tsx
// - app/(student)/scores/input/_components/InternalScoreInput.tsx
// - app/(student)/scores/[id]/edit/page.tsx
// - app/(student)/scores/_components/DeleteScoreButton.tsx
```

**Phase 3: Plan 도메인 완전 마이그레이션 (우선순위: 중간)**

```typescript
// lib/domains/plan/actions.ts 생성
// app/(student)/actions/planActions.ts의 함수들을 마이그레이션
// app/(student)/actions/plan-groups/* 의 함수들도 통합 검토
```

**Phase 4: 나머지 도메인 마이그레이션 (우선순위: 낮음)**

- `student`, `content`, `goal`, `block`, `camp`, `tenant`, `subject` 도메인 구조화

**예상 작업량**:

- Phase 1: 1일 (deprecated 코드 제거)
- Phase 2: 3일 (scores-internal.ts 마이그레이션)
- Phase 3: 5일 (plan 도메인 완전 마이그레이션)
- Phase 4: 15일 (나머지 도메인)

---

### 2. 과도한 `force-dynamic` 설정으로 인한 캐싱 이점 상실

#### 문제점

**현재 상태**:

- **90개 이상의 파일**에서 `export const dynamic = 'force-dynamic'` 사용
- **모든 레이아웃 파일**이 `force-dynamic`:
  - `app/(student)/layout.tsx`
  - `app/(admin)/layout.tsx`
  - `app/(parent)/layout.tsx`
  - `app/(superadmin)/layout.tsx`
- 인증이 필요한 모든 페이지가 동적 렌더링
- Layout 파일은 자주 변경되지 않으므로 캐싱 가능하지만 현재는 매 요청마다 렌더링

**성능 영향**:

- Next.js의 자동 캐싱 및 ISR(Incremental Static Regeneration) 활용 불가
- 매 요청마다 서버에서 렌더링 수행
- 데이터베이스 쿼리 중복 실행
- 응답 시간 증가 및 서버 부하 증가

**분석 결과**:

```typescript
// ❌ 불필요한 force-dynamic 예시
// app/(student)/dashboard/page.tsx
export const dynamic = "force-dynamic"; // 사용자별 데이터지만 캐싱 가능

// ✅ 개선 가능
export const revalidate = 60; // 60초마다 재검증
// 또는
export const dynamic = "auto"; // Next.js가 자동으로 결정
```

#### 해결 방안

**Phase 1: 레이아웃 파일 최적화 (즉시 실행 가능)**

```typescript
// app/(student)/layout.tsx
// ❌ 현재: export const dynamic = 'force-dynamic';
// ✅ 개선: export const revalidate = 300; (5분)
// 레이아웃은 자주 변경되지 않으므로 캐싱 가능
```

**Phase 2: 페이지별 캐싱 전략 수립**

```typescript
// 1. 정적 데이터가 많은 페이지
export const revalidate = 3600; // 1시간

// 2. 사용자별 데이터지만 자주 변경되지 않는 페이지
export const revalidate = 60; // 1분

// 3. 실시간 데이터가 필요한 페이지만
export const dynamic = "force-dynamic";
```

**Phase 3: 데이터 페칭 레벨에서 캐싱**

```typescript
// lib/data/*.ts 파일에서
import { unstable_cache } from "next/cache";

export const getStudents = unstable_cache(
  async (tenantId: string) => {
    // 데이터 페칭
  },
  ["students", tenantId],
  { revalidate: 300 } // 5분
);
```

**예상 성능 개선**:

- 페이지 로딩 시간: **30-50% 감소**
- 서버 부하: **40-60% 감소**
- 데이터베이스 쿼리: **50-70% 감소**

**예상 작업량**:

- Phase 1: 1일 (레이아웃 파일)
- Phase 2: 5일 (페이지별 전략 수립 및 적용)
- Phase 3: 3일 (데이터 페칭 레벨 캐싱)

---

### 3. RBAC 중복 검증 및 성능 저하

#### 문제점

**현재 상태**:

- `getCurrentUserRole` 함수가 **416회 호출** (172개 파일)
- 각 페이지에서 개별적으로 권한 검증 수행
- **Layout 파일에서 권한 검증 미수행**: 주석에 "middleware에서 처리"라고만 명시
- `RoleBasedLayout`은 클라이언트 컴포넌트로 권한 검증 불가
- Middleware와 페이지 레벨에서 이중 검증

**구조적 문제**:

```typescript
// ❌ 현재 패턴 (중복)
// middleware.ts
const role = await getUserRole(supabase, user.id);

// app/(student)/layout.tsx
// 주석: "인증 및 역할 검증은 middleware에서 처리"
// 실제: 권한 검증 없이 RoleBasedLayout에 role prop 전달 (하드코딩)

// app/(student)/today/page.tsx
const { userId, role } = await getCurrentUserRole(); // 중복 호출

// RoleBasedLayout은 클라이언트 컴포넌트로 권한 검증 불가
```

**성능 영향**:

- 동일한 요청 내에서 `getCurrentUserRole`이 여러 번 호출됨
- 데이터베이스 쿼리 중복 실행
- Next.js Request Memoization이 있지만, 여전히 불필요한 호출 존재

#### 해결 방안

**Phase 1: Request Memoization 활용 강화**

```typescript
// lib/auth/getCurrentUserRole.ts
// ✅ 이미 cache() 사용 중
import { cache } from "react";

export const getCurrentUserRole = cache(
  async (prefetchedUser?: User | null) => {
    // 동일한 요청 내에서는 한 번만 실행됨
  }
);
```

**Phase 2: Layout 레벨에서 권한 검증 통합 (즉시 실행 가능)**

```typescript
// app/(student)/layout.tsx
export default async function StudentLayout({ children }: { children: ReactNode }) {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || role !== 'student') {
    redirect('/login');
  }

  const tenantInfo = await getTenantInfo();

  // RoleBasedLayout에 role 전달 (중복 호출 방지)
  // 하위 페이지에서 getCurrentUserRole 호출 시 React cache()로 인해 재사용됨
  return (
    <RoleBasedLayout role={role} tenantInfo={tenantInfo} ...>
      {children}
    </RoleBasedLayout>
  );
}
```

**현재 문제점**:

- Layout 파일에서 role을 하드코딩으로 전달 (`role="student"`)
- 실제 사용자 역할을 확인하지 않음
- 각 페이지에서 `getCurrentUserRole`을 다시 호출하여 중복 발생

**Phase 3: 권한 검증 유틸리티 통합**

```typescript
// lib/auth/guards.ts
// ✅ 이미 requireAdminOrConsultant 존재
// → requireStudent, requireParent 등 추가

export async function requireStudent() {
  const { userId, role } = await getCurrentUserRole();
  if (!userId || role !== "student") {
    redirect("/login");
  }
  return { userId, role };
}
```

**Phase 4: Middleware와 Layout 간 역할 분담 명확화**

```typescript
// middleware.ts: 경로 기반 접근 제어만
// layout.tsx: 역할 기반 UI 렌더링 및 추가 검증
// page.tsx: 비즈니스 로직만 (권한 검증 최소화)
```

**예상 성능 개선**:

- `getCurrentUserRole` 호출: **50-70% 감소**
- 데이터베이스 쿼리: **40-60% 감소**
- 페이지 로딩 시간: **10-20% 감소**

**예상 작업량**:

- Phase 1: 완료 (이미 cache() 사용 중)
- Phase 2: 1일 (Layout 레벨 통합 - 즉시 실행 가능)
- Phase 3: 2일 (Guard 유틸리티 확장)
- Phase 4: 2일 (역할 분담 명확화)

**즉시 개선 가능 항목**:

- Layout 파일에서 `getCurrentUserRole` 호출하여 실제 role 확인
- 하위 페이지에서 `getCurrentUserRole` 호출 시 React cache()로 인해 재사용되어 중복 방지

---

## 📊 상세 분석 결과

### Server Actions 구조 분석

#### 완전 마이그레이션된 도메인

**school 도메인** ✅

```
lib/domains/school/
├── index.ts          # Public API
├── types.ts          # 타입 정의
├── validation.ts     # Zod 스키마
├── repository.ts     # 데이터 접근
├── service.ts        # 비즈니스 로직
└── actions.ts        # Server Actions
```

**score 도메인** ✅

```
lib/domains/score/
├── index.ts
├── types.ts
├── validation.ts
├── repository.ts
├── service.ts
└── actions.ts        # 일부만 구현 (모의고사만, 내신은 scores-internal.ts에)
```

**attendance 도메인** ✅

```
lib/domains/attendance/
├── index.ts
├── types.ts
├── repository.ts
├── service.ts
├── statistics.ts
└── utils.ts
```

#### 부분 마이그레이션된 도메인

**plan 도메인** 🔄

```
lib/domains/plan/
├── index.ts
├── types.ts
├── repository.ts     # ✅ 완료
├── service.ts        # ✅ 완료
└── ❌ actions.ts 없음

app/(student)/actions/
├── planActions.ts    # ❌ 여전히 사용 중
└── plan-groups/      # ❌ 분산된 Actions
```

#### 미마이그레이션 도메인

- `content`, `goal`, `auth`, `student`, `block`, `camp`, `tenant`, `subject`
- 모두 `index.ts`만 존재하며 기존 파일 re-export

---

### Supabase Client Usage 분석

#### 현재 상태

**✅ 잘 구현된 부분**:

- `createSupabaseServerClient`: RLS 적용 (일반 쿼리)
- `createSupabaseAdminClient`: RLS 우회 (서버 전용)
- `lib/supabase/clientSelector.ts`: RLS 우회 로직 중앙화

**⚠️ 개선 필요**:

- 일부 파일에서 여전히 직접 `createSupabaseAdminClient` 호출
- `clientSelector.ts`의 `getSupabaseClientForRLSBypass` 활용도 낮음

**권장 패턴**:

```typescript
// ✅ 좋은 예
import { getSupabaseClientForRLSBypass } from "@/lib/supabase/clientSelector";
const client = await getSupabaseClientForRLSBypass();

// ❌ 나쁜 예
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
const client = createSupabaseAdminClient(); // null 체크 누락 가능
```

---

### Domain Layer Pattern 일관성

#### 완전 구현된 도메인 (3개)

- `school`: repository, service, actions 모두 존재
- `score`: repository, service, actions 모두 존재 (일부만)
- `attendance`: repository, service 존재 (actions는 app/(admin)/actions에)

#### 부분 구현된 도메인 (1개)

- `plan`: repository, service만 존재

#### 미구현 도메인 (8개)

- `content`, `goal`, `auth`, `student`, `block`, `camp`, `tenant`, `subject`

**일관성 점수**: 3/12 = **25%**

---

## 🎯 우선순위별 개선 로드맵

### 즉시 실행 (1주일 이내)

1. **Deprecated 코드 제거**
   - `app/actions/scores.ts` 사용처 확인 후 제거
   - 사용되지 않는 deprecated 함수 제거

2. **레이아웃 파일 캐싱 최적화**
   - `app/(student)/layout.tsx` 등에서 `force-dynamic` 제거
   - `revalidate` 전략 적용

3. **Layout 레벨 권한 검증 통합**
   - 각 layout.tsx에서 `getCurrentUserRole` 호출
   - RoleBasedLayout에 role 전달하여 중복 호출 방지

### 단기 개선 (1개월 이내)

1. **scores-internal.ts 마이그레이션**
   - `lib/domains/score/actions.ts`로 통합
   - 7개 파일의 import 경로 변경

2. **페이지별 캐싱 전략 수립**
   - 정적/동적 데이터 분류
   - `revalidate` 값 최적화

3. **Plan 도메인 완전 마이그레이션**
   - `lib/domains/plan/actions.ts` 생성
   - `app/(student)/actions/planActions.ts` 마이그레이션

### 중장기 개선 (3개월 이내)

1. **나머지 도메인 마이그레이션**
   - `student`, `content`, `goal` 등 도메인 구조화
   - 우선순위: 사용 빈도 및 복잡도 기준

2. **전역 캐싱 전략 수립**
   - 데이터 페칭 레벨에서 `unstable_cache` 활용
   - React Query와의 통합 검토

3. **성능 모니터링 도입**
   - 페이지 로딩 시간 측정
   - 데이터베이스 쿼리 최적화

---

## 📈 예상 효과

### 성능 개선

- 페이지 로딩 시간: **30-50% 감소**
- 서버 부하: **40-60% 감소**
- 데이터베이스 쿼리: **50-70% 감소**

### 개발 생산성

- 코드 일관성: **25% → 80%** (도메인 구조 일관성)
- 유지보수성: **중간 → 높음**
- 타입 안전성: **향상**

### 보안

- RBAC 중복 검증 제거로 보안 로직 명확화
- 권한 검증 중앙화로 보안 허점 감소

---

## ✅ 체크리스트

### 즉시 실행 항목 (1주일 이내)

- [ ] `app/actions/scores.ts` 사용처 확인 및 제거
- [ ] 레이아웃 파일 `force-dynamic` 제거 및 `revalidate` 적용
- [ ] Layout 레벨 권한 검증 통합 (4개 layout 파일)
- [ ] 비즈니스 로직을 Service 레이어로 이동 (planActions, blocks, blockSets, smsActions)

### 단기 개선 항목

- [ ] `scores-internal.ts` 마이그레이션
- [ ] 페이지별 캐싱 전략 수립
- [ ] Plan 도메인 완전 마이그레이션

### 중장기 개선 항목

- [ ] 나머지 도메인 마이그레이션
- [ ] 전역 캐싱 전략 수립
- [ ] 성능 모니터링 도입

---

**다음 단계**: 사용자의 지시에 따라 특정 파일의 리팩토링을 시작합니다.
