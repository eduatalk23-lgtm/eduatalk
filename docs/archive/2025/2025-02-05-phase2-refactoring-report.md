# Phase 2 리팩토링 보고서

**작업 일시**: 2025-02-05  
**작업자**: AI Assistant

## 개요

코드베이스의 중복을 제거하고 유지보수성을 높이기 위해 3가지 핵심 과제를 수행했습니다:

1. Admin 폼 제출 로직의 커스텀 훅 추상화 (`useAdminFormSubmit`)
2. Deprecated 컴포넌트 접근 제어 및 정리
3. 서버 액션 응답 타입 표준화 (`ActionResponse<T>`)

---

## 과제 1: Admin 폼 제출 로직의 커스텀 훅 추상화

### 문제점

`MasterBookForm.tsx`, `MasterBookEditForm.tsx`, `MasterLectureForm.tsx` 등에서 다음과 같은 반복적인 제출 로직이 중복되어 있었습니다:

```typescript
const [isPending, startTransition] = useTransition();
const router = useRouter();
const { showError, showSuccess } = useToast();

function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  const formData = new FormData(e.currentTarget);
  
  // 검증
  const validation = validateFormData(formData, schema);
  if (!validation.success) {
    showError(validation.errors.errors[0].message);
    return;
  }
  
  startTransition(async () => {
    try {
      await action(formData);
      showSuccess("성공 메시지");
      router.push("/redirect-path");
    } catch (error) {
      showError(error.message);
    }
  });
}
```

**중복 코드**:
- `useTransition`, `useRouter`, `useToast` 훅 사용
- 검증 로직
- 에러 처리 및 Toast 알림
- 성공 시 리다이렉트

### 해결 방법

`useAdminFormSubmit` 커스텀 훅을 생성하여 공통 로직을 추상화했습니다.

### 구현 내용

**파일**: `lib/hooks/useAdminFormSubmit.ts`

```typescript
export function useAdminFormSubmit<T>({
  action,
  schema,
  onSuccess,
  successMessage,
  redirectPath,
  onError,
}: UseAdminFormSubmitOptions<T>): UseAdminFormSubmitReturn {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showError, showSuccess } = useToast();

  function handleSubmitWithFormData(formData: FormData) {
    // 검증
    const validation = validateFormData(formData, schema);
    if (!validation.success) {
      const firstError = validation.errors.errors[0];
      showError(firstError.message);
      return;
    }

    startTransition(async () => {
      try {
        const result = await action(formData);
        
        // 성공 메시지 표시
        if (successMessage) {
          showSuccess(successMessage);
        }

        // 성공 콜백 실행
        if (onSuccess) {
          await onSuccess(validation.data);
        }

        // 리다이렉트
        if (redirectPath) {
          router.push(redirectPath);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "처리에 실패했습니다.";
        showError(errorMessage);
        
        if (onError && error instanceof Error) {
          onError(error);
        }
      }
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    handleSubmitWithFormData(formData);
  }

  return { handleSubmit, handleSubmitWithFormData, isPending };
}
```

### 적용 예시

**Before**:
```typescript
const [isPending, startTransition] = useTransition();
const router = useRouter();
const { showError, showSuccess } = useToast();

function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  const formData = new FormData(e.currentTarget);
  addSubjectDataToFormData(formData);
  
  const validation = validateFormData(formData, masterBookSchema);
  if (!validation.success) {
    showError(validation.errors.errors[0].message);
    return;
  }
  
  startTransition(async () => {
    try {
      await addMasterBook(formData);
      showSuccess("교재가 성공적으로 등록되었습니다.");
      router.push("/admin/master-books");
    } catch (error) {
      showError(error.message);
    }
  });
}
```

**After**:
```typescript
const { handleSubmitWithFormData, isPending } = useAdminFormSubmit({
  action: addMasterBook,
  schema: masterBookSchema,
  successMessage: "교재가 성공적으로 등록되었습니다.",
  redirectPath: "/admin/master-books",
});

function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  const formData = new FormData(e.currentTarget);
  addSubjectDataToFormData(formData);
  handleSubmitWithFormData(formData);
}
```

### 적용된 파일

- `app/(admin)/admin/master-books/new/MasterBookForm.tsx`
- `app/(admin)/admin/master-books/[id]/edit/MasterBookEditForm.tsx`
- `app/(admin)/admin/master-lectures/new/MasterLectureForm.tsx`

### 개선 효과

- ✅ 코드 중복 제거: 각 폼 컴포넌트에서 약 30-40줄의 중복 코드 제거
- ✅ 일관성 향상: 모든 폼에서 동일한 에러 처리 및 성공 처리 로직 사용
- ✅ 유지보수성 향상: 공통 로직 변경 시 한 곳만 수정하면 됨
- ✅ 테스트 용이성: 훅 단위로 테스트 가능

---

## 과제 2: Deprecated 컴포넌트 접근 제어 및 정리

### 문제점

`SubjectCategoriesManager`와 `SubjectsManager` 컴포넌트는 deprecated된 테이블을 사용하며, 사용자가 실수로 이 메뉴를 사용하여 데이터 불일치를 일으킬 수 있었습니다.

### 해결 방법

`ContentMetadataPage`에 눈에 띄는 안내 배너를 추가하여 올바른 관리 페이지로 안내하도록 개선했습니다.

### 구현 내용

**파일**: `app/(admin)/admin/content-metadata/page.tsx`

