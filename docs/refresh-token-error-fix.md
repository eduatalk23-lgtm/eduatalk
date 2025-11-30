# Refresh Token 에러 처리 개선

## 문제 상황

로그인 페이지에서 "Invalid Refresh Token: Refresh Token Not Found" 에러가 발생했습니다.

### 에러 원인

- 쿠키에 저장된 refresh token이 만료되었거나 손상된 경우
- `supabase.auth.getUser()` 호출 시 자동으로 refresh token을 갱신하려고 시도하는데, 토큰이 없거나 유효하지 않을 때 발생

## 해결 방법

### 1. `getCurrentUserRole` 함수 개선

`lib/auth/getCurrentUserRole.ts`에서 refresh token 에러를 명시적으로 처리하도록 수정했습니다.

**변경 사항:**
- refresh token 관련 에러 메시지를 감지하여 조용히 처리
- 세션이 없는 것으로 간주하고 `null` 반환
- 불필요한 에러 로깅 방지

**처리하는 에러 패턴:**
- "refresh token"
- "refresh_token"
- "refresh token not found"
- "invalid refresh token"
- "refresh token expired"

### 2. `getCurrentUser` 함수 개선

`lib/auth/getCurrentUser.ts`에서도 동일하게 refresh token 에러를 처리하도록 수정했습니다.

**변경 사항:**
- `getUser()` 호출 시 발생하는 refresh token 에러를 명시적으로 처리
- catch 블록에서도 refresh token 에러를 감지하여 조용히 처리

## 수정된 파일

1. `lib/auth/getCurrentUserRole.ts`
   - refresh token 에러 감지 로직 추가
   - 에러 메시지와 이름을 모두 확인하여 refresh token 에러인지 판단

2. `lib/auth/getCurrentUser.ts`
   - `getUser()` 호출 시 발생하는 refresh token 에러 처리
   - catch 블록에서도 refresh token 에러 감지

## 동작 방식

1. 사용자가 로그인 페이지에 접근
2. `getCurrentUserRole()`이 호출되어 현재 사용자 확인 시도
3. 쿠키에 저장된 refresh token이 만료되었거나 손상된 경우
4. Supabase가 refresh token 에러를 반환
5. 에러 메시지를 확인하여 refresh token 에러인지 판단
6. refresh token 에러인 경우 조용히 처리하고 `null` 반환
7. 로그인 페이지가 정상적으로 표시됨

## 테스트

- [x] 만료된 refresh token이 있는 경우 로그인 페이지 정상 표시
- [x] refresh token이 없는 경우 로그인 페이지 정상 표시
- [x] 유효한 세션이 있는 경우 정상적으로 사용자 정보 반환
- [x] 다른 인증 에러는 여전히 로깅됨

## 참고

- 이 수정은 로그인 페이지에서 발생하는 refresh token 에러를 조용히 처리하여 사용자 경험을 개선합니다.
- 실제 인증이 필요한 경우에는 여전히 에러가 발생하므로 보안에는 문제가 없습니다.
- refresh token이 만료된 경우 사용자는 다시 로그인해야 합니다.

