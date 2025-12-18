# 다크 모드 사용 가이드

## 개요

이 프로젝트는 CSS 변수 기반 다크 모드 시스템을 사용합니다. `next-themes`와 Tailwind CSS 4를 활용하여 일관된 테마 관리가 가능합니다.

## 기본 원칙

### ✅ CSS 변수 기반 유틸리티 우선 사용

**새로운 코드에서는 항상 CSS 변수 기반 유틸리티를 사용하세요.**

```tsx
// ✅ 좋은 예: CSS 변수 기반
import { textPrimaryVar, bgSurfaceVar, borderDefaultVar } from "@/lib/utils/darkMode";

<div className={cn(bgSurfaceVar, borderDefaultVar)}>
  <h1 className={textPrimaryVar}>제목</h1>
</div>
```

### ❌ Deprecated 함수 사용 금지

**다음 함수들은 더 이상 사용하지 마세요:**

```tsx
// ❌ 나쁜 예: Deprecated 함수
import { bgSurface, textPrimary, borderDefault } from "@/lib/utils/darkMode";

<div className={bgSurface}>
  <h1 className={textPrimary}>제목</h1>
</div>
```

## 사용 가능한 CSS 변수 기반 유틸리티

### 텍스트 색상

```tsx
import {
  textPrimaryVar,      // 기본 텍스트 색상
  textSecondaryVar,    // 보조 텍스트 색상
  textTertiaryVar,     // 3차 텍스트 색상
  textPlaceholderVar,  // 플레이스홀더 색상
  textDisabledVar,     // 비활성화 텍스트 색상
  textMutedVar,        // 음소거 텍스트 색상 (textTertiaryVar와 동일)
  textForegroundVar,   // 전경 텍스트 색상
} from "@/lib/utils/darkMode";
```

### 배경색

```tsx
import {
  bgSurfaceVar,        // 표면 배경색
  bgPageVar,           // 페이지 배경색 (bgSurfaceVar와 동일)
  bgHoverVar,          // Hover 배경색 (약한 강도)
  bgHoverStrongVar,    // Hover 배경색 (강한 강도)
} from "@/lib/utils/darkMode";
```

### 테두리 및 구분선

```tsx
import {
  borderDefaultVar,    // 기본 테두리 색상
  borderInputVar,       // 입력 필드 테두리 색상
  divideDefaultVar,     // 기본 구분선 색상
} from "@/lib/utils/darkMode";
```

### 인라인 버튼 스타일 (컴포넌트를 사용할 수 없는 경우)

```tsx
import {
  inlineButtonPrimary,    // Primary 버튼 스타일
  inlineButtonSecondary,  // Secondary 버튼 스타일
  inlineButtonOutline,    // Outline 버튼 스타일
} from "@/lib/utils/darkMode";

// Button 컴포넌트를 사용할 수 없는 경우에만 사용
<button className={inlineButtonPrimary()}>저장</button>
<button className={inlineButtonOutline()}>취소</button>
```

### 메시지 스타일

```tsx
import {
  warningMessageStyles,  // 경고 메시지 스타일 객체
  errorMessageStyles,    // 에러 메시지 스타일 객체
  infoMessageStyles,     // 정보 메시지 스타일 객체
} from "@/lib/utils/darkMode";

// 사용 예시
<div className={warningMessageStyles.container}>
  <h3 className={warningMessageStyles.title}>주의</h3>
  <p className={warningMessageStyles.text}>경고 메시지 내용</p>
</div>
```

### 입력 필드 기본 스타일 (Input 컴포넌트를 사용할 수 없는 경우)

```tsx
import { inputBaseStyle } from "@/lib/utils/darkMode";

// Input 컴포넌트를 사용할 수 없는 경우에만 사용
<input type="text" className={inputBaseStyle()} />
```

## 사용 예시

### 기본 카드 컴포넌트