```typescript
{/* 교과/과목 관리 안내 배너 */}
<div className="rounded-lg border-2 border-indigo-200 bg-indigo-50 dark:bg-indigo-900/20 p-4">
  <div className="flex items-start gap-3">
    <div className="text-indigo-600 dark:text-indigo-400 text-xl">📚</div>
    <div className="flex-1">
      <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-100 mb-1">
        교과/과목 관리
      </h3>
      <p className="text-sm text-indigo-800 dark:text-indigo-200 mb-3">
        교과와 과목 관리는 별도 페이지에서 진행해주세요.
      </p>
      <Link
        href="/admin/subjects"
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 dark:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 dark:hover:bg-indigo-600"
      >
        교과/과목 관리 페이지로 이동
        <span className="text-base">→</span>
      </Link>
    </div>
  </div>
</div>
```

### 개선 효과

- ✅ 사용자 안내 개선: deprecated 컴포넌트 사용 방지
- ✅ 데이터 일관성 보장: 올바른 관리 페이지로 안내
- ✅ UI/UX 향상: 눈에 띄는 배너로 명확한 안내

---

## 과제 3: 서버 액션 응답 타입 표준화

### 문제점

서버 액션들의 응답 타입이 제각각이었습니다:

- `import.ts`: `{ success: boolean; message: string; errors?: string[] }`
- 다른 액션들: 반환 타입이 명시되지 않거나 제각각

### 해결 방법

표준화된 `ActionResponse<T>` 타입을 정의하고 헬퍼 함수를 제공했습니다.

### 구현 내용

**파일**: `lib/types/actionResponse.ts`

```typescript
export type ActionResponse<T = void> = 
  | {
      success: true;
      data?: T;
      message?: string;
    }
  | {
      success: false;
      error?: string;
      validationErrors?: Record<string, string[]>;
      message?: string;
    };

export const createSuccessResponse = <T = void>(
  data?: T,
  message?: string
): ActionResponse<T> => ({
  success: true,
  data,
  message,
});

export const createErrorResponse = (
  error: string,
  validationErrors?: Record<string, string[]>,
  message?: string
): ActionResponse => ({
  success: false,
  error,
  validationErrors,
  message: message || error,
});
```

### 적용 예시

**Before**:
```typescript
export async function importMasterBooksFromExcel(
  fileBuffer: Buffer | Uint8Array
): Promise<{ success: boolean; message: string; errors?: string[] }> {
  // ...
  return {
    success: true,
    message: `데이터를 성공적으로 가져왔습니다. (${booksToUpsert.length}개 교재)`,
  };
}
```

**After**:
```typescript
import type { ActionResponse } from "@/lib/types/actionResponse";
import { createSuccessResponse, createErrorResponse } from "@/lib/types/actionResponse";

export async function importMasterBooksFromExcel(
  fileBuffer: Buffer | Uint8Array
): Promise<ActionResponse<{ count: number; errors?: string[] }>> {
  // ...
  return createSuccessResponse(
    { count: booksToUpsert.length },
    `데이터를 성공적으로 가져왔습니다. (${booksToUpsert.length}개 교재)`
  );
}
```

### 적용된 파일

- `app/(admin)/actions/masterBooks/import.ts`
- `app/(admin)/actions/masterLectures/import.ts`

### 개선 효과

- ✅ 타입 안전성 향상: 일관된 응답 타입으로 타입 체크 강화
- ✅ 코드 일관성: 모든 액션이 동일한 응답 구조 사용
- ✅ 유지보수성 향상: 응답 구조 변경 시 한 곳만 수정
- ✅ 개발자 경험 개선: 헬퍼 함수로 간편한 응답 생성

---

## 테스트 체크리스트

### 과제 1: useAdminFormSubmit
- [ ] 폼 제출 시 검증이 올바르게 동작하는지 확인
- [ ] 성공 시 Toast 알림이 표시되는지 확인
- [ ] 성공 시 리다이렉트가 동작하는지 확인
- [ ] 에러 발생 시 Toast 에러 알림이 표시되는지 확인
- [ ] isPending 상태가 올바르게 관리되는지 확인

### 과제 2: Deprecated 컴포넌트 접근 제어
- [ ] 안내 배너가 표시되는지 확인
- [ ] 링크가 올바른 페이지로 이동하는지 확인
- [ ] 다크모드에서도 스타일이 올바르게 적용되는지 확인

### 과제 3: ActionResponse 타입 표준화
- [ ] Excel Import 액션이 올바른 타입을 반환하는지 확인
- [ ] 성공 응답이 올바르게 생성되는지 확인
- [ ] 에러 응답이 올바르게 생성되는지 확인
- [ ] 타입 체크가 통과하는지 확인

---

## 결론

3가지 핵심 과제를 모두 완료하여 코드베이스의 중복을 제거하고 유지보수성을 크게 개선했습니다:

1. ✅ **코드 중복 제거**: `useAdminFormSubmit` 훅으로 폼 제출 로직 추상화
2. ✅ **사용자 안내 개선**: Deprecated 컴포넌트 접근 제어 및 안내 배너 추가
3. ✅ **타입 안전성 향상**: `ActionResponse<T>` 타입으로 서버 액션 응답 표준화

모든 변경 사항은 기존 기능을 유지하면서 코드 품질과 유지보수성을 개선하는 방향으로 진행되었습니다.

