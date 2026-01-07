# 비즈니스 로직 사용성 문제점 분석

**작성일**: 2025-01-15  
**분석 범위**: `lib/plan/`, `lib/metrics/`, `lib/coaching/`, `lib/recommendations/`, `lib/domains/`

---

## 📋 목차

1. [Supabase 클라이언트 의존성 불일치](#1-supabase-클라이언트-의존성-불일치)
2. [에러 처리 패턴 불일치](#2-에러-처리-패턴-불일치)
3. [함수 시그니처 일관성 부족](#3-함수-시그니처-일관성-부족)
4. [타입 안전성 문제](#4-타입-안전성-문제)
5. [의존성 관리 문제](#5-의존성-관리-문제)
6. [문서화 부족](#6-문서화-부족)
7. [테스트 가능성 문제](#7-테스트-가능성-문제)
8. [개선 제안](#8-개선-제안)

---

## 1. Supabase 클라이언트 의존성 불일치

### 문제점

비즈니스 로직 함수들이 Supabase 클라이언트를 받는 방식이 일관되지 않습니다.

#### 패턴 A: 클라이언트를 파라미터로 받음

```typescript
// lib/metrics/getPlanCompletion.ts
export async function getPlanCompletion(
  supabase: SupabaseServerClient,
  studentId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<PlanCompletionMetrics>
```

#### 패턴 B: 내부에서 생성

```typescript
// lib/domains/plan/repository.ts
export async function findPlanGroups(
  filters: PlanGroupFilters
): Promise<PlanGroup[]> {
  const supabase = await createSupabaseServerClient();
  // ...
}
```

#### 패턴 C: 선택적으로 받음

```typescript
// lib/data/core/baseRepository.ts
protected async getSupabase(): Promise<SupabaseServerClient> {
  if (this.supabase) {
    return this.supabase;
  }
  return await createSupabaseServerClient();
}
```

### 영향

1. **테스트 어려움**: 클라이언트를 주입할 수 없어 모킹이 어려움
2. **의존성 불명확**: 함수가 내부에서 클라이언트를 생성하는지 알기 어려움
3. **재사용성 저하**: 다른 클라이언트(Admin 등)를 사용해야 할 때 수정 필요

### 예시

```typescript
// ❌ 나쁜 예: 내부에서 생성
export async function getPlanGroups(filters: PlanGroupFilters) {
  const supabase = await createSupabaseServerClient(); // 테스트 불가
  // ...
}

// ✅ 좋은 예: 파라미터로 받음
export async function getPlanGroups(
  supabase: SupabaseServerClient,
  filters: PlanGroupFilters
) {
  // ...
}
```

---

## 2. 에러 처리 패턴 불일치

### 문제점

에러 처리 방식이 모듈마다 다릅니다.

#### 패턴 A: try-catch로 빈 값 반환

```typescript
// lib/metrics/getPlanCompletion.ts
export async function getPlanCompletion(...) {
  try {
    // ...
  } catch (error) {
    console.error("[metrics/getPlanCompletion] 플랜 실행률 조회 실패", error);
    return {
      totalPlans: 0,
      completedPlans: 0,
      completionRate: 0,
    };
  }
}
```

#### 패턴 B: throw 사용

```typescript
// lib/domains/plan/repository.ts
export async function findPlanGroups(...) {
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error; // 상위에서 처리
  return (data as PlanGroup[]) ?? [];
}
```

#### 패턴 C: Result 타입 사용

```typescript
// lib/plan/services/PlanGenerationOrchestrator.ts
async generate(...): Promise<ServiceResult<PlanGenerationOrchestratorOutput>> {
  // ...
  return {
    success: false,
    error: "플랜 그룹을 찾을 수 없습니다",
    errorCode: ServiceErrorCodes.INVALID_INPUT,
  };
}
```

### 영향

1. **에러 처리 복잡성**: 호출자가 각 함수의 에러 처리 방식을 알아야 함
2. **에러 정보 손실**: 빈 값 반환 시 원인 파악 어려움
3. **일관성 부족**: 같은 도메인 내에서도 패턴이 다름

### 예시

```typescript
// ❌ 나쁜 예: 에러를 숨김
try {
  const result = await getPlanCompletion(...);
  // result가 빈 값일 때 에러인지 정상인지 알 수 없음
} catch (error) {
  // 에러가 발생해도 catch에 도달하지 않음
}

// ✅ 좋은 예: 명시적 에러 처리
const result = await getPlanCompletion(...);
if (!result.success) {
  console.error(result.error);
  return;
}
```

---

## 3. 함수 시그니처 일관성 부족

### 문제점

함수 파라미터 순서와 구조가 일관되지 않습니다.

#### 파라미터 순서 불일치

```typescript
// 패턴 A: supabase가 첫 번째
export async function getPlanCompletion(
  supabase: SupabaseServerClient,
  studentId: string,
  weekStart: Date,
  weekEnd: Date
)

// 패턴 B: supabase가 없음
export async function getPlanGroups(
  filters: PlanGroupFilters
)

// 패턴 C: 옵션 객체 사용
export async function getWeeklyMetrics(
  supabase: SupabaseServerClient,
  studentId: string
)
```

#### 옵션 객체 사용 여부 불일치

```typescript
// 단일 파라미터
export async function getWeakSubjects(
  supabase: SupabaseServerClient,
  studentId: string,
  weekStart: Date,
  weekEnd: Date
)

// 옵션 객체 (더 나은 방식)
export async function getWeeklyMetrics(
  supabase: SupabaseServerClient,
  studentId: string,
  options?: { weekStart?: Date; weekEnd?: Date }
)
```

### 영향

1. **학습 곡선 증가**: 각 함수의 시그니처를 외워야 함
2. **실수 가능성**: 파라미터 순서를 잘못 전달할 위험
3. **확장성 저하**: 새로운 파라미터 추가 시 시그니처 변경 필요

### 개선 제안

```typescript
// ✅ 옵션 객체 패턴 (권장)
export async function getPlanCompletion(
  supabase: SupabaseServerClient,
  options: {
    studentId: string;
    weekStart: Date;
    weekEnd: Date;
  }
): Promise<PlanCompletionMetrics>
```

---

## 4. 타입 안전성 문제

### 문제점

#### null 체크 부족

```typescript
// lib/metrics/getPlanCompletion.ts
const planRows = await safeQueryArray<PlanRow>(...);
// planRows가 null일 수 있지만 체크 없이 사용
const learningPlans = filterLearningPlans(planRows);
```

#### 타입 단언 과다 사용

```typescript
// lib/domains/plan/repository.ts
return (data as PlanGroup[]) ?? [];
// 타입 단언이 필요한 이유가 불명확
```

#### any 타입 사용 가능성

```typescript
// lib/coaching/engine.ts
export function coachingEngine(metrics: WeeklyMetricsData): WeeklyCoaching {
  // metrics의 필드가 null일 수 있지만 체크 없이 사용
  if (metrics.weeklyStudyTrend >= 20) {
    // ...
  }
}
```

### 영향

1. **런타임 에러**: null/undefined 접근 시 에러 발생
2. **타입 안전성 저하**: TypeScript의 이점을 활용하지 못함
3. **디버깅 어려움**: 타입 단언으로 인한 실제 타입 불일치 감지 어려움

### 개선 제안

```typescript
// ✅ null 체크 포함
const planRows = await safeQueryArray<PlanRow>(...);
if (!planRows || planRows.length === 0) {
  return {
    totalPlans: 0,
    completedPlans: 0,
    completionRate: 0,
  };
}
const learningPlans = filterLearningPlans(planRows);
```

---

## 5. 의존성 관리 문제

### 문제점

#### 순환 의존성 가능성

```typescript
// lib/coaching/getWeeklyMetrics.ts
import { getWeakSubjects } from "@/lib/metrics/getWeakSubjects";
import { getPlanCompletion } from "@/lib/metrics/getPlanCompletion";
import { getGoalStatus } from "@/lib/metrics/getGoalStatus";
// 여러 메트릭 함수를 직접 import
```

#### 의존성 방향 불명확

```typescript
// lib/plan/services/PlanGenerationOrchestrator.ts
import { getPlanGroupById, getPlanContents } from "@/lib/domains/plan/service";
// service를 import하지만 service도 다른 모듈에 의존
```

### 영향

1. **빌드 시간 증가**: 순환 의존성으로 인한 빌드 지연
2. **모듈 결합도 증가**: 모듈 간 강한 결합
3. **리팩토링 어려움**: 한 모듈 변경 시 다른 모듈 영향

### 개선 제안

```typescript
// ✅ 인터페이스 기반 의존성
interface MetricsService {
  getPlanCompletion(...): Promise<PlanCompletionMetrics>;
  getWeakSubjects(...): Promise<WeakSubjectMetrics>;
}

// 의존성 주입
export async function getWeeklyMetrics(
  supabase: SupabaseServerClient,
  studentId: string,
  metricsService: MetricsService
)
```

---

## 6. 문서화 부족

### 문제점

#### JSDoc 부족

```typescript
// lib/metrics/getPlanCompletion.ts
export async function getPlanCompletion(
  supabase: SupabaseServerClient,
  studentId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<PlanCompletionMetrics> {
  // JSDoc 없음
}
```

#### 사용 예시 부족

```typescript
// lib/coaching/engine.ts
export function coachingEngine(metrics: WeeklyMetricsData): WeeklyCoaching {
  // 사용 예시 없음
  // metrics의 각 필드 의미 불명확
}
```

### 영향

1. **학습 곡선 증가**: 함수 사용법을 코드를 읽어야만 알 수 있음
2. **실수 가능성**: 잘못된 파라미터 전달
3. **유지보수 어려움**: 함수 목적과 사용법 파악 어려움

### 개선 제안

```typescript
/**
 * 주간 플랜 실행률 메트릭 조회
 * 
 * @param supabase - Supabase 서버 클라이언트
 * @param studentId - 학생 ID
 * @param weekStart - 주간 시작일 (Date 객체)
 * @param weekEnd - 주간 종료일 (Date 객체)
 * @returns 플랜 실행률 메트릭 (totalPlans, completedPlans, completionRate)
 * 
 * @example
 * ```typescript
 * const supabase = await createSupabaseServerClient();
 * const weekStart = new Date('2025-01-06');
 * const weekEnd = new Date('2025-01-12');
 * const metrics = await getPlanCompletion(supabase, studentId, weekStart, weekEnd);
 * console.log(`실행률: ${metrics.completionRate}%`);
 * ```
 */
export async function getPlanCompletion(...)
```

---

## 7. 테스트 가능성 문제

### 문제점

#### 의존성 주입 불가

```typescript
// lib/domains/plan/repository.ts
export async function findPlanGroups(filters: PlanGroupFilters) {
  const supabase = await createSupabaseServerClient(); // 모킹 불가
  // ...
}
```

#### 외부 의존성 직접 호출

```typescript
// lib/coaching/getWeeklyMetrics.ts
const [studyTime, planCompletion, ...] = await Promise.all([
  getStudyTime(supabase, studentId, weekStart, weekEnd),
  getPlanCompletion(supabase, studentId, weekStart, weekEnd),
  // 직접 함수 호출 - 모킹 어려움
]);
```

### 영향

1. **단위 테스트 어려움**: 실제 데이터베이스에 의존
2. **통합 테스트 필요**: 단위 테스트 대신 통합 테스트만 가능
3. **테스트 속도 저하**: 실제 데이터베이스 연결 필요

### 개선 제안

```typescript
// ✅ 의존성 주입 가능한 구조
export async function getWeeklyMetrics(
  supabase: SupabaseServerClient,
  studentId: string,
  dependencies?: {
    getStudyTime?: typeof getStudyTime;
    getPlanCompletion?: typeof getPlanCompletion;
  }
) {
  const getStudyTimeFn = dependencies?.getStudyTime ?? getStudyTime;
  const getPlanCompletionFn = dependencies?.getPlanCompletion ?? getPlanCompletion;
  // ...
}
```

---

## 8. 개선 제안

### 우선순위별 개선 사항

#### 🔴 높은 우선순위

1. **Supabase 클라이언트 의존성 통일**
   - 모든 비즈니스 로직 함수가 클라이언트를 파라미터로 받도록 변경
   - 내부 생성 패턴 제거

2. **에러 처리 패턴 통일**
   - Result 타입 또는 throw 패턴 중 하나로 통일
   - 빈 값 반환 패턴 제거

3. **함수 시그니처 표준화**
   - 옵션 객체 패턴 채택
   - 파라미터 순서 표준화

#### 🟡 중간 우선순위

4. **타입 안전성 강화**
   - null 체크 추가
   - 타입 단언 최소화
   - strict null checks 활성화

5. **문서화 개선**
   - 모든 공개 함수에 JSDoc 추가
   - 사용 예시 포함

#### 🟢 낮은 우선순위

6. **의존성 관리 개선**
   - 인터페이스 기반 의존성 주입
   - 순환 의존성 제거

7. **테스트 가능성 개선**
   - 의존성 주입 패턴 적용
   - 모킹 가능한 구조로 변경

### 표준 패턴 제안

#### 함수 시그니처 표준

```typescript
/**
 * [함수 설명]
 * 
 * @param supabase - Supabase 서버 클라이언트
 * @param options - 함수 옵션
 * @returns [반환 타입 설명]
 * 
 * @example
 * ```typescript
 * const result = await functionName(supabase, { ... });
 * ```
 */
export async function functionName(
  supabase: SupabaseServerClient,
  options: FunctionOptions
): Promise<FunctionResult> {
  // 구현
}
```

#### 에러 처리 표준

```typescript
// Result 타입 사용 (권장)
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

export async function functionName(...): Promise<Result<ReturnType>> {
  try {
    // ...
    return { success: true, data: result };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}
```

#### 의존성 주입 표준

```typescript
// 의존성을 옵션으로 받을 수 있도록
export async function functionName(
  supabase: SupabaseServerClient,
  options: FunctionOptions,
  dependencies?: {
    dependency1?: typeof dependency1;
    dependency2?: typeof dependency2;
  }
) {
  const dep1 = dependencies?.dependency1 ?? dependency1;
  const dep2 = dependencies?.dependency2 ?? dependency2;
  // ...
}
```

---

## 📊 영향도 분석

| 문제점 | 영향도 | 우선순위 | 예상 작업량 |
|--------|--------|----------|------------|
| Supabase 클라이언트 의존성 불일치 | 높음 | 높음 | 2-3일 |
| 에러 처리 패턴 불일치 | 높음 | 높음 | 2-3일 |
| 함수 시그니처 일관성 부족 | 중간 | 중간 | 1-2일 |
| 타입 안전성 문제 | 중간 | 중간 | 1-2일 |
| 의존성 관리 문제 | 낮음 | 낮음 | 3-5일 |
| 문서화 부족 | 낮음 | 낮음 | 2-3일 |
| 테스트 가능성 문제 | 중간 | 낮음 | 3-5일 |

---

## 🎯 다음 단계

1. **Phase 1**: Supabase 클라이언트 의존성 통일 (2-3일)
2. **Phase 2**: 에러 처리 패턴 통일 (2-3일)
3. **Phase 3**: 함수 시그니처 표준화 (1-2일)
4. **Phase 4**: 타입 안전성 강화 (1-2일)
5. **Phase 5**: 문서화 개선 (2-3일)

---

**참고 문서**:
- [비즈니스 로직 분리 가이드](./business-logic-separation.md)
- [에러 처리 가이드라인](./error-handling-guidelines.md)
- [서버 액션 가이드라인](./server-actions-guideline.md)

