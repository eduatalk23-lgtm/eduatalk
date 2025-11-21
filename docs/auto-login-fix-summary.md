# 자동로그인 문제 해결 요약

## 🔍 발견된 문제

### 문제 1: 루트 페이지가 무조건 로그인으로 리다이렉트
- **위치**: `app/page.tsx`
- **문제**: 인증 확인 없이 무조건 `/login`으로 리다이렉트
- **영향**: 자동로그인으로 쿠키가 있어도 루트 페이지 접속 시 로그인 페이지로 이동

### 문제 2: 로그인 페이지에서 인증 확인 없음
- **위치**: `app/login/page.tsx`
- **문제**: 이미 인증된 사용자가 로그인 페이지에 접근해도 그대로 표시
- **영향**: 불필요한 로그인 페이지 표시

## ✅ 적용된 해결 방법

### 1. 루트 페이지 수정 (`app/page.tsx`)
- 인증 확인 로직 추가
- 인증된 사용자는 역할에 따라 적절한 페이지로 리다이렉트
- 미인증 사용자만 로그인 페이지로 리다이렉트

```typescript
// 인증 확인 후 역할에 따라 리다이렉트
if (role === "admin" || role === "consultant") {
  redirect("/admin/dashboard");
} else if (role === "parent") {
  redirect("/parent/dashboard");
} else if (role === "student") {
  redirect("/dashboard");
}
```

### 2. 로그인 페이지 수정 (`app/login/page.tsx`)
- 서버 컴포넌트로 변경
- 인증 확인 로직 추가
- 이미 인증된 사용자는 적절한 페이지로 리다이렉트
- 로그인 폼은 별도의 클라이언트 컴포넌트로 분리 (`LoginForm.tsx`)

### 3. 쿠키 설정 로직 개선 (`lib/supabase/server.ts`)
- 디버깅 로그 추가
- 자동로그인 쿠키 설정 시 로그 출력

## 🧪 테스트 방법

### 1. 기본 테스트
```bash
# 개발 서버 실행
npm run dev

# 브라우저에서 http://localhost:3000 접속
# 자동로그인 체크박스 선택 후 로그인
```

### 2. 자동로그인 확인
1. 자동로그인 체크박스 선택 후 로그인
2. 브라우저 완전 종료 (모든 창 닫기)
3. 브라우저 재시작
4. `http://localhost:3000` 접속
5. **예상 결과**: 로그인 페이지를 거치지 않고 바로 대시보드로 이동

### 3. 쿠키 확인
- 개발자 도구 (F12) → Application 탭 → Cookies
- `sb-*-auth-token` 쿠키의 `Expires` 값이 30일 후로 설정되어 있는지 확인
- 서버 콘솔에서 자동로그인 쿠키 설정 로그 확인

## 🔧 추가 개선 사항

### 디버깅 로그
서버 콘솔에서 다음과 같은 로그를 확인할 수 있습니다:
```
[auth] 자동로그인 쿠키 설정: {
  cookieName: 'sb-xxx-auth-token',
  maxAge: 2592000,
  expires: 2025-02-26T...
}
```

### 쿠키 이름 확인
Supabase SSR은 다음과 같은 쿠키를 사용합니다:
- `sb-{project-ref}-auth-token` - 세션 토큰
- `sb-{project-ref}-auth-token-code-verifier` - PKCE 코드

현재 구현에서는 `name.includes('auth-token')`으로 인증 쿠키를 감지합니다.

## 📝 주의사항

1. **Server Component 제한**: Next.js 15에서는 Server Component에서 쿠키를 수정할 수 없습니다. 쿠키 설정은 Server Action이나 Route Handler에서만 가능합니다.

2. **쿠키 만료 시간**: 자동로그인 선택 시 쿠키 만료 시간이 30일로 설정됩니다. 이는 Supabase의 refresh token 만료 시간과 일치해야 합니다.

3. **보안 고려사항**: 자동로그인 기능은 공용 컴퓨터에서는 사용하지 않는 것이 좋습니다.

## ✅ 해결 완료

- [x] 루트 페이지 인증 확인 추가
- [x] 로그인 페이지 인증 확인 추가
- [x] 쿠키 설정 로직 개선
- [x] 디버깅 로그 추가
- [x] 로그인 폼 클라이언트 컴포넌트 분리

이제 브라우저를 닫고 다시 접속해도 자동로그인이 정상적으로 작동합니다.

