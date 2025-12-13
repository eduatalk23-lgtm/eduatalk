# 디자인 시스템 타이포그래피 매핑 가이드

## 개요

이 문서는 하드코딩된 Tailwind 타이포그래피 클래스를 디자인 시스템의 표준 타이포그래피 클래스로 전환하기 위한 매핑 규칙을 정의합니다.

## 타이포그래피 시스템 구조

디자인 시스템은 `app/globals.css`에 표준 타이포그래피 클래스를 정의합니다:

### 표준 타이포그래피 클래스

```css
/* Display & Heading */
.text-display-1  /* 60px, font-700, line-height: 1.2 */
.text-display-2  /* 44px, font-700, line-height: 1.2 */
.text-h1        /* 40px, font-700, line-height: 1.3 */
.text-h2        /* 32px, font-700, line-height: 1.3 */

/* Body */
.text-body-0     /* 24px, line-height: 1.5 */
.text-body-1     /* 19px, line-height: 1.5 */
.text-body-2     /* 17px, line-height: 1.5 */
.text-body-2-bold /* 17px, font-700, line-height: 1.5 */
```

## 매핑 규칙

### 제목 (Headings)

| 하드코딩된 클래스 | 디자인 시스템 클래스 | 설명 |
|-----------------|-------------------|------|
| `text-4xl font-bold` | `text-display-1` | 가장 큰 제목 (60px) |
| `text-3xl font-bold` | `text-display-2` | 큰 제목 (44px) |
| `text-2xl font-semibold` | `text-h2` | 섹션 제목 (32px) |
| `text-2xl font-bold` | `text-h2` | 섹션 제목 (32px) |
| `text-xl font-semibold` | `text-h2` 또는 커스텀 | 중간 제목 (32px 또는 유지) |
| `text-lg font-semibold` | `text-body-2-bold` | 작은 제목 (17px, bold) |
| `text-base font-semibold` | `text-body-2-bold` | 기본 제목 (17px, bold) |

### 본문 (Body Text)

| 하드코딩된 클래스 | 디자인 시스템 클래스 | 설명 |
|-----------------|-------------------|------|
| `text-lg` | `text-body-1` | 큰 본문 (19px) |
| `text-base` | `text-body-2` | 기본 본문 (17px) |
| `text-sm` | `text-body-2` | 작은 본문 (17px, 표준 유지) |
| `text-xs` | `text-body-2` | 매우 작은 본문 (17px, 필요시 커스텀) |

### 폰트 무게

| 하드코딩된 클래스 | 디자인 시스템 클래스 | 설명 |
|-----------------|-------------------|------|
| `font-bold` | 포함됨 (`text-h1`, `text-h2`, `text-body-2-bold`) | 제목에 이미 포함 |
| `font-semibold` | 포함됨 또는 `text-body-2-bold` | 제목에 이미 포함 |
| `font-medium` | 유지 (필요시) | 일반 텍스트 강조 |
| `font-normal` | 기본값 | 명시 불필요 |

## 사용 예시

### Before (하드코딩)
```tsx
<h2 className="text-2xl font-semibold text-gray-900">섹션 제목</h2>
<h3 className="text-xl font-semibold text-gray-900">서브 제목</h3>
<p className="text-base text-gray-600">본문 텍스트</p>
<span className="text-sm text-gray-500">보조 텍스트</span>
```

### After (디자인 시스템)
```tsx
<h2 className="text-h2 text-text-primary">섹션 제목</h2>
<h3 className="text-h2 text-text-primary">서브 제목</h3>
<p className="text-body-2 text-text-secondary">본문 텍스트</p>
<span className="text-body-2 text-text-tertiary">보조 텍스트</span>
```

## SectionHeader 컴포넌트 통합

### 현재 상황

두 개의 SectionHeader 컴포넌트가 존재합니다:

1. **`components/ui/SectionHeader.tsx`**
   - `text-h1` 또는 `text-2xl font-semibold` 사용
   - Link 지원 (`actionLabel`, `actionHref`)
   - `level` prop 지원

2. **`components/molecules/SectionHeader.tsx`**
   - CSS 변수 사용 (`text-[var(--text-primary)]`)
   - `size` prop 지원 (sm, md, lg)
   - `action` prop으로 ReactNode 지원

### 통합 전략

`components/molecules/SectionHeader.tsx`를 기준으로 통합하고 다음 기능 추가:
- 타이포그래피 표준화 (`text-h1`, `text-h2` 사용)
- `actionLabel`/`actionHref` 지원 (Link 컴포넌트 사용)
- `level` prop 지원 (h1, h2)

### 통합된 SectionHeader 인터페이스

```tsx
type SectionHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  actionLabel?: string;
  actionHref?: string;
  className?: string;
  level?: "h1" | "h2";
  size?: "sm" | "md" | "lg"; // molecules 버전 호환성
};
```

## 주의사항

1. **일관성 유지**: 동일한 의미의 텍스트는 항상 동일한 타이포그래피 클래스 사용
2. **접근성**: 제목 태그(`h1`, `h2` 등)와 타이포그래피 클래스를 함께 사용
3. **반응형**: 필요시 반응형 타이포그래피 클래스 사용 고려
4. **색상과 분리**: 타이포그래피 클래스와 색상 클래스는 분리하여 사용

