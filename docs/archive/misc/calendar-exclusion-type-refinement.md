# 캘린더 제외일 타입별 정제 및 UI 개선

## 📋 요구사항

1. **휴일지정**: 모두 표시 (필터링 없음)
2. **기타**: 뱃지도 제외일 표시 (지정휴일과 같은 방식의 표시 아니도록 수정)
3. **휴일지정을 제외한 학습 제외일 UI 컬러 개선**

## 🔧 수정 내용

### 1. 휴일지정 제외일: 모든 타임슬롯 표시 (`app/(student)/plan/calendar/_utils/timelineUtils.ts`)

**변경 전:**
- 휴일지정 제외일은 자율학습만 허용, 나머지 학습 관련 슬롯 필터링

**변경 후:**
- 휴일지정 제외일은 모든 타임슬롯 표시 (필터링 없음)

```typescript
// 제외일 타입 확인
const isHolidayDesignated = exclusionType === "휴일지정"; // 모든 타임슬롯 표시

// 타임슬롯 필터링
if (isExclusionDay) {
  // "휴일지정" 제외일: 모든 타임슬롯 표시 (필터링 없음)
  if (isHolidayDesignated) {
    // 필터링하지 않음 - 모든 슬롯 표시
  }
  // "기타" 제외일: 모든 학습 관련 슬롯 필터링
  else if (isOtherExclusion && slot.type !== "학원일정") {
    return;
  }
  // ...
}

// 학습시간 슬롯 처리
if (slot.type === "학습시간") {
  // "휴일지정"은 모든 타임슬롯을 표시하므로 필터링하지 않음
  if (isExclusionDay && !isHolidayDesignated) {
    return;
  }
}
```

### 2. "기타" 제외일 UI 컬러 개선

#### 2.1 색상 타입 추가 (`lib/utils/darkMode.ts`)

```typescript
export type DayTypeBadge = "학습일" | "복습일" | "지정휴일" | "휴가" | "개인일정" | "기타";

const dayTypeBadgeColorMap: Record<DayTypeBadge, string> = {
  // ... existing types ...
  "기타": "bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700",
};

const typeMap: Record<string, { bg: string; border: string; text: string; boldText: string }> = {
  // ... existing types ...
  "기타": {
    bg: "bg-red-50 dark:bg-red-900/30",
    border: "border-red-300 dark:border-red-700",
    text: "text-red-600 dark:text-red-400",
    boldText: "text-red-900 dark:text-red-100",
  },
};
```

#### 2.2 스타일링 로직 개선 (`app/(student)/plan/calendar/_hooks/useDayTypeStyling.ts`)

```typescript
// 제외일 타입 확인
const exclusionType = exclusions.length > 0 ? exclusions[0].exclusion_type : null;
const isOtherExclusion = exclusionType === "기타";

// "기타" 제외일은 빨간색 계열 색상 사용
let dayTypeForColor: string = isHoliday ? "지정휴일" : dayType;
if (isOtherExclusion) {
  dayTypeForColor = "기타";
}

// "기타" 제외일의 경우 모든 색상을 빨간색 계열로 오버라이드
if (isOtherExclusion) {
  bgColorClass = "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/30";
  textColorClass = "text-red-600 dark:text-red-400";
  boldTextColorClass = "text-red-900 dark:text-red-100";
  badgeClass = "bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700";
}
```

### 3. "기타" 제외일 뱃지 표시 방식 변경 (지정휴일과 구분)

#### 3.1 MonthView (`app/(student)/plan/calendar/_components/MonthView.tsx`)

```typescript
<span 
  className={cn(
    "rounded-full px-1.5 py-0.5 text-[9px] md:text-[10px] font-semibold border shadow-[var(--elevation-1)] shrink-0 whitespace-nowrap",
    dayTypeBadgeClass,
    // "기타" 제외일은 더 강조 (지정휴일과 구분)
    dayExclusions.length > 0 && dayExclusions[0].exclusion_type === "기타" && 
    "ring-2 ring-red-500 ring-offset-1",
    // 다른 제외일은 기존 스타일 유지
    (dayType === "지정휴일" || dayType === "휴가" || dayType === "개인일정") && 
    dayExclusions.length > 0 && dayExclusions[0].exclusion_type !== "기타" &&
    "ring-1 ring-offset-0"
  )}
>
  {dayTypeInfo.label}
</span>
```

