# 필수 교과 설정 개정교육과정 지원

## 작업 개요

필수 교과 설정의 세부 과목 지정 기능을 개정교육과정을 고려하도록 개선했습니다. 템플릿에서 사용할 개정교육과정을 선택할 수 있도록 하고, `subjects` 테이블을 통해 정확한 과목을 조회하도록 수정했습니다.

**작업 일시**: 2025-02-02

---

## 문제점

1. **잘못된 과목 참고**
   - `fetchDetailSubjects` 함수가 `master_books`와 `master_lectures`에서 세부 과목을 조회
   - 개정교육과정을 고려하지 않아 잘못된 과목을 참고

2. **템플릿에서 개정교육과정 선택 불가**
   - 템플릿 생성 시 사용할 개정교육과정을 선택할 수 없음
   - 모든 학생에게 동일한 과목 목록이 표시됨

3. **학생 개정교육과정 확인 불가**
   - 학생의 개정교육과정과 템플릿의 개정교육과정을 비교하는 로직이 없음
   - 개정교육과정이 다른 경우 경고 표시 불가

---

## 해결 방안

### 1. WizardData에 curriculum_revision_id 추가

**파일**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

**변경 사항**:
- `subject_constraints`에 `curriculum_revision_id` 필드 추가

**변경 후**:
```typescript
subject_constraints?: {
  enable_required_subjects_validation?: boolean;
  curriculum_revision_id?: string; // 템플릿에서 사용할 개정교육과정 ID
  required_subjects?: Array<{
    subject_category: string;
    subject?: string;
    min_count: number;
  }>;
  excluded_subjects?: string[];
  constraint_handling: "strict" | "warning" | "auto_fix";
};
```

**영향**:
- 템플릿 데이터에 개정교육과정 ID 저장 가능
- 학생이 템플릿 작성 시 템플릿의 개정교육과정 확인 가능

---

### 2. fetchDetailSubjects 함수 수정

**파일**: `app/(student)/actions/fetchDetailSubjects.ts`

**변경 사항**:
- 개정교육과정 ID를 파라미터로 받도록 수정
- 개정교육과정 ID가 있으면 `subjects` 테이블에서 조회
- `subject_groups` → `subjects` 관계를 통해 정확한 과목 조회

**변경 전**:
```typescript
export async function fetchDetailSubjects(subjectCategory: string): Promise<string[]>
```

**변경 후**:
```typescript
export async function fetchDetailSubjects(
  subjectCategory: string,
  curriculumRevisionId?: string
): Promise<string[]>
```

**구현**:
- `curriculumRevisionId`가 있으면 `getSubjectsByGroupName` 함수 사용
- `subject_groups`에서 `curriculum_revision_id`와 `name`으로 교과 그룹 조회
- 해당 교과 그룹의 `subjects` 조회
- 과목명 배열 반환

**하위 호환성**:
- `curriculumRevisionId`가 없으면 기존 방식 유지 (master_books, master_lectures에서 조회)

**영향**:
- 개정교육과정별로 정확한 과목 목록 조회 가능
- 정규화된 `subjects` 테이블 구조 활용

---

### 3. RequiredSubjectsSection에 개정교육과정 선택 UI 추가

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents/components/RequiredSubjectsSection.tsx`

**변경 사항**:
- 템플릿 모드일 때 개정교육과정 선택 드롭다운 추가
- 선택한 개정교육과정을 `subject_constraints.curriculum_revision_id`에 저장
- 개정교육과정 변경 시 기존 세부 과목 목록 초기화

**추가 기능**:
- 개정교육과정 목록 조회 (`getCurriculumRevisionsAction`)
- 개정교육과정 선택 드롭다운 (템플릿 모드에서만 표시)
- 개정교육과정 변경 시 세부 과목 초기화

**영향**:
- 관리자가 템플릿 생성 시 개정교육과정 선택 가능
- 선택한 개정교육과정의 정확한 과목 목록 조회 가능

---

### 4. Step3ContentSelection에 개정교육과정 선택 UI 추가

**파일**: `app/(student)/plan/new-group/_components/Step3ContentSelection.tsx`

**변경 사항**:
- 템플릿 모드일 때 개정교육과정 선택 드롭다운 추가
- `handleLoadDetailSubjects`에 `curriculumRevisionId` 파라미터 추가
- 개정교육과정 전달 로직 추가

**영향**:
- 템플릿 모드에서 Step 4에서도 개정교육과정 선택 가능
- 세부 과목 조회 시 개정교육과정 고려

---

### 5. 학생 개정교육과정 확인 및 비교 로직 추가

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents/components/RequiredSubjectsSection.tsx`

