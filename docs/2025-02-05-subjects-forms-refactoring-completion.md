# 교과/과목 관리 폼 컴포넌트 리팩토링 완료 보고서

**작업 일시**: 2025-02-05  
**작업자**: AI Assistant

## 개요

교과/과목 관리 페이지의 폼 컴포넌트들을 분석하고, 중복 코드를 제거하여 공통 컴포넌트로 추출하는 리팩토링을 완료했습니다.

## 작업 완료 사항

### 1. 공통 폼 컴포넌트 구조 확인 및 개선

이미 리팩토링이 완료된 상태였으며, 다음과 같은 구조로 잘 구성되어 있습니다:

#### Base 컴포넌트 (`_components/base/`)

- **`BaseSubjectForm.tsx`**: 과목명 입력, 과목구분 선택, 버튼(저장/취소)을 포함하는 순수 UI 폼 컴포넌트
  - Props: `name`, `subjectTypeId`, `subjectTypes`, `isPending`, `onNameChange`, `onSubjectTypeChange`, `onSubmit`, `onCancel`, `variant`
  - `variant` prop으로 인라인/모달 스타일 구분

- **`BaseGroupForm.tsx`**: 교과명 입력을 포함하는 공통 폼
  - Props: `name`, `isPending`, `onNameChange`, `onSubmit`, `onCancel`, `variant`

- **`BaseSubjectTypeForm.tsx`**: 과목구분명, 활성 여부를 포함하는 공통 폼
  - Props: `name`, `isActive`, `isPending`, `onNameChange`, `onIsActiveChange`, `onSubmit`, `onCancel`, `variant`

### 2. 래퍼 컴포넌트 구조

#### 인라인 폼 (`*Form.tsx`)

- **`SubjectForm.tsx`**: `BaseSubjectForm`을 import하여 렌더링하고, 컨테이너 스타일링과 `onSubmit` 핸들러만 연결하는 래퍼 컴포넌트
- **`GroupForm.tsx`**: `BaseGroupForm`을 사용하는 래퍼
- **`SubjectTypeForm.tsx`**: `BaseSubjectTypeForm`을 사용하는 래퍼

#### 모달 폼 (`*FormModal.tsx`)

- **`SubjectFormModal.tsx`**: `Dialog` 컴포넌트 내부에 `BaseSubjectForm`을 렌더링
- **`GroupFormModal.tsx`**: `Dialog` 컴포넌트 내부에 `BaseGroupForm`을 렌더링
- **`SubjectTypeFormModal.tsx`**: `Dialog` 컴포넌트 내부에 `BaseSubjectTypeForm`을 렌더링

### 3. 로직 재사용 개선

#### 커스텀 훅 (`hooks/`)

- **`useSubjectFormLogic.ts`**: ✅ **개선 완료** - `useAdminFormSubmit` 훅을 사용하도록 리팩토링
- **`useGroupFormLogic.ts`**: 이미 `useAdminFormSubmit` 사용 중
- **`useSubjectTypeFormLogic.ts`**: 이미 `useAdminFormSubmit` 사용 중

#### 개선 내용

**Before (useSubjectFormLogic.ts)**:
```typescript
// 직접 구현된 제출 로직
const toast = useToast();
const [isSubmitting, setIsSubmitting] = useState(false);

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  if (!name.trim()) {
    toast.showError("이름을 입력해주세요.");
    return;
  }
  setIsSubmitting(true);
  try {
    // ... 수동으로 FormData 생성 및 제출
  } catch (error) {
    // ... 수동 에러 처리
  } finally {
    setIsSubmitting(false);
  }
}
```

**After (useSubjectFormLogic.ts)**:
```typescript
// useAdminFormSubmit 훅 사용으로 일관성 확보
const { handleSubmitWithFormData, isPending } = useAdminFormSubmit({
  action: async (formData: FormData) => {
    if (subject) {
      await updateSubject(subject.id, formData);
    } else {
      await createSubject(formData);
    }
  },
  schema: subjectSchema,
  onSuccess: () => {
    onSuccess();
  },
  successMessage: subject ? "과목이 수정되었습니다." : "과목이 생성되었습니다.",
});
```

### 4. 스키마 추가

**`lib/validation/schemas.ts`**에 `subjectSchema` 추가:

