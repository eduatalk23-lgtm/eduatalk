# 출석 설정 서버 액션 에러 수정

## 문제 상황

`/admin/attendance/settings` 페이지에서 다음과 같은 에러가 발생했습니다:

```
Functions cannot be passed directly to Client Components unless you explicitly expose it by marking it with "use server". Or maybe you meant to call this function rather than return it. {}
```

## 원인 분석

QR 코드 액션과 동일한 문제였습니다:

1. **서버 액션 래핑 문제**
   - `attendanceSettingsActions.ts`에서 `withErrorHandling`으로 래핑된 함수가 서버 액션으로 제대로 인식되지 않음
   - Next.js는 "use server" 파일에서 직접 export된 함수만 서버 액션으로 인식

2. **useEffect 의존성 배열 문제**
   - `LocationSettingsForm` 컴포넌트에서 `loadSettings` 함수가 `useEffect`의 의존성 배열에 포함되지 않음

## 해결 방법

### 1. 서버 액션 수정

`attendanceSettingsActions.ts`의 두 서버 액션을 수정했습니다:

- `updateLocationSettings`: `withErrorHandling` 래퍼 제거, 직접 try-catch 처리
- `getLocationSettings`: `withErrorHandling` 래퍼 제거, 직접 try-catch 처리

### 2. 클라이언트 컴포넌트 수정

`LocationSettingsForm.tsx`에서:

- `useCallback` import 추가
- `loadSettings` 함수를 `useCallback`으로 메모이제이션
- `useEffect`의 의존성 배열에 `loadSettings` 추가

## 수정된 파일

1. `app/(admin)/actions/attendanceSettingsActions.ts`
   - `withErrorHandling` 제거
   - 직접 try-catch로 에러 처리
   - `normalizeError`, `getUserFacingMessage`, `logError` 헬퍼 함수 사용

2. `app/(admin)/admin/attendance/settings/_components/LocationSettingsForm.tsx`
   - `useCallback` 추가
   - `loadSettings` 함수 메모이제이션
   - `useEffect` 의존성 배열 수정

## 변경 사항 상세

### 서버 액션 에러 처리 패턴

```typescript
export async function updateLocationSettings(
  input: LocationSettingsInput
): Promise<{ success: boolean; error?: string }> {
  try {
    // 비즈니스 로직
    // ...
    return { success: true };
  } catch (error) {
    // Next.js의 redirect()와 notFound()는 재throw
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof (error as { digest: string }).digest === "string"
    ) {
      const digest = (error as { digest: string }).digest;
      if (
        digest.startsWith("NEXT_REDIRECT") ||
        digest.startsWith("NEXT_NOT_FOUND")
      ) {
        throw error;
      }
    }

    const normalizedError = normalizeError(error);
    logError(normalizedError, { function: "updateLocationSettings" });

    return {
      success: false,
      error: getUserFacingMessage(normalizedError),
    };
  }
}
```

### 클라이언트 컴포넌트 패턴

```typescript
const loadSettings = useCallback(async () => {
  // 로직
}, []);

useEffect(() => {
  loadSettings();
}, [loadSettings]);
```

## 결과

- 서버 액션이 Next.js 규칙을 완전히 준수
- "Functions cannot be passed to Client Components" 에러 해결
- React의 useEffect 규칙 준수
- 타입 안전성과 에러 처리 일관성 유지

## 참고

- QR 코드 액션과 동일한 패턴 적용
- 다른 서버 액션에도 동일한 패턴을 적용할 수 있음

