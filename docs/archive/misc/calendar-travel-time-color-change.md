# 캘린더 이동시간 색상 변경

## 📋 요구사항

이동시간 표시 색상을 변경하여 다른 타임슬롯과 구분하기 쉽게 개선

## 🔧 수정 내용

### 1. 이동시간 색상을 청록색(teal) 계열로 변경 (`lib/utils/darkMode.ts`)

**변경 전:**
- 이동시간: 회색 계열 (`bg-gray-50 dark:bg-gray-800`)

**변경 후:**
- 이동시간: 청록색 계열 (`bg-teal-50 dark:bg-teal-900/30`)

```typescript
const timeSlotColorMap: Record<TimeSlotType, string> = {
  "학습시간": "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200",
  "점심시간": "bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-200",
  "학원일정": "bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-200",
  "이동시간": "bg-teal-50 dark:bg-teal-900/30 border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200", // 청록색 계열로 변경
  "자율학습": "bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200",
};
```

### 2. MonthView에서 하드코딩된 색상 제거 (`app/(student)/plan/calendar/_components/MonthView.tsx`)

**변경 전:**
- 점심시간, 이동시간, 자율학습에 하드코딩된 색상 사용
- 자율학습은 초록색, 나머지는 주황색

**변경 후:**
- 공통 유틸리티 함수 `getTimeSlotColorClass` 사용하여 색상 통일

```typescript
// 점심시간, 이동시간, 자율학습 표시
if (slot.type !== "학습시간") {
  if (displayedCount < maxDisplay && !showOnlyStudyTime) {
    const icon = slot.type === "점심시간" ? "🍽️" : slot.type === "이동시간" ? "🚶" : slot.type === "자율학습" ? "📖" : "⏰";
    // 공통 유틸리티 함수 사용하여 색상 통일
    const colorClass = getTimeSlotColorClass(slot.type);
    items.push(
      <div
        key={`slot-${slot.start}-${slot.end}-${slot.type}`}
        className={`truncate rounded px-1.5 py-0.5 text-[10px] border ${colorClass}`}
        title={`${slot.type}: ${slot.start} ~ ${slot.end}`}
      >
        {icon} {slot.type}
      </div>
    );
    displayedCount++;
  }
  return;
}
```

### 3. TimelineItem에서 이동시간 색상 업데이트 (`app/(student)/plan/calendar/_components/TimelineItem.tsx`)

**변경 전:**
- 이동시간이 점심시간과 같은 주황색으로 표시됨

**변경 후:**
- 이동시간을 청록색으로 표시

```typescript
<span className={cn(
  "rounded-full px-4 py-1.5 text-xs font-bold shadow-[var(--elevation-1)]",
  slot.type === "학습시간"
    ? "bg-blue-500 text-white"
    : slot.type === "학원일정"
    ? "bg-purple-500 text-white"
    : slot.type === "자율학습"
    ? "bg-green-500 text-white"
    : slot.type === "이동시간"
    ? "bg-teal-500 text-white" // 청록색으로 변경
    : "bg-orange-500 text-white"
)}>
  {slot.type}
</span>
```

## ✅ 결과

### 타임슬롯 색상 정리

| 타임슬롯 타입 | 색상 | 배경색 (라이트) | 배경색 (다크) |
|-------------|------|----------------|--------------|
| **학습시간** | 파란색 계열 | `bg-blue-50` | `dark:bg-blue-900/30` |
| **점심시간** | 주황색 계열 | `bg-orange-50` | `dark:bg-orange-900/30` |
| **학원일정** | 보라색 계열 | `bg-purple-50` | `dark:bg-purple-900/30` |
| **이동시간** | 청록색 계열 | `bg-teal-50` | `dark:bg-teal-900/30` |
| **자율학습** | 초록색 계열 | `bg-green-50` | `dark:bg-green-900/30` |

### 주요 변경사항

1. **이동시간 색상 변경**
   - 회색 계열 → 청록색 계열로 변경
   - 점심시간과 구분이 더 명확해짐

2. **색상 통일**
   - MonthView에서 하드코딩된 색상 제거
   - 공통 유틸리티 함수 사용으로 일관성 향상

3. **시각적 구분 개선**
   - 각 타임슬롯 타입별로 고유한 색상 적용
   - 사용자가 타임슬롯을 더 쉽게 구분 가능

## 📝 관련 파일

- `lib/utils/darkMode.ts`: 이동시간 색상을 청록색 계열로 변경
- `app/(student)/plan/calendar/_components/MonthView.tsx`: 하드코딩된 색상 제거 및 공통 유틸리티 사용
- `app/(student)/plan/calendar/_components/TimelineItem.tsx`: 이동시간 색상 업데이트

## 🔍 테스트 시나리오

1. **이동시간 색상 확인**
   - MonthView, WeekView, DayView에서 이동시간이 청록색 계열로 표시되는지 확인
   - 다크 모드에서도 올바르게 표시되는지 확인

2. **다른 타임슬롯과의 구분 확인**
   - 점심시간(주황색)과 이동시간(청록색)이 명확히 구분되는지 확인
   - 모든 타임슬롯 타입이 고유한 색상으로 표시되는지 확인

