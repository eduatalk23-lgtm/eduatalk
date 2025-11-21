# 플랜 캘린더 개선 사항

## 📋 개요

`app/(student)/plan/calendar` 폴더의 코드를 분석하고 가이드라인에 따른 개선 사항을 제안합니다.

---

## 🔴 주요 문제점

### 0. ⚠️ 기능 누락: 점심시간, 휴일, 학원일정 표시

**문제**: 캘린더에 점심시간, 휴일(제외일), 학원일정이 표시되지 않음
- 현재는 플랜(학습 계획)만 표시됨
- 학원일정, 휴일, 점심시간 등 일정 정보가 누락됨

**영향**: 
- 사용자가 전체 일정을 한눈에 파악하기 어려움
- 학원일정과 플랜의 충돌을 확인할 수 없음
- 휴일 정보가 없어 플랜이 휴일에 배정되는지 확인 불가

**해결 방안**: 관련 데이터 조회 및 표시 기능 추가

```typescript
// page.tsx에 추가 필요
import { getStudentExclusions } from "@/lib/data/planGroups";
import { getStudentAcademySchedules } from "@/lib/data/planGroups";

// 휴일 조회
const exclusions = await getStudentExclusions(user.id);

// 학원일정 조회
const academySchedules = await getStudentAcademySchedules(user.id);

// 날짜별로 그룹화
const exclusionsByDate = new Map<string, PlanExclusion[]>();
exclusions.forEach((exclusion) => {
  const date = exclusion.exclusion_date;
  if (!exclusionsByDate.has(date)) {
    exclusionsByDate.set(date, []);
  }
  exclusionsByDate.get(date)!.push(exclusion);
});

// 학원일정을 날짜별로 변환 (요일 기반)
const academySchedulesByDate = new Map<string, AcademySchedule[]>();
academySchedules.forEach((schedule) => {
  // 현재 표시 중인 날짜 범위에서 해당 요일의 날짜들을 찾아서 추가
  // 예: 월요일(1)이면 모든 월요일 날짜에 추가
});
```

**표시 방법**:
- **휴일**: 해당 날짜에 배경색 변경 또는 배지 표시
- **학원일정**: 시간대별로 표시 (DayView, WeekView에서)
- **점심시간**: 시간 블록에서 점심시간 블록 식별하여 표시
  - `time_settings.lunch_time` (기본: 12:00~13:00) 또는
  - 블록 타입이 "점심시간"인 경우 식별

**데이터 조회 필요**:
```typescript
// 1. 휴일 조회 (이미 함수 존재)
import { getStudentExclusions } from "@/lib/data/planGroups";
const exclusions = await getStudentExclusions(user.id);

// 2. 학원일정 조회 (이미 함수 존재)
import { getStudentAcademySchedules } from "@/lib/data/planGroups";
const academySchedules = await getStudentAcademySchedules(user.id);

// 3. 점심시간 설정 조회 (플랜 그룹의 time_settings에서)
// 또는 student_block_schedule에서 타입이 "점심시간"인 블록 조회
// 현재는 플랜 그룹의 scheduler_options에 time_settings가 포함될 수 있음
```

**구현 예시**:

```tsx
// MonthView.tsx
const dayExclusions = exclusionsByDate.get(dateStr) || [];
const isHoliday = dayExclusions.length > 0;

<div
  className={`min-h-[100px] border border-gray-200 p-2 ${
    isHoliday ? "bg-red-50 border-red-200" : isToday ? "bg-indigo-50" : "bg-white"
  }`}
>
  {isHoliday && (
    <div className="mb-1 text-xs text-red-600 font-medium">
      🏖️ {dayExclusions[0].exclusion_type}
    </div>
  )}
  {/* ... 플랜 표시 ... */}
</div>
```

