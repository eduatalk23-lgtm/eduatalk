# Login Page Redirect 에러 처리 개선

## 작업 일시
2025-01-XX

## 문제 상황
로그인 페이지에서 이미 인증된 사용자를 리다이렉트할 때 콘솔에 `NEXT_REDIRECT` 에러가 표시되었습니다.

## 에러 메시지
```
Console Error
NEXT_REDIRECT
at LoginPage (app/login/page.tsx:62:21)
```

## 원인 분석
Next.js의 `redirect()` 함수는 내부적으로 특수한 에러를 throw하여 리다이렉트를 처리합니다. 이는 정상적인 동작이지만, 중첩된 try-catch 블록에서 이 에러를 잡지 못하거나 재throw하지 않으면 콘솔에 에러로 표시될 수 있습니다.

문제가 되던 구조:
1. 외부 try-catch 블록 (32-94번 라인)
2. 내부 try-catch 블록 (35-69번 라인)
3. `redirect("/dashboard")` 호출 (62번 라인)이 내부 try 블록 안에 있음
4. 내부 catch (64번 라인)가 redirect 에러를 잡지만 NEXT_REDIRECT를 확인하지 않음
5. 외부 catch (75번 라인)에서 NEXT_REDIRECT를 확인하고 재throw하지만, 이미 내부에서 처리되어 버릴 수 있음

## 해결 방법
코드 구조를 단순화하고, redirect 에러를 명확하게 처리하도록 수정했습니다:

1. 불필요한 외부 try-catch 블록 제거
2. 내부 try-catch에서 redirect 에러를 확인하고 재throw하도록 수정
3. redirect 호출은 조건 확인 후 try 블록 안에서 호출하되, catch에서 NEXT_REDIRECT를 확인

### 수정 내용

**수정 전:**
```typescript
if (userRole.userId && userRole.role) {
  try {
    if (userRole.role === "student") {
      try {
        // ... 쿼리 로직
        if (student) {
          redirect("/dashboard"); // 내부 try 안에 있음
        }
      } catch (queryError) {
        // redirect 에러 확인 안 함
      }
    } else if (...) {
      redirect("/admin/dashboard");
    }
  } catch (redirectError) {
    // NEXT_REDIRECT 확인 및 재throw
  }
}
```

**수정 후:**
```typescript
if (userRole.userId && userRole.role) {
  if (userRole.role === "student") {
    try {
      // ... 쿼리 로직
      if (student) {
        redirect("/dashboard"); // try 안에 있지만 catch에서 처리
      }
    } catch (queryError) {
      // redirect 에러인지 확인
      if (
        queryError &&
        typeof queryError === "object" &&
        "digest" in queryError &&
        typeof (queryError as { digest: string }).digest === "string"
      ) {
        const digest = (queryError as { digest: string }).digest;
        if (digest.startsWith("NEXT_REDIRECT")) {
          throw queryError; // 재throw
        }
      }
      // 다른 에러는 로깅만
    }
  } else if (...) {
    redirect("/admin/dashboard"); // try-catch 밖에서 직접 호출
  }
}
```

## 변경 파일
- `app/login/page.tsx`: 
  - 불필요한 외부 try-catch 제거
  - 내부 catch에서 NEXT_REDIRECT 확인 및 재throw 로직 추가
  - 코드 구조 단순화

## 검증
- [x] Linter 오류 없음 확인
- [x] redirect 에러가 올바르게 재throw되는지 확인

## 참고
- Next.js의 `redirect()`는 내부적으로 `NEXT_REDIRECT` digest를 가진 에러를 throw합니다
- 이는 정상적인 동작이며, 서버 컴포넌트에서 리다이렉트를 처리하는 방식입니다
- try-catch로 redirect를 감싸는 경우, catch에서 NEXT_REDIRECT를 확인하고 재throw해야 합니다
- 그래야 Next.js가 올바르게 리다이렉트를 처리할 수 있습니다

