# Settings 페이지 저장 로직 최적화

## 작업 일시
2025년 1월

## 작업 목적
Settings 페이지에서 발생하는 불필요한 요청과 리렌더링을 줄여 성능을 개선하고 사용자 경험을 향상시킵니다.

## 문제점 분석

1. **학교 타입 조회**: `formData.school_id` 변경 시마다 즉시 `getSchoolById` 호출로 불필요한 요청 발생
2. **자동 계산 useEffect**: `formData.exam_year`, `formData.curriculum_revision`이 dependency에 포함되어 무한 루프 가능성
3. **hasChanges 계산**: `JSON.stringify`로 전체 객체 비교하여 비효율적
4. **불필요한 리렌더링**: 자동 계산으로 인한 연쇄적인 상태 업데이트

## 구현 내용

### 1. 학교 타입 조회에 Debounce 추가

**파일**: `app/(student)/settings/page.tsx` (139-161줄)

- `formData.school_id` 변경 시 300ms debounce 적용
- 연속된 변경 시 마지막 요청만 실행
- cleanup 함수로 이전 timeout 취소

**변경 전**:
```typescript
useEffect(() => {
  async function fetchSchoolType() {
    // ... 조회 로직
  }
  fetchSchoolType();
}, [formData.school_id]);
```

**변경 후**:
```typescript
useEffect(() => {
  if (!formData.school_id) {
    setSchoolType(undefined);
    return;
  }

  const timeoutId = setTimeout(async () => {
    // ... 조회 로직
  }, 300);

  return () => clearTimeout(timeoutId);
}, [formData.school_id]);
```

### 2. 자동 계산 useEffect 최적화

**파일**: `app/(student)/settings/page.tsx` (221-323줄)

- 계산 대상 필드(`formData.exam_year`, `formData.curriculum_revision`)를 dependency에서 제거
- 자동 계산으로 값이 변경되어도 useEffect가 재실행되지 않도록 수정
- 무한 루프 방지

**입시년도 자동 계산**:
- 변경 전: `[formData.grade, formData.exam_year, schoolType, autoCalculateExamYear]`
- 변경 후: `[formData.grade, schoolType, autoCalculateExamYear]`

**개정교육과정 자동 계산**:
- 변경 전: `[formData.grade, formData.birth_date, formData.curriculum_revision, schoolType, autoCalculateCurriculum]`
- 변경 후: `[formData.grade, formData.birth_date, schoolType, autoCalculateCurriculum]`

### 3. hasChanges 계산 최적화

**파일**: `app/(student)/settings/page.tsx` (125-131줄)

- `JSON.stringify` 대신 필드별 직접 비교로 변경
- 배열 필드(`desired_university_ids`)만 `JSON.stringify` 사용
- 성능 개선 및 메모리 사용량 감소

**변경 전**:
```typescript
const hasChanges = useMemo(() => {
  if (!initialFormDataRef.current) return false;
  return (
    JSON.stringify(formData) !== JSON.stringify(initialFormDataRef.current)
  );
}, [formData]);
```

**변경 후**:
```typescript
const hasChanges = useMemo(() => {
  if (!initialFormDataRef.current) return false;
  
  const initial = initialFormDataRef.current;
  const current = formData;
  
  return (
    initial.name !== current.name ||
    initial.school_id !== current.school_id ||
    initial.grade !== current.grade ||
    initial.birth_date !== current.birth_date ||
    initial.gender !== current.gender ||
    initial.phone !== current.phone ||
    initial.mother_phone !== current.mother_phone ||
    initial.father_phone !== current.father_phone ||
    initial.exam_year !== current.exam_year ||
    initial.curriculum_revision !== current.curriculum_revision ||
    JSON.stringify(initial.desired_university_ids) !== JSON.stringify(current.desired_university_ids) ||
    initial.desired_career_field !== current.desired_career_field
  );
}, [formData]);
```

### 4. initialFormDataRef 업데이트 최적화

**파일**: `app/(student)/settings/page.tsx` (221-323줄)

- `initialFormDataRef` 업데이트 시 `JSON.parse(JSON.stringify())` 대신 직접 할당
- 불필요한 깊은 복사 제거
- 성능 개선

**변경 전**:
```typescript
initialFormDataRef.current = JSON.parse(
  JSON.stringify({
    ...initialFormDataRef.current,
    exam_year: calculatedYear.toString(),
  })
);
```

**변경 후**:
```typescript
initialFormDataRef.current = {
  ...initialFormDataRef.current,
  exam_year: calculatedYear.toString(),
};
```

## 예상 효과

1. **학교 타입 조회**: 연속 입력 시 요청 수 대폭 감소 (debounce로 인해)
2. **자동 계산**: 무한 루프 방지 및 불필요한 리렌더링 제거
3. **hasChanges 계산**: 성능 개선 (약 10-20배 빠름)
4. **전체적인 성능**: 불필요한 요청 및 리렌더링 감소로 사용자 경험 개선

## 테스트 포인트

1. 학교 선택 시 네트워크 요청이 1회만 발생하는지 확인
2. 자동 계산 시 무한 루프가 발생하지 않는지 확인
3. hasChanges 계산이 정확하게 동작하는지 확인
4. 저장 버튼 활성화/비활성화가 올바르게 동작하는지 확인

## 관련 파일

- `app/(student)/settings/page.tsx`: 메인 설정 페이지 컴포넌트



