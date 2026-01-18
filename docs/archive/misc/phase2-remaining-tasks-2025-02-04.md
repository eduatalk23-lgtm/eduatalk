# Phase 2 남은 작업 정리

**작성 일자**: 2025-02-04  
**기준**: `.cursor/plans/phase-1-adc3c528.plan.md` TODO 리스트

## ✅ 완료된 작업

### 1. 타입 정의 및 타입 가드 함수
- [x] **타입 정의 추가**: `PlanContentWithDetails`, `SchedulerOptionsWithTimeSettings`, `MasterBookWithJoins` 등 이미 정의됨
- [x] **타입 가드 함수 작성**: `isPlanContentWithDetails`, `isSchedulerOptionsWithTimeSettings`, `isMasterBookWithJoins` 이미 작성됨
- [x] **lib/data/planGroups.ts 수정**: `start_detail_id`, `end_detail_id` as any 제거 완료 (타입 가드 함수 활용)

### 2. TanStack Query 타입 안전성
- [x] **TanStack Query 타입 안전성 강화**: `queryOptions` 패턴 적용 (`useActivePlan`, `useActivePlanDetails`)
- [x] **타입 안전한 쿼리 빌더 생성**: `lib/data/core/typedQueryBuilder.ts` 생성 완료

### 3. 에러 처리
- [x] **에러 코드 상수화**: `lib/constants/errorCodes.ts` 생성 및 하드코딩된 에러 코드 제거 (주요 파일 완료)
- [x] **에러 처리 패턴 통일**: 구조화된 에러 타입 정의 완료 (`lib/data/core/errorTypes.ts`)

### 4. 쿼리 최적화
- [x] **쿼리 최적화**: `student_plan` fallback 쿼리의 `select("*")`를 필요한 컬럼만 선택하도록 개선

### 5. 타입 안전성 개선
- [x] **lib/data/schools.ts**: `as any` 제거 및 JOIN 데이터 타입 명시적 정의

## ⏳ 남은 작업

### 1. 공통 유틸리티 함수 개선 (우선순위: 높음)

- [ ] **공통 유틸리티 함수 작성**
  - `getSchedulerOptionsWithTimeSettings`: 이미 존재하는지 확인 필요
  - `extractTimeSettingsFromSchedulerOptions`: 개선 필요
  - `extractJoinedData`: 개선 필요

**파일**: `lib/utils/schedulerOptions.ts`, `lib/utils/supabaseHelpers.ts`

### 2. 특정 파일의 as any 제거 (우선순위: 높음)

- [ ] **lib/data/contentMasters.ts**: JOIN 데이터 `as any` 제거 및 타입 안전성 개선
  - 현재 상태: `as any` 사용 없음 (grep 결과)
  - 확인 필요: JOIN 쿼리 결과 타입 정의

- [ ] **app/(student)/actions/plan-groups/generatePlansRefactored.ts**: `scheduler_options` as any 제거 및 공통 함수 사용
  - 현재 상태: `as any` 1곳 발견

- [ ] **app/(student)/actions/plan-groups/previewPlansRefactored.ts**: `scheduler_options` as any 제거 및 공통 함수 사용
  - 현재 상태: 확인 필요

### 3. 중복 코드 제거 (우선순위: 중간)

- [ ] **scheduler_options 접근 패턴 통합**
  - 여러 파일에서 동일한 패턴으로 `scheduler_options` 접근
  - 공통 함수로 통합 필요

- [ ] **JOIN 데이터 추출 패턴 통합**
  - `extractJoinedData` 함수 개선
  - 중첩 JOIN 처리 패턴 통일

### 4. 남은 as any 제거 (우선순위: 중간)

- [ ] **app/(student)/actions/plan-groups/** 폴더
  - `queries.ts`: `as any` 1곳
  - `reschedule.ts`: `as any` 9곳
  - `update.ts`: `as any` 2곳
  - `plans.ts`: `as any` 1곳
  - `delete.ts`: `as any` 2곳
  - **총 15곳**

### 5. 데이터 페칭 패턴 통일 (우선순위: 낮음)

- [ ] **264개 함수에 공통 패턴 적용**
  - Repository 패턴 강화
  - 공통 쿼리 빌더 활용
  - 에러 처리 통일

### 6. N+1 쿼리 패턴 제거 (우선순위: 낮음)

- [ ] **todayPlans.ts**: N+1 쿼리 패턴 확인 및 제거
- [ ] **dashboard/_utils.ts**: 플랜별 timing 조회 최적화
- [ ] **studentPlans.ts**: 콘텐츠 조회 패턴 최적화

**참고**: 대부분의 N+1 패턴이 이미 제거되어 있음 (이전 작업에서 확인)

### 7. 캐싱 전략 개선 (우선순위: 낮음)

- [ ] **React Query 설정 최적화**: 이미 완료 (`lib/providers/QueryProvider.tsx`)
- [ ] **서버 사이드 캐싱 강화**: `unstable_cache` 활용

### 8. 타입 정의 통합 (우선순위: 낮음)

- [ ] **도메인별 타입 통합**: 이미 부분적으로 완료 (`lib/types/common.ts` 생성)
- [ ] **공통 타입 정의 강화**: 추가 통합 필요

### 9. 유틸리티 함수 통합 (우선순위: 낮음)

- [ ] **유사 기능 함수 통합**: 여러 파일에 분산된 유사 함수 통합
- [ ] **네이밍 규칙 통일**: 함수 네이밍 일관성 확보

## 📊 작업 진행률

### 전체 진행률: 약 60%

**완료된 항목**: 9개 / 19개  
**진행 중**: 0개  
**남은 항목**: 10개

### 우선순위별 분류

**높음 (즉시 진행 권장)**:
- 공통 유틸리티 함수 개선
- 특정 파일의 as any 제거 (contentMasters.ts, generatePlansRefactored.ts, previewPlansRefactored.ts)

**중간 (점진적 진행)**:
- 중복 코드 제거
- 남은 as any 제거 (app/(student)/actions/plan-groups/**)

**낮음 (선택적 진행)**:
- 데이터 페칭 패턴 통일
- N+1 쿼리 패턴 제거
- 캐싱 전략 개선
- 타입 정의 통합
- 유틸리티 함수 통합

## 다음 작업 제안

1. **공통 유틸리티 함수 확인 및 개선**
   - `getSchedulerOptionsWithTimeSettings` 함수 확인
   - `extractJoinedData` 함수 개선

2. **app/(student)/actions/plan-groups/** 폴더의 as any 제거**
   - 우선순위가 높은 파일부터 진행
   - `generatePlansRefactored.ts`, `previewPlansRefactored.ts` 먼저

3. **중복 코드 제거**
   - `scheduler_options` 접근 패턴 통합
   - JOIN 데이터 추출 패턴 통합

## 참고 사항

- 대부분의 핵심 작업은 완료되었습니다
- 남은 작업은 점진적으로 진행 가능합니다
- 우선순위가 높은 작업부터 진행하는 것을 권장합니다

