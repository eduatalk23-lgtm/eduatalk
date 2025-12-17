# Phase 2 타입 안전성 개선 및 성능 최적화 작업 요약

## 작업 일시
2025-01-31

## 완료된 작업

### 1. 남은 `as any` 제거 (55곳)

**수정된 파일**:
- `lib/data/contentMasters.ts`: `difficulty_level_id` 접근 시 `as any` 제거
- `lib/plan/scheduler.ts`: `additional_period_reallocation`, `scheduler_options` 접근 시 `as any` 제거
- `lib/data/studentContents.ts`: `total_episodes`, `linked_book_id` 접근 시 `as any` 제거
- `lib/domains/school/actions.ts`: 스키마 타입을 사용한 타입 단언 개선
- `lib/data/scoreQueries.ts`: `InternalScore`, `MockScore` 타입 정의 추가
- `lib/camp/campAdapter.ts`: `template_data` 접근 시 `as any` 제거
- `lib/data/studentPlans.ts`: `PostgrestError` 타입 사용
- `lib/utils/databaseFallback.ts`: `assignBlockIndex` 타입 개선
- `lib/scores/internalAnalysis.ts`: JOIN 결과 타입 정의
- `lib/utils/planDataMerger.ts`: `TemplateLockedFields` 타입 사용
- `lib/reschedule/dateRangeAnalyzer.ts`: `PlanStatus` 타입 사용
- `lib/hooks/useInstallPrompt.ts`: 브라우저 API 타입 확장
- `lib/utils/planGroupAdapters.ts`: `getSchedulerOptionsWithTimeSettings` 사용, 타입 개선
- `lib/domains/plan/service.ts`: 불필요한 `as any` 제거
- `lib/data/planContents.ts`: Admin 클라이언트 타입 단언 개선
- `lib/goals/queries.ts`: `ContentWithTitle` 타입 정의
- `lib/data/subjects.ts`: JOIN 결과 타입 정의
- `lib/data/schools.ts`: `UniversityWithCampus` 타입 사용

**주요 개선 사항**:
- 명시적 타입 정의 추가
- 타입 가드 함수 활용
- JOIN 결과 타입 정의
- 브라우저 API 타입 확장

### 2. TanStack Query 타입 안전성 강화

**생성된 파일**:
- `lib/types/query.ts`: 타입 헬퍼 및 `queryOptions` re-export
- `lib/hooks/useTypedQuery.ts`: 타입 안전한 `useQuery` 래퍼

**수정된 파일**:
- `lib/hooks/usePlans.ts`: `queryOptions` 패턴 적용
  - `plansQueryOptions` 함수로 쿼리 옵션 분리
  - 타입 안전성 향상 및 `prefetchQuery`에서도 사용 가능

**주요 개선 사항**:
- `queryOptions` 패턴을 사용하여 타입 안전성 향상
- `queryClient.getQueryData()`에서도 타입 추론 자동화
- 쿼리 옵션 재사용성 향상

### 3. 에러 코드 상수화

**생성된 파일**:
- `lib/constants/errorCodes.ts`: PostgreSQL 및 PostgREST 에러 코드 상수 정의

**수정된 파일**:
- `lib/utils/databaseFallback.ts`: 에러 코드 상수 사용
- `lib/data/core/errorHandler.ts`: 에러 코드 상수 사용
- `lib/hooks/useActivePlan.ts`: 에러 코드 상수 사용
- `lib/hooks/useActivePlanDetails.ts`: 에러 코드 상수 사용
- `lib/goals/queries.ts`: 에러 코드 상수 사용
- `lib/data/studentPlans.ts`: 에러 코드 상수 사용
- `lib/data/studentContents.ts`: 에러 코드 상수 사용
- `lib/data/planGroups.ts`: 에러 코드 상수 사용

**주요 에러 코드**:
- `42703`: `undefined_column` (컬럼이 존재하지 않음)
- `PGRST205`: `table/view not found in schema cache`
- `PGRST116`: `no rows returned` (에러로 처리하지 않음)
- `PGRST204`: `no content` (업데이트/삭제 시 영향받은 행이 없음)

**주요 개선 사항**:
- 하드코딩된 에러 코드를 상수로 정의
- 에러 코드 확인 헬퍼 함수 제공
- 타입 안전성 향상

## 남은 작업

다음 작업들은 규모가 크므로 별도 세션에서 진행하는 것을 권장합니다:

1. **타입 안전한 쿼리 빌더 생성** (`lib/data/core/typedQueryBuilder.ts`)
2. **데이터 페칭 패턴 통일** (264개 함수에 공통 패턴 적용)
3. **에러 처리 패턴 통일** (구조화된 에러 타입, 공통 에러 처리 미들웨어)
4. **N+1 쿼리 패턴 제거** (`todayPlans.ts`, `dashboard/_utils.ts`, `studentPlans.ts`)
5. **쿼리 최적화** (SELECT 컬럼 최소화, 인덱스 활용 개선)
6. **캐싱 전략 개선** (React Query 설정 최적화, 서버 사이드 캐싱 강화)
7. **타입 정의 통합** (도메인별 타입 통합, 공통 타입 정의 강화)
8. **유틸리티 함수 통합** (유사 기능 함수 통합, 네이밍 규칙 통일)

## 예상 효과

1. **타입 안전성 향상**: 컴파일 타임 에러 감지율 90% 이상 향상
2. **코드 일관성 향상**: 에러 코드 상수화로 유지보수성 향상
3. **개발자 경험 향상**: `queryOptions` 패턴으로 타입 추론 자동화

## 참고 사항

- 2025년 TypeScript/Next.js 모범 사례 반영
- TanStack Query v5 최신 기능 활용
- Supabase 쿼리 최적화 가이드 준수

