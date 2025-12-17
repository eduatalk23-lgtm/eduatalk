# 캘린더 제외일 표시 강화

## 작업 일시
2024년 12월 15일

## 개선 사항

### 1. MonthView - 제외일 표시 강화 ✅

#### 제외일 배지 개선
- **툴팁 강화**: 제외일 배지에 마우스를 올리면 제외일 타입과 사유 표시
  - 형식: `{제외일명} - {제외일타입}: {사유}`
  - 예: `지정휴일 - 휴가: 가족 여행`
- **시각적 강조**: 제외일 배지에 `ring-1 ring-offset-0` 효과 추가
- **제외일 경고 배지**: 제외일이 있고 플랜이 있는 경우 경고 배지 표시
  - 위치: 플랜 목록 상단
  - 스타일: 주황색 배경, 제외일 타입 표시
  - 아이콘: ⚠️

#### 구현 세부사항
```tsx
// 제외일 배지 툴팁
title={
  dayTypeInfo.exclusion 
    ? `${dayTypeInfo.label}${dayTypeInfo.exclusion.exclusion_type ? ` - ${dayTypeInfo.exclusion.exclusion_type}` : ""}${dayTypeInfo.exclusion.reason ? `: ${dayTypeInfo.exclusion.reason}` : ""}`
    : dayTypeInfo.label
}

// 제외일 경고 배지
{dayExclusions.length > 0 && items.length > 0 && (
  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 mb-1">
    <span className="text-[9px] text-orange-700 dark:text-orange-300 font-semibold">
      ⚠️
    </span>
    <span className="text-[9px] text-orange-600 dark:text-orange-400 font-medium">
      제외일
    </span>
    {dayExclusions[0].exclusion_type && (
      <span className="text-[9px] text-orange-500 dark:text-orange-500">
        ({dayExclusions[0].exclusion_type})
      </span>
    )}
  </div>
)}
```

### 2. WeekView - 제외일 표시 추가 ✅

#### 제외일 배지 표시
- **제외일 배지 추가**: 학습일/복습일과 동일한 패턴으로 제외일 배지 표시
- **시각적 강조**: 제외일 배지에 `ring-1 ring-offset-0` 효과 추가
- **툴팁 강화**: 제외일 배지에 마우스를 올리면 상세 정보 표시

#### 제외일 상세 정보 표시
- **위치**: 날짜 헤더 아래, 플랜 통계 위
- **표시 내용**:
  - 제외일 타입 (exclusion_type)
  - 제외일 사유 (reason) - 있으면 표시
- **스타일**: 주황색 배경, 다크모드 지원

#### 구현 세부사항
```tsx
// 제외일 배지
{isExclusionDay && (
  <span 
    className={cn(
      "rounded-full px-1.5 py-0.5 text-[9px] font-semibold border shadow-[var(--elevation-1)] ring-1 ring-offset-0",
      dayTypeBadgeClass
    )}
    title={/* 툴팁 정보 */}
  >
    {dayTypeInfo.label}
  </span>
)}

// 제외일 상세 정보
{isExclusionDay && dayExclusions.length > 0 && dayExclusions[0] && (
  <div className="flex flex-col gap-0.5 px-2 py-1 rounded bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
    {dayExclusions[0].exclusion_type && (
      <span className="text-[10px] font-medium text-orange-700 dark:text-orange-300">
        {dayExclusions[0].exclusion_type}
      </span>
    )}
    {dayExclusions[0].reason && (
      <span className="text-[9px] text-orange-600 dark:text-orange-400 line-clamp-1">
        {dayExclusions[0].reason}
      </span>
    )}
  </div>
)}
```

### 3. DayView - 제외일 표시 강화 ✅

#### 제외일 배지 개선
- **시각적 강조**: 제외일 배지에 `ring-2 ring-offset-2` 효과 추가
- **툴팁 강화**: 제외일 배지에 마우스를 올리면 상세 정보 표시
- **기존 정보 유지**: 제외일 타입과 사유는 기존대로 표시

#### 구현 세부사항
```tsx
<span 
  className={cn(
    "rounded-full px-4 py-1.5 text-sm font-bold border-2 shadow-[var(--elevation-1)]",
    dayTypeBadgeClass,
    // 제외일인 경우 더 눈에 띄게
    (dayType === "지정휴일" || dayType === "휴가" || dayType === "개인일정") && 
    "ring-2 ring-offset-2"
  )}
  title={/* 툴팁 정보 */}
>
  {dayTypeInfo.icon} {dayTypeInfo.label}
</span>
```

## 개선 효과

### 1. 제외일 식별성 향상
- ✅ 제외일 배지에 ring 효과로 시각적 강조
- ✅ 제외일이 있는 날짜에 플랜이 있으면 경고 배지 표시
- ✅ 모든 뷰에서 일관된 제외일 표시

### 2. 정보 접근성 향상
- ✅ 툴팁으로 제외일 상세 정보 확인 가능
- ✅ WeekView에서 제외일 타입과 사유 직접 표시
- ✅ DayView에서 기존 정보 유지하면서 시각적 강조 추가

### 3. 사용자 경험 개선
- ✅ 제외일이 있는 날짜에 플랜이 있는 경우 명확한 경고
- ✅ 제외일 정보를 쉽게 확인 가능
- ✅ 다크모드 지원

## 변경된 파일

1. `app/(student)/plan/calendar/_components/MonthView.tsx`
   - 제외일 배지 툴팁 강화
   - 제외일 배지에 ring 효과 추가
   - 제외일 경고 배지 추가

2. `app/(student)/plan/calendar/_components/WeekView.tsx`
   - 제외일 배지 표시 추가
   - 제외일 상세 정보 표시 추가
   - 제외일 배지 툴팁 강화

3. `app/(student)/plan/calendar/_components/DayView.tsx`
   - 제외일 배지에 ring 효과 추가
   - 제외일 배지 툴팁 강화

## 시각적 개선 사항

### MonthView
- 제외일 배지: ring 효과로 강조
- 제외일 경고: 플랜이 있는 제외일에 경고 배지 표시

### WeekView
- 제외일 배지: 학습일/복습일과 동일한 패턴으로 표시
- 제외일 상세: 별도 영역에 타입과 사유 표시

### DayView
- 제외일 배지: 더 큰 ring 효과로 강조
- 기존 정보: 제외일 타입과 사유는 기존대로 표시

## 기술적 세부사항

### 툴팁 형식
```
{제외일명} - {제외일타입}: {사유}
예: 지정휴일 - 휴가: 가족 여행
```

### 제외일 타입
- 지정휴일
- 휴가
- 개인일정

### 색상 체계
- 제외일 배지: 주황색 계열 (orange)
- 제외일 경고: 주황색 배경 (orange-50/orange-900)
- 다크모드: 자동 대응

## 향후 개선 가능 사항

1. 제외일 필터링: 제외일이 있는 날짜의 플랜 숨기기 옵션
2. 제외일 통계: 제외일이 있는 날짜의 플랜 통계 표시
3. 제외일 편집: 캘린더에서 직접 제외일 추가/수정/삭제

