# 프록시 설정 점검 가이드

## 📋 현재 상태 점검

### 1. 환경 변수 확인

프로젝트에서 프록시 관련 환경 변수를 확인합니다:

```bash
# 프록시 환경 변수 확인
env | grep -i proxy
```

**현재 상태:** 프록시 환경 변수 없음 ✅

### 2. 코드베이스 확인

프로젝트 코드에서 프록시 관련 설정을 확인했습니다:

- ✅ `next.config.ts`: 프록시 설정 없음
- ✅ `package.json`: 프록시 관련 스크립트 없음
- ✅ 환경 변수 파일: 프록시 설정 없음
- ⚠️ `https-proxy-agent`: 의존성으로 포함되어 있으나 직접 사용하지 않음 (다른 패키지의 의존성)

### 3. Supabase 클라이언트 설정

현재 프로젝트는 Supabase JS 클라이언트를 사용하며, 프록시 설정이 없습니다:

```typescript
// lib/supabase/client.ts, server.ts, admin.ts
// 프록시 설정 없이 직접 Supabase URL로 연결
```

## 🔧 프록시가 필요한 경우

### 상황 1: 회사/학교 네트워크에서 프록시 사용

회사나 학교 네트워크에서 프록시를 통해야 하는 경우:

#### 방법 1: 환경 변수 설정 (권장)

`.env.local` 파일에 프록시 설정 추가:

```env
# HTTP 프록시
HTTP_PROXY=http://proxy.example.com:8080
http_proxy=http://proxy.example.com:8080

# HTTPS 프록시
HTTPS_PROXY=http://proxy.example.com:8080
https_proxy=http://proxy.example.com:8080

# 프록시 제외 목록 (선택사항)
NO_PROXY=localhost,127.0.0.1,.local
no_proxy=localhost,127.0.0.1,.local
```

#### 방법 2: Node.js에서 직접 설정

Supabase 클라이언트 생성 시 프록시 설정:

```typescript
import { createClient } from "@supabase/supabase-js";
import { HttpsProxyAgent } from "https-proxy-agent";

const proxyAgent = process.env.HTTPS_PROXY
  ? new HttpsProxyAgent(process.env.HTTPS_PROXY)
  : undefined;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    global: {
      fetch: (url, options) => {
        return fetch(url, {
          ...options,
          agent: proxyAgent,
        });
      },
    },
  }
);
```

### 상황 2: 개발 환경에서 프록시 서버 사용

로컬 개발 환경에서 프록시를 사용하는 경우:

#### Next.js Rewrites 사용 (API 프록시)

`next.config.ts`에 rewrites 추가:

```typescript
const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/proxy/:path*",
        destination: "https://api.example.com/:path*",
      },
    ];
  },
};
```

## 🚨 문제 해결

### 문제: Supabase 연결 실패 (프록시 관련)

**증상:**
- `ECONNREFUSED` 오류
- `ETIMEDOUT` 오류
- 네트워크 연결 실패

**해결 방법:**

1. **프록시 환경 변수 확인**
   ```bash
   echo $HTTP_PROXY
   echo $HTTPS_PROXY
   ```

2. **프록시 우회 (Supabase 직접 연결)**
   ```env
   # .env.local
   NO_PROXY=*.supabase.co,supabase.co
   no_proxy=*.supabase.co,supabase.co
   ```

3. **Supabase 클라이언트에 프록시 설정 추가**
   - 위의 "방법 2" 참고

### 문제: 개발 서버가 프록시를 통과하지 못함

**해결 방법:**

```bash
# 개발 서버 실행 시 프록시 설정
HTTP_PROXY=http://proxy.example.com:8080 \
HTTPS_PROXY=http://proxy.example.com:8080 \
npm run dev
```

또는 `.env.local`에 설정:

```env
HTTP_PROXY=http://proxy.example.com:8080
HTTPS_PROXY=http://proxy.example.com:8080
```

## ✅ 체크리스트

프록시 관련 문제가 있는 경우:

- [ ] 환경 변수에서 프록시 설정 확인 (`env | grep -i proxy`)
- [ ] `.env.local`에 프록시 설정 추가 (필요한 경우)
- [ ] Supabase URL이 프록시를 통과해야 하는지 확인
- [ ] `NO_PROXY` 설정으로 로컬/내부 서비스 제외
- [ ] 개발 서버 재시작
- [ ] 네트워크 연결 테스트

## 📝 현재 프로젝트 권장사항

**현재 상태:** 프록시 설정 없음 ✅

일반적인 경우:
- ✅ 프록시 설정이 필요하지 않음
- ✅ Supabase는 직접 HTTPS 연결 사용
- ✅ 추가 설정 불필요

프록시가 필요한 경우에만:
- `.env.local`에 프록시 환경 변수 추가
- 또는 Supabase 클라이언트에 프록시 에이전트 설정

## 🔍 프록시 확인 명령어

```bash
# 현재 프록시 환경 변수 확인
env | grep -i proxy

# 네트워크 연결 테스트
curl -I https://your-project.supabase.co

# 프록시를 통한 연결 테스트
curl -x http://proxy.example.com:8080 -I https://your-project.supabase.co
```

## 📚 참고 자료

- [Node.js HTTP Agent 문서](https://nodejs.org/api/http.html#http_class_http_agent)
- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [Supabase Connection Issues](https://supabase.com/docs/guides/getting-started/troubleshooting)

