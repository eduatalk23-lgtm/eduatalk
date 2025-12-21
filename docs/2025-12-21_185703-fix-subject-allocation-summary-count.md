# 취약과목 수치 표시 문제 수정

## 📋 작업 개요

**작업 일시**: 2025-12-21  
**작업 내용**: `SubjectAllocationSummary` 컴포넌트에서 취약과목 수치가 0개로 잘못 표시되는 문제 수정

## 🔍 문제 상황

### 발생 위치
- 컴포넌트: `app/(student)/plan/new-group/_components/_summary/SubjectAllocationSummary.tsx`
- 표시 위치: Step 6 (최종 확인 단계) - `Step6Simplified` 컴포넌트

### 문제점
- 취약과목을 선택했는데도 "취약과목 0개"로 표시됨
- 실제 데이터는 있지만 필터링이 제대로 되지 않는 것으로 추정

## 🔧 수정 내용

### 1. 데이터 필터링 로직 개선

**파일**: `app/(student)/plan/new-group/_components/_summary/SubjectAllocationSummary.tsx`

#### 수정 전
```typescript
const allocations = useMemo(() => {
  if (!data.subject_allocations) return [];

  return data.subject_allocations.map((alloc) => ({
    subject: alloc.subject_name,
    type: alloc.subject_type,
    days: alloc.weekly_days || 0,
  }));
}, [data.subject_allocations]);
```

#### 수정 후
```typescript
const allocations = useMemo(() => {
  if (!data.subject_allocations) return [];

  const filtered = data.subject_allocations
    .filter((alloc) => alloc && alloc.subject_name && alloc.subject_type)
    .map((alloc) => ({
      subject: alloc.subject_name,
      type: alloc.subject_type,
      days: alloc.weekly_days || 0,
    }));

  // 개발 환경에서만 디버깅 로그
  if (process.env.NODE_ENV === "development") {
    console.log("[SubjectAllocationSummary] Raw data:", {
      subject_allocations: data.subject_allocations,
      allocations: filtered,
    });
  }

  return filtered;
}, [data.subject_allocations]);
```

**변경 사항**:
- null/undefined 체크 추가
- `subject_name`과 `subject_type` 필수 필드 검증 추가
- 개발 환경 디버깅 로그 추가

### 2. 필터링 로직 안전성 강화

#### 수정 전
```typescript
const weakSubjects = useMemo(() => {
  return allocations.filter((a) => a.type === "weakness");
}, [allocations]);
```

#### 수정 후
```typescript
const weakSubjects = useMemo(() => {
  const filtered = allocations.filter((a) => {
    if (!a || !a.type) return false;
    const type = String(a.type).toLowerCase().trim();
    return type === "weakness";
  });

  // 개발 환경에서만 디버깅 로그
  if (process.env.NODE_ENV === "development") {
    console.log("[SubjectAllocationSummary] Debug:", {
      raw_allocations: data.subject_allocations,
      parsed_allocations: allocations,
      weakSubjects: filtered,
      all_types: allocations.map((a) => ({ type: a.type, subject: a.subject })),
      weakSubjects_count: filtered.length,
    });
  }

  return filtered;
}, [allocations, data.subject_allocations]);
```

**변경 사항**:
- null/undefined 체크 추가
- 대소문자 및 공백 정규화 (`toLowerCase().trim()`)
- 상세한 디버깅 로그 추가 (개발 환경에서만)

### 3. 전략과목 필터링도 동일하게 개선

```typescript
const strategicSubjects = useMemo(() => {
  return allocations.filter((a) => {
    if (!a || !a.type) return false;
    const type = String(a.type).toLowerCase().trim();
    return type === "strategy";
  });
}, [allocations]);
```

## ✅ 수정 결과

### 개선 사항
1. **데이터 검증 강화**: null/undefined 및 필수 필드 검증 추가
2. **필터링 안전성 향상**: 대소문자 및 공백 정규화로 더 안전한 필터링
3. **디버깅 지원**: 개발 환경에서 상세한 로그 제공

### 디버깅 방법

개발 환경에서 브라우저 콘솔을 열고 다음 로그를 확인:

```javascript
// 원본 데이터 확인
[SubjectAllocationSummary] Raw data: {
  subject_allocations: [...],
  allocations: [...]
}

// 취약과목 필터링 결과 확인
[SubjectAllocationSummary] Debug: {
  raw_allocations: [...],
  parsed_allocations: [...],
  weakSubjects: [...],
  all_types: [...],
  weakSubjects_count: 0
}
```

### 예상 원인

1. **데이터 구조 불일치**: `subject_type` 값이 예상과 다를 수 있음
2. **데이터 전달 문제**: `data.subject_allocations`가 제대로 전달되지 않을 수 있음
3. **타입 변환 문제**: 문자열 타입이 예상과 다를 수 있음

## 📝 참고 사항

### WizardData 타입 정의
```typescript
subject_allocations?: Array<{
  subject_id: string;
  subject_name: string;
  subject_type: "strategy" | "weakness";
  weekly_days?: number; // 전략과목인 경우: 2, 3, 4
}>;
```

### 데이터 저장 위치
- `SubjectAllocationUI` 컴포넌트에서 취약과목 선택 시 `subject_type: "weakness"`로 저장
- `Step6Simplified` 컴포넌트에서 `SubjectAllocationSummary`에 데이터 전달

### 다음 단계

만약 문제가 계속 발생한다면:
1. 브라우저 콘솔에서 디버깅 로그 확인
2. `data.subject_allocations`의 실제 값 확인
3. `subject_type` 값이 정확히 `"weakness"`인지 확인
4. 데이터가 제대로 저장되고 전달되는지 확인