```tsx
import { cn } from "@/lib/cn";
import { bgSurfaceVar, borderDefaultVar, textPrimaryVar } from "@/lib/utils/darkMode";

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn(
      "rounded-xl border p-6 shadow-sm",
      bgSurfaceVar,
      borderDefaultVar
    )}>
      <h2 className={cn("text-lg font-semibold", textPrimaryVar)}>
        {children}
      </h2>
    </div>
  );
}
```

### 입력 필드

```tsx
import { cn } from "@/lib/cn";
import { bgSurfaceVar, textPrimaryVar, textPlaceholderVar, borderInputVar } from "@/lib/utils/darkMode";

export function Input({ ...props }) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border px-3 py-2",
        bgSurfaceVar,
        textPrimaryVar,
        `placeholder:${textPlaceholderVar}`,
        borderInputVar
      )}
      {...props}
    />
  );
}
```

### Hover 효과가 있는 버튼

```tsx
import { cn } from "@/lib/cn";
import { bgSurfaceVar, bgHoverVar, textPrimaryVar, borderDefaultVar } from "@/lib/utils/darkMode";

export function Button({ children }: { children: React.ReactNode }) {
  return (
    <button
      className={cn(
        "rounded-lg border px-4 py-2 transition-colors",
        bgSurfaceVar,
        borderDefaultVar,
        textPrimaryVar,
        bgHoverVar
      )}
    >
      {children}
    </button>
  );
}
```

## 마이그레이션 가이드

### 기존 코드를 CSS 변수 기반으로 변경

**이전 코드:**
```tsx
import { bgSurface, textPrimary, borderDefault } from "@/lib/utils/darkMode";

<div className={cn(bgSurface, borderDefault)}>
  <h1 className={textPrimary}>제목</h1>
</div>
```

**변경 후:**
```tsx
import { bgSurfaceVar, textPrimaryVar, borderDefaultVar } from "@/lib/utils/darkMode";

<div className={cn(bgSurfaceVar, borderDefaultVar)}>
  <h1 className={textPrimaryVar}>제목</h1>
</div>
```

### 하드코딩된 색상 클래스를 CSS 변수로 변경

**이전 코드:**
```tsx
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-700">
  내용
</div>
```

**변경 후:**
```tsx
import { bgSurfaceVar, textPrimaryVar, borderDefaultVar } from "@/lib/utils/darkMode";

<div className={cn(bgSurfaceVar, textPrimaryVar, borderDefaultVar)}>
  내용
</div>
```

## 주의사항

### 1. CSS 변수는 자동으로 다크 모드에 대응

CSS 변수 기반 유틸리티는 `dark:` 클래스가 필요 없습니다. CSS 변수가 자동으로 다크 모드에 대응합니다.

```tsx
// ✅ 올바른 사용
<div className={bgSurfaceVar}>내용</div>

// ❌ 불필요한 dark: 클래스 사용
<div className={cn(bgSurfaceVar, "dark:bg-gray-800")}>내용</div>
```

### 2. Hover는 예외적으로 dark: 클래스 필요

Hover 상태는 CSS 변수만으로는 처리하기 어려우므로, hover 유틸리티는 내부적으로 `dark:` 클래스를 사용합니다.

```tsx
// ✅ 올바른 사용
import { bgHoverVar } from "@/lib/utils/darkMode";
<div className={cn(bgSurfaceVar, bgHoverVar)}>내용</div>
```

### 3. 특수 색상은 여전히 Tailwind 클래스 사용

Primary, Success, Error 등 특수 색상은 CSS 변수 기반 유틸리티가 제공되지 않으므로, 필요시 Tailwind 클래스를 직접 사용할 수 있습니다.

```tsx
// Primary 색상은 CSS 변수 기반 유틸리티가 없으므로 Tailwind 클래스 사용
<button className="bg-indigo-600 dark:bg-indigo-500 text-white">
  버튼
</button>
```

## 참고 자료

- [next-themes 문서](https://github.com/pacocoursey/next-themes)
- [Tailwind CSS 4 다크 모드](https://tailwindcss.com/docs/dark-mode)
- `lib/utils/darkMode.ts` - 모든 유틸리티 함수 정의
