# 자주 사용되는 컴포넌트 타이포그래피 시스템 적용

**작성 일시**: 2025-01-XX  
**목적**: 자주 사용되는 공통 컴포넌트에 타이포그래피 시스템 적용

---

## 📋 작업 개요

프로젝트 전반에서 자주 사용되는 공통 컴포넌트 4개에 타이포그래피 시스템을 적용하여 일관된 텍스트 스타일을 확보했습니다.

---

## ✅ 변경 사항

### 1. Toast 컴포넌트 (`components/molecules/Toast.tsx`)

#### 메시지 텍스트
- **변경 전**: `text-sm` (14px)
- **변경 후**: `text-body-2` (17px)

```typescript
// 변경 전
<p className="text-sm font-medium">{message}</p>

// 변경 후
<p className="text-body-2 font-medium">{message}</p>
```

**설명**:
- 토스트 알림 메시지의 가독성 향상
- 프로젝트 전반에서 사용되는 알림 컴포넌트이므로 일관성 확보 중요

---

### 2. DropdownMenu 컴포넌트 (`components/ui/DropdownMenu.tsx`)

#### 메뉴 아이템 텍스트
- **변경 전**: `text-sm` (14px)
- **변경 후**: `text-body-2` (17px)

```typescript
// 변경 전
"relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-4 py-2 text-sm outline-none transition-base",

// 변경 후
"relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-4 py-2 text-body-2 outline-none transition-base",
```

**설명**:
- 드롭다운 메뉴 아이템의 텍스트 크기 표준화
- 네비게이션 및 액션 메뉴에서 자주 사용되는 컴포넌트

---

### 3. Badge 컴포넌트 (`components/atoms/Badge.tsx`)

#### sizeClasses 업데이트
- **변경 전**:
  - `xs`: `text-xs` (12px)
  - `sm`: `text-xs` (12px)
  - `md`: `text-sm` (14px)
  - `lg`: `text-sm` (14px)
- **변경 후**:
  - `xs`: `text-body-2` (17px)
  - `sm`: `text-body-2` (17px)
  - `md`: `text-body-2` (17px)
  - `lg`: `text-body-2` (17px)

```typescript
// 변경 전
size: {
  xs: "px-1.5 py-0.5 text-xs",
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-sm",
  lg: "px-3 py-1.5 text-sm",
},

// 변경 후
size: {
  xs: "px-1.5 py-0.5 text-body-2",
  sm: "px-2 py-0.5 text-body-2",
  md: "px-2.5 py-1 text-body-2",
  lg: "px-3 py-1.5 text-body-2",
},
```

**설명**:
- 모든 Badge 크기에서 동일한 텍스트 크기 사용
- 패딩으로 크기 차이 표현 (텍스트 크기로는 구분하지 않음)
- 가독성 향상 및 일관성 확보

---

### 4. Label 컴포넌트 (`components/atoms/Label.tsx`)

#### 라벨 텍스트
- **변경 전**: `text-sm` (14px)
- **변경 후**: `text-body-2` (17px)

```typescript
// 변경 전
"inline-flex items-center gap-1 text-sm font-medium text-[var(--text-primary)]",

// 변경 후
"inline-flex items-center gap-1 text-body-2 font-medium text-[var(--text-primary)]",
```

**설명**:
- 폼 라벨의 표준 텍스트 크기
- FormField와 함께 사용되는 기본 컴포넌트이므로 일관성 중요

---

## 🎯 개선 효과

### 1. 일관성 확보
- 모든 공통 컴포넌트가 동일한 타이포그래피 시스템 사용
- 프로젝트 전반에서 일관된 텍스트 크기

### 2. 가독성 향상
- 작은 텍스트 크기 개선 (12px/14px → 17px)
- 특히 Badge와 Toast 같은 작은 컴포넌트에서 가독성 향상

### 3. 디자인 시스템 준수
- 하드코딩된 텍스트 크기 제거
- 의미 있는 타이포그래피 클래스 사용

### 4. 유지보수성 향상
- 타이포그래피 변경 시 `globals.css`만 수정하면 전체 적용
- 컴포넌트별 개별 수정 불필요

---

## 📊 영향 범위

### 직접 영향
- **Toast**: 모든 토스트 알림 메시지 스타일 변경
- **DropdownMenu**: 모든 드롭다운 메뉴 아이템 텍스트 크기 변경
- **Badge**: 모든 배지 컴포넌트 텍스트 크기 변경
- **Label**: 모든 폼 라벨 텍스트 크기 변경

### 사용 위치
- 토스트 알림이 표시되는 모든 페이지
- 드롭다운 메뉴가 사용되는 모든 페이지
- 배지가 표시되는 모든 컴포넌트
- 폼이 사용되는 모든 페이지

---

## ✅ 검증 사항

### 1. 타입 안전성
- ✅ TypeScript 타입 에러 없음
- ✅ 모든 props 타입 정상 작동
- ✅ CVA variants 정상 작동 (Badge)

### 2. 스타일 일관성
- ✅ Toast: `text-body-2` 적용
- ✅ DropdownMenu: `text-body-2` 적용
- ✅ Badge: 모든 size에서 `text-body-2` 적용
- ✅ Label: `text-body-2` 적용

### 3. 접근성
- ✅ Toast: `role="status"`, `aria-live` 유지
- ✅ DropdownMenu: 키보드 네비게이션 정상 작동
- ✅ Label: `htmlFor` 연결 유지

---

## 📝 참고 사항

### 타이포그래피 시스템 클래스
- `text-body-2`: 17px (기본 본문 텍스트)
- `text-body-2-bold`: 17px, font-weight: 700 (강조 텍스트)

### 기존 텍스트 크기 매핑
- `text-xs` (12px) → `text-body-2` (17px)
- `text-sm` (14px) → `text-body-2` (17px)

### Badge 크기 전략
- 텍스트 크기는 모든 size에서 동일하게 `text-body-2` 사용
- 패딩(`px`, `py`)으로 크기 차이 표현
- 시각적 크기 차이는 유지하면서 가독성 향상

---

## 🔄 다음 단계

### 완료된 작업
- ✅ Toast 컴포넌트 타이포그래피 적용
- ✅ DropdownMenu 컴포넌트 타이포그래피 적용
- ✅ Badge 컴포넌트 타이포그래피 적용
- ✅ Label 컴포넌트 타이포그래피 적용

### 향후 작업
- 우선순위 낮은 컴포넌트 점진적 적용
- 새로운 컴포넌트 작성 시 필수 적용

---

**작성 일시**: 2025-01-XX

