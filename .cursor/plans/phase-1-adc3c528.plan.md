<!-- adc3c528-6723-4efe-91cc-d376c3fd65cf a8c88353-eec2-46f4-9cc4-d2367183b15e -->
# Phase 2 타입 안전성 개선 및 성능 최적화 상세 계획

## 개요

Phase 2에서는 추가 타입 안전성 개선, 중복 코드 제거, 성능 최적화를 수행합니다. 2025년 모범 사례를 반영하여 TanStack Query 타입 안전성 강화, 데이터 페칭 패턴 통일, 쿼리 최적화를 진행합니다.

## 작업 범위

### 1. 타입 안전성 개선

#### 1.1 남은 `as any` 제거 (55곳)

**발견된 위치**:

- `lib/data/contentMasters.ts`: 7곳 (difficulty_level_id 접근)
- `lib/plan/scheduler.ts`: 3곳
- `lib/data/studentContents.ts`: 2곳
- `lib/domains/school/actions.ts`: 6곳
- `lib/data/scoreQueries.ts`: 2곳
- `lib/camp/campAdapter.ts`: 1곳
- `lib/data/studentPlans.ts`: 1곳
- `lib/utils/databaseFallback.ts`: 1곳
- `lib/scores/internalAnalysis.ts`: 1곳
- `lib/utils/planDataMerger.ts`: 3곳
- `lib/reschedule/dateRangeAnalyzer.ts`: 4곳
- `lib/hooks/useInstallPrompt.ts`: 2곳
- `lib/utils/planGroupAdapters.ts`: 4곳
- `lib/domains/plan/service.ts`: 3곳
- `lib/data/planContents.ts`: 1곳
- `lib/data/core/baseRepository.ts`: 2곳
- `lib/data/core/errorHandler.ts`: 1곳
- `lib/data/subjects.ts`: 6곳
- `lib/data/schools.ts`: 4곳
- `lib/goals/queries.ts`: 1곳

**해결 방안**:

1. 명시적 타입 정의 추가
2. 타입 가드 함수 활용
3. 제네릭 타입 활용

#### 1.2 TanStack Query 타입 안전성 강화

**현재 문제점**:

- `useQuery`, `useMutation`에서 타입 추론이 불완전함
- `queryOptions` 패턴 미사용
- 타입 단언(`as`) 사용

**2025년 모범 사례** (Context7 MCP 조사 결과):

- `queryOptions`를 사용한 타입 안전성 향상
- 명시적으로 타입된 `queryFn` 사용
- `isSuccess` 플래그를 통한 타입 좁히기

**수정 내용**:

```typescript
// 수정 전
const { data } = useQuery({
  queryKey: ['groups'],
  queryFn: fetchGroups,
});

// 수정 후
const groupOptions = queryOptions({
  queryKey: ['groups'],
  queryFn: fetchGroups,
  staleTime: 5 * 1000,
});

const { data } = useQuery(groupOptions);
// data는 자동으로 Group[] | undefined로 추론됨
```

### 2. 중복 코드 제거

#### 2.1 데이터 페칭 패턴 통일

**발견된 중복**:

- 264개의 데이터 페칭 함수가 각각 다른 패턴 사용
- 에러 처리 로직이 함수마다 다름
- 쿼리 빌더 사용 패턴 불일치

**해결 방안**:

1. `lib/data/core/queryBuilder.ts` 확장
2. 공통 데이터 페칭 헬퍼 함수 작성
3. Repository 패턴 강화

**파일**: `lib/data/core/typedQueryBuilder.ts` (신규 생성)

```typescript
// 타입 안전한 쿼리 빌더
export function createTypedQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: PostgrestError | null }>,
  options?: QueryOptions
): Promise<T | null> {
  return executeQuery(queryFn, options);
}
```

#### 2.2 에러 처리 패턴 통일

**현재 문제점**:

- `handleQueryError` 사용 패턴 불일치
- 에러 코드 하드코딩
- 로깅 형식 불일치

**해결 방안**:

1. 에러 코드 상수화 (`lib/constants/errorCodes.ts`)
2. 구조화된 에러 타입 정의
3. 공통 에러 처리 미들웨어