```tsx
// DayView.tsx - 학원일정 표시
const dayAcademySchedules = academySchedulesByDate.get(dateStr) || [];

{dayAcademySchedules.map((schedule) => (
  <div
    key={schedule.id}
    className="mb-2 rounded-lg border-2 border-purple-200 bg-purple-50 p-3"
  >
    <div className="flex items-center gap-2">
      <span className="text-lg">🏫</span>
      <div>
        <div className="font-semibold text-gray-900">
          {schedule.academy_name || "학원"}
        </div>
        <div className="text-sm text-gray-600">
          {schedule.start_time} ~ {schedule.end_time}
        </div>
        {schedule.subject && (
          <div className="text-xs text-gray-500">{schedule.subject}</div>
        )}
      </div>
    </div>
  </div>
))}
```

---

### 1. 타입 중복 정의

**문제**: `PlanWithContent` 타입이 4개 파일에 중복 정의됨
- `PlanCalendarView.tsx`
- `MonthView.tsx`
- `WeekView.tsx`
- `DayView.tsx`

**영향**: 타입 변경 시 4곳을 모두 수정해야 함 (유지보수성 저하)

**해결 방안**: 공통 타입 파일로 분리

```typescript
// app/(student)/plan/calendar/_types/plan.ts
import type { Plan } from "@/lib/data/studentPlans";

export type PlanWithContent = Plan & {
  contentTitle: string;
  contentSubject: string | null;
};
```

---

### 2. 날짜 포맷팅 로직 중복

**문제**: 날짜 포맷팅 로직이 여러 컴포넌트에 중복 구현됨
- `formatMonthYear` (PlanCalendarView.tsx:63-65)
- `formatWeekRange` (PlanCalendarView.tsx:67-77)
- `formatDay` (PlanCalendarView.tsx:79-83)
- `formatDate` (WeekView.tsx:46-48, DayView.tsx:45-49)
- `isToday` (WeekView.tsx:50-57, DayView.tsx:51-58)
- 주 시작일 계산 로직 (WeekView.tsx:17-22, PlanCalendarView.tsx:68-71)

**영향**: 로직 변경 시 여러 곳 수정 필요, 일관성 저하 가능

**해결 방안**: 날짜 유틸리티 함수로 분리

```typescript
// lib/date/calendarUtils.ts
export function formatMonthYear(date: Date): string {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

export function formatWeekRangeShort(date: Date): string {
  const { weekStart, weekEnd } = getWeekRange(date);
  return `${weekStart.getMonth() + 1}/${weekStart.getDate()} ~ ${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`;
}

export function formatDay(date: Date): string {
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const weekday = weekdays[date.getDay()];
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${weekday})`;
}

export function formatDateFull(date: Date): string {
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const weekday = weekdays[date.getDay()];
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${weekday})`;
}

export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}
```

---

### 3. 하드코딩된 이모지 사용

**문제**: 이모지가 하드코딩되어 있음 (가이드라인 위반)
- `MonthView.tsx`: 📚, 🎧, 📝
- `WeekView.tsx`: 📚, 🎧, 📝
- `DayView.tsx`: 📚, 🎧, 📝, 📖, ✅, ⏱️
- `page.tsx`: 📅

**영향**: 아이콘 시스템 미사용, 일관성 저하

**해결 방안**: 아이콘 시스템 사용 또는 상수로 분리

```typescript
// app/(student)/plan/calendar/_constants/contentIcons.ts
import { Book, Headphones, FileText } from "lucide-react";

export const CONTENT_TYPE_ICONS = {
  book: Book,
  lecture: Headphones,
  custom: FileText,
} as const;

// 또는 이모지를 사용한다면 상수로 분리
export const CONTENT_TYPE_EMOJIS = {
  book: "📚",
  lecture: "🎧",
  custom: "📝",
} as const;
```

---

### 4. 하드코딩된 시간대 블록

**문제**: `DayView.tsx`에 시간대 블록이 하드코딩됨 (16-27줄)

**해결 방안**: 상수 파일로 분리 또는 데이터베이스/설정에서 관리

