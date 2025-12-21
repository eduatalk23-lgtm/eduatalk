# Next.js 16 정적 생성 중 Supabase 클라이언트 에러 처리 개선

## 작업 일시
2025-01-21

## 문제 상황

Next.js 16 빌드 타임에 정적 생성(Static Generation) 시도 중 다음과 같은 에러가 대량으로 발생했습니다:

```
[supabase/server] 클라이언트 생성 실패 {
  message: "Dynamic server usage: Route /admin/master-books couldn't be rendered statically because it used `cookies`.",
  ...
}
```

### 에러 발생 위치
- `lib/supabase/server.ts:127` - `createSupabaseServerClient()` 함수의 catch 블록
- 빌드 타임에 모든 페이지에서 발생 (약 69개 라우트)

### 문제점
1. 빌드는 성공하지만 에러 로그가 과도하게 출력되어 빌드 로그가 지저분함
2. 정적 생성 중 에러는 예상된 동작이지만, 모든 에러를 동일하게 로깅
3. 실제 런타임 에러와 정적 생성 중 에러를 구분하지 못함

## 원인 분석

### Next.js 16의 정적 생성 동작
- Next.js 16은 빌드 타임에 가능한 모든 페이지를 정적 생성 시도
- `cookies()` 사용은 동적 렌더링을 유발하므로 정적 생성 불가
- 정적 생성 중에는 쿠키가 없으므로 `cookies()` 호출 시 "Dynamic server usage" 에러 발생

### 현재 코드의 문제
- 모든 에러를 동일하게 로깅하여 정적 생성 중 예상된 에러도 로그에 출력
- 정적 생성 중 에러와 실제 런타임 에러를 구분하지 못함

## 해결 방법

### 1. 정적 생성 중 에러 감지 및 처리

**파일**: `lib/supabase/server.ts`

정적 생성 중 에러를 감지하고, 해당 경우에는:
- 에러 로깅을 건너뛰기
- 쿠키가 필요 없는 public 클라이언트 반환
- 런타임 에러는 계속 로깅하여 디버깅 가능하게 유지

### 2. 구현 세부사항

#### 에러 감지 로직
```typescript
const errorMessage = error instanceof Error ? error.message : String(error);
const isStaticGenerationError = 
  errorMessage.includes("Dynamic server usage") ||
  errorMessage.includes("couldn't be rendered statically");
```

#### 처리 전략
- **정적 생성 중 에러**: 조용히 처리하고 public 클라이언트 반환
- **런타임 에러**: 기존대로 상세 로깅 후 fallback 클라이언트 반환

### 3. 수정 내용

**파일**: `lib/supabase/server.ts` (127-194줄)

**변경 전:**
```typescript
} catch (error) {
  // Supabase 클라이언트 생성 실패 시 에러 로깅
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  const errorName = error instanceof Error ? error.name : undefined;
  
  console.error("[supabase/server] 클라이언트 생성 실패", {
    message: errorMessage,
    name: errorName,
    stack: errorStack,
    errorType: error?.constructor?.name,
    errorString: String(error),
  });
  // ...
}
```

**변경 후:**
```typescript
} catch (error) {
  // 에러 메시지 추출
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Next.js 16 빌드 타임 정적 생성 중 에러 감지
  // 정적 생성 중에는 쿠키가 없으므로 cookies() 호출 시 "Dynamic server usage" 에러 발생
  // 이는 예상된 동작이므로 조용히 처리하고 public 클라이언트 반환
  const isStaticGenerationError = 
    errorMessage.includes("Dynamic server usage") ||
    errorMessage.includes("couldn't be rendered statically");
  
  if (isStaticGenerationError) {
    // 정적 생성 중 에러는 로깅 없이 public 클라이언트 반환
    // 정적 생성 중에는 쿠키가 필요 없으므로 public 클라이언트가 적절함
    return createSupabasePublicClient();
  }
  
  // 런타임 에러는 상세 로깅하여 디버깅 가능하게 유지
  const errorStack = error instanceof Error ? error.stack : undefined;
  const errorName = error instanceof Error ? error.name : undefined;
  
  console.error("[supabase/server] 클라이언트 생성 실패", {
    message: errorMessage,
    name: errorName,
    stack: errorStack,
    errorType: error?.constructor?.name,
    errorString: String(error),
  });
  // ...
}
```

### 4. 함수 주석 업데이트

**파일**: `lib/supabase/server.ts` (33-42줄)

함수 상단 주석에 정적 생성 중 처리에 대한 설명 추가:

```typescript
/**
 * Supabase Server Client 생성
 * 
 * Next.js 15에서는 쿠키 수정이 Server Action이나 Route Handler에서만 가능합니다.
 * 일반 Server Component에서는 쿠키를 읽기 전용으로만 사용합니다.
 * 
 * 정적 생성 중 처리:
 * - Next.js 16 빌드 타임에 정적 생성 시도 중 cookies() 호출 시 "Dynamic server usage" 에러 발생
 * - 이는 예상된 동작이며, 정적 생성 중에는 쿠키가 필요 없으므로 public 클라이언트를 반환
 * - 런타임 에러는 기존대로 상세 로깅하여 디버깅 가능하게 유지
 */
```

## 수정된 파일

1. `lib/supabase/server.ts`
   - 정적 생성 중 에러 감지 로직 추가
   - 정적 생성 중 에러는 로깅 없이 public 클라이언트 반환
   - 런타임 에러는 기존대로 상세 로깅 유지
   - 함수 주석 업데이트

## 예상 효과

1. **빌드 로그 개선**: 정적 생성 중 예상된 에러 로그 제거 (약 69개 라우트에서 발생하던 에러 로그 제거)
2. **성능 영향 없음**: 정적 생성 중에는 public 클라이언트 사용으로 적절한 대응
3. **디버깅 유지**: 실제 런타임 에러는 계속 로깅되어 문제 파악 가능
4. **코드 명확성**: 정적 생성과 런타임 에러를 명확히 구분

## 검증 방법

1. `npm run build` 실행하여 에러 로그 감소 확인
2. 빌드 성공 여부 확인
3. 런타임에서 실제 에러 발생 시 로깅 확인
4. 프로덕션 빌드에서도 동일하게 동작하는지 확인

## 참고 자료

- Next.js 16 문서: `cookies()` 사용 시 동적 렌더링 유발
- Supabase SSR 문서: Server Component에서는 읽기 전용 쿠키 사용
- 기존 문서: `docs/2025-12-03-fix-supabase-client-creation-error.md`

## 관련 이슈

- Next.js 16의 정적 생성 동작 변경
- 빌드 타임에 동적 API 사용 시 에러 발생 (예상된 동작)

