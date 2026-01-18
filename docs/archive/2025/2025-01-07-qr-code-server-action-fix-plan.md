# QR 코드 서버 액션 에러 해결 계획

## 문제 분석

### 에러 메시지
```
Functions cannot be passed directly to Client Components unless you explicitly expose it by marking it with "use server". Or maybe you meant to call this function rather than return it. {}
```

### 원인 분석

1. **서버 액션 래핑 문제**
   - `withErrorHandling`으로 래핑된 함수가 서버 액션으로 제대로 인식되지 않을 수 있음
   - Next.js는 "use server" 파일에서 직접 export된 함수만 서버 액션으로 인식

2. **함수 반환 타입 문제**
   - `withErrorHandling`이 함수를 반환하는데, 이 반환된 함수가 서버 액션으로 마킹되지 않음

3. **에러 메시지의 `{}`**
   - 빈 객체나 함수가 잘못 전달되고 있을 가능성

## 해결 방안

### 방안 1: 서버 액션에서 직접 에러 처리 (권장)

서버 액션 내부에서 직접 try-catch로 에러를 처리하고, `withErrorHandling` 래퍼를 제거합니다.

**장점:**
- Next.js의 서버 액션 규칙을 완전히 준수
- 타입 안전성 보장
- 명확한 에러 처리

**단점:**
- 에러 처리 로직이 각 서버 액션에 중복될 수 있음

### 방안 2: 서버 액션 내부에서 withErrorHandling 사용

`withErrorHandling`을 서버 액션 내부에서 호출하는 방식으로 변경합니다.

**장점:**
- 기존 에러 처리 로직 재사용 가능

**단점:**
- 여전히 서버 액션 인식 문제가 발생할 수 있음

### 방안 3: 에러 처리 헬퍼 함수 사용

서버 액션 내부에서 에러 처리 헬퍼 함수를 직접 호출합니다.

**장점:**
- 에러 처리 로직 재사용
- 서버 액션 규칙 준수

**단점:**
- 약간의 코드 중복

## 권장 해결 방법

**방안 1을 권장합니다.** 서버 액션 내부에서 직접 에러를 처리하고, 에러 처리 헬퍼 함수를 사용하여 일관성을 유지합니다.

### 구현 예시

```typescript
"use server";

import { requireAdminAuth } from "@/lib/auth/requireAdminAuth";
import { generateAttendanceQRCode } from "@/lib/services/qrCodeService";
import { normalizeError, getUserFacingMessage, logError } from "@/lib/errors";

export async function generateQRCodeAction(): Promise<{
  success: boolean;
  qrCodeUrl?: string;
  error?: string;
}> {
  try {
    await requireAdminAuth();
    const result = await generateAttendanceQRCode();
    return {
      success: true,
      qrCodeUrl: result.qrCodeUrl,
    };
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
    logError(normalizedError, { function: "generateQRCodeAction" });

    return {
      success: false,
      error: getUserFacingMessage(normalizedError),
    };
  }
}
```

## 참고 문서

- [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [Next.js Error Handling](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations#error-handling)

## 구현 완료

### 수정된 파일
- `app/(admin)/actions/qrCodeActions.ts`

### 변경 사항
- `withErrorHandling` 래퍼 제거
- 서버 액션 내부에서 직접 try-catch로 에러 처리
- `normalizeError`, `getUserFacingMessage`, `logError` 헬퍼 함수 사용
- Next.js의 `redirect()`와 `notFound()` 예외 처리 포함

### 결과
- 서버 액션이 Next.js 규칙을 완전히 준수
- 에러 처리 로직이 명확하고 타입 안전
- 클라이언트 컴포넌트에서 안전하게 호출 가능

## 다음 단계 (선택사항)

1. 다른 서버 액션에도 동일한 패턴 적용 검토
2. 에러 처리 헬퍼 함수를 사용한 일관성 유지

