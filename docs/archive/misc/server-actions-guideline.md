# 서버 액션 및 클라이언트 상태 관리 표준 개발 가이드라인

**작성일**: 2025-12-21  
**버전**: 1.0  
**적용 범위**: 프로젝트 전체

---

## 📋 목차

1. [리팩토링 개요](#리팩토링-개요)
2. [표준 패턴 가이드](#표준-패턴-가이드)
3. [주요 유틸리티 및 타입 설명](#주요-유틸리티-및-타입-설명)
4. [마이그레이션 현황](#마이그레이션-현황)
5. [FAQ](#faq)

---

## 리팩토링 개요

### 기존 문제점

리팩토링 전 프로젝트는 다음과 같은 문제점을 가지고 있었습니다:

#### 1. 비일관적인 응답 타입

- 서버 액션마다 다른 응답 형식 사용
  - `{ success: boolean, data?: T, error?: string }`
  - `{ success: boolean, message?: string }`
  - `Promise<T>` (에러는 throw)
  - `Promise<void>` (에러는 throw)

#### 2. 타입 불안정성

- 클라이언트에서 응답 타입을 직접 체크해야 함
- 타입 가드 없이 `result.success` 체크만으로는 TypeScript가 타입을 좁히지 못함
- `any` 타입 사용 빈번

#### 3. 중복 코드

- 각 컴포넌트마다 동일한 패턴 반복:
  ```typescript
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  
  startTransition(async () => {
    const result = await someAction();
    if (result.success) {
      // 성공 처리
    } else {
      setError(result.error);
    }
  });
  ```

#### 4. 에러 처리 불일치

- `try-catch` 블록 사용 여부가 컴포넌트마다 다름
- Zod 검증 에러 처리 방식이 일관되지 않음
- 필드별 에러 표시가 어려움

### 개선된 구조

#### 1. 표준 응답 타입 (`ActionResponse<T>`)

모든 서버 액션이 동일한 `ActionResponse<T>` 타입을 반환하도록 표준화:

```typescript
type ActionResponse<T = void> = 
  | { success: true; data?: T; message?: string }
  | { success: false; error?: string; fieldErrors?: Record<string, string[]>; message?: string };
```

#### 2. 서버 액션 래퍼 (`withActionResponse`)

비즈니스 로직만 작성하고, 에러 처리는 래퍼가 자동으로 처리:

```typescript
async function _addBlock(formData: FormData): Promise<void> {
  // 비즈니스 로직만 집중
  // 에러는 throw만 하면 됨
}

export const addBlock = withActionResponse(_addBlock);
```

#### 3. 클라이언트 커스텀 훅 도입

- **`useServerAction`**: 버튼/이벤트 기반 서버 액션 호출
- **`useServerForm`**: HTML Form과 함께 사용하는 서버 액션
- **`useAdminFormSubmit`**: Zod 검증이 포함된 폼 제출

#### 4. 타입 안전성 확보

- 타입 가드 함수 (`isSuccessResponse`, `isErrorResponse`) 제공
- 제네릭을 통한 타입 추론 지원
- 컴파일 타임에 에러 처리 누락 방지

---

## 표준 패턴 가이드

### 1. Server Action 작성법

#### 기본 패턴

모든 서버 액션은 `withActionResponse` 유틸리티를 사용하여 래핑합니다.

```typescript
"use server";

import { withActionResponse } from "@/lib/utils/serverActionHandler";
import { AppError, ErrorCode } from "@/lib/errors";

// 1. 내부 함수 작성 (비즈니스 로직만)
async function _createItem(formData: FormData): Promise<{ id: string }> {
  // 인증 체크
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("인증이 필요합니다.", ErrorCode.UNAUTHORIZED);
  }

  // 데이터 검증 (Zod 에러는 직접 throw)
  const validation = validateFormData(formData, itemSchema);
  if (!validation.success) {
    throw validation.errors; // withActionResponse가 fieldErrors로 변환
  }

  // 비즈니스 로직
  const result = await createItemInDatabase(validation.data);
  
  return { id: result.id };
}

// 2. withActionResponse로 래핑하여 export
export const createItem = withActionResponse(_createItem);
```

#### 에러 처리

**Zod 검증 에러**:
```typescript
const validation = validateFormData(formData, schema);
if (!validation.success) {
  throw validation.errors; // 자동으로 fieldErrors로 변환됨
}
```

**비즈니스 로직 에러**:
```typescript
if (itemExists) {
  throw new AppError("이미 존재하는 항목입니다.", ErrorCode.BUSINESS_LOGIC_ERROR);
}
```

**정보성 메시지 (부분 성공)**:
```typescript
// 상태 코드 200은 성공으로 처리되며 메시지 포함
throw new AppError(
  `INFO: ${successCount}개 항목이 생성되었습니다. ${skipCount}개는 스킵되었습니다.`,
  ErrorCode.BUSINESS_LOGIC_ERROR,
  200,
  true
);
```

#### Next.js 특수 에러

`redirect()`와 `notFound()`는 `withActionResponse`가 자동으로 재throw하여 Next.js가 처리합니다:

```typescript
async function _getItem(id: string): Promise<Item> {
  const item = await getItemFromDatabase(id);
  if (!item) {
    notFound(); // withActionResponse가 재throw하여 Next.js가 처리
  }
  return item;
}
```

### 2. Client Component 작성법

#### 일반 버튼/이벤트: `useServerAction` 사용

버튼 클릭, 모달 확인 등 이벤트 기반 서버 액션 호출에 사용합니다.

```typescript
"use client";

import { useServerAction } from "@/lib/hooks/useServerAction";
import { deleteItem } from "@/app/actions/items";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";

export default function DeleteItemButton({ itemId }: { itemId: string }) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  const { execute, isPending, error } = useServerAction(deleteItem, {
    onSuccess: () => {
      showSuccess("항목이 삭제되었습니다.");
      router.refresh();
    },
    onError: (errorMessage) => {
      showError(errorMessage);
    },
  });

  return (
    <button
      onClick={() => execute(itemId)}
      disabled={isPending}
      className="..."
    >
      {isPending ? "삭제 중..." : "삭제"}
    </button>
  );
}
```

**여러 액션 사용**:
```typescript
const approveHook = useServerAction(approveAction, { onSuccess: () => {} });
const rejectHook = useServerAction(rejectAction, { onSuccess: () => {} });

const isPending = approveHook.isPending || rejectHook.isPending;
```

**상태 초기화**:
```typescript
const { execute, reset } = useServerAction(deleteItem);

// 상태 초기화
<button onClick={reset}>초기화</button>
```

#### 폼(Form): `useServerForm` 사용

HTML `action` prop을 사용하는 폼에 사용합니다. React의 `useActionState`를 내부적으로 사용합니다.

```typescript
"use client";

import { useServerForm } from "@/lib/hooks/useServerForm";
import { createItem } from "@/app/actions/items";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";

export default function ItemForm() {
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  const { action, isPending, fieldErrors, error } = useServerForm(
    createItem,
    null,
    {
      onSuccess: () => {
        showSuccess("항목이 생성되었습니다.");
        router.refresh();
      },
      onError: (errorMessage) => {
        showError(errorMessage);
      },
    }
  );

  return (
    <form action={action}>
      <div>
        <input name="name" type="text" />
        {fieldErrors?.name && (
          <span className="text-red-600">{fieldErrors.name[0]}</span>
        )}
      </div>
      
      {error && <p className="text-red-600">{error}</p>}
      
      <button type="submit" disabled={isPending}>
        {isPending ? "제출 중..." : "제출"}
      </button>
    </form>
  );
}
```

**래퍼 함수 사용 (FormData 조작 필요 시)**:
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

#### Zod 검증이 필요한 폼: `useAdminFormSubmit` 사용

클라이언트 사이드 Zod 검증이 필요하고, `onSubmit` 핸들러를 사용하는 폼에 사용합니다.

```typescript
"use client";

import { useAdminFormSubmit } from "@/lib/hooks/useAdminFormSubmit";
import { createMasterBook } from "@/app/(admin)/actions/masterBookActions";
import { masterBookSchema } from "@/lib/validation/schemas";

export default function MasterBookForm() {
  const { handleSubmit, isPending } = useAdminFormSubmit({
    action: createMasterBook,
    schema: masterBookSchema,
    successMessage: "교재가 성공적으로 등록되었습니다.",
    redirectPath: "/admin/master-books",
  });

  return (
    <form onSubmit={handleSubmit}>
      <input name="title" type="text" />
      <input name="author" type="text" />
      <button type="submit" disabled={isPending}>
        {isPending ? "등록 중..." : "등록"}
      </button>
    </form>
  );
}
```

### 3. 훅 선택 가이드

| 사용 사례 | 권장 훅 | 이유 |
|---------|--------|------|
| 버튼 클릭으로 서버 액션 호출 | `useServerAction` | `useTransition` 기반, 간단한 상태 관리 |
| HTML `action` prop 사용 폼 | `useServerForm` | `useActionState` 기반, 필드 에러 자동 처리 |
| `onSubmit` 핸들러 사용 폼 + Zod 검증 | `useAdminFormSubmit` | 클라이언트 검증, Toast 자동 표시, 리다이렉트 지원 |

---

## 주요 유틸리티 및 타입 설명

### ActionResponse 타입

```typescript
type ActionResponse<T = void> = 
  | {
      success: true;
      data?: T;
      message?: string;
    }
  | {
      success: false;
      error?: string;
      validationErrors?: Record<string, string[]>;
      fieldErrors?: Record<string, string[]>; // validationErrors의 alias
      message?: string;
    };
```

**성공 응답**:
- `success: true`
- `data`: 성공 시 반환할 데이터 (제네릭 타입)
- `message`: 성공 메시지 (선택)

**실패 응답**:
- `success: false`
- `error`: 에러 메시지
- `fieldErrors` / `validationErrors`: 필드별 검증 에러 (Zod 등)
- `message`: 에러 메시지 (선택)

### 헬퍼 함수

#### `createSuccessResponse<T>(data?: T, message?: string)`

성공 응답을 생성합니다:

```typescript
return createSuccessResponse({ id: "123" }, "항목이 생성되었습니다.");
```

#### `createErrorResponse(error: string, fieldErrors?: Record<string, string[]>)`

에러 응답을 생성합니다:

```typescript
return createErrorResponse("항목을 찾을 수 없습니다.");
return createErrorResponse("검증 실패", { name: ["이름은 필수입니다."] });
```

#### `isSuccessResponse<T>(response: ActionResponse<T>)`

타입 가드 함수로, 성공 응답인지 확인합니다:

```typescript
const result = await createItem(formData);
if (isSuccessResponse(result)) {
  // TypeScript가 result를 { success: true; data?: T }로 좁힘
  console.log(result.data);
}
```

#### `isErrorResponse(response: ActionResponse)`

타입 가드 함수로, 실패 응답인지 확인합니다:

```typescript
if (isErrorResponse(result)) {
  // TypeScript가 result를 { success: false; error?: string; ... }로 좁힘
  console.log(result.error);
  console.log(result.fieldErrors);
}
```

### withActionResponse 유틸리티

```typescript
export function withActionResponse<T = void, Args extends any[] = any[]>(
  handler: (...args: Args) => Promise<T>
): (...args: Args) => Promise<ActionResponse<T>>
```

**기능**:
- 비동기 함수를 `ActionResponse<T>`로 래핑
- Zod 에러를 `fieldErrors`로 자동 변환
- `AppError`를 적절한 에러 응답으로 변환
- Next.js 특수 에러 (`redirect`, `notFound`) 재throw
- 정보성 메시지 (상태 코드 200)를 성공 응답으로 변환

### useServerAction 훅

```typescript
function useServerAction<T = void, Args extends any[] = any[]>(
  action: (...args: Args) => Promise<ActionResponse<T>>,
  options?: {
    onSuccess?: (data?: T, message?: string) => void | Promise<void>;
    onError?: (error: string, fieldErrors?: Record<string, string[]>) => void | Promise<void>;
  }
): {
  execute: (...args: Args) => Promise<void>;
  isPending: boolean;
  data: T | undefined;
  error: string | null;
  fieldErrors: Record<string, string[]> | null;
  isSuccess: boolean;
  reset: () => void;
}
```

**반환 값**:
- `execute`: 서버 액션 실행 함수
- `isPending`: 로딩 상태
- `data`: 성공 시 데이터
- `error`: 에러 메시지
- `fieldErrors`: 필드별 검증 에러
- `isSuccess`: 성공 여부
- `reset`: 상태 초기화 함수

### useServerForm 훅

```typescript
function useServerForm<T = void>(
  serverAction: (formData: FormData) => Promise<ActionResponse<T>>,
  initialState: ActionResponse<T> | null = null,
  options?: {
    onSuccess?: (data?: T, message?: string) => void | Promise<void>;
    onError?: (error: string, fieldErrors?: Record<string, string[]>) => void | Promise<void>;
  }
): {
  action: (formData: FormData) => Promise<ActionResponse<T>>;
  state: ActionResponse<T> | null;
  isPending: boolean;
  fieldErrors: Record<string, string[]> | null;
  isSuccess: boolean;
  error: string | null;
  data: T | undefined;
}
```

**반환 값**:
- `action`: HTML form의 `action` prop에 사용할 함수
- `state`: 현재 상태
- `isPending`: 로딩 상태
- `fieldErrors`: 필드별 검증 에러
- `isSuccess`: 성공 여부
- `error`: 에러 메시지
- `data`: 성공 시 데이터

### useAdminFormSubmit 훅

```typescript
function useAdminFormSubmit<T>({
  action: (formData: FormData) => Promise<void | { success: boolean; message?: string }>;
  schema: z.ZodSchema<T>;
  onSuccess?: (data: T) => void | Promise<void>;
  successMessage?: string;
  redirectPath?: string;
  onError?: (error: Error) => void;
}): {
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  handleSubmitWithFormData: (formData: FormData) => void;
  isPending: boolean;
}
```

**특징**:
- 클라이언트 사이드 Zod 검증
- Toast 메시지 자동 표시
- 리다이렉트 지원
- `onSubmit` 핸들러 반환

---

## 마이그레이션 현황

### 완료된 주요 컴포넌트

#### Phase 1-3: 서버 액션 표준화
- ✅ `app/actions/auth.ts`
- ✅ `app/actions/blocks.ts`
- ✅ `app/actions/blockSets.ts`
- ✅ `app/actions/scores-internal.ts`
- ✅ `app/actions/studentDivisionsActions.ts`
- ✅ `app/(parent)/actions/parentSettingsActions.ts`
- ✅ `app/(parent)/actions/parentStudentLinkRequestActions.ts`
- ✅ `app/(superadmin)/actions/tenantlessUserActions.ts`
- ✅ `app/(superadmin)/actions/curriculumSettingsActions.ts`
- ✅ `app/(superadmin)/actions/termsContents.ts`
- ✅ `app/actions/smsActions.ts`
- ✅ `app/(admin)/actions/schoolActions.ts`
- ✅ `app/(student)/actions/scoreActions.ts`

#### Phase 4-5: 클라이언트 컴포넌트 마이그레이션
- ✅ `app/login/_components/ResendEmailButton.tsx`
- ✅ `app/(student)/scores/_components/DeleteScoreButton.tsx`
- ✅ `app/(superadmin)/superadmin/tenantless-users/_components/AssignTenantDialog.tsx`
- ✅ `app/(parent)/parent/settings/_components/StudentSearchModal.tsx`
- ✅ `app/(parent)/parent/settings/_components/LinkedStudentsSection.tsx`
- ✅ `app/(parent)/parent/settings/_components/StudentAttendanceNotificationSettings.tsx`
- ✅ `app/(parent)/parent/settings/_components/RoleChangeSection.tsx`
- ✅ `app/(parent)/parent/settings/_components/LinkRequestList.tsx`
- ✅ `app/(admin)/admin/students/[id]/_components/ParentSearchModal.tsx`
- ✅ `app/(admin)/admin/parent-links/_components/PendingLinkRequestCard.tsx`
- ✅ `app/(admin)/admin/parent-links/_components/PendingLinkRequestsList.tsx`
- ✅ `app/(student)/scores/mock/[grade]/[month]/[exam-type]/_components/MockScoresView.tsx`
- ✅ `app/(student)/scores/school/[grade]/[semester]/[subject-group]/_components/DeleteSchoolScoreButton.tsx`

#### Phase 6: 폼 컴포넌트 표준화
- ✅ `app/(student)/blocks/_components/BlockForm.tsx`
- ✅ `app/(student)/blocks/[setId]/_components/BlockList.tsx` (BlockEditForm)

### 아직 마이그레이션되지 않은 컴포넌트

다음 컴포넌트들은 복잡한 로직이나 특수한 요구사항으로 인해 아직 마이그레이션되지 않았습니다:

#### Student 컴포넌트
- `app/(student)/blocks/_components/BlockSetTabs.tsx` - `useActionState` 사용 (폼 컴포넌트)
- `app/(student)/scores/_components/ScoreFormModal.tsx` - 복잡한 폼 로직, `useTransition` 사용
- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx` - 복잡한 위저드 로직
- `app/(student)/today/_components/AttachGoalButton.tsx` - 간단한 버튼 (우선순위 낮음)

#### Admin 컴포넌트
- `app/(admin)/admin/subjects/_components/SubjectGroupManagement.tsx` - 복잡한 관리 로직
- `app/(admin)/admin/sms/_components/SingleSendForm.tsx` - 폼 컴포넌트
- `app/(admin)/admin/sms/_components/BulkSendForm.tsx` - 폼 컴포넌트
- `app/(admin)/admin/master-books/[id]/edit/MasterBookEditForm.tsx` - `useAdminFormSubmit` 사용 (이미 표준 패턴)
- `app/(admin)/admin/students/[id]/_components/StudentInfoEditForm.tsx` - `useAdminFormSubmit` 사용 (이미 표준 패턴)
- `app/(admin)/admin/students/[id]/_components/ConsultingNotesForm.tsx` - `useActionState` 사용 (폼 컴포넌트)

#### 기타
- `app/login/_components/LoginForm.tsx` - 인증 폼 (특수 처리 필요)
- `app/signup/page.tsx` - 회원가입 폼 (특수 처리 필요)

### 마이그레이션 권장 사항

#### 우선순위 높음
1. **폼 컴포넌트**: `useActionState`를 사용하는 폼은 `useServerForm`으로 전환
2. **복잡한 폼**: `ScoreFormModal.tsx` 등은 점진적으로 리팩토링

#### 우선순위 중간
1. **위저드 컴포넌트**: `PlanGroupWizard.tsx` 등은 단계별로 리팩토링
2. **복잡한 관리 로직**: `SubjectGroupManagement.tsx` 등은 점진적으로 리팩토링

#### 우선순위 낮음
1. **간단한 버튼**: `AttachGoalButton.tsx` 등은 필요 시 리팩토링
2. **이미 표준 패턴 사용**: `useAdminFormSubmit`을 사용하는 컴포넌트는 유지

---

## FAQ

### Q1. `withActionResponse`와 `withErrorHandling`의 차이는?

**`withActionResponse`**:
- 에러를 `ActionResponse`로 변환하여 반환
- 클라이언트에서 응답을 처리할 수 있음
- 표준 응답 패턴이 필요한 경우 사용

**`withErrorHandling`**:
- 에러를 throw하여 Next.js가 처리
- `redirect()` 등이 필요한 경우 사용
- 에러를 throw해야 하는 경우 사용

### Q2. `useServerForm`과 `useAdminFormSubmit`의 차이는?

**`useServerForm`**:
- `useActionState` 기반 (`action` prop 사용)
- 서버 사이드 검증 에러 처리
- `ActionResponse` 타입 처리

**`useAdminFormSubmit`**:
- `useTransition` 기반 (`onSubmit` 핸들러 사용)
- Zod 클라이언트 사이드 검증
- Toast 메시지 자동 표시
- 리다이렉트 지원

### Q3. Zod 검증 에러는 어떻게 처리하나요?

서버 액션에서 Zod 검증 에러를 직접 throw하면 `withActionResponse`가 자동으로 `fieldErrors`로 변환합니다:

```typescript
const validation = validateFormData(formData, schema);
if (!validation.success) {
  throw validation.errors; // fieldErrors로 자동 변환
}
```

클라이언트에서는 `fieldErrors`를 통해 필드별 에러를 표시할 수 있습니다:

```typescript
{fieldErrors?.name && <span>{fieldErrors.name[0]}</span>}
```

### Q4. 여러 서버 액션을 사용할 때는?

각 액션에 대해 별도의 훅을 사용합니다:

```typescript
const approveHook = useServerAction(approveAction, { onSuccess: () => {} });
const rejectHook = useServerAction(rejectAction, { onSuccess: () => {} });

const isPending = approveHook.isPending || rejectHook.isPending;
```

### Q5. 정보성 메시지(부분 성공)는 어떻게 처리하나요?

상태 코드 200을 사용하여 정보성 메시지를 전달하면 `withActionResponse`가 자동으로 성공 응답으로 변환합니다:

```typescript
throw new AppError(
  `INFO: ${successCount}개 항목이 생성되었습니다. ${skipCount}개는 스킵되었습니다.`,
  ErrorCode.BUSINESS_LOGIC_ERROR,
  200,
  true
);
```

### Q6. Next.js의 `redirect()`와 `notFound()`는 어떻게 처리하나요?

`withActionResponse`가 자동으로 재throw하여 Next.js가 처리합니다. 별도 처리 불필요:

```typescript
async function _getItem(id: string): Promise<Item> {
  const item = await getItemFromDatabase(id);
  if (!item) {
    notFound(); // withActionResponse가 재throw
  }
  return item;
}
```

---

## 참고 문서

- Phase 1: `docs/2025-01-30-server-actions-refactoring-phase1.md`
- Phase 2: `docs/2025-01-30-server-actions-refactoring-phase2.md`
- Phase 3: `docs/2025-02-05-phase3-server-actions-refactoring.md`
- Phase 4: `docs/2025-12-21-phase4-server-actions-client-state-management.md`
- Phase 5: `docs/2025-12-21-phase5-server-actions-client-migration.md`
- Phase 6: `docs/2025-12-21-phase6-server-actions-form-standardization.md`

## 관련 파일

- `lib/types/actionResponse.ts` - 표준 응답 타입 정의
- `lib/utils/serverActionHandler.ts` - 서버 액션 래퍼 유틸리티
- `lib/hooks/useServerAction.ts` - 버튼/이벤트 기반 서버 액션 훅
- `lib/hooks/useServerForm.ts` - HTML Form 기반 서버 액션 훅
- `lib/hooks/useAdminFormSubmit.ts` - Zod 검증 포함 폼 제출 훅

---

**마지막 업데이트**: 2025-12-21

