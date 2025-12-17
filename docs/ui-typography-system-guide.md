# 타이포그래피 시스템 사용 가이드

**작업 일시**: 2025-01-XX  
**목적**: 프로젝트 전반에 타이포그래피 시스템을 일관되게 적용하기 위한 가이드

---

## 📋 개요

프로젝트의 타이포그래피 시스템은 `app/globals.css`에 정의되어 있으며, 일관된 텍스트 스타일을 제공합니다.

---

## 🎨 타이포그래피 클래스

### Display & Heading

```css
.text-display-1  /* 60px, font-700, line-height: 1.2 */
.text-display-2  /* 44px, font-700, line-height: 1.2 */
.text-h1         /* 40px, font-700, line-height: 1.3 */
.text-h2         /* 32px, font-700, line-height: 1.3 */
```

### Body Text

```css
.text-body-0        /* 24px, line-height: 1.5 */
.text-body-1        /* 19px, line-height: 1.5 */
.text-body-2        /* 17px, line-height: 1.5 */
.text-body-2-bold   /* 17px, font-700, line-height: 1.5 */
```

---

## 📝 사용 가이드

### ✅ 권장 사용법

#### 1. 페이지 제목 (Page Header)

```tsx
// ✅ 좋은 예
<h1 className="text-h1 text-text-primary">페이지 제목</h1>

// ❌ 나쁜 예
<h1 className="text-3xl font-bold text-gray-900">페이지 제목</h1>
```

#### 2. 섹션 제목 (Section Header)

```tsx
// ✅ 좋은 예
<h2 className="text-h2 text-text-primary">섹션 제목</h2>

// ❌ 나쁜 예
<h2 className="text-2xl font-semibold text-gray-800">섹션 제목</h2>
```

#### 3. 본문 텍스트

```tsx
// ✅ 좋은 예
<p className="text-body-2 text-text-secondary">본문 내용입니다.</p>

// ❌ 나쁜 예
<p className="text-base text-gray-600">본문 내용입니다.</p>
```

#### 4. 강조 텍스트

```tsx
// ✅ 좋은 예
<p className="text-body-2-bold text-text-primary">강조할 텍스트</p>

// ❌ 나쁜 예
<p className="text-base font-bold text-gray-900">강조할 텍스트</p>
```

---

## 🔄 마이그레이션 가이드

### 기존 Tailwind 클래스 → 타이포그래피 시스템

| 기존 클래스 | 타이포그래피 시스템 | 용도 |
|-----------|------------------|------|
| `text-xs` | `text-body-2` | 작은 텍스트 (17px) |
| `text-sm` | `text-body-2` | 작은 텍스트 (17px) |
| `text-base` | `text-body-2` | 기본 텍스트 (17px) |
| `text-lg` | `text-body-1` | 큰 본문 (19px) |
| `text-xl` | `text-h2` | 작은 제목 (32px) |
| `text-2xl` | `text-h2` | 섹션 제목 (32px) |
| `text-3xl` | `text-h1` | 큰 제목 (40px) |
| `text-4xl` | `text-display-2` | 매우 큰 제목 (44px) |
| `text-5xl` | `text-display-1` | 최대 제목 (60px) |

### Font Weight

타이포그래피 시스템은 이미 적절한 font-weight를 포함하고 있습니다:

- Display & Heading: `font-700` (자동 적용)
- Body: 기본 weight (400)
- Body Bold: `font-700` (`.text-body-2-bold`)

따라서 별도로 `font-bold`, `font-semibold` 등을 추가할 필요가 없습니다.

---

## 📦 컴포넌트 적용 예시

### SectionHeader 컴포넌트

```tsx
const sizeClasses = {
  sm: {
    title: "text-body-2-bold",
    description: "text-body-2",
  },
  md: {
    title: "text-h2",
    description: "text-body-2",
  },
  lg: {
    title: "text-h1",
    description: "text-body-1",
  },
};
```

### Card 컴포넌트

```tsx
<h3 className="text-h2 text-text-primary">{title}</h3>
<p className="text-body-2 text-text-secondary">{description}</p>
```

### EmptyState 컴포넌트

```tsx
<HeadingTag className={cn(
  textPrimaryVar,
  isCompact ? "text-body-2-bold" : "text-body-1"
)}>
  {title}
</HeadingTag>
```

---

## 🎯 적용 우선순위

### Phase 1: 새로운 컴포넌트 작성 시 (즉시 적용)
- 모든 새로운 컴포넌트는 타이포그래피 시스템을 사용해야 합니다.

### Phase 2: 기존 컴포넌트 리팩토링 시 (점진적 적용)
- 컴포넌트를 수정할 때 기회가 생기면 타이포그래피 시스템으로 교체합니다.
- 한 번에 모든 컴포넌트를 수정하지 않고, 필요할 때마다 점진적으로 적용합니다.

### Phase 3: 주요 컴포넌트 우선 적용 (완료)
- ✅ `components/molecules/Card.tsx`
- ✅ `components/ui/SectionHeader.tsx`
- ✅ `components/molecules/SectionHeader.tsx`
- ✅ `components/molecules/EmptyState.tsx`

---

## ⚠️ 주의사항

### 1. 컬러 클래스와 함께 사용

타이포그래피 시스템은 크기와 weight만 정의합니다. 컬러는 별도로 지정해야 합니다:

```tsx
// ✅ 좋은 예
<h2 className="text-h2 text-text-primary">제목</h2>

// ❌ 나쁜 예 (컬러 없음)
<h2 className="text-h2">제목</h2>
```

### 2. 반응형 디자인

타이포그래피 시스템은 고정 크기를 사용합니다. 반응형이 필요한 경우:

```tsx
// ✅ 좋은 예: 반응형이 필요한 경우
<h1 className="text-h2 md:text-h1 text-text-primary">제목</h1>

// 또는 모바일 우선
<h1 className="text-body-1 md:text-h2 lg:text-h1 text-text-primary">제목</h1>
```

### 3. 접근성

시맨틱 HTML 태그를 올바르게 사용하세요:

```tsx
// ✅ 좋은 예
<h1 className="text-h1">페이지 제목</h1>
<h2 className="text-h2">섹션 제목</h2>
<p className="text-body-2">본문</p>

// ❌ 나쁜 예
<div className="text-h1">페이지 제목</div>
<span className="text-h2">섹션 제목</span>
```

---

## 🔍 체크리스트

새 컴포넌트를 작성하거나 기존 컴포넌트를 수정할 때:

- [ ] 타이포그래피 시스템 클래스를 사용했는가?
- [ ] 적절한 컬러 클래스(`text-text-primary`, `text-text-secondary` 등)를 사용했는가?
- [ ] 시맨틱 HTML 태그(`h1`, `h2`, `p` 등)를 올바르게 사용했는가?
- [ ] 불필요한 `font-bold`, `font-semibold` 등을 추가하지 않았는가?

---

## 📚 참고 자료

- 타이포그래피 시스템 정의: `app/globals.css` (Line 357-401)
- 디자인 시스템 컬러: `app/globals.css` (Line 21-230)
- 적용 예시: `components/molecules/Card.tsx`, `components/ui/SectionHeader.tsx`

---

**마지막 업데이트**: 2025-01-XX

