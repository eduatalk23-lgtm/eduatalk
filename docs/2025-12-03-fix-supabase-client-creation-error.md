# Supabase 클라이언트 생성 에러 수정

## 문제 상황

`unstable_cache` 내부에서 `createSupabaseServerClient()`를 호출할 때 에러가 발생했습니다.

### 에러 메시지
```
[supabase/server] 클라이언트 생성 실패 {}
```

### 에러 발생 위치
- `lib/supabase/server.ts:116`
- `lib/data/contentMasters.ts:928` - `getPlatformsForFilter()` 함수
- `app/(student)/contents/master-lectures/page.tsx:29` - `unstable_cache` 내부

## 원인 분석

Next.js 15에서는 `unstable_cache` 내부에서 `cookies()`를 직접 호출할 수 없습니다. `createSupabaseServerClient()`는 내부적으로 `cookies()`를 호출하므로, `unstable_cache` 내부에서 사용할 수 없습니다.

## 해결 방법

### 1. `getPlatformsForFilter()` 함수 수정

플랫폼 목록은 공개 데이터이므로 쿠키가 필요 없습니다. `createSupabasePublicClient()`를 사용하도록 변경했습니다.

**변경 전:**
```typescript
export async function getPlatformsForFilter(): Promise<Array<{ id: string; name: string }>> {
  const supabase = await createSupabaseServerClient();
  // ...
}
```

**변경 후:**
```typescript
export async function getPlatformsForFilter(): Promise<Array<{ id: string; name: string }>> {
  // unstable_cache 내부에서 호출될 수 있으므로 쿠키가 필요 없는 public client 사용
  const supabase = createSupabasePublicClient();
  // ...
}
```

### 2. 에러 로깅 개선

에러 객체가 빈 객체 `{}`로 표시되는 문제를 해결하기 위해 에러 로깅을 개선했습니다.

**변경 전:**
```typescript
console.error("[supabase/server] 클라이언트 생성 실패", {
  message: errorMessage,
  error,
});
```

**변경 후:**
```typescript
console.error("[supabase/server] 클라이언트 생성 실패", {
  message: errorMessage,
  name: errorName,
  stack: errorStack,
  errorType: error?.constructor?.name,
  errorString: String(error),
});
```

## 수정된 파일

1. `lib/data/contentMasters.ts`
   - `createSupabasePublicClient` import 추가
   - `getPlatformsForFilter()` 함수에서 `createSupabasePublicClient()` 사용

2. `lib/supabase/server.ts`
   - 에러 로깅 개선 (더 상세한 에러 정보 출력)

## 영향 범위

### 영향받는 페이지
- `app/(student)/contents/master-lectures/page.tsx` - 학생 강의 검색 페이지

### 영향받지 않는 페이지
- `app/(admin)/admin/master-lectures/page.tsx` - 관리자 페이지 (unstable_cache 미사용)
- `app/api/platforms/route.ts` - API 라우트 (unstable_cache 미사용)

## 테스트 확인 사항

1. 학생 강의 검색 페이지가 정상적으로 로드되는지 확인
2. 플랫폼 필터 옵션이 정상적으로 표시되는지 확인
3. 콘솔에 에러가 발생하지 않는지 확인

## 참고 사항

- `unstable_cache` 내부에서는 쿠키를 사용할 수 없으므로, 공개 데이터 조회 시 `createSupabasePublicClient()`를 사용해야 합니다.
- 인증이 필요한 데이터 조회는 `unstable_cache` 외부에서 수행해야 합니다.

