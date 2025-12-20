# 교과/과목 관리 폼 컴포넌트 리팩토링

**작업 일시**: 2025-02-05  
**작업 범위**: `app/(admin)/admin/subjects/_components` 폼 컴포넌트  
**목적**: 중복 로직 제거 및 `useAdminFormSubmit` 훅 활용

---

## 📋 작업 개요

### 문제점
- `GroupForm`, `SubjectTypeForm`, `RevisionForm`에서 중복된 로직:
  - 로딩 상태 관리 (`isSubmitting`)
  - 수동 `try/catch` 블록
  - 토스트 알림 직접 호출
  - 서버 액션 직접 호출

### 해결 방법
- `useAdminFormSubmit` 훅 활용하여 공통 로직 추상화
- Zod 스키마를 통한 검증 통합
- `onSuccess` 콜백 지원 (리다이렉트 없이)

---

## 🔧 변경 사항

### 1. Zod 스키마 추가 (`lib/validation/schemas.ts`)

**추가된 스키마**:

```typescript
/**
 * 교과 그룹 폼 스키마
 */
export const subjectGroupSchema = z.object({
  curriculum_revision_id: z.string().min(1, "개정교육과정을 선택해주세요."),
  name: z.string().min(1, "이름을 입력해주세요.").max(100, "이름은 100자 이하여야 합니다."),
});

/**
 * 과목구분 폼 스키마
 */
export const subjectTypeSchema = z.object({
  curriculum_revision_id: z.string().min(1, "개정교육과정을 선택해주세요."),
  name: z.string().min(1, "이름을 입력해주세요.").max(100, "이름은 100자 이하여야 합니다."),
  is_active: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((val) => val === true || val === "true"),
});

/**
 * 개정교육과정 폼 스키마
 */
export const curriculumRevisionSchema = z.object({
  name: z.string().min(1, "이름을 입력해주세요.").max(100, "이름은 100자 이하여야 합니다."),
});
```

### 2. `GroupForm.tsx` 리팩토링

**변경 전**:
- `isSubmitting` 상태 직접 관리
- `try/catch` 블록으로 에러 처리
- 토스트 메시지 직접 호출
- 검증 로직 중복

**변경 후**:
- `useAdminFormSubmit` 훅 사용
- `isPending` 상태 자동 관리
- 에러 처리 및 토스트 메시지 자동화
- Zod 스키마를 통한 검증

```typescript
const { handleSubmitWithFormData, isPending } = useAdminFormSubmit({
  action: async (formData: FormData) => {
    if (group) {
      await updateSubjectGroup(group.id, formData);
    } else {
      await createSubjectGroup(formData);
    }
  },
  schema: subjectGroupSchema,
  onSuccess: () => {
    onSuccess();
  },
  successMessage: group ? "교과가 수정되었습니다." : "교과가 생성되었습니다.",
});
```

### 3. `SubjectTypeForm.tsx` 리팩토링

**변경 사항**:
- `GroupForm`과 동일한 패턴 적용
- `is_active` 필드 처리 추가
- `handleSubmitWithFormData` 사용하여 FormData 수정 후 제출

```typescript
const { handleSubmitWithFormData, isPending } = useAdminFormSubmit({
  action: async (formData: FormData) => {
    if (subjectType) {
      await updateSubjectType(subjectType.id, formData);
    } else {
      await createSubjectType(formData);
    }
  },
  schema: subjectTypeSchema,
  onSuccess: () => {
    onSuccess();
  },
  successMessage: subjectType ? "과목구분이 수정되었습니다." : "과목구분이 생성되었습니다.",
});
```

### 4. `RevisionForm.tsx` 리팩토링

**특수 사항**:
- `createCurriculumRevisionAction`과 `updateCurriculumRevisionAction`은 FormData를 사용하지 않고 직접 파라미터를 받음
- 래퍼 함수로 FormData에서 값을 추출하여 전달

```typescript
const { handleSubmit, isPending } = useAdminFormSubmit({
  action: async (formData: FormData) => {
    const nameValue = formData.get("name")?.toString().trim() || "";
    if (revision) {
      await updateCurriculumRevisionAction(revision.id, {
        name: nameValue,
      });
    } else {
      await createCurriculumRevisionAction(nameValue);
    }
  },
  schema: curriculumRevisionSchema,
  onSuccess: () => {
    onSuccess();
  },
  successMessage: revision ? "개정교육과정이 수정되었습니다." : "개정교육과정이 생성되었습니다.",
});
```

---

## ✅ 개선 효과

### 코드 품질 개선
1. **중복 제거**: 각 폼에서 중복되던 로직 제거
2. **일관성**: 모든 폼이 동일한 패턴 사용
3. **유지보수성**: 공통 로직 변경 시 한 곳만 수정

### 기능 개선
1. **검증 강화**: Zod 스키마를 통한 타입 안전한 검증
2. **에러 처리**: 일관된 에러 처리 및 사용자 피드백
3. **로딩 상태**: `useTransition`을 통한 최적화된 로딩 상태 관리

### 개발자 경험 개선
1. **간결한 코드**: 폼 컴포넌트 코드가 더 간결해짐
2. **재사용성**: `useAdminFormSubmit` 훅을 다른 폼에서도 활용 가능
3. **타입 안전성**: Zod 스키마를 통한 타입 검증

---

## 📝 주요 변경 사항 요약

### 제거된 코드
- `isSubmitting` 상태 관리
- `try/catch` 블록
- 토스트 메시지 직접 호출 (`toast.showSuccess`, `toast.showError`)
- 수동 검증 로직

### 추가된 코드
- `useAdminFormSubmit` 훅 사용
- Zod 스키마 정의 및 사용
- `handleSubmitWithFormData` 사용 (FormData 수정이 필요한 경우)

### 변경된 코드
- `isSubmitting` → `isPending`
- 수동 에러 처리 → 훅에서 자동 처리
- 수동 검증 → Zod 스키마 검증

---

## 🔍 주의사항

### FormData 수정이 필요한 경우
- `GroupForm`과 `SubjectTypeForm`은 `curriculum_revision_id`를 props로 받아 FormData에 추가해야 함
- `handleSubmitWithFormData`를 사용하여 수정된 FormData를 전달

### RevisionForm의 특수성
- Server Action이 FormData를 받지 않으므로 래퍼 함수 필요
- FormData에서 값을 추출하여 직접 파라미터로 전달

---

## ✅ 체크리스트

- [x] Zod 스키마 생성 (subjectGroupSchema, subjectTypeSchema, curriculumRevisionSchema)
- [x] GroupForm.tsx 리팩토링
- [x] SubjectTypeForm.tsx 리팩토링
- [x] RevisionForm.tsx 리팩토링
- [x] 린터 에러 없음
- [x] 타입 안전성 유지
- [x] 기존 기능 정상 동작 확인 필요 (테스트 권장)

---

**작업 완료**: 2025-02-05

