# Phase 6: 폼 컴포넌트(`useActionState` 사용)의 표준화

## 📋 작업 개요

Phase 5까지 버튼/이벤트 기반 컴포넌트의 마이그레이션을 완료한 후, Phase 6에서는 **폼 컴포넌트의 표준화**를 진행했습니다. `useActionState`를 사용하는 폼 컴포넌트들을 `useServerForm` 훅으로 통합하여 일관성을 확보했습니다.

## 🎯 목표

1. **폼 컴포넌트 표준화**: `useActionState`를 사용하는 폼 컴포넌트를 `useServerForm` 훅으로 통합
2. **코드 일관성**: 모든 폼 컴포넌트에서 동일한 패턴 적용
3. **에러 핸들링 표준화**: `ActionResponse` 타입을 통한 일관된 에러 처리
4. **기존 훅 통합 검토**: `useAdminFormSubmit`과의 통합 가능성 검토

## ✅ 완료된 작업

### 1. `useServerForm` 커스텀 훅 생성

**파일**: `lib/hooks/useServerForm.ts`

HTML Form 요소와 함께 작동하는 서버 액션 훅을 생성했습니다.

#### 주요 기능

- **`useActionState` 내부 사용**: React의 `useActionState`를 내부적으로 사용하여 폼 상태 관리
- **타입 안전성**: 제네릭을 통한 타입 추론 지원
- **상태 관리**: `state`, `isPending`, `fieldErrors`, `isSuccess`, `error`, `data` 상태 제공
- **콜백 지원**: `onSuccess`, `onError` 콜백을 통한 커스터마이징
- **자동 응답 처리**: `ActionResponse<T>` 타입을 자동으로 처리하여 성공/실패 판별
- **필드 에러 추출**: `fieldErrors` 및 `validationErrors` 자동 추출

#### 사용 예시

```typescript
const { action, state, isPending, fieldErrors, isSuccess, error } = useServerForm(
  createBlock,
  null,
  {
    onSuccess: (data) => {
      toast.success("블록이 생성되었습니다.");
      router.refresh();
    },
    onError: (error, fieldErrors) => {
      toast.error(error);
    },
  }
);

<form action={action}>
  <input name="name" />
  {fieldErrors?.name && <span>{fieldErrors.name[0]}</span>}
  <button type="submit" disabled={isPending}>
    {isPending ? "제출 중..." : "제출"}
  </button>
</form>
```

#### 반환 값

```typescript
type UseServerFormReturn<T> = {
  action: (formData: FormData) => Promise<ActionResponse<T>>;  // 폼 action prop
  state: ActionResponse<T> | null;                              // 현재 상태
  isPending: boolean;                                            // 로딩 상태
  fieldErrors: Record<string, string[]> | null;                 // 필드별 검증 에러
  isSuccess: boolean;                                            // 성공 여부
  error: string | null;                                          // 에러 메시지
  data: T | undefined;                                           // 성공 시 데이터
};
```

### 2. 주요 폼 컴포넌트 리팩토링

#### ✅ `app/(student)/blocks/_components/BlockForm.tsx`

**변경 전**:
- `useActionState` 직접 사용
- `isSuccessResponse`, `isErrorResponse` 타입 가드 사용
- 수동 상태 관리

**변경 후**:
- `useServerForm` 훅 사용
- 타입 가드 제거
- `onSuccess` 콜백으로 성공 처리 통합

**코드 비교**:

```typescript
// 변경 전
const [state, formAction, isPending] = useActionState(
  async (_prev, formData: FormData) => {
    const weekdayFormData = new FormData();
    weekdayFormData.append("target_days", selectedWeekdays.join(","));
    // ...
    return await addBlocksToMultipleDays(weekdayFormData);
  },
  initialState
);

useEffect(() => {
  if (isSuccessResponse(state)) {
    // 성공 처리
  }
}, [state]);

// 변경 후
const wrappedAction = async (formData: FormData) => {
  const weekdayFormData = new FormData();
  weekdayFormData.append("target_days", selectedWeekdays.join(","));
  // ...
  return await addBlocksToMultipleDays(weekdayFormData);
};

const { action, state, isPending, isSuccess } = useServerForm(wrappedAction, null, {
  onSuccess: () => {
    // 성공 처리
  },
});
```

#### ✅ `app/(student)/blocks/[setId]/_components/BlockList.tsx`

**변경 전**:
- `BlockEditForm` 내부에서 `useActionState` 직접 사용
- 수동 에러 처리
- `handleEdit`, `handleDelete` 함수에서 직접 서버 액션 호출