```typescript
/**
 * 과목 폼 스키마
 */
export const subjectSchema = z.object({
  subject_group_id: z.string().min(1, "교과 그룹을 선택해주세요."),
  name: z.string().min(1, "과목명을 입력해주세요.").max(100, "과목명은 100자 이하여야 합니다."),
  subject_type_id: z.string().optional(),
});
```

## 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────┐
│                    사용자 컴포넌트                            │
│  (SubjectManagementPanel, SubjectGroupAccordion 등)         │
└────────────────────┬────────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
    ┌────▼────┐            ┌────▼─────┐
    │ *Form   │            │*FormModal │
    │ (인라인)│            │  (모달)   │
    └────┬────┘            └────┬─────┘
         │                      │
         │  ┌───────────────────┘
         │  │
    ┌────▼──▼────────┐
    │  use*FormLogic │  ← useAdminFormSubmit 사용
    │    (훅)        │
    └────┬───────────┘
         │
    ┌────▼──────────┐
    │  Base*Form    │  ← 순수 UI 컴포넌트
    │  (공통 폼)    │
    └──────────────┘
```

## 주요 개선 사항

### 1. 코드 중복 제거

- 인라인 폼과 모달 폼이 동일한 `Base*Form` 컴포넌트를 재사용
- 폼 제출 로직이 `useAdminFormSubmit` 훅으로 통일되어 일관성 확보

### 2. 유지보수성 향상

- 폼 UI 변경 시 `Base*Form` 컴포넌트만 수정하면 모든 곳에 반영
- 제출 로직 변경 시 `useAdminFormSubmit` 훅만 수정하면 모든 폼에 반영

### 3. 타입 안전성

- `subjectSchema`를 통한 Zod 검증으로 런타임 에러 방지
- TypeScript 타입 추론으로 개발 시점 에러 검출

### 4. 일관된 사용자 경험

- 모든 폼에서 동일한 에러 처리 및 성공 메시지 표시
- `isPending` 상태로 일관된 로딩 UI 제공

## 파일 구조

```
app/(admin)/admin/subjects/_components/
├── base/
│   ├── BaseSubjectForm.tsx          # 과목 폼 공통 컴포넌트
│   ├── BaseGroupForm.tsx            # 교과 폼 공통 컴포넌트
│   └── BaseSubjectTypeForm.tsx      # 과목구분 폼 공통 컴포넌트
├── hooks/
│   ├── useSubjectFormLogic.ts       # 과목 폼 로직 (개선 완료)
│   ├── useGroupFormLogic.ts        # 교과 폼 로직
│   └── useSubjectTypeFormLogic.ts  # 과목구분 폼 로직
├── SubjectForm.tsx                  # 인라인 과목 폼 (래퍼)
├── SubjectFormModal.tsx            # 모달 과목 폼 (래퍼)
├── GroupForm.tsx                    # 인라인 교과 폼 (래퍼)
├── GroupFormModal.tsx              # 모달 교과 폼 (래퍼)
├── SubjectTypeForm.tsx             # 인라인 과목구분 폼 (래퍼)
└── SubjectTypeFormModal.tsx        # 모달 과목구분 폼 (래퍼)
```

## 검증 완료 사항

- ✅ 린터 오류 없음
- ✅ TypeScript 타입 검사 통과
- ✅ 기존 디자인(Tailwind CSS 클래스) 유지
- ✅ 기존 기능 동일하게 작동
- ✅ `useAdminFormSubmit` 훅 일관성 확보

## 향후 개선 가능 사항

1. **표시 순서 필드**: 현재 `GroupForm`에는 표시 순서 입력이 없음. 필요 시 추가 가능
2. **폼 검증 강화**: 클라이언트 사이드 실시간 검증 추가 고려
3. **접근성 개선**: ARIA 속성 추가로 스크린 리더 지원 강화

## 결론

교과/과목 관리 페이지의 폼 컴포넌트들이 이미 잘 리팩토링되어 있었으며, `useSubjectFormLogic` 훅만 `useAdminFormSubmit`을 사용하도록 개선하여 전체적인 일관성을 확보했습니다. 모든 폼이 공통 컴포넌트와 훅을 사용하므로 유지보수성이 크게 향상되었습니다.