#### 2.3 JOIN 데이터 추출 패턴 통일

**현재 문제점**:

- `extractJoinedData` 사용 패턴 불일치
- 타입 단언 사용
- 중첩 JOIN 처리 불일치

**해결 방안**:

1. `extractJoinedData` 타입 개선 (완료)
2. 중첩 JOIN 헬퍼 함수 추가
3. 타입 가드 함수 활용

### 3. 성능 최적화

#### 3.1 N+1 쿼리 패턴 제거

**발견된 N+1 패턴**:

- `lib/data/todayPlans.ts`: 플랜별 개별 쿼리 (문서에서 확인)
- `app/(student)/dashboard/_utils.ts`: 플랜별 timing 조회
- `lib/data/studentPlans.ts`: 콘텐츠 조회 패턴

**해결 방안**:

1. 배치 조회로 통합
2. JOIN 쿼리 활용
3. `Promise.all` 패턴 개선

**예시**:

```typescript
// 수정 전: N+1 쿼리
for (const plan of plans) {
  const timing = await getPlanTiming(plan.id);
}

// 수정 후: 배치 조회
const planIds = plans.map(p => p.id);
const timings = await getPlanTimingsBatch(planIds);
const timingMap = new Map(timings.map(t => [t.plan_id, t]));
```

#### 3.2 쿼리 최적화

**발견된 최적화 기회**:

- `student_plan` 테이블: 40개 컬럼 SELECT → 필요한 컬럼만 선택
- `student_study_sessions` 테이블: `plan_id IN (...)` 최적화 필요
- `student_content_progress` 테이블: 인덱스 활용 개선

**데이터베이스 인덱스 확인 결과**:

- `student_plan`: 인덱스 충분 (43개 인덱스)
- `student_study_sessions`: 인덱스 충분 (11개 인덱스)
- `student_content_progress`: 인덱스 충분 (7개 인덱스)

**해결 방안**:

1. SELECT 컬럼 최소화
2. 인덱스 활용 쿼리로 개선
3. 쿼리 실행 계획 분석

#### 3.3 캐싱 전략 개선

**현재 문제점**:

- `today_plans_cache` 테이블 존재하지만 활용도 낮음
- React Query 캐시 전략 미최적화
- 서버 사이드 캐싱 부족

**해결 방안**:

1. React Query `staleTime`, `gcTime` 최적화
2. 서버 사이드 캐싱 강화 (`unstable_cache` 활용)
3. 캐시 무효화 전략 개선

### 4. 코드 구조 개선

#### 4.1 타입 정의 통합

**현재 문제점**:

- 타입 정의가 여러 파일에 분산
- 중복 타입 정의
- 타입 일관성 부족

**해결 방안**:

1. 도메인별 타입 통합
2. 공통 타입 정의 강화
3. 타입 재사용성 향상

#### 4.2 유틸리티 함수 통합

**현재 문제점**:

- 유사한 기능의 함수가 여러 파일에 분산
- 함수 네이밍 불일치
- 재사용성 낮음

**해결 방안**:

1. 유틸리티 함수 통합
2. 함수 네이밍 규칙 통일
3. 문서화 강화

## 구현 계획

### Step 1: 타입 안전성 개선

**파일**: `lib/types/query.ts` (신규 생성)

- TanStack Query 타입 헬퍼 정의
- `queryOptions` 래퍼 함수
- 타입 안전한 쿼리 키 정의

**파일**: `lib/constants/errorCodes.ts` (신규 생성)

- Supabase 에러 코드 상수화
- 에러 코드 타입 정의

**파일**: 각 데이터 페칭 파일

- `as any` 제거
- 명시적 타입 정의
- 타입 가드 함수 활용

### Step 2: 중복 코드 제거

**파일**: `lib/data/core/typedQueryBuilder.ts` (신규 생성)

- 타입 안전한 쿼리 빌더
- 공통 쿼리 패턴 추상화

**파일**: `lib/data/core/repository.ts` (기존 파일 확장)

- Repository 패턴 강화
- 공통 CRUD 작업 통합

**파일**: `lib/utils/supabaseHelpers.ts` (개선)

