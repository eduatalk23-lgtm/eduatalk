# UI 컴포넌트 개선점 검토 보고서

**작성일**: 2025년 12월 17일  
**기준 문서**: `docs/ui-components-improvement-guide.md`  
**목적**: 프로젝트 전반의 컴포넌트에서 Elevation/Transition 시스템 적용 현황 검토 및 개선점 도출

---

## 📊 검토 개요

`docs/ui-components-improvement-guide.md`에 정의된 Elevation 및 Transition 시스템이 프로젝트 전반에 일관되게 적용되었는지 검토했습니다.

### 검토 범위
- ✅ **완료**: Button, Input, Card, Badge 컴포넌트
- ⚠️ **개선 필요**: Dialog, DropdownMenu, Toast, Select, BaseScoreCard 등

---

## 🔍 발견된 개선점

### 1. Shadow/Elevation 시스템 미적용

#### 1.1 Dialog 컴포넌트 (`components/ui/Dialog.tsx`)

**현재 상태**:
```tsx
// Line 116
"relative w-full rounded-lg border shadow-lg"
```

**개선 제안**:
```tsx
// Material Design 가이드: 모달은 elevation-8 또는 16 사용
"relative w-full rounded-lg border shadow-[var(--elevation-8)]"
// 또는 더 강한 그림자
"relative w-full rounded-lg border shadow-[var(--elevation-16)]"
```

**우선순위**: 🔴 **높음** (자주 사용되는 컴포넌트)

---

#### 1.2 DropdownMenu 컴포넌트 (`components/ui/DropdownMenu.tsx`)

**현재 상태**:
```tsx
// Line 253
"absolute z-50 min-w-[200px] rounded-lg border shadow-lg"
```

**개선 제안**:
```tsx
// 드롭다운은 elevation-8 권장
"absolute z-50 min-w-[200px] rounded-lg border shadow-[var(--elevation-8)]"
```

**우선순위**: 🔴 **높음** (자주 사용되는 컴포넌트)

---

#### 1.3 Toast 컴포넌트 (`components/molecules/Toast.tsx`)

**현재 상태**:
```tsx
// Line 56
"flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg transition-all duration-300"
```

**개선 제안**:
```tsx
// Toast는 elevation-8 권장
"flex items-center gap-3 rounded-lg px-4 py-3 shadow-[var(--elevation-8)] transition-slow"
```

**우선순위**: 🟡 **중간** (시각적 피드백 중요)

---

#### 1.4 BaseScoreCard 컴포넌트 (`app/(student)/scores/_components/BaseScoreCard.tsx`)

**현재 상태**:
```tsx
// Line 41
"group relative rounded-xl border shadow-sm transition-all duration-200 select-none cursor-pointer",
// Line 44
"hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-700",
```

**개선 제안**:
```tsx
// Card와 유사한 패턴으로 Elevation 시스템 적용
"group relative rounded-xl border shadow-[var(--elevation-1)] transition-base select-none cursor-pointer",
"hover:shadow-[var(--elevation-4)] hover:border-indigo-200 dark:hover:border-indigo-700",
```

**우선순위**: 🟡 **중간** (Card 컴포넌트와 일관성 유지)

---

#### 1.5 LoadingSkeleton 컴포넌트 (`components/ui/LoadingSkeleton.tsx`)

**현재 상태**:
```tsx
// Line 53, 68
"rounded-xl border p-6 shadow-sm"
"rounded-xl border shadow-sm"
```

**개선 제안**:
```tsx
// Skeleton은 elevation-1 권장
"rounded-xl border p-6 shadow-[var(--elevation-1)]"
"rounded-xl border shadow-[var(--elevation-1)]"
```

**우선순위**: 🟢 **낮음** (시각적 영향 작음)

---

#### 1.6 기타 컴포넌트

다음 컴포넌트들도 `shadow-sm`, `shadow-md`, `shadow-lg`를 직접 사용 중:

