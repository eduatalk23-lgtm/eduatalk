# 캘린더 UI 개선 작업

## 작업 일시
2024년 12월 15일

## 개선 사항

### 1. 웹 본문 영역 확대

#### 컨테이너 너비 확대
- **변경 전**: `getContainerClass("LIST", "md")` - max-w-6xl (약 1152px)
- **변경 후**: `getContainerClass("DASHBOARD", "md")` - max-w-[1536px] (약 1536px)
- 더 넓은 화면에서 캘린더를 더 잘 볼 수 있도록 개선

#### 적용 파일
- `app/(student)/plan/calendar/page.tsx`

### 2. 헤더 섹션 개선

#### 레이아웃 개선
- 헤더 섹션을 더 간결하고 명확하게 재구성
- 통계 카드를 그리드 레이아웃으로 변경 (2열 모바일, 4열 데스크톱)
- 제목 크기 확대 (text-3xl → text-3xl md:text-4xl)
- 패딩 조정 (p-6 → p-6 md:p-8)

#### 통계 카드 개선
- 카드 크기 일관성 개선
- 숫자 크기 확대 (text-2xl → text-2xl md:text-3xl)
- 반응형 그리드 레이아웃 적용

### 3. PlanCalendarView 개선

#### 헤더 영역
- 패딩 확대 (px-6 py-5 → px-6 md:px-8 py-5 md:py-6)
- 날짜 제목 크기 확대 (text-2xl → text-2xl md:text-3xl)
- 버튼 크기 및 간격 조정
- 필터 버튼 반응형 텍스트 (모바일에서 아이콘만 표시)

#### 캘린더 뷰 영역
- 패딩 확대 (p-4 → p-4 md:p-6 lg:p-8)
- 더 넓은 화면에서 여백 확보

### 4. 각 뷰 컴포넌트 레이아웃 최적화

#### MonthView
- 요일 헤더 간격 확대 (gap-1 → gap-2 md:gap-3)
- 캘린더 그리드 간격 확대 (gap-1 → gap-2 md:gap-3)
- 날짜 셀 최소 높이 확대 (min-h-[120px] → min-h-[120px] md:min-h-[140px] lg:min-h-[160px])
- 셀 패딩 조정 (p-2 → p-2 md:p-3)
- 빈 셀에도 rounded-lg 적용

#### WeekView
- 전체 간격 확대 (gap-2 → gap-3 md:gap-4)
- 요일 헤더 간격 확대 (gap-2 → gap-2 md:gap-3)
- 날짜 카드 간격 확대 (gap-2 → gap-2 md:gap-3)
- 카드 패딩 확대 (p-2 → p-3 md:p-4)
- 요일 헤더 텍스트 크기 조정 (text-sm → text-sm md:text-base)

#### DayView
- 전체 간격 확대 (gap-6 → gap-6 md:gap-8)
- 날짜 헤더 패딩 확대 (p-6 → p-6 md:p-8)
- 타임라인 뷰 헤더 패딩 확대 (px-6 py-4 → px-6 md:px-8 py-4 md:py-5)
- 타임라인 제목 크기 확대 (text-xl → text-xl md:text-2xl)
- 타임라인 본문 패딩 확대 (p-6 → p-6 md:p-8)

## 개선 효과

1. **가독성 향상**: 더 넓은 화면 공간 활용으로 정보를 더 명확하게 표시
2. **반응형 개선**: 모바일과 데스크톱에서 모두 최적화된 레이아웃
3. **시각적 여유**: 적절한 간격과 패딩으로 더 편안한 사용자 경험
4. **일관성**: 모든 뷰에서 일관된 디자인 패턴 적용

## 변경된 파일

1. `app/(student)/plan/calendar/page.tsx`
2. `app/(student)/plan/calendar/_components/PlanCalendarView.tsx`
3. `app/(student)/plan/calendar/_components/MonthView.tsx`
4. `app/(student)/plan/calendar/_components/WeekView.tsx`
5. `app/(student)/plan/calendar/_components/DayView.tsx`

## 참고 사항

- 모든 변경사항은 기존 기능을 유지하면서 UI만 개선
- 반응형 디자인을 고려하여 모바일과 데스크톱 모두 최적화
- Spacing-First 정책 준수 (gap 우선 사용)
- Tailwind CSS 유틸리티 클래스만 사용 (인라인 스타일 없음)