```typescript
// app/(student)/plan/calendar/_constants/timeBlocks.ts
export const TIME_BLOCKS = [
  { index: 0, label: "오전 1교시", time: "09:00" },
  { index: 1, label: "오전 2교시", time: "10:00" },
  { index: 2, label: "오전 3교시", time: "11:00" },
  { index: 3, label: "오후 1교시", time: "13:00" },
  { index: 4, label: "오후 2교시", time: "14:00" },
  { index: 5, label: "오후 3교시", time: "15:00" },
  { index: 6, label: "오후 4교시", time: "16:00" },
  { index: 7, label: "저녁 1교시", time: "18:00" },
  { index: 8, label: "저녁 2교시", time: "19:00" },
  { index: 9, label: "저녁 3교시", time: "20:00" },
] as const;
```

---

### 5. Spacing-First 정책 위반 가능성

**문제**: 일부 컴포넌트에서 margin 사용 가능성
- `page.tsx:135`: `mb-6` 사용 (헤더와 캘린더 간격)
- `MonthView.tsx:54`: `mb-1` 사용
- `WeekView.tsx:77`: `mb-2` 사용

**해결 방안**: gap 또는 padding으로 변경

```tsx
// ❌ 나쁜 예
<div className="mb-6">
  <h1>...</h1>
</div>

// ✅ 좋은 예
<div className="flex flex-col gap-6">
  <h1>...</h1>
  <PlanCalendarView ... />
</div>
```

---

### 6. 반응형 디자인 미흡

**문제**: 모바일 환경에서의 사용성 고려 부족
- 캘린더 그리드가 작은 화면에서 가독성 저하 가능
- 버튼 크기 및 간격이 모바일에 최적화되지 않음

**해결 방안**: 반응형 클래스 추가

```tsx
// 헤더 버튼 그룹
<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
  {/* ... */}
</div>

// 캘린더 뷰 전환 버튼
<div className="flex flex-wrap gap-2">
  {/* ... */}
</div>
```

---

### 7. 접근성 개선 필요

**문제**: 
- 버튼에 aria-label 누락
- 키보드 네비게이션 미지원
- 스크린 리더를 위한 설명 부족

**해결 방안**: ARIA 속성 추가

```tsx
<button
  onClick={goToPrevious}
  aria-label="이전 기간으로 이동"
  className="..."
>
  <ChevronLeft className="h-5 w-5" />
</button>
```

---

### 8. 성능 최적화 필요

**문제**: 
- 날짜 계산 로직이 매 렌더링마다 실행됨
- 플랜 그룹화 로직이 매 렌더링마다 실행됨

**해결 방안**: useMemo 활용

```tsx
const plansByDate = useMemo(() => {
  const map = new Map<string, PlanWithContent[]>();
  plans.forEach((plan) => {
    const date = plan.plan_date;
    if (!map.has(date)) {
      map.set(date, []);
    }
    map.get(date)!.push(plan);
  });
  return map;
}, [plans]);
```

---

### 9. 에러 처리 부족

**문제**: 
- `page.tsx`에서 데이터 페칭 실패 시 에러 처리 없음
- 빈 상태 처리만 있음

**해결 방안**: 에러 바운더리 및 에러 상태 추가

```tsx
try {
  const activePlanGroups = await getPlanGroupsForStudent({...});
  // ...
} catch (error) {
  return (
    <section className="...">
      <div className="...">
        <p>데이터를 불러오는 중 오류가 발생했습니다.</p>
      </div>
    </section>
  );
}
```

---

### 10. 코드 구조 개선

**문제**: 
- `page.tsx`에 비즈니스 로직이 과도하게 포함됨
- 데이터 변환 로직이 페이지 컴포넌트에 있음

**해결 방안**: 유틸리티 함수로 분리

