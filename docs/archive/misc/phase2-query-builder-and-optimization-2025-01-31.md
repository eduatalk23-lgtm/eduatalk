# Phase 2 타입 안전한 쿼리 빌더 생성 및 최적화 작업 보고서

**작업 일자**: 2025-01-31  
**작업 범위**: 타입 안전한 쿼리 빌더 생성, N+1 쿼리 패턴 확인, 쿼리 최적화

## 개요

Phase 2의 남은 작업 중 타입 안전한 쿼리 빌더를 생성하고, 기존 코드의 N+1 쿼리 패턴을 확인했습니다.

## 완료된 작업

### 1. 타입 안전한 쿼리 빌더 생성 (`lib/data/core/typedQueryBuilder.ts`)

2025년 모범 사례를 반영하여 타입 안전한 쿼리 빌더를 생성했습니다.

#### 주요 기능

**1. `createTypedQuery<T>`**
- 타입 안전한 단일 쿼리 실행
- 타입 가드 함수 지원 (런타임 검증)
- 명시적 타입 지정 옵션

**2. `createTypedSingleQuery<T>`**
- 단일 레코드 조회 전용
- 배열 결과에서 첫 번째 항목만 반환

**3. `createTypedBatchQuery<T>`**
- 여러 ID에 대한 배치 조회
- N+1 쿼리 패턴 제거에 유용
- 빈 배열 입력 시 안전하게 처리

**4. `createTypedJoinQuery<T, J>`**
- JOIN된 데이터를 타입 안전하게 추출
- `extractJoinedData` 함수로 JOIN 데이터 처리

**5. `createTypedConditionalQuery<T>`**
- 조건부 쿼리 실행 (View/Table fallback 등)
- 에러 코드에 따라 다른 쿼리 실행

**6. `createTypedParallelQueries<T>`**
- 여러 독립적인 쿼리를 병렬로 실행
- `Promise.allSettled` 패턴 사용

#### 사용 예시

```typescript
// 단일 쿼리
const student = await createTypedQuery(
  () => supabase
    .from("students")
    .select("*")
    .eq("id", studentId)
    .maybeSingle(),
  {
    context: "[data/students]",
    defaultValue: null,
  }
);

// 배치 쿼리 (N+1 제거)
const students = await createTypedBatchQuery(
  studentIds,
  (ids) => supabase
    .from("students")
    .select("*")
    .in("id", ids),
  {
    context: "[data/students]",
    defaultValue: [],
  }
);

// 조건부 쿼리 (View fallback)
const plans = await createTypedConditionalQuery(
  () => supabase.from("today_plan_view").select("*"),
  {
    fallbackQuery: () => supabase.from("student_plan").select("*"),
    shouldFallback: (error) => ErrorCodeCheckers.isViewNotFound(error),
    context: "[data/plans]",
  }
);
```

### 2. N+1 쿼리 패턴 확인

기존 코드를 검토한 결과, 대부분의 N+1 쿼리 패턴이 이미 제거되어 있습니다:

#### 이미 최적화된 파일

1. **`lib/data/todayPlans.ts`**
   - `getTodayPlans()`: 배치 조회로 최적화됨
   - `Promise.all`을 사용하여 병렬 쿼리 실행
   - View를 통한 JOIN으로 Application-side Join 제거

2. **`app/(student)/dashboard/_utils.ts`**
   - `fetchTodayPlans()`: timing 정보를 플랜 조회 시 함께 가져옴
   - 콘텐츠 맵을 한 번에 조회하여 N+1 제거

3. **`lib/data/studentSessions.ts`**
   - `getActiveSessionsForPlans()`: 배치 조회로 구현됨
   - `IN` 절을 사용하여 여러 플랜의 세션을 한 번에 조회

4. **`lib/data/scoreQueries.ts`**
   - `getAllTermScores()`: 3개의 쿼리만 실행 (N+1 제거)

#### 개선 가능한 부분

1. **`lib/data/studentPlans.ts`**
   - `getPlansForStudent()`: SELECT 컬럼이 많음 (40개 컬럼)
   - 필요한 컬럼만 선택하도록 최적화 가능

2. **`lib/data/scoreQueries.ts`**
   - `getTermScores()`: `SELECT *` 사용
   - 필요한 컬럼만 명시적으로 선택 가능

3. **`lib/data/schools.ts`**
   - `getAllSchools()`: `SELECT *` 사용
   - 필요한 컬럼만 명시적으로 선택 가능

### 3. Export 추가

`lib/data/core/index.ts`에 `typedQueryBuilder` export를 추가하여 다른 모듈에서 쉽게 사용할 수 있도록 했습니다.

## 개선 효과

1. **타입 안전성 향상**: 제네릭 타입과 타입 가드 함수로 런타임 검증 가능
2. **코드 재사용성 향상**: 공통 쿼리 패턴을 함수로 추상화
3. **에러 처리 통일**: 일관된 에러 처리 패턴 적용
4. **N+1 쿼리 방지**: 배치 조회 함수로 N+1 패턴 제거 용이

## 다음 단계

### 남은 작업 (규모가 커서 별도 세션 권장)

1. **데이터 페칭 패턴 통일 (264개 함수)**
   - 기존 함수들을 `typedQueryBuilder`로 마이그레이션
   - 공통 패턴 적용

2. **에러 처리 패턴 통일**
   - 구조화된 에러 타입 정의
   - 공통 에러 처리 미들웨어

3. **쿼리 최적화**
   - `SELECT *` → 필요한 컬럼만 선택
   - 인덱스 활용 개선

4. **캐싱 전략 개선**
   - React Query 설정 최적화
   - 서버 사이드 캐싱 강화

5. **타입 정의 통합**
   - 도메인별 타입 통합
   - 공통 타입 정의 강화

6. **유틸리티 함수 통합**
   - 유사 기능 함수 통합
   - 네이밍 규칙 통일

## 참고 사항

- 타입 안전한 쿼리 빌더는 기존 `queryBuilder.ts`를 확장한 형태
- 기존 코드와의 호환성을 유지하면서 점진적으로 마이그레이션 가능
- N+1 쿼리 패턴은 대부분 이미 제거되어 있음
- `SELECT *` 사용은 성능에 큰 영향을 주지 않지만, 명시적 컬럼 선택이 더 안전함

