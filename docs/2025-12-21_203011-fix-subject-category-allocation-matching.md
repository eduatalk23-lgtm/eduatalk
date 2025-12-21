# 교과/과목 혼동 문제 수정

## 개요

교과별 설정(`subject_allocations`)에서 교과(`subject_category`)와 과목(`subject`)을 혼동하여 매칭하는 문제를 수정했습니다.

## 문제 분석

### 기존 문제점

1. **매칭 로직 혼동**:
   - `getEffectiveAllocation` 함수에서 교과별 설정 매칭 시 `subject` 필드(과목)도 매칭 조건에 포함
   - 교과별 설정은 교과(`subject_category`)만 기준으로 매칭해야 하는데, 과목 필드로도 매칭 시도

2. **에러 메시지 혼동**:
   - 검증 로직에서 에러 메시지가 "다음 과목의 콘텐츠를 선택해주세요"라고 되어 있지만 실제로는 "교과"를 의미

### 데이터 구조

- `subject_category`: 교과 (예: "수학", "국어", "영어")
- `subject`: 과목 (예: "미적분", "확률과 통계", "화법과 작문")
- `subject_allocations.subject_name`: 교과별 설정에서 사용하는 필드 (교과 이름이어야 함)

## 수정 내용

### 1. `lib/utils/subjectAllocation.ts` 수정

#### 변경 사항

- `getEffectiveAllocation` 함수에서 2-4 단계(과목 필드 매칭) 제거
- 교과별 설정은 `subject_category`(교과)만 기준으로 매칭하도록 수정
- 주석 업데이트: 교과별 설정의 매칭 기준 명확화

#### 수정 전

```typescript
// 2-4: subject 필드도 매칭 조건에 포함
if (content.subject) {
  const subjectAlloc = subjectAllocations.find(
    (a) =>
      normalizeString(a.subject_name) === normalizeString(content.subject!) ||
      isPartialMatch(a.subject_name, content.subject!)
  );
  if (subjectAlloc) {
    // ...
  }
}
```

#### 수정 후

```typescript
// 2순위: 교과별 설정 (폴백)
// 교과별 설정은 subject_category(교과)만 기준으로 매칭
// subject 필드(과목)는 매칭 조건에서 제외
if (subjectAllocations && subjectAllocations.length > 0) {
  // 2-1: subject_id로 매칭 (가장 정확)
  // 2-2: subject_name과 subject_category 정확 일치
  // 2-3: subject_name에 subject_category가 포함되는지 확인 (부분 매칭)
  // 2-4 단계 제거됨
}
```

### 2. `lib/validation/wizardValidator.ts` 수정

#### 변경 사항

- 에러 메시지 수정: "다음 과목의 콘텐츠를 선택해주세요" → "다음 교과의 콘텐츠를 선택해주세요"
- 주석 수정: "과목 일치 검증" → "교과 일치 검증"

#### 수정 전

```typescript
// subject_allocations가 있을 때만 과목 일치 검증 수행
// subject_allocations의 모든 과목이 콘텐츠에 포함되어 있는지 검증
// ...
errors.push(
  `다음 과목의 콘텐츠를 선택해주세요: ${missingSubjects.join(", ")}`
);
```

#### 수정 후

```typescript
// subject_allocations가 있을 때만 교과 일치 검증 수행
// subject_allocations의 모든 교과가 콘텐츠에 포함되어 있는지 검증
// ...
errors.push(
  `다음 교과의 콘텐츠를 선택해주세요: ${missingSubjects.join(", ")}`
);
```

### 3. 테스트 파일 수정

#### 변경 사항

- `__tests__/utils/subjectAllocation.test.ts`에서 과목 필드 매칭 테스트 수정
- 교과별 설정이 교과만 기준으로 매칭되는지 확인하는 테스트로 변경

#### 수정 전

```typescript
it("subject 필드도 매칭 조건에 포함", () => {
  // subject 필드로 매칭 성공하는 테스트
});
```

#### 수정 후

```typescript
it("subject 필드는 매칭 조건에서 제외 (교과별 설정은 교과만 기준)", () => {
  // subject 필드만 있고 subject_category가 없으면 매칭 실패하는 테스트
});
```

## 매칭 우선순위 (수정 후)

1. **콘텐츠별 설정** (`content_allocations`)
   - `content_type`과 `content_id`로 정확히 매칭

2. **교과별 설정** (`subject_allocations`)
   - 2-1: `subject_id`로 매칭 (가장 정확)
   - 2-2: `subject_name`과 `subject_category` 정확 일치
   - 2-3: `subject_name`에 `subject_category`가 포함되는지 확인 (부분 매칭)
   - **제거됨**: `subject` 필드 매칭 (2-4 단계)

3. **기본값** (취약과목)

## 영향 범위

### 변경되지 않은 부분

- `lib/plan/scheduler.ts`: `getEffectiveAllocation` 호출 부분은 변경 불필요 (이미 `subject_category` 전달)
- `app/(student)/plan/new-group/_components/Step6Simplified.tsx`: `getEffectiveAllocationForContent` 호출 부분은 변경 불필요

### 레거시 코드

- `lib/plan/1730TimetableLogic.ts`: `getContentAllocation` 함수는 레거시 함수로, `getEffectiveAllocation` 사용을 권장

## 검증 방법

### 단위 테스트

```bash
npm test -- __tests__/utils/subjectAllocation.test.ts
```

### 수동 테스트

1. Step 6에서 교과별 설정 모드로 전환
2. 교과 설정 후 검증 오류 확인
3. 에러 메시지가 "교과"로 표시되는지 확인

## 예상 효과

1. **명확성 향상**: 교과와 과목의 구분이 명확해짐
2. **버그 수정**: 교과별 설정이 올바르게 동작
3. **유지보수성 향상**: 코드 의도가 명확해짐
4. **성능 개선**: 불필요한 매칭 단계 제거

## 주의사항

1. **하위 호환성**: 기존 데이터 구조는 변경하지 않음
2. **기존 동작**: 콘텐츠별 설정은 기존과 동일하게 동작
3. **테스트**: 기존 테스트 케이스가 정상 동작하는지 확인 필요

## 관련 파일

- `lib/utils/subjectAllocation.ts`
- `lib/validation/wizardValidator.ts`
- `__tests__/utils/subjectAllocation.test.ts`
- `lib/plan/1730TimetableLogic.ts` (레거시, 참고용)