```typescript
// app/(student)/plan/calendar/_utils/planDataTransform.ts
export function transformPlansWithContent(
  plans: Plan[],
  books: Book[],
  lectures: Lecture[],
  customContents: CustomContent[]
): PlanWithContent[] {
  const contentMap = new Map<string, any>();
  books.forEach((book) => contentMap.set(`book:${book.id}`, book));
  lectures.forEach((lecture) => contentMap.set(`lecture:${lecture.id}`, lecture));
  customContents.forEach((custom) => contentMap.set(`custom:${custom.id}`, custom));

  return plans.map((plan) => {
    const contentKey = `${plan.content_type}:${plan.content_id}`;
    const content = contentMap.get(contentKey);

    return {
      ...plan,
      contentTitle: content?.title || "제목 없음",
      contentSubject: content?.subject || null,
    };
  });
}

export function calculateDateRange(planGroups: PlanGroup[]): {
  minDate: string;
  maxDate: string;
} {
  const dateRanges = planGroups.map((group) => ({
    start: group.period_start,
    end: group.period_end,
  }));

  const minDate = dateRanges.reduce(
    (min, range) => (range.start < min ? range.start : min),
    dateRanges[0]?.start || new Date().toISOString().slice(0, 10)
  );
  const maxDate = dateRanges.reduce(
    (max, range) => (range.end > max ? range.end : max),
    dateRanges[0]?.end || new Date().toISOString().slice(0, 10)
  );

  return { minDate, maxDate };
}
```

---

## ✅ 개선 우선순위

### 최우선 (즉시 개선)
0. ⚠️ **기능 누락**: 점심시간, 휴일, 학원일정 표시 기능 추가
   - 사용자 요구사항에 직접적인 기능 누락
   - 전체 일정 파악을 위해 필수적

### 높음 (즉시 개선)
1. ✅ 타입 중복 제거 (PlanWithContent)
2. ✅ 날짜 포맷팅 로직 통합
3. ✅ Spacing-First 정책 준수

### 중간 (단기 개선)
4. ✅ 하드코딩된 값들 상수화
5. ✅ 반응형 디자인 개선
6. ✅ 성능 최적화 (useMemo)

### 낮음 (중기 개선)
7. ✅ 접근성 개선
8. ✅ 에러 처리 강화
9. ✅ 코드 구조 개선 (비즈니스 로직 분리)

---

## 📝 개선 작업 체크리스트

### 기능 추가 (최우선)
- [ ] 휴일(제외일) 데이터 조회 및 표시
- [ ] 학원일정 데이터 조회 및 표시
- [ ] 점심시간 블록 식별 및 표시
- [ ] 날짜별 휴일/학원일정 그룹화 로직
- [ ] MonthView에 휴일 표시
- [ ] WeekView에 휴일/학원일정 표시
- [ ] DayView에 학원일정 표시
- [ ] 점심시간 표시 (시간 블록에서 식별)

### 타입 정의
- [ ] `PlanWithContent` 타입을 공통 파일로 분리
- [ ] 타입 import 경로 통일

### 유틸리티 함수
- [ ] 날짜 포맷팅 함수를 `lib/date/calendarUtils.ts`로 분리
- [ ] 플랜 데이터 변환 함수 분리
- [ ] 날짜 범위 계산 함수 분리

### 상수 분리
- [ ] 콘텐츠 타입 아이콘/이모지 상수화
- [ ] 시간대 블록 상수화
- [ ] 요일 레이블 상수화

### 스타일링
- [ ] margin 사용을 gap/padding으로 변경
- [ ] 반응형 클래스 추가
- [ ] 디자인 시스템 컬러 사용 확인

### 성능
- [ ] useMemo로 계산 로직 최적화
- [ ] 불필요한 리렌더링 방지

### 접근성
- [ ] 버튼에 aria-label 추가
- [ ] 키보드 네비게이션 지원
- [ ] 스크린 리더 대응

### 에러 처리
- [ ] 에러 바운더리 추가
- [ ] 로딩 상태 처리
- [ ] 빈 상태 처리 개선

---

## 🎯 예상 효과

1. **유지보수성 향상**: 타입 및 로직 중복 제거로 변경 사항 반영이 쉬워짐
2. **일관성 향상**: 공통 유틸리티 사용으로 일관된 동작 보장
3. **성능 개선**: 메모이제이션으로 불필요한 계산 감소
4. **사용성 향상**: 반응형 디자인 및 접근성 개선
5. **코드 품질 향상**: 가이드라인 준수로 일관된 코드베이스 유지

---

## 📚 참고 사항

- 가이드라인: `정협보일러플레이트.txt`
- 기존 유틸리티: `lib/date/weekRange.ts` 참고
- 타입 정의: `lib/types/plan.ts` 참고

