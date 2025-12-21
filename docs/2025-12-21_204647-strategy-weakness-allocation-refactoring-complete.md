# 전략과목/취약과목 기능 리팩토링 완료 보고서

## 작업 일자
2025-12-21

## 개요

전략과목/취약과목 기능의 하드코딩된 부분을 제거하고, 실제 데이터베이스의 `subject_id`를 사용하도록 개선했습니다. 또한 검증 로직을 개선하여 `subject_id`와 `subject_category`를 모두 고려하도록 수정했습니다.

## 완료된 작업

### Phase 1: 데이터 구조 정리 ✅

#### 1.1 ContentInfo 타입 확장
- **파일**: `app/(student)/plan/new-group/_components/_features/content-selection/Step6FinalReview/types.ts`
- **변경**: `ContentInfo` 타입에 `subject_id?: string | null` 필드 추가

#### 1.2 메타데이터 조회 개선
- **파일**: `lib/data/contentMetadata.ts`
- **변경 사항**:
  - `ContentMetadata` 타입에 `subject_id` 필드 추가
  - `fetchContentMetadata` 함수에서 `subject_id` 조회 추가
  - 학생 콘텐츠와 마스터 콘텐츠 모두에서 `subject_id` 포함

#### 1.3 콘텐츠 정보 로딩 개선
- **파일**: `app/(student)/plan/new-group/_components/_features/content-selection/Step6FinalReview/hooks/useContentInfos.ts`
- **변경**: 학생 콘텐츠와 추천 콘텐츠 모두에서 `subject_id` 포함

#### 1.4 교과별 설정에서 실제 subject_id 사용
- **파일**: `app/(student)/plan/new-group/_components/Step6Simplified.tsx`
- **변경 사항**:
  - `handleSubjectAllocationChange` 함수에서 해당 교과의 콘텐츠에서 실제 `subject_id` 추출
  - 하드코딩된 `subject_id` 생성 로직 제거 (`subject.toLowerCase().replace(/\s+/g, "_")`)

#### 1.5 getEffectiveAllocation 호출 개선
- **파일**: 
  - `app/(student)/plan/new-group/_components/Step6Simplified.tsx`
  - `app/(student)/plan/new-group/_components/_features/content-selection/Step6FinalReview/ContentAllocationUI.tsx`
- **변경**: `getEffectiveAllocation` 호출 시 실제 `subject_id` 전달

### Phase 3: 검증 로직 개선 ✅

#### 3.1 검증 로직 정확도 향상
- **파일**: `lib/validation/wizardValidator.ts`
- **변경 사항**:
  - `subject_id`와 `subject_category` 모두 고려한 검증 로직 구현
  - `subject_id`가 있으면 `subject_id`로 매칭 시도
  - 없으면 `subject_category`로 매칭
  - 더 정확한 매칭 가능

#### 3.2 WizardData 타입 확장
- **파일**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`
- **변경**: `student_contents`와 `recommended_contents`에 `subject_id?: string | null` 필드 추가

#### 3.3 초기화 로직 개선
- **파일**: `app/(student)/plan/new-group/_components/Step6Simplified.tsx`
- **변경 사항**:
  - 불필요한 자동 초기화 제거
  - 사용자가 명시적으로 설정할 때만 데이터 생성
  - 폴백 메커니즘은 `getEffectiveAllocation` 함수에서 처리 (기본값: 취약과목)

## 주요 변경 사항

### 1. 하드코딩 제거

**이전**:
```typescript
subject_id: subject.toLowerCase().replace(/\s+/g, "_") // 하드코딩
```

**이후**:
```typescript
// 실제 콘텐츠에서 subject_id 추출
const actualSubjectId = subjectContents
  .map((c) => c.subject_id)
  .find((id) => id != null) || undefined;
```

### 2. 검증 로직 개선

**이전**:
```typescript
// subject_category만 사용
const contentSubjects = new Set([
  ...wizardData.student_contents.map((c) => c.subject_category).filter(Boolean),
]);
```

**이후**:
```typescript
// subject_id와 subject_category 모두 사용
const contentSubjectIds = new Set<string>();
const contentSubjectCategories = new Set<string>();
// subject_id로 먼저 매칭 시도, 없으면 subject_category로 매칭
```

### 3. 초기화 로직 개선

**이전**:
```typescript
// 모든 콘텐츠에 기본값 자동 추가
const defaultContentAllocations = contentInfos.map(...);
onUpdate({ content_allocations: defaultContentAllocations });
```

**이후**:
```typescript
// 자동 초기화 제거, 사용자가 명시적으로 설정할 때만 생성
// 폴백은 getEffectiveAllocation에서 처리
```

## 데이터 흐름

### 1. 콘텐츠 정보 로딩
```
데이터베이스 (books/lectures)
  ↓ (subject_id 포함)
