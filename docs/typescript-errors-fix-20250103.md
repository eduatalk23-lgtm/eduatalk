# TypeScript 컴파일 에러 수정 (2025-01-03)

## 개요
프로젝트 전체에서 발생한 25개의 TypeScript 컴파일 에러를 모두 수정했습니다.

## 수정 내용

### 1. lib/supabase/server.ts
- **문제**: `ReadonlyRequestCookies` 타입이 `next/headers`에서 직접 export되지 않음
- **해결**: `Awaited<ReturnType<typeof cookies>>`를 사용하여 타입 정의

### 2. lib/types/plan.ts
- **문제**: `StudyHours`와 `SelfStudyHours` 타입이 중복 정의됨
- **해결**: 중복된 타입 정의 제거

### 3. lib/utils/cache.ts 및 index.ts
- **문제**: `CacheEntry` 타입이 export되지 않음, `createCache` 함수가 존재하지 않음
- **해결**: 
  - `CacheEntry`를 `export type`으로 변경
  - `index.ts`에서 올바른 함수들만 export하도록 수정

### 4. lib/tenant/getTenantContext.ts
- **문제**: fallback 케이스에서 `tenant_id` 속성이 누락됨
- **해결**: fallback 데이터에 `tenant_id: null` 추가

### 5. lib/utils/planGroupAdapters.ts
- **문제**: `name`과 `block_set_id`가 `null`일 수 있음, `block_set_name`과 `blocks` 속성이 `WizardData`에 없음
- **해결**: 
  - null 체크 추가 및 기본값 제공
  - 존재하지 않는 속성 제거

### 6. lib/utils/planDataMerger.ts
- **문제**: `plan_type` 속성이 `WizardData`에 없음
- **해결**: `plan_type` 체크 제거

### 7. lib/utils/excel.ts
- **문제**: `Buffer` 타입이 `BlobPart`와 호환되지 않음
- **해결**: `Buffer`를 `Uint8Array`로 변환하여 사용

### 8. lib/utils/planGroupDataSync.ts
- **문제**: 
  - `academy_name`과 `subject`가 `null`인데 타입은 `undefined`를 기대
  - `subject_constraints`의 타입 불일치
  - `content_allocations`가 `PlanGroupCreationData`에 없음
- **해결**: 
  - null을 undefined로 변환
  - `subject_constraints` 변환 로직 추가
  - `content_allocations` 제거

### 9. lib/utils/planGroupTransform.ts
- **문제**: `subject_constraints` 타입 불일치
- **해결**: 타입 변환 추가

### 10. lib/validation/wizardValidator.ts
- **문제**: 
  - `subject_allocations`가 undefined일 수 있음
  - `subject_constraints` 타입 불일치
- **해결**: 
  - optional 체크 추가
  - `WizardData`의 `subject_constraints`를 `SubjectConstraints` 타입으로 변환하는 로직 추가

### 11. scripts/check-student-scores.ts
- **문제**: `getUserByEmail` 메서드가 존재하지 않음
- **해결**: `listUsers`를 사용하여 이메일로 필터링

### 12. scripts/get-subjects-schema.ts
- **문제**: `supabaseUrl`과 `supabaseServiceRoleKey`가 undefined일 수 있음
- **해결**: null 체크 추가

### 13. scripts/seedScoreDashboardDummy.ts
- **문제**: `curriculumRevisionId`가 `null`일 수 있는데 함수 파라미터는 `string`을 요구
- **해결**: null 체크 추가 및 에러 처리

## 결과
- 총 25개의 TypeScript 컴파일 에러를 모두 수정
- 타입 안전성 향상
- 코드 품질 개선

