# Supabase 이메일 인증 리다이렉트 URL 수정

## 작업 일자
2024년 12월

## 문제 상황
배포 환경에서 Supabase 이메일 인증 링크를 클릭하면 localhost로 리다이렉트되는 문제가 발생했습니다.

## 원인 분석
1. `signUp` 함수에서 `emailRedirectTo` 옵션이 없어 Supabase 기본 Site URL 사용
2. `resendConfirmationEmail` 함수에서 `emailRedirectTo` 옵션이 없음
3. 인증 콜백 라우트 부재로 세션 교환 처리 불가

## 해결 방법

### 1. 이메일 리다이렉트 URL 유틸리티 함수 생성
**파일**: `lib/utils/getEmailRedirectUrl.ts`

- `getBaseUrl`을 활용하여 프로덕션 URL 자동 감지
- 서버 사이드에서 `headers()`를 사용하여 호스트 정보 추출
- 환경 변수 `NEXT_PUBLIC_BASE_URL` 우선 사용

### 2. `signUp` 함수 수정
**파일**: `app/actions/auth.ts`

- `getEmailRedirectUrl` 유틸리티 함수 import
- `supabase.auth.signUp` 호출 시 `options.emailRedirectTo` 추가

### 3. `resendConfirmationEmail` 함수 수정
**파일**: `app/actions/auth.ts`

- `getEmailRedirectUrl` 유틸리티 함수 import
- `supabase.auth.resend` 호출 시 `options.emailRedirectTo` 추가

### 4. 인증 콜백 라우트 생성
**파일**: `app/auth/callback/route.ts`

- Next.js App Router Route Handler 패턴 사용
- `exchangeCodeForSession`으로 인증 코드를 세션으로 교환
- 프로덕션 환경에서 로드 밸런서를 고려한 리다이렉트 처리
- 에러 발생 시 로그인 페이지로 리다이렉트

## 수정된 파일 목록

1. `lib/utils/getEmailRedirectUrl.ts` (신규)
2. `lib/utils/index.ts` (export 추가)
3. `app/actions/auth.ts` (signUp, resendConfirmationEmail 함수 수정)
4. `app/auth/callback/route.ts` (신규)

## 추가 작업 필요 사항

### Supabase 대시보드 설정
1. **Site URL 변경**
   - Supabase 대시보드 → Authentication → URL Configuration
   - Site URL을 프로덕션 도메인으로 변경 (예: `https://yourdomain.com`)

2. **Redirect URLs 추가**
   - Additional Redirect URLs에 다음 추가:
     - `https://yourdomain.com/auth/callback`
     - `https://yourdomain.com/**` (와일드카드 허용 시)

### 환경 변수 설정
프로덕션 환경에서 `NEXT_PUBLIC_BASE_URL` 환경 변수를 설정해야 합니다:

```env
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
```

## 테스트 체크리스트

- [ ] 로컬 환경에서 이메일 인증 링크 테스트
- [ ] 프로덕션 환경에서 이메일 인증 링크 테스트
- [ ] 인증 콜백 라우트 동작 확인
- [ ] Supabase 대시보드 설정 확인

## 참고 자료

- [Supabase Email Templates 문서](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase SSR 문서](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Next.js Route Handlers 문서](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)

