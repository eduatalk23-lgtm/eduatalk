# Supabase 연결 확인 가이드

## 📋 개요

이 문서는 Supabase 연결을 확인하고 설정하는 방법을 안내합니다.

## 🔧 환경 변수 설정

### 1. `.env.local` 파일 생성

프로젝트 루트 디렉토리에 `.env.local` 파일을 생성하고 다음 환경 변수를 설정합니다:

```env
# Supabase 설정
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# 선택사항: Admin 작업용 (서버 사이드 전용)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### 2. Supabase 프로젝트 정보 확인

1. [Supabase Dashboard](https://app.supabase.com)에 로그인
2. 프로젝트 선택
3. **Settings** → **API** 메뉴로 이동
4. 다음 정보를 복사:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** 키 → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** 키 → `SUPABASE_SERVICE_ROLE_KEY` (선택사항)

### 3. 환경 변수 확인

환경 변수가 올바르게 설정되었는지 확인:

```bash
# 스크립트 실행
npx tsx scripts/test-supabase-connection.ts
```

## 🧪 연결 테스트

### 자동 테스트 스크립트

프로젝트에 포함된 테스트 스크립트를 실행합니다:

```bash
npx tsx scripts/test-supabase-connection.ts
```

이 스크립트는 다음을 확인합니다:
1. ✅ 환경 변수 설정 여부
2. ✅ Public Client 연결
3. ✅ Admin Client 연결 (Service Role Key가 있는 경우)
4. ✅ 데이터베이스 쿼리 테스트

### 수동 확인

#### 1. 환경 변수 확인

```typescript
import { env } from "@/lib/env";

console.log("Supabase URL:", env.NEXT_PUBLIC_SUPABASE_URL);
console.log("Anon Key:", env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "설정됨" : "없음");
```

#### 2. 클라이언트 생성 확인

```typescript
// Browser Client
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
const browserClient = createSupabaseBrowserClient();

// Server Client
import { createSupabaseServerClient } from "@/lib/supabase/server";
const serverClient = await createSupabaseServerClient();

// Admin Client (서버 전용)
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
const adminClient = createSupabaseAdminClient();
```

#### 3. 간단한 쿼리 테스트

```typescript
const { data, error } = await supabase
  .from("students")
  .select("*")
  .limit(1);

if (error) {
  console.error("연결 실패:", error);
} else {
  console.log("연결 성공:", data);
}
```

## 🔍 문제 해결

### 환경 변수를 찾을 수 없음

**증상:**
```
Error: 환경 변수 검증 실패:
  - NEXT_PUBLIC_SUPABASE_URL: Invalid input: expected string, received undefined
```

**해결 방법:**
1. `.env.local` 파일이 프로젝트 루트에 있는지 확인
2. 파일 이름이 정확한지 확인 (`.env.local`, `.env` 아님)
3. 환경 변수 이름이 정확한지 확인 (대소문자 구분)
4. 값에 따옴표가 없는지 확인
5. 개발 서버 재시작: `pnpm dev`
6. `.next` 폴더 삭제 후 재시작: `rm -rf .next && pnpm dev`

### 연결 타임아웃

**증상:**
```
Error: fetch failed
```

**해결 방법:**
1. Supabase 프로젝트가 활성화되어 있는지 확인
2. 네트워크 연결 확인
3. URL이 올바른지 확인 (https:// 포함)
4. 방화벽 설정 확인

### 인증 오류

**증상:**
```
Error: Invalid API key
```

**해결 방법:**
1. Supabase Dashboard에서 API 키 재확인
2. 키가 올바르게 복사되었는지 확인 (공백 없음)
3. `.env.local` 파일의 값에 따옴표가 없는지 확인

### RLS (Row Level Security) 오류

**증상:**
```
Error: new row violates row-level security policy
```

**해결 방법:**
1. Supabase Dashboard에서 RLS 정책 확인
2. Admin Client 사용 (서버 사이드 전용)
3. 적절한 인증 토큰 사용

## 📚 관련 파일

- 환경 변수 설정: `lib/env.ts`
- Browser Client: `lib/supabase/client.ts`
- Server Client: `lib/supabase/server.ts`
- Admin Client: `lib/supabase/admin.ts`
- 테스트 스크립트: `scripts/test-supabase-connection.ts`

## ✅ 체크리스트

연결 확인 전 체크리스트:

- [ ] `.env.local` 파일 생성
- [ ] `NEXT_PUBLIC_SUPABASE_URL` 설정
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` 설정
- [ ] (선택) `SUPABASE_SERVICE_ROLE_KEY` 설정
- [ ] 테스트 스크립트 실행
- [ ] 모든 테스트 통과 확인

## 🔐 보안 주의사항

1. **`.env.local` 파일은 절대 Git에 커밋하지 마세요**
   - `.gitignore`에 포함되어 있는지 확인

2. **Service Role Key는 서버 사이드에서만 사용**
   - 클라이언트 사이드에서 사용하면 보안 위험

3. **환경 변수는 프로덕션 환경에서도 설정 필요**
   - Vercel, Netlify 등 배포 플랫폼의 환경 변수 설정 사용