- `components/navigation/global/CategoryNav.tsx`: `shadow-lg` (tooltip)
- `components/navigation/global/navStyles.ts`: `shadow-lg` (tooltip)
- `components/ui/InstallPrompt.tsx`: `shadow-lg`
- `components/ui/SchoolSelect.tsx`: `shadow-lg`
- `components/ui/SchoolMultiSelect.tsx`: `shadow-md`, `shadow-sm`, `shadow-lg`
- `components/ui/StickySaveButton.tsx`: `shadow-lg`
- `components/layout/SkipLink.tsx`: `shadow-lg`

**우선순위**: 🟢 **낮음** (사용 빈도 낮거나 특수한 경우)

---

### 2. Transition 시스템 미적용

#### 2.1 Select 컴포넌트 (`components/atoms/Select.tsx`)

**현재 상태**:
```tsx
// Line 25
"w-full rounded-lg border bg-white transition-colors appearance-none cursor-pointer"
```

**개선 제안**:
```tsx
// Input 컴포넌트와 일관성 유지
"w-full rounded-lg border bg-white transition-base appearance-none cursor-pointer"
```

**우선순위**: 🟡 **중간** (Input과 일관성)

---

#### 2.2 DropdownMenu 컴포넌트 (`components/ui/DropdownMenu.tsx`)

**현재 상태**:
```tsx
// Line 293
"relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-4 py-2 text-sm outline-none transition-colors"
```

**개선 제안**:
```tsx
// transition-base 사용
"relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-4 py-2 text-sm outline-none transition-base"
```

**우선순위**: 🟡 **중간**

---

#### 2.3 Toast 컴포넌트 (`components/molecules/Toast.tsx`)

**현재 상태**:
```tsx
// Line 56
"flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg transition-all duration-300"
```

**개선 제안**:
```tsx
// transition-slow 사용 (300ms)
"flex items-center gap-3 rounded-lg px-4 py-3 shadow-[var(--elevation-8)] transition-slow"
```

**우선순위**: 🟡 **중간**

---

#### 2.4 BaseScoreCard 컴포넌트 (`app/(student)/scores/_components/BaseScoreCard.tsx`)

**현재 상태**:
```tsx
// Line 41
"group relative rounded-xl border shadow-sm transition-all duration-200 select-none cursor-pointer"
```

**개선 제안**:
```tsx
// transition-base 사용
"group relative rounded-xl border shadow-[var(--elevation-1)] transition-base select-none cursor-pointer"
```

**우선순위**: 🟡 **중간**

---

#### 2.5 기타 컴포넌트

다음 컴포넌트들도 `transition-colors`, `transition-opacity`, `transition-all`을 직접 사용 중:

- `components/atoms/ToggleSwitch.tsx`: `transition-all` (특수한 경우, 유지 가능)
- `components/navigation/global/CategoryNav.tsx`: `transition-opacity` (opacity 전용, 유지 가능)
- `components/molecules/Tabs.tsx`: `transition-colors` (색상 전용, 유지 가능)
- `components/atoms/ProgressBar.tsx`: `transition-all duration-300` → `transition-slow` 권장

**우선순위**: 🟢 **낮음** (특수한 경우이거나 영향 작음)

---

## 📋 우선순위별 개선 계획

### Phase 1: 핵심 컴포넌트 (1주)

**목표**: 가장 많이 사용되는 컴포넌트 개선

1. **Dialog 컴포넌트**
   - [ ] `shadow-lg` → `shadow-[var(--elevation-8)]` 또는 `shadow-[var(--elevation-16)]`
   - [ ] Elevation prop 추가 (선택적)

2. **DropdownMenu 컴포넌트**
   - [ ] `shadow-lg` → `shadow-[var(--elevation-8)]`
   - [ ] `transition-colors` → `transition-base`

### Phase 2: 시각적 피드백 강화 (1주)

**목표**: 사용자 경험 개선

1. **Toast 컴포넌트**
   - [ ] `shadow-lg` → `shadow-[var(--elevation-8)]`
   - [ ] `transition-all duration-300` → `transition-slow`

