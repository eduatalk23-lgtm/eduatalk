# Next.js 15 headers() Promise 수정

## 문제 상황

Next.js 15에서 `headers()` 함수가 Promise를 반환하도록 변경되면서 발생한 에러 수정

### 에러 메시지
```
Error: Route "/login" used `headers().get`. `headers()` returns a Promise and must be unwrapped with `await` or `React.use()` before accessing its properties.
```

## 수정 내용

### 파일: `lib/auth/sessionManager.ts`

#### 1. `getHeaderValue` 함수 수정

**Before:**
```typescript
function getHeaderValue(name: string): string | null {
  try {
    const headersList = headers();
    if (!headersList || typeof headersList.get !== 'function') {
      return null;
    }
    return headersList.get(name);
  } catch {
    return null;
  }
}
```

**After:**
```typescript
async function getHeaderValue(name: string): Promise<string | null> {
  try {
    const headersList = await headers();
    if (!headersList || typeof headersList.get !== 'function') {
      return null;
    }
    return headersList.get(name);
  } catch {
    return null;
  }
}
```

#### 2. `getClientIP` 함수 수정

**Before:**
```typescript
function getClientIP(): string | null {
  const cfConnectingIP = getHeaderValue("cf-connecting-ip");
  const realIP = getHeaderValue("x-real-ip");
  const forwardedFor = getHeaderValue("x-forwarded-for");
  // ...
}
```

**After:**
```typescript
async function getClientIP(): Promise<string | null> {
  const cfConnectingIP = await getHeaderValue("cf-connecting-ip");
  const realIP = await getHeaderValue("x-real-ip");
  const forwardedFor = await getHeaderValue("x-forwarded-for");
  // ...
}
```

#### 3. 함수 호출부 수정

**saveUserSession 함수:**
```typescript
const userAgent = await getHeaderValue("user-agent");
const ipAddress = await getClientIP();
```

**getUserSessions 함수:**
```typescript
const userAgent = await getHeaderValue("user-agent");
const ipAddress = await getClientIP();
```

## 주요 변경사항

1. `getHeaderValue()` 함수를 `async` 함수로 변경
2. `getClientIP()` 함수를 `async` 함수로 변경
3. 모든 호출부에 `await` 키워드 추가

## 영향 범위

- `lib/auth/sessionManager.ts` 파일만 수정
- 세션 저장 및 조회 로직에 영향
- 로그인, 세션 관리 기능 정상화

## 테스트 필요 사항

- [ ] 로그인 기능 테스트
- [ ] 세션 저장 테스트
- [ ] 세션 조회 테스트
- [ ] IP 주소 및 User-Agent 정상 기록 확인

## Next.js 15 마이그레이션 가이드

Next.js 15부터는 다음 API들이 모두 Promise를 반환합니다:
- `headers()`
- `cookies()`
- `params`
- `searchParams`

모든 사용처에서 `await` 또는 `React.use()`를 사용해야 합니다.

### 참고 문서
- [Next.js 15 마이그레이션 가이드](https://nextjs.org/docs/messages/sync-dynamic-apis)

