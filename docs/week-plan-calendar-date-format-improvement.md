# 주별 캘린더 날짜 표시 형식 개선

## 작업 일자
2025-01-23

## 작업 내용
주별 플랜 캘린더에서 날짜 표시를 월/일 형식으로 통일하고, 학습일/복습일을 아이콘+텍스트 형식으로 표시하도록 개선했습니다.

## 변경 사항

### 파일
- `app/(student)/plan/calendar/_components/WeekView.tsx`

### 주요 변경 내용

1. **날짜 표시 형식 통일**: 요일과 월/일 두 가지를 기재하지 않고 월/일 구조로 변경
   - 기존: 일자(`date.getDate()`) + 월/일 형식(`formatDate(date)`) 두 가지 표시
   - 변경: 월/일 형식(`formatDate(date)`)만 표시 (예: "1/23")

2. **날짜 타입 표시 개선**: 학습일/복습일을 아이콘+텍스트 형식으로 표시
   - 기존: 날짜 타입 배지에 아이콘만 표시 (오른쪽 상단)
   - 변경: 날짜 아래에 아이콘 + 텍스트 형식으로 표시 (예: "✏️ 학습일", "🔄 복습일")
   - 학습일/복습일일 때만 표시

### 변경 코드

```tsx
// 변경 전
<div className="flex flex-col gap-0.5">
  <div className={`text-lg font-bold ${boldTextColorClass}`}>
    {date.getDate()}
  </div>
  <div className="text-[10px] text-gray-500">{formatDate(date)}</div>
</div>
{/* 날짜 타입 배지 - 아이콘만 표시 */}
{dayTypeInfo && dayType !== "normal" && (
  <span className={`rounded-full p-1 text-sm border shadow-sm ${dayTypeBadgeClass}`}>
    {dayTypeInfo.icon}
  </span>
)}

// 변경 후
<div className="flex flex-col gap-0.5">
  <div className={`text-lg font-bold ${boldTextColorClass}`}>
    {formatDate(date)}
  </div>
  {/* 학습일/복습일일 때 아이콘 + 텍스트 표시 */}
  {(isStudyDay || isReviewDay) && dayTypeInfo && (
    <div className="flex items-center gap-1">
      <span className="text-xs">{dayTypeInfo.icon}</span>
      <span className={`text-xs font-medium ${textColorClass}`}>
        {dayTypeInfo.label}
      </span>
    </div>
  )}
</div>
```

### 날짜 타입 아이콘 및 라벨

- **학습일**: ✏️ 학습일
- **복습일**: 🔄 복습일
- **일반**: 표시 안 함

## UI 개선 효과

- **일관성 향상**: 날짜 표시 형식을 월/일로 통일하여 일관성 있는 UI 제공
- **정보 명확성**: 학습일/복습일을 아이콘+텍스트로 명확하게 표시
- **가독성 향상**: 불필요한 중복 정보 제거로 가독성 향상

## 커밋 정보
- 커밋 해시: `8d1bd49`
- 커밋 메시지: "주별 캘린더 날짜 표시를 월/일 형식으로 통일하고 학습일/복습일을 아이콘+텍스트로 표시"

