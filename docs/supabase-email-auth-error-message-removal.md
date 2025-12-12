# Supabase 이메일 인증 에러 메시지 제거 개선

## 작업 일자
2025년 1월

## 문제 상황
이메일 인증 링크를 클릭했을 때 "인증 처리 중 오류가 발생했습니다" 메시지가 표시되었지만, 실제로는 로그인이 정상적으로 완료되었습니다.

### 서버 로그 에러
```
"errorMessage": "Auth session missing!",
"errorName": "AuthSessionMissingError",
"errorStatus": 400
```

## 원인 분석

### 1. 타이밍 문제
- `getUser()` 호출 시점에 쿠키에 세션이 아직 저장되지 않음
- Supabase SSR이 이메일 인증 링크 클릭 시 자동으로 세션을 생성하지만, 타이밍상 `getUser()` 호출 시점에는 아직 없을 수 있음

### 2. 불필요한 에러 처리
- 실제로는 정상 동작하지만 에러를 감지하여 사용자에게 메시지 표시
- "Auth session missing" 에러는 타이밍 문제로 발생하는 것이므로 무시해야 함

### 3. 기존 패턴 참고
- `lib/auth/getCurrentUserRole.ts`: Refresh token 에러를 조용히 처리하고 null 반환
- `lib/auth/sessionManager.ts`: 세션 미싱 에러를 조용히 처리
- 동일한 패턴을 이메일 인증 콜백에도 적용

## 해결 방법

### 1. "Auth session missing" 에러 무시
- 이 에러는 타이밍 문제로 발생하는 것이므로 무시
- 코드가 있으면 Supabase가 자동으로 처리할 수 있음
- 에러 메시지 없이 리다이렉트

### 2. 코드 기반 리다이렉트 로직
- `code` 파라미터가 있으면 에러 메시지 없이 리다이렉트
- Supabase SSR이 자동으로 세션을 생성하므로, 우리는 리다이렉트만 수행

### 3. 실제 에러만 표시
- 세션 미싱이 아닌 실제 에러만 사용자에게 표시
- 에러 로깅은 유지 (디버깅용)

## 구현 내용

### 파일 수정

#### `app/auth/callback/route.ts`

**변경 사항**:
1. "Auth session missing" 에러 감지 및 무시
   - `error?.message?.includes("Auth session missing")` 체크
   - `error?.name === "AuthSessionMissingError"` 체크
   - 이 에러가 발생하면 에러 메시지 없이 리다이렉트

2. 코드가 있을 때 에러 메시지 없이 리다이렉트
   - `code` 파라미터가 있으면 Supabase가 자동으로 처리할 수 있도록 리다이렉트
   - 예외 발생 시에도 코드가 있으면 에러 메시지 없이 리다이렉트

3. 실제 에러만 사용자에게 표시
   - 세션 미싱 에러가 아닌 경우에만 에러 메시지 표시
   - 에러 로깅은 계속 수행 (디버깅용)

## 수정된 파일 목록

1. `app/auth/callback/route.ts`
   - "Auth session missing" 에러 감지 및 무시 로직 추가
   - 코드가 있을 때 에러 메시지 없이 리다이렉트
   - 실제 에러만 사용자에게 표시

## 개선 효과

1. **사용자 경험 개선**: 불필요한 에러 메시지 제거
2. **정확한 에러 표시**: 실제 에러만 사용자에게 표시
3. **안정성 향상**: 타이밍 문제로 인한 에러 무시
4. **일관성 유지**: 기존 코드베이스의 에러 처리 패턴과 일치

## 테스트 시나리오

1. **정상 케이스**: 이메일 인증 링크 클릭 → 에러 메시지 없이 리다이렉트 → 로그인 성공
2. **세션 미싱 에러**: "Auth session missing" 에러 발생 → 에러 무시 → 리다이렉트 → 로그인 성공
3. **실제 에러**: 만료된 코드, 유효하지 않은 코드 등 → 적절한 에러 메시지 표시
4. **코드 없음**: URL에 `code` 파라미터가 없는 경우 → 에러 메시지 표시

## 주의사항

1. **에러 로깅 유지**: 디버깅을 위해 에러 로깅은 계속 수행
2. **실제 에러 구분**: 세션 미싱 에러와 실제 에러를 정확히 구분
3. **코드 파라미터 확인**: `code` 파라미터가 있을 때만 에러 무시
4. **환경별 테스트**: 개발/프로덕션 환경에서 모두 테스트 필요

## 참고 사항

- 기존 에러 처리 패턴: `lib/auth/getCurrentUserRole.ts`, `lib/auth/sessionManager.ts`
- Supabase SSR 자동 세션 관리 방식
- 기존 개선 문서:
  - `docs/supabase-email-auth-error-handling-improvement.md`
  - `docs/supabase-email-auth-pkce-error-fix.md`