**변경 후**:
- `BlockEditForm`에서 `useServerForm` 사용
- `handleDelete`에서 `useServerAction` 사용
- 에러 처리 간소화

**코드 비교**:

```typescript
// 변경 전 (BlockEditForm)
const [state, formAction, isPending] = useActionState(
  async (_prev, formData: FormData) => {
    try {
      await onSave(formData);
      return { error: null };
    } catch (err) {
      return { error: err.message };
    }
  },
  { error: null }
);

// 변경 후 (BlockEditForm)
const wrappedUpdateAction = async (formData: FormData) => {
  formData.append("id", block.id);
  // 검증 및 서버 액션 호출
  return await updateBlock(formData);
};

const { action, state, isPending, error, fieldErrors } = useServerForm(wrappedUpdateAction, null, {
  onSuccess: () => {
    onSuccess();
  },
});
```

### 3. `useAdminFormSubmit`과의 통합 검토

#### 검토 결과

`useAdminFormSubmit`과 `useServerForm`은 **서로 다른 목적**을 가지고 있어 통합이 어렵습니다:

**`useAdminFormSubmit`**:
- `useTransition` 기반 (`onSubmit` 핸들러 사용)
- Zod 스키마 검증 (클라이언트 사이드)
- Toast 메시지 자동 표시
- 리다이렉트 지원
- `onSubmit` 이벤트 핸들러 반환

**`useServerForm`**:
- `useActionState` 기반 (`action` prop 사용)
- 서버 사이드 검증 에러 처리
- `ActionResponse` 타입 처리
- `action` prop 반환

#### 결론

두 훅은 **별도로 유지**하는 것이 적절합니다:

- **`useServerForm`**: `useActionState`를 사용하는 폼 (HTML `action` prop 사용)
- **`useAdminFormSubmit`**: `onSubmit` 핸들러를 사용하는 폼 (Zod 검증 포함)

향후 두 훅의 공통 기능을 추출하여 공유할 수 있지만, 현재는 각각의 목적에 맞게 사용하는 것이 좋습니다.

### 4. 제외된 컴포넌트

다음 컴포넌트들은 복잡한 로직이나 특수 요구사항으로 인해 이번 Phase에서는 제외되었습니다:

#### `app/(student)/scores/_components/ScoreFormModal.tsx`
- **제외 사유**: `useActionState`를 사용하지 않고 `useTransition` 사용
- **복잡한 로직**: 복잡한 폼 상태 관리 및 클라이언트 사이드 검증
- **권장 사항**: `useServerAction` 훅 사용 고려 (Phase 5 패턴)

#### `app/(admin)/admin/subjects/_components/SubjectGroupManagement.tsx`
- **제외 사유**: `useActionState`를 사용하지 않음
- **복잡한 로직**: 낙관적 업데이트, 다중 폼 관리
- **권장 사항**: 현재 구조 유지 또는 점진적 리팩토링

## 🔄 주요 변경 사항

### 리팩토링 패턴

**이전 패턴**:
```typescript
const [state, formAction, isPending] = useActionState(
  async (_prev, formData: FormData) => {
    const result = await someAction(formData);
    return result;
  },
  initialState
);

useEffect(() => {
  if (isSuccessResponse(state)) {
    // 성공 처리
  } else if (isErrorResponse(state)) {
    // 에러 처리
  }
}, [state]);
```

**변경 후 패턴**:
```typescript
const { action, state, isPending, fieldErrors, isSuccess } = useServerForm(
  someAction,
  null,
  {
    onSuccess: (data) => {
      // 성공 처리
    },
    onError: (error, fieldErrors) => {
      // 에러 처리
    },
  }
);

<form action={action}>
  {/* 필드 에러 표시 */}
  {fieldErrors?.fieldName && <span>{fieldErrors.fieldName[0]}</span>}
</form>
```

### 래퍼 함수 패턴

서버 액션에 추가 로직이 필요한 경우, 래퍼 함수를 사용:

```typescript
const wrappedAction = async (formData: FormData) => {
  // 추가 로직 (예: FormData 조작)
  const modifiedFormData = new FormData();
  modifiedFormData.append("custom_field", "value");
  // ...
  
  return await serverAction(modifiedFormData);
};

const { action } = useServerForm(wrappedAction, null, {
  onSuccess: () => {},
});
```

## 📊 통계

- **생성된 훅**: 1개 (`useServerForm`)
- **리팩토링된 컴포넌트**: 2개
  - `BlockForm.tsx`
  - `BlockList.tsx` (BlockEditForm)