- JOIN 데이터 추출 패턴 통일
- 중첩 JOIN 헬퍼 추가

### Step 3: 성능 최적화

**파일**: `lib/data/todayPlans.ts`

- N+1 쿼리 제거
- 배치 조회로 통합
- SELECT 컬럼 최소화

**파일**: `app/(student)/dashboard/_utils.ts`

- 플랜 timing 조회 최적화
- 중복 쿼리 제거

**파일**: `lib/data/studentPlans.ts`

- 쿼리 최적화
- 인덱스 활용 개선

### Step 4: React Query 최적화

**파일**: `lib/providers/QueryProvider.tsx` (개선)

- `staleTime`, `gcTime` 최적화
- 쿼리 기본값 설정

**파일**: `lib/hooks/useTypedQuery.ts` (신규 생성)

- 타입 안전한 `useQuery` 래퍼
- `queryOptions` 패턴 적용

## 예상 효과

1. **타입 안전성 향상**: 컴파일 타임 에러 감지율 90% 이상 향상
2. **코드 중복 제거**: 데이터 페칭 함수 중복 50% 이상 감소
3. **성능 향상**: 쿼리 실행 시간 30% 이상 단축
4. **유지보수성 향상**: 공통 패턴으로 코드 일관성 향상

## 참고 사항

- 2025년 TypeScript/Next.js 모범 사례 반영
- TanStack Query v5 최신 기능 활용
- Supabase 쿼리 최적화 가이드 준수
- 데이터베이스 인덱스는 이미 충분히 최적화되어 있음

### To-dos

- [ ] 타입 정의 추가: PlanContentWithDetails, SchedulerOptionsWithTimeSettings, JOIN 결과 타입 (MasterBookWithJoins 등)
- [ ] 타입 가드 함수 작성: isPlanContentWithDetails, isSchedulerOptionsWithTimeSettings, isMasterBookWithJoins
- [ ] 공통 유틸리티 함수 작성: getSchedulerOptionsWithTimeSettings, extractTimeSettingsFromSchedulerOptions, extractJoinedData 개선
- [ ] lib/data/planGroups.ts 수정: start_detail_id, end_detail_id as any 제거
- [ ] lib/data/contentMasters.ts 수정: JOIN 데이터 as any 제거 및 타입 안전성 개선
- [ ] app/(student)/actions/plan-groups/generatePlansRefactored.ts 수정: scheduler_options as any 제거 및 공통 함수 사용
- [ ] app/(student)/actions/plan-groups/previewPlansRefactored.ts 수정: scheduler_options as any 제거 및 공통 함수 사용
- [ ] 중복 코드 제거: scheduler_options 접근 패턴 통합, JOIN 데이터 추출 패턴 통합
- [ ] 남은 as any 제거 (55곳): 명시적 타입 정의, 타입 가드 함수 활용
- [ ] TanStack Query 타입 안전성 강화: queryOptions 패턴 적용, 타입 안전한 useQuery 래퍼 생성
- [ ] 에러 코드 상수화: lib/constants/errorCodes.ts 생성, 하드코딩된 에러 코드 제거
- [ ] 타입 안전한 쿼리 빌더 생성: lib/data/core/typedQueryBuilder.ts, 공통 쿼리 패턴 추상화
- [ ] 데이터 페칭 패턴 통일: 264개 함수에 공통 패턴 적용, Repository 패턴 강화
- [ ] 에러 처리 패턴 통일: 구조화된 에러 타입, 공통 에러 처리 미들웨어
- [ ] N+1 쿼리 패턴 제거: todayPlans.ts, dashboard/_utils.ts, studentPlans.ts 최적화
- [ ] 쿼리 최적화: SELECT 컬럼 최소화, 인덱스 활용 개선, 쿼리 실행 계획 분석
- [ ] 캐싱 전략 개선: React Query 설정 최적화, 서버 사이드 캐싱 강화
- [ ] 타입 정의 통합: 도메인별 타입 통합, 공통 타입 정의 강화
- [ ] 유틸리티 함수 통합: 유사 기능 함수 통합, 네이밍 규칙 통일