#### 3.2 WeekView (`app/(student)/plan/calendar/_components/WeekView.tsx`)

```typescript
<span 
  className={cn(
    "rounded-full px-1.5 py-0.5 text-[9px] font-semibold border shadow-[var(--elevation-1)]",
    dayTypeBadgeClass,
    // "기타" 제외일은 더 강조 (지정휴일과 구분)
    dayExclusions.length > 0 && dayExclusions[0].exclusion_type === "기타" && 
    "ring-2 ring-red-500 ring-offset-1",
    // 다른 제외일은 기존 스타일 유지
    dayExclusions.length > 0 && dayExclusions[0].exclusion_type !== "기타" &&
    "ring-1 ring-offset-0"
  )}
>
  {dayTypeInfo.label}
</span>
```

#### 3.3 DayView (`app/(student)/plan/calendar/_components/DayView.tsx`)

```typescript
<span 
  className={cn(
    "rounded-full px-4 py-1.5 text-sm font-bold border-2 shadow-[var(--elevation-1)]",
    dayTypeBadgeClass,
    // "기타" 제외일은 더 강조 (지정휴일과 구분)
    dayExclusions.length > 0 && dayExclusions[0].exclusion_type === "기타" && 
    "ring-2 ring-red-500 ring-offset-2",
    // 다른 제외일은 기존 스타일 유지
    (dayType === "지정휴일" || dayType === "휴가" || dayType === "개인일정") && 
    dayExclusions.length > 0 && dayExclusions[0].exclusion_type !== "기타" &&
    "ring-2 ring-offset-2"
  )}
>
  {dayTypeInfo.icon} {dayTypeInfo.label}
</span>
```

## ✅ 결과

### 제외일 타입별 처리 규칙

| 제외일 타입 | 타임슬롯 표시 | UI 색상 | 뱃지 스타일 |
|------------|------------|---------|------------|
| **휴일지정** | ✅ 모두 표시 | 노란색 계열 | `ring-1 ring-offset-0` |
| **기타** | ❌ 학습 관련 슬롯 필터링 | 빨간색 계열 | `ring-2 ring-red-500 ring-offset-1` |
| **휴가** | ❌ 학습 관련 슬롯 필터링 | 회색 계열 | `ring-1 ring-offset-0` |
| **개인사정** | ❌ 학습 관련 슬롯 필터링 | 보라색 계열 | `ring-1 ring-offset-0` |

### 주요 변경사항

1. **휴일지정 제외일**
   - 모든 타임슬롯 표시 (필터링 없음)
   - 노란색 계열 색상 유지

2. **기타 제외일**
   - 모든 학습 관련 슬롯 필터링
   - 빨간색 계열 색상으로 강조
   - 뱃지에 `ring-2 ring-red-500` 적용하여 지정휴일과 구분

3. **다른 제외일 타입**
   - 기존과 동일하게 모든 학습 관련 슬롯 필터링
   - 각 타입별 색상 유지

## 📝 관련 파일

- `app/(student)/plan/calendar/_utils/timelineUtils.ts`: 휴일지정 제외일 필터링 제거
- `app/(student)/plan/calendar/_hooks/useDayTypeStyling.ts`: 기타 제외일 색상 개선
- `lib/utils/darkMode.ts`: 기타 제외일 색상 타입 추가
- `app/(student)/plan/calendar/_components/MonthView.tsx`: 기타 제외일 뱃지 스타일 변경
- `app/(student)/plan/calendar/_components/WeekView.tsx`: 기타 제외일 뱃지 스타일 변경
- `app/(student)/plan/calendar/_components/DayView.tsx`: 기타 제외일 뱃지 스타일 변경

## 🔍 테스트 시나리오

1. **휴일지정 제외일 확인**
   - 모든 타임슬롯(학습시간, 점심시간, 이동시간, 자율학습, 학원일정)이 표시되는지 확인
   - 노란색 계열 색상이 적용되는지 확인

2. **기타 제외일 확인**
   - 모든 학습 관련 슬롯이 필터링되는지 확인
   - 빨간색 계열 색상이 적용되는지 확인
   - 뱃지에 `ring-2 ring-red-500`가 적용되어 지정휴일과 구분되는지 확인

3. **다른 제외일 타입 확인**
   - 휴가, 개인사정 제외일에서 모든 학습 관련 슬롯이 필터링되는지 확인
   - 각 타입별 색상이 올바르게 적용되는지 확인

