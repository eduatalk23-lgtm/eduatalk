# Student Error.tsx React Client Manifest 에러 수정

## 📋 작업 개요

**날짜**: 2025-12-21  
**이슈**: Next.js 16에서 `app/(student)/error.tsx` 파일이 React Client Manifest에서 찾을 수 없다는 에러 발생

## 🔍 문제 분석

### 에러 메시지
```
⨯ Error: Could not find the module "[project]/app/(student)/error.tsx#default" in the React Client Manifest. 
This is probably a bug in the React Server Components bundler.
```

### 원인
1. **중복 컨테이너 스타일링**: `app/(student)/error.tsx`에서 `getContainerClass`를 사용하여 추가 래퍼를 생성
2. **ErrorPage 컴포넌트와의 충돌**: `ErrorPage` 컴포넌트가 이미 컨테이너 스타일링을 포함하고 있음 (`mx-auto max-w-6xl px-4 py-10`)
3. **다른 error.tsx와의 불일치**: `app/(admin)/error.tsx`와 `app/(parent)/error.tsx`는 단순한 구조인데, student 버전만 복잡한 구조

## ✅ 해결 방법

### 변경 사항

**이전 코드** (`app/(student)/error.tsx`):
```tsx
"use client";

import ErrorPage from "@/components/errors/ErrorPage";
import { getContainerClass } from "@/lib/constants/layout";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  return (
    <div className={getContainerClass("DASHBOARD", "lg")}>
      <ErrorPage error={error} reset={reset} role="student" />
    </div>
  );
}
```

**수정 후 코드**:
```tsx
"use client";

import ErrorPage from "@/components/errors/ErrorPage";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: ErrorProps) {
  return <ErrorPage error={error} reset={reset} role="student" />;
}
```

### 주요 변경점
1. ✅ `getContainerClass` import 제거
2. ✅ 불필요한 래퍼 `<div>` 제거
3. ✅ `interface`를 `type`으로 변경 (다른 error.tsx와 일관성)
4. ✅ 구조를 다른 error.tsx 파일들과 동일하게 단순화

## 📊 비교

### 다른 error.tsx 파일들

**app/(admin)/error.tsx**:
```tsx
"use client";

import ErrorPage from "@/components/errors/ErrorPage";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: ErrorProps) {
  return <ErrorPage error={error} reset={reset} role="admin" />;
}
```

**app/(parent)/error.tsx**:
```tsx
"use client";

import ErrorPage from "@/components/errors/ErrorPage";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorPage error={error} reset={reset} role="parent" />;
}
```

이제 세 파일 모두 동일한 패턴을 따릅니다.

## 🎯 결과

- ✅ Next.js 16 React Client Manifest 에러 해결
- ✅ 코드 일관성 향상 (모든 error.tsx 파일이 동일한 구조)
- ✅ 불필요한 중복 스타일링 제거
- ✅ `ErrorPage` 컴포넌트의 기본 스타일링 활용

## 📝 참고 사항

### ErrorPage 컴포넌트의 기본 스타일링
`components/errors/ErrorPage.tsx`는 이미 다음과 같은 컨테이너 스타일을 포함하고 있습니다:
```tsx
<div className="mx-auto max-w-6xl px-4 py-10">
  {/* ErrorState 컴포넌트 */}
</div>
```

따라서 error.tsx 파일에서는 추가 래퍼가 필요하지 않습니다.

## 🔗 관련 파일

- `app/(student)/error.tsx` - 수정된 파일
- `app/(admin)/error.tsx` - 참고 파일
- `app/(parent)/error.tsx` - 참고 파일
- `components/errors/ErrorPage.tsx` - 공통 에러 페이지 컴포넌트


