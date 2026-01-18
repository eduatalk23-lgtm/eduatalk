# Phase 1: 공통 컴포넌트 개선 설계 문서

**작성일**: 2025년 12월 17일  
**목표**: 자주 재사용되는 공통 카드 컴포넌트에 Elevation/Transition 시스템 적용

---

## 📋 개선 대상 컴포넌트

### 1. ContentCard 컴포넌트

**파일 위치**:
- `app/(student)/contents/_components/ContentCard.tsx` (메인)
- `app/(student)/plan/new-group/_components/_features/content-selection/components/ContentCard.tsx` (위저드용)

**현재 상태**:
- `shadow-sm` 직접 사용
- Transition 없음 (메인) / `transition-all` 사용 (위저드용)

**개선 사항**:
- `shadow-sm` → `shadow-[var(--elevation-1)]`
- `transition-all` → `transition-base` (위저드용)
- Hover 효과 추가 (선택적)

---

### 2. PlanCard 컴포넌트

**파일 위치**:
- `app/(student)/plan/_shared/PlanCard.tsx` (공유 컴포넌트)
- `app/(student)/today/_components/PlanCard.tsx` (오늘 페이지용)

**현재 상태**:
- `shadow-sm`, `shadow-md`, `shadow-lg` 직접 사용
- `transition-all duration-200` 사용

**개선 사항**:
- `shadow-sm` → `shadow-[var(--elevation-1)]`
- `shadow-md` → `shadow-[var(--elevation-4)]` (selected 상태)
- `shadow-lg` → `shadow-[var(--elevation-8)]` (hover)
- `transition-all duration-200` → `transition-base`

---

### 3. ScoreCard 컴포넌트

**파일 위치**:
- `app/(student)/scores/_components/ScoreCard.tsx`

**현재 상태**:
- BaseScoreCard를 사용 (이미 개선 완료)
- 내부 등급 배지에 `shadow-sm` 사용

**개선 사항**:
- 등급 배지: `shadow-sm` → `shadow-[var(--elevation-1)]`

---

## 🎯 개선 전략

### Elevation 레벨 매핑

| 컴포넌트 상태 | 현재 | 개선 후 |
|------------|------|--------|
| 기본 카드 | `shadow-sm` | `elevation-1` |
| 선택된 카드 | `shadow-md` | `elevation-4` |
| Hover 상태 | `shadow-lg` | `elevation-8` |
| 배지/작은 요소 | `shadow-sm` | `elevation-1` |

### Transition 매핑

| 현재 | 개선 후 |
|------|--------|
| `transition-all duration-200` | `transition-base` |
| `transition-all` (duration 없음) | `transition-base` |
| `transition-colors` | `transition-base` (또는 유지 - 색상 전용인 경우) |

---

## 📝 구현 계획

### Step 1: ContentCard 개선

**파일**: `app/(student)/contents/_components/ContentCard.tsx`

**변경 사항**:
```tsx
// Before
<li className={`rounded-lg border bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 ${isSelected ? "ring-2 ring-indigo-500" : ""}`}>

// After
<li className={cn(
  "rounded-lg border bg-white p-4 shadow-[var(--elevation-1)] transition-base dark:border-gray-700 dark:bg-gray-800",
  isSelected && "ring-2 ring-indigo-500 shadow-[var(--elevation-4)]"
)}>
```

**파일**: `app/(student)/plan/new-group/_components/_features/content-selection/components/ContentCard.tsx`

**변경 사항**:
```tsx
// Before
"flex flex-col gap-3 rounded-lg border p-4 transition-all",

// After
"flex flex-col gap-3 rounded-lg border p-4 shadow-[var(--elevation-1)] transition-base",
// selected 상태에 elevation 추가
selected && "shadow-[var(--elevation-4)]"
```

---

### Step 2: PlanCard 개선

**파일**: `app/(student)/plan/_shared/PlanCard.tsx`

**변경 사항**:
```tsx
// Before
const baseClasses = cn(
  "rounded-xl border p-4 shadow-sm transition-all duration-200",
  isSelected
    ? "border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-200"
    : cn(borderDefault, "hover:border-gray-300 hover:shadow-lg hover:-translate-y-0.5"),
);

// After
const baseClasses = cn(
  "rounded-xl border p-4 shadow-[var(--elevation-1)] transition-base",
  isSelected
    ? "border-blue-500 bg-blue-50 shadow-[var(--elevation-4)] ring-2 ring-blue-200"
    : cn(borderDefault, "hover:border-gray-300 hover:shadow-[var(--elevation-8)] hover:-translate-y-0.5"),
);
```

