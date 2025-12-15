# 다크 모드 유틸리티 함수 사용 가이드

## 개요

이 가이드는 프로젝트 전반에서 다크 모드 색상 클래스를 일관되게 관리하기 위한 유틸리티 함수 사용 방법을 설명합니다.

## 핵심 원칙

1. **하드코딩된 색상 클래스 사용 금지**: `bg-white`, `text-gray-900`, `border-gray-200` 등의 하드코딩된 클래스는 사용하지 않습니다.
2. **유틸리티 함수 사용**: 모든 색상 클래스는 `lib/utils/darkMode.ts`에서 제공하는 유틸리티 함수를 사용합니다.
3. **CSS 변수 활용**: 필요시 CSS 변수 기반 유틸리티를 사용할 수 있습니다.

## 기본 사용법

### Import 패턴

```typescript
// ✅ 좋은 예: 필요한 것만 import
import { textPrimary, bgSurface, borderDefault } from "@/lib/utils/darkMode";

// ❌ 나쁜 예: 전체 import
import * as darkMode from "@/lib/utils/darkMode";
```

### 기본 색상 유틸리티

#### 배경색

```tsx
import { bgSurface, bgPage, bgHover } from "@/lib/utils/darkMode";

// 카드/컨테이너 배경
<div className={bgSurface}>내용</div>

// 페이지 배경
<div className={bgPage}>내용</div>

// 호버 배경
<div className={bgHover}>내용</div>
```

#### 텍스트 색상

```tsx
import { textPrimary, textSecondary, textTertiary, textMuted } from "@/lib/utils/darkMode";

<h1 className={textPrimary}>제목</h1>
<p className={textSecondary}>부제목</p>
<span className={textTertiary}>보조 텍스트</span>
<span className={textMuted}>비활성 텍스트</span>
```

#### 테두리

```tsx
import { borderDefault, borderInput, divideDefault } from "@/lib/utils/darkMode";

<div className={cn("rounded-lg border", borderDefault)}>내용</div>
<input className={cn("rounded-lg border", borderInput)} />
<div className={cn("divide-y", divideDefault)}>내용</div>
```

## 고급 사용법

### 카드 스타일

```tsx
import { cardStyle } from "@/lib/utils/darkMode";

// 기본 카드
<div className={cardStyle()}>내용</div>

// 호버 효과가 있는 카드
<div className={cardStyle("hover")}>내용</div>

// 인터랙티브 카드 (호버 + 커서 포인터)
<div className={cardStyle("interactive")}>내용</div>

// 패딩 크기 지정
<div className={cardStyle("default", "lg")}>내용</div>
```

### 버튼 스타일

```tsx
import { 
  inlineButtonBase, 
  inlineButtonPrimary, 
  inlineButtonDanger,
  inlineButtonSuccess 
} from "@/lib/utils/darkMode";

// 기본 버튼
<button className={inlineButtonBase()}>버튼</button>

// Primary 버튼
<button className={inlineButtonPrimary()}>저장</button>

// Danger 버튼
<button className={inlineButtonDanger()}>삭제</button>

// Success 버튼
<button className={inlineButtonSuccess()}>완료</button>
```

### 색상별 카드 (StatCard, MetricCard)

```tsx
import { 
  getStatCardColorClasses,
  getMetricCardColorClasses,
  getMetricCardValueColorClasses 
} from "@/lib/utils/darkMode";

// StatCard 색상
<div className={getStatCardColorClasses("indigo")}>통계</div>

// MetricCard 배경 + 텍스트 색상
<div className={getMetricCardColorClasses("blue")}>메트릭</div>

// MetricCard 값 텍스트 색상
<span className={getMetricCardValueColorClasses("blue")}>100</span>
```

### 그라디언트 카드

```tsx
import { getGradientCardClasses } from "@/lib/utils/darkMode";

<div className={getGradientCardClasses("indigo")}>
  그라디언트 카드
</div>
```

### 타임슬롯 색상

```tsx
import { getTimeSlotColorClasses } from "@/lib/utils/darkMode";

<div className={getTimeSlotColorClasses("학습시간")}>
  학습 시간
</div>
```

## CSS 변수 기반 유틸리티

CSS 변수를 직접 사용하는 유틸리티도 제공됩니다:

```tsx
import { 
  textPrimaryVar, 
  textSecondaryVar, 
  bgSurfaceVar 
} from "@/lib/utils/darkMode";

<div className={textPrimaryVar}>CSS 변수 기반 텍스트</div>
```

## 제네릭 함수 사용

새로운 색상 매핑이 필요한 경우 제네릭 함수를 사용할 수 있습니다:

```tsx
import { getColorClasses } from "@/lib/utils/darkMode";

const customColorMap = {
  primary: "bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200",
  secondary: "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100",
} as const;

const classes = getColorClasses("primary", customColorMap);
```

## 하드코딩된 색상 교체 가이드

### 교체 패턴 매핑

| 하드코딩 패턴 | 유틸리티 함수 | 예시 |
|--------------|--------------|------|
| `bg-white` | `bgSurface` | `className={bgSurface}` |
| `text-gray-900` | `textPrimary` | `className={textPrimary}` |
| `text-gray-700` | `textSecondary` | `className={textSecondary}` |
| `text-gray-600` | `textTertiary` | `className={textTertiary}` |
| `text-gray-500` | `textMuted` | `className={textMuted}` |
| `border-gray-200` | `borderDefault` | `className={cn("border", borderDefault)}` |
| `border-gray-300` | `borderInput` | `className={cn("border", borderInput)}` |
| `bg-gray-50` | `bgPage` 또는 `bgStyles.gray` | `className={bgPage}` |

### 교체 예시

```tsx
// ❌ 나쁜 예: 하드코딩된 색상
<div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
  <h1 className="text-gray-900 dark:text-gray-100">제목</h1>
  <p className="text-gray-700 dark:text-gray-200">내용</p>
</div>

// ✅ 좋은 예: 유틸리티 함수 사용
import { bgSurface, borderDefault, textPrimary, textSecondary } from "@/lib/utils/darkMode";
import { cn } from "@/lib/cn";

<div className={cn("border", bgSurface, borderDefault)}>
  <h1 className={textPrimary}>제목</h1>
  <p className={textSecondary}>내용</p>
</div>
```

## 네이밍 규칙

### 함수 네이밍

- **색상 관련**: `get*ColorClasses()` 패턴
  - 예: `getStatCardColorClasses()`, `getMetricCardColorClasses()`
- **스타일 관련**: `*Style()` 또는 `*Styles` 패턴
  - 예: `cardStyle()`, `tableRowStyles()`
- **상수**: `*Var` (CSS 변수), `*Base` (기본 스타일)
  - 예: `textPrimaryVar`, `cardBase`

### 타입 네이밍

- 색상 타입: `*Color` (예: `StatCardColor`, `MetricCardColor`)
- Variant 타입: `*Variant` (예: `CardVariant`, `TableRowVariant`)

## 주의사항

1. **cn() 유틸리티 사용**: 여러 클래스를 결합할 때는 `cn()` 함수를 사용합니다.
2. **타입 안전성**: 모든 유틸리티 함수는 타입 안전하게 설계되어 있습니다.
3. **성능**: 상수 객체로 변환된 함수들은 런타임 오버헤드가 없습니다.

## 참고 자료

- `lib/utils/darkMode.ts`: 모든 유틸리티 함수 정의
- `app/globals.css`: CSS 변수 정의
- `lib/providers/ThemeProvider.tsx`: 테마 프로바이더 설정