**변경 사항**:
- 캠프 모드일 때 학생의 개정교육과정 확인 (`getCurrentStudent`)
- 템플릿의 개정교육과정과 학생의 개정교육과정 비교
- 불일치 시 경고 메시지 표시

**구현**:
- 학생의 `curriculum_revision` 텍스트 (예: "2022 개정") 조회
- 템플릿의 `curriculum_revision_id`로 `curriculum_revisions` 테이블에서 이름 조회
- 연도 또는 이름으로 비교하여 불일치 확인
- 불일치 시 경고 메시지 표시

**영향**:
- 학생이 캠프 템플릿 작성 시 개정교육과정 불일치 경고 표시
- 관리자가 템플릿 생성 시 적절한 개정교육과정 선택 유도

---

## 데이터 흐름

### 1. 템플릿 생성 시

```
관리자 → 개정교육과정 선택
  ↓
curriculum_revision_id 저장
  ↓
세부 과목 조회 시 curriculum_revision_id 전달
  ↓
subject_groups (curriculum_revision_id + name) 조회
  ↓
subjects (subject_group_id) 조회
  ↓
과목명 배열 반환
```

### 2. 학생이 템플릿 작성 시

```
학생 정보 조회 → curriculum_revision (텍스트)
  ↓
템플릿의 curriculum_revision_id → curriculum_revisions.name
  ↓
비교 → 불일치 시 경고 표시
```

### 3. 세부 과목 조회

```
교과 선택 → curriculum_revision_id + subject_category
  ↓
subject_groups 조회 (curriculum_revision_id + name)
  ↓
subjects 조회 (subject_group_id)
  ↓
과목명 배열 반환
```

---

## 검증 사항

### ✅ 완료된 검증

1. **템플릿 모드에서 개정교육과정 선택**
   - 템플릿 모드에서 개정교육과정 선택 드롭다운 표시
   - 개정교육과정 선택 시 `curriculum_revision_id` 저장
   - 개정교육과정 변경 시 세부 과목 초기화

2. **세부 과목 조회**
   - 개정교육과정 ID가 있을 때 `subjects` 테이블에서 조회
   - 개정교육과정별로 정확한 과목 목록 조회
   - 하위 호환성 유지 (개정교육과정 ID 없을 때 기존 방식)

3. **학생 개정교육과정 확인**
   - 캠프 모드에서 학생의 개정교육과정 조회
   - 템플릿의 개정교육과정과 비교
   - 불일치 시 경고 메시지 표시

---

## 관련 파일

- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`
- `app/(student)/actions/fetchDetailSubjects.ts`
- `app/(student)/plan/new-group/_components/Step4RecommendedContents/components/RequiredSubjectsSection.tsx`
- `app/(student)/plan/new-group/_components/Step3ContentSelection.tsx`
- `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`
- `lib/data/subjects.ts`

---

## 참고 사항

- 개정교육과정은 `curriculum_revisions` 테이블에서 관리됨
- 교과 그룹은 `subject_groups` 테이블에서 `curriculum_revision_id`로 연결됨
- 과목은 `subjects` 테이블에서 `subject_group_id`로 연결됨
- 학생의 `curriculum_revision`은 `student_career_goals` 테이블에 텍스트 형식으로 저장됨 ("2009 개정", "2015 개정", "2022 개정")
- 템플릿의 `curriculum_revision_id`는 UUID 형식으로 저장됨

