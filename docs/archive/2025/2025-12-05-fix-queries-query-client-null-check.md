# queries.ts에서 queryClient null 체크 추가

## 작업 일시
2025-12-05

## 문제 상황
Vercel 프로덕션 빌드 중 TypeScript 에러 발생:

### 에러 1
```
./app/(student)/actions/plan-groups/queries.ts:146:34
Type error: 'queryClient' is possibly 'null'.
```

### 에러 2
```
./app/(student)/actions/plan-groups/queries.ts:275:20
Type error: 'groupQueryClient' is possibly 'null'.
```

## 원인 분석

### 에러 1
`queryClient`는 `isOtherStudent`가 `true`일 때 `createSupabaseAdminClient()`를 호출하고, 그렇지 않으면 `supabase`를 사용합니다. `createSupabaseAdminClient()`는 `null`을 반환할 수 있지만, 기존 코드에서는 `isOtherStudent`가 `true`일 때만 null 체크를 하고 있었습니다. TypeScript는 `queryClient`가 `null`일 수 있다고 판단했습니다.

### 에러 2
에러 1과 동일한 문제입니다. `groupQueryClient`는 `isAdminOrConsultant`가 `true`일 때 `createSupabaseAdminClient()`를 호출하고, 그렇지 않으면 `supabase`를 사용합니다. 기존 코드에서는 `isAdminOrConsultant`가 `true`일 때만 null 체크를 하고 있었지만, TypeScript는 `groupQueryClient`가 `null`일 수 있다고 판단했습니다.

## 수정 내용

### 파일
- `app/(student)/actions/plan-groups/queries.ts`

### 변경 사항

#### 수정 1: queryClient null 체크 추가
`queryClient`가 `null`일 수 있다는 타입 에러를 해결하기 위해 null 체크를 추가했습니다. `null`인 경우 `AppError`를 던지도록 했습니다.

#### 수정 2: groupQueryClient null 체크 추가
에러 1과 동일한 문제입니다. `groupQueryClient`가 `null`일 수 있다는 타입 에러를 해결하기 위해 null 체크를 추가했습니다. `isAdminOrConsultant` 조건과 관계없이 null 체크를 수행하도록 수정했습니다.

```typescript
// 수정 전
const queryClient = isOtherStudent ? createSupabaseAdminClient() : supabase;

if (isOtherStudent && !queryClient) {
  throw new AppError(
    "Admin 클라이언트를 생성할 수 없습니다. 환경 변수를 확인해주세요.",
    ErrorCode.INTERNAL_ERROR,
    500,
    false
  );
}

// 수정 후
const queryClient = isOtherStudent ? createSupabaseAdminClient() : supabase;

if (!queryClient) {
  throw new AppError(
    "Supabase 클라이언트를 생성할 수 없습니다.",
    ErrorCode.INTERNAL_ERROR,
    500,
    true
  );
}
```

## 검증
- TypeScript 컴파일 에러 해결 확인
- 린터 에러 없음 확인

## 참고
- `createSupabaseAdminClient()`는 `null`을 반환할 수 있습니다.
- `supabase`는 `null`이 아닙니다.
- TypeScript 타입 시스템은 조건부 할당에서 `null` 가능성을 인식하지 못할 수 있습니다.
- `queryClient`와 `groupQueryClient` 모두 null 체크를 추가하여 타입 에러를 해결했습니다.
- 조건부 null 체크 대신 항상 null 체크를 수행하도록 수정하여 타입 안전성을 높였습니다.