fetchContentMetadata
  ↓ (ContentMetadata에 subject_id 포함)
useContentInfos
  ↓ (ContentInfo에 subject_id 포함)
UI 컴포넌트
```

### 2. 교과별 설정 생성
```
콘텐츠 목록 (subject_id 포함)
  ↓
교과별 그룹화
  ↓
실제 subject_id 추출
  ↓
subject_allocations 생성
```

### 3. 매칭 로직
```
getEffectiveAllocation
  ↓
1순위: content_allocations (콘텐츠별 설정)
  ↓
2순위: subject_allocations (교과별 설정)
  - 2-1: subject_id로 매칭 (가장 정확) ✅
  - 2-2: subject_category 정확 일치
  - 2-3: subject_category 부분 매칭
  ↓
3순위: 기본값 (취약과목)
```

## 검증 로직

### 매칭 우선순위

1. **subject_id로 매칭** (가장 정확)
   - `subject_allocations`의 `subject_id`와 콘텐츠의 `subject_id` 비교
   - 정확한 매칭 가능

2. **subject_category로 매칭**
   - `subject_allocations`의 `subject_name`과 콘텐츠의 `subject_category` 비교
   - 정확 일치 또는 부분 매칭

### 검증 에러 메시지

- **이전**: "다음 과목의 콘텐츠를 선택해주세요"
- **이후**: "다음 교과의 콘텐츠를 선택해주세요"

## 수정된 파일 목록

### Phase 1
1. `app/(student)/plan/new-group/_components/_features/content-selection/Step6FinalReview/types.ts`
2. `lib/data/contentMetadata.ts`
3. `app/(student)/plan/new-group/_components/_features/content-selection/Step6FinalReview/hooks/useContentInfos.ts`
4. `app/(student)/plan/new-group/_components/Step6Simplified.tsx`
5. `app/(student)/plan/new-group/_components/_features/content-selection/Step6FinalReview/ContentAllocationUI.tsx`
6. `app/(student)/plan/new-group/_components/_features/content-selection/Step6FinalReview/SubjectAllocationUI.tsx`

### Phase 3
1. `lib/validation/wizardValidator.ts`
2. `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`
3. `app/(student)/plan/new-group/_components/Step6Simplified.tsx`

## 테스트 확인 사항

### 단위 테스트
- ✅ `getEffectiveAllocation` 함수 테스트 (기존 테스트 수정 완료)
- ✅ `subject_id`로 정확한 매칭 확인
- ✅ `subject_category`로 매칭 확인

### 통합 테스트
- ✅ 교과별 설정 모드에서 실제 `subject_id` 사용 확인
- ✅ 검증 로직이 `subject_id`와 `subject_category` 모두 고려하는지 확인
- ✅ 초기화 로직이 불필요한 데이터를 생성하지 않는지 확인

## 예상 효과

1. **정확성 향상**: 실제 `subject_id` 사용으로 정확한 매칭
2. **유지보수성 향상**: 하드코딩 제거로 예상치 못한 동작 방지
3. **성능 개선**: 불필요한 자동 초기화 제거
4. **버그 감소**: 정확한 매칭으로 버그 감소

## 남은 작업

### Phase 2: UI 일관화 (Medium Priority)
- 통합 컴포넌트 생성 (`StrategyWeaknessAllocationEditor`)
- 교재/강의 콘텐츠 선택 UI와 일관된 패턴 적용
- 기존 컴포넌트 정리

### Phase 4: 추가 테스트 (Low Priority)
- E2E 테스트 추가
- 통합 테스트 보강

## 주의사항

1. **하위 호환성**: 기존 데이터 구조 유지
2. **점진적 마이그레이션**: 단계적으로 변경하여 안정성 확보
3. **데이터 마이그레이션**: 기존 데이터에 `subject_id`가 없을 수 있으므로 폴백 메커니즘 유지

## 관련 문서

- [리팩토링 계획](./2025-12-21_203500-strategy-weakness-allocation-refactoring-plan.md)
- [교과/과목 혼동 문제 수정](./2025-12-21_203011-fix-subject-category-allocation-matching.md)
- [전략과목/취약과목 배분 수정](./전략과목-취약과목-배분-수정.md)

