# 주요 컴포넌트 타이포그래피 시스템 적용

**작업 일시**: 2025-01-XX  
**목적**: Dialog, ErrorState, FormMessage 컴포넌트에 타이포그래피 시스템 적용

---

## 📋 작업 개요

주요 UI 컴포넌트에 타이포그래피 시스템을 적용하여 일관된 텍스트 스타일을 확보했습니다.

---

## ✅ 개선된 컴포넌트

### 1. Dialog 컴포넌트

#### 변경 사항

**Before**:
```tsx
<h2 className={cn("text-lg font-semibold", ...)}>
  {title}
</h2>
<div className={cn("text-sm", textSecondaryVar)}>
  {description}
</div>
```

**After**:
```tsx
<h2 className={cn("text-h2", ...)}>
  {title}
</h2>
<div className={cn("text-body-2", textSecondaryVar)}>
  {description}
</div>
```

**변경 내용**:
- 제목: `text-lg font-semibold` → `text-h2` (32px, font-700)
- 설명: `text-sm` → `text-body-2` (17px)

**이유**:
- Dialog 제목은 섹션 제목 수준이므로 `text-h2` 사용
- 설명은 본문 텍스트이므로 `text-body-2` 사용
- 타이포그래피 시스템에 이미 font-weight가 포함되어 `font-semibold` 제거

---

### 2. ErrorState 컴포넌트

#### 변경 사항

**Before**:
```tsx
<h3 className="text-lg font-semibold text-error-900 dark:text-error-100">
  {title}
</h3>
<p className="text-sm text-error-700 dark:text-error-300">
  {displayMessage}
</p>
```

**After**:
```tsx
<h3 className="text-body-1 text-error-900 dark:text-error-100">
  {title}
</h3>
<p className="text-body-2 text-error-700 dark:text-error-300">
  {displayMessage}
</p>
```

**변경 내용**:
- 제목: `text-lg font-semibold` → `text-body-1` (19px)
- 메시지: `text-sm` → `text-body-2` (17px)

**이유**:
- ErrorState는 에러 상황을 표시하는 컴포넌트로, 너무 큰 제목보다는 본문 크기가 적절
- `text-body-1`은 본문보다 약간 큰 크기로 가독성과 시각적 계층 구조 유지
- 타이포그래피 시스템에 이미 font-weight가 포함되어 `font-semibold` 제거

---

### 3. FormMessage 컴포넌트

#### 변경 사항

**Before**:
```tsx
<p className={cn("rounded px-3 py-2 text-sm", styles[type], className)}>
  {message}
</p>
```

**After**:
```tsx
<p className={cn("rounded px-3 py-2 text-body-2", styles[type], className)}>
  {message}
</p>
```

**변경 내용**:
- 메시지: `text-sm` → `text-body-2` (17px)

**이유**:
- FormMessage는 폼 메시지를 표시하는 컴포넌트로 본문 텍스트 크기인 `text-body-2` 사용

---

## 📊 적용 결과

### Before
- ❌ 타이포그래피 시스템 미사용
- ❌ 일관성 없는 텍스트 크기
- ❌ 불필요한 `font-semibold` 사용

### After
- ✅ 타이포그래피 시스템 적용
- ✅ 일관된 텍스트 크기
- ✅ 디자인 시스템 준수

---

## 🎯 타이포그래피 매핑

| 컴포넌트 | 요소 | Before | After | 크기 |
|---------|------|--------|-------|------|
| Dialog | 제목 | `text-lg` | `text-h2` | 32px |
| Dialog | 설명 | `text-sm` | `text-body-2` | 17px |
| ErrorState | 제목 | `text-lg` | `text-body-1` | 19px |
| ErrorState | 메시지 | `text-sm` | `text-body-2` | 17px |
| FormMessage | 메시지 | `text-sm` | `text-body-2` | 17px |

---

## 📝 참고 사항

### 타이포그래피 시스템 클래스
- `text-h2`: 32px, font-700 (섹션 제목)
- `text-body-1`: 19px (큰 본문)
- `text-body-2`: 17px (기본 본문)

### Font Weight
타이포그래피 시스템은 이미 적절한 font-weight를 포함하고 있으므로:
- `font-semibold` 제거 (타이포그래피 시스템에 포함)
- `font-bold` 제거 (타이포그래피 시스템에 포함)

---

## ✅ 체크리스트

- [x] Dialog 컴포넌트 타이포그래피 적용
- [x] ErrorState 컴포넌트 타이포그래피 적용
- [x] FormMessage 컴포넌트 타이포그래피 적용
- [x] 불필요한 font-weight 클래스 제거
- [x] Lint 에러 확인

---

**작업 완료 일시**: 2025-01-XX

