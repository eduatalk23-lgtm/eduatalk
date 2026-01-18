# Next.js Dynamic Rendering 설정 수정 (2025-02-01)

## 문제 상황

Next.js 빌드 시 다음과 같은 경고가 다수 발생했습니다:

```
Dynamic server usage: Route /admin/parent-links couldn't be rendered statically because it used `cookies`.
```

이 경고는 Next.js가 빌드 시 정적 생성(static generation)을 시도하다가, 해당 페이지들이 `cookies()`를 사용하므로 동적 렌더링이 필요하다는 것을 알려주는 것입니다.

## 원인 분석

1. **레이아웃 파일에서 `export const dynamic = 'force-dynamic'`이 주석 처리됨**
   - `app/(admin)/layout.tsx`
   - `app/(student)/layout.tsx`

2. **일부 페이지에서 `export const dynamic = 'force-dynamic'`이 주석 처리됨**
   - `app/(student)/today/page.tsx`
   - `app/(student)/camp/today/page.tsx`

3. **일부 페이지에 `export const dynamic = 'force-dynamic'`이 없음**
   - 여러 관리자 페이지 및 학생 페이지

## 해결 방법

인증이 필요한 페이지들은 모두 동적 렌더링이 필요하므로, 다음 파일들에 `export const dynamic = 'force-dynamic'`을 추가했습니다:

### 레이아웃 파일
- `app/(admin)/layout.tsx`
- `app/(student)/layout.tsx`

### 페이지 파일
- `app/page.tsx` (루트 페이지)
- `app/(admin)/admin/parent-links/page.tsx`
- `app/(admin)/admin/settings/scheduler/page.tsx`
- `app/(student)/scores/dashboard/mock/page.tsx`
- `app/(student)/settings/page.tsx`
- `app/(student)/today/page.tsx`
- `app/(student)/camp/today/page.tsx`
- `app/(student)/analysis/page.tsx`
- `app/(student)/camp/page.tsx`
- `app/(student)/contents/lectures/page.tsx`
- `app/(student)/contents/books/page.tsx`
- `app/(student)/contents/master-books/page.tsx`

### API 라우트
- `app/api/student-content-details/route.ts`
- `app/api/student-content-details/batch/route.ts`

## 참고사항

- `"use client"` 컴포넌트는 서버 컴포넌트가 아니므로 `export const dynamic`이 필요 없습니다.
- 인증이 필요한 모든 페이지는 동적 렌더링이 필요합니다.
- 레이아웃 파일에 `export const dynamic = 'force-dynamic'`을 설정하면 하위 페이지들도 동적 렌더링됩니다.

## 효과

이 변경으로 Next.js 빌드 시 발생하던 "Dynamic server usage" 경고가 해결되고, Supabase 서버 클라이언트 생성 실패 로그도 줄어들 것입니다.

