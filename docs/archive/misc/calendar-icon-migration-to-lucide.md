# 캘린더 아이콘을 lucide-react로 마이그레이션

## 📋 요구사항

캘린더에서 사용하는 이모지 아이콘을 사이드 네비게이션에서 사용하는 lucide-react 아이콘으로 변경

## 🔧 수정 내용

### 1. 타임슬롯 아이콘 변경 (`app/(student)/plan/calendar/_utils/timelineUtils.ts`)

**변경 전:**
- 이모지 문자열 반환 (`"⏰"`, `"🍽️"`, `"🏫"`, `"🚶"`, `"📖"`)

**변경 후:**
- lucide-react 아이콘 컴포넌트 반환 (`Clock`, `Utensils`, `School`, `Footprints`, `BookOpen`)

```typescript
import { Clock, Utensils, School, Footprints, BookOpen, type LucideIcon } from "lucide-react";

export function getTimeSlotIcon(type: TimeSlotType): LucideIcon {
  switch (type) {
    case "학습시간":
      return Clock;
    case "점심시간":
      return Utensils;
    case "학원일정":
      return School;
    case "이동시간":
      return Footprints;
    case "자율학습":
      return BookOpen;
    default:
      return Clock;
  }
}
```

### 2. 콘텐츠 타입 아이콘 변경 (`app/(student)/plan/_shared/utils/contentTypeUtils.ts`)

**변경 전:**
- 이모지 문자열 반환 (`"📚"`, `"🎧"`, `"📝"`)

**변경 후:**
- lucide-react 아이콘 컴포넌트 반환 (`Book`, `Headphones`, `FileText`)

```typescript
import { Book, Headphones, FileText, type LucideIcon } from "lucide-react";

export const CONTENT_TYPE_ICONS: Record<string, LucideIcon> = {
  book: Book,
  lecture: Headphones,
  custom: FileText,
};

export function getContentTypeIcon(type: string): LucideIcon {
  return CONTENT_TYPE_ICONS[type] || FileText;
}
```

### 3. 컴포넌트별 아이콘 사용 변경

#### 3.1 MonthView (`app/(student)/plan/calendar/_components/MonthView.tsx`)

```typescript
// 변경 전
const icon = slot.type === "점심시간" ? "🍽️" : slot.type === "이동시간" ? "🚶" : slot.type === "자율학습" ? "📖" : "⏰";
<span>{icon} {slot.type}</span>

// 변경 후
const IconComponent = getTimeSlotIcon(slot.type);
<IconComponent className="w-3 h-3 shrink-0" />
<span>{slot.type}</span>
```

#### 3.2 WeekView (`app/(student)/plan/calendar/_components/WeekView.tsx`)

```typescript
// 변경 전
const icon = getTimeSlotIcon(slot.type);
<span className="text-sm">{icon}</span>

// 변경 후
const IconComponent = getTimeSlotIcon(slot.type);
<IconComponent className="w-4 h-4 shrink-0" />
```

#### 3.3 DayView (`app/(student)/plan/calendar/_components/DayView.tsx`)

```typescript
// 변경 전
const icon = getTimeSlotIcon(slotType);
<span>{icon}</span>

// 변경 후
const IconComponent = getTimeSlotIcon(slotType);
<IconComponent className="w-4 h-4 shrink-0" />
```

#### 3.4 TimelineItem (`app/(student)/plan/calendar/_components/TimelineItem.tsx`)

```typescript
// 변경 전
const icon = getTimeSlotIcon(slot.type);
<span className="text-2xl">{icon}</span>

// 변경 후
const IconComponent = getTimeSlotIcon(slot.type);
<IconComponent className="w-6 h-6" />
```

#### 3.5 DayTimelineModal (`app/(student)/plan/calendar/_components/DayTimelineModal.tsx`)

```typescript
// 변경 전
const icon = getTimeSlotIcon(slot.type);
<span className="text-2xl">{icon}</span>

// 변경 후
const IconComponent = getTimeSlotIcon(slot.type);
<IconComponent className="w-6 h-6 shrink-0" />
```

#### 3.6 CalendarPlanCard (`app/(student)/plan/calendar/_components/CalendarPlanCard.tsx`)

```typescript
// 변경 전
const contentTypeIcon = getContentTypeIcon(plan.content_type);
<span className="text-xs shrink-0 leading-none">{contentTypeIcon}</span>

// 변경 후
const ContentTypeIcon = getContentTypeIcon(plan.content_type);
<ContentTypeIcon className="w-3 h-3 shrink-0" />
```

### 4. 아이콘 매핑

| 타입 | 이전 (이모지) | 이후 (lucide-react) |
|------|-------------|-------------------|
| **학습시간** | ⏰ | `Clock` |
| **점심시간** | 🍽️ | `Utensils` |
| **학원일정** | 🏫 | `School` |
| **이동시간** | 🚶 | `Footprints` |
| **자율학습** | 📖 | `BookOpen` |
| **교재 (book)** | 📚 | `Book` |
| **강의 (lecture)** | 🎧 | `Headphones` |
| **커스텀 (custom)** | 📝 | `FileText` |

## ✅ 결과

### 주요 변경사항

1. **타임슬롯 아이콘**
   - 모든 타임슬롯 아이콘이 lucide-react 컴포넌트로 변경됨
   - 사이드 네비게이션과 동일한 스타일의 아이콘 사용

2. **콘텐츠 타입 아이콘**
   - 교재, 강의, 커스텀 타입 아이콘이 lucide-react 컴포넌트로 변경됨
   - 일관된 아이콘 스타일 적용

3. **아이콘 크기**
   - 컴포넌트별로 적절한 크기 설정:
     - MonthView: `w-3 h-3` (작은 뱃지)
     - WeekView, DayView: `w-4 h-4` (중간 크기)
     - TimelineItem, DayTimelineModal: `w-6 h-6` (큰 아이콘)

## 📝 관련 파일

- `app/(student)/plan/calendar/_utils/timelineUtils.ts`: 타임슬롯 아이콘 함수 변경
- `app/(student)/plan/_shared/utils/contentTypeUtils.ts`: 콘텐츠 타입 아이콘 함수 변경
- `app/(student)/plan/calendar/_components/MonthView.tsx`: 이모지 → lucide-react 아이콘
- `app/(student)/plan/calendar/_components/WeekView.tsx`: 이모지 → lucide-react 아이콘
- `app/(student)/plan/calendar/_components/DayView.tsx`: 이모지 → lucide-react 아이콘
- `app/(student)/plan/calendar/_components/TimelineItem.tsx`: 이모지 → lucide-react 아이콘
- `app/(student)/plan/calendar/_components/DayTimelineModal.tsx`: 이모지 → lucide-react 아이콘
- `app/(student)/plan/calendar/_components/CalendarPlanCard.tsx`: 이모지 → lucide-react 아이콘

## 🔍 테스트 시나리오

1. **타임슬롯 아이콘 확인**
   - MonthView, WeekView, DayView에서 모든 타임슬롯 아이콘이 lucide-react 아이콘으로 표시되는지 확인
   - 아이콘 크기가 적절한지 확인

2. **콘텐츠 타입 아이콘 확인**
   - CalendarPlanCard에서 교재, 강의, 커스텀 타입 아이콘이 lucide-react 아이콘으로 표시되는지 확인
   - DayView, WeekView에서도 콘텐츠 타입 아이콘이 올바르게 표시되는지 확인

3. **일관성 확인**
   - 사이드 네비게이션과 동일한 스타일의 아이콘이 사용되는지 확인
   - 다크 모드에서도 아이콘이 올바르게 표시되는지 확인

