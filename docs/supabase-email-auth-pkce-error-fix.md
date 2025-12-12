# Supabase 이메일 인증 PKCE 에러 해결

## 작업 일자
2025년 1월

## 문제 상황
이메일 인증 링크를 클릭했을 때 다음 에러가 발생했습니다:

```
"errorMessage": "invalid request: both auth code and code verifier should be non-empty",
"errorCode": "validation_failed"
```

## 원인 분석

### 1. PKCE 요구사항 문제
- `exchangeCodeForSession(code)` 호출 시 PKCE (Proof Key for Code Exchange)의 `code_verifier`가 필요함
- 이메일 인증 링크는 일반적으로 PKCE flow가 아님
- `code_verifier`가 없어서 에러 발생

### 2. Supabase SSR 방식 미활용
- `@supabase/ssr`의 `createServerClient`는 쿠키를 통해 자동으로 세션을 관리
- `exchangeCodeForSession`을 직접 호출하는 것이 적절하지 않음
- Supabase SSR은 이메일 인증 링크 클릭 시 쿠키에 세션을 자동 저장

## 해결 방법

### 1. 쿠키 기반 세션 확인으로 변경
**파일**: `app/auth/callback/route.ts`

**변경 사항**:
- `exchangeCodeForSession(code)` 호출 제거
- `getUser()`를 사용하여 쿠키에서 세션 확인
- Supabase SSR이 쿠키를 통해 자동으로 처리하도록 변경

**구현 로직**:
```typescript
// exchangeCodeForSession 대신, 쿠키를 통해 세션 확인
// Supabase SSR은 이메일 인증 링크 클릭 시 쿠키에 세션을 자동 저장
const supabase = await createSupabaseServerClient();
const { data: { user }, error } = await supabase.auth.getUser();

if (!error && user) {
  // 인증 성공 - 리다이렉트
}
```

### 2. PKCE 관련 에러 메시지 추가
**파일**: `lib/auth/authErrorMessages.ts`

**추가된 에러 패턴**:
- "code verifier"
- "code_verifier"
- "code verifier should be non-empty"
- "both auth code and code verifier should be non-empty"
- "validation_failed"

## 수정된 파일 목록

1. `app/auth/callback/route.ts`
   - `exchangeCodeForSession(code)` 제거
   - `getUser()`로 쿠키에서 세션 확인
   - 주석 업데이트

2. `lib/auth/authErrorMessages.ts`
   - PKCE 관련 에러 패턴 추가
   - 구체적인 에러 메시지 제공

## 개선 효과

1. **PKCE 에러 해결**: `code_verifier` 불필요
2. **Supabase SSR 표준 방식**: 쿠키 기반 세션 관리 활용
3. **안정성 향상**: Supabase SSR의 자동 세션 관리 활용
4. **유지보수성 향상**: 표준 방식 사용으로 향후 업데이트 호환성 향상

## 테스트 시나리오

1. **정상 케이스**: 이메일 인증 링크 클릭 → 쿠키에 세션 저장 → `getUser()`로 확인 → 인증 성공
2. **코드 없음**: URL에 `code` 파라미터가 없는 경우
3. **쿠키 없음**: 쿠키에 세션이 저장되지 않은 경우 (만료, 삭제 등)
4. **세션 만료**: 쿠키의 세션이 만료된 경우
5. **예외 상황**: 예상치 못한 에러 발생

## 주의사항

1. **쿠키 설정 확인**: `lib/supabase/server.ts`의 쿠키 설정이 Route Handler에서 정상 작동하는지 확인
2. **세션 확인 타이밍**: 이메일 링크 클릭 직후 쿠키에 세션이 저장되는지 확인 필요
3. **환경별 테스트**: 개발/프로덕션 환경에서 모두 테스트 필요
4. **에러 로깅**: 쿠키 기반 방식으로 변경 후에도 상세한 로깅 유지

## 참고 자료

- [Supabase SSR 문서](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase Auth Callbacks](https://supabase.com/docs/guides/auth/auth-callbacks)
- 기존 수정 문서: `docs/supabase-email-redirect-fix.md`
- 기존 개선 문서: `docs/supabase-email-auth-error-handling-improvement.md`