- **제거된 중복 코드**:
  - `useActionState` 직접 사용: 2개
  - `isSuccessResponse`, `isErrorResponse` import: 2개
  - 수동 상태 관리 로직: 2개
- **코드 라인 감소**: 약 50줄 감소

## ✅ 검증 완료

- [x] `useServerForm` 훅이 모든 요구사항을 충족
- [x] 타입 안전성 확보 (제네릭 지원)
- [x] 모든 리팩토링된 컴포넌트가 기존 기능을 정상적으로 수행
- [x] 에러 발생 시 필드 에러가 정상적으로 표시
- [x] `isPending` 상태가 UI에 올바르게 반영
- [x] 린터 에러 없음
- [x] TypeScript 타입 체크 통과

## 🎯 달성한 목표

1. **폼 컴포넌트 표준화**: `useActionState`를 사용하는 폼 컴포넌트를 `useServerForm` 훅으로 통합
2. **코드 일관성**: 모든 리팩토링된 폼 컴포넌트에서 동일한 패턴 적용
3. **에러 핸들링 표준화**: `ActionResponse` 타입을 통한 일관된 에러 처리
4. **기존 훅 통합 검토**: `useAdminFormSubmit`과의 차이점 명확화 및 별도 유지 결정

## 📝 사용 가이드

### 기본 사용법

```typescript
import { useServerForm } from "@/lib/hooks/useServerForm";

const { action, state, isPending, fieldErrors, isSuccess, error } = useServerForm(
  serverAction,
  null, // 초기 상태
  {
    onSuccess: (data, message) => {
      // 성공 시 처리
      toast.success(message || "작업이 완료되었습니다.");
      router.refresh();
    },
    onError: (error, fieldErrors) => {
      // 에러 시 처리
      toast.error(error);
    },
  }
);

// HTML Form에서 사용
<form action={action}>
  <input name="fieldName" />
  {fieldErrors?.fieldName && (
    <span className="text-red-600">{fieldErrors.fieldName[0]}</span>
  )}
  <button type="submit" disabled={isPending}>
    {isPending ? "제출 중..." : "제출"}
  </button>
</form>
```

### 래퍼 함수 사용

```typescript
const wrappedAction = async (formData: FormData) => {
  // FormData 조작
  const modifiedFormData = new FormData();
  modifiedFormData.append("custom_field", "value");
  // ...
  
  return await serverAction(modifiedFormData);
};

const { action } = useServerForm(wrappedAction, null, {
  onSuccess: () => {},
});
```

### `useAdminFormSubmit`과의 차이

| 특징 | `useServerForm` | `useAdminFormSubmit` |
|------|----------------|---------------------|
| 기반 | `useActionState` | `useTransition` |
| 사용 방식 | `action` prop | `onSubmit` 핸들러 |
| 검증 | 서버 사이드 에러 처리 | Zod 클라이언트 검증 |
| Toast | 수동 처리 (콜백) | 자동 표시 |
| 리다이렉트 | 수동 처리 (콜백) | 자동 지원 |

## 🚀 다음 단계

Phase 6 작업이 완료되어 폼 컴포넌트의 표준화가 진행되었습니다. 향후 새로운 폼 컴포넌트를 추가할 때는:

- **`useActionState` 사용**: `useServerForm` 훅 사용
- **`onSubmit` 핸들러 사용**: `useAdminFormSubmit` 훅 사용 (Zod 검증 포함)

### 향후 개선 사항

1. **나머지 폼 컴포넌트 마이그레이션**: `useActionState`를 사용하는 다른 폼 컴포넌트들도 점진적으로 `useServerForm`으로 전환
2. **공통 기능 추출**: `useServerForm`과 `useAdminFormSubmit`의 공통 기능을 추출하여 코드 중복 제거
3. **복잡한 폼 지원**: 위저드, 다단계 폼 등 복잡한 폼 컴포넌트 지원 검토

## 📚 참고 문서

- Phase 4: `docs/2025-12-21-phase4-server-actions-client-state-management.md`
- Phase 5: `docs/2025-12-21-phase5-server-actions-client-migration.md`
- useServerForm 훅: `lib/hooks/useServerForm.ts`
- useServerAction 훅: `lib/hooks/useServerAction.ts`
- useAdminFormSubmit 훅: `lib/hooks/useAdminFormSubmit.ts`
- ActionResponse 타입: `lib/types/actionResponse.ts`

---

**작업 완료일**: 2025-12-21