**파일**: `app/(student)/today/_components/PlanCard.tsx`

**변경 사항**:
```tsx
// Line 373, 426, 431
// Before
"inline-flex items-center gap-2 rounded-md px-4 py-1 text-sm font-semibold shadow-sm"
"rounded-xl border p-4 shadow-sm transition hover:shadow-md sm:p-5"
"inline-flex items-center justify-center gap-2 self-center rounded-md px-3 py-1 text-xs font-semibold shadow-sm"

// After
"inline-flex items-center gap-2 rounded-md px-4 py-1 text-sm font-semibold shadow-[var(--elevation-1)]"
"rounded-xl border p-4 shadow-[var(--elevation-1)] transition-base hover:shadow-[var(--elevation-4)] sm:p-5"
"inline-flex items-center justify-center gap-2 self-center rounded-md px-3 py-1 text-xs font-semibold shadow-[var(--elevation-1)]"
```

---

### Step 3: ScoreCard 개선

**파일**: `app/(student)/scores/_components/ScoreCard.tsx`

**변경 사항**:
```tsx
// Line 34
// Before
"flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold shrink-0 shadow-sm",

// After
"flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold shrink-0 shadow-[var(--elevation-1)]",
```

---

## ✅ 체크리스트

### ContentCard
- [x] 메인 ContentCard Elevation 적용
- [x] 위저드용 ContentCard Elevation 및 Transition 적용
- [x] Hover 효과 추가

### PlanCard
- [x] 공유 PlanCard Elevation 및 Transition 적용
- [x] 오늘 페이지 PlanCard Elevation 적용
- [x] Selected/Hover 상태 Elevation 조정

### ScoreCard
- [x] 등급 배지 Elevation 적용

### 기타 공통 카드 컴포넌트
- [x] PlanGroupCard Elevation 및 Transition 적용
- [x] RecommendationCard Elevation 적용
- [x] CampInvitationCard Elevation 및 Transition 적용
- [x] CalendarPlanCard Elevation 및 Transition 적용

---

## 🎯 예상 효과

1. **일관성**: 모든 공통 카드 컴포넌트가 동일한 Elevation 시스템 사용
2. **사용자 경험**: 부드러운 transition과 명확한 시각적 피드백
3. **유지보수성**: 디자인 시스템 변경 시 한 곳에서 수정 가능

---

---

## 📊 완료 현황

### 개선된 컴포넌트 (총 7개)

1. ✅ **ContentCard** (2개 파일)
   - `app/(student)/contents/_components/ContentCard.tsx`
   - `app/(student)/plan/new-group/_components/_features/content-selection/components/ContentCard.tsx`

2. ✅ **PlanCard** (2개 파일)
   - `app/(student)/plan/_shared/PlanCard.tsx`
   - `app/(student)/today/_components/PlanCard.tsx`

3. ✅ **ScoreCard**
   - `app/(student)/scores/_components/ScoreCard.tsx`

4. ✅ **PlanGroupCard**
   - `app/(student)/today/_components/PlanGroupCard.tsx`

5. ✅ **RecommendationCard**
   - `app/(student)/dashboard/_components/RecommendationCard.tsx`

6. ✅ **CampInvitationCard**
   - `app/(student)/camp/_components/CampInvitationCard.tsx`

7. ✅ **CalendarPlanCard**
   - `app/(student)/plan/calendar/_components/CalendarPlanCard.tsx`

### 적용된 개선 사항

- **Elevation 시스템**: 모든 `shadow-sm`, `shadow-md`, `shadow-lg` → `shadow-[var(--elevation-1)]`, `shadow-[var(--elevation-2)]` 등으로 변경
- **Transition 시스템**: 모든 `transition-all duration-200` → `transition-base`로 변경
- **Hover 효과**: 일관된 Elevation 증가 (elevation-1 → elevation-4 또는 elevation-8)

---

**작성자**: AI Assistant  
**최종 업데이트**: 2025년 12월 17일  
**상태**: ✅ 완료

