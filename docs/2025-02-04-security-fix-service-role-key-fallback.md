# 보안 취약점 수정: Service Role Key Fallback 제거

## 작업 일자
2025-02-04

## 문제 상황

### 발견된 보안 취약점
`lib/supabase/server.ts`의 `createSupabaseAdminClient` 함수에서 Service Role Key가 없을 때 Anon Key로 대체하는 로직이 있었습니다.

**위험도**: 🔴 높음

### 취약점 상세

**기존 코드**:
```typescript
export function createSupabaseAdminClient() {
  // Service Role Key가 없는 경우 에러 처리하거나 Anon Key로 대체 (보안상 취약할 수 있음)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // ...
}
```

**문제점**:
- Service Role Key가 없을 때 Anon Key로 대체하는 것은 **심각한 보안 취약점**입니다
- Anon Key는 RLS 정책의 제약을 받지만, Service Role Key는 RLS를 완전히 우회합니다
- 이로 인해 의도하지 않은 권한 상승이 발생할 수 있습니다
- 개발자가 Service Role Key 설정을 놓쳤을 때도 조용히 Anon Key로 동작하여 보안 문제를 인지하기 어렵습니다

---

## 수정 내용

### 파일
- `lib/supabase/server.ts`

### 변경 사항

1. **Service Role Key fallback 제거**
   - Anon Key로 대체하는 로직 제거
   - `lib/supabase/admin.ts`의 패턴을 따름 (null 반환)

2. **개발 환경에서 명확한 에러 메시지**
   - 개발 환경에서는 Service Role Key가 없으면 즉시 에러 throw
   - 개발자가 설정 누락을 빠르게 인지할 수 있도록 함

3. **프로덕션 환경에서 안전한 처리**
   - 프로덕션 환경에서는 null 반환
   - 호출하는 쪽에서 null 체크 후 적절히 처리

4. **Deprecated 주석 추가**
   - `lib/supabase/admin.ts` 사용을 권장하는 주석 추가
   - 하위 호환성을 위해 함수는 유지

**수정된 코드**:
```typescript
export function createSupabaseAdminClient() {
  // lib/supabase/admin.ts의 구현을 따름 (보안상 안전)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    // 개발 환경에서는 에러 throw
    if (process.env.NODE_ENV === "development") {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다. " +
        "Admin 클라이언트를 생성할 수 없습니다."
      );
    }
    // 프로덕션 환경에서는 null 반환 (호출하는 쪽에서 처리)
    console.error(
      "[supabase/server] SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다."
    );
    return null;
  }

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: (...args) => fetch(...args),
    },
  });
}
```

---

## 영향 분석

### 기존 코드 호환성

1. **대부분의 코드는 영향 없음**
   - 대부분의 코드는 `@/lib/supabase/admin`에서 import하여 사용
   - `admin.ts`는 이미 올바르게 구현되어 있음 (null 반환)

2. **`server.ts`를 사용하는 코드**
   - 직접 사용하는 코드는 없음 (grep 결과 확인)
   - `clientSelector.ts`는 `admin.ts`를 사용
   - `app/actions/auth.ts`는 `admin.ts`를 사용하고 null 체크 헬퍼 함수 사용

3. **타입 안전성**
   - 반환 타입이 `ReturnType<typeof createSupabaseAdminClient> | null`로 변경
   - 기존에 null 체크를 하지 않던 코드는 TypeScript가 에러를 감지할 수 있음

---

## 검증

### 린터 검사
- ✅ ESLint 에러 없음
- ✅ TypeScript 컴파일 에러 없음

### 기능 테스트
- ✅ 기존 코드와의 호환성 확인
- ✅ `lib/supabase/admin.ts`와 일관된 동작 확인

---

## 권장 사항

### 1. `lib/supabase/admin.ts` 사용 권장
- `server.ts`의 `createSupabaseAdminClient`는 deprecated로 표시됨
- 새로운 코드는 `@/lib/supabase/admin`에서 import하여 사용

### 2. Null 체크 패턴
기존 코드에서 사용 중인 패턴:

```typescript
// 패턴 1: ensureAdminClient 사용 (에러 throw)
import { ensureAdminClient } from "@/lib/supabase/clientSelector";
const supabase = ensureAdminClient();

// 패턴 2: 직접 null 체크
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
const supabase = createSupabaseAdminClient();
if (!supabase) {
  throw new AppError("Admin 클라이언트를 생성할 수 없습니다.", ...);
}

// 패턴 3: 헬퍼 함수 사용 (app/actions/auth.ts)
function getAdminClientOrError() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return { success: false, error: "..." };
  }
  return { success: true, client: supabase };
}
```

---

## 참고 문서

- **분석 보고서**: `docs/2025-02-04-repomix-phase1-analysis-report.md`
- **가이드 문서**: `docs/2025-02-04-repomix-phase-analysis-guide.md`

---

## 결론

보안 취약점이 성공적으로 수정되었습니다. Service Role Key가 없을 때 Anon Key로 대체하는 위험한 로직이 제거되었고, `lib/supabase/admin.ts`와 일관된 안전한 패턴을 따르도록 개선되었습니다.

기존 기능에는 영향이 없으며, 개발 환경에서 설정 누락을 빠르게 인지할 수 있도록 개선되었습니다.

