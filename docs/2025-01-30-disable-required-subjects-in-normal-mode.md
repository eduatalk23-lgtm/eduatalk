# 일반 모드에서 필수 교과 설정 UI 비활성화 및 동적 반영

## 문제 상황
- 학생 페이지에서 일반 모드 진행 시 필수 교과 설정과 관계 없이 표시되는 영역이 있었음
- 필수 교과 설정이 UI에 반영되는지 확인 필요

## 수정 내용

### 1. ProgressIndicator 컴포넌트 개선
- 필수 과목 체크 로직 명확화
- `hasRequiredSubjects` 변수 추가로 조건 체크 명확화
- 필수 과목 미선택 경고도 `hasRequiredSubjects` 조건 추가

```typescript
// 수정 전
const allRequiredSelected =
  requiredSubjects.length > 0 &&
  requiredSubjects.every((subj) => subj.selected);
const someRequiredMissing =
  requiredSubjects.length > 0 &&
  requiredSubjects.some((subj) => !subj.selected);

// 수정 후
const hasRequiredSubjects = requiredSubjects.length > 0;
const allRequiredSelected =
  hasRequiredSubjects &&
  requiredSubjects.every((subj) => subj.selected);
const someRequiredMissing =
  hasRequiredSubjects &&
  requiredSubjects.some((subj) => !subj.selected);
```

### 2. 필수 교과 설정 동적 반영
- 기존: 하드코딩된 국어/수학/영어만 체크
- 수정: `data.subject_constraints.required_subjects`를 기반으로 동적으로 생성
- 필수 교과 설정에서 추가한 교과가 ProgressIndicator에 즉시 반영됨

```typescript
// 수정 전
return [
  { subject: "국어", selected: subjectSet.has("국어") },
  { subject: "수학", selected: subjectSet.has("수학") },
  { subject: "영어", selected: subjectSet.has("영어") },
];

// 수정 후
const requiredSubjectCategories =
  data.subject_constraints?.required_subjects?.map(
    (req) => req.subject_category
  ) || [];

if (requiredSubjectCategories.length === 0) {
  return [];
}

return requiredSubjectCategories.map((category) => ({
  subject: category,
  selected: subjectSet.has(category),
}));
```

### 3. 일반 모드에서 필수 교과 UI 비활성화 확인
- `requiredSubjects`는 이미 일반 모드에서 빈 배열 반환
- `ProgressIndicator`는 `hasRequiredSubjects`가 false일 때 필수 과목 UI를 표시하지 않음
- 필수 교과 설정 섹션은 `{isCampMode && (` 조건으로 캠프 모드에서만 표시

## 동작 방식

### 일반 모드
1. `requiredSubjects`는 빈 배열 `[]` 반환
2. `ProgressIndicator`의 `hasRequiredSubjects`는 `false`
3. 필수 과목 체크 UI 표시되지 않음
4. 필수 교과 설정 섹션 표시되지 않음

### 캠프 모드
1. 필수 교과 설정 섹션 표시
2. 필수 교과 설정에서 추가한 교과가 `requiredSubjects`에 반영
3. `ProgressIndicator`에 필수 과목 체크 UI 표시
4. 선택한 콘텐츠의 `subject_category`와 비교하여 선택 상태 표시
5. 필수 과목 미선택 시 경고 메시지 표시

## 테스트 방법

### 일반 모드
1. 학생 페이지에서 일반 모드로 플랜 생성 시작
2. Step 4 (콘텐츠 선택)로 이동
3. 필수 교과 설정 섹션이 표시되지 않는지 확인
4. `ProgressIndicator`에 필수 과목 체크 UI가 표시되지 않는지 확인

### 캠프 모드
1. 캠프 모드로 플랜 생성 시작
2. Step 4 (콘텐츠 선택)로 이동
3. 필수 교과 설정 섹션이 표시되는지 확인
4. 필수 교과 추가 (예: 과학)
5. `ProgressIndicator`에 과학이 필수 과목으로 표시되는지 확인
6. 과학 과목 콘텐츠 선택 시 선택 상태로 변경되는지 확인
7. 필수 과목 미선택 시 경고 메시지가 표시되는지 확인

## 관련 파일
- `app/(student)/plan/new-group/_components/_shared/ProgressIndicator.tsx`
- `app/(student)/plan/new-group/_components/Step3ContentSelection.tsx`

## 날짜
2025-01-30