2. **Select 컴포넌트**
   - [ ] `transition-colors` → `transition-base`

3. **BaseScoreCard 컴포넌트**
   - [ ] `shadow-sm` → `shadow-[var(--elevation-1)]`
   - [ ] `shadow-md` → `shadow-[var(--elevation-4)]`
   - [ ] `transition-all duration-200` → `transition-base`

### Phase 3: 일관성 개선 (1주)

**목표**: 프로젝트 전반의 일관성 확보

1. **LoadingSkeleton 컴포넌트**
   - [ ] `shadow-sm` → `shadow-[var(--elevation-1)]`

2. **기타 컴포넌트**
   - [ ] Tooltip, InstallPrompt 등 특수한 경우 검토

---

## 🎯 개선 가이드라인

### Elevation 레벨 선택 가이드

| 컴포넌트 타입 | 권장 Elevation | 예시 |
|------------|--------------|------|
| 카드, 버튼 (기본) | 1-2 | Card, Button |
| 호버 상태 | 4 | Card hover, Button hover |
| 드롭다운, Toast | 8 | DropdownMenu, Toast |
| 모달, 다이얼로그 | 8-16 | Dialog |
| 최상위 레이어 | 16-24 | 팝오버, 드로어 |

### Transition 선택 가이드

| 상황 | 권장 Transition | 예시 |
|------|---------------|------|
| 표준 인터랙션 | `transition-base` (150ms) | Button, Input, Select |
| 빠른 피드백 | `transition-fast` (100ms) | 버튼 클릭 (선택적) |
| 부드러운 전환 | `transition-slow` (300ms) | Toast, Modal |

### 예외 사항

다음 경우는 표준 시스템을 따르지 않아도 됩니다:

1. **Opacity 전용**: `transition-opacity` 유지 (예: CategoryNav tooltip)
2. **색상 전용**: `transition-colors` 유지 (예: Tabs)
3. **복잡한 애니메이션**: `transition-all` 유지 (예: ToggleSwitch)

---

## 📊 개선 전후 비교

### Dialog 컴포넌트

**Before**:
```tsx
"relative w-full rounded-lg border shadow-lg"
```

**After**:
```tsx
"relative w-full rounded-lg border shadow-[var(--elevation-8)]"
// 또는 prop으로 조절 가능하게
elevation?: 8 | 16;
```

### Toast 컴포넌트

**Before**:
```tsx
"flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg transition-all duration-300"
```

**After**:
```tsx
"flex items-center gap-3 rounded-lg px-4 py-3 shadow-[var(--elevation-8)] transition-slow"
```

### Select 컴포넌트

**Before**:
```tsx
"w-full rounded-lg border bg-white transition-colors appearance-none cursor-pointer"
```

**After**:
```tsx
"w-full rounded-lg border bg-white transition-base appearance-none cursor-pointer"
```

---

## ✅ 체크리스트

### Phase 1: 핵심 컴포넌트
- [ ] Dialog 컴포넌트 Elevation 적용
- [ ] DropdownMenu 컴포넌트 Elevation 및 Transition 적용

### Phase 2: 시각적 피드백
- [ ] Toast 컴포넌트 Elevation 및 Transition 적용
- [ ] Select 컴포넌트 Transition 적용
- [ ] BaseScoreCard 컴포넌트 Elevation 및 Transition 적용

### Phase 3: 일관성 개선
- [ ] LoadingSkeleton 컴포넌트 Elevation 적용
- [ ] 기타 컴포넌트 검토 및 개선

---

## 🔗 참고 자료

- [UI 컴포넌트 개선 가이드](./ui-components-improvement-guide.md)
- [Material Design Elevation](https://m3.material.io/styles/elevation/overview)
- [Tailwind CSS Shadow Docs](https://tailwindcss.com/docs/box-shadow)

---

**작성자**: AI Assistant  
**최종 업데이트**: 2025년 12월 17일

