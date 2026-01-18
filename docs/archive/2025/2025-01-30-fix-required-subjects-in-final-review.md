# 최종 확인 단계에서 필수 과목 표시 영역 비활성화

## 문제 상황
- 최종 확인 단계(Step 6)에서 일반 모드에서도 필수 과목 표시 영역이 표시되고 있었음
- 하드코딩된 국어/수학/영어가 일반 모드에서도 필수 과목으로 표시됨

## 수정 내용

### 1. Step6FinalReview.tsx 수정
- 필수 과목 우선 정렬 로직을 캠프 모드에서만 적용
- 필수 과목 검증을 캠프 모드에서만 수행
- 필수 교과 설정(`subject_constraints.required_subjects`)을 기반으로 동적으로 생성

```typescript
// 수정 전
const requiredSubjects = ["국어", "수학", "영어"];

// 수정 후
const getRequiredSubjects = () => {
  if (!isCampMode) return [];
  
  const requiredSubjectCategories =
    data.subject_constraints?.required_subjects?.map(
      (req) => req.subject_category
    ) || [];
  
  return requiredSubjectCategories;
};

const requiredSubjects = getRequiredSubjects();
```

- 정렬 로직도 캠프 모드에서만 필수 과목 우선 정렬 적용
- 일반 모드에서는 알파벳 순서로 정렬

### 2. ContentsSummary.tsx 수정
- 하드코딩된 국어/수학/영어 필수 과목 체크 제거
- `isCampMode` prop 추가
- 필수 교과 설정을 기반으로 동적으로 생성
- 필수 과목 UI는 캠프 모드에서만 표시

```typescript
// 수정 전
const requiredSubjects = useMemo(() => {
  const subjects = subjectGroups.map((g) => g.subject);
  return [
    { name: "국어", selected: subjects.includes("국어") },
    { name: "수학", selected: subjects.includes("수학") },
    { name: "영어", selected: subjects.includes("영어") },
  ];
}, [subjectGroups]);

// 수정 후
const requiredSubjects = useMemo(() => {
  if (!isCampMode) return [];
  
  const requiredSubjectCategories =
    data.subject_constraints?.required_subjects?.map(
      (req) => req.subject_category
    ) || [];
  
  if (requiredSubjectCategories.length === 0) {
    return [];
  }
  
  const subjects = subjectGroups.map((g) => g.subject);
  return requiredSubjectCategories.map((category) => ({
    name: category,
    selected: subjects.includes(category),
  }));
}, [subjectGroups, data.subject_constraints?.required_subjects, isCampMode]);
```

### 3. Step6Simplified.tsx 수정
- `ContentsSummary`에 `isCampMode` prop 전달

```typescript
<ContentsSummary data={data} isCampMode={isCampMode} />
```

## 동작 방식

### 일반 모드
1. 필수 과목 우선 정렬 적용 안 됨 (알파벳 순서)
2. 필수 과목 검증 수행 안 됨
3. 필수 과목 표시 UI 표시 안 됨
4. 과목별 상세에서 필수 과목 highlight 없음

### 캠프 모드
1. 필수 교과 설정에서 지정한 과목이 있으면 우선 정렬
2. 필수 교과 설정이 없으면 알파벳 순서로 정렬
3. 필수 과목 표시 UI 표시 (필수 교과 설정이 있는 경우만)
4. 과목별 상세에서 필수 과목 highlight 표시

## 테스트 방법

### 일반 모드
1. 학생 페이지에서 일반 모드로 플랜 생성 시작
2. Step 6 (최종 확인)로 이동
3. 필수 과목 표시 영역이 표시되지 않는지 확인
4. 과목이 알파벳 순서로 정렬되는지 확인

### 캠프 모드
1. 캠프 모드로 플랜 생성 시작
2. Step 4에서 필수 교과 설정 (예: 과학 추가)
3. Step 6 (최종 확인)로 이동
4. 필수 과목 표시 영역에 과학이 표시되는지 확인
5. 과학이 우선 정렬되는지 확인
6. 과목별 상세에서 과학이 highlight되는지 확인

## 관련 파일
- `app/(student)/plan/new-group/_components/Step6FinalReview.tsx`
- `app/(student)/plan/new-group/_components/_summary/ContentsSummary.tsx`
- `app/(student)/plan/new-group/_components/Step6Simplified.tsx`

## 날짜
2025-01-30

