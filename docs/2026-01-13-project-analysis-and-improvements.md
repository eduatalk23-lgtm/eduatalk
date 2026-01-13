# 프로젝트 종합 분석 및 개선 사항 보고서

**작성일**: 2026-01-13  
**분석 범위**: 전체 코드베이스  
**목적**: 프로젝트 전반의 아키텍처, 코드 품질, 성능, 유지보수성 관점에서 개선 사항 도출

---

## 📋 목차

1. [Executive Summary](#1-executive-summary)
2. [프로젝트 현황](#2-프로젝트-현황)
3. [아키텍처 분석](#3-아키텍처-분석)
4. [코드 품질 분석](#4-코드-품질-분석)
5. [성능 분석](#5-성능-분석)
6. [의존성 및 타입 안전성](#6-의존성-및-타입-안전성)
7. [테스트 및 문서화](#7-테스트-및-문서화)
8. [우선순위별 개선 로드맵](#8-우선순위별-개선-로드맵)

---

## 1. Executive Summary

### 1.1 프로젝트 개요

- **프로젝트명**: TimeLevelUp (Eduatalk)
- **프레임워크**: Next.js 16.0.10 (App Router)
- **언어**: TypeScript 5
- **스타일링**: Tailwind CSS 4
- **백엔드**: Supabase (PostgreSQL)
- **상태 관리**: React Query, Zustand
- **테스트**: Vitest, Playwright

### 1.2 핵심 발견 사항

#### 🔴 Critical (즉시 조치 필요)

1. **Server Actions 구조 혼재**: 레거시와 도메인 기반 구조가 공존하며, 비즈니스 로직이 Actions에 직접 포함됨
2. **과도한 동적 렌더링**: 90개 이상의 페이지가 `force-dynamic`으로 캐싱 이점 상실
3. **기술 부채 누적**: 1,212개의 TODO/FIXME 주석 발견

#### 🟡 High (단기 개선 필요)

4. **N+1 쿼리 패턴**: 일부 도메인에서 여전히 발생
5. **에러 처리 불일치**: 여러 패턴 혼재 (try-catch, throw, Result 타입)
6. **타입 안전성**: null 체크 부족, 타입 단언 과다 사용

#### 🟢 Medium (중기 개선 필요)

7. **테스트 커버리지**: E2E 테스트는 있으나 단위 테스트 부족
8. **문서화**: 개별 기능 문서는 많으나 아키텍처 문서 부족
9. **성능 모니터링**: 프로덕션 성능 측정 도구 부족

### 1.3 개선 효과 예상

- **성능**: 페이지 로딩 시간 30-50% 감소, 서버 부하 40-60% 감소
- **개발 생산성**: 코드 일관성 향상으로 개발 속도 20-30% 증가
- **유지보수성**: 아키텍처 통일로 버그 감소 및 리팩토링 용이성 향상

---

## 2. 프로젝트 현황

### 2.1 프로젝트 규모

```
프로젝트 구조:
├── app/                    # Next.js App Router (1,300+ 파일)
│   ├── (admin)/           # 관리자 페이지 (512 파일)
│   ├── (student)/          # 학생 페이지 (703 파일)
│   ├── (parent)/           # 부모 페이지 (28 파일)
│   └── (superadmin)/       # 슈퍼 관리자 페이지 (25 파일)
├── components/             # 재사용 컴포넌트
├── lib/                    # 비즈니스 로직 및 유틸리티
│   ├── domains/            # 도메인 기반 구조 (23개 도메인)
│   ├── plan/               # 레거시 플랜 로직
│   └── data/               # 레거시 데이터 레이어
├── supabase/               # 마이그레이션 파일 (136개)
└── docs/                   # 문서 (1,340개)
```

### 2.2 기술 스택

#### 프론트엔드
- **Next.js 16.0.10**: App Router, Server Components
- **React 19.2.0**: 최신 React 기능 활용
- **TypeScript 5**: 타입 안전성
- **Tailwind CSS 4**: 유틸리티 우선 스타일링

#### 백엔드
- **Supabase**: PostgreSQL, Auth, Realtime
- **Server Actions**: Next.js Server Actions 활용

#### 상태 관리
- **React Query 5.90.10**: 서버 상태 관리
- **Zustand 5.0.9**: 클라이언트 상태 관리

#### 개발 도구
- **Vitest**: 단위 테스트
- **Playwright**: E2E 테스트
- **ESLint**: 코드 품질 검사

### 2.3 도메인 구조

현재 **23개 도메인**이 `lib/domains/` 구조로 정리되어 있음:

```
lib/domains/
├── admin-plan/      # 관리자 플랜 관리
├── analysis/        # 학습 분석
├── attendance/      # 출석 관리 ✅ 완전 구현
├── auth/            # 인증
├── block/           # 블록 관리
├── camp/             # 캠프 관리
├── content/         # 콘텐츠 관리
├── plan/             # 플랜 관리 🔄 부분 구현
├── score/            # 성적 관리 ✅ 완전 구현
├── school/           # 학교 관리 ✅ 완전 구현
└── ... (13개 추가)
```

**구현 상태**:
- ✅ 완전 구현: `school`, `score`, `attendance` (3개)
- 🔄 부분 구현: `plan` (repository, service만 존재)
- ❌ 미구현: 나머지 19개 도메인

---

## 3. 아키텍처 분석

### 3.1 Server Actions 구조 혼재

#### 문제점

**현재 상태**:

```
app/actions/                    # 전역 레거시 Actions
├── scores.ts                  # ⚠️ DEPRECATED
├── scores-internal.ts          # 🔄 마이그레이션 필요
├── planActions.ts              # ❌ 비즈니스 로직 혼재
├── blocks.ts                   # ❌ 비즈니스 로직 혼재
└── ...

app/(student)/actions/          # 학생 전용 Actions
├── planActions.ts              # ❌ plan 도메인과 분리
└── plan-groups/               # ❌ plan 도메인과 분리

lib/domains/
├── school/                    # ✅ 완전 구현
│   ├── repository.ts
│   ├── service.ts
│   └── actions/
├── score/                     # ✅ 완전 구현
│   ├── repository.ts
│   ├── service.ts
│   └── actions/
└── plan/                      # 🔄 부분 구현
    ├── repository.ts
    ├── service.ts
    └── ❌ actions.ts 없음
```

**비즈니스 로직 혼재 예시**:

```typescript
// ❌ 나쁜 예: app/actions/planActions.ts
export async function createPlan(data: FormData) {
  // 비즈니스 로직이 Actions에 직접 포함
  const startDate = parseDate(data.get("start_date"));
  const endDate = parseDate(data.get("end_date"));
  
  // 날짜 검증 로직
  if (startDate >= endDate) {
    throw new Error("시작일은 종료일보다 이전이어야 합니다.");
  }
  
  // 요일 검증 로직
  const dayOfWeek = startDate.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    throw new Error("주말에는 플랜을 생성할 수 없습니다.");
  }
  
  // 데이터베이스 작업
  const { data: plan } = await supabase.from("plans").insert(...);
  return plan;
}
```

**이상적인 구조**:

```typescript
// ✅ 좋은 예: lib/domains/plan/service.ts
export async function validatePlanDates(
  startDate: Date,
  endDate: Date
): Promise<void> {
  if (startDate >= endDate) {
    throw new PlanValidationError("시작일은 종료일보다 이전이어야 합니다.");
  }
  
  const dayOfWeek = startDate.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    throw new PlanValidationError("주말에는 플랜을 생성할 수 없습니다.");
  }
}

// ✅ 좋은 예: lib/domains/plan/actions.ts
export async function createPlan(data: FormData) {
  const startDate = parseDate(data.get("start_date"));
  const endDate = parseDate(data.get("end_date"));
  
  // Service 레이어에서 검증
  await planService.validatePlanDates(startDate, endDate);
  
  // Service 레이어에서 생성
  return await planService.createPlan({
    startDate,
    endDate,
    // ...
  });
}
```

#### 영향

1. **개발자 혼란**: 어디서 함수를 찾아야 할지 불명확
2. **테스트 어려움**: 비즈니스 로직이 Actions에 있어 단위 테스트 어려움
3. **재사용성 저하**: 동일한 로직이 여러 위치에 분산
4. **타입 안전성 저하**: FormData 파싱과 비즈니스 로직이 혼재

#### 개선 방향

**Phase 1: Deprecated 코드 정리** (1일)
- `app/actions/scores.ts` 완전 제거 또는 사용처 확인 후 제거

**Phase 2: 중간 단계 Actions 마이그레이션** (3일)
- `app/actions/scores-internal.ts` → `lib/domains/score/actions.ts`로 통합

**Phase 3: Plan 도메인 완전 마이그레이션** (5일)
- `lib/domains/plan/actions.ts` 생성
- `app/(student)/actions/planActions.ts` 마이그레이션
- 비즈니스 로직을 Service 레이어로 추출

**Phase 4: 나머지 도메인 마이그레이션** (15일)
- `student`, `content`, `goal`, `block`, `camp`, `tenant`, `subject` 도메인 구조화

---

### 3.2 레이어 분리 불완전

#### 문제점

**현재 상태**: 일부 도메인만 완전한 레이어 분리

```
lib/domains/
├── school/          # ✅ Repository → Service → Actions
├── score/           # ✅ Repository → Service → Actions
├── attendance/      # ✅ Repository → Service → Actions
├── plan/            # 🔄 Repository → Service (Actions 없음)
└── ... (나머지는 index.ts만 존재)
```

**비즈니스 로직 혼재**:
- `app/actions/planActions.ts`: 날짜/요일 검증 로직이 Actions에 직접 포함
- `lib/plan/blocks.ts`: 중복 확인, 개수 제한 등 비즈니스 규칙이 Actions에 포함
- `lib/plan/blockSets.ts`: 중복 이름 확인 등 비즈니스 로직 혼재

#### 이상적인 구조

```typescript
lib/domains/{domain}/
├── repository.ts    # 순수 데이터 접근 (Supabase 쿼리)
├── service.ts       # 비즈니스 로직 (검증, 계산, 변환)
├── actions.ts       # Server Actions (FormData 파싱 + Service 호출)
├── types.ts         # 타입 정의
└── validation.ts    # 검증 로직 (선택적)
```

#### 개선 방향

1. **Phase 1**: Actions에서 비즈니스 로직 추출 → Service로 이동
2. **Phase 2**: Repository 패턴 완전 적용
3. **Phase 3**: 타입 정의 통합

---

### 3.3 레거시 코드와 신규 코드 혼재

#### 문제점

**이중 구조**:

```
lib/
├── plan/              # 레거시 플랜 생성 로직
│   ├── scheduler.ts
│   ├── 1730TimetableLogic.ts
│   └── ...
└── domains/plan/      # 신규 도메인 구조
    ├── repository.ts
    ├── service.ts
    └── services/       # 새로운 서비스 레이어
        ├── PlanGenerationOrchestrator.ts
        └── ...
```

**마이그레이션 미완료**:
- 일부 기능은 레거시 코드 사용
- 일부 기능은 신규 구조 사용
- 두 구조 간 데이터 변환 필요

#### 개선 방향

**점진적 마이그레이션 전략**:

1. **Phase 1**: 레거시 코드에 `@deprecated` 주석 추가
2. **Phase 2**: 신규 기능은 신규 구조만 사용
3. **Phase 3**: 레거시 코드를 신규 구조로 점진적 마이그레이션
4. **Phase 4**: 레거시 코드 제거

---

## 4. 코드 품질 분석

### 4.1 기술 부채 (TODO/FIXME)

#### 현황

- **총 1,212개의 TODO/FIXME 주석** 발견 (342개 파일)
- 주요 분포:
  - `lib/domains/`: 200+ 개
  - `app/`: 300+ 개
  - `lib/plan/`: 100+ 개
  - `docs/`: 400+ 개 (문서화 TODO 포함)

#### 주요 카테고리

1. **리팩토링 필요**: 400+ 개
   - 레거시 코드 마이그레이션
   - 중복 코드 제거
   - 타입 안전성 개선

2. **성능 최적화**: 200+ 개
   - N+1 쿼리 개선
   - 캐싱 추가
   - 불필요한 재계산 제거

3. **기능 추가**: 300+ 개
   - 미완성 기능
   - 향후 개선 사항

4. **버그 수정**: 100+ 개
   - 알려진 이슈
   - 엣지 케이스 처리

#### 개선 방향

**우선순위별 정리**:

1. **Critical**: 버그 수정 관련 TODO (즉시 처리)
2. **High**: 리팩토링 및 성능 최적화 (단기 처리)
3. **Medium**: 기능 추가 (중기 처리)
4. **Low**: 문서화 및 개선 제안 (장기 처리)

---

### 4.2 에러 처리 불일치

#### 문제점

**여러 패턴 혼재**:

```typescript
// 패턴 1: try-catch + throw
try {
  const result = await doSomething();
} catch (error) {
  throw new Error("에러 발생");
}

// 패턴 2: Result 타입
type Result<T> = { success: true; data: T } | { success: false; error: string };
const result = await doSomething();
if (!result.success) {
  return { success: false, error: result.error };
}

// 패턴 3: AppError 사용
throw new AppError("에러 발생", ErrorCode.NOT_FOUND, 404);

// 패턴 4: PlanGroupError 사용
throw new PlanGroupError("플랜 그룹을 찾을 수 없습니다.", ...);
```

**현재 에러 처리 시스템**:

- `lib/errors/handler.ts`: `AppError`, `ErrorCode` 정의
- `lib/errors/planGroupErrors.ts`: `PlanGroupError` 정의
- `lib/data/core/errorHandler.ts`: `StructuredError` 정의
- `lib/utils/errorHandling.ts`: 추가 에러 처리 유틸리티

#### 개선 방향

**통일된 에러 처리 패턴**:

```typescript
// ✅ 도메인별 에러 타입 사용
// lib/domains/{domain}/errors.ts
export class PlanError extends AppError {
  constructor(message: string, code: PlanErrorCode, context?: Record<string, unknown>) {
    super(message, code, 400, true, context);
  }
}

// ✅ Service 레이어에서 사용
export async function getPlanById(id: string): Promise<Plan> {
  const plan = await repository.findById(id);
  if (!plan) {
    throw new PlanError("플랜을 찾을 수 없습니다.", PlanErrorCode.NOT_FOUND, { id });
  }
  return plan;
}

// ✅ Actions에서 에러 처리
export const getPlan = withErrorHandling(async (id: string) => {
  return await planService.getPlanById(id);
});
```

---

### 4.3 타입 안전성 문제

#### 문제점

**null 체크 부족**:

```typescript
// ❌ 나쁜 예
const { data } = await supabase.from("students").select("*");
const firstStudent = data[0]; // Error: 'data' is possibly 'null'
const name = firstStudent.name; // Error: 'firstStudent' is possibly 'undefined'
```

**타입 단언 과다 사용**:

```typescript
// ❌ 나쁜 예
const student = data as StudentRow;
const students = (data ?? []) as StudentRow[];
```

#### 개선 방향

**타입 안전한 접근**:

```typescript
// ✅ 좋은 예: Optional Chaining + Nullish Coalescing
const { data, error } = await supabase.from("students").select("*");
if (error) {
  throw new AppError("학생 조회 실패", ErrorCode.DATABASE_ERROR, 500);
}

const students = data ?? [];
if (students.length === 0) {
  return [];
}

const firstStudent = students[0];
const name = firstStudent?.name ?? "이름 없음";

// ✅ 좋은 예: 타입 가드 함수
function isValidStudent(data: unknown): data is StudentRow {
  return (
    typeof data === "object" &&
    data !== null &&
    "id" in data &&
    "name" in data
  );
}

if (isValidStudent(data)) {
  // 타입이 좁혀짐
  const name = data.name;
}
```

---

## 5. 성능 분석

### 5.1 과도한 동적 렌더링

#### 문제점

**현재 상태**:
- **90개 이상의 파일**에서 `export const dynamic = 'force-dynamic'` 사용
- **모든 레이아웃 파일**이 `force-dynamic`:
  - `app/(student)/layout.tsx`
  - `app/(admin)/layout.tsx`
  - `app/(parent)/layout.tsx`
  - `app/(superadmin)/layout.tsx`

**성능 영향**:
- Next.js의 자동 캐싱 및 ISR 활용 불가
- 매 요청마다 서버에서 렌더링 수행
- 데이터베이스 쿼리 중복 실행
- 응답 시간 증가 및 서버 부하 증가

#### 개선 방향

**캐싱 전략 수립**:

```typescript
// ✅ 레이아웃 파일
export const revalidate = 300; // 5분

// ✅ 정적 데이터가 많은 페이지
export const revalidate = 3600; // 1시간

// ✅ 사용자별 데이터지만 자주 변경되지 않는 페이지
export const revalidate = 60; // 1분

// ✅ 실시간 데이터가 필요한 페이지만
export const dynamic = "force-dynamic";
```

**예상 성능 개선**:
- 페이지 로딩 시간: **30-50% 감소**
- 서버 부하: **40-60% 감소**
- 데이터베이스 쿼리: **50-70% 감소**

---

### 5.2 N+1 쿼리 패턴

#### 문제점

**현재 상태**:
- 대부분 배치 처리로 해결됨
- 일부 여전히 미해결:
  - Parent 도메인: 부모-학생 연결 조회 시 각 부모별 학생 수를 별도로 계산
  - Score 조회: 과목별 점수 상세 조회 시 각 과목마다 별도 쿼리

**예시**:

```typescript
// ❌ 나쁜 예: N+1 쿼리
const planGroups = await getPlanGroups(filters);
for (const group of planGroups) {
  const contents = await getPlanContents(group.id); // N+1!
}
```

#### 개선 방향

**배치 쿼리 사용**:

```typescript
// ✅ 좋은 예: 배치 쿼리
const planGroups = await getPlanGroups(filters);
const groupIds = planGroups.map((g) => g.id);
const allContents = await getPlanContentsBatch(groupIds);

// 그룹별로 매핑
const contentsMap = new Map(
  allContents.map((c) => [c.plan_group_id, c])
);

for (const group of planGroups) {
  const contents = contentsMap.get(group.id) ?? [];
  // ...
}
```

---

### 5.3 불필요한 재계산

#### 문제점

**캐싱 부족**:

```typescript
// ❌ 나쁜 예: 매번 재계산
export async function getWeeklyMetrics(...) {
  const studyTime = await getStudyTime(...);
  const planCompletion = await getPlanCompletion(...);
  const weakSubjects = await getWeakSubjects(...);
  // 매번 모든 메트릭을 계산
}
```

#### 개선 방향

**캐싱 추가**:

```typescript
// ✅ 좋은 예: 캐싱 사용
import { unstable_cache } from "next/cache";

export const getWeeklyMetrics = unstable_cache(
  async (studentId: string, weekStart: Date) => {
    const studyTime = await getStudyTime(studentId, weekStart);
    const planCompletion = await getPlanCompletion(studentId, weekStart);
    const weakSubjects = await getWeakSubjects(studentId, weekStart);
    return { studyTime, planCompletion, weakSubjects };
  },
  ["weekly-metrics"],
  { revalidate: 300 } // 5분
);
```

---

## 6. 의존성 및 타입 안전성

### 6.1 도메인 간 경계 불명확

#### 문제점

**크로스 도메인 로직 분산**:

```typescript
// lib/coaching/getWeeklyMetrics.ts
import { getWeakSubjects } from "@/lib/metrics/getWeakSubjects";
import { getPlanCompletion } from "@/lib/metrics/getPlanCompletion";
import { getGoalStatus } from "@/lib/metrics/getGoalStatus";
// 여러 도메인의 함수를 직접 import
```

**의존성 방향 불명확**:
- 순환 의존성 위험
- 리팩토링 어려움
- 테스트 복잡도 증가

#### 개선 방향

**인터페이스 기반 의존성 주입**:

```typescript
// ✅ 인터페이스 정의
interface MetricsService {
  getPlanCompletion(...): Promise<PlanCompletionMetrics>;
  getWeakSubjects(...): Promise<WeakSubjectMetrics>;
}

// ✅ 의존성 주입
export async function getWeeklyMetrics(
  supabase: SupabaseServerClient,
  studentId: string,
  metricsService: MetricsService
) {
  // ...
}
```

---

### 6.2 타입 안전성 개선 필요

#### 문제점

1. **null 체크 부족**: Supabase 응답에서 `null | Type` 형태가 자주 발생
2. **타입 단언 과다 사용**: `as` 키워드 남용
3. **any 타입 사용**: 일부 레거시 코드에서 `any` 사용

#### 개선 방향

1. **Optional Chaining + Nullish Coalescing** 적극 활용
2. **타입 가드 함수** 사용
3. **명시적 타입 정의** 및 `any` 제거

---

## 7. 테스트 및 문서화

### 7.1 테스트 커버리지

#### 현황

- **E2E 테스트**: Playwright로 17개 테스트 파일 존재
- **단위 테스트**: Vitest로 일부 테스트 존재
- **통합 테스트**: 일부 도메인에만 존재

#### 개선 방향

1. **단위 테스트 커버리지 향상**: Service 레이어 중심
2. **통합 테스트 확대**: Repository + Service 조합
3. **E2E 테스트 확대**: 주요 사용자 시나리오

---

### 7.2 문서화

#### 현황

- **기능 문서**: 1,340개의 문서 파일 존재
- **아키텍처 문서**: 일부 존재하나 통합 문서 부족
- **API 문서**: Server Actions 문서화 부족

#### 개선 방향

1. **아키텍처 문서 통합**: 전체 아키텍처 개요 문서
2. **API 문서화**: Server Actions JSDoc 강화
3. **개발 가이드**: 신규 개발자 온보딩 가이드

---

## 8. 우선순위별 개선 로드맵

### 8.1 Phase 1: Critical (즉시 조치) - 2주

#### 1.1 Server Actions 구조 정리

**목표**: Deprecated 코드 제거 및 중간 단계 Actions 마이그레이션

**작업**:
- [ ] `app/actions/scores.ts` 사용처 확인 후 제거
- [ ] `app/actions/scores-internal.ts` → `lib/domains/score/actions.ts` 마이그레이션
- [ ] 비즈니스 로직을 Service 레이어로 추출

**예상 작업량**: 4일

#### 1.2 레이아웃 파일 캐싱 최적화

**목표**: 모든 레이아웃 파일에 적절한 캐싱 전략 적용

**작업**:
- [ ] `app/(student)/layout.tsx` → `revalidate: 300` 적용
- [ ] `app/(admin)/layout.tsx` → `revalidate: 300` 적용
- [ ] `app/(parent)/layout.tsx` → `revalidate: 300` 적용
- [ ] `app/(superadmin)/layout.tsx` → `revalidate: 300` 적용

**예상 작업량**: 1일

#### 1.3 Critical TODO 정리

**목표**: 버그 수정 관련 TODO 우선 처리

**작업**:
- [ ] Critical TODO 목록 작성
- [ ] 우선순위별 처리 계획 수립
- [ ] 즉시 처리 가능한 항목 처리

**예상 작업량**: 3일

---

### 8.2 Phase 2: High (단기 개선) - 4주

#### 2.1 Plan 도메인 완전 마이그레이션

**목표**: Plan 도메인을 완전한 레이어 구조로 마이그레이션

**작업**:
- [ ] `lib/domains/plan/actions.ts` 생성
- [ ] `app/(student)/actions/planActions.ts` 마이그레이션
- [ ] 비즈니스 로직을 Service 레이어로 추출
- [ ] 타입 정의 통합

**예상 작업량**: 5일

#### 2.2 에러 처리 패턴 통일

**목표**: 도메인별 에러 타입 정의 및 통일된 에러 처리

**작업**:
- [ ] 도메인별 에러 타입 정의 (`lib/domains/{domain}/errors.ts`)
- [ ] Service 레이어에서 도메인 에러 사용
- [ ] Actions에서 `withErrorHandling` 적용

**예상 작업량**: 5일

#### 2.3 N+1 쿼리 패턴 제거

**목표**: 남아있는 N+1 쿼리 패턴을 배치 쿼리로 변경

**작업**:
- [ ] N+1 쿼리 패턴 검색 및 목록 작성
- [ ] 배치 쿼리로 변경
- [ ] 성능 측정 및 검증

**예상 작업량**: 5일

#### 2.4 타입 안전성 개선

**목표**: null 체크 강화 및 타입 단언 최소화

**작업**:
- [ ] Optional Chaining + Nullish Coalescing 적용
- [ ] 타입 가드 함수 추가
- [ ] `any` 타입 제거

**예상 작업량**: 5일

---

### 8.3 Phase 3: Medium (중기 개선) - 8주

#### 3.1 나머지 도메인 마이그레이션

**목표**: 미구현 도메인들을 완전한 레이어 구조로 마이그레이션

**작업**:
- [ ] `student`, `content`, `goal`, `block`, `camp`, `tenant`, `subject` 도메인 구조화
- [ ] Repository 패턴 적용
- [ ] Service 레이어 구현
- [ ] Actions 마이그레이션

**예상 작업량**: 15일

#### 3.2 페이지별 캐싱 전략 수립

**목표**: 각 페이지에 적절한 캐싱 전략 적용

**작업**:
- [ ] 페이지별 데이터 특성 분석
- [ ] 캐싱 전략 수립
- [ ] `revalidate` 값 설정
- [ ] 성능 측정 및 검증

**예상 작업량**: 5일

#### 3.3 레거시 코드 마이그레이션

**목표**: `lib/plan/` 레거시 코드를 `lib/domains/plan/`로 마이그레이션

**작업**:
- [ ] 레거시 코드 의존성 분석
- [ ] 점진적 마이그레이션
- [ ] 레거시 코드 제거

**예상 작업량**: 10일

---

### 8.4 Phase 4: Low (장기 개선) - 12주

#### 4.1 테스트 커버리지 향상

**목표**: 단위 테스트 커버리지 70% 이상 달성

**작업**:
- [ ] Service 레이어 단위 테스트 작성
- [ ] Repository 레이어 통합 테스트 작성
- [ ] 테스트 커버리지 측정 도구 설정

**예상 작업량**: 20일

#### 4.2 문서화 강화

**목표**: 아키텍처 문서 및 개발 가이드 작성

**작업**:
- [ ] 전체 아키텍처 개요 문서 작성
- [ ] Server Actions API 문서화
- [ ] 신규 개발자 온보딩 가이드 작성

**예상 작업량**: 10일

#### 4.3 성능 모니터링 도구 도입

**목표**: 프로덕션 성능 측정 및 모니터링 시스템 구축

**작업**:
- [ ] 성능 측정 도구 도입 (예: Vercel Analytics, Sentry)
- [ ] 성능 대시보드 구축
- [ ] 알림 시스템 설정

**예상 작업량**: 5일

---

## 9. 결론

### 9.1 주요 개선 사항 요약

1. **아키텍처 통일**: Server Actions 구조 혼재 해결 및 레이어 분리 완성
2. **성능 최적화**: 캐싱 전략 수립으로 30-50% 성능 개선 예상
3. **코드 품질 향상**: 에러 처리 통일, 타입 안전성 개선
4. **유지보수성 향상**: 도메인 구조 완성 및 문서화 강화

### 9.2 예상 효과

- **성능**: 페이지 로딩 시간 30-50% 감소
- **개발 생산성**: 코드 일관성 향상으로 개발 속도 20-30% 증가
- **유지보수성**: 아키텍처 통일로 버그 감소 및 리팩토링 용이성 향상
- **테스트 용이성**: 레이어 분리로 단위 테스트 작성 용이

### 9.3 다음 단계

1. **Phase 1 작업 시작**: Critical 항목부터 우선 처리
2. **정기적 리뷰**: 주간/월간 진행 상황 리뷰
3. **점진적 개선**: 큰 변경보다 작은 개선을 지속적으로 적용

---

**문서 버전**: 1.0  
**최종 업데이트**: 2026-01-13  
**작성자**: AI Assistant (Claude)